---
id: functions
title: Functions
part: 1
summary: Package logic into reusable functions — parameters, multiple returns, variadic arguments, callbacks, recursion and higher-order functions.
time: 40 min
level: Beginner
objectives:
- Define and call functions with parameters and return values
- Return and receive multiple values — and know when they get truncated
- Treat functions as values: store them, pass them, return them
- Accept any number of arguments with `...`
- Solve problems recursively without blowing the stack
- Write higher-order helpers like `map` and `filter`
---

A **function** is a named, reusable block of code. Functions let you write logic once and use it everywhere, give meaningful names to chunks of behavior, and break big problems into small ones. Every serious Luau program is built out of them.

## Defining and calling functions

```luau
local function greet()
	print("Welcome to the game!")
end

greet()   -- call it
greet()   -- call it again
```

Defining a function doesn't run it — it just creates it. The code inside runs each time you **call** the function with parentheses.

### Parameters and arguments

**Parameters** are the named inputs a function declares. **Arguments** are the actual values you pass in when calling it:

```luau
local function greetPlayer(name, level)   -- parameters
	print(`Welcome back, {name}! You're level {level}.`)
end

greetPlayer("Koala", 12)                  -- arguments
greetPlayer("Builderman", 99)
```

Luau is relaxed about argument counts:

- **Missing arguments** become `nil`: `greetPlayer("Koala")` sets `level` to `nil`.
- **Extra arguments** are silently ignored.

### Default values

There's no special syntax for default parameter values. Use the `or` idiom from @operators, or an explicit `nil` check when `false` is a valid value:

```luau
local function spawnEnemy(kind, count)
	kind = kind or "Zombie"
	count = count or 1
	print(`Spawning {count} {kind}(s)`)
end

spawnEnemy()              --> Spawning 1 Zombie(s)
spawnEnemy("Skeleton", 3) --> Spawning 3 Skeleton(s)
```

## Return values

`return` sends a value back to whoever called the function — and **exits the function immediately**:

```luau
local function add(a, b)
	return a + b
end

local total = add(5, 7)
print(total)              --> 12
print(add(add(1, 2), 3))  --> 6
```

A function without a `return` (or with a bare `return`) returns nothing, which becomes `nil` if you try to use it.

### Returning multiple values

Luau functions can return several values at once. This is used all over the standard library and Roblox API:

```luau
local function getBounds(numbers)
	local lo, hi = math.huge, -math.huge
	for _, n in numbers do
		lo = math.min(lo, n)
		hi = math.max(hi, n)
	end
	return lo, hi
end

local smallest, largest = getBounds({7, 2, 9, 4})
print(smallest, largest)   --> 2 9
```

### When multiple returns get truncated

Multiple return values have one rule that surprises everyone at least once:

:::info The "last in the list" rule
A call that returns multiple values only **expands to all of them** when it's the **last** item in a list of expressions (arguments, table constructor, multiple assignment, or a `return`). Anywhere else, it's cut down to its **first** value. Wrapping a call in parentheses also keeps only the first value.
:::

```luau
local function pair()
	return "a", "b"
end

print(pair())          --> a b      (last in list: expands)
print(pair(), "x")     --> a x      (not last: truncated to "a")
print("x", pair())     --> x a b    (last again: expands)
print((pair()))        --> a        (parentheses: first value only)

