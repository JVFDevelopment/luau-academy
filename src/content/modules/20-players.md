---
id: players
title: Players, Characters & Humanoids
part: 3
summary: Work with the Players service, leaderstats, characters, Humanoids, health, movement, respawning, tools and teams — the building blocks of every Roblox game.
time: 40 min
level: Beginner
objectives:
- Handle players joining and leaving reliably
- Create leaderstats that show on the player list
- Navigate a character model and its Humanoid
- Control health, damage, speed and jumping
- Handle death and respawning, and give players tools
- Use teams
---

## The Players service

Every connected person has a **Player** object inside `Players`. Useful members:

| Member | Meaning |
| --- | --- |
| `player.Name` / `player.DisplayName` | Username / chosen display name |
| `player.UserId` | Permanent unique number — use this as a **data key**, never the name (names can change) |
| `player.Character` | Their current character model, or `nil` |
| `player.Team` | Their team, if any |
| `player:Kick(message)` | Remove them from the server |
| `Players:GetPlayers()` | Array of everyone currently in the server |
| `Players:GetPlayerFromCharacter(model)` | The Player owning a character, or `nil` (e.g. NPCs) |
| `Players.LocalPlayer` | **Client only:** the player on this device |

```roblox
local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
	print(`{player.DisplayName} (@{player.Name}, {player.UserId}) joined`)
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	print(player.Name .. " left")  -- save their data here (see @datastores)
end)
```

## Leaderstats

Roblox shows a player-list column for every value inside a folder named exactly **`leaderstats`** under the Player:

```roblox
Players.PlayerAdded:Connect(function(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"   -- must be exactly this

	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = 0
	coins.Parent = leaderstats

	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Value = 1
	level.Parent = leaderstats

	leaderstats.Parent = player
end)
```

Change values **on the server** (`coins.Value += 10`) and everyone's player list updates. Leaderstats are display — your real source of truth for saved data usually lives in a server-side table (@datastores).

## The character

When a player spawns, Roblox builds a **character** Model in the Workspace and sets `player.Character`:

:::tree A typical R15 character
Koala (Model)
  Humanoid (Humanoid) # health, movement, state
    Animator (Animator)
  HumanoidRootPart (Part) # invisible root; position the character with this
  Head (MeshPart)
  UpperTorso (MeshPart)
  LeftFoot (MeshPart) # ...and 12 more body parts
  Shirt (Shirt)
  Hat (Accessory)
:::

Characters respawn, so **never store a character once and assume it lasts**. Handle every spawn:

```roblox
local function onCharacterAdded(character: Model)
	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	local root = character:WaitForChild("HumanoidRootPart") :: BasePart
	print("Spawned at", root.Position)
end

player.CharacterAdded:Connect(onCharacterAdded)
if player.Character then
	task.spawn(onCharacterAdded, player.Character)
end
```

On the client, the common one-liner is `local character = player.Character or player.CharacterAdded:Wait()`.

To teleport a character, move the whole model: `character:PivotTo(CFrame.new(0, 10, 0))`.

## The Humanoid

| Property / method | Purpose |
| --- | --- |
| `Health`, `MaxHealth` | Current and max health (default 100) |
| `humanoid:TakeDamage(n)` | Reduce health — **respects ForceFields** (spawn protection) |
| `WalkSpeed` | Movement speed (default 16) |
| `JumpPower` / `JumpHeight` | Jump strength; which one applies depends on `UseJumpPower` |
| `MoveDirection` | Where the player is trying to move (read-only) |
| `FloorMaterial` | The material they're standing on |
| `humanoid:MoveTo(position)` | Walk toward a point (mostly for NPCs — @npcs) |
| `humanoid:ChangeState(state)` / `GetState()` | Humanoid state machine (jumping, freefall, ragdoll...) |
| `Died` event | Fires once when health reaches 0 |
| `HealthChanged` event | New health value |

```roblox
humanoid.WalkSpeed = 24                     -- sprint
humanoid:TakeDamage(25)
humanoid.Health = math.min(humanoid.Health + 50, humanoid.MaxHealth)  -- heal

humanoid.Died:Connect(function()
	print(player.Name .. " was defeated")
end)
```

:::info Who should change these?
Change health, speed and damage **on the server** for anything that matters to fairness. A LocalScript *can* change its own character's `WalkSpeed` (and it will even appear to work, since the client controls its own movement) — which is exactly why exploiters can speed-hack. Server-side checks are covered in @security.
:::

## Respawning

- `Players.RespawnTime` sets the delay before automatic respawn (default 5 seconds).
- Set `Players.CharacterAutoLoads = false` to control spawning yourself, then call `player:LoadCharacter()` (server) when you want them to spawn — useful for lobbies and rounds.
- `SpawnLocation` parts decide where characters appear; their `TeamColor`/`Neutral` properties control which teams can use them.

## Tools

A **Tool** in a player's `Backpack` appears in their hotbar; equipping it moves it into the character. By default it needs a part named `Handle`.

```roblox
local ServerStorage = game:GetService("ServerStorage")

local function giveSword(player: Player)
	local sword = ServerStorage.Tools.Sword:Clone()
	sword.Parent = player.Backpack
end
```

Tool events: `Equipped`, `Unequipped`, `Activated` (click/tap while equipped). Since `Activated` fires on whichever side the script runs, combat tools typically detect input on the client and send an intent to the server (see @remotes). Items in `StarterPack` are given automatically on every spawn.

## Teams

