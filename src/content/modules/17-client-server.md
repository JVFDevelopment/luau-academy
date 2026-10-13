---
id: client-server
title: The Client-Server Model
part: 3
summary: How a Roblox game is split between one authoritative server and every player's device — what replicates, where each script runs, which container holds what, and why you must never trust the client.
time: 40 min
level: Beginner
objectives:
- Describe the roles of the server and the clients
- Know where Scripts, LocalScripts and ModuleScripts run — and `RunContext`
- Choose the right container for every script and asset
- Predict what replicates from server to client (and what doesn't)
- Handle StreamingEnabled and latency correctly
- Adopt the "never trust the client" mindset
---

Every Roblox game is **multiplayer by design**, even if only one person is playing. Understanding how the work is split between the server and each player's device is the single most important architectural idea in Roblox development. It decides where your code goes, what each script can see, and what cheaters can and can't do.

## One server, many clients

When players join a game, Roblox starts a **server** in a data center. Each player's device — PC, phone, tablet, console, VR headset — runs a **client** that connects to that server.

<div class="cs-diagram">
<div class="cs-node cs-client"><b>Client</b><small>Player 1's device</small><ul><li>LocalScripts</li><li>Input, camera, UI, effects</li><li>Fully controlled by the player</li></ul></div>
<div class="cs-link"><span>⇠ replication</span><span>remotes ⇢</span></div>
<div class="cs-node cs-server"><b>Server</b><small>Roblox data center</small><ul><li>Scripts</li><li>Game rules, data, economy</li><li>The single source of truth</li></ul></div>
<div class="cs-link"><span>replication ⇢</span><span>⇠ remotes</span></div>
<div class="cs-node cs-client"><b>Client</b><small>Player 2's device</small><ul><li>LocalScripts</li><li>Input, camera, UI, effects</li><li>Fully controlled by the player</li></ul></div>
</div>

- The **server** is authoritative. It owns the "real" game state: who has how many coins, who's alive, what the round timer says, what gets saved.
- Each **client** shows the game to one player, handles their input, camera and UI, and plays visual and audio effects.
- The server automatically sends ("**replicates**") changes in the world to clients. Clients talk to the server through **RemoteEvents** and **RemoteFunctions** (@remotes).

:::danger The client belongs to the player
Code running on a player's device can be read, modified or replaced by that player using exploit tools. Anything a client says — "I clicked the shop", "I hit that enemy", "I have 9,999,999 coins" — is a *request*, not a fact. The server must decide what actually happens. You'll hear this over and over: **never trust the client.**
:::

## Where scripts run

| Script type | Runs on | Runs when inside… |
| --- | --- | --- |
| **Script** | Server | `Workspace`, `ServerScriptService` (and a few other server-visible places) |
| **LocalScript** | The client that has it | A player's `PlayerScripts`, `PlayerGui`, `Backpack`, their **own character**, or `ReplicatedFirst` |
| **ModuleScript** | Whoever `require`s it | Anywhere both can see it, e.g. `ReplicatedStorage` (or `ServerScriptService` for server-only modules) |

A LocalScript placed directly in `Workspace` or `ReplicatedStorage` does **nothing** — LocalScripts only run in the locations above.

### RunContext

`Script` objects have a **RunContext** property:

- `Legacy` (the default) — runs on the server, following the classic rules above.
- `Server` — always runs on the server.
- `Client` — runs on **clients**, which lets you keep client code in places where a LocalScript wouldn't run, like inside a model in Workspace.

Most projects stick with classic Scripts and LocalScripts in their standard containers. Just know RunContext exists when you see it — and be careful: a RunContext script inside a template you clone will start running in every copy.

### Telling where you are

```roblox
local RunService = game:GetService("RunService")
print(RunService:IsServer(), RunService:IsClient(), RunService:IsStudio())
```

On the client, `Players.LocalPlayer` is the player running that device. On the server it's `nil` — there is no "local" player on a server that serves everyone.

## The containers

Here's where everything belongs in a typical project:

:::tree A well-organized place
game
  Workspace # the 3D world; replicated to clients (streamed)
    Map (Model)
  ReplicatedFirst # loads before anything else on the client
    LoadingScreen (LocalScript)
  ReplicatedStorage # shared code and assets, visible to both
    Modules (Folder)
      Config (ModuleScript)
    Remotes (Folder)
      BuyItem (RemoteEvent)
    Assets (Folder)
  ServerScriptService # server code; clients never see it
    GameManager (Script)
    Services (Folder)
      DataService (ModuleScript)
  ServerStorage # server-only assets; clients never see it
    MapTemplates (Folder)
  StarterGui # copied into each player's PlayerGui
    HUD (ScreenGui)
      HUDController (LocalScript)
  StarterPlayer
    StarterPlayerScripts # copied once into each player's PlayerScripts
      InputController (LocalScript)
    StarterCharacterScripts # copied into each new character
:::

| Container | Server sees it | Clients see it | Scripts run there |
| --- | --- | --- | --- |
| `Workspace` | Yes | Yes (may be streamed in gradually) | Scripts; LocalScripts only in the player's own character |
| `ReplicatedStorage` | Yes | Yes | No — it's storage (ModuleScripts run when required) |
| `ReplicatedFirst` | Yes | Yes, before everything else | LocalScripts |
| `ServerScriptService` | Yes | **No** | Scripts |
| `ServerStorage` | Yes | **No** | No — it's storage |
| `StarterGui` | Yes | Copied to each `PlayerGui` | LocalScripts (once copied) |
| `StarterPlayerScripts` | Yes | Copied to each `PlayerScripts` once | LocalScripts |
| `StarterCharacterScripts` | Yes | Copied into each character on spawn | Scripts and LocalScripts |
| `StarterPack` | Yes | Copied to each `Backpack` on spawn | Tools and their scripts |

:::tip Secrets go on the server side
Anything in `ReplicatedStorage`, `ReplicatedFirst`, `Workspace` or `StarterGui` is sent to every client — including the **source code** of LocalScripts and ModuleScripts there. Exploiters can read it. Keep sensitive logic, admin lists, anti-cheat thresholds and API keys in `ServerScriptService` or `ServerStorage`.
:::

## Replication

### Server → client: automatic

When the server creates, changes or destroys an Instance in a replicated container, that change is sent to every client:

```roblox
-- Server Script
local part = Instance.new("Part")
part.Anchored = true
part.Parent = workspace         -- every client will see this part appear
part.Color = Color3.new(1, 0, 0) -- every client will see it turn red
```

Attributes, property changes, new and destroyed Instances all replicate. This is why the server can simply *change the world* and every player sees the result.

### Client → server: blocked

Changes a client makes to the world **stay on that client**. If a LocalScript deletes a wall, the wall disappears only for that player. The server — and everyone else — still has it.

```roblox
-- LocalScript
workspace.Wall:Destroy()   -- only this player stops seeing the wall
```

This is called *FilteringEnabled*, and it's always on. It's the foundation of Roblox security: a cheater changing their own client can't directly change anyone else's game.

There are a few deliberate exceptions where clients *are* trusted to report changes, because doing otherwise would feel laggy:

- **Their own character's movement and physics** (and any parts the server lets them control — see "network ownership" in @physics).
- **Animations** played through their own character's `Animator`.
- A few character-related details, such as some Humanoid states.

These exceptions are exactly why speed hacks, teleport hacks and fly hacks exist — and why the server should sanity-check character movement in competitive games (@security).

## Client-only effects are a feature

Because client changes don't replicate, the client is the perfect place for things that **only one player should see**: their UI, camera effects, local sounds, highlighting a door they can interact with, a preview of a building piece before they place it.

A good split for most features:

| Responsibility | Where it belongs |
| --- | --- |
| Reading input (keys, taps, clicks) | Client |
| Camera, UI, local sounds, particles for feedback | Client |
| Deciding if an action is allowed | **Server** |
| Changing currency, health, inventory | **Server** |
| Saving data | **Server** |
| Spawning things everyone should see | **Server** (or the server tells all clients to show an effect) |
| Purchases and receipts | **Server** |

## StreamingEnabled

Big worlds don't fit on a phone at once. With **StreamingEnabled** (on by default for new places), the client only receives parts of the Workspace near the player, and streams others in and out as they move.

That has consequences for client code:

- A part far away might **not exist yet** on the client — use `WaitForChild` (or check for `nil`) instead of assuming.
- A part you referenced earlier can be **streamed out**, so don't hold onto Workspace objects on the client and expect them to stay.
- Models can opt into different behavior with `ModelStreamingMode` (for example `Persistent` for things the client must always have).

The server always has the whole world; streaming only affects clients.

## Latency

Messages between client and server take time — often 50–200 ms, sometimes much more. If the client waits for the server's permission before showing *anything*, actions feel sluggish. Professional games combine both sides:

1. The client **immediately** plays feedback (the swing animation, a click sound) — this is *client-side prediction*.
2. The client sends a request to the server.
3. The server **validates** and applies the real result (damage, currency), which then replicates.
4. If the server says no, the client rolls back its prediction.

You'll put this into practice in @remotes and @capstone.

:::quiz Client-server
? Where does a LocalScript placed directly in `ReplicatedStorage` run?
- On every client
- On the server
+ Nowhere — LocalScripts don't run in ReplicatedStorage
- Only in Studio
> LocalScripts run only in PlayerScripts, PlayerGui, Backpack, the player's own character, or ReplicatedFirst.

? A LocalScript sets `workspace.Door.Transparency = 1`. Who sees the door disappear?
+ Only the player whose client ran it
- Everyone
- Only the server
- Nobody — clients can't change properties
> Client changes don't replicate to the server or other players.

? What is `Players.LocalPlayer` on the server?
- The first player who joined
- The game owner
+ `nil`
- An error
> The server serves everyone; there's no local player there.

? Where should a ModuleScript with your anti-cheat thresholds live?
- ReplicatedStorage
- StarterGui
+ ServerScriptService or ServerStorage
- ReplicatedFirst
> Anything replicated can be read by exploiters. Keep sensitive code server-side.

? Which of these does a client legitimately control and replicate?
- Its leaderstats coin value
+ Its own character's movement
- Another player's health
- The round timer
> Character physics are client-owned for responsiveness — which is why movement exploits exist.

? With StreamingEnabled on, why might `workspace.FarAwayTower` error in a LocalScript?
- Streaming deletes parts on the server
+ The tower may not have streamed in to that client yet
- LocalScripts can't access Workspace
- Towers are always persistent
> Clients only receive nearby parts. Wait for or check objects you need.
:::

:::predict Which output?
```roblox
-- A Script in ServerScriptService:
local Players = game:GetService("Players")
print(Players.LocalPlayer, game:GetService("RunService"):IsServer())
```
= nil true
> On the server, `LocalPlayer` is `nil` and `IsServer()` returns `true`.
:::

## Challenges

:::challenge easy | Hello from both sides
Create a Script in ServerScriptService that prints `"Hello from the server"` and a LocalScript in **StarterPlayerScripts** that prints `"Hello from <your name>'s client"` using `Players.LocalPlayer`. Play the game and use the Output window's filter dropdown to view client and server messages separately.
@solution
```roblox title="ServerScriptService › Hello"
print("Hello from the server")
```
```roblox title="StarterPlayer › StarterPlayerScripts › Hello"
local Players = game:GetService("Players")
print(`Hello from {Players.LocalPlayer.Name}'s client`)
```
In a Play session, Studio runs both the server and your client, and labels each message's source.
:::

:::challenge medium | A wall only you can see through
Place an anchored part named `Wall` in the Workspace and put a ProximityPrompt inside it. Write a **LocalScript** that makes the wall semi-transparent and non-collidable — for the local player only — when they trigger the prompt. Then test with **Test → Clients and Servers → 2 Players** and observe that the other player still bumps into the wall.

Explain in a comment why the other player is unaffected, and why this would be a terrible way to build a real door.
@hint
ProximityPrompt's `Triggered` event fires on the client too, passing the local player. The LocalScript can live in StarterPlayerScripts and use `workspace:WaitForChild("Wall")`.
@solution
```roblox title="StarterPlayer › StarterPlayerScripts › GhostWall"
local wall = workspace:WaitForChild("Wall")
local prompt = wall:WaitForChild("ProximityPrompt") :: ProximityPrompt

prompt.Triggered:Connect(function()
	-- Only this client changes. FilteringEnabled stops the change from replicating,
	-- so the server and other players still have a solid wall.
	wall.Transparency = 0.7
	wall.CanCollide = false
end)

-- Why it's terrible for a real door: the server still thinks the wall is solid,
-- and any exploiter could run these two lines without the prompt at all.
-- Real doors are opened by the SERVER after it checks the player is allowed.
```
Interestingly, the player who opened it *can* walk through, because their own character's movement is simulated on their client. That's precisely the kind of loophole exploiters use for no-clip cheats.
:::

:::challenge medium | Pick the container
Decide where each of these belongs and justify each choice in one sentence:

1. A ModuleScript with item prices that both the shop UI and the server read
2. The script that saves player data
3. A sword model that the server clones into players' backpacks after purchase
4. A LocalScript that plays footstep sounds for your own character
5. The admin user ID list
6. A loading screen LocalScript
7. The RemoteEvent used to request a purchase
8. A LocalScript that controls a custom camera
@solution
| # | Container | Why |
| --- | --- | --- |
| 1 | `ReplicatedStorage` | Both sides need to require it. |
| 2 | `ServerScriptService` | Only the server can (and should) save data. |
| 3 | `ServerStorage` | Only the server clones it; no need to send it to clients until given. |
| 4 | `StarterCharacterScripts` | Runs inside each new character on its owner's client. |
| 5 | `ServerScriptService` / `ServerStorage` | Must never be readable by clients. |
| 6 | `ReplicatedFirst` | Runs before the rest of the game loads. |
| 7 | `ReplicatedStorage` | Both sides need to reference the same RemoteEvent. |
| 8 | `StarterPlayerScripts` | Runs once per player on their client and survives respawns. |
:::

:::challenge hard | Server-driven day cycle, client-side mood
Write a **server** Script that advances `Lighting.ClockTime` smoothly so a full day takes 4 minutes (it replicates to all clients automatically). Then write a **LocalScript** that watches `Lighting.ClockTime` and, for that player only, adds a `ColorCorrectionEffect` that tints the screen slightly blue at night (`ClockTime < 6` or `> 18`) and removes the tint during the day.

Explain in comments why the time belongs on the server while the tint can live on the client.
@hint
Server: in a loop, `Lighting.ClockTime = (Lighting.ClockTime + dt * 24 / 240) % 24` with `local dt = task.wait()`.
@hint
Client: create the `ColorCorrectionEffect` in `Lighting` from the LocalScript (it won't replicate), and update it in `Lighting:GetPropertyChangedSignal("ClockTime")`.
@solution
```roblox title="ServerScriptService › DayCycle"
-- The time of day is shared game state: everyone must agree on it,
-- so the server owns it and replication shares it.
local Lighting = game:GetService("Lighting")
local DAY_LENGTH = 240 -- seconds per full day

while true do
	local dt = task.wait()
	Lighting.ClockTime = (Lighting.ClockTime + dt * 24 / DAY_LENGTH) % 24
end
```
```roblox title="StarterPlayer › StarterPlayerScripts › NightTint"
-- The tint is purely cosmetic and per-player (some players could even turn it off),
-- so it's created and controlled on the client. It never replicates.
local Lighting = game:GetService("Lighting")

local tint = Instance.new("ColorCorrectionEffect")
tint.Name = "NightTint"
tint.Parent = Lighting

local function update()
	local t = Lighting.ClockTime
	local isNight = t < 6 or t > 18
	tint.Enabled = isNight
	tint.TintColor = Color3.fromRGB(200, 215, 255)
	tint.Brightness = if isNight then -0.05 else 0
end

Lighting:GetPropertyChangedSignal("ClockTime"):Connect(update)
update()
```
:::

:::recap
- One authoritative **server**; one **client** per player. The server owns the truth.
- Scripts run on the server; LocalScripts run on clients only in PlayerScripts, PlayerGui, Backpack, their character or ReplicatedFirst; ModuleScripts run where required.
- `ReplicatedStorage` is shared; `ServerScriptService`/`ServerStorage` are server-only and invisible to clients.
- Server changes replicate to clients automatically; client changes don't replicate (except their own character physics, owned parts and animations).
- Use the client for input, UI and effects; use the server for rules, currency, data and validation.
- With StreamingEnabled, clients may not have distant parts — wait or check.
- Never trust the client.
:::
