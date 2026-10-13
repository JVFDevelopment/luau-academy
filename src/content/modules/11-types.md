---
id: types
title: The Type System
part: 2
summary: Catch bugs before you press Play — strict mode, annotations, optional and union types, table and function types, generics, refinements, casts and typed Roblox code.
time: 55 min
level: Intermediate
objectives:
- Choose between `--!nocheck`, `--!nonstrict` and `--!strict`
- Annotate variables, parameters and return values
- Use optional, union, intersection and literal types
- Describe arrays, dictionaries, records and functions as types
- Write generic functions and type aliases, and export types from modules
- Narrow types with refinements and use casts (`::`) responsibly
- Type Roblox Instances and classes correctly
---

Luau is **gradually typed**. You can write code with no types at all — as you have so far — and add type annotations whenever you want the checker's help. With annotations, Studio (and other editors) can flag bugs *as you type*: calling a method that doesn't exist, passing a string where a number is expected, forgetting to handle `nil`. Types never change how your code runs; they're a safety net and a form of documentation.

## Checking modes

The first line of a script can set how strictly it's checked:

| Directive | Behavior |
| --- | --- |
| `--!nocheck` | No type checking at all |
| `--!nonstrict` | The default. Infers what it can, but treats unknowns permissively as `any` |
| `--!strict` | Full checking. Unknown types are errors, and you must handle `nil` |

```luau
--!strict
local coins: number = 100
coins = "lots"   -- ❌ Type 'string' could not be converted into 'number'
```

:::pro Use strict for everything new
Strict mode feels demanding for a day or two, then becomes indispensable. It catches typos, missing `nil` checks and wrong argument types before they ever reach players. Most professional Roblox codebases are fully `--!strict`.
:::

## Annotations

Add a type after a colon on variables and parameters, and after the parameter list for return types:

```luau
--!strict
local playerName: string = "Koala"
local health: number = 100
local alive: boolean = true

local function heal(current: number, amount: number): number
	return math.min(current + amount, 100)
end

local function log(message: string): ()   -- '()' means "returns nothing"
	print(message)
end
```

### Inference

You don't need to annotate everything. Luau **infers** types from values:

```luau
--!strict
local count = 0        -- inferred: number
local name = "Koala"   -- inferred: string
count = "ten"          -- ❌ still caught — count is a number
```

A good habit: **annotate function parameters and return types** (the boundaries other code depends on), and let inference handle local variables.

## The built-in types

| Type | Meaning |
| --- | --- |
| `number`, `string`, `boolean` | The primitive types |
| `nil` | Only the value `nil` |
| `any` | Anything — and the checker stops checking it. An escape hatch |
| `unknown` | Anything — but you must check what it is before using it. The *safe* top type |
| `never` | No value at all — e.g. the return type of a function that always errors |
| `thread`, `buffer`, `vector` | Coroutines, byte buffers, native vectors |
| `{T}`, `{[K]: V}`, `{ field: T }` | Table types (below) |
| `(A) -> R` | Function types (below) |

On Roblox, every class and datatype is also a type: `Instance`, `Part`, `BasePart`, `Model`, `Player`, `Humanoid`, `Vector3`, `CFrame`, `Color3`, `RBXScriptConnection`, and so on.

:::tip Prefer `unknown` over `any`
`any` turns the checker off for that value — mistakes spread silently. `unknown` says "this could be anything, so prove what it is before using it". Use `unknown` for data you didn't create, like arguments arriving from a RemoteEvent.
:::

## Optional types and nil

`T?` means "a `T` or `nil`". In strict mode you must deal with the `nil` possibility before using the value:

```luau
--!strict
local function findPlayer(name: string): string?
	if name == "Koala" then
		return "Koala#1"
	end
	return nil
end

local result = findPlayer("Koala")
print(result:upper())   -- ❌ Value of type 'string?' could be nil

if result then
	print(result:upper())   -- ✅ inside this block, result is a string
end
```

That `if result then` is a **refinement**: the checker narrows the type inside the block.

## Union and intersection types

A **union** `A | B` is a value that's either an `A` or a `B`:

```luau
--!strict
local function describe(id: number | string): string
	if type(id) == "number" then
		return `numeric id {id}`     -- refined to number here
	else
		return `named id {id:upper()}` -- refined to string here
	end
end
```

