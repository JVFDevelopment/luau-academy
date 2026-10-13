---
id: operators
title: Operators & Expressions
part: 1
summary: Arithmetic, comparison and logic — plus the `and`/`or` idioms, `if` expressions and operator precedence rules every Luau programmer relies on daily.
time: 30 min
level: Beginner
objectives:
- Do arithmetic with `+ - * / // % ^` and know how each behaves
- Compare values with `== ~= < > <= >=`
- Use `and`, `or` and `not` — including their short-circuit behavior
- Write concise defaults and guards with `or` / `and`
- Use `if` expressions instead of the fragile `a and b or c` pattern
- Predict how operator precedence groups an expression
---

An **expression** is any piece of code that produces a value: `5`, `coins`, `coins + 10`, `health > 0`. An **operator** combines values into a new value. This module covers every operator in Luau and the patterns built on top of them.

## Expressions vs. statements

It helps to know the difference between the two building blocks of code:

- A **statement** *does* something: `local x = 5`, `print(x)`, `x += 1`.
- An **expression** *is* something — it evaluates to a value: `5`, `x * 2`, `x > 3`.

Statements are made of expressions. In `local damage = baseDamage * 1.5`, the whole line is a statement, and `baseDamage * 1.5` is an expression that gets evaluated and stored.

## Arithmetic

| Operator | Meaning | Example | Result |
| --- | --- | --- | --- |
| `+` | Addition | `7 + 2` | `9` |
| `-` | Subtraction | `7 - 2` | `5` |
| `*` | Multiplication | `7 * 2` | `14` |
| `/` | Division | `7 / 2` | `3.5` |
| `//` | Floor division | `7 // 2` | `3` |
| `%` | Modulo (remainder) | `7 % 2` | `1` |
| `^` | Exponent (power) | `7 ^ 2` | `49` |
| `-` (unary) | Negation | `-7` | `-7` |

### Division and floor division

`/` always produces the exact result, decimals included. `//` divides and then rounds **down** (toward negative infinity) — handy whenever you need whole units:

```luau
print(10 / 4)    --> 2.5
print(10 // 4)   --> 2
print(-10 // 4)  --> -3   (rounds down, not toward zero!)
```

### Modulo

`%` gives the remainder after floor division. It's one of the most useful operators in game code:

```luau
print(10 % 3)   --> 1
print(12 % 4)   --> 0   -- divides evenly
print(-7 % 3)   --> 2   -- result takes the sign of the right-hand side
```

Common uses:

- **Even or odd:** `n % 2 == 0` is true for even numbers.
- **Every Nth time:** `if wave % 5 == 0 then spawnBoss() end` triggers on waves 5, 10, 15…
- **Wrapping around:** `index = index % #items + 1` cycles through a list forever.
- **Splitting units:** `seconds % 60` gives the leftover seconds after removing whole minutes.

### Exponents

`^` raises to a power. Fractional powers give roots: `9 ^ 0.5` is `3` (the square root), `8 ^ (1/3)` is `2` (the cube root).

```luau
print(2 ^ 10)     --> 1024
print(9 ^ 0.5)    --> 3
```

## Compound assignment

Updating a variable based on its current value is so common that Luau has shorthand for every arithmetic operator:

```luau
local score = 10
score += 5     -- score = score + 5   → 15
score -= 3     -- score = score - 3   → 12
score *= 2     -- score = score * 2   → 24
score /= 4     -- score = score / 4   → 6
score //= 4    -- score = score // 4  → 1
score %= 1     -- score = score % 1   → 0
score ^= 2     -- score = score ^ 2   → 0

local name = "Koa"
name ..= "la"  -- name = name .. "la" → "Koala"
```

:::info Not an expression
Compound assignments are *statements*, not expressions. You can't write `print(x += 1)`. Luau also has no `++` or `--` operators — `--` starts a comment!
:::

## Comparison

Comparison operators produce a boolean (`true` or `false`):