Add `Team` objects to the `Teams` service (each with a unique `TeamColor`), then assign `player.Team = redTeam`. `team:GetPlayers()` lists members, and `player.Neutral`, `Team.AutoAssignable` and spawn locations control the rest.

:::quiz Players & characters
? What should you use as the key for saving a player's data?
- `player.Name`
- `player.DisplayName`
+ `player.UserId`
- `player.Character.Name`
> Names can change; `UserId` is permanent.

? What must the leaderstats folder be named?
+ `leaderstats`
- `Leaderstats`
- `stats`
- Anything, as long as it's a Folder
> The name is exact and case-sensitive.

? Why handle `CharacterAdded` instead of grabbing `player.Character` once?
+ Characters are replaced on every respawn
- `player.Character` is always nil on the server
- Characters only exist on the client
- `CharacterAdded` fires faster
> Each respawn creates a new character model.

? What's the difference between `humanoid:TakeDamage(10)` and `humanoid.Health -= 10`?
+ `TakeDamage` respects ForceFields
- `TakeDamage` heals instead
- There's no difference
- `Health -= 10` is not allowed
> Spawn-protection ForceFields block `TakeDamage` but not direct Health changes.

? How do you take full control of when players spawn?
- Delete all SpawnLocations
+ Set `Players.CharacterAutoLoads = false` and call `player:LoadCharacter()`
- Set `RespawnTime` to 0
- Destroy the character in a loop
> Manual spawning is the basis of lobby/round systems.
:::

## Challenges

:::challenge easy | Coins over time
Give every player a `leaderstats` folder with `Coins` (starting at 0). Every 10 seconds, award each player in the server 5 coins. Use the "connect + handle existing players" pattern.
@solution
```roblox title="ServerScriptService › Coins"
local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = leaderstats
	leaderstats.Parent = player
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

while true do
	task.wait(10)
	for _, player in Players:GetPlayers() do
		local leaderstats = player:FindFirstChild("leaderstats")
		local coins = leaderstats and leaderstats:FindFirstChild("Coins")
		if coins then
			coins.Value += 5
		end
	end
end
```
:::

:::challenge medium | Kill tracking
Add `Kills` and `Deaths` leaderstats. When a character dies, increase their `Deaths`. If they were damaged by another player within the last 5 seconds, give that player a `Kill`. Assume your damage code (e.g. a sword) calls a function `tagDamage(victimHumanoid, attackerPlayer)` that you write — store the attacker and time as attributes or in a table.
@hint
`tagDamage` can set `victimHumanoid:SetAttribute("LastAttackerId", attacker.UserId)` and `"LastAttackTime"` to `os.clock()`. On `Died`, read them back and find the attacker with `Players:GetPlayerByUserId`.
@solution
```roblox title="ServerScriptService › KillTracker"
local Players = game:GetService("Players")
local CREDIT_WINDOW = 5

local function stat(player: Player, name: string): IntValue?
	local ls = player:FindFirstChild("leaderstats")
	return ls and ls:FindFirstChild(name) :: IntValue?
end

local function tagDamage(victim: Humanoid, attacker: Player)
	victim:SetAttribute("LastAttackerId", attacker.UserId)
	victim:SetAttribute("LastAttackTime", os.clock())
end

local function onCharacterAdded(player: Player, character: Model)
	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	humanoid.Died:Once(function()
		local deaths = stat(player, "Deaths")
		if deaths then deaths.Value += 1 end

		local attackerId = humanoid:GetAttribute("LastAttackerId")
		local attackTime = humanoid:GetAttribute("LastAttackTime")
		if attackerId and attackTime and os.clock() - attackTime <= CREDIT_WINDOW then
			local attacker = Players:GetPlayerByUserId(attackerId)
			local kills = attacker and stat(attacker, "Kills")
			if kills and attacker ~= player then
				kills.Value += 1
			end
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	for _, name in {"Kills", "Deaths"} do
		local v = Instance.new("IntValue")
		v.Name = name
		v.Parent = ls
	end
	ls.Parent = player

	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
end)

-- Export tagDamage for weapon scripts (e.g. via a ModuleScript or BindableFunction)
return tagDamage
```
In a real project you'd put `tagDamage` in a ModuleScript (a `CombatService`) so weapon code can require it.
:::

:::challenge medium | Lobby spawning
Turn off `CharacterAutoLoads`. Players join without a character and see nothing for 3 seconds; then the server spawns them with `LoadCharacter()`. When they die, wait 3 seconds and respawn them manually — but only if they're still in the game.
@solution
```roblox title="ServerScriptService › Spawning"
local Players = game:GetService("Players")
Players.CharacterAutoLoads = false

local function spawnLater(player: Player, delaySeconds: number)
	task.delay(delaySeconds, function()
		if player.Parent then -- still in the game?
			player:LoadCharacter()
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(character)
		local humanoid = character:WaitForChild("Humanoid") :: Humanoid
		humanoid.Died:Once(function()
			spawnLater(player, 3)
		end)
	end)
	spawnLater(player, 3)
end)
```
:::

:::recap
- Handle `PlayerAdded` (plus existing players) and `PlayerRemoving`. Key data by `UserId`.
- A `leaderstats` folder of Value objects shows on the player list; update it on the server.
- Characters are recreated every spawn — handle `CharacterAdded` and `player.Character`.
- The Humanoid controls health (`TakeDamage`), speed, jumping and state; `Died` fires on death.
- Control spawning with `CharacterAutoLoads` + `LoadCharacter`; give Tools via the Backpack; group players with Teams.
:::