local t = {pair(), pair()}
print(#t)              --> 3        {"a", "a", "b"}
```

## Functions are values

In Luau, functions are **first-class values** — just like numbers or strings. You can store them in variables, put them in tables, pass them as arguments and return them from other functions.

```luau
-- An anonymous function stored in a variable
local double = function(x)
	return x * 2
end
print(double(21))   --> 42

-- Functions stored in a table
local actions = {
	jump = function() print("Jumping!") end,
	crouch = function() print("Crouching!") end,
}
actions.jump()      --> Jumping!
```

### Callbacks

Passing a function into another function so it can be called later is called a **callback**. Roblox is built on callbacks — every event connection, every `task.delay`, every sort comparator:

```luau
local function repeatAction(times, action)
	for i = 1, times do
		action(i)
	end
end

repeatAction(3, function(i)
	print("Doing it, time #" .. i)
end)
```

```roblox
-- Roblox: run a function after 2 seconds
task.delay(2, function()
	print("Two seconds later...")
end)

-- Roblox: run a function whenever something touches a part
workspace.Lava.Touched:Connect(function(otherPart)
	print(otherPart.Name .. " touched the lava")
end)
```

### `local function` vs. `local f = function`

These two lines look equivalent, but there's one difference that matters for **recursion** (a function calling itself):

```luau
local function a() end     -- 'a' is visible inside its own body
local b = function() end   -- 'b' is NOT visible inside its own body yet
```

`local function name()` is shorthand for declaring the local first and then assigning it, so the body can refer to `name`. With `local b = function() ... end`, the variable `b` doesn't exist until *after* the whole expression is evaluated. Prefer `local function` for named functions.

## Variadic functions

A function can accept **any number** of arguments using `...` (called *varargs*):

```luau
local function sum(...)
	local total = 0
	for _, n in {...} do
		total += n
	end
	return total
end

print(sum(1, 2, 3))         --> 6
print(sum(10, 20, 30, 40))  --> 100
print(sum())                --> 0
```

Useful tools for working with `...`:

| Expression | Meaning |
| --- | --- |
| `{...}` | Pack the arguments into a table |
| `select("#", ...)` | How many arguments were passed — **including** `nil`s |
| `select(n, ...)` | All arguments from position `n` onward |
| `table.pack(...)` | A table of the arguments plus an `n` field holding the count |
| `table.unpack(t)` | The reverse: turns an array back into separate values |

```luau
local function info(...)
	print("count:", select("#", ...), "second onward:", select(2, ...))
end
info("a", "b", "c") --> count: 3 second onward: b c

local args = {10, 20, 30}
print(math.max(table.unpack(args)))  --> 30
```

:::warning Holes in varargs
`#{...}` is unreliable if any argument is `nil`, because tables can't reliably measure arrays with holes. Use `select("#", ...)` or `table.pack(...).n` whenever `nil` is a possible argument.
:::

## Recursion

A **recursive** function calls itself, solving a big problem by breaking it into a smaller version of the same problem. Every recursive function needs:

1. A **base case** — a situation simple enough to answer directly.
2. A **recursive case** — which moves closer to the base case.

```luau
local function factorial(n)
	if n <= 1 then
		return 1                    -- base case
	end
	return n * factorial(n - 1)     -- recursive case
end

print(factorial(5)) --> 120   (5 * 4 * 3 * 2 * 1)
```

Recursion shines for **nested structures** — like walking every descendant in a Roblox model, or every folder inside a folder:

```luau
local function countLeaves(node)
	if type(node) ~= "table" then
		return 1
	end
	local total = 0
	for _, child in node do
		total += countLeaves(child)
	end
	return total
end

print(countLeaves({1, {2, 3}, {{4}, 5}})) --> 5
```

:::danger Stack overflow
Each call takes up space on the *call stack*. If a recursive function never reaches its base case — or recurses extremely deeply — you get a **stack overflow** error. Always make sure every path moves toward the base case.
:::

## Higher-order functions

A **higher-order function** takes a function as an argument or returns one. Three classics are worth knowing because the ideas appear everywhere:

```luau
-- map: transform every element
local function map(list, fn)
	local result = {}
	for i, v in list do
		result[i] = fn(v)
	end
	return result
end

-- filter: keep elements that pass a test
local function filter(list, predicate)
	local result = {}
	for _, v in list do
		if predicate(v) then
			table.insert(result, v)
		end
	end
	return result
end

-- reduce: combine all elements into one value
local function reduce(list, fn, initial)
	local acc = initial
	for _, v in list do
		acc = fn(acc, v)
	end
	return acc
end

local prices = {5, 12, 30, 8}
local withTax = map(prices, function(p) return p * 1.1 end)
local expensive = filter(prices, function(p) return p >= 10 end)
local total = reduce(prices, function(acc, p) return acc + p end, 0)
print(#withTax, #expensive, total) --> 4 2 55
```

## A preview of methods

You'll often see functions called with a colon, like `part:Destroy()` or `name:upper()`. The colon is just shorthand that passes the thing on the left as the first argument:

```luau
local account = { balance = 100 }

function account.deposit(self, amount)
	self.balance += amount
end

account.deposit(account, 50)  -- explicit
account:deposit(50)           -- same thing, using the colon
print(account.balance)        --> 200
```

This is the foundation of object-oriented programming in Luau, which you'll build properly in @oop.

## Writing good functions

- **Name functions with verbs** that describe what they do: `calculateDamage`, `spawnCoin`, `isAlive`. Functions returning booleans often start with `is`, `has` or `can`.
- **Do one thing.** If a function's name needs "and" in it, it probably wants to be two functions.
- **Prefer returning values over changing outside variables.** A function whose output depends only on its inputs (a *pure* function) is far easier to test and reuse.
- **Keep them short.** A function that doesn't fit on one screen is usually doing too much.
- **Annotate types** once you've learned @types: `local function add(a: number, b: number): number`.

:::quiz Functions
? What happens to an argument you don't pass?
- The script errors
+ The parameter is `nil`
- The parameter is `0`
- The previous value is reused
> Missing arguments become `nil`. That's why the `x = x or default` idiom works.

? What does `print((pair()))` print if `pair` returns `"a", "b"`?
+ `a`
- `a b`
- `b`
- `nil`
> Wrapping a call in parentheses truncates it to its first value.

? Which declaration lets a function call itself recursively by name?
+ `local function f() ... end`
- `local f = function() ... end`
- Both work identically
- Neither — Luau doesn't support recursion
> `local function f` declares `f` before the body is compiled, so the body can see it.

? What does `select("#", 1, nil, 3)` return?
- `2`
+ `3`
- `1`
- `nil`
> `select("#", ...)` counts every argument passed, including `nil`s.

? What are the two essential parts of a recursive function?
+ A base case and a recursive case that moves toward it
- A loop and a counter
- A callback and an event
- A table and a metatable
> Without a base case (or without progress toward it) recursion never stops and overflows the stack.

? `account:deposit(50)` is equivalent to…
- `account.deposit(50)`
+ `account.deposit(account, 50)`
- `deposit(account.50)`
- `account.deposit(self, 50)`
> The colon passes the object on the left as the first argument, conventionally named `self`.
:::

:::predict Multiple returns in a table
```luau
local function three()
	return 1, 2, 3
end
local t = {three(), three()}
print(#t, t[1], t[4])
```
= 4 1 3
> The first `three()` isn't last in the list, so it's truncated to `1`. The second is last, so it expands to `1, 2, 3`. The table is `{1, 1, 2, 3}`.
:::

:::predict Counting varargs
```luau
local function count(...)
	return select("#", ...)
end
print(count(1, nil, 3), count(), count(nil))
```
= 3 0 1
> `select("#", ...)` counts every passed argument — `nil`s included. Calling with no arguments gives 0.
:::

:::predict Recursion
```luau
local function f(n)
	if n == 0 then
		return ""
	end
	return f(n - 1) .. n
end
print(f(4))
```
= 1234
> `f(4)` is `f(3) .. 4`, which is `f(2) .. 3 .. 4`, and so on down to `f(0) = ""`. The digits are joined on the way back up.
:::

## Challenges

:::challenge easy | Shape calculator
Write two functions: `rectangleArea(width, height)` and `circleArea(radius)` (use `math.pi`). Then write `describe(shape, a, b)` that returns a sentence like `"A rectangle with area 12"` by calling the right function based on `shape`.
@solution
```luau
local function rectangleArea(width, height)
	return width * height
end

local function circleArea(radius)
	return math.pi * radius ^ 2
end

local function describe(shape, a, b)
	if shape == "rectangle" then
		return `A rectangle with area {rectangleArea(a, b)}`
	elseif shape == "circle" then
		return `A circle with area {string.format("%.2f", circleArea(a))}`
	end
	return "Unknown shape"
end

print(describe("rectangle", 3, 4)) --> A rectangle with area 12
print(describe("circle", 2))       --> A circle with area 12.57
```
:::

:::challenge medium | Stats in one call
Write a variadic function `stats(...)` that returns **three** values: the minimum, the maximum and the average of all numbers passed. Return `nil` if no numbers were passed.

```luau
local lo, hi, avg = stats(4, 8, 15, 16, 23, 42)
print(lo, hi, avg) --> 4 42 18
```
@hint
Count arguments with `select("#", ...)` and loop over `{...}`.
@solution
```luau
local function stats(...)
	local count = select("#", ...)
	if count == 0 then
		return nil
	end

	local lo, hi, sum = math.huge, -math.huge, 0
	for _, n in {...} do
		lo = math.min(lo, n)
		hi = math.max(hi, n)
		sum += n
	end
	return lo, hi, sum / count
end

print(stats(4, 8, 15, 16, 23, 42)) --> 4 42 18
```
:::

:::challenge medium | Build your own map and filter
Without looking at the lesson above, write `map(list, fn)` and `filter(list, predicate)`. Then use them together in a single expression to take `{1, 2, 3, 4, 5, 6}`, keep only the even numbers and square them, giving `{4, 16, 36}`.
@hint
`filter` first, then `map` the result: `map(filter(numbers, isEven), square)`.
@solution
```luau
local function map(list, fn)
	local out = {}
	for i, v in list do
		out[i] = fn(v)
	end
	return out
end

local function filter(list, predicate)
	local out = {}
	for _, v in list do
		if predicate(v) then
			table.insert(out, v)
		end
	end
	return out
end

local numbers = {1, 2, 3, 4, 5, 6}
local result = map(filter(numbers, function(n)
	return n % 2 == 0
end), function(n)
	return n * n
end)

print(table.concat(result, ", ")) --> 4, 16, 36
```
:::

:::challenge hard | Recursive power and digit sum
Write two recursive functions — no loops allowed:

1. `power(base, exp)` that computes `base ^ exp` for whole numbers `exp >= 0` using only multiplication.
2. `digitSum(n)` that adds up the digits of a non-negative whole number: `digitSum(4096)` is `19`.

Bonus: make `power` fast for big exponents using the fact that `b^(2k) = (b^k)^2`.
@hint
`power`: the base case is `exp == 0` → `1`. Otherwise `base * power(base, exp - 1)`.
@hint
`digitSum`: the last digit is `n % 10`, and the rest of the number is `n // 10`.
@solution
```luau
local function power(base, exp)
	if exp == 0 then
		return 1
	end
	-- Fast version: halve the exponent each time
	local half = power(base, exp // 2)
	if exp % 2 == 0 then
		return half * half
	end
	return half * half * base
end

local function digitSum(n)
	if n < 10 then
		return n
	end
	return n % 10 + digitSum(n // 10)
end

print(power(2, 10))    --> 1024
print(power(3, 5))     --> 243
print(digitSum(4096))  --> 19
```
The fast `power` makes about log₂(exp) calls instead of `exp` calls — that technique is called *exponentiation by squaring*.
:::

:::recap
- Define with `local function name(params) ... end`; call with `name(args)`.
- Missing arguments are `nil`; extras are ignored. Use `x = x or default` for defaults.
- `return` exits immediately and can return multiple values — which only expand when last in a list.
- Functions are values: store them, pass them as callbacks, return them.
- `...` accepts any number of arguments; count them with `select("#", ...)`.
- Recursion needs a base case and progress toward it.
- `obj:method(x)` is shorthand for `obj.method(obj, x)`.
:::
