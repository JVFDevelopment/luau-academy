---
id: control-flow
title: Control Flow
part: 1
summary: Make decisions with `if`, repeat work with `while`, `repeat` and `for`, and steer loops with `break` and `continue`.
time: 35 min
level: Beginner
objectives:
- Branch with `if`, `elseif` and `else` — and order conditions correctly
- Write guard clauses that keep code flat and readable
- Loop with `while`, `repeat ... until`, numeric `for` and generic `for`
- Control loops with `break` and `continue`
- Avoid infinite loops — and know why Roblox scripts must yield
---

So far your code has run straight from top to bottom. **Control flow** lets a program make decisions and repeat work. With just a handful of keywords you can express almost any logic a game needs.

## if statements

An `if` statement runs a block of code only when a condition is truthy:

```luau
local health = 0

if health <= 0 then
	print("Game over")
end
```

Every `if` needs a `then` after the condition and an `end` to close the block. Indent the body — Luau doesn't need it, but humans do.

### else and elseif

```luau
local score = 82

if score >= 90 then
	print("Grade: A")
elseif score >= 80 then
	print("Grade: B")
elseif score >= 70 then
	print("Grade: C")
else
	print("Keep practicing!")
end
```

Luau checks each condition **in order** and runs the **first** branch whose condition is truthy. Everything else is skipped — even if later conditions would also be true. That's why the order matters:

```luau
-- Bug: the first branch catches everything >= 70, so "A" is unreachable
if score >= 70 then
	print("C")
elseif score >= 90 then
	print("A")
end
```

:::warning elseif is one word
`else if` (two words) opens a *new nested* `if` that needs its own `end`. You almost always mean `elseif`.
:::

### Combining conditions

Use `and`, `or` and `not` (from @operators) to build richer conditions:

```luau
local hasKey = true
local doorLocked = true
local isAdmin = false

if (hasKey and doorLocked) or isAdmin then
	print("Door opens")
end

if not doorLocked then
	print("Already open")
end
```

### Guard clauses

Deeply nested `if` statements are hard to read. A **guard clause** checks for the "bail out" cases first and exits early, keeping the main logic flat:

:::compare
```luau title="❌ Nested"
local function buyItem(player, item)
	if player then
		if item then
			if player.coins >= item.price then
				player.coins -= item.price
				print("Bought " .. item.name)
			end
		end
	end
end
```
```luau title="✅ Guard clauses"
local function buyItem(player, item)
	if not player or not item then
		return
	end
	if player.coins < item.price then
		return
	end

	player.coins -= item.price
	print("Bought " .. item.name)
end
```
:::

`return` exits the function immediately. You'll learn functions properly in the next module, but this pattern is so useful it's worth seeing now.

## while loops

A `while` loop repeats its body **as long as** the condition stays truthy. The condition is checked before every pass, including the first:

```luau
local countdown = 3
while countdown > 0 do
	print(countdown)
	countdown -= 1
end
print("Go!")
```

```output
3
2
1
Go!
```

If the condition is falsy from the start, the body never runs at all.

### Infinite loops

If the condition never becomes falsy, the loop runs forever:

```luau
while true do
	-- runs forever unless something inside breaks out
end
```

:::danger Infinite loops on Roblox must yield
Luau runs one piece of code at a time. A loop that never pauses hogs the whole thread: nothing else can run, and Roblox eventually kills the script with *"Script timeout: exhausted allowed execution time"*. Any long-running loop on Roblox must **yield** — pause — each iteration, usually with `task.wait()`:

```roblox
while true do
	task.wait(1)          -- pause for about one second
	print("tick")
end
```

You'll learn exactly how yielding works in @coroutines. Many loops like this can be replaced with **events**, which is usually better — see @events.
:::

## repeat ... until

`repeat` is like `while`, but the condition is checked **after** each pass, so the body always runs **at least once**. It stops when the condition becomes **truthy**:

```luau
local attempts = 0
repeat
	attempts += 1
	local roll = math.random(1, 6)
	print("Rolled " .. roll)
until roll == 6

print("Got a six after " .. attempts .. " attempts")
```

Notice that `roll` — declared *inside* the loop body — is visible in the `until` condition. That's a special rule for `repeat` loops and it's exactly what makes the pattern above work.

## Numeric for loops

When you know how many times to loop, use a **numeric `for`**:

```luau
for i = 1, 5 do
	print("Wave " .. i)
end
```

The loop variable `i` starts at the first value and goes up to — and **including** — the second. An optional third value sets the **step**:

```luau
for i = 0, 100, 25 do
	print(i)       --> 0, 25, 50, 75, 100
end

for i = 10, 1, -1 do
	print(i)       --> counts down from 10 to 1
end

for i = 0, 1, 0.25 do
	print(i)       --> 0, 0.25, 0.5, 0.75, 1
end
```

