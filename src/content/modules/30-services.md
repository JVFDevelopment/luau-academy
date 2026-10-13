---
id: services
title: Essential Services Tour
part: 5
summary: The services behind live games — CollectionService components, HttpService, TextService filtering, TeleportService, MessagingService, MemoryStoreService, BadgeService, sounds, lighting, teams and more.
time: 45 min
level: Intermediate
objectives:
- Build tag-driven components with CollectionService
- Encode JSON, generate IDs and call web APIs with HttpService
- Filter player-written text with TextService
- Teleport players and share data across servers
- Award badges, play sounds and control lighting
---

You've met the core services. This module tours the rest of the toolbox you'll reach for when building real, live games.

## CollectionService: components

Tags (@instances) become truly powerful with the **component pattern**: one module that "binds" behavior to every Instance with a tag — including ones added later — and cleans up when they're removed.

```roblox title="ServerScriptService › Spinners"
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local active: {[BasePart]: boolean} = {}

local function onAdded(part: Instance)
	if part:IsA("BasePart") then
		active[part] = true
	end
end

local function onRemoved(part: Instance)
	active[part :: BasePart] = nil
end

CollectionService:GetInstanceAddedSignal("Spinner"):Connect(onAdded)
CollectionService:GetInstanceRemovedSignal("Spinner"):Connect(onRemoved)
for _, part in CollectionService:GetTagged("Spinner") do
	onAdded(part)
end

RunService.Heartbeat:Connect(function(dt)
	for part in active do
		part.CFrame *= CFrame.Angles(0, dt * 2, 0)
	end
end)
```

Tag any part `Spinner` in Studio — or at runtime with `part:AddTag("Spinner")` — and it spins. Removing the tag or destroying the part stops it. Level designers can now add behavior without touching code, and you have **one** script instead of hundreds of copies.

## HttpService

```roblox
local HttpService = game:GetService("HttpService")

local json = HttpService:JSONEncode({ name = "Koala", level = 12 })
local data = HttpService:JSONDecode(json)
local id = HttpService:GenerateGUID(false)   -- e.g. "8f3a...": unique IDs for items/trades
```

To call external web APIs (your own backend, Discord webhooks via a proxy, analytics), enable **Allow HTTP Requests** in Game Settings → Security, then use `HttpService:RequestAsync({ Url = ..., Method = "POST", Headers = ..., Body = ... })` from the **server**, wrapped in `pcall`. You can't call roblox.com endpoints directly, and requests are rate-limited. Keep API keys on the server (Roblox also offers a **Secrets** store for this).

## TextService: filtering

**Any text written by a player that other players can see must be filtered** — custom chat, pet names, sign text, guild names. This is a Roblox rule, and games get moderated for breaking it.

```roblox
local TextService = game:GetService("TextService")

local function filterForEveryone(text: string, fromPlayer: Player): string?
	local ok, result = pcall(function()
		local filtered = TextService:FilterStringAsync(text, fromPlayer.UserId)
		return filtered:GetNonChatStringForBroadcastAsync()
	end)
	return if ok then result else nil   -- on failure, don't show the text
end
```

Filter on the **server**, show only the filtered result, and if filtering fails, show nothing. The built-in chat (`TextChatService`) filters automatically; you only need this for your own text features.

## TeleportService

Move players to another place in your experience (a lobby → match setup is the classic case):

```roblox
local TeleportService = game:GetService("TeleportService")

local options = Instance.new("TeleportOptions")
options.ShouldReserveServer = true          -- a private server just for this group
options:SetTeleportData({ mode = "Ranked" }) -- small, non-secret data

local ok, err = pcall(function()
	return TeleportService:TeleportAsync(MATCH_PLACE_ID, playersInMatch, options)
end)
```

Teleports can fail — handle `TeleportInitFailed` and retry. Teleport data arrives on the destination via `player:GetJoinData()`; treat it as untrusted, and never use it for anything valuable (save important state in data stores instead).

## Cross-server communication

| Service | Use it for |
| --- | --- |
| `MessagingService` | Broadcasting messages to all servers: global announcements, cross-server events, shutting down for updates (`PublishAsync`, `SubscribeAsync`) |
| `MemoryStoreService` | Fast, temporary shared data with expiration: matchmaking **queues**, live **sorted maps** (event leaderboards), **hash maps** for session info |

```roblox
local MessagingService = game:GetService("MessagingService")

MessagingService:SubscribeAsync("Announcements", function(message)
	print("Global message:", message.Data)
end)

MessagingService:PublishAsync("Announcements", "Double XP weekend has started!")
```

Both are rate-limited and best-effort — design for occasional delays or failures (always `pcall`).

## BadgeService

```roblox
local BadgeService = game:GetService("BadgeService")
local FIRST_WIN_BADGE = 2124000000

local function awardBadge(player: Player, badgeId: number)
	local ok, has = pcall(BadgeService.UserHasBadgeAsync, BadgeService, player.UserId, badgeId)
	if ok and not has then
		pcall(BadgeService.AwardBadge, BadgeService, player.UserId, badgeId)
	end
end
```

Badges are awarded from the server and are a great, free way to mark achievements.

## Sound, lighting and atmosphere

```roblox
local sound = Instance.new("Sound")
sound.SoundId = "rbxassetid://YOUR_SOUND_ID"
sound.Volume = 0.6
sound.Parent = workspace.Speaker   -- inside a part: 3D positional audio
sound:Play()

local Lighting = game:GetService("Lighting")
Lighting.ClockTime = 18.5          -- sunset
Lighting.Brightness = 2
```

