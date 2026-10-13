---
id: modules
title: ModuleScripts & Architecture
part: 3
summary: Organize real projects with ModuleScripts — how `require` works, caching, configuration modules, services with Init/Start lifecycles, avoiding circular dependencies, and single-script architecture.
time: 40 min
level: Intermediate
objectives:
- Write and `require` ModuleScripts that return tables or functions
- Understand that modules run once per side and are cached
- Build config, utility, class and service modules
- Structure a game with one Script, one LocalScript and many modules
- Avoid circular requires and top-level yields
---

Once a game has more than a few scripts, copy-pasted logic and scattered globals turn into a nightmare. **ModuleScripts** are Roblox's answer: reusable chunks of code that other scripts load with `require`. Every serious Roblox codebase is built from them.

## Your first module

A ModuleScript runs once and **returns exactly one value** — almost always a table:

```roblox title="ReplicatedStorage › MathUtil (ModuleScript)"
local MathUtil = {}

function MathUtil.roundTo(x: number, places: number): number
	local f = 10 ^ places
	return math.round(x * f) / f
end

function MathUtil.chance(percent: number): boolean
	return math.random() * 100 < percent
end

return MathUtil
```

```roblox title="Any Script or LocalScript"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MathUtil = require(ReplicatedStorage.MathUtil)

print(MathUtil.roundTo(3.14159, 2))  --> 3.14
```

`require` takes the ModuleScript **Instance**. If the module isn't guaranteed to exist yet (common on the client), use `require(ReplicatedStorage:WaitForChild("MathUtil"))`.

## Caching: one run per side

The first `require` runs the module and remembers its return value. Every later `require` — from any script on the **same side** — gets the **same table**:

```roblox
local A = require(ReplicatedStorage.Counter)
local B = require(ReplicatedStorage.Counter)
print(A == B)  --> true
```

This makes modules a natural place for **shared state**: one script changes a value, another reads it. But the server and each client have **separate** copies — a module required on the server and on a client runs twice, in two different worlds. Modules don't magically sync data across the network; that's what replication and remotes are for.

:::warning Don't yield at the top level
If a module calls `task.wait`, `WaitForChild` on something slow, or a web request while it's first loading, every script that requires it waits too. Keep the module's top level fast; do slow work in functions that callers invoke.
:::

## Common kinds of modules

| Kind | Returns | Example |
| --- | --- | --- |
| **Config** | A frozen table of constants | Item prices, round length, damage numbers |
| **Utility** | A table of pure functions | Math, string formatting, table helpers |
| **Class** | A class table with `.new` | `Weapon`, `Enemy`, `Signal` |
| **Service / controller** | A table with state and lifecycle functions | `DataService`, `ShopService`, `UIController` |
| **Types** | Exported types | `export type PlayerData = {...}` |

```roblox title="ReplicatedStorage › Config (ModuleScript)"
return table.freeze({
	ROUND_TIME = 180,
	INTERMISSION = 15,
	MIN_PLAYERS = 2,
	ITEMS = table.freeze({
		Sword = { price = 100, damage = 20 },
		Bow = { price = 250, damage = 12 },
	}),
})
```

Putting tunable numbers in one config module means designers (or future you) can rebalance the game without hunting through code.

## Single-script architecture

A popular and effective structure: **one Script** on the server and **one LocalScript** on the client, each of which loads a folder of modules and starts them. All real logic lives in modules.

:::tree
ServerScriptService
  Main (Script) # requires and starts every service
  Services (Folder)
    DataService (ModuleScript)
    RoundService (ModuleScript)
    ShopService (ModuleScript)
StarterPlayer
  StarterPlayerScripts
    Main (LocalScript) # requires and starts every controller
    Controllers (Folder)
      UIController (ModuleScript)
      InputController (ModuleScript)
ReplicatedStorage
  Shared (Folder)
    Config (ModuleScript)
    Remotes (ModuleScript)
:::

Each service exposes two lifecycle functions:

- `Init()` — set up internal state. **Don't** talk to other services yet.
- `Start()` — everything is initialized; connect events, start loops, call other services.

```roblox title="ServerScriptService › Services › RoundService"
local RoundService = {}

local DataService -- filled in during Init

function RoundService.Init()
	DataService = require(script.Parent.DataService)
	RoundService.currentRound = 0
end

function RoundService.Start()
	task.spawn(function()
		while true do
			RoundService.currentRound += 1
			print("Round", RoundService.currentRound)
			task.wait(60)
		end
	end)
end

return RoundService
```

```roblox title="ServerScriptService › Main"
local servicesFolder = script.Parent.Services
local services = {}

for _, module in servicesFolder:GetChildren() do
	if module:IsA("ModuleScript") then
		services[module.Name] = require(module)
	end
end

for name, service in services do
	if service.Init then service.Init() end
end

for name, service in services do
	if service.Start then task.spawn(service.Start) end
end
```

Two phases mean no service ever calls another that isn't ready. Running each `Start` with `task.spawn` means one slow service can't block the rest. This is the core idea behind every Roblox "framework" you'll see.

## Circular dependencies

