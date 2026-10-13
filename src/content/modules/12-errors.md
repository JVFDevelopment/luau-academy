---
id: errors
title: Error Handling & Debugging
part: 2
summary: Raise, catch and recover from errors with `error`, `assert`, `pcall` and `xpcall` — then track down bugs like a pro with Studio's debugger and a systematic process.
time: 40 min
level: Intermediate
objectives:
- Raise errors deliberately with `error` and `assert`, including error levels
- Catch errors with `pcall` and get stack traces with `xpcall`
- Retry operations that fail for reasons outside your control
- Know when *not* to use `pcall`
- Debug with breakpoints, stepping, the Watch window and the Developer Console
- Follow a repeatable process for finding any bug
---

Things go wrong. Data stores time out, web requests fail, players send garbage, and — most often — our own code has bugs. Good developers don't write code that never fails; they write code that **fails clearly**, **recovers where it can**, and is **easy to debug** when something surprising happens.

## Raising errors

### error

`error(message, level?)` stops the current thread and reports the message:

```luau
local function setVolume(v)
	if type(v) ~= "number" then
		error("volume must be a number")
	end
	-- ...
end
```

The optional **level** controls which line the error blames:

| Level | Points at |
| --- | --- |
| `1` (default) | The line that called `error` |
| `2` | The line that called *this function* — best for argument validation |
| `0` | No position info at all, just the message |

```luau
local function setVolume(v)
	if type(v) ~= "number" then
		error("volume must be a number", 2)   -- blame the caller
	end
end

setVolume("loud")  -- the error message points at THIS line
```

You can also throw a **table** as an error. No position info is added, but you can include structured data:

```luau
error({ code = "NOT_ENOUGH_COINS", needed = 50 })
```

### assert

`assert(condition, message?)` raises an error if the condition is falsy. If it passes, it returns all its arguments — so it can wrap a value inline:

```luau
local function spawnAt(position)
	assert(position, "spawnAt requires a position")
	-- ...
end

local config = assert(loadConfig(), "config failed to load")
```

`assert` is perfect for **internal invariants** — things that should never be false if your code is correct. When one fires, you've found a bug, and you've found it early.

## Catching errors with pcall

`pcall` ("protected call") runs a function and **catches** any error instead of letting it stop your script. It returns a success flag first:

```luau
local ok, result = pcall(function()
	return 10 / 2
end)
print(ok, result)  --> true 5

local ok2, err = pcall(function()
	error("something broke")
end)
print(ok2, err)    --> false <position info>: something broke
```

- On success: `true` followed by the function's return values.
- On failure: `false` followed by the error value (usually a string).

You can pass arguments after the function. This is especially useful for **methods**, which need the object passed explicitly as the first argument:

```roblox
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("PlayerData")

-- These are equivalent:
local ok, data = pcall(function()
	return store:GetAsync("Player_123")
end)
local ok2, data2 = pcall(store.GetAsync, store, "Player_123")
```

### xpcall and stack traces

`xpcall(fn, handler, ...)` is like `pcall`, but calls a **handler** with the error *before* the stack unwinds. That's your chance to capture a full stack trace with `debug.traceback`:

```luau
local function risky()
	local t = nil
	return t.field   -- error: attempt to index nil
end

local ok, trace = xpcall(risky, function(err)
	return debug.traceback(tostring(err), 2)
end)

if not ok then
	warn(trace)   -- message plus the full chain of calls that led here
end
```

Stack traces are invaluable for errors reported from live servers, where you can't just attach a debugger.

## When to use pcall (and when not to)

`pcall` is for **expected failures caused by things outside your control**:

- Data stores (`GetAsync`, `SetAsync`, `UpdateAsync`)
- `MarketplaceService` and `BadgeService` calls
- `HttpService` web requests
- Teleports, `MessagingService`, `MemoryStoreService`
- Loading assets, or anything else that talks to the network

On Roblox, functions ending in **`Async`** are a strong hint: they talk to a web service and can fail at any time for reasons that have nothing to do with your code.