| Operator | Meaning | Example | Result |
| --- | --- | --- | --- |
| `==` | Equal to | `5 == 5` | `true` |
| `~=` | **Not** equal to | `5 ~= 3` | `true` |
| `<` | Less than | `3 < 5` | `true` |
| `>` | Greater than | `3 > 5` | `false` |
| `<=` | Less than or equal | `5 <= 5` | `true` |
| `>=` | Greater than or equal | `4 >= 5` | `false` |

:::warning It's `~=`, not `!=`
Coming from another language, you'll type `!=` at least once. In Luau "not equal" is written `~=`.
:::

A few rules worth knowing:

- **`==` never converts types.** `1 == "1"` is `false`. Values of different types are simply never equal.
- **Ordering different types is an error.** `5 < "10"` raises *attempt to compare number < string*.
- **Strings compare alphabetically** by character code, so uppercase letters come before lowercase, and digits compare as characters: `"apple" < "banana"` is `true`, `"Zebra" < "apple"` is `true`, and `"10" < "9"` is `true`.
- **Tables compare by identity.** Two different tables are never `==`, even with identical contents. You'll see why in @tables.

```luau
print(1 == "1")              --> false
print("abc" == "abc")        --> true
print({} == {})              --> false
print("Zebra" < "apple")     --> true
```

## Logical operators

Luau has three logical operators: `and`, `or` and `not`.

`not` flips truthiness and always returns a boolean:

```luau
print(not true)   --> false
print(not nil)    --> true
print(not 0)      --> false   (0 is truthy!)
```

`and` and `or` are more interesting. They **don't** necessarily return `true` or `false` — they return one of their operands:

- `a and b` → if `a` is falsy, returns `a`; otherwise returns `b`.
- `a or b` → if `a` is truthy, returns `a`; otherwise returns `b`.

```luau
print(nil or "default")   --> default
print("set" or "default") --> set
print(5 and 10)           --> 10
print(nil and 10)         --> nil
print(false or nil)       --> nil
```

### Short-circuiting

Because `and` and `or` decide based on the left side, they skip evaluating the right side when it isn't needed. This is called **short-circuit evaluation**:

```luau
local function expensive()
	print("expensive() ran")
	return true
end

local result = false and expensive()  -- expensive() never runs
print(result)                          --> false
```

Short-circuiting is what makes guard expressions safe, as you're about to see.

### Idiom: default values with `or`

```luau
local function greet(name)
	name = name or "Guest"
	print("Hello, " .. name)
end

greet("Koala") --> Hello, Koala
greet()        --> Hello, Guest
```

`name or "Guest"` means "use `name` if it has a value, otherwise `"Guest"`".

:::warning The `or` default trap
`x or default` replaces **both `nil` and `false`**. If `false` is a meaningful value (say, a setting the player turned off), `setting or true` will wrongly turn it back on. Use an explicit check instead: `if setting == nil then setting = true end`.
:::

### Idiom: guards with `and`

On Roblox, objects you look for might not exist. `and` lets you safely chain lookups:

```roblox
local character = player.Character
local humanoid = character and character:FindFirstChildOfClass("Humanoid")
-- If character is nil, the right side never runs, so no error.
```

## `if` expressions

Often you want to pick one of two values based on a condition. Luau has an **`if` expression** for exactly this:

```luau
local score = 72
local result = if score >= 50 then "Pass" else "Fail"
print(result) --> Pass
```

You can chain conditions with `elseif`:

```luau
local hp = 30
local status = if hp > 70 then "Healthy"
	elseif hp > 25 then "Hurt"
	else "Critical"
print(status) --> Hurt
```

Unlike an `if` *statement*, an `if` expression **must** have an `else` branch — it always has to produce a value.

### Why not `a and b or c`?

Older Lua code (and lots of Roblox tutorials) fakes a ternary operator with `condition and valueA or valueB`. It usually works — but it silently breaks when `valueA` is `false` or `nil`:

```luau
local isAdmin = true
local canFly = isAdmin and false or true   -- intended: false
print(canFly) --> true   (wrong!)

local fixed = if isAdmin then false else true
print(fixed)  --> false  (correct)
```

`isAdmin and false` evaluates to `false`, so the `or` moves on and returns `true`. **Prefer `if` expressions** in new code.

