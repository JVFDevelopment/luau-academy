---
id: metatables
title: Metatables & Metamethods
part: 2
summary: Give tables superpowers — default values, inheritance, custom operators, read-only proxies, callable tables, custom iteration and weak caches.
time: 45 min
level: Intermediate
objectives:
- Attach and inspect metatables with `setmetatable` and `getmetatable`
- Use `__index` for defaults and lookup chains
- Intercept writes with `__newindex` and bypass with `rawget`/`rawset`
- Overload operators, `tostring`, calls and `#` for your own types
- Customize generalized iteration with `__iter`
- Build weak caches with `__mode` and lock metatables with `__metatable`
---

Normally a table does exactly one thing: store keys and values. A **metatable** lets you change what a table does in special situations — when you read a missing key, write a new one, add two tables together, call a table like a function, print it, or loop over it. Metatables are the foundation of object-oriented programming in Luau (@oop), and they power many of the libraries you'll use.

## Attaching a metatable

A metatable is just an ordinary table. You attach it to another table with `setmetatable`, which returns the table for convenience:

```luau
local data = {}
local meta = {}
setmetatable(data, meta)

print(getmetatable(data) == meta) --> true
```

The keys of a metatable that start with two underscores — `__index`, `__add`, `__tostring` and so on — are called **metamethods**. Each one handles a specific situation. A metatable with no metamethods does nothing at all.

:::info Strings have a metatable too
Every string shares a metatable whose `__index` is the `string` library. That's why `("hi"):upper()` works: looking up `upper` on a string falls back to `string.upper`.
:::

## __index: fallback lookups

`__index` runs when you read a key that **doesn't exist** in the table. If `__index` is a **table**, Luau looks the key up there instead:

```luau
local defaults = { walkSpeed = 16, jumpPower = 50, maxHealth = 100 }
local settings = setmetatable({ walkSpeed = 24 }, { __index = defaults })

print(settings.walkSpeed)  --> 24   (found in settings itself)
print(settings.jumpPower)  --> 50   (missing → found in defaults)
print(settings.fly)        --> nil  (missing in both)
```

Notice that `settings` never actually gets a `jumpPower` key — reads just *fall through*. Writes always go to the table itself, so changing `settings.jumpPower = 70` doesn't touch `defaults`.

### Lookup chains

If the `__index` table *itself* has a metatable with an `__index`, Luau keeps following the chain. This is exactly how inheritance works:

```luau
local base = { greet = "hello" }
local middle = setmetatable({ farewell = "bye" }, { __index = base })
local top = setmetatable({}, { __index = middle })

print(top.farewell, top.greet)  --> bye hello
```

### __index as a function

If `__index` is a **function**, it's called with the table and the missing key, and whatever it returns is the result. This lets you compute values on demand:

```luau
local squares = setmetatable({}, {
	__index = function(t, n)
		local value = n * n
		rawset(t, n, value)   -- cache it so __index isn't needed next time
		return value
	end,
})

print(squares[12])  --> 144
```

:::tip Table vs. function __index
A table `__index` is faster and is what classes use. Reach for a function when you need logic — computed values, error messages for typos, or lazy loading.
:::

## __newindex: intercepting writes

`__newindex` runs when you **assign** to a key that **doesn't already exist** in the table. Assigning to an existing key never triggers it.

```luau
local stats = setmetatable({}, {
	__newindex = function(t, key, value)
		if type(value) ~= "number" then
			error(`stat '{key}' must be a number, got {typeof(value)}`, 2)
		end
		rawset(t, key, value)
	end,
})

stats.strength = 10      -- ok
-- stats.agility = "high"  --> error: stat 'agility' must be a number, got string
```

Inside `__newindex`, a normal `t[key] = value` would trigger `__newindex` again — forever. That's why we use `rawset`.

### Raw access

These functions skip metamethods entirely:

| Function | Bypasses |
| --- | --- |
| `rawget(t, k)` | `__index` |
| `rawset(t, k, v)` | `__newindex` |
| `rawequal(a, b)` | `__eq` |
| `rawlen(t)` | `__len` |

## Proxies

Because `__index` and `__newindex` only fire for *missing* keys, the trick for intercepting **every** read and write is a **proxy**: an empty table that stays empty, forwarding everything to a hidden storage table.