:::danger Don't use pcall to hide bugs
Wrapping your own logic in `pcall` "just in case" swallows errors that are telling you about real bugs. The game appears to keep working while silently doing the wrong thing. If your code throws *attempt to index nil*, fix the bug — don't hide it.
:::

## Retrying with backoff

Network calls often fail transiently and succeed a moment later. A **retry with exponential backoff** waits a little longer after each failure:

```roblox
local function retry<T>(attempts: number, fn: () -> T): (boolean, T | string)
	local lastError = ""
	for attempt = 1, attempts do
		local ok, result = pcall(fn)
		if ok then
			return true, result
		end
		lastError = tostring(result)
		warn(`Attempt {attempt}/{attempts} failed: {lastError}`)
		if attempt < attempts then
			task.wait(2 ^ (attempt - 1))   -- 1s, 2s, 4s, ...
		end
	end
	return false, lastError
end

local ok, data = retry(3, function()
	return store:GetAsync("Player_123")
end)
```

You'll use exactly this shape in @datastores.

## Errors in event handlers and threads

On Roblox, an error inside an event handler or a spawned thread doesn't crash the whole game. It stops **that one call**, prints the error and stack trace to the Output, and everything else keeps running:

```roblox
part.Touched:Connect(function(hit)
	local humanoid = hit.Parent.Humanoid   -- errors if there's no Humanoid
	humanoid.Health = 0
end)
-- An error stops only this handler call; the next touch runs it again.
```

That's convenient, but it means errors can repeat silently in a live game. On the server you can listen to `ScriptContext.Error` to log every uncaught error — for example to your own analytics:

```roblox
local ScriptContext = game:GetService("ScriptContext")

ScriptContext.Error:Connect(function(message, stackTrace, sourceScript)
	-- send to your logging/analytics system
	print("Uncaught error:", message)
end)
```

## Debugging in Studio

### Print debugging