Some rules worth knowing:

- The start, end and step are evaluated **once**, before the loop begins. Changing the variables they came from inside the loop has no effect.
- The loop variable is **local to the loop**. It doesn't exist after `end`.
- Don't assign to the loop variable inside the body — it won't change how many times the loop runs, and it confuses readers.
- If the start is already past the end (like `for i = 1, 0 do`), the body never runs.

## Generic for loops

A **generic `for`** walks through the items of a collection. You'll use this constantly with tables:

```luau
local fruits = {"apple", "banana", "cherry"}

for index, fruit in fruits do
	print(index, fruit)
end
```

```output
1 apple
2 banana
3 cherry
```

You'll also see older code use `ipairs(fruits)` or `pairs(fruits)` in the loop header. The full story — including what order things come out in — is in @tables. For now, just know that `for key, value in someTable do` visits every entry.

## break and continue

`break` exits the innermost loop immediately:

```luau
local numbers = {4, 8, 15, 16, 23, 42}

for _, n in numbers do
	if n > 20 then
		print("First number over 20: " .. n)
		break
	end
end
```

`continue` (a Luau addition) skips the rest of the current iteration and moves on to the next one:

```luau
for i = 1, 10 do
	if i % 2 == 0 then
		continue    -- skip even numbers
	end
	print(i)        --> 1, 3, 5, 7, 9
end
```

:::note Nested loops
`break` and `continue` only affect the **innermost** loop. To stop an outer loop from inside an inner one, set a flag variable and check it — or move the loops into a function and use `return`.
:::

## do ... end blocks

You can create a block anywhere with `do ... end`. Variables declared inside disappear at `end`. It's occasionally useful to keep temporary variables from leaking into the rest of a script:

```luau
do
	local temp = 42
	print(temp)   --> 42
end
-- temp doesn't exist here
```

## Common loop patterns

Most loops you'll ever write follow one of a few shapes. Recognizing them makes code much easier to write.

```luau
local scores = {12, 45, 7, 33, 90, 21}

-- Accumulate: total of all values
local total = 0
for _, s in scores do
	total += s
end
print("Total:", total)            --> Total: 208

-- Count: how many match a condition
local passing = 0
for _, s in scores do
	if s >= 30 then
		passing += 1
	end
end
print("Passing:", passing)        --> Passing: 3

-- Find the best: track the maximum seen so far
local best = -math.huge
for _, s in scores do
	if s > best then
		best = s
	end
end
print("Best:", best)              --> Best: 90

-- Search: stop as soon as you find what you need
local foundAt = nil
for i, s in scores do
	if s == 33 then
		foundAt = i
		break
	end
end
print("33 is at index", foundAt)  --> 33 is at index 4
```

:::quiz Control flow
? How many times does `for i = 1, 5, 2 do ... end` run?
- 2
+ 3
- 5
- 10
> `i` takes the values 1, 3 and 5. The end value is inclusive.

? What's special about `repeat ... until`?
+ The body always runs at least once
- It can't use `break`
- It only works with numbers
- It runs in reverse
> The condition is checked after the body, so the body runs before the first check.

? In an `if/elseif` chain, two conditions are both true. What happens?
- Both branches run
+ Only the first true branch runs
- Only the last true branch runs
- It's an error
> Luau stops at the first truthy condition and skips everything else in the chain.

? What does `continue` do?
- Exits the loop entirely
- Restarts the loop from the first iteration
+ Skips to the next iteration
- Pauses the loop for one frame
> `continue` skips the rest of the current iteration. `break` exits the loop.

? Why must a `while true do` loop on Roblox call something like `task.wait()`?
- Otherwise the loop variable overflows
+ Otherwise it never yields, freezes the thread and gets killed by a timeout
- Because `while` loops only run once per second
- To save the game automatically
> A loop that never yields monopolizes Luau. Roblox stops it with "Script timeout: exhausted allowed execution time".

? What's wrong with `else if` (two words) in place of `elseif`?
- Nothing, they're identical
+ It starts a new nested `if` that needs its own `end`
- It's a syntax error in all cases
- It only checks the condition once
> `else if` is legal but nests a whole new `if` statement inside the `else`, which needs an extra `end`.
:::

:::predict Counting down by threes
```luau
for i = 10, 1, -3 do
	print(i)
end
```
= 10
= 7
= 4
= 1
> Starting at 10 and stepping by -3: 10, 7, 4, 1. The next value, -2, is below the end value of 1, so the loop stops.
:::