## Concatenation and length

The `..` operator joins two strings. Numbers are converted automatically:

```luau
local player = "Koala"
local coins = 120
print(player .. " has " .. coins .. " coins") --> Koala has 120 coins
```

:::tip Mind the spaces with numbers
`1..2` is a syntax error because Luau reads `1.` as the start of a decimal. Write `1 .. 2` with spaces. Better yet, use string interpolation — `` `{player} has {coins} coins` `` — which you'll learn in @strings.
:::

The `#` operator returns the **length** of a string or array:

```luau
print(#"Luau")              --> 4
print(#{"a", "b", "c"})     --> 3
```

## Operator precedence

When an expression mixes operators, Luau applies them in a fixed order, from highest to lowest priority:

| Priority | Operators | Notes |
| --- | --- | --- |
| 1 (highest) | `^` | Right-associative: `2 ^ 3 ^ 2` is `2 ^ (3 ^ 2)` |
| 2 | `not`  `#`  `-` (unary) | |
| 3 | `*`  `/`  `//`  `%` | |
| 4 | `+`  `-` | |
| 5 | `..` | Right-associative |
| 6 | `==`  `~=`  `<`  `>`  `<=`  `>=` | |
| 7 | `and` | |
| 8 (lowest) | `or` | |

So `2 + 3 * 4` is `14`, not `20`, and `a or b and c` means `a or (b and c)`. One famous gotcha: because `^` binds tighter than unary minus, `-2 ^ 2` is `-(2 ^ 2)`, which is `-4`.

:::pro When in doubt, add parentheses
Parentheses always win, and they make intent obvious to the next reader: `(base + bonus) * multiplier`. Nobody has ever been confused by too many clarifying parentheses.
:::

## A taste of the math library

Operators cover the basics; the `math` library covers the rest. Here are the functions you'll use constantly (the full tour is in @stdlib):

```luau
print(math.floor(3.7))         --> 3     round down
print(math.ceil(3.2))          --> 4     round up
print(math.round(2.5))         --> 3     round to nearest (halves away from zero)
print(math.abs(-12))           --> 12    absolute value
print(math.max(4, 9, 2))       --> 9     largest
print(math.min(4, 9, 2))       --> 2     smallest
print(math.clamp(150, 0, 100)) --> 100   keep within a range
print(math.sqrt(16))           --> 4     square root
print(math.random(1, 6))       --> a random whole number from 1 to 6
```

`math.clamp` in particular is everywhere in game code — health can't go below 0 or above max, volume stays between 0 and 1, and so on.

:::quiz Operators
? What does `7 // 2` evaluate to?
- `3.5`
+ `3`
- `4`
- `1`
> `//` is floor division: divide, then round down.

? What does `nil or "Guest"` evaluate to?
+ `"Guest"`
- `nil`
- `true`
- `false`
> `or` returns its left operand if truthy, otherwise its right operand.

? Which operator means "not equal" in Luau?
- `!=`
- `<>`
+ `~=`
- `=/=`
> Luau uses `~=` for inequality.

? What does `-2 ^ 2` evaluate to?
- `4`
+ `-4`
- `0`
- It's an error
> `^` has higher precedence than unary minus, so it's `-(2 ^ 2)`.

? Why is `isAdmin and false or true` buggy?
- `and` can't be used with booleans
- It always errors
+ When the middle value is `false`, the `or` falls through to the last value
- Luau evaluates it right to left
> `isAdmin and false` is `false`, so `false or true` returns `true`. Use `if isAdmin then false else true` instead.

? What does `1 == "1"` evaluate to?
- `true`
+ `false`
- `nil`
- It raises an error
> `==` never converts types; a number and a string are never equal.

? What does `-7 % 3` evaluate to?
- `-1`
+ `2`
- `1`
- `-2`
> Luau's `%` result takes the sign of the divisor. `-7 % 3` is `-7 - floor(-7/3) * 3`, which is `-7 - (-3 * 3)` = `2`.
:::

