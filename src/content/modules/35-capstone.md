---
id: capstone
title: Capstone: Build Coin Rush
part: 6
summary: Put it all together — build a complete, secure, saving, monetizable coin-collecting game with services, tags, remotes, data stores, a shop, UI, effects and a game pass.
time: 3 hours
level: Advanced
objectives:
- Plan a game's architecture before writing code
- Combine services, tags, remotes, data, UI and effects into one product
- Keep every important decision on the server
- Ship a polished, tested game you can publish and keep improving
---

Time to build a real game from start to finish. **Coin Rush** is simple to play — run around collecting coins, spend them on upgrades — but building it properly touches almost every module in this course. Work through the milestones in order; each one is a challenge you can check off.

:::info How to use this capstone
Each milestone explains the goal and shows the key code. Try writing each piece yourself first, using the description and the hints, then compare with the reference. Your version doesn't have to match — it has to be **secure, clean and working**.
:::

## The design

- Coins spawn at tagged spawn points around the map. Touching a coin collects it; it respawns after a delay.
- Coins are worth 1 (common), 5 (rare) or 25 (legendary).
- Players spend coins on **Speed** upgrades (5 levels) in a shop.
- A **2× Coins** game pass doubles earnings.
- Every 5 minutes a 60-second **Gold Rush** event doubles coin values for everyone.
- Coins and upgrades **save** between sessions.
- Clients get a coin counter, a shop menu, and satisfying collection feedback.

## Architecture

:::tree Coin Rush
ReplicatedStorage
  Shared (Folder)
    Config (ModuleScript) # all tunable numbers
    Remotes (ModuleScript) # creates/gets remotes by name
    Trove (ModuleScript)
ServerScriptService
  Main (Script) # loads services: Init, then Start
  Services (Folder)
    DataService (ModuleScript) # session data, saving
    CoinService (ModuleScript) # spawning and collection
    ShopService (ModuleScript) # upgrades
    PassService (ModuleScript) # 2x pass
    EventService (ModuleScript) # Gold Rush
ServerStorage
  CoinTemplate (Part)
StarterGui
  HUD (ScreenGui)
    HUDController (LocalScript)
Workspace
  CoinSpawns (Folder) # parts tagged CoinSpawn
:::

Notice the shape: **one Script, many services** (@modules), shared config and remotes, client code only for presentation.

## Milestone 1 — Config and remotes

:::challenge easy | Shared foundations
Create the `Config` module (coin values and weights, respawn time, speed upgrade prices and speeds, event timing, pass ID) and the `Remotes` module from @remotes with: `CoinCollected` (server → client, for effects), `BuyUpgrade` (RemoteFunction) and `EventChanged` (server → all).
@solution
```roblox title="ReplicatedStorage › Shared › Config"
return table.freeze({
	COIN_RESPAWN = 8,
	COIN_KINDS = table.freeze({
		{ name = "Common", value = 1, weight = 80, color = Color3.fromRGB(255, 200, 50) },
		{ name = "Rare", value = 5, weight = 17, color = Color3.fromRGB(80, 200, 255) },
		{ name = "Legendary", value = 25, weight = 3, color = Color3.fromRGB(220, 90, 255) },
	}),
	SPEED_LEVELS = table.freeze({
		{ speed = 16, price = 0 },
		{ speed = 19, price = 50 },
		{ speed = 22, price = 150 },
		{ speed = 25, price = 400 },
		{ speed = 28, price = 1000 },
	}),
	EVENT_EVERY = 300,
	EVENT_LENGTH = 60,
	DOUBLE_COINS_PASS = 0, -- put your game pass ID here
})
```
```roblox title="ReplicatedStorage › Shared › Remotes"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local folder: Folder
if RunService:IsServer() then
	folder = Instance.new("Folder")
	folder.Name = "RemoteInstances"
	folder.Parent = ReplicatedStorage
else
	folder = ReplicatedStorage:WaitForChild("RemoteInstances") :: Folder
end

local function get(className: string, name: string): any
	if RunService:IsServer() then
		local r = Instance.new(className)
		r.Name = name
		r.Parent = folder
		return r
	end
	return folder:WaitForChild(name)
end

return {
	CoinCollected = get("RemoteEvent", "CoinCollected") :: RemoteEvent,
	BuyUpgrade = get("RemoteFunction", "BuyUpgrade") :: RemoteFunction,
	EventChanged = get("RemoteEvent", "EventChanged") :: RemoteEvent,
}
```
:::

