---
id: variables
title: Variables & Data Types
part: 1
summary: Store values in variables, meet every data type in Luau, and learn the truthiness rules that trip up programmers coming from other languages.
time: 30 min
level: Beginner
objectives:
- Create, update and swap variables with `local`
- Name variables well and avoid reserved words
- Know every Luau data type and what it's for
- Understand `nil` and Luau's truthiness rules
- Check types with `type` and `typeof`, and convert between them
---

Programs are all about data: a player's coins, a door's position, whether a round has started. A **variable** is a name that refers to a piece of data so you can use it, change it and pass it around. In this module you'll learn how variables work and meet every kind of value Luau can hold.

## Creating variables

You create a variable with the `local` keyword, a name, an equals sign and a value:

```luau
local playerName = "Koala"
local coins = 250
local isAdmin = false

print(playerName, coins, isAdmin)
```

```output
Koala 250 false
```

Read `=` as **"becomes"**, not "equals". `local coins = 250` means *"create a variable named `coins`, and it becomes 250."* Testing whether two things are equal uses a different operator, `==`, which you'll meet in @operators.

### Changing a variable

Once a variable exists, you update it by assigning without `local`:

```luau
local coins = 250
coins = 300           -- replace the value
coins = coins + 50    -- use the old value to compute the new one
print(coins)          --> 350
```

The right-hand side is always evaluated **first**, using the current values, and only then stored into the variable. That's why `coins = coins + 50` works.

:::tip Compound assignment
Luau lets you shorten `coins = coins + 50` to `coins += 50`. It also supports `-=`, `*=`, `/=`, `//=`, `%=`, `^=` and `..=` (for joining strings). You'll see these everywhere in modern Roblox code.
:::

### Declaring without a value

If you create a variable without giving it a value, it holds `nil` — Luau's way of saying "nothing":

```luau
local target
print(target) --> nil

target = "Zombie"
print(target) --> Zombie
```

### Multiple assignment

You can declare or assign several variables at once. Values are matched up left to right:

```luau
local x, y, z = 10, 20, 30
print(x, y, z)       --> 10 20 30

local a, b = 1        -- not enough values: b gets nil
print(a, b)          --> 1 nil

local c = 1, 2, 3     -- too many values: the extras are thrown away
print(c)             --> 1
```

Because the whole right-hand side is evaluated before anything is stored, multiple assignment gives you a famous trick — **swapping two variables without a temporary**:

```luau
local left, right = "sword", "shield"
left, right = right, left
print(left, right) --> shield sword
```

## Naming variables

A variable name (an **identifier**) can contain letters, digits and underscores, but can't start with a digit. Names are case-sensitive, so `score`, `Score` and `SCORE` are three different variables.

```luau
local health = 100       -- ok
local maxHealth2 = 150   -- ok
local _private = true    -- ok
-- local 2ndPlace = "Bob"   -- invalid: starts with a digit
-- local max-health = 100   -- invalid: "-" is the minus operator
```

You also can't use Luau's **reserved keywords** as names:

```text
and       break     do        else      elseif    end
false     for       function  if        in        local
nil       not       or        repeat    return    then
true      until     while
```

Luau also has a few *contextual* keywords — `continue`, `type`, `export` and `typeof` — which are only special in certain positions. Avoid using them as variable names anyway; it keeps code clear.

### Naming conventions

Roblox code generally follows these conventions (they match the official Roblox Lua style guide):

| Kind of name | Convention | Example |
| --- | --- | --- |
| Local variables & functions | camelCase | `playerCount`, `getSpawnPoint` |
| Services, classes, modules | PascalCase | `Players`, `WeaponService` |
| Constants that never change | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `RESPAWN_TIME` |
| Unused variables | `_` or `_name` | `for _, part in parts do` |

More important than any convention: **be descriptive**. `local t = 30` tells the reader nothing; `local roundDurationSeconds = 30` tells them everything.

## Why always `local`?

If you assign to a name *without* ever declaring it with `local`, Luau creates a **global variable**:

```luau
score = 10   -- no 'local' — this creates a global!
```

Globals cause real problems:

- They're **slower** to read and write than locals.
- They can be accidentally overwritten from somewhere else in the same script.
- They make code harder to reason about because anything could change them at any time.
- In strict type-checking mode they're flagged as errors.

:::warning Rule of thumb
Always declare variables with `local`. If you see a variable assigned without `local` and it isn't declared above, that's almost certainly a bug or a typo.
:::

We'll go much deeper into *where* a local variable can be seen — its **scope** — in @scope-closures.

## The data types

Every value in Luau has a **type**. There are only a handful, and you'll use the first six all the time:

| Type | Example values | What it's for |
| --- | --- | --- |
| `nil` | `nil` | The absence of a value |
| `boolean` | `true`, `false` | Yes/no facts |
| `number` | `42`, `3.14`, `-7`, `1e6` | All numbers — integers and decimals |
| `string` | `"hello"`, `'hi'` | Text |
| `table` | `{1, 2, 3}`, `{name = "Bob"}` | Lists, dictionaries, objects — Luau's only data structure |
| `function` | `print`, `function() end` | Reusable code — functions are values too |
| `thread` | `coroutine.create(f)` | A coroutine (see @coroutines) |
| `buffer` | `buffer.create(16)` | A fixed-size block of raw bytes (see @stdlib) |
| `vector` | `vector.create(1, 2, 3)` | A native 3-component vector |
| `userdata` | `Vector3.new()`, `workspace` | Objects provided by the host — on Roblox, that's Instances and datatypes like `CFrame` |

Let's look at the core types in more detail.

### nil

`nil` means "no value". Variables you haven't assigned are `nil`, missing table keys are `nil`, and functions that don't return anything produce `nil`. Setting a variable to `nil` is how you say "this no longer refers to anything".

```luau
local currentTarget = nil
print(currentTarget == nil) --> true
```

### Booleans

A boolean is either `true` or `false`. They answer yes/no questions: *is the door open? has the round started? does the player own the game pass?*

```luau
local doorOpen = false
local roundActive = true
```

### Truthiness

Here's one of the most important rules in Luau, and one that surprises people coming from JavaScript or Python:

:::danger Only `false` and `nil` are falsy
In conditions, **`false` and `nil` are the only values treated as false.** Everything else is truthy — including `0`, the empty string `""` and empty tables `{}`.
:::

```luau
if 0 then print("0 is truthy") end
if "" then print("empty string is truthy") end
if {} then print("empty table is truthy") end
if nil then print("you will never see this") end
```

```output
0 is truthy
empty string is truthy
empty table is truthy
```

This is why checking whether something *exists* is so concise in Luau: `if humanoid then ... end` reads as "if we actually found a humanoid".

### Numbers

Luau has a single `number` type that covers integers and decimals. Under the hood every number is a 64-bit floating-point value (a "double"), which can represent every whole number exactly up to 2⁵³ (about 9 quadrillion) — far more than you'll need for coins or health.

```luau
local health = 100          -- integer
local speed = 16.5          -- decimal
local tiny = 0.001
local big = 1e6             -- scientific notation: 1,000,000
local mask = 0xFF           -- hexadecimal: 255
local flags = 0b1010        -- binary: 10
local readable = 1_000_000  -- underscores are ignored, they just aid reading
```

:::info Floating-point surprises
Because decimals are stored in binary, some values can't be represented exactly. The classic example is that `0.1 + 0.2` prints `0.30000000000000004`. This happens in almost every programming language. In practice: don't compare decimals with `==`; compare whether they're *close enough* (`math.abs(a - b) < 0.0001`).
:::

There are also two special number values you'll occasionally meet: `math.huge` (infinity) and **NaN** ("not a number"), produced by things like `0/0`. NaN is famously weird — it isn't even equal to itself — and it matters for security, as you'll see in @security.

### Strings