If module A requires B at load time **and** B requires A at load time, Roblox raises an error ("requested module was required recursively"). Fixes:

- **Restructure** so shared logic lives in a third module both can require.
- **Require lazily** — inside `Init()` or inside the function that needs it — as `RoundService` does above with `DataService`.
- **Communicate with signals** instead of direct calls, so one side doesn't need to know about the other.

## Module design tips

- **Return a table with a clear public API.** Prefix internal functions with `_` or keep them as locals.
- **Keep modules focused.** `ShopService` shouldn't also handle chat commands.
- **Type your API** with `--!strict` and `export type`.
- **Server-only modules go in `ServerScriptService`/`ServerStorage`.** Shared modules in `ReplicatedStorage` are readable by clients — never put secrets there.

:::quiz ModuleScripts
? How many values can a ModuleScript return?
+ Exactly one
- Up to three
- As many as it wants
- None — modules only define globals
> A module must return exactly one value — usually a table.

? Two server scripts `require` the same module. How many times does it run?
+ Once — the second require gets the cached result
- Twice
- Once per frame
- Zero until a player joins
> Modules run once per environment and are cached.

? A module in ReplicatedStorage is required by the server and by a client. Do they share its state?
- Yes, it's the same table everywhere
+ No — the server and each client run their own copy
- Only numbers are shared
- Only after a RemoteEvent fires
> Each side has its own copy. Use remotes or replication to share data.

? Why separate `Init` from `Start` in services?
+ So every service is set up before any service starts calling others
- Because modules can only have two functions
- To make `require` faster
- To run services on the client
> Two phases avoid calling a service that hasn't initialized yet.

? Module A requires B and B requires A at the top level. What happens?
- It works fine
+ An error about a recursive require
- Both modules run twice
- The game crashes
> Break the cycle by restructuring, requiring lazily, or using signals.
:::

## Challenges

:::challenge easy | Config + utility modules
Create `ReplicatedStorage.Shared.Config` returning a frozen table with `STARTING_COINS = 100` and `DAILY_REWARD = 50`, and `ReplicatedStorage.Shared.Format` with a `commas(n)` function (reuse your solution from @strings). In a server Script, require both and print `"Daily reward: 50 coins"` and a formatted `1234567`.
@solution
```roblox title="ReplicatedStorage › Shared › Config"
return table.freeze({
	STARTING_COINS = 100,
	DAILY_REWARD = 50,
})
```
```roblox title="ReplicatedStorage › Shared › Format"
local Format = {}

function Format.commas(n: number): string
	local digits = tostring(math.floor(math.abs(n)))
	local out = digits:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	out = out:gsub("^,", "")
	return (if n < 0 then "-" else "") .. out
end

return Format
```
```roblox title="ServerScriptService › Test"
local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Format)

print(`Daily reward: {Config.DAILY_REWARD} coins`)
print(Format.commas(1234567))
```
:::

:::challenge hard | Service loader
Build the single-script architecture yourself: a `Main` Script that loads every ModuleScript in `ServerScriptService.Services`, calls `Init` on all, then `Start` on all in separate threads. Write two services: `GreetService` (greets players on join) and `ClockService` (prints the uptime every 10 seconds and exposes `getUptime()`). Make `GreetService` include the uptime in its greeting by calling `ClockService` — requiring it lazily in `Init`. Make the loader print a warning, without stopping, if a service errors in `Init`.
@hint
Wrap each `Init` call in `pcall` and keep only services that initialized successfully.
@solution
```roblox title="ServerScriptService › Main"
local services = {}
for _, module in script.Parent.Services:GetChildren() do
	if module:IsA("ModuleScript") then
		services[module.Name] = require(module)
	end
end

local ready = {}
for name, service in services do
	local ok, err = pcall(function()
		if service.Init then service.Init() end
	end)
	if ok then
		ready[name] = service
	else
		warn(`[Main] {name} failed to Init: {err}`)
	end
end

for _, service in ready do
	if service.Start then
		task.spawn(service.Start)
	end
end
```
```roblox title="Services › ClockService"
local ClockService = {}
local startedAt = 0

function ClockService.Init()
	startedAt = os.clock()
end

function ClockService.getUptime(): number
	return math.floor(os.clock() - startedAt)
end

function ClockService.Start()
	while true do
		task.wait(10)
		print(`[Clock] uptime {ClockService.getUptime()}s`)
	end
end

return ClockService
```
```roblox title="Services › GreetService"
local Players = game:GetService("Players")
local GreetService = {}
local ClockService

function GreetService.Init()
	ClockService = require(script.Parent.ClockService)
end

function GreetService.Start()
	Players.PlayerAdded:Connect(function(player)
		print(`Welcome {player.Name}! Server uptime: {ClockService.getUptime()}s`)
	end)
end

return GreetService
```
:::

:::recap
- A ModuleScript returns one value; `require(moduleInstance)` loads it.
- Modules run **once per side** and are cached — great for shared state on that side, but server and clients don't share.
- Common modules: config, utilities, classes, services, types.
- Single-script architecture: one Script + one LocalScript bootstrapping services with `Init`/`Start`.
- Avoid top-level yields and circular requires (require lazily or restructure).
:::
