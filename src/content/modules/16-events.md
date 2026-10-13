---
id: events
title: Events, Signals & Connections
part: 3
summary: React to the world instead of polling it — connect to engine events, handle touches, clicks and prompts, debounce correctly, disconnect to avoid leaks, and build your own signals.
time: 45 min
level: Beginner
objectives:
- Explain event-driven programming and why it beats polling
- Use `Connect`, `Once`, `Wait` and `Disconnect`
- Listen for property, attribute and hierarchy changes
- Handle `Touched`, `ClickDetector` and `ProximityPrompt` interactions with proper debounces
- Avoid duplicate connections and memory leaks
- Create custom events with BindableEvents and a pure-Luau Signal class
---

Games are reactive. When a player joins, give them stats. When a part is touched, deal damage. When health changes, update the health bar. Roblox exposes all these moments as **events**, and connecting functions to events is how almost all game logic gets triggered.

## Polling vs. events

Imagine you want to do something when a player's health drops below 20. You *could* check constantly:

```roblox
-- ❌ Polling: wasteful and laggy
while true do
	task.wait(0.1)
	if humanoid.Health < 20 then
		warn("Low health!")
	end
end
```

This burns CPU checking the same thing over and over, reacts up to 0.1 seconds late, and spams the warning every loop. Compare:

```roblox
-- ✅ Event-driven: runs only when health actually changes
humanoid.HealthChanged:Connect(function(newHealth)
	if newHealth < 20 then
		warn("Low health!")
	end
end)
```

The engine calls your function exactly when something happens. **Prefer events whenever one exists.**

## Connecting to events

An event (an `RBXScriptSignal`) has a few methods:

| Method | What it does |
| --- | --- |
| `event:Connect(fn)` | Call `fn` every time the event fires. Returns an `RBXScriptConnection`. |
| `event:Once(fn)` | Call `fn` the next time it fires, then disconnect automatically. |
| `event:Wait()` | Yield the current thread until the event fires; returns the event's arguments. |
| `connection:Disconnect()` | Stop listening. `connection.Connected` tells you if it's still active. |

```roblox
local Players = game:GetService("Players")

local connection = Players.PlayerAdded:Connect(function(player)
	print(player.Name .. " joined")
end)

Players.PlayerRemoving:Once(function(player)
	print("The first player to leave was " .. player.Name)
end)

local newPlayer = Players.PlayerAdded:Wait()   -- yields until someone joins
print("Waited for", newPlayer.Name)

connection:Disconnect()                         -- stop announcing joins
```

Each event passes specific **arguments** to your function — `PlayerAdded` passes the `Player`, `Touched` passes the part that touched. The API reference lists the parameters of every event.

You can connect a named function instead of an anonymous one, which keeps code tidy and lets you reuse it:

```roblox
local function onPlayerAdded(player: Player)
	print("Welcome, " .. player.DisplayName)
end

Players.PlayerAdded:Connect(onPlayerAdded)
```

:::info Deferred events
In current Roblox versions, engine events are **deferred** by default: when something triggers an event, your handler runs a moment later (at the end of the current batch of work) rather than instantly in the middle of the code that caused it. In practice this means: **don't assume a handler has already run on the very next line** after you change something. It also makes handler order more predictable and avoids some tricky re-entrancy bugs.
:::

## Change events

Every Instance has events that fire when it changes:

| Event | Fires when | Arguments |
| --- | --- | --- |
| `GetPropertyChangedSignal("Prop")` | That one property changes | none |
| `Changed` | Any property changes | the property name |
| `AttributeChanged` | Any attribute changes | the attribute name |
| `GetAttributeChangedSignal("Attr")` | That attribute changes | none |
| `ChildAdded` / `ChildRemoved` | A direct child is added/removed | the child |
| `DescendantAdded` / `DescendantRemoving` | Anything below it is added/removed | the descendant |
| `AncestryChanged` | It (or an ancestor) is re-parented | child, new parent |
| `Destroying` | It's about to be destroyed | none |

```roblox
local part = workspace.Beacon

part:GetPropertyChangedSignal("Color"):Connect(function()
	print("New color:", part.Color)
end)

workspace.ChildAdded:Connect(function(child)
	print("Something new in the workspace:", child.Name)
end)
```

