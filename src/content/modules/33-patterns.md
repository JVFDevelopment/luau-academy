---
id: patterns
title: Design Patterns & Clean Code
part: 6
summary: The patterns professional Roblox developers reach for — cleanup with Maids/Troves, state machines, observers, data-driven design, dependency injection — plus naming, style and code review habits.
time: 40 min
level: Advanced
objectives:
- Clean up connections, Instances and threads reliably with a Trove
- Model game flow with state machines
- Drive behavior from data instead of hard-coded branches
- Decouple systems with signals and dependency injection
- Write code that's readable, consistent and easy to change
---

Code that works is the beginning. Code that's easy to **read, change and debug six months later** is what separates hobby projects from games that keep growing. This module collects the patterns you'll see across professional Roblox codebases.

## Cleanup: Maids and Troves

Objects accumulate things that must be cleaned up — connections, Instances, threads, other objects. Tracking them by hand is error-prone. A **Trove** (also called a Maid or Janitor) collects them and cleans everything in one call:

```roblox title="ReplicatedStorage › Shared › Trove (ModuleScript)"
local Trove = {}
Trove.__index = Trove

function Trove.new()
	return setmetatable({ _items = {} }, Trove)
end

function Trove:Add<T>(item: T): T
	table.insert(self._items, item)
	return item
end

function Trove:Connect(signal: RBXScriptSignal, fn: (...any) -> ()): RBXScriptConnection
	return self:Add(signal:Connect(fn))
end

function Trove:Clean()
	for i = #self._items, 1, -1 do
		local item = self._items[i]
		local kind = typeof(item)
		if kind == "RBXScriptConnection" then
			item:Disconnect()
		elseif kind == "Instance" then
			item:Destroy()
		elseif kind == "thread" then
			pcall(task.cancel, item)
		elseif kind == "function" then
			item()
		elseif kind == "table" and item.Destroy then
			item:Destroy()
		end
		self._items[i] = nil
	end
end

Trove.Destroy = Trove.Clean
return Trove
```

```roblox
-- Usage: everything this ability creates dies with it
local trove = Trove.new()
trove:Connect(humanoid.Died, onDied)
trove:Add(Instance.new("Highlight")).Parent = character
trove:Add(task.spawn(tickLoop))
trove:Add(function() print("ability cleaned up") end)

-- Later:
trove:Clean()
```

Give every object that owns resources a Trove and call `trove:Clean()` in its `Destroy` method. Leaks largely disappear. (Popular community versions include Trove, Maid and Janitor.)

## State machines

You built one for NPCs in @npcs. The same pattern organizes **game flow**:

```roblox
local states = {}
local current = "Intermission"

function states.Intermission()
	print("Intermission")
	task.wait(15)
	return if #game:GetService("Players"):GetPlayers() >= 2 then "Round" else "Intermission"
end

function states.Round()
	print("Round started")
	task.wait(120)
	return "Results"
end

function states.Results()
	print("Showing results")
	task.wait(8)
	return "Intermission"
end

while true do
	current = states[current]()
end
```

Each state is self-contained, transitions are explicit, and adding a "Voting" state is trivial. Expose the current state (e.g. as an attribute on `ReplicatedStorage`) so clients can show the right UI.

## Data-driven design

Instead of writing a branch per item, describe items as **data** and write **one** system that interprets it:

```roblox
-- ❌ Code per item
if itemId == "Sword" then damage = 20
elseif itemId == "Axe" then damage = 30 ... end

-- ✅ Data + one system
local ITEMS = table.freeze({
	Sword = { damage = 20, cooldown = 0.6, price = 100 },
	Axe   = { damage = 30, cooldown = 1.0, price = 250 },
	Spear = { damage = 18, cooldown = 0.5, price = 180, reach = 9 },
})

local function getDamage(itemId: string): number
	local def = ITEMS[itemId]
	return if def then def.damage else 0
end
```

