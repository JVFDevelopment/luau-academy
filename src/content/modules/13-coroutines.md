---
id: coroutines
title: Coroutines & the Task Scheduler
part: 2
summary: How Luau runs "many things at once" on one thread — coroutines, yielding, generators, and Roblox's `task` library for spawning, delaying, waiting and cancelling work.
time: 45 min
level: Intermediate
objectives:
- Explain cooperative multitasking and what "yielding" means
- Create, resume and yield coroutines, passing values both ways
- Build generators with `coroutine.wrap`
- Use `task.spawn`, `task.defer`, `task.delay`, `task.wait` and `task.cancel` correctly
- Replace deprecated `wait`, `spawn` and `delay`
- Avoid race conditions caused by state changing while a thread is yielded
---

A game has dozens of things happening "at the same time": round timers counting down, NPCs walking, doors opening, data saving. Yet Luau only ever runs **one piece of code at a time**. The trick is that each piece of work can **pause** — *yield* — and let others run, then pick up exactly where it left off. That's what coroutines and Roblox's task scheduler are all about.

## Cooperative multitasking

A **thread** (also called a **coroutine**) is a function that can be paused and resumed. It keeps its own position and local variables while paused.

The crucial word is **cooperative**: a thread runs until it *chooses* to yield. Nothing interrupts it. That's why the infinite loop from @control-flow froze everything — it never yielded, so nothing else ever got a turn.

```text
Thread A: ──run──▶ yield ·········· resume ──run──▶ yield ···
Thread B: ··········── run ──▶ yield ················· resume ──▶
```

## Coroutines in pure Luau

### create, resume, yield

```luau
local co = coroutine.create(function()
	print("step 1")
	coroutine.yield()
	print("step 2")
	coroutine.yield()
	print("step 3")
end)

coroutine.resume(co)  --> step 1
coroutine.resume(co)  --> step 2
coroutine.resume(co)  --> step 3
print(coroutine.status(co))  --> dead
```

- `coroutine.create(fn)` makes a new thread in the **suspended** state. Nothing runs yet.
- `coroutine.resume(co, ...)` runs it until it yields or finishes.
- `coroutine.yield(...)` pauses the thread and hands control back to whoever resumed it.

### Status