`T?` is just shorthand for `T | nil`.

An **intersection** `A & B` is a value that's *both* — most often used to combine table types:

```luau
type Named = { name: string }
type Aged = { age: number }
type Person = Named & Aged   -- must have both fields
```

## Literal (singleton) types

String and boolean values can be types themselves. Combining them in a union gives you a precise set of allowed values:

```luau
--!strict
type Direction = "north" | "south" | "east" | "west"

local function move(dir: Direction)
	print("Moving " .. dir)
end

move("north")   -- ✅
move("up")      -- ❌ Type '"up"' could not be converted into 'Direction'
```

### Tagged unions

A powerful pattern is a union of table types that share a **tag** field. Checking the tag refines the whole table:

```luau
--!strict
type Shape =
	{ kind: "circle", radius: number }
	| { kind: "rect", width: number, height: number }

local function area(shape: Shape): number
	if shape.kind == "circle" then
		return math.pi * shape.radius ^ 2      -- shape is the circle variant here
	else
		return shape.width * shape.height      -- and the rect variant here
	end
end
```

This is the ideal way to model things like network messages, item kinds or game events.

## Table types

| Syntax | Describes | Example |
| --- | --- | --- |
| `{T}` | An array of `T` | `{string}` |
| `{[K]: V}` | A dictionary from `K` to `V` | `{[string]: number}` |
| `{ a: T, b: U }` | A record with named fields | `{ name: string, level: number }` |
| `{ a: T? }` | A record with an optional field | `{ nickname: string? }` |

```luau
--!strict
type Item = {
	id: string,
	name: string,
	price: number,
	tags: {string},
	discount: number?,       -- optional
}

local inventory: {Item} = {}
local stock: {[string]: number} = { sword = 3, potion = 10 }

table.insert(inventory, {
	id = "sword",
	name = "Classic Sword",
	price = 100,
	tags = {"melee"},
})
```

## Function types

Function types describe parameters and return values with an arrow:

```luau
--!strict
type Callback = (player: string, amount: number) -> ()
type Predicate = (number) -> boolean
type Divide = (number, number) -> (number, number)   -- returns two values
type Logger = (...string) -> ()                       -- variadic

local function applyToAll(list: {number}, check: Predicate): {number}
	local out = {}
	for _, n in list do
		if check(n) then
			table.insert(out, n)
		end
	end
	return out
end
```

Parameter names in function types (`player: string`) are optional documentation — only the types matter.

## Type aliases and exports

`type Name = ...` creates an alias you can reuse. In a ModuleScript, `export type` makes it available to scripts that `require` the module:

```luau
--!strict
-- Inside a ModuleScript named "Types"
export type PlayerData = {
	coins: number,
	level: number,
	inventory: {string},
}

return {}
```

```roblox
--!strict
local Types = require(script.Parent.Types)

local function newData(): Types.PlayerData
	return { coins = 0, level = 1, inventory = {} }
end
```

## Generics

Sometimes a function works with *any* type, but the types of its inputs and outputs are related. **Generics** express that relationship with type parameters in angle brackets:

```luau
--!strict
local function first<T>(list: {T}): T?
	return list[1]
end

local n = first({10, 20})        -- n: number?
local s = first({"a", "b"})      -- s: string?

local function map<T, U>(list: {T}, fn: (T) -> U): {U}
	local out = {}
	for i, v in list do
		out[i] = fn(v)
	end
	return out
end

local lengths = map({"hi", "there"}, function(s)
	return #s
end) -- lengths: {number}
```

Type aliases can be generic too:

```luau
type Pair<A, B> = { first: A, second: B }
type Result<T> = { ok: true, value: T } | { ok: false, error: string }
```

## typeof in types

`typeof(expression)` in a **type position** gives you the type of an expression. It's especially handy for complex values you don't want to spell out by hand:

```luau
local DEFAULT_CONFIG = {
	roundTime = 180,
	maxPlayers = 12,
	mapName = "Volcano",
}
type Config = typeof(DEFAULT_CONFIG)   -- { roundTime: number, maxPlayers: number, mapName: string }
```

## Type casts