:::tip Prefer GetPropertyChangedSignal
`Changed` fires for *every* property change — position updates included — so a handler on a moving part can run constantly. Listen to exactly the property you care about with `GetPropertyChangedSignal`. (Value objects like `IntValue` are an exception: their `Changed` event fires only when `Value` changes, and passes the new value.)
:::

## Touched events

`BasePart.Touched` fires when another part physically touches this one, passing the **other part**. It's the backbone of lava, checkpoints, coins and pickups — and it has quirks you need to know.

### Finding who touched

The part that touched is usually a **limb** of a character (`LeftFoot`, `RightHand`...), or an accessory's handle. Walk up to the character model and find its Humanoid — or the Player:

```roblox
local Players = game:GetService("Players")
local lava = workspace.Lava

lava.Touched:Connect(function(hit)
	local character = hit:FindFirstAncestorOfClass("Model")
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid then
		return   -- touched by something that isn't a character
	end

	local player = Players:GetPlayerFromCharacter(character)
	print((if player then player.Name else "An NPC") .. " touched the lava")
	humanoid.Health = 0
end)
```

### Debouncing

`Touched` fires **many times** for a single contact — once for each limb, and repeatedly as the character jiggles. Without protection, a "+10 coins" pad pays out dozens of times. The fix is a **debounce**: ignore touches for a while after one is handled.

A single boolean debounce works for things only one player can use at a time:

```roblox
local busy = false

button.Touched:Connect(function(hit)
	if busy then return end
	busy = true
	print("Button pressed!")
	task.wait(2)
	busy = false
end)
```

For anything multiple players use, debounce **per player** with a table:

```roblox
local Players = game:GetService("Players")
local COOLDOWN = 1
local lastTouch: {[Player]: number} = {}

healPad.Touched:Connect(function(hit)
	local character = hit:FindFirstAncestorOfClass("Model")
	local player = character and Players:GetPlayerFromCharacter(character)
	if not player then return end

	local now = os.clock()
	if lastTouch[player] and now - lastTouch[player] < COOLDOWN then
		return
	end
	lastTouch[player] = now

	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.Health = math.min(humanoid.Health + 10, humanoid.MaxHealth)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	lastTouch[player] = nil   -- clean up, or this table grows forever
end)
```

:::warning Touched is a physics event
`Touched` relies on physics contacts, so it's not perfect: very fast objects can pass through without touching, anchored parts touching each other don't fire it, and `TouchEnded` is unreliable when characters stand still. For precise "who's inside this zone" logic, query the space directly with `workspace:GetPartsInPart` — see @raycasting. Also note that a part needs `CanTouch = true` to fire `Touched`.
:::

## ClickDetectors and ProximityPrompts

For deliberate interactions, don't rely on touching. Roblox has two purpose-built objects:

**ClickDetector** — put one inside a part; it fires `MouseClick` with the player who clicked:

```roblox
local clickDetector = workspace.Lever.ClickDetector

clickDetector.MouseClick:Connect(function(player)
	print(player.Name .. " pulled the lever")
end)
```

**ProximityPrompt** — shows an on-screen prompt ("[E] Open") when a player is nearby. It works with keyboard, gamepad *and* touch automatically, and supports hold-to-activate:

```roblox
local prompt = workspace.Chest.ProximityPrompt
prompt.ActionText = "Open"
prompt.ObjectText = "Treasure Chest"
prompt.HoldDuration = 1

prompt.Triggered:Connect(function(player)
	print(player.Name .. " opened the chest")
	prompt.Enabled = false
end)
```

:::pro ProximityPrompts for most interactions
ClickDetectors don't work well with gamepads and are awkward on touchscreens. ProximityPrompts give every player a consistent, accessible interaction — use them for doors, shops, NPC dialogue, pickups and buttons.
:::

## Handling things that already exist

Here's a subtle bug. This code gives every player a welcome message... except sometimes the first player in Studio:

```roblox
Players.PlayerAdded:Connect(function(player)
	print("Welcome " .. player.Name)
end)
```