A string is a sequence of characters — text. You can use double or single quotes; they're equivalent:

```luau
local greeting = "Hello"
local name = 'Koala'
print(greeting, name) --> Hello Koala
```

Strings are so important they get their own module: @strings.

### Tables and functions

Tables and functions are big topics with their own modules (@tables and @functions). For now, just know that they're values like any other — you can store them in variables:

```luau
local inventory = {"Sword", "Shield", "Potion"}
local shout = print   -- a function stored in a new variable
shout("It works!")    --> It works!
```

## Checking a value's type

The built-in `type` function returns the name of a value's type as a string:

```luau
print(type(42))        --> number
print(type("hi"))      --> string
print(type(true))      --> boolean
print(type(nil))       --> nil
print(type({}))        --> table
print(type(print))     --> function
```

On Roblox you'll usually want **`typeof`** instead. It behaves like `type` for the core types, but it also knows the names of Roblox's own datatypes, which `type` just lumps together as `"userdata"`:

```roblox
print(type(Vector3.new(1, 2, 3)))    --> userdata
print(typeof(Vector3.new(1, 2, 3)))  --> Vector3
print(typeof(workspace))             --> Instance
print(typeof(CFrame.new()))          --> CFrame
```

:::pro Use typeof for validation
`typeof` is your best friend when checking data a player sent to the server: `if typeof(position) ~= "Vector3" then return end`. You'll lean on this heavily in @remotes and @security.
:::

## Converting between types

Luau converts types for you in a couple of places, but it's clearer (and safer) to convert explicitly.

**`tostring(value)`** turns any value into a string:

```luau
local level = 7
local message = "Level " .. tostring(level)
print(message) --> Level 7
```

**`tonumber(value)`** turns a string into a number — or returns `nil` if the string isn't a valid number. That `nil` is very useful for validating input:

```luau
print(tonumber("42"))     --> 42
print(tonumber("3.5"))    --> 3.5
print(tonumber("0x10"))   --> 16
print(tonumber("hello"))  --> nil
print(tonumber("101", 2)) --> 5   (read "101" as binary)
```

:::note Automatic coercion
Luau will convert a numeric string to a number in arithmetic (`"10" + 5` gives `15`) and a number to a string when joining with `..` (`10 .. ""` gives `"10"`). This works, but it hides intent and the type checker flags it in strict mode. Prefer explicit `tonumber` and `tostring`.
:::

## Dynamic typing (and a preview of types)

Luau is **dynamically typed**: a variable doesn't have a fixed type, the *value* does. The same variable can hold a number now and a string later:

```luau
local thing = 10
thing = "ten"     -- allowed
```

Allowed — but usually a bad idea, because other code expecting a number will break. Luau has an optional type checker that can catch mistakes like this before you run your code. You can add **type annotations** with a colon:

```luau
local coins: number = 100
local displayName: string = "Koala"
local alive: boolean = true
```

You'll learn the type system properly in @types. For now, it's enough to recognize the syntax when you see it.

:::quiz Variables & types
? What does `local a, b = 5` leave in `b`?
- `5`
- `0`
+ `nil`
- It's an error
> When there are fewer values than variables, the extra variables get `nil`.

? Which of these values is **falsy** in Luau?
- `0`
- `""`
- `{}`
+ `nil`
> Only `false` and `nil` are falsy. `0`, empty strings and empty tables are all truthy — unlike in many other languages.

? What does `typeof(Vector3.new())` return?
+ `"Vector3"`
- `"userdata"`
- `"table"`
- `"vector3"`
> `typeof` knows Roblox datatypes and returns their name. `type` would return `"userdata"`.

? Which variable name is **invalid**?
- `_count`
- `maxHealth2`
+ `2ndPlace`
- `MAX_SPEED`
> Identifiers can't start with a digit.

? What does `tonumber("abc")` return?
- `0`
+ `nil`
- `"abc"`
- It raises an error
> `tonumber` returns `nil` when the string isn't a valid number — perfect for validation.