## Milestone 2 — Data

:::challenge medium | DataService
Adapt the `DataService` from @datastores with this template: `{ version = 1, coins = 0, speedLevel = 1 }`. Add two functions other services use: `DataService.get(player)` and `DataService.addCoins(player, amount)`, which updates the session **and** a `Coins` leaderstat. Also expose a `Loaded` signal (BindableEvent or Signal) that fires `(player, data)` once a player's data is ready, so other services can react (e.g. apply speed).
@hint
Create the leaderstats inside your `load` function after the data is ready, then fire `Loaded`.
@solution
```roblox title="Services › DataService (key additions)"
local loadedEvent = Instance.new("BindableEvent")
DataService.Loaded = loadedEvent.Event

-- at the end of load(player), after sessions[player] is set:
local leaderstats = Instance.new("Folder")
leaderstats.Name = "leaderstats"
local coins = Instance.new("IntValue")
coins.Name = "Coins"
coins.Value = sessions[player].coins
coins.Parent = leaderstats
leaderstats.Parent = player
loadedEvent:Fire(player, sessions[player])

function DataService.addCoins(player: Player, amount: number)
	local data = sessions[player]
	if not data then return end
	data.coins += amount
	local ls = player:FindFirstChild("leaderstats")
	local c = ls and ls:FindFirstChild("Coins") :: IntValue?
	if c then c.Value = data.coins end
end
```
Everything else — retries, never saving after a failed load, autosave and `BindToClose` — comes straight from the DataService in @datastores.
:::

## Milestone 3 — Coins