In Studio, your player can join **before** your script connects, so `PlayerAdded` never fires for them. The robust pattern is: **connect, then handle what already exists**:

```roblox
local function onPlayerAdded(player: Player)
	print("Welcome " .. player.Name)
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end
```

The same applies to `CharacterAdded` (check `player.Character`), `ChildAdded` (loop `GetChildren()`), tags (loop `GetTagged`) and so on. You'll use this pattern constantly.

## Disconnecting and memory leaks

A connection keeps its function — and everything the function references — alive until it's disconnected. Connections are disconnected automatically when the Instance that owns the event is **destroyed**. But connections to long-lived objects (services, `workspace`, the `Players` service, a player that stays in the game) live until you disconnect them.

The classic leak: connecting inside another event without ever disconnecting.

```roblox
-- ❌ Every respawn adds ANOTHER connection to the same RemoteEvent.
-- After 10 deaths, the handler runs 10 times per firing.
player.CharacterAdded:Connect(function(character)
	attackRemote.OnServerEvent:Connect(function(p)
		-- ...
	end)
end)
```

Fixes:

- Connect **once**, outside the inner event, and look up current state inside the handler.
- Or store the connection and `Disconnect()` it when it's no longer needed (e.g. on death).

```roblox
-- ✅ Store connections per character and clean them up
player.CharacterAdded:Connect(function(character)
	local humanoid = character:WaitForChild("Humanoid")
	local healthConnection = humanoid.HealthChanged:Connect(function(health)
		print(player.Name, "health:", health)
	end)

	humanoid.Died:Once(function()
		healthConnection:Disconnect()
	end)
end)
```

(Here the character is destroyed on respawn anyway, which would also disconnect the `HealthChanged` connection — but the habit of cleaning up explicitly will save you when the event belongs to something long-lived.)

## Custom events

### BindableEvents

A `BindableEvent` is an Instance that lets scripts on the **same side** (server–server or client–client) talk through an event:

```roblox
-- Script A
local roundEnded = ReplicatedStorage:WaitForChild("RoundEnded") :: BindableEvent
roundEnded:Fire("Red Team", 120)

-- Script B
roundEnded.Event:Connect(function(winner, score)
	print(winner .. " won with " .. score)
end)
```

`BindableFunction` is the request/response version (`Invoke` / `OnInvoke`). To talk **between server and client**, you need RemoteEvents instead — the subject of @remotes.

### A pure-Luau Signal

In ModuleScript-based code, many developers skip BindableEvents and use a small **Signal** class instead: it's faster, type-friendly and can pass any value (Bindables copy tables and can't pass some values). Here's a minimal version built with what you learned in @oop:

```luau
local Signal = {}
Signal.__index = Signal

function Signal.new()
	return setmetatable({ _handlers = {} }, Signal)
end

function Signal:Connect(fn)
	local handlers = self._handlers
	table.insert(handlers, fn)

	local connection = { Connected = true }
	function connection.Disconnect()
		if not connection.Connected then return end
		connection.Connected = false
		local index = table.find(handlers, fn)
		if index then
			table.remove(handlers, index)
		end
	end
	return connection
end

function Signal:Fire(...)
	-- Iterate over a copy so handlers can safely disconnect while firing
	for _, fn in table.clone(self._handlers) do
		fn(...)
	end
end

-- Usage
local scoreChanged = Signal.new()
local conn = scoreChanged:Connect(function(newScore)
	print("Score is now", newScore)
end)
scoreChanged:Fire(10)   --> Score is now 10
conn.Disconnect()
scoreChanged:Fire(20)   -- (nothing)
```

Production signal libraries (such as the widely used *GoodSignal*) also run each handler in its own thread so one erroring handler can't stop the others, and add `Once` and `Wait`.

:::quiz Events
? What does `event:Connect(fn)` return?
- Nothing
- The event's arguments
+ An `RBXScriptConnection` you can disconnect later
- A thread
> Keep the connection if you'll ever need to stop listening.

? Why does a coin pad without a debounce pay out many times per touch?
- `Touched` only fires for the first limb
+ `Touched` fires for every limb and repeatedly during contact
- Coins are duplicated by replication
- The server runs every handler twice
> Debounce — ideally per player — so one contact counts once.