| `coroutine.status(co)` | Meaning |
| --- | --- |
| `"suspended"` | Created but not started, or paused at a `yield` |
| `"running"` | Currently executing (you're inside it) |
| `"normal"` | It resumed another coroutine and is waiting for that one |
| `"dead"` | Finished, or stopped by an error |

### Passing values in and out

`resume` and `yield` form a two-way channel:

- Arguments to the **first** `resume` become the function's parameters.
- Values passed to `yield` are **returned by** the `resume` that resumed it.
- Arguments to later `resume` calls are **returned by** the `yield` that paused.

```luau
local co = coroutine.create(function(a, b)
	print("started with", a, b)
	local reply = coroutine.yield(a + b)   -- send a+b out, wait for a reply
	print("got reply", reply)
	return "finished"
end)

print(coroutine.resume(co, 1, 2))   --> started with 1 2, then: true 3
print(coroutine.resume(co, "hi"))   --> got reply hi, then: true finished
print(coroutine.resume(co))         --> false cannot resume dead coroutine
```

`resume` returns `true` plus the yielded/returned values on success, or `false` plus an error message if the coroutine errored (or was already dead). Errors **don't** escape `resume` — it works like `pcall`.

### Generators with wrap

`coroutine.wrap(fn)` creates a coroutine and returns a **function** that resumes it. Calling that function returns the yielded values directly, and errors propagate normally. It's perfect for **generators** — functions that produce a sequence of values on demand:

```luau
local function range(from, to, step)
	return coroutine.wrap(function()
		for i = from, to, step or 1 do
			coroutine.yield(i)
		end
	end)
end

for n in range(0, 20, 5) do
	print(n)   --> 0, 5, 10, 15, 20
end
```

When the coroutine finishes, the wrapper returns nothing, which ends the `for` loop.

### Other coroutine functions

| Function | Purpose |
| --- | --- |
| `coroutine.running()` | The currently running thread |
| `coroutine.isyieldable()` | Whether the current code is allowed to yield |
| `coroutine.close(co)` | Close a suspended or dead coroutine, putting it in the dead state |

## The Roblox task scheduler

On Roblox you rarely call `coroutine.resume` yourself. Instead, the engine's **task scheduler** resumes threads for you. Every frame (about 60 times a second) it runs physics, rendering, input — and resumes any Luau threads that are ready.

Many Roblox functions **yield** the calling thread and let the scheduler resume it later:

- `task.wait(seconds)` — resume after a delay
- `Instance:WaitForChild(name)` — resume when a child appears
- `RBXScriptSignal:Wait()` — resume when an event fires
- Web-backed `Async` functions — `GetAsync`, `UserOwnsGamePassAsync`, and so on — resume when the request finishes

While your thread is yielded, other threads run. That's how a single Script can have a round timer, a shop and a spawner all working "at once".

## The task library

The `task` library is the modern way to schedule work on Roblox:

| Function | What it does |
| --- | --- |
| `task.spawn(fn, ...)` | Run `fn` **immediately** in a new thread, until it yields. Returns the thread. |
| `task.defer(fn, ...)` | Run `fn` in a new thread **a little later** (at the end of the current resumption cycle). |
| `task.delay(seconds, fn, ...)` | Run `fn` in a new thread after `seconds`. Returns the thread. |
| `task.wait(seconds?)` | Yield the current thread for `seconds` (default: one frame). Returns the actual time waited. |
| `task.cancel(thread)` | Cancel a thread so it never resumes. |
| `task.desynchronize()` / `task.synchronize()` | Switch between parallel and serial execution (see @performance). |

```roblox
print("A")
task.spawn(function()
	print("B")        -- runs right away
	task.wait(1)
	print("E")        -- one second later
end)
task.defer(function()
	print("D")        -- runs shortly after the current code finishes
end)
print("C")
```

```output
A
B
C
D
E
```

`task.spawn` also accepts an existing **thread** to resume, which you'll use in advanced patterns like the timeout below.

### Running loops side by side

Each loop needs its own thread, or the first one blocks everything after it:

```roblox
task.spawn(function()
	while true do
		task.wait(1)
		print("Tick")
	end
end)

task.spawn(function()
	while true do
		task.wait(5)
		print("Spawning wave")
	end
end)

print("Both loops are running")
```

### Cancelling work

`task.delay` and `task.spawn` return the thread they created. Keep it if you might need to cancel:

```roblox
local countdown = task.spawn(function()
	for i = 10, 1, -1 do
		print(i)
		task.wait(1)
	end
	print("Boom!")
end)

-- Somewhere else, e.g. when a player defuses the bomb:
task.cancel(countdown)
```

## Replace wait, spawn and delay

You'll see `wait()`, `spawn()` and `delay()` all over old tutorials and free models. They're **deprecated**:

- `wait()` is throttled and can wait noticeably longer than requested; `task.wait()` resumes on the very next opportunity.
- `spawn()` doesn't start immediately and can be delayed unpredictably; `task.spawn()` runs right away and `task.defer()` gives you deliberate deferral.
- `delay()` shares the same throttling problems as `wait()`.

:::tip Rule of thumb
Always use `task.wait`, `task.spawn`, `task.defer` and `task.delay` in new code. If you copy code that uses the old globals, update it.
:::

## Yield-safety: the world changes while you wait

When your thread yields, **other code runs** — and the world may be different when you wake up. This is the source of many subtle bugs:

```roblox
local function rewardAfterDelay(player)
	task.wait(5)
	-- Five seconds later... is the player still here? Is their data loaded?
	player.leaderstats.Coins.Value += 100   -- may error if they left!
end
```

After any yield, re-check your assumptions:

```roblox
local function rewardAfterDelay(player)
	task.wait(5)
	if not player.Parent then
		return   -- the player left while we were waiting
	end
	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats then
		leaderstats.Coins.Value += 100
	end
end
```

:::warning Things that can't yield
Some places don't allow yielding, and you'll get *"attempt to yield across metamethod/C-call boundary"*. Don't yield inside metamethods like `__index`, inside `table.sort` comparators, or inside callbacks that must return immediately. Also avoid yielding at the top level of a ModuleScript — every script that requires it has to wait too.
:::

## Pattern: waiting with a timeout

Waiting for an event that might never come is risky. Here's a reusable helper that resumes either when the event fires or when time runs out — whichever comes first:

```roblox
local function waitWithTimeout(signal: RBXScriptSignal, timeout: number): (boolean, ...any)
	local thread = coroutine.running()
	local timer: thread
	local connection = signal:Once(function(...)
		task.cancel(timer)
		task.spawn(thread, true, ...)
	end)
	timer = task.delay(timeout, function()
		connection:Disconnect()
		task.spawn(thread, false)
	end)
	return coroutine.yield()
end

-- Wait up to 10 seconds for the player to touch the pad
local touched, hit = waitWithTimeout(pad.Touched, 10)
if touched then
	print("Touched by", hit.Name)
else
	print("Timed out")
end
```

This combines everything from the module: capturing the current thread, yielding it, and resuming it from whichever callback wins the race.

:::info Promises
Many professional codebases use a **Promise** library (a popular one is by evaera) to manage asynchronous work: chaining steps, handling errors, cancelling, and racing operations. It's built on exactly the ideas in this module.
:::

:::quiz Coroutines & tasks
? What does it mean that Luau's multitasking is *cooperative*?
- The engine interrupts threads every millisecond
+ A thread runs until it chooses to yield
- Threads run on separate CPU cores by default
- Only one coroutine can ever exist
> Nothing preempts a running thread. If it never yields, nothing else runs.

? What does `coroutine.resume` return if the coroutine raises an error?
- It re-raises the error
+ `false` and the error message
- `nil`
- `true` and `nil`
> `resume` catches errors like `pcall`. (`coroutine.wrap`, by contrast, propagates them.)

? What's the difference between `task.spawn` and `task.defer`?
+ `spawn` runs the function immediately; `defer` runs it shortly after the current code finishes
- `defer` waits one full second
- `spawn` runs on another CPU core
- There is no difference
> Both create a new thread; they differ in *when* it starts.

? Why should you replace `wait()` with `task.wait()`?
- `wait()` doesn't exist anymore
+ `wait()` is throttled and can wait longer than requested
- `task.wait()` doesn't yield
- `wait()` only works on the client
> The legacy globals are deprecated and less precise. Always use the `task` library.

? A function does `task.wait(5)` and then uses `player.Character`. What should it do first?
- Nothing, the character can't change during a wait
+ Re-check that the player and character still exist
- Call `task.wait()` again
- Wrap everything in `coroutine.wrap`
> Other code runs while you're yielded — the player may have left or respawned.

? What does `task.wait()` return?
- Nothing
- `true`
+ The time actually waited, in seconds
- The current frame number
> The return value can be slightly more than requested, which is useful for frame-rate-independent logic.
:::

:::predict Two-way communication
```luau
local co = coroutine.create(function(a, b)
	print("start", a, b)
	local c = coroutine.yield(a + b)
	print("got", c)
	return "done"
end)

print(coroutine.resume(co, 1, 2))
print(coroutine.resume(co, "x"))
print(coroutine.status(co))
```
= start 1 2
= true 3
= got x
= true done
= dead
> The first resume starts the function with `a=1, b=2` and runs until `yield(3)`. The second resume makes `yield` return `"x"`, then the function returns `"done"` and the coroutine is dead.
:::

:::predict Generator
```luau
local squares = coroutine.wrap(function()
	for i = 1, 3 do
		coroutine.yield(i * i)
	end
end)
print(squares(), squares(), squares())
```
= 1 4 9
> Each call resumes the coroutine until the next `yield`, which returns the next square.
:::

## Challenges

:::challenge easy | Fibonacci generator
Use `coroutine.wrap` to write `fibonacci()`, a generator that yields Fibonacci numbers forever (1, 1, 2, 3, 5, …). Print the first 10 values.
@solution
```luau
local function fibonacci()
	return coroutine.wrap(function()
		local a, b = 1, 1
		while true do
			coroutine.yield(a)
			a, b = b, a + b
		end
	end)
end

local nextFib = fibonacci()
for _ = 1, 10 do
	print(nextFib())
end
```
The `while true` loop is fine here: it yields every iteration, so it only runs when someone asks for the next value.
:::

:::challenge medium | Round-robin scheduler
Build a tiny scheduler in pure Luau. Write `runAll(tasks)` that takes an array of functions, turns each into a coroutine, and then repeatedly resumes each **non-dead** coroutine in turn until all have finished. Test it with three tasks that each print a few steps and `coroutine.yield()` between them — the output should interleave.
@hint
Keep an array of threads. Loop while at least one is still `"suspended"`.
@solution
```luau
local function runAll(tasks)
	local threads = {}
	for _, fn in tasks do
		table.insert(threads, coroutine.create(fn))
	end

	local alive = #threads
	while alive > 0 do
		alive = 0
		for _, co in threads do
			if coroutine.status(co) == "suspended" then
				local ok, err = coroutine.resume(co)
				if not ok then
					print("task error:", err)
				end
				if coroutine.status(co) == "suspended" then
					alive += 1
				end
			end
		end
	end
end

local function worker(name, steps)
	return function()
		for i = 1, steps do
			print(`{name} step {i}`)
			coroutine.yield()
		end
	end
end

runAll({ worker("A", 3), worker("B", 2), worker("C", 3) })
```
This is, in miniature, what Roblox's task scheduler does every frame.
:::

:::challenge medium | Defusable bomb
In Roblox Studio, write a server script that starts a 10-second countdown in its own thread, printing each second. Make a Part named `DefuseButton` with a ClickDetector; clicking it should cancel the countdown and print `"Defused with X seconds left!"`. If the countdown reaches zero, print `"Boom!"`.
@hint
Store the thread returned by `task.spawn` and the seconds remaining in an upvalue. Call `task.cancel(thread)` in the ClickDetector's `MouseClick` handler.
@solution
```roblox title="ServerScriptService › Bomb"
local button = workspace:WaitForChild("DefuseButton")
local clickDetector = button:WaitForChild("ClickDetector")

local secondsLeft = 10
local countdown = task.spawn(function()
	while secondsLeft > 0 do
		print(secondsLeft)
		task.wait(1)
		secondsLeft -= 1
	end
	print("Boom!")
end)

clickDetector.MouseClick:Connect(function(player)
	if coroutine.status(countdown) ~= "dead" then
		task.cancel(countdown)
		print(`Defused by {player.Name} with {secondsLeft} seconds left!`)
	end
end)
```
:::

:::challenge hard | Wait for all
Write `all(fns)` for Roblox: it runs every function in `fns` **concurrently** (each may yield, e.g. with `task.wait` or data store calls), waits until **all** have finished, and returns their results in the **original order** as an array. If any function errors, `all` should still wait for the rest and then return `false` plus the first error message; otherwise return `true` plus the results.
@hint
Spawn each function with `task.spawn`, wrapping it in `pcall`. Keep a counter of how many are still running.
@hint
Capture the calling thread with `coroutine.running()`. When the counter reaches zero, resume it with `task.spawn(thread)`. Yield the caller with `coroutine.yield()` — but only if something is still running (some functions might finish without yielding!).
@solution
```roblox
local function all(fns: { () -> any }): (boolean, any)
	local results = {}
	local firstError = nil
	local remaining = #fns
	local caller = coroutine.running()
	local waiting = false

	for i, fn in fns do
		task.spawn(function()
			local ok, result = pcall(fn)
			if ok then
				results[i] = result
			elseif firstError == nil then
				firstError = result
			end
			remaining -= 1
			if remaining == 0 and waiting then
				task.spawn(caller)
			end
		end)
	end

	if remaining > 0 then
		waiting = true
		coroutine.yield()
	end

	if firstError ~= nil then
		return false, firstError
	end
	return true, results
end

local ok, results = all({
	function() task.wait(2) return "slow" end,
	function() task.wait(0.5) return "fast" end,
	function() return "instant" end,
})
print(ok, results[1], results[2], results[3]) --> true slow fast instant (after ~2 seconds)
```
The total time is the time of the *slowest* function, not the sum — that's the point of running them concurrently.
:::

:::recap
- Luau runs one thread at a time; threads **yield** to let others run (cooperative multitasking).
- `coroutine.create/resume/yield` pass values both ways; `resume` catches errors; `wrap` makes generators.
- Roblox's scheduler resumes yielded threads: `task.wait`, `WaitForChild`, `Event:Wait()` and `Async` calls all yield.
- Use `task.spawn` (now), `task.defer` (soon), `task.delay` (later), `task.wait` and `task.cancel`. Never `wait`/`spawn`/`delay`.
- After any yield, re-check that players, characters and data still exist.
- Don't yield in metamethods, sort comparators or at a ModuleScript's top level.
:::