The `::` operator **asserts** a type to the checker:

```luau
local value = someFunction() :: number
```

Casts are useful when you know more than the checker does — but they're also a way to lie to it. **A cast does nothing at runtime.** It doesn't convert values and doesn't check anything:

```luau
local n = ("10" :: any) :: number
print(type(n))   --> string  — the cast changed nothing at runtime!
```

Use casts sparingly, prefer refinements (`if typeof(x) == "number"`), and never use `:: any` just to silence an error you don't understand.

## Refinements

The checker narrows types inside conditions it understands:

```luau
--!strict
local function process(input: unknown)
	if type(input) == "string" then
		print(input:upper())            -- input: string
	elseif type(input) == "number" then
		print(input * 2)                -- input: number
	end
end
```

Refinements the checker understands include truthiness (`if x then`), equality with `nil`, `type(x) == "..."`, `typeof(x) == "..."`, tag fields in tagged unions, `assert(x)`, and — on Roblox — `instance:IsA("ClassName")`.

## Typing Roblox code

Most Roblox APIs are fully typed, so inference does a lot of work for you:

```roblox
--!strict
local Players = game:GetService("Players")       -- Players
local part = Instance.new("Part")                -- Part
part.Anchored = true
part.Size = Vector3.new(4, 1, 4)

local function onPlayerAdded(player: Player)
	print(player.UserId)                          -- number
end
Players.PlayerAdded:Connect(onPlayerAdded)
```

Things get trickier when you look up children by name, because the checker can't know what will exist at runtime:

```roblox
--!strict
local model = workspace:FindFirstChild("Door")   -- Instance?

-- Option 1: refine with IsA (safe — checked at runtime too)
if model and model:IsA("Model") then
	model:PivotTo(CFrame.new(0, 10, 0))           -- model: Model
end

-- Option 2: FindFirstChildOfClass / FindFirstChildWhichIsA return the right type
local humanoid = model and model:FindFirstChildOfClass("Humanoid")  -- Humanoid?

-- Option 3: cast when you're certain (e.g. you built the hierarchy yourself)
local button = script.Parent:WaitForChild("BuyButton") :: TextButton
```

:::note What does Studio already know?
Inside Studio, the type checker can often see Instances that exist in your place while editing — so `workspace.Baseplate` may be typed as a `Part`. Anything created at runtime (characters, cloned models, UI made in code) is unknown until you refine or cast it.
:::

## Typing classes

The common pattern for a typed class, which you saw a preview of in @oop:

```luau
--!strict
local Account = {}
Account.__index = Account

type AccountData = {
	owner: string,
	balance: number,
}

export type Account = typeof(setmetatable({} :: AccountData, Account))

function Account.new(owner: string): Account
	local self = setmetatable({} :: AccountData, Account)
	self.owner = owner
	self.balance = 0
	return self
end

function Account.deposit(self: Account, amount: number): ()
	self.balance += amount
end

function Account.getBalance(self: Account): number
	return self.balance
end

return Account
```

The key idea: `typeof(setmetatable({} :: AccountData, Account))` produces a type that has both the data fields **and** the methods found through the metatable. Methods are written with an explicit `self: Account` parameter so the checker knows what `self` is; you still call them with a colon (`account:deposit(10)`).

## The modern type solver

Roblox has been rolling out a **new type solver** with smarter inference and new features — for example `read`-only properties (`{ read name: string }`), built-in type functions like `keyof<T>` and `index<T, K>`, and user-defined **type functions** that compute types with Luau code. Everything in this module works with both solvers; when you're comfortable with the basics, the [official Luau docs](https://luau.org) cover the newest features.

## Reading type errors

| Error | Usually means |
| --- | --- |
| `Type 'X' could not be converted into 'Y'` | You passed or assigned the wrong kind of value. |
| `Value of type 'T?' could be nil` | Handle the `nil` case first (`if x then`). |
| `Key 'foo' not found in table 'Bar'` | A typo, or a field missing from your type definition. |
| `Unknown global 'foo'` | A typo, or you forgot `local` / `require`. |
| `Argument count mismatch` | You called a function with too many or too few arguments. |