Adding content becomes adding a row of data. Balancing becomes editing numbers in one place.

## Observer pattern: signals

Systems shouldn't all know about each other. The quest system shouldn't need to modify the combat code to know when an enemy dies. Instead, combat **announces** events and others **subscribe**:

```roblox
-- CombatService
CombatService.EnemyKilled = Signal.new()
-- ... when an enemy dies:
CombatService.EnemyKilled:Fire(player, enemyType)

-- QuestService (doesn't touch combat code)
CombatService.EnemyKilled:Connect(function(player, enemyType)
	advanceQuest(player, "kill_" .. enemyType)
end)

-- AchievementService, AnalyticsService... can subscribe too
```

## Dependency injection

Pass a function or object its dependencies instead of having it reach out and grab globals. It makes code testable and flexible:

```roblox
-- Hard to test: secretly depends on the real data store
local function rewardPlayer(player)
	DataService.get(player).coins += 10
end

-- Easy to test: the caller provides the data access
local function rewardPlayer(getData: (Player) -> { coins: number }, player: Player)
	getData(player).coins += 10
end
```

In tests you can pass a fake `getData`; in the game you pass the real one.

## Guard clauses, small functions, early returns

You met guard clauses in @control-flow. Combined with small, well-named functions, they make code read like a description of what it does:

```roblox
local function tryOpenChest(player: Player, chest: Model)
	if not isNearby(player, chest) then return end
	if not hasKey(player, chest:GetAttribute("KeyId")) then return notify(player, "Locked") end
	if chest:GetAttribute("Opened") then return end

	chest:SetAttribute("Opened", true)
	grantLoot(player, chest:GetAttribute("LootTable"))
end
```

## Naming and style

| Thing | Convention | Example |
| --- | --- | --- |
| Services, classes, modules | PascalCase | `DataService`, `Weapon` |
| Locals and functions | camelCase | `currentRound`, `spawnEnemy` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PLAYERS` |
| Private members | `_` prefix | `self._connections` |
| Booleans | `is/has/can/should` | `isAlive`, `canAfford` |
| Events/signals | Past tense or `-ed` | `EnemyKilled`, `RoundEnded` |

Other habits that pay off:

- **Consistent formatting** — use an auto-formatter like StyLua (@tooling).
- **Comments explain why**, not what.
- **No magic numbers** — name them as constants or put them in config.
- **One responsibility per module and function.**
- **Strict typing** on module boundaries.
- **Delete dead code** — version control remembers it for you.

## Code review checklist

Before you call a feature done, check:

:::steps
1. **Security** — is every remote validated? Does the server own every important decision?
2. **Cleanup** — are connections, threads and Instances cleaned up? Per-player data removed on leave?
3. **Failure** — what happens if a data store call, teleport or HTTP request fails?
4. **Edge cases** — player leaves mid-action, character respawns, two players at once, zero items.
5. **Performance** — anything heavy every frame? Any polling that should be an event?
6. **Readability** — would a teammate understand this in six months?
:::

:::quiz Patterns
? What problem does a Trove/Maid solve?
+ Reliably cleaning up connections, Instances, threads and objects in one call
- Saving data
- Making code run in parallel
- Filtering text
> Collect resources as you create them; clean them all together.

? What's the main benefit of data-driven design?
+ Adding or balancing content means editing data, not writing new code paths
- It makes code run faster
- It removes the need for types
- It hides code from exploiters
> One system interprets many data definitions.

? How should a quest system learn that an enemy died?
+ Subscribe to a signal the combat system fires
- Edit the combat code to call the quest system directly
- Poll every enemy every frame
- Use `_G`
> The observer pattern keeps systems decoupled.

? What does dependency injection improve?
+ Testability and flexibility, by passing dependencies in
- Network performance
- Rendering quality
- Data store limits
> Code that receives dependencies can be given fakes in tests.

? Which name best follows conventions for a boolean?
+ `canAfford`
- `afford`
- `AFFORD`
- `affordFlag2`
> Booleans read naturally with `is/has/can/should` prefixes.
:::

## Challenges

:::challenge medium | Ability with a Trove
Write an `Ability` class for a temporary "Shield" power-up: when activated on a character it adds a `ForceField`, a `Highlight`, changes `WalkSpeed` to 20, starts a thread that prints the remaining seconds, and connects to `Died` to end early. After 8 seconds (or on death) **everything** must be cleaned up and `WalkSpeed` restored — using a Trove.
@solution
```roblox
local Trove = require(game:GetService("ReplicatedStorage").Shared.Trove)

