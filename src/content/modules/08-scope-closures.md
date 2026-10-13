---
id: scope-closures
title: Scope & Closures
part: 1
summary: Where variables live and how long they last — block scope, shadowing, upvalues, and closures that remember state. The key to private data, factories, memoization and cooldowns.
time: 35 min
level: Intermediate
objectives:
- Predict exactly where a local variable is visible
- Recognize and avoid accidental shadowing
- Explain upvalues and closures in your own words
- Use closures for private state, factories, memoization and cooldowns
- Declare mutually recursive functions with forward declarations
- Understand why `_G` and `shared` are best avoided
---

You've been using `local` everywhere. This module explains precisely **where** a local variable can be seen and **how long** it lives — and introduces closures, one of the most powerful ideas in Luau. Closures are how Roblox event handlers remember which player they belong to, how cooldowns work, and how modules keep data private.

## Block scope

A local variable is visible from the line **after** it's declared until the **end of the block** that contains it. Blocks are created by `do ... end`, `if ... end`, loops, function bodies, and the script file itself.

```luau
local outer = "I'm visible to the whole script"

if true then
	local inner = "I only exist inside this if-block"
	print(outer)   --> works
	print(inner)   --> works
end

print(outer)       --> works
print(inner)       --> nil — 'inner' doesn't exist out here
```