:::quiz Types
? What happens at runtime when you write `local x = y :: number`?
- `y` is converted to a number
- An error is raised if `y` isn't a number
+ Nothing — casts only affect the type checker
- `x` becomes `nil` if `y` isn't a number
> Type annotations and casts are erased before your code runs.

? What does `string?` mean?
+ A string or `nil`
- A string that may contain a question mark
- An unknown string
- A string literal type
> `T?` is shorthand for `T | nil`.

? Which type is the *safe* way to say "this could be anything"?
- `any`
+ `unknown`
- `never`
- `nil`
> `unknown` forces you to refine before use; `any` disables checking.

? What does `{[string]: number}` describe?
- An array of strings
+ A dictionary with string keys and number values
- A record with a field named `string`
- A function from string to number
> `{[K]: V}` is a dictionary type.

? How do you make a type alias usable from scripts that require your module?
- `global type`
- `public type`
+ `export type`
- `return type`
> `export type Name = ...` exposes the type as `Module.Name` to requirers.

? What's the best way to narrow an `Instance?` to a `BasePart`?
- `:: BasePart`
+ `if inst and inst:IsA("BasePart") then`
- `tostring(inst) == "BasePart"`
- `inst.ClassName == BasePart`
> `IsA` checks at runtime *and* refines the type for the checker. A cast checks nothing.

? In `local function first<T>(list: {T}): T?`, what is `T`?
+ A type parameter — a placeholder filled in at each call
- A table named T
- The `thread` type
- A typo for `table`
> Generics let one function work with any element type while keeping inputs and outputs linked.
:::

:::predict Casts don't convert
```luau
local value = ("42" :: any) :: number
print(type(value), value + 1)
```
= string 43
> The cast only tells the checker to treat the value as a number. At runtime it's still the string `"42"`, and Luau's string-to-number coercion makes `value + 1` give 43.
:::

:::predict Tagged union at runtime
```luau
type Shape = { kind: "circle", r: number } | { kind: "square", side: number }

local function area(s: Shape): number
	if s.kind == "circle" then
		return 3 * s.r * s.r
	end
	return s.side * s.side
end

print(area({ kind = "circle", r = 2 }), area({ kind = "square", side = 3 }))
```
= 12 9
> Types don't affect execution — this runs exactly like untyped code. (We used `3` instead of `math.pi` to keep the numbers tidy.)
:::

## Challenges

:::challenge easy | Annotate it
Add `--!strict` and full type annotations (parameters and return types) to these functions. Introduce a type alias for the player record.

```luau
local function makePlayer(name, level)
	return { name = name, level = level, items = {} }
end

local function addItem(player, item)
	table.insert(player.items, item)
	return #player.items
end

local function describe(player)
	return player.name .. " (Lv " .. player.level .. ")"
end
```
@solution
```luau
--!strict
type Player = {
	name: string,
	level: number,
	items: {string},
}

local function makePlayer(name: string, level: number): Player
	return { name = name, level = level, items = {} }
end

local function addItem(player: Player, item: string): number
	table.insert(player.items, item)
	return #player.items
end

local function describe(player: Player): string
	return player.name .. " (Lv " .. player.level .. ")"
end
```
:::

:::challenge medium | Result type
Define a generic `Result<T>` tagged union: either `{ ok: true, value: T }` or `{ ok: false, error: string }`. Then write a strictly typed `parseAge(input: string): Result<number>` that fails for non-numbers, decimals and values outside 0–150, and a caller that prints either the age or the error.
@hint
`tonumber(input)` returns `number?`. Check it for `nil`, then use `math.floor(n) ~= n` to detect decimals.
@hint
Checking `result.ok` refines the union, so `result.value` is only accessible in the `ok == true` branch.
@solution
```luau
--!strict
type Result<T> = { ok: true, value: T } | { ok: false, error: string }

local function parseAge(input: string): Result<number>
	local n = tonumber(input)
	if n == nil then
		return { ok = false, error = `'{input}' is not a number` }
	end
	if math.floor(n) ~= n then
		return { ok = false, error = "age must be a whole number" }
	end
	if n < 0 or n > 150 then
		return { ok = false, error = "age out of range" }
	end
	return { ok = true, value = n }
end

for _, input in {"25", "abc", "12.5", "200"} do
	local result = parseAge(input)
	if result.ok then
		print("Age:", result.value)
	else
		print("Error:", result.error)
	end
end
```
:::