local Shield = {}
Shield.__index = Shield

function Shield.new(character: Model)
	local self = setmetatable({}, Shield)
	local humanoid = character:FindFirstChildOfClass("Humanoid") :: Humanoid
	self._trove = Trove.new()

	local oldSpeed = humanoid.WalkSpeed
	humanoid.WalkSpeed = 20
	self._trove:Add(function()
		if humanoid.Parent then humanoid.WalkSpeed = oldSpeed end
	end)

	self._trove:Add(Instance.new("ForceField")).Parent = character
	self._trove:Add(Instance.new("Highlight")).Parent = character
	self._trove:Connect(humanoid.Died, function()
		self:Destroy()
	end)
	self._trove:Add(task.spawn(function()
		for t = 8, 1, -1 do
			print("Shield:", t)
			task.wait(1)
		end
		self:Destroy()
	end))
	return self
end

function Shield:Destroy()
	self._trove:Clean()
end

return Shield
```
Note the ordering subtlety: `Destroy` called from inside the timer thread cancels that same thread last (items are cleaned in reverse), and `pcall(task.cancel, ...)` keeps that safe.
:::

:::challenge medium | Refactor to data
Refactor this into a data table plus one function, and add a fourth enemy type without touching the function:

```roblox
local function spawnEnemy(kind)
	local e = Instance.new("Part")
	if kind == "Slime" then
		e.Color = Color3.fromRGB(90, 220, 90); e.Size = Vector3.new(3, 3, 3); e:SetAttribute("HP", 30)
	elseif kind == "Golem" then
		e.Color = Color3.fromRGB(120, 120, 120); e.Size = Vector3.new(6, 8, 6); e:SetAttribute("HP", 200)
	elseif kind == "Bat" then
		e.Color = Color3.fromRGB(60, 40, 80); e.Size = Vector3.new(2, 1, 2); e:SetAttribute("HP", 15)
	end
	e.Parent = workspace
	return e
end
```
@solution
```roblox
local ENEMIES = table.freeze({
	Slime = { color = Color3.fromRGB(90, 220, 90), size = Vector3.new(3, 3, 3), hp = 30 },
	Golem = { color = Color3.fromRGB(120, 120, 120), size = Vector3.new(6, 8, 6), hp = 200 },
	Bat = { color = Color3.fromRGB(60, 40, 80), size = Vector3.new(2, 1, 2), hp = 15 },
	Wraith = { color = Color3.fromRGB(200, 220, 255), size = Vector3.new(3, 6, 3), hp = 80 },
})

local function spawnEnemy(kind: string): BasePart?
	local def = ENEMIES[kind]
	if not def then
		warn("Unknown enemy kind:", kind)
		return nil
	end
	local e = Instance.new("Part")
	e.Name = kind
	e.Color = def.color
	e.Size = def.size
	e:SetAttribute("HP", def.hp)
	e.Parent = workspace
	return e
end
```
:::

:::recap
- Use a **Trove/Maid** to clean up everything an object creates.
- **State machines** organize NPCs and game flow.
- **Data-driven design** turns content into configuration.
- **Signals** (observer pattern) decouple systems; **dependency injection** makes code testable.
- Guard clauses, small functions, consistent naming and formatting keep code readable.
- Review every feature for security, cleanup, failure handling, edge cases and performance.
:::