The simplest tool is still `print`. Make prints *useful*: label them, include types, and print tables (Studio's Output can expand tables printed directly):

```roblox
print("[Shop] buy request", player.Name, itemId, typeof(itemId))
print("[Shop] player data:", data)   -- expandable in the Output
```

Remove noisy debug prints before publishing, or guard them behind a `DEBUG` constant.

### Breakpoints and stepping

Click in the margin to the left of a line number to set a **breakpoint** (a red dot). When execution reaches that line during a playtest, the game pauses and you can inspect everything:

:::steps
1. **Set a breakpoint** by clicking the margin next to a line.
2. **Play** the game. Execution pauses when the line is reached.
3. Look at the **Watch** window to see variable values, and the **Call Stack** window to see which functions led here.
4. **Step Over** (++F10++) runs the current line and moves to the next. **Step Into** (++F11++) enters a function call. **Step Out** (++Shift+F11++) finishes the current function.
5. **Resume** (++F5++) continues until the next breakpoint.
:::

Right-click a breakpoint to make it **conditional** (only pause when an expression is true — e.g. `player.Name == "Koala"`) or turn it into a **logpoint** that prints a message without pausing.

### Script Analysis

The **Script Analysis** window (View tab) lists syntax errors, type errors and lint warnings for every script — unknown globals, unused variables, shadowing, and more. Keep it open and keep it empty.

### The Developer Console

In a live game, press ++F9++ (or type `/console` in chat) to open the **Developer Console**. It shows client and server logs, memory usage, network stats and more. As the game owner you can see server output there too. It's how you investigate bugs that only happen in real servers.

## A systematic debugging process

When something's wrong, guessing randomly wastes hours. Work through these steps instead:

:::steps
1. **Reproduce it.** Find reliable steps that trigger the bug. If you can't reproduce it, you can't confirm it's fixed.
2. **Read the error.** The message, script and line number are your best clue. Check the stack trace for *how* you got there.
3. **Isolate it.** Narrow down where it goes wrong. Add prints or breakpoints halfway through the suspect code, then halve again — like a binary search.
4. **Form a hypothesis.** "I think `target` is nil because the player left before the tween finished."
5. **Test the hypothesis.** Print the value, or reproduce the exact scenario. Don't change code yet.
6. **Fix the cause, not the symptom.** Adding `if x == nil then return end` everywhere hides the problem. Ask *why* it's nil.
7. **Verify.** Re-run your reproduction steps and check you didn't break anything nearby.
:::

:::pro Rubber duck debugging
Explaining your code line by line — to a friend, a rubber duck, or a comment you're writing — forces you to state your assumptions. Surprisingly often, you'll spot the bug halfway through the explanation.
:::

:::quiz Errors & debugging
? What does `pcall` return when the function errors?
- `nil` and the error message
+ `false` and the error value
- Only the error message
- It re-raises the error
> `pcall` returns a success flag first: `true, results...` on success, `false, err` on failure.

? Which error level makes an error point at the line that *called* your function?
- 0
- 1
+ 2
- 3
> Level 2 blames the caller — ideal for argument validation.

? Why use `xpcall` instead of `pcall`?
- It's faster
+ Its handler runs before the stack unwinds, so you can capture a full traceback
- It retries automatically
- It doesn't need a function
> `debug.traceback()` inside the `xpcall` handler shows the whole call chain.

? Which call should usually be wrapped in `pcall`?
+ `store:GetAsync(key)`
- `math.floor(x)`
- `Instance.new("Part")`
- `table.insert(t, v)`
> Network-backed `Async` functions can fail for reasons outside your control.

? What happens when an error occurs inside a `Touched` event handler?
- The whole server crashes
+ That handler call stops and the error is printed; other code keeps running
- The event disconnects permanently
- Nothing — errors in events are ignored silently
> Each handler call runs in its own thread; errors are reported but isolated.

? You found that `target` is unexpectedly `nil` deep in your code. What's the best fix?
- Wrap the function in `pcall`
- Add `if target == nil then return end` everywhere
+ Find out *why* it's nil and fix the cause
- Use `:: any` to silence it
> Guards are sometimes right, but first understand the cause. Hiding symptoms leaves the real bug in place.
:::

:::predict Level 0
```luau
local ok, err = pcall(function()
	error("boom", 0)
end)
print(ok, err)
```
= false boom
> With level 0, no position information is added — the error value is exactly `"boom"`.
:::

:::predict Success values
```luau
local ok, a, b = pcall(function()
	return "x", "y"
end)
print(ok, a, b)
```
= true x y
> On success, `pcall` returns `true` followed by every return value of the function.
:::

:::predict Table errors
```luau
local ok, err = pcall(function()
	error({ code = 404, reason = "missing" })
end)
print(ok, type(err), err.code)
```
= false table 404
> Any value can be thrown. Tables are passed through untouched, which makes them great for structured errors.
:::

## Challenges

:::challenge easy | Safe division
Write `safeDivide(a, b)` that **errors** with the message `"cannot divide by zero"` (blaming the caller) when `b` is `0`. Then call it inside `pcall` with `(10, 2)` and `(10, 0)`, printing either the result or `"Error: ..."`.
@solution
```luau
local function safeDivide(a, b)
	if b == 0 then
		error("cannot divide by zero", 2)
	end
	return a / b
end

for _, pair in { {10, 2}, {10, 0} } do
	local ok, result = pcall(safeDivide, pair[1], pair[2])
	if ok then
		print("Result:", result)
	else
		print("Error: " .. tostring(result))
	end
end
```
:::

:::challenge medium | Validated purchase
Write `purchase(wallet, price)` that validates its inputs with clear errors:

- `wallet` must be a table with a numeric `coins` field
- `price` must be a positive whole number
- the wallet must have enough coins

Use **table errors** like `{ code = "INSUFFICIENT_FUNDS" }` so the caller can react to specific failures. The caller should print a friendly message for each code.
@hint
`type(price) ~= "number" or price <= 0 or price % 1 ~= 0` catches non-numbers, non-positive numbers and decimals.
@solution
```luau
local function purchase(wallet, price)
	if type(wallet) ~= "table" or type(wallet.coins) ~= "number" then
		error({ code = "BAD_WALLET" })
	end
	if type(price) ~= "number" or price <= 0 or price % 1 ~= 0 then
		error({ code = "BAD_PRICE" })
	end
	if wallet.coins < price then
		error({ code = "INSUFFICIENT_FUNDS", missing = price - wallet.coins })
	end
	wallet.coins -= price
end

local MESSAGES = {
	BAD_WALLET = "Something went wrong with your wallet.",
	BAD_PRICE = "That item has an invalid price.",
}

local wallet = { coins = 30 }
local ok, err = pcall(purchase, wallet, 50)
if not ok then
	if type(err) == "table" and err.code == "INSUFFICIENT_FUNDS" then
		print(`You need {err.missing} more coins.`)
	elseif type(err) == "table" then
		print(MESSAGES[err.code] or "Unknown error")
	else
		error(err, 0)  -- an unexpected bug: don't swallow it, re-raise it
	end
end
```
Notice the last branch: errors we didn't plan for are re-raised instead of hidden.
:::

:::challenge medium | Flaky service
Simulate an unreliable web service in plain Luau: `fetchScore()` fails 60% of the time (`error("timeout")`) and otherwise returns `math.random(1, 100)`. Write `retry(attempts, fn)` that tries up to `attempts` times and returns `true, value` or `false, lastError`. Print how many attempts each call took. (In the playground there's no `task.wait`, so skip the delay.)
@solution
```luau
local function fetchScore()
	if math.random() < 0.6 then
		error("timeout", 0)
	end
	return math.random(1, 100)
end

local function retry(attempts, fn)
	local lastError
	for attempt = 1, attempts do
		local ok, result = pcall(fn)
		if ok then
			print(`succeeded on attempt {attempt}`)
			return true, result
		end
		lastError = result
	end
	return false, lastError
end

for i = 1, 3 do
	print(retry(5, fetchScore))
end
```
:::

:::challenge hard | Bug hunt
This function is supposed to return the names of the **top 3** players by score, highest first. It has **three bugs**. Find them using prints or reasoning — then fix them.

```luau
local function topThree(scores)
	local list = {}
	for name, score in scores do
		local list = {}
		table.insert(list, { name = name, score = score })
	end

	table.sort(list, function(a, b)
		return a.score >= b.score
	end)

	local result = {}
	for i = 0, 3 do
		table.insert(result, list[i].name)
	end
	return result
end

print(table.concat(topThree({ A = 5, B = 9, C = 1, D = 7 }), ", "))
```
@hint
Bug 1 is about scope: look at every `local` inside the first loop.
@hint
Bug 2 is in the comparator (remember the rule from @tables). Bug 3 is an off-by-one — and what if there are fewer than 3 players?
@solution
```luau
local function topThree(scores)
	local list = {}
	for name, score in scores do
		-- Bug 1 fixed: no 'local list' here (it shadowed the outer list)
		table.insert(list, { name = name, score = score })
	end

	table.sort(list, function(a, b)
		return a.score > b.score -- Bug 2 fixed: strict comparison
	end)

	local result = {}
	for i = 1, math.min(3, #list) do -- Bug 3 fixed: arrays start at 1, and guard short lists
		table.insert(result, list[i].name)
	end
	return result
end

print(table.concat(topThree({ A = 5, B = 9, C = 1, D = 7 }), ", ")) --> B, D, A
```
:::

:::recap
- `error(msg, level)` raises an error; level 2 blames the caller, level 0 adds no position. Any value can be thrown.
- `assert(cond, msg)` checks invariants and returns its arguments.
- `pcall(fn, ...)` returns `true, results...` or `false, err`. `xpcall` + `debug.traceback` captures stack traces.
- Wrap **network and `Async` calls** in `pcall`; retry transient failures with backoff. Don't use `pcall` to hide bugs.
- Errors in event handlers stop only that call. Log uncaught server errors with `ScriptContext.Error`.
- Debug with labeled prints, breakpoints, stepping, Watch, Call Stack, Script Analysis and the F9 Developer Console — and follow a systematic process.
:::