The last line doesn't error: `inner` isn't a local at that point, so Luau looks for a **global** named `inner`, finds nothing, and gives `nil`. (Studio's Script Analysis and strict mode will warn you about this "unknown global".)

Function parameters and loop variables are locals of their function or loop:

```luau
local function heal(amount)
	local healed = math.min(amount, 50)
	return healed
end
-- 'amount' and 'healed' don't exist here

for i = 1, 3 do
	-- 'i' exists only in here
end
```

:::tip Declare variables in the smallest scope that works
If a variable is only used inside a loop, declare it inside the loop. Narrow scopes make code easier to read and leave fewer places for bugs to hide.
:::

## Shadowing

If you declare a local with the **same name** as one in an outer scope, the inner one **shadows** (hides) the outer one until its block ends:

```luau
local message = "outer"

do
	local message = "inner"
	print(message)   --> inner
end

print(message)       --> outer
```

Shadowing is legal but usually a mistake. A classic bug:

```luau
local total = 0
for _, n in {1, 2, 3} do
	local total = total + n   -- oops: creates a NEW local each loop
end
print(total)                  --> 0
```

The fix is to drop the `local` inside the loop: `total = total + n` (or `total += n`). Studio's linter flags shadowing for this reason.

## Lifetime: locals outlive their scope

Here's where things get interesting. Look at this function:

```luau
local function makeCounter()
	local count = 0
	return function()
		count += 1
		return count
	end
end
```

`count` is a local of `makeCounter`. When `makeCounter` returns, you'd expect `count` to disappear. But the inner function still refers to it — so Luau **keeps it alive** for as long as the inner function exists:

```luau
local counter = makeCounter()
print(counter())  --> 1
print(counter())  --> 2
print(counter())  --> 3
```

The inner function has *captured* `count`. A local variable captured by an inner function is called an **upvalue**, and a function together with its captured upvalues is called a **closure**.

## Each call makes a fresh closure

Every time `makeCounter` runs, it creates a **new** `count` variable and a **new** inner function that captures it. Closures made by different calls don't share state:

```luau
local a = makeCounter()
local b = makeCounter()

print(a())  --> 1
print(a())  --> 2
print(b())  --> 1   (b has its own count)
```

But closures created in the **same** call **do** share the same upvalue:

```luau
local function makeBox(initial)
	local value = initial
	local function get()
		return value
	end
	local function set(newValue)
		value = newValue
	end
	return get, set
end

local get, set = makeBox(10)
set(42)
print(get())  --> 42
```

`get` and `set` both refer to the very same `value` variable — not copies of it.

:::info Closures capture variables, not values
A closure doesn't snapshot the value at the moment it's created — it holds onto the **variable itself**. If something changes the variable later, the closure sees the new value.
:::

## Closures in loops

Each iteration of a `for` loop gets a **fresh** loop variable, so closures created inside a loop capture each iteration's value separately:

```luau
local callbacks = {}
for i = 1, 3 do
	callbacks[i] = function()
		print("I am callback " .. i)
	end
end

callbacks[1]()  --> I am callback 1
callbacks[3]()  --> I am callback 3
```

This is exactly what you want when, say, connecting an event handler for each button in a list — each handler remembers its own button.

## Why closures matter on Roblox

You'll write closures constantly, often without thinking about it. Every time an event handler uses a variable from the surrounding code, that's a closure:

```roblox
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
	local joinTime = os.time()

	player.CharacterAdded:Connect(function(character)
		-- This inner function captured 'player' and 'joinTime'
		print(`{player.Name} spawned, {os.time() - joinTime}s after joining`)
	end)
end)
```

Each player gets their own `player` and `joinTime` variables, and their own handler that remembers them. No global bookkeeping needed.

## Practical closure patterns

### Private state

Variables captured by a closure can't be reached from outside — they're truly private. Only the functions you hand out can touch them:

```luau
local function makeWallet(startingCoins)
	local coins = startingCoins   -- private: no one can set this directly

	local wallet = {}

	function wallet.balance()
		return coins
	end

	function wallet.spend(amount)
		if amount <= 0 or amount > coins then
			return false
		end
		coins -= amount
		return true
	end

	return wallet
end

local w = makeWallet(100)
print(w.spend(30), w.balance())  --> true 70
print(w.spend(500), w.balance()) --> false 70
print(w.coins)                   --> nil — the real value is hidden
```

### Function factories

A factory returns functions configured by its arguments:

```luau
local function makeMultiplier(factor)
	return function(x)
		return x * factor
	end
end

local double = makeMultiplier(2)
local triple = makeMultiplier(3)
print(double(10), triple(10))  --> 20 30
```

### Memoization

**Memoization** caches a function's results so repeated calls with the same input are instant. The cache lives in an upvalue:

```luau
local function memoize(fn)
	local cache = {}
	return function(n)
		local cached = cache[n]
		if cached ~= nil then
			return cached
		end
		local result = fn(n)
		cache[n] = result
		return result
	end
end

local slowSquare = function(n)
	print("computing " .. n)
	return n * n
end

local fastSquare = memoize(slowSquare)
print(fastSquare(9))  --> computing 9, then 81
print(fastSquare(9))  --> 81 (no "computing" — it came from the cache)
```

### Cooldowns

Cooldowns (also called *debounces*) are everywhere in games: abilities, buttons, touch pads. A closure keeps track of when the action was last used:

```luau
local function makeCooldown(seconds)
	local lastUsed = -math.huge
	return function()
		local now = os.clock()
		if now - lastUsed < seconds then
			return false   -- still cooling down
		end
		lastUsed = now
		return true
	end
end

local canDash = makeCooldown(2)
print(canDash())  --> true
print(canDash())  --> false (called again immediately)
```

:::warning Cooldowns for multiplayer need a key
A single upvalue is one shared cooldown. In a multiplayer game you usually want one cooldown **per player** — store last-used times in a table keyed by player instead. And remember: cooldowns that matter for fairness must live on the **server** (@security).
:::

## Forward declarations

Sometimes two local functions need to call each other (*mutual recursion*). The second one doesn't exist yet when the first is defined. The fix is to declare both names first, then assign:

```luau
local isEven, isOdd

function isEven(n)
	if n == 0 then return true end
	return isOdd(n - 1)
end

function isOdd(n)
	if n == 0 then return false end
	return isEven(n - 1)
end

print(isEven(10), isOdd(7))  --> true true
```

Because `isEven` and `isOdd` were already declared as locals, `function isEven(n)` assigns to that local rather than creating a global.

## Globals, `_G` and `shared`

Variables you never declare with `local` are **globals**, stored in the script's environment. Roblox also provides `_G` and `shared`, tables visible to every script running on the same side (server or client).

You'll find old tutorials that use them to share data between scripts. Avoid that:

- There's no clear owner, so any script can change anything at any time.
- Load order isn't guaranteed — one script may read a value before another has set it.
- The type checker can't help you.

The modern, reliable way to share code and data between scripts is a **ModuleScript** (@modules).

:::quiz Scope & closures
? Where is a local variable visible?
+ From the line after its declaration to the end of its enclosing block
- Everywhere in the script
- Only on the line where it's declared
- Everywhere in the game
> Locals are block-scoped. Outside their block, the name refers to a global (usually `nil`).

? What is an upvalue?
- A variable stored in `_G`
+ A local variable from an enclosing function that an inner function uses
- A number larger than `math.huge`
- The return value of a function
> When an inner function refers to a local of an outer function, that local becomes an upvalue of the inner function.

? `local a, b = makeCounter(), makeCounter()` — do `a` and `b` share a count?
- Yes, they're the same function
+ No — each call to `makeCounter` creates a fresh `count` variable
- Only if called in the same frame
- Only on the server
> Each call creates new locals and a new closure capturing them.

? A closure captures…
- A snapshot of each variable's value at creation time
+ The variables themselves, so later changes are visible
- Only global variables
- Only numbers and strings
> Closures hold references to the captured variables, not copies of their values.

? What's the problem with `local total = total + n` inside a loop?
- It's a syntax error
+ It declares a new local each iteration, shadowing the outer `total`
- It makes `total` global
- Nothing — it's correct
> The outer `total` never changes. Remove `local` to update the outer variable.

? How should two scripts share data in modern Roblox code?
- Through `_G`
- Through `shared`
+ Through a ModuleScript
- By writing globals
> ModuleScripts give data a clear owner and a guaranteed load order.
:::

:::predict Shadowing
```luau
local x = 1
do
	local x = x + 1
	print(x)
end
print(x)
```
= 2
= 1
> Inside the block, a new `x` is created. Its initial value uses the *outer* `x` (1), because the new local doesn't exist until after its declaration. Outside the block the outer `x` is unchanged.
:::

:::predict Independent counters
```luau
local function make()
	local n = 0
	return function()
		n += 1
		return n
	end
end

local a, b = make(), make()
a()
a()
print(a(), b())
```
= 3 1
> `a` and `b` each have their own `n`. `a` has been called twice before the print, so the third call returns 3. `b` is called for the first time.
:::

:::predict Loop closures
```luau
local fns = {}
for i = 1, 3 do
	fns[i] = function()
		return i * 10
	end
end
print(fns[1](), fns[2](), fns[3]())
```
= 10 20 30
> Each loop iteration has a fresh `i`, so each closure captured a different variable.
:::

## Challenges

:::challenge easy | Greeting factory
Write `makeGreeter(greeting)` that returns a function taking a `name` and returning `"<greeting>, <name>!"`.

```luau
local hello = makeGreeter("Hello")
local yo = makeGreeter("Yo")
print(hello("Koala"))  --> Hello, Koala!
print(yo("Builderman")) --> Yo, Builderman!
```
@solution
```luau
local function makeGreeter(greeting)
	return function(name)
		return `{greeting}, {name}!`
	end
end
```
:::

:::challenge medium | Counter with controls
Extend the counter idea: write `makeCounter(start, step)` that returns a **table** with three functions — `increment()`, `reset()` and `get()`. `step` defaults to 1 and `start` defaults to 0. The current count must be private.
@hint
Keep `count` as a local inside `makeCounter`, and create the three functions inside it so they all capture the same variable.
@solution
```luau
local function makeCounter(start, step)
	start = start or 0
	step = step or 1
	local count = start

	return {
		increment = function()
			count += step
			return count
		end,
		reset = function()
			count = start
		end,
		get = function()
			return count
		end,
	}
end

local c = makeCounter(10, 5)
c.increment()
c.increment()
print(c.get())  --> 20
c.reset()
print(c.get())  --> 10
```
:::

:::challenge medium | once()
Write `once(fn)` that returns a new function which calls `fn` the **first** time it's called (passing along any arguments and returning its results), and does nothing on every later call.

```luau
local init = once(function(name)
	print("Initializing for " .. name)
	return true
end)

print(init("Koala"))      --> Initializing for Koala, then true
print(init("Builderman")) --> nil (nothing else printed)
```
@hint
Capture a boolean `called` flag in the closure. Use `...` to forward arguments.
@solution
```luau
local function once(fn)
	local called = false
	return function(...)
		if called then
			return nil
		end
		called = true
		return fn(...)
	end
end
```
:::

:::challenge hard | Memoized Fibonacci
The naive recursive Fibonacci function is famously slow because it recomputes the same values over and over:

```luau
local function fib(n)
	if n <= 2 then return 1 end
	return fib(n - 1) + fib(n - 2)
end
```

Write a memoized version that can compute `fib(70)` instantly. The recursive calls themselves must use the cache, not just the top-level call.
@hint
Keep a `cache` table in an upvalue. Before computing `fib(n)`, check `cache[n]`.
@hint
To make the *recursive* calls hit the cache, the function must call itself (the memoized version) — so define it with `local function fib` and put the cache check inside it.
@solution
```luau
local cache = {}

local function fib(n)
	if n <= 2 then
		return 1
	end
	local cached = cache[n]
	if cached then
		return cached
	end
	local result = fib(n - 1) + fib(n - 2)
	cache[n] = result
	return result
end

print(fib(70)) --> 190392490709135
```
Without memoization `fib(70)` would take hundreds of trillions of calls. With it, each value from 3 to 70 is computed exactly once.
:::

:::recap
- Locals are visible from just after their declaration to the end of their block.
- Shadowing (an inner local with the same name) hides the outer variable — usually a bug.
- An inner function that uses an outer local captures it as an **upvalue**; the pair is a **closure**.
- Captured variables live as long as the closure; closures capture *variables*, not values.
- Each call to a factory creates fresh state; closures from the same call share it.
- Use closures for private state, factories, memoization, `once` and cooldowns.
- Forward-declare locals for mutual recursion. Share code between scripts with ModuleScripts, not `_G`.
:::