```luau
local function readOnly(source)
	return setmetatable({}, {
		__index = source,
		__newindex = function(_, key)
			error(`attempt to modify read-only key '{tostring(key)}'`, 2)
		end,
	})
end

local CONFIG = readOnly({ ROUND_TIME = 180 })
print(CONFIG.ROUND_TIME)  --> 180
-- CONFIG.ROUND_TIME = 5   --> error
```

For the specific job of making a table read-only, modern Luau gives you `table.freeze`, which is simpler and faster. Proxies are still the right tool when you want to *observe* changes — for example, to update UI whenever a value changes (see the challenges).

## Operator metamethods

You can teach tables how to respond to operators. Each metamethod receives both operands:

| Metamethod | Operator | Metamethod | Operator |
| --- | --- | --- | --- |
| `__add` | `a + b` | `__unm` | `-a` |
| `__sub` | `a - b` | `__concat` | `a .. b` |
| `__mul` | `a * b` | `__len` | `#a` |
| `__div` | `a / b` | `__eq` | `a == b` |
| `__idiv` | `a // b` | `__lt` | `a < b` |
| `__mod` | `a % b` | `__le` | `a <= b` |
| `__pow` | `a ^ b` | `__call` | `a(...)` |
| `__tostring` | `tostring(a)` | `__iter` | `for k, v in a` |

Here's a small 2D vector type using several of them:

```luau
local Vec2 = {}
Vec2.__index = Vec2

local function new(x, y)
	return setmetatable({ x = x, y = y }, Vec2)
end

Vec2.__add = function(a, b)
	return new(a.x + b.x, a.y + b.y)
end

Vec2.__mul = function(a, b)
	-- support both vec * number and number * vec
	if type(a) == "number" then
		return new(b.x * a, b.y * a)
	end
	return new(a.x * b, a.y * b)
end

Vec2.__eq = function(a, b)
	return a.x == b.x and a.y == b.y
end

Vec2.__tostring = function(v)
	return `({v.x}, {v.y})`
end

local a = new(1, 2)
local b = new(3, 4)
print(a + b)            --> (4, 6)
print(a * 3, 2 * b)     --> (3, 6) (6, 8)
print(a == new(1, 2))   --> true
```

Some details worth knowing:

- For binary operators, Luau checks the **left** operand's metatable first, then the right's. That's why `2 * b` still works: `2` has no `__mul`, so `b`'s is used — with the number as the first argument.
- `__eq` is only consulted when both operands are tables (or both userdata) and aren't already the same object.
- Define `__lt` and `__le` separately if you need both `<` and `<=`.
- `print` calls `tostring`, which uses `__tostring` — very handy for debugging your own types.

:::note You've already used these
Roblox datatypes like `Vector3`, `CFrame` and `Color3` are userdata with exactly these kinds of metamethods. `Vector3.new(1, 0, 0) + Vector3.new(0, 1, 0)` works because `Vector3` defines `__add`.
:::

## __call: callable tables

`__call` lets you call a table like a function. The table itself is passed as the first argument:

```luau
local Greeter = setmetatable({ greeting = "Hello" }, {
	__call = function(self, name)
		return `{self.greeting}, {name}!`
	end,
})

print(Greeter("Koala"))  --> Hello, Koala!
```

This is sometimes used so a class can be constructed by calling it directly — `Enemy("Zombie")` instead of `Enemy.new("Zombie")`.

## __len and __iter

`__len` customizes the `#` operator, and `__iter` customizes **generalized iteration** (`for k, v in t do`). `__iter` should return the same things `pairs` would: an iterator function, a state value and an initial key.

```luau
local Inventory = {}
Inventory.__index = Inventory

function Inventory.new()
	return setmetatable({ _items = {} }, Inventory)
end

function Inventory:add(name, count)
	self._items[name] = (self._items[name] or 0) + count
end

Inventory.__len = function(self)
	local n = 0
	for _ in self._items do
		n += 1
	end
	return n
end

Inventory.__iter = function(self)
	return next, self._items   -- iterate the hidden items table
end

local inv = Inventory.new()
inv:add("Potion", 3)
inv:add("Arrow", 20)
print(#inv)  --> 2
for name, count in inv do
	print(name, count)
end
```

Users of `Inventory` never need to know about `_items` — it behaves like a collection.

## __mode: weak tables

Normally, being stored in a table keeps a value alive — the garbage collector won't clean it up. A **weak table** holds its keys and/or values *weakly*, so they can be collected when nothing else refers to them:

| `__mode` | Weak part | Typical use |
| --- | --- | --- |
| `"k"` | Keys | Attach extra data to objects without keeping them alive |
| `"v"` | Values | Caches that may be dropped when memory is needed |
| `"kv"` | Both | Rarely needed |

```luau
local cache = setmetatable({}, { __mode = "v" })
-- Entries in 'cache' can disappear once no one else references the value
```

Weak tables are an advanced tool. On Roblox, prefer explicit cleanup (removing entries when a player leaves, for example) — it's predictable, and you'll learn the patterns in @patterns.

## __metatable: locking

Setting the `__metatable` field hides and protects a metatable. `getmetatable` returns that field's value instead of the real metatable, and `setmetatable` raises an error:

```luau
local secret = setmetatable({}, { __metatable = "locked" })
print(getmetatable(secret))       --> locked
-- setmetatable(secret, {})        --> error: cannot change a protected metatable
```

## What Luau doesn't support

If you read Lua 5.2+ material, note that Luau does **not** support `__gc` (finalizers), `__close`, or `__pairs`/`__ipairs` — use `__iter` instead.

:::quiz Metatables
? When does `__index` run?
- On every read
+ When reading a key that doesn't exist in the table
- When writing any key
- Only when the table is printed
> `__index` is a fallback for missing keys. Existing keys are returned directly.

? When does `__newindex` run?
- On every write
+ When assigning to a key that doesn't already exist
- When reading a missing key
- When calling the table
> Assigning to an existing key writes directly. That's why proxies keep the proxy table empty.

? Inside a `__newindex` function, why use `rawset(t, k, v)` instead of `t[k] = v`?
+ `t[k] = v` would trigger `__newindex` again, recursing forever
- `rawset` is required to store numbers
- `t[k] = v` is a syntax error inside metamethods
- `rawset` makes the value read-only
> `rawset` writes without invoking metamethods.

? How does `2 * vec` work if only `vec`'s metatable defines `__mul`?
- It doesn't — it errors
+ Luau falls back to the right operand's `__mul`, passing `2` as the first argument
- Luau swaps the operands automatically
- Numbers have a built-in `__mul`
> Binary metamethods are looked up on the left operand first, then the right. Your function must handle the number being either argument.

? Which metamethod customizes `for k, v in t do`?
- `__pairs`
- `__next`
+ `__iter`
- `__index`
> Luau uses `__iter` for generalized iteration. `__pairs` from Lua 5.2 isn't supported.

? What does `getmetatable(t)` return if the metatable has `__metatable = "locked"`?
- The real metatable
- `nil`
+ The string `"locked"`
- It raises an error
> `__metatable` hides the real metatable from `getmetatable` and blocks `setmetatable`.
:::

:::predict Fallback reads
```luau
local defaults = { speed = 16, jump = 50 }
local settings = setmetatable({ speed = 24 }, { __index = defaults })
print(settings.speed, settings.jump, rawget(settings, "jump"))
```
= 24 50 nil
> `speed` exists in `settings`. `jump` falls through to `defaults`. `rawget` skips `__index`, so it sees that `settings` has no `jump` key of its own.
:::

:::predict __newindex only fires for new keys
```luau
local log = {}
local t = setmetatable({}, {
	__newindex = function(tbl, k, v)
		table.insert(log, k)
		rawset(tbl, k, v)
	end,
})
t.a = 1
t.a = 2
t.b = 3
print(#log, t.a)
```
= 2 2
> The first `t.a = 1` creates `a` (logged). The second assignment updates an existing key, so `__newindex` doesn't run. `t.b = 3` is logged. Two log entries; `t.a` is 2.
:::

:::predict Custom operators
```luau
local V = {}
V.__add = function(a, b)
	return setmetatable({ x = a.x + b.x }, V)
end
V.__tostring = function(v)
	return "V(" .. v.x .. ")"
end
local r = setmetatable({ x = 1 }, V) + setmetatable({ x = 2 }, V)
print(r)
```
= V(3)
> `+` triggers `__add`, which returns a new table with the same metatable. `print` calls `tostring`, which uses `__tostring`.
:::

## Challenges

:::challenge easy | Settings with defaults
Create a `DEFAULTS` table with `volume = 0.5`, `music = true` and `fov = 70`. Write `loadSettings(saved)` that returns a table whose missing values fall back to `DEFAULTS` using a metatable — without copying the defaults in.