? Why should you avoid global variables?
- They can't store tables
- They're only visible on the server
+ They're slower and can be accidentally changed from elsewhere
- They're automatically deleted after 60 seconds
> Globals are slower than locals, pollute the shared environment and make bugs harder to track down. Always use `local`.
:::

:::predict Swap
```luau
local a, b = 1, 2
a, b = b, a
print(a, b)
```
= 2 1
> The right-hand side `b, a` is evaluated first (giving `2, 1`), then both values are assigned. That's why swapping works without a temporary variable.
:::

:::predict Truthy or not?
```luau
local score = 0
if score then
	print("truthy")
else
	print("falsy")
end
```
= truthy
> `0` is truthy in Luau. Only `false` and `nil` are falsy. If you want to check for zero, write `if score == 0 then`.
:::

:::predict Types
```luau
print(type(10), type("10"), type(nil))
print(tonumber("12") + 1)
```
= number string nil
= 13
> `type` returns the type's name as a string. `tonumber("12")` gives the number `12`, plus `1` is `13`.
:::

## Challenges

:::challenge easy | Character sheet
Create variables for a game character: `characterName` (string), `level` (number), `health` (number), `maxHealth` (number) and `isAlive` (boolean). Then:

1. Print them all on one line.
2. The character takes 35 damage — update `health` using `-=`.
3. The character levels up — update `level` using `+=`.
4. Print the variables again.
@hint
Declare each variable with `local`. To update, don't use `local` again — just `health -= 35`.
@solution
```luau
local characterName = "Rook"
local level = 4
local health = 100
local maxHealth = 100
local isAlive = true

print(characterName, level, health, maxHealth, isAlive)

health -= 35
level += 1

print(characterName, level, health, maxHealth, isAlive)
```
:::

:::challenge easy | Type inspector
Store one value of each of these types in its own variable: number, string, boolean, nil, table, function. Then print `type()` of each variable, so the output is:

```output
number
string
boolean
nil
table
function
```
@hint
Any function works as a value — even `print` itself.
@solution
```luau
local n = 42
local s = "hello"
local b = true
local nothing = nil
local t = {}
local f = print

print(type(n))
print(type(s))
print(type(b))
print(type(nothing))
print(type(t))
print(type(f))
```
:::

:::challenge medium | Three-way rotate
You have three variables:

```luau
local first, second, third = "red", "green", "blue"
```

Rotate them so that `first` holds `"green"`, `second` holds `"blue"` and `third` holds `"red"` — in **a single assignment statement**, without any temporary variable. Then print them.
@hint
Multiple assignment evaluates every value on the right before assigning anything on the left.
@solution
```luau
local first, second, third = "red", "green", "blue"
first, second, third = second, third, first
print(first, second, third) --> green blue red
```
:::

:::challenge medium | Safe conversion
A player typed an amount into a text box, so you receive it as a string. Write code that converts `input` to a number and prints either `Valid amount: X` or `Invalid amount`. Test it with `"250"`, `"12.5"` and `"lots"`.
@hint
`tonumber` returns `nil` for invalid input — and `nil` is falsy.
@solution
```luau
local input = "250"

local amount = tonumber(input)
if amount then
	print("Valid amount: " .. tostring(amount))
else
	print("Invalid amount")
end
```
In a real game you'd also check that the amount is positive, whole and within a sensible range — never trust input. You'll build exactly that in @security.
:::

:::recap
- Create variables with `local name = value`; update them with `name = newValue` (or `+=`, `-=`, …).
- Multiple assignment evaluates the right side first, which makes swapping easy.
- Names: letters, digits, underscores, no leading digit, case-sensitive, no keywords. Be descriptive.
- Core types: `nil`, `boolean`, `number`, `string`, `table`, `function` — plus `thread`, `buffer`, `vector` and `userdata`.
- **Only `false` and `nil` are falsy.** `0` and `""` are truthy.
- Use `typeof` on Roblox; convert explicitly with `tostring` and `tonumber`.
:::