:::predict Precedence
```luau
print(2 + 3 * 4)
print((2 + 3) * 4)
print(10 - 4 - 3)
print(2 ^ 3 ^ 2)
```
= 14
= 20
= 3
= 512
> Multiplication binds tighter than addition. Subtraction is left-associative: `(10 - 4) - 3`. Exponentiation is right-associative: `2 ^ (3 ^ 2)` = `2 ^ 9` = `512`.
:::

:::predict and / or
```luau
print(nil or false)
print(false or nil)
print(1 and 2)
print(nil and 1)
print(0 or 5)
```
= false
= nil
= 2
= nil
= 0
> `or` returns the first truthy operand, or the last operand if none are truthy. `and` returns the first falsy operand, or the last one if all are truthy. And remember: `0` is truthy.
:::

:::predict Floor division and modulo
```luau
local total = 135
print(total // 60, total % 60)
```
= 2 15
> 135 seconds is 2 whole minutes (`135 // 60`) and 15 leftover seconds (`135 % 60`).
:::

## Challenges

:::challenge easy | Temperature converter
Write code that converts a temperature from Celsius to Fahrenheit using `F = C × 9/5 + 32`, then prints a line like `25°C is 77°F`. Test with `0`, `25`, `100` and `-40`.
@hint
Store the Celsius value in a variable, compute Fahrenheit with `*`, `/` and `+`, then join the pieces with `..`.
@solution
```luau
local celsius = 25
local fahrenheit = celsius * 9 / 5 + 32
print(celsius .. "°C is " .. fahrenheit .. "°F")
```
At `-40` both scales give the same number — a nice way to check your formula.
:::

:::challenge easy | Even or odd
Given a number `n`, print `"n is even"` or `"n is odd"` using an `if` **expression** to choose the word.
@hint
`n % 2 == 0` is true for even numbers.
@solution
```luau
local n = 17
local kind = if n % 2 == 0 then "even" else "odd"
print(n .. " is " .. kind)
```
:::

:::challenge medium | Round timer display
A round has `secondsLeft` remaining. Print it in `M:SS` format — for example, `125` should print `2:05` and `59` should print `0:59`.
@hint
Minutes are `secondsLeft // 60`; seconds are `secondsLeft % 60`.
@hint
If the seconds are less than 10, you need to add a leading `"0"`. An `if` expression is perfect for that.
@solution
```luau
local secondsLeft = 125

local minutes = secondsLeft // 60
local seconds = secondsLeft % 60
local padded = if seconds < 10 then "0" .. seconds else tostring(seconds)

print(minutes .. ":" .. padded) --> 2:05
```
In @strings you'll learn `string.format("%d:%02d", minutes, seconds)`, which does the padding for you.
:::

:::challenge medium | Critical hits
Write a damage calculation. Given `baseDamage`, `isCritical` (boolean) and `armor` (a number from 0 to 1 representing the fraction of damage blocked):

- Critical hits deal **2×** damage.
- Armor then reduces the damage: `damage * (1 - armor)`.
- The final damage must be a **whole number** (round down) and **never less than 1**.

Print the final damage for `baseDamage = 25, isCritical = true, armor = 0.3`.
@hint
Use an `if` expression for the critical multiplier, `math.floor` to round down and `math.max` to enforce the minimum.
@solution
```luau
local baseDamage = 25
local isCritical = true
local armor = 0.3

local multiplier = if isCritical then 2 else 1
local raw = baseDamage * multiplier * (1 - armor)
local damage = math.max(1, math.floor(raw))

print(damage) --> 35
```
:::

:::recap
- Arithmetic: `+ - * /`, floor division `//`, modulo `%`, power `^`. `/` always keeps decimals.
- Compound assignment (`+=`, `..=`, …) is a statement; there's no `++`.
- Compare with `== ~= < > <= >=`. `==` never converts types; tables compare by identity.
- `and`/`or` return operands and short-circuit. Use `x or default` for defaults (beware `false`) and `a and a.b` for guards.
- Prefer `if cond then a else b` expressions over `cond and a or b`.
- Precedence: `^` › unary › `* / // %` › `+ -` › `..` › comparisons › `and` › `or`. Use parentheses for clarity.
:::