? Why might `PlayerAdded` never fire for the first player in Studio?
+ The player can join before the script connects to the event
- `PlayerAdded` doesn't work in Studio
- Studio players aren't real players
- The event fires only on the client
> Connect first, then loop over `Players:GetPlayers()` to handle anyone already there.

? Which interaction object works with keyboard, gamepad and touch automatically?
- ClickDetector
+ ProximityPrompt
- Touched
- BindableEvent
> ProximityPrompts handle every input type and show a consistent on-screen prompt.

? You connect to a RemoteEvent inside `CharacterAdded` without disconnecting. What happens after 5 respawns?
- Nothing unusual
+ The handler runs 5 times per firing
- The RemoteEvent is destroyed
- An error is raised
> Each respawn adds another connection to the same long-lived event.

? What's the best way to react to just a part's `Transparency` changing?
- `part.Changed`
+ `part:GetPropertyChangedSignal("Transparency")`
- A `while` loop checking it
- `part.Touched`
> Listen to exactly the property you need instead of every change.
:::

:::predict Connections and disconnecting
```luau
local handlers = {}
local function connect(fn)
	table.insert(handlers, fn)
	return function()
		table.remove(handlers, table.find(handlers, fn))
	end
end
local function fire(n)
	for _, fn in table.clone(handlers) do
		fn(n)
	end
end

local total = 0
local disconnectA = connect(function(n) total += n end)
connect(function(n) total += n * 10 end)
fire(1)
disconnectA()
fire(2)
print(total)
```
= 31
> The first `fire(1)` runs both handlers: 1 + 10 = 11. After disconnecting the first handler, `fire(2)` only runs the second: 20 more, for 31.
:::

## Challenges

:::challenge easy | Lava with a per-player cooldown
Make a part named `Lava` that deals **15 damage** to any character that touches it, at most once per **0.75 seconds per character**. Use `Humanoid:TakeDamage()`. Clean up your cooldown table when players leave.
@hint
Key your cooldown table by the character's Humanoid (or the Player). `os.clock()` gives precise time.
@solution
```roblox title="ServerScriptService › Lava"
local Players = game:GetService("Players")
local lava = workspace:WaitForChild("Lava")

local COOLDOWN = 0.75
local DAMAGE = 15
local lastHit: {[Humanoid]: number} = {}

lava.Touched:Connect(function(hit)
	local character = hit:FindFirstAncestorOfClass("Model")
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return
	end

	local now = os.clock()
	local last = lastHit[humanoid]
	if last and now - last < COOLDOWN then
		return
	end
	if last == nil then
		-- First time we've seen this humanoid: forget it when it's destroyed
		humanoid.Destroying:Once(function()
			lastHit[humanoid] = nil
		end)
	end
	lastHit[humanoid] = now
	humanoid:TakeDamage(DAMAGE)
end)
```
Keying by Humanoid and clearing on `Destroying` handles both respawns and leaving players. The cleanup connection is made only once per humanoid, so it doesn't pile up with every hit. (`TakeDamage` respects ForceFields, unlike setting `Health` directly.)
:::

:::challenge easy | Prompted door
Build a door (a Part) with a ProximityPrompt. When triggered, toggle the door between **closed** (opaque, collidable) and **open** (`Transparency = 0.8`, `CanCollide = false`). Update the prompt's `ActionText` to say `Open` or `Close` accordingly.
@solution
```roblox title="ServerScriptService › Door"
local door = workspace:WaitForChild("Door")
local prompt = door:WaitForChild("ProximityPrompt") :: ProximityPrompt

local isOpen = false

local function render()
	door.Transparency = if isOpen then 0.8 else 0
	door.CanCollide = not isOpen
	prompt.ActionText = if isOpen then "Close" else "Open"
end

prompt.Triggered:Connect(function()
	isOpen = not isOpen
	render()
end)

render()
```
Keeping state in one variable and having a single `render()` that applies it is a pattern you'll reuse for UI too.
:::

:::challenge medium | Signal with Once and DisconnectAll
Extend the pure-Luau `Signal` class from this module with:

- `:Once(fn)` — connects a handler that disconnects itself after its first call
- `:DisconnectAll()` — removes every handler
- a `Connected` field on connections that is accurate after `Once` fires

Test it in the playground.
@hint
`Once` can be built on top of `Connect`: connect a wrapper function that first disconnects the connection, then calls `fn(...)`.
@solution
```luau
local Signal = {}
Signal.__index = Signal

function Signal.new()
	return setmetatable({ _handlers = {} }, Signal)
end

function Signal:Connect(fn)
	local handlers = self._handlers
	table.insert(handlers, fn)
	local connection = { Connected = true }
	function connection.Disconnect()
		if not connection.Connected then return end
		connection.Connected = false
		local i = table.find(handlers, fn)
		if i then table.remove(handlers, i) end
	end
	return connection
end

function Signal:Once(fn)
	local connection
	connection = self:Connect(function(...)
		connection.Disconnect()
		fn(...)
	end)
	return connection
end

function Signal:DisconnectAll()
	table.clear(self._handlers)
end

function Signal:Fire(...)
	for _, fn in table.clone(self._handlers) do
		fn(...)
	end
end

local s = Signal.new()
local c = s:Once(function(x) print("once:", x) end)
s:Connect(function(x) print("always:", x) end)
s:Fire(1)              --> once: 1, always: 1
s:Fire(2)              --> always: 2
print(c.Connected)     --> false
s:DisconnectAll()
s:Fire(3)              -- (nothing)
```
:::

:::challenge hard | Character tracker without leaks
Write a server script that, for **every** player (including ones already in the game when it starts):

1. Prints `"<name> spawned"` each time their character spawns.
2. Prints the character's health whenever it changes.
3. Prints `"<name> died after X seconds"` when the character dies, measured from spawn.
4. Never accumulates duplicate connections — even after many respawns — and cleans up everything when the player leaves.
@hint
Handle existing players *and* existing characters (`player.Character` may already exist). Keep per-player connections in a table so you can disconnect them in `PlayerRemoving`.
@hint
Connections to the character's Humanoid are cleaned up automatically when the old character is destroyed on respawn — but the `CharacterAdded` connection lives on the Player, so store it.
@solution
```roblox title="ServerScriptService › CharacterTracker"
local Players = game:GetService("Players")

local playerConnections: {[Player]: RBXScriptConnection} = {}

local function onCharacterAdded(player: Player, character: Model)
	print(`{player.Name} spawned`)
	local spawnedAt = os.clock()
	local humanoid = character:WaitForChild("Humanoid") :: Humanoid

	humanoid.HealthChanged:Connect(function(health)
		print(`{player.Name} health: {math.floor(health)}`)
	end)

	humanoid.Died:Once(function()
		print(`{player.Name} died after {string.format("%.1f", os.clock() - spawnedAt)} seconds`)
	end)
end

local function onPlayerAdded(player: Player)
	playerConnections[player] = player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
	if player.Character then
		task.spawn(onCharacterAdded, player, player.Character)
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	local connection = playerConnections[player]
	if connection then
		connection:Disconnect()
		playerConnections[player] = nil
	end
end)
```
The Humanoid connections don't need manual cleanup because the old character model is destroyed when the player respawns or leaves, which disconnects them automatically.
:::

:::recap
- Prefer **events** to polling. `Connect` returns a connection; `Once` auto-disconnects; `Wait` yields for the next firing.
- Engine events are **deferred** by default — handlers run shortly after the triggering change.
- Use `GetPropertyChangedSignal` / `GetAttributeChangedSignal` for specific changes, plus `ChildAdded`, `DescendantAdded`, `Destroying`, etc.
- `Touched` fires many times per contact: find the character, then **debounce per player**.
- Use **ProximityPrompts** for interactions; ClickDetectors for simple mouse clicks.
- Connect, then handle what already exists (`GetPlayers`, `player.Character`, `GetTagged`).
- Disconnect connections to long-lived objects; never connect inside a repeating event without cleanup.
- Same-side custom events: BindableEvent or a pure-Luau Signal. Cross-boundary: RemoteEvents.
:::