:::challenge medium | Typed generic helpers
Write fully typed generic versions of these helpers in strict mode:

- `filter<T>(list: {T}, predicate: (T) -> boolean): {T}`
- `find<T>(list: {T}, predicate: (T) -> boolean): T?`
- `groupBy<T>(list: {T}, keyOf: (T) -> string): {[string]: {T}}`

Test `groupBy` by grouping `{"apple", "avocado", "banana", "blueberry", "cherry"}` by first letter.
@solution
```luau
--!strict
local function filter<T>(list: {T}, predicate: (T) -> boolean): {T}
	local out = {}
	for _, v in list do
		if predicate(v) then
			table.insert(out, v)
		end
	end
	return out
end

local function find<T>(list: {T}, predicate: (T) -> boolean): T?
	for _, v in list do
		if predicate(v) then
			return v
		end
	end
	return nil
end

local function groupBy<T>(list: {T}, keyOf: (T) -> string): {[string]: {T}}
	local groups: {[string]: {T}} = {}
	for _, v in list do
		local key = keyOf(v)
		local bucket = groups[key]
		if not bucket then
			bucket = {}
			groups[key] = bucket
		end
		table.insert(bucket, v)
	end
	return groups
end

local fruits = {"apple", "avocado", "banana", "blueberry", "cherry"}
local byLetter = groupBy(fruits, function(s)
	return s:sub(1, 1)
end)
for letter, items in byLetter do
	print(letter, table.concat(items, ", "))
end
```
:::

:::challenge hard | Typed Inventory class
Write a strict, typed `Inventory` class with:

- `Inventory.new(capacity: number): Inventory`
- `:add(itemId: string, amount: number): boolean` — fails if it would exceed capacity (total item count)
- `:remove(itemId: string, amount: number): boolean` — fails if there aren't enough
- `:count(itemId: string): number`
- `:total(): number`

Export the `Inventory` type and follow the typed-class pattern from this module. Make sure the code has no type errors in strict mode.
@hint
Store counts in `items: {[string]: number}` inside your data type, and use `self.items[itemId] or 0` when reading.
@solution
```luau
--!strict
local Inventory = {}
Inventory.__index = Inventory

type InventoryData = {
	capacity: number,
	items: {[string]: number},
}

export type Inventory = typeof(setmetatable({} :: InventoryData, Inventory))

function Inventory.new(capacity: number): Inventory
	local self = setmetatable({} :: InventoryData, Inventory)
	self.capacity = capacity
	self.items = {}
	return self
end

function Inventory.total(self: Inventory): number
	local sum = 0
	for _, n in self.items do
		sum += n
	end
	return sum
end

function Inventory.count(self: Inventory, itemId: string): number
	return self.items[itemId] or 0
end

function Inventory.add(self: Inventory, itemId: string, amount: number): boolean
	if amount <= 0 or self:total() + amount > self.capacity then
		return false
	end
	self.items[itemId] = self:count(itemId) + amount
	return true
end

function Inventory.remove(self: Inventory, itemId: string, amount: number): boolean
	local have = self:count(itemId)
	if amount <= 0 or have < amount then
		return false
	end
	local left = have - amount
	self.items[itemId] = if left > 0 then left else nil
	return true
end

local inv = Inventory.new(10)
print(inv:add("arrow", 8), inv:add("potion", 5), inv:count("arrow")) --> true false 8
```
:::

:::recap
- Types are checked by tooling, never at runtime. `--!strict` gives the most protection.
- Annotate with `: Type`; return types go after the parameter list. Inference handles most locals.
- `T?` = `T | nil`; unions `A | B`; intersections `A & B`; literal types like `"north"`.
- Tables: `{T}`, `{[K]: V}`, `{ field: T }`. Functions: `(A, B) -> R`.
- `type` aliases, `export type` from modules, generics `<T>`, `typeof(expr)` in types.
- Refine with `if x then`, `type`/`typeof` checks, tag fields and `IsA`. Casts (`::`) do nothing at runtime.
- Prefer `unknown` to `any`, especially for data from players.
:::