```luau
local s = loadSettings({ fov = 90 })
print(s.volume, s.music, s.fov)  --> 0.5 true 90
```
@solution
```luau
local DEFAULTS = { volume = 0.5, music = true, fov = 70 }

local function loadSettings(saved)
	return setmetatable(saved, { __index = DEFAULTS })
end

local s = loadSettings({ fov = 90 })
print(s.volume, s.music, s.fov)
```
One shared metatable would be even better: create `local SETTINGS_META = { __index = DEFAULTS }` once and reuse it for every call.
:::

:::challenge medium | Strict table
Typos like `config.RoundTime` instead of `config.ROUND_TIME` silently return `nil`. Write `strict(t)` that returns `t` with a metatable that **errors** when you read a key that doesn't exist, naming the key in the message.
@hint
`__index` as a *function* runs for missing keys — have it call `error`.
@solution
```luau
local function strict(t)
	return setmetatable(t, {
		__index = function(_, key)
			error(`'{tostring(key)}' is not a valid key`, 2)
		end,
	})
end

local config = strict({ ROUND_TIME = 180 })
print(config.ROUND_TIME)  --> 180
-- print(config.RoundTime) --> error: 'RoundTime' is not a valid key
```
Passing `2` as the error level makes the error point at the line that did the bad read, not at the metamethod.
:::

:::challenge medium | Money type
Create a `Money` type that stores an amount in **cents** (whole numbers) to avoid floating-point issues. Support:

- `Money.new(dollars)` — e.g. `Money.new(2.5)` stores `250` cents.
- `+` and `-` between two Money values.
- `==` and `<` comparisons.
- `tostring` giving `"$2.50"`.
@hint
`math.round(dollars * 100)` converts to cents. `string.format("$%.2f", cents / 100)` formats.
@solution
```luau
local Money = {}
Money.__index = Money

function Money.fromCents(cents)
	return setmetatable({ cents = cents }, Money)
end

function Money.new(dollars)
	return Money.fromCents(math.round(dollars * 100))
end

Money.__add = function(a, b) return Money.fromCents(a.cents + b.cents) end
Money.__sub = function(a, b) return Money.fromCents(a.cents - b.cents) end
Money.__eq = function(a, b) return a.cents == b.cents end
Money.__lt = function(a, b) return a.cents < b.cents end
Money.__tostring = function(m) return string.format("$%.2f", m.cents / 100) end

local total = Money.new(0.1) + Money.new(0.2)
print(total)                     --> $0.30
print(total == Money.new(0.3))   --> true  (unlike 0.1 + 0.2 == 0.3 with plain numbers!)
print(Money.new(1) < Money.new(2)) --> true
```
:::

:::challenge hard | Observable table
Write `observable(initial, onChange)` that returns a proxy table. Reading and writing keys works like a normal table, but **every** write that changes a value — including writes to existing keys — calls `onChange(key, oldValue, newValue)`. Writes that don't change the value shouldn't call it. Iterating the proxy with `for k, v in proxy do` should visit the real data.
@hint
Keep the real data in a separate `store` table. The proxy itself must stay empty so `__newindex` fires for every write.
@hint
`__iter` can return `next, store` to iterate the hidden data.
@solution
```luau
local function observable(initial, onChange)
	local store = table.clone(initial)

	return setmetatable({}, {
		__index = store,
		__newindex = function(_, key, value)
			local old = store[key]
			if old == value then
				return
			end
			store[key] = value
			onChange(key, old, value)
		end,
		__iter = function()
			return next, store
		end,
	})
end

local stats = observable({ coins = 0 }, function(key, old, new)
	print(`{key}: {old} -> {new}`)
end)

stats.coins = 10     --> coins: 0 -> 10
stats.coins = 10     --> (nothing — unchanged)
stats.gems = 1       --> gems: nil -> 1
for k, v in stats do print(k, v) end
```
This is the core idea behind reactive UI libraries: when data changes, interested code is notified automatically.
:::

:::recap
- `setmetatable(t, mt)` attaches a metatable; keys like `__index` are metamethods.
- `__index` handles missing reads (table = fallback/inheritance, function = computed). `__newindex` handles writes to missing keys.
- `rawget`/`rawset`/`rawequal`/`rawlen` bypass metamethods.
- Proxies (an always-empty table) intercept *every* access.
- Operators (`__add`, `__eq`, `__lt`…), `__tostring`, `__call`, `__len` and `__iter` let your tables behave like built-in types.
- `__mode` makes weak tables; `__metatable` locks a metatable. No `__gc`, `__close` or `__pairs` in Luau.
:::