:::predict break and continue
```luau
for i = 1, 6 do
	if i == 2 then continue end
	if i == 5 then break end
	print(i)
end
```
= 1
= 3
= 4
> When `i` is 2 the print is skipped. When `i` reaches 5 the loop exits before printing, so 5 and 6 never appear.
:::

:::predict repeat-until
```luau
local n = 1
repeat
	n *= 3
until n > 20
print(n)
```
= 27
> `n` goes 3, 9, 27. After it becomes 27 the condition `n > 20` is true and the loop stops.
:::

## Challenges

:::challenge easy | FizzBuzz
The classic interview warm-up. Print the numbers from 1 to 30, but:

- for multiples of 3 print `Fizz` instead,
- for multiples of 5 print `Buzz`,
- for multiples of both print `FizzBuzz`.
@hint
Use `%` to test divisibility: `i % 3 == 0`.
@hint
Check for "multiple of both" **first** — otherwise the `Fizz` branch will catch 15 before you get there.
@solution
```luau
for i = 1, 30 do
	if i % 15 == 0 then
		print("FizzBuzz")
	elseif i % 3 == 0 then
		print("Fizz")
	elseif i % 5 == 0 then
		print("Buzz")
	else
		print(i)
	end
end
```
:::

:::challenge easy | Times table
Print the 7 times table from `7 x 1 = 7` up to `7 x 12 = 84`, then modify your code so the table number is stored in a variable and works for any number.
@solution
```luau
local base = 7
for i = 1, 12 do
	print(`{base} x {i} = {base * i}`)
end
```
:::

:::challenge medium | Prime finder
Print every prime number between 2 and 100. A prime number is only divisible by 1 and itself.
@hint
For each candidate `n`, try dividing it by every number from 2 up to `n - 1`. If any divides evenly, it isn't prime.
@hint
You only need to check divisors up to `math.sqrt(n)`. Use a boolean flag and `break` as soon as you find a divisor.
@solution
```luau
for n = 2, 100 do
	local isPrime = true
	for d = 2, math.floor(math.sqrt(n)) do
		if n % d == 0 then
			isPrime = false
			break
		end
	end
	if isPrime then
		print(n)
	end
end
```
The `break` only exits the inner loop, which is exactly what we want here.
:::

:::challenge medium | Dice until doubles
Simulate rolling two six-sided dice repeatedly until you roll doubles (both dice show the same number). Print each roll like `Rolled 3 and 5`, then print how many rolls it took. Use a `repeat ... until` loop.
@hint
Declare both dice values inside the loop body — `repeat` lets the `until` condition see them.
@solution
```luau
local rolls = 0
repeat
	rolls += 1
	local a = math.random(1, 6)
	local b = math.random(1, 6)
	print(`Rolled {a} and {b}`)
until a == b

print(`Doubles after {rolls} rolls!`)
```
:::

:::challenge hard | Round system
Simulate a round-based game in plain Luau. There are 5 rounds. Each round:

1. Print `Round X starting`.
2. Count down from 3 to 1, printing each number.
3. Pick a random "winner" from a list of players.
4. Every 2nd round is a **bonus round** worth double points; print that it's a bonus round.

Track each player's points in variables or a table, and after all rounds print the winner with the most points. Don't worry about ties.
@hint
A numeric `for` over rounds, with an inner numeric `for` for the countdown.
@hint
To pick a random player: `players[math.random(1, #players)]`. Store points in a table keyed by name: `points[name] = (points[name] or 0) + amount`.
@solution
```luau
local players = {"Koala", "Builderman", "Noob"}
local points = {}

for round = 1, 5 do
	print(`Round {round} starting`)
	for count = 3, 1, -1 do
		print(count)
	end

	local isBonus = round % 2 == 0
	local amount = if isBonus then 20 else 10
	if isBonus then
		print("BONUS ROUND — double points!")
	end

	local winner = players[math.random(1, #players)]
	points[winner] = (points[winner] or 0) + amount
	print(`{winner} wins round {round} (+{amount})`)
end

local bestName, bestScore = nil, -1
for name, score in points do
	if score > bestScore then
		bestName, bestScore = name, score
	end
end
print(`Champion: {bestName} with {bestScore} points`)
```
On Roblox you'd put `task.wait(1)` inside the countdown so it ticks in real time.
:::

:::recap
- `if / elseif / else` runs the **first** truthy branch. Order conditions from most to least specific.
- Guard clauses (`if bad then return end`) keep code flat and readable.
- `while` checks first; `repeat ... until` checks last and always runs once.
- Numeric `for i = start, stop, step` includes `stop`; generic `for k, v in t do` walks collections.
- `break` exits the innermost loop; `continue` skips to its next iteration.
- Long-running loops on Roblox must yield with `task.wait()` — or better, use events.
:::