- A `Sound` inside a **part** plays positionally; inside `SoundService` or the player's UI it plays globally. Use `SoundGroup`s for volume categories (music, SFX), and `Looped`, `PlaybackSpeed` and `Ended` for control. Roblox also has a newer, more modular audio API (`AudioPlayer`, `AudioEmitter`, wires) for advanced mixing.
- Play **UI and feedback sounds on the client**; play world sounds everyone should hear on the server (or tell clients to play them).
- `Lighting` children like `Atmosphere`, `Sky`, `Bloom`, `ColorCorrectionEffect` and `DepthOfField` set the mood.

## A few more worth knowing

| Service | Purpose |
| --- | --- |
| `Teams` | Team objects and auto-assignment |
| `Debris` | Destroy objects after a delay |
| `PolicyService` | Regional/age policy checks (paid random items, social links) |
| `SocialService` | Invite prompts (`PromptGameInvite`) |
| `LocalizationService` | Translate your game for other languages |
| `GroupService` / `player:GetRankInGroup(id)` | Group-based perks and permissions |
| `AssetService` / `InsertService` | Working with assets at runtime |
| `ContentProvider` | `PreloadAsync` assets during a loading screen |
| `StarterGui` (client) | `SetCoreGuiEnabled` to hide default UI; `SetCore("SendNotification", ...)` |

:::quiz Services
? What does the component pattern with CollectionService give you?
+ One script that adds behavior to every tagged Instance, including ones added later
- Faster physics
- Automatic data saving
- Cross-server messaging
> GetTagged + InstanceAdded/Removed signals bind and unbind behavior.

? A player names their pet. What must happen before other players see the name?
+ It must be filtered with TextService on the server
- It must be saved to a data store
- Nothing — names are safe
- It must be converted to JSON
> Player-written text visible to others must be filtered.

? Which service broadcasts a message to every server of your game?
+ MessagingService
- HttpService
- TeleportService
- BadgeService
> PublishAsync/SubscribeAsync work across servers.

? Where should teleport data that grants items be trusted?
- Always, it's secure
+ Never — use data stores for anything valuable
- Only on the client
- Only in reserved servers
> Teleport data can be tampered with.

? Where should a UI click sound usually be played?
+ On the client
- On the server for everyone
- In ServerStorage
- Through HttpService
> Local feedback belongs on the client.
:::

## Challenges

:::challenge medium | Tag-driven pickups
Create a component for the tag `Pickup`. Each tagged part has a `Value` attribute. When a player touches it: award that many coins (with a per-player debounce), hide it (`Transparency = 1`, `CanTouch = false`), and respawn it after 10 seconds. It must work for pickups tagged at runtime, and clean up when a pickup is destroyed.
@solution
```roblox title="ServerScriptService › Pickups"
local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")

local connections: {[Instance]: RBXScriptConnection} = {}

local function award(player: Player, amount: number)
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if coins then coins.Value += amount end
end

local function onAdded(pickup: Instance)
	if not pickup:IsA("BasePart") then return end
	local available = true
	connections[pickup] = pickup.Touched:Connect(function(hit)
		if not available then return end
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		if not player then return end

		available = false
		award(player, pickup:GetAttribute("Value") or 1)
		pickup.Transparency = 1
		pickup.CanTouch = false
		task.delay(10, function()
			if pickup.Parent then
				pickup.Transparency = 0
				pickup.CanTouch = true
				available = true
			end
		end)
	end)
end

local function onRemoved(pickup: Instance)
	local c = connections[pickup]
	if c then
		c:Disconnect()
		connections[pickup] = nil
	end
end

CollectionService:GetInstanceAddedSignal("Pickup"):Connect(onAdded)
CollectionService:GetInstanceRemovedSignal("Pickup"):Connect(onRemoved)
for _, p in CollectionService:GetTagged("Pickup") do onAdded(p) end
```
The `available` flag acts as the debounce: the pickup can only be collected once until it respawns.
:::

:::challenge medium | Filtered sign
Make a sign with a SurfaceGui. A RemoteEvent lets a player submit text (max 60 characters). The server validates type and length, filters it with TextService for broadcast, and displays it — or shows nothing if filtering fails. Add a 10-second per-player cooldown.
@solution
```roblox title="ServerScriptService › Sign"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextService = game:GetService("TextService")

local remote = ReplicatedStorage:WaitForChild("SetSignText") :: RemoteEvent
local label = workspace.Sign.SurfaceGui.TextLabel :: TextLabel
local last: {[Player]: number} = {}

remote.OnServerEvent:Connect(function(player, text)
	if typeof(text) ~= "string" or #text == 0 or utf8.len(text) == nil or utf8.len(text) > 60 then
		return
	end
	local now = os.clock()
	if last[player] and now - last[player] < 10 then return end
	last[player] = now

	local ok, filtered = pcall(function()
		return TextService:FilterStringAsync(text, player.UserId):GetNonChatStringForBroadcastAsync()
	end)
	if ok then
		label.Text = filtered
	end
end)

game:GetService("Players").PlayerRemoving:Connect(function(p) last[p] = nil end)
```
:::

:::recap
- CollectionService components: `GetTagged` + `GetInstanceAddedSignal`/`RemovedSignal` → one script, many objects.
- HttpService: JSON, GUIDs, server-side web requests (enable in settings).
- **Filter all player-written text** shown to others with TextService.
- TeleportService moves players between places; MessagingService and MemoryStoreService work across servers.
- BadgeService for achievements; Sounds and Lighting for atmosphere; play local feedback on the client.
:::
