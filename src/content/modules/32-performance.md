---
id: performance
title: Performance & Optimization
part: 6
summary: Make games run smoothly on every device — measure first, then fix: event-driven code, caching, object pooling, memory leaks, network traffic, StreamingEnabled, native code generation and Parallel Luau.
time: 45 min
level: Advanced
objectives:
- Measure with the MicroProfiler, Script Profiler and Developer Console before optimizing
- Remove common CPU waste: polling, repeated lookups, per-frame allocations
- Find and fix memory leaks
- Reduce network and rendering costs
- Use `--!native` and Parallel Luau (Actors) where they actually help
---

Most Roblox players are on phones. A game that runs at 60 FPS on your PC can stutter on a mid-range phone — and players leave. Optimization is a skill: **measure, find the real bottleneck, fix it, measure again.**

## Measure first

| Tool | Shows |
| --- | --- |
| **Developer Console** (++F9++) | Memory by category, server/client logs, network stats, Script Profiler |
| **MicroProfiler** (++Ctrl+Alt+F6++, or Studio's View tab) | Frame-by-frame timings of everything the engine does, including your scripts |
| **Script Profiler** | Which functions use the most CPU |
| `debug.profilebegin("Label")` / `debug.profileend()` | Your own labeled sections in the MicroProfiler |
| `os.clock()` | Quick timing of a code block |

:::pro Don't guess
The slow part is rarely where you expect. Optimizing code that runs once at startup is wasted effort; shaving a little off something that runs 50,000 times per second matters enormously. Profile on a real low-end device or Studio's device emulation.
:::

## CPU: common wins

**Be event-driven.** A `while true do task.wait() ... end` per object, checking state that rarely changes, adds up fast. Use events (@events) and tags (@services) instead.

**Cache lookups out of hot paths.**

```roblox
-- ❌ Looks things up every frame
RunService.Heartbeat:Connect(function()
	local hum = workspace:FindFirstChild("Boss"):FindFirstChild("Humanoid")
	-- ...
end)

-- ✅ Look up once, reuse
local boss = workspace:WaitForChild("Boss")
local bossHumanoid = boss:WaitForChild("Humanoid") :: Humanoid
RunService.Heartbeat:Connect(function()
	-- use bossHumanoid
end)
```

**Avoid allocations in hot loops.** Creating tables, closures, strings or `RaycastParams` every frame creates garbage the collector must clean up. Reuse objects.

**Use the right data structure.** A set lookup (`set[x]`) beats `table.find` on large arrays; `table.create(n)` preallocates arrays you're about to fill; build strings with `table.concat`.

**Don't do everything every frame.** AI can think 5 times per second; UI that shows a timer can update once per second; distant objects can update less often than near ones.

**Spread work out.** Processing 1,000 items in one frame causes a hitch; processing 50 per frame doesn't.

```roblox
for i, item in items do
	process(item)
	if i % 50 == 0 then
		task.wait()   -- yield every 50 items to keep frames smooth
	end
end
```

## Memory: leaks

A **leak** is memory that's never released because something still references it. Common causes:

- **Connections never disconnected** on long-lived objects (@events).
- **Per-player tables never cleaned** on `PlayerRemoving`.
- **Destroyed Instances still referenced** from tables (they can't be garbage collected).
- **Ever-growing caches** without limits.

Watch the Developer Console's memory graphs during long play sessions: steady growth that never levels off usually means a leak. The cleanup patterns in @patterns (Maid/Trove) exist mostly to prevent these.

## Object pooling

Creating and destroying many Instances (bullets, effects, coins) is expensive. A **pool** reuses them:

```roblox
local Pool = {}
Pool.__index = Pool

function Pool.new(template: BasePart, size: number)
	local self = setmetatable({ free = table.create(size), template = template }, Pool)
	for i = 1, size do
		local part = template:Clone()
		part.Parent = workspace.PoolStorage
		part.CFrame = CFrame.new(0, -10000, 0) -- park far away
		self.free[i] = part
	end
	return self
end

function Pool:get(): BasePart
	return table.remove(self.free) or self.template:Clone()
end

function Pool:release(part: BasePart)
	part.CFrame = CFrame.new(0, -10000, 0)
	table.insert(self.free, part)
end
```

Moving parts away (rather than re-parenting) is typically the cheapest way to "hide" them.

## Rendering and physics

- **Part count matters.** Merge decorative parts (unions, meshes), and use `MeshPart` with good level-of-detail settings.
- Set `CanCollide`, `CanTouch` and `CanQuery` to `false` on decorative parts — fewer physics and query checks.
- **Anchor** everything that doesn't need to move.
- Use **StreamingEnabled** so clients only load what's near them (@client-server).
- Be careful with expensive effects on mobile: many particles, lights with shadows, large transparent surfaces, high-resolution textures.

## Network

- Don't fire remotes every frame with large payloads; send **changes**, not entire state.
- Use `UnreliableRemoteEvent` for frequent cosmetic data.
- Let the client animate cosmetic motion from a small state change (@animation).
- Replicated property changes cost bandwidth too — avoid changing many replicated properties every frame on the server.
- Compact data with `buffer` for high-frequency systems.

## Native code generation

Add `--!native` at the top of a script (or `@native` before a function) to compile it to machine code where supported. It can make **math-heavy** code (procedural generation, custom physics, pathfinding algorithms, large loops over numbers and buffers) several times faster:

```roblox
--!native
--!strict

local function noiseHeightmap(size: number): {number}
	local out = table.create(size * size)
	for z = 1, size do
		for x = 1, size do
			out[(z - 1) * size + x] = math.noise(x / 32, z / 32)
		end
	end
	return out
end
```

It won't help code that mostly calls Roblox APIs (setting properties, creating Instances) — those costs are inside the engine. Type annotations help native code generate faster machine code.

## Parallel Luau

Normally all Luau runs on one thread. **Parallel Luau** lets scripts inside **Actor** instances run some work on multiple CPU cores:

```roblox title="Actor › Script"
local RunService = game:GetService("RunService")

RunService.Heartbeat:ConnectParallel(function(dt)
	-- PARALLEL phase: heavy computation, read-only access to most Instances
	local result = expensiveCalculation()

	task.synchronize()
	-- SERIAL phase: now it's safe to modify Instances
	workspace.Result.Value = result
end)
```

- Code in a script under an `Actor` can call `task.desynchronize()` to enter the parallel phase and `task.synchronize()` to return.
- In parallel, you can read most properties but **can't modify** most Instances.
- Actors communicate with `actor:SendMessage(topic, ...)` / `BindToMessage`, and share data via `SharedTable`.
- It shines for large, independent workloads — e.g. many NPCs' decision-making or terrain generation chunks. For small workloads, the overhead isn't worth it.

:::quiz Performance
? What's the first step in optimizing?
+ Measure with a profiler to find the real bottleneck
- Add `--!native` everywhere
- Remove all comments
- Use Parallel Luau
> Optimizing the wrong thing wastes time.

? Which is a common cause of memory leaks?
+ Connections to long-lived objects that are never disconnected
- Using local variables
- Anchoring parts
- Using `table.concat`
> Connections keep their functions and captured values alive.

? When does `--!native` help most?
+ Math-heavy Luau code like loops over numbers and buffers
- Code that mostly sets Instance properties
- UI layout
- DataStore calls
> Engine API calls don't get faster; pure computation does.

? In Parallel Luau's parallel phase, what can't you do?
+ Modify most Instances
- Read properties
- Do math
- Call `task.synchronize()`
> Writes happen in the serial phase after `task.synchronize()`.

? You spawn and destroy 30 bullets per second. What helps?
+ Object pooling
- More `task.wait()` calls
- Using RemoteFunctions
- StreamingEnabled
> Reusing Instances avoids constant creation/destruction costs.
:::

## Challenges

:::challenge medium | Benchmark it
In the playground, benchmark three ways of checking whether a value is in a collection of 10,000 numbers, each performing 10,000 lookups: `table.find` on an array, a set table, and a manual loop with `break`. Print the time for each in milliseconds with `os.clock()`. Which wins, and why?
@solution
```luau
local N = 10000
local array, set = table.create(N), {}
for i = 1, N do
	array[i] = i * 2
	set[i * 2] = true
end

local function bench(name, fn)
	local start = os.clock()
	fn()
	print(string.format("%-12s %.2f ms", name, (os.clock() - start) * 1000))
end

bench("table.find", function()
	for i = 1, N do local _ = table.find(array, i) end
end)

bench("set", function()
	for i = 1, N do local _ = set[i] end
end)

bench("manual loop", function()
	for i = 1, N do
		for _, v in array do
			if v == i then break end
		end
	end
end)
```
The set wins by orders of magnitude: each lookup is constant time, while searching an array checks elements one by one.
:::

:::challenge hard | Bullet pool
Build a projectile system on the server that fires a glowing part forward from a launcher 10 times per second. Use an object pool of 40 parts, move each projectile with a `Heartbeat` loop (no physics, `Anchored = true`, raycast ahead each frame for hits), and return projectiles to the pool when they hit something or travel 200 studs. Show with `debug.profilebegin` how much time your update takes in the MicroProfiler.
@solution
```roblox
local RunService = game:GetService("RunService")
local launcher = workspace:WaitForChild("Launcher") :: BasePart

local template = Instance.new("Part")
template.Size = Vector3.new(0.4, 0.4, 2)
template.Material = Enum.Material.Neon
template.Anchored = true
template.CanCollide = false
template.CanQuery = false
template.CanTouch = false

local storage = Instance.new("Folder")
storage.Name = "Projectiles"
storage.Parent = workspace

local free: {BasePart} = {}
for _ = 1, 40 do
	local p = template:Clone()
	p.CFrame = CFrame.new(0, -10000, 0)
	p.Parent = storage
	table.insert(free, p)
end

type Shot = { part: BasePart, dir: Vector3, travelled: number }
local active: {Shot} = {}
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { storage, launcher }
local SPEED, MAX_DIST = 120, 200

local function fire()
	local part = table.remove(free)
	if not part then return end -- pool exhausted: skip rather than allocate
	part.CFrame = launcher.CFrame
	table.insert(active, { part = part, dir = launcher.CFrame.LookVector, travelled = 0 })
end

RunService.Heartbeat:Connect(function(dt)
	debug.profilebegin("Projectiles")
	for i = #active, 1, -1 do
		local shot = active[i]
		local step = SPEED * dt
		local origin = shot.part.Position
		local hit = workspace:Raycast(origin, shot.dir * step, params)
		shot.travelled += step
		if hit or shot.travelled >= MAX_DIST then
			shot.part.CFrame = CFrame.new(0, -10000, 0)
			table.insert(free, shot.part)
			table.remove(active, i)
		else
			shot.part.CFrame = CFrame.lookAt(origin + shot.dir * step, origin + shot.dir * (step + 1))
		end
	end
	debug.profileend()
end)

while true do
	fire()
	task.wait(0.1)
end
```
:::

:::recap
- Measure first: Developer Console, MicroProfiler, Script Profiler, `debug.profilebegin`.
- CPU: prefer events, cache lookups, avoid per-frame allocations, use sets, update less often, spread work across frames.
- Memory: disconnect, clean per-player tables, bound caches.
- Pool frequently created objects; reduce part counts and unnecessary physics/query flags; use StreamingEnabled.
- Network: send changes, use unreliable remotes for cosmetic data, animate on clients.
- `--!native` for math-heavy code; Parallel Luau (Actors) for large independent workloads.
:::