:::challenge hard | CoinService
Spawn a coin at every part tagged `CoinSpawn` using weighted random kinds from Config. Collection must be **server-authoritative**: on `Touched`, find the player, make sure the coin is still active (so it can't be collected twice), and that the player's root part is within 8 studs of the coin. Award `value × multipliers` (2× pass attribute, Gold Rush event), hide the coin, fire `CoinCollected` to that player with the coin's position and value for effects, and respawn after `COIN_RESPAWN` seconds.
@hint
Store per-coin state in a table keyed by the coin part: `{ active = true, value = 5 }`. The `active` flag is your debounce.
@hint
Ask other services for multipliers through functions (`EventService.isActive()`), required lazily in `Init` to avoid circular requires.
@solution
```roblox title="Services › CoinService"
local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local CoinService = {}
local DataService, EventService
local coins: {[BasePart]: { active: boolean, value: number }} = {}

local totalWeight = 0
for _, kind in Config.COIN_KINDS do totalWeight += kind.weight end

local function rollKind()
	local roll = math.random() * totalWeight
	for _, kind in Config.COIN_KINDS do
		roll -= kind.weight
		if roll < 0 then return kind end
	end
	return Config.COIN_KINDS[1]
end

local function activate(coin: BasePart)
	local kind = rollKind()
	coins[coin] = { active = true, value = kind.value }
	coin.Color = kind.color
	coin.Transparency = 0
	coin.CanTouch = true
end

local function onTouched(coin: BasePart, hit: BasePart)
	local state = coins[coin]
	if not state or not state.active then return end
	local character = hit:FindFirstAncestorOfClass("Model")
	local player = character and Players:GetPlayerFromCharacter(character)
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not player or not root then return end
	if (root.Position - coin.Position).Magnitude > 8 then return end

	state.active = false
	coin.Transparency = 1
	coin.CanTouch = false

	local multiplier = 1
	if player:GetAttribute("DoubleCoins") then multiplier *= 2 end
	if EventService.isActive() then multiplier *= 2 end
	local amount = state.value * multiplier

	DataService.addCoins(player, amount)
	Remotes.CoinCollected:FireClient(player, coin.Position, amount)

	task.delay(Config.COIN_RESPAWN, function()
		if coin.Parent then activate(coin) end
	end)
end

local function createCoinAt(spawnPart: BasePart)
	local coin = ServerStorage.CoinTemplate:Clone() :: BasePart
	coin.Anchored = true
	coin.CanCollide = false
	coin.Position = spawnPart.Position + Vector3.new(0, 3, 0)
	coin.Parent = workspace
	coin.Touched:Connect(function(hit) onTouched(coin, hit) end)
	activate(coin)
end

function CoinService.Init()
	DataService = require(script.Parent.DataService)
	EventService = require(script.Parent.EventService)
end

function CoinService.Start()
	for _, spawnPart in CollectionService:GetTagged("CoinSpawn") do
		createCoinAt(spawnPart :: BasePart)
	end
	CollectionService:GetInstanceAddedSignal("CoinSpawn"):Connect(function(p)
		createCoinAt(p :: BasePart)
	end)
end

return CoinService
```
:::

## Milestone 4 — Shop and pass

:::challenge medium | ShopService and PassService
**ShopService:** handle `BuyUpgrade.OnServerInvoke(player)` — validate the player's data is loaded, that there's a next level, and that they can afford it; deduct coins, increase `speedLevel`, apply the new `WalkSpeed` to their current character, and return `true, newLevel` or `false, reason`. Re-apply speed on every spawn and when data loads.

**PassService:** check the 2× pass on join and on purchase, setting the `DoubleCoins` attribute (see @monetization).
@solution
```roblox title="Services › ShopService"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local ShopService = {}
local DataService

local function applySpeed(player: Player)
	local data = DataService.get(player)
	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if data and humanoid then
		humanoid.WalkSpeed = Config.SPEED_LEVELS[data.speedLevel].speed
	end
end

function ShopService.Init()
	DataService = require(script.Parent.DataService)
end

function ShopService.Start()
	DataService.Loaded:Connect(function(player)
		applySpeed(player)
		player.CharacterAdded:Connect(function(character)
			character:WaitForChild("Humanoid")
			applySpeed(player)
		end)
	end)

	Remotes.BuyUpgrade.OnServerInvoke = function(player)
		local data = DataService.get(player)
		if not data then return false, "Still loading" end
		local nextLevel = Config.SPEED_LEVELS[data.speedLevel + 1]
		if not nextLevel then return false, "Max level" end
		if data.coins < nextLevel.price then
			return false, `Need {nextLevel.price - data.coins} more coins`
		end
		DataService.addCoins(player, -nextLevel.price)
		data.speedLevel += 1
		applySpeed(player)
		return true, data.speedLevel
	end
end

return ShopService
```
The client never sends a price or a level — only "I'd like the next upgrade". The server knows the rest.
:::

## Milestone 5 — Gold Rush

:::challenge medium | EventService
Every `EVENT_EVERY` seconds, start a Gold Rush lasting `EVENT_LENGTH` seconds. Expose `EventService.isActive()`, set an attribute `GoldRush` on `ReplicatedStorage` (so clients can show a banner), and fire `EventChanged` to all clients when it starts and ends.
@solution
```roblox title="Services › EventService"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local EventService = {}
local active = false

function EventService.isActive(): boolean
	return active
end

local function setActive(value: boolean)
	active = value
	ReplicatedStorage:SetAttribute("GoldRush", value)
	Remotes.EventChanged:FireAllClients(value)
end

function EventService.Start()
	while true do
		task.wait(Config.EVENT_EVERY)
		setActive(true)
		task.wait(Config.EVENT_LENGTH)
		setActive(false)
	end
end

return EventService
```
:::

## Milestone 6 — The client

:::challenge hard | HUD, shop button and juice
Write `HUDController`:

1. A coin counter that updates from the `Coins` leaderstat and "pops" (UIScale tween) on change.
2. A Speed upgrade button that calls `BuyUpgrade`, shows "Buying…" while waiting, then the result.
3. On `CoinCollected`, play a sound and show a floating `+5` BillboardGui at the coin's position that rises and fades.
4. A banner that appears while the `GoldRush` attribute is true.
@solution
```roblox title="StarterGui › HUD › HUDController"
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local player = Players.LocalPlayer
local gui = script.Parent
local counter = gui:WaitForChild("Coins") :: TextLabel
local upgrade = gui:WaitForChild("Upgrade") :: TextButton
local banner = gui:WaitForChild("GoldRushBanner") :: TextLabel
local pickupSound = gui:WaitForChild("Pickup") :: Sound

-- 1. Counter with pop
local scale = Instance.new("UIScale")
scale.Parent = counter
local coins = player:WaitForChild("leaderstats"):WaitForChild("Coins") :: IntValue
local function renderCoins()
	counter.Text = `🪙 {coins.Value}`
	scale.Scale = 1.2
	TweenService:Create(scale, TweenInfo.new(0.25, Enum.EasingStyle.Back), { Scale = 1 }):Play()
end
coins.Changed:Connect(renderCoins)
renderCoins()

-- 2. Upgrade button
local busy = false
upgrade.Activated:Connect(function()
	if busy then return end
	busy = true
	upgrade.Text = "Buying…"
	local ok, result = Remotes.BuyUpgrade:InvokeServer()
	upgrade.Text = if ok then `Speed level {result}!` else tostring(result)
	task.wait(1.5)
	upgrade.Text = "Upgrade Speed"
	busy = false
end)

-- 3. Collection feedback
Remotes.CoinCollected.OnClientEvent:Connect(function(position: Vector3, amount: number)
	pickupSound:Play()
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Position = position
	anchor.Parent = workspace

	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.fromOffset(100, 40)
	billboard.AlwaysOnTop = true
	billboard.Parent = anchor
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = `+{amount}`
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(255, 215, 60)
	label.Font = Enum.Font.GothamBold
	label.Parent = billboard

	TweenService:Create(anchor, TweenInfo.new(0.8), { Position = position + Vector3.new(0, 4, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(0.8), { TextTransparency = 1 }):Play()
	Debris:AddItem(anchor, 1)
end)

-- 4. Gold Rush banner
local function renderBanner()
	banner.Visible = ReplicatedStorage:GetAttribute("GoldRush") == true
end
ReplicatedStorage:GetAttributeChangedSignal("GoldRush"):Connect(renderBanner)
renderBanner()
```
All of this is presentation. If an exploiter deletes the HUD, fires `BuyUpgrade` a thousand times, or fakes `CoinCollected` on their own client, nothing changes on the server.
:::

## Milestone 7 — Ship it

:::challenge boss | Launch checklist
Finish the game and verify every item:

- [ ] Tested with **Test → Clients and Servers** with 2–3 players
- [ ] Data saves and loads correctly; nothing is saved after a failed load
- [ ] Every remote is validated; no client-supplied prices, values or levels
- [ ] Per-player tables are cleaned up on `PlayerRemoving`
- [ ] Works on phone (Device Emulator), PC and gamepad
- [ ] Script Analysis shows no errors or warnings; scripts use `--!strict`
- [ ] Performance is smooth (check the MicroProfiler and memory over 10 minutes)
- [ ] Game pass works when bought in-game and after rejoining
- [ ] Icon, thumbnails, description and age/maturity questionnaire completed
- [ ] Published, and you've played it on a real device

Then pick at least **two** extensions and build them: a global leaderboard (@datastores), daily rewards (@stdlib), NPC coin thieves (@npcs), a coin magnet upgrade (@raycasting), a developer product coin pack (@monetization), or badges (@services).
@solution
There's no single solution to a launch — this one is yours. Compare your checklist with the recaps of @security, @performance, @datastores and @patterns, and keep iterating after release: watch your analytics and player feedback, fix bugs fast, and ship small updates often.
:::

## Where to go from here

You've covered the whole path: the Luau language, the Roblox engine, gameplay systems, data and monetization, security, performance and professional workflows. From here, the best teacher is building:

- **Make small, complete games.** Finishing teaches more than starting.
- **Read the official docs** at [create.roblox.com](https://create.roblox.com/docs) and [luau.org](https://luau.org) — you now have the background to understand everything there.
- **Read other people's code** — open-source Roblox projects and community libraries are full of ideas.
- **Join the community** (the Roblox Developer Forum and creator communities), share what you build, and ask good questions.
- **Come back to modules** when you need them — use the search (++Ctrl+K++) and the cheat sheet.

:::recap Course complete
- You can write clean, typed Luau: tables, functions, closures, metatables, OOP, coroutines, error handling.
- You understand the client-server model and build secure systems with validated remotes.
- You can build worlds and gameplay: CFrames, physics, raycasts, tweens, animation, UI, input, cameras and AI.
- You can save data safely, monetize fairly, and use the services live games depend on.
- You know how to optimize, structure, test and ship like a professional.

Mark this module complete and claim your certificate — you've earned it.
:::
