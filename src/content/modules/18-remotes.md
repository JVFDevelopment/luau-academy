---
id: remotes
title: RemoteEvents & RemoteFunctions
part: 3
summary: Cross the client-server boundary safely — fire events both ways, request data with RemoteFunctions, stream with unreliable remotes, and validate every single request on the server.
time: 50 min
level: Intermediate
objectives:
- Fire RemoteEvents from client to server and server to clients
- Use RemoteFunctions for request/response — and know why `InvokeClient` is dangerous
- Pick UnreliableRemoteEvents for high-frequency, loss-tolerant data
- Know exactly which values can cross the network and how they change
- Validate type, range, ownership, distance, state and rate on every request
- Design remotes around *intents*, not results
---

Clients can't change the server's world directly — that's what keeps games safe. So how does pressing "Buy" in a shop UI actually buy something? The client sends a **message** to the server, and the server decides what to do. Those messages travel through **RemoteEvents** and **RemoteFunctions**.

## Setting up a remote

Remotes are Instances. Put them somewhere both sides can see — conventionally a `Remotes` folder in `ReplicatedStorage`:

:::tree
ReplicatedStorage
  Remotes (Folder)
    Cheer (RemoteEvent)
    BuyItem (RemoteFunction)
    MouseAim (UnreliableRemoteEvent)
:::

You can create them in Studio, or have the **server** create them at startup. Clients should never create remotes — the server wouldn't see them.

```roblox
-- Server: create remotes in code (optional alternative to placing them in Studio)
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage

local cheer = Instance.new("RemoteEvent")
cheer.Name = "Cheer"
cheer.Parent = remotes
```

Clients should use `WaitForChild` to get them, because they may not have replicated yet:

```roblox
-- Client
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remotes = ReplicatedStorage:WaitForChild("Remotes")
local cheer = remotes:WaitForChild("Cheer") :: RemoteEvent
```

## RemoteEvents

A RemoteEvent is a one-way message. The sender doesn't wait for anything.

| Direction | Send with | Receive with |
| --- | --- | --- |
| Client → Server | `remote:FireServer(...)` | `remote.OnServerEvent:Connect(function(player, ...) end)` |
| Server → One client | `remote:FireClient(player, ...)` | `remote.OnClientEvent:Connect(function(...) end)` |
| Server → All clients | `remote:FireAllClients(...)` | `remote.OnClientEvent:Connect(function(...) end)` |

### Client → server

```roblox title="LocalScript"
cheer:FireServer("Let's go!")
```

```roblox title="Script"
cheer.OnServerEvent:Connect(function(player, message)
	print(player.Name, "cheered:", message)
end)
```

:::info The player argument is automatic — and trustworthy
`OnServerEvent` handlers always receive the sending `Player` as the **first** argument, added by Roblox. The client doesn't pass it and **can't fake it**. Everything *after* it, though, is whatever the client chose to send — and can be anything.
:::

A very common bug is forgetting that first parameter:

```roblox
-- ❌ 'message' is actually the Player here
cheer.OnServerEvent:Connect(function(message)
	print(message) -- prints the player's name, not the message!
end)
```

### Server → clients

```roblox title="Script"
-- Tell everyone about a cheer
cheer.OnServerEvent:Connect(function(player, message)
	cheer:FireAllClients(player.DisplayName, message)
end)

-- Tell only one player something
local notify = remotes:WaitForChild("Notify") :: RemoteEvent
notify:FireClient(somePlayer, "You leveled up!")
```

```roblox title="LocalScript"
cheer.OnClientEvent:Connect(function(displayName, message)
	print(displayName .. ": " .. message)
end)
```

Note that `OnClientEvent` does **not** receive a player argument — messages to a client always come from the server.

To message everyone *except* one player, loop:

```roblox
for _, other in Players:GetPlayers() do
	if other ~= player then
		notify:FireClient(other, "Someone found the treasure!")
	end
end
```

:::note Events are queued until someone listens
If a remote fires before the receiving side has connected a handler, Roblox holds the messages in a queue and delivers them once a handler connects (up to a limit). Still, it's good practice to connect handlers early.
:::

## RemoteFunctions

A RemoteFunction is a **request with a response**. The caller **yields** until the other side returns:

```roblox title="Script"
local getStats = remotes:WaitForChild("GetStats") :: RemoteFunction

getStats.OnServerInvoke = function(player)
	return {
		coins = 250,
		level = 7,
	}
end
```

```roblox title="LocalScript"
local stats = getStats:InvokeServer()   -- yields until the server returns
print(stats.coins, stats.level)
```

Notice that `OnServerInvoke` is a **callback you assign**, not an event you connect to. There can only be one handler per RemoteFunction; assigning again replaces it.

:::danger Never use InvokeClient
The server *can* call `remote:InvokeClient(player)`, but don't. The server would wait for an answer from a device controlled by the player: an exploiter can simply never respond (hanging your server thread forever) or throw an error that propagates into your server code. If you need something from a client, have the server `FireClient` and let the client reply with `FireServer`.
:::

### Events or functions?

| Use a RemoteEvent when… | Use a RemoteFunction when… |
| --- | --- |
| The sender doesn't need a reply | The client needs data back (e.g. "can I afford this?") |
| You're broadcasting to many clients | The client is asking the server for a one-off value |
| Fire-and-forget actions (input, effects) | You want a simple request/response flow |

Many developers use RemoteEvents almost everywhere and reply with another event — it avoids yielding and makes timeouts easy to manage. RemoteFunctions are fine for client→server requests as long as the server handler is fast and never errors unexpectedly.

## UnreliableRemoteEvent

`UnreliableRemoteEvent` has the same API as `RemoteEvent`, but messages **may be dropped** and **may arrive out of order**. In exchange, it's cheaper and never builds up a backlog. Use it for frequent, *replaceable* data where only the latest value matters:

- Where a player is aiming, sent many times a second
- Cosmetic effects like footstep dust or muzzle flashes
- Non-critical position updates for visual-only objects

Never use it for things that must arrive — purchases, damage, chat. Unreliable messages also have a small maximum size (under a kilobyte), so keep payloads tiny.

## What can cross the network

Arguments are **copied** and **serialized** when they travel. Not everything survives the trip intact:

| Value | What arrives |
| --- | --- |
| `nil`, booleans, numbers, strings | Unchanged |
| Roblox datatypes (`Vector3`, `CFrame`, `Color3`, ...) | Unchanged |
| `buffer` | Unchanged — great for compact custom formats |
| Instances | A reference to the same Instance — **only if the receiver can see it**; otherwise `nil` |
| Tables | A **copy**: metatables are stripped, so class objects arrive as plain tables |
| Mixed tables (array + dictionary keys) | Unreliable — parts may be lost. Don't send them |
| Dictionaries with non-string keys | Keys may be converted to strings |
| Functions, threads | Can't be sent |

Practical consequences:

- Send **plain data**: strings, numbers, arrays of records. Not objects with methods.
- Send an **Instance** only if it lives somewhere the receiver can see. A part in `ServerStorage` arrives at the client as `nil`.
- Avoid huge payloads. Large or very frequent remote traffic causes lag for everyone. Send IDs instead of entire objects where possible.

## Never trust the client

Here's the most important section in this module. Every `OnServerEvent` handler and `OnServerInvoke` callback is a **public API** that any player can call **at any time, as often as they want, with any arguments**. Exploiters do exactly that.

Consider this shop handler:

```roblox
-- ❌ Insecure: the client decides everything
buy.OnServerEvent:Connect(function(player, itemName, price)
	player.leaderstats.Coins.Value -= price
	giveItem(player, itemName)
end)
```

An exploiter calls `buy:FireServer("Legendary Sword", 0)` — or `-1000000` to *gain* a million coins. The fix is to send an **intent**, and let the server decide everything else:

```roblox
-- ✅ Secure: the client only says WHAT it wants; the server owns prices and checks
local PRICES = { Sword = 100, Shield = 150, Potion = 25 }

buy.OnServerEvent:Connect(function(player, itemName)
	if typeof(itemName) ~= "string" then return end           -- type check
	local price = PRICES[itemName]
	if not price then return end                                -- does the item exist?

	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if not coins or coins.Value < price then return end         -- can they afford it?

	coins.Value -= price
	giveItem(player, itemName)
end)
```

### The validation checklist

For every remote handler, ask:

:::steps
1. **Type** — is every argument the type I expect? Use `typeof(x) == "string"`, `typeof(x) == "Vector3"`, `typeof(inst) == "Instance" and inst:IsA("Model")`.
2. **Value** — is it in a sensible range? Positive, whole, below a maximum, not NaN (`x ~= x`) or infinite (`math.abs(x) == math.huge`)? Strings not absurdly long?
3. **Existence & ownership** — does the item/target exist? Does this player own the thing they're trying to use, sell or equip?
4. **State** — is the player alive? Is the round active? Is the shop open?
5. **Distance & line of sight** — are they close enough to interact with or hit that target?
6. **Rate** — are they calling this far more often than a human could (cooldowns, rate limits)?
7. **Authority** — is the *server* calculating the result (price, damage, reward), rather than accepting a number from the client?
:::

You'll go deeper into exploit techniques and defenses in @security.

### Rate limiting

Even valid requests can be spammed. A simple per-player limiter:

```roblox
local lastCall: {[Player]: number} = {}
local MIN_INTERVAL = 0.25 -- seconds

local function allowed(player: Player): boolean
	local now = os.clock()
	local last = lastCall[player]
	if last and now - last < MIN_INTERVAL then
		return false
	end
	lastCall[player] = now
	return true
end

Players.PlayerRemoving:Connect(function(player)
	lastCall[player] = nil
end)

cheer.OnServerEvent:Connect(function(player, message)
	if not allowed(player) then return end
	-- ...
end)
```

## Feeling responsive: predict, then confirm

Waiting a round trip for the server before showing *any* feedback feels laggy. The standard approach:

1. **Client:** play immediate feedback (button press animation, swing sound) and send the intent.
2. **Server:** validate, apply the real result (which replicates), and optionally reply with the outcome.
3. **Client:** if the server rejected the action, undo the prediction (e.g. show "Not enough coins").

```roblox title="LocalScript (shop button)"
buyButton.Activated:Connect(function()
	buyButton.Text = "Buying..."                 -- immediate feedback
	local ok, message = buyItem:InvokeServer("Sword")
	buyButton.Text = if ok then "Owned!" else message
end)
```

```roblox title="Script"
buyItem.OnServerInvoke = function(player, itemName)
	if typeof(itemName) ~= "string" then
		return false, "Invalid item"
	end
	local price = PRICES[itemName]
	if not price then
		return false, "Unknown item"
	end
	-- ... check coins, deduct, grant ...
	return true, "Purchased"
end
```

## Organizing remotes

As games grow, scattering `WaitForChild("SomeRemote")` calls everywhere gets messy. A small shared module keeps names in one place:

```roblox title="ReplicatedStorage › Remotes (ModuleScript)"
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

local function get(className: string, name: string): Instance
	if RunService:IsServer() then
		local remote = Instance.new(className)
		remote.Name = name
		remote.Parent = folder
		return remote
	end
	return folder:WaitForChild(name)
end

return {
	Cheer = get("RemoteEvent", "Cheer") :: RemoteEvent,
	BuyItem = get("RemoteFunction", "BuyItem") :: RemoteFunction,
	Aim = get("UnreliableRemoteEvent", "Aim") :: UnreliableRemoteEvent,
}
```

Both sides `require` it and get the same remotes by name, with types. Larger projects often use networking libraries that add type safety, batching and compact serialization on top of remotes — but they're all built on exactly what you learned here.

:::quiz Remotes
? In `remote.OnServerEvent:Connect(function(a, b) ... end)`, what is `a`?
+ The Player who fired the event
- The first argument passed to `FireServer`
- The RemoteEvent itself
- `nil`
> Roblox inserts the sending Player as the first argument on the server.

? Why should the server never call `InvokeClient`?
- It doesn't exist
+ A malicious client can hang or error the server thread
- It's slower than `FireAllClients`
- Clients can't return values
> The server would be waiting on a device the player controls.

? A server-side table with a metatable is sent with `FireClient`. What arrives?
- The same object, methods included
+ A plain copy of the table without its metatable
- `nil`
- A string
> Tables are copied and metatables are stripped.

? The server passes a Part that lives in `ServerStorage` to `FireClient`. What does the client receive?
- The part
+ `nil`, because the client can't see ServerStorage
- A copy of the part
- An error
> Instance arguments only arrive if the receiver can see the Instance.

? What's the secure way to design a "buy" remote?
- Client sends item name and price
- Client sends new coin total
+ Client sends only the item it wants; the server looks up the price and checks funds
- Client sends a password with the request
> Send intents. The server owns prices, balances and the decision.

? When is an `UnreliableRemoteEvent` appropriate?
+ Sending a player's aim direction many times per second
- Granting a purchase
- Saving data
- Sending chat messages
> Use unreliable remotes only when dropped or out-of-order messages are harmless.

? Which check catches a NaN sent as a number?
- `x > 0`
- `typeof(x) == "number"`
+ `x ~= x`
- `x == nil`
> NaN is the only value not equal to itself — and it passes `typeof` checks and many comparisons.
:::

:::predict The automatic player argument
```roblox
-- LocalScript:
remote:FireServer("Sword", 3)

-- Script:
remote.OnServerEvent:Connect(function(a, b, c)
	print(typeof(a), b, c)
end)
```
= Instance Sword 3
> The server receives the Player first (an Instance), followed by the client's arguments.
:::

## Challenges

:::challenge easy | Cheer broadcast
Create a RemoteEvent named `Cheer` in `ReplicatedStorage`. When a player presses **C**, their client fires it. The server rate-limits each player to one cheer every 2 seconds and broadcasts `"<DisplayName> cheered!"` to everyone, and every client prints the message.

(For the key press, use `UserInputService.InputBegan` — you'll study it fully in @input-camera.)
@solution
```roblox title="StarterPlayerScripts › CheerClient"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local cheer = ReplicatedStorage:WaitForChild("Cheer") :: RemoteEvent

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end -- ignore typing in chat, etc.
	if input.KeyCode == Enum.KeyCode.C then
		cheer:FireServer()
	end
end)

cheer.OnClientEvent:Connect(function(message: string)
	print(message)
end)
```
```roblox title="ServerScriptService › CheerServer"
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local cheer = ReplicatedStorage:WaitForChild("Cheer") :: RemoteEvent
local COOLDOWN = 2
local lastCheer: {[Player]: number} = {}

cheer.OnServerEvent:Connect(function(player)
	local now = os.clock()
	if lastCheer[player] and now - lastCheer[player] < COOLDOWN then
		return
	end
	lastCheer[player] = now
	cheer:FireAllClients(`{player.DisplayName} cheered!`)
end)

Players.PlayerRemoving:Connect(function(player)
	lastCheer[player] = nil
end)
```
The client sends *no* text, so there's nothing to validate or filter — the server builds the whole message.
:::

:::challenge medium | Secure shop with a RemoteFunction
Give every player a `leaderstats` folder with a `Coins` IntValue starting at 300. Create a RemoteFunction `BuyItem`. The server keeps a price table `{ Sword = 100, Shield = 150, Crown = 1000 }` and an owned-items table per player. `OnServerInvoke` must:

- reject non-string arguments,
- reject unknown items,
- reject items the player already owns,
- reject if they can't afford it,
- otherwise deduct coins, record ownership, and return `true, "Purchased <item>"`.

Every rejection returns `false, "<reason>"`. Write a client that tries to buy `Sword`, `Sword` again, `Crown` and `123`, printing each result.
@solution
```roblox title="ServerScriptService › Shop"
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local buyItem = ReplicatedStorage:WaitForChild("BuyItem") :: RemoteFunction
local PRICES = { Sword = 100, Shield = 150, Crown = 1000 }
local owned: {[Player]: {[string]: boolean}} = {}

Players.PlayerAdded:Connect(function(player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = 300
	coins.Parent = leaderstats
	leaderstats.Parent = player
	owned[player] = {}
end)

Players.PlayerRemoving:Connect(function(player)
	owned[player] = nil
end)

buyItem.OnServerInvoke = function(player, itemName)
	if typeof(itemName) ~= "string" then
		return false, "Invalid request"
	end
	local price = PRICES[itemName]
	if not price then
		return false, "That item doesn't exist"
	end
	local inventory = owned[player]
	if not inventory then
		return false, "Still loading"
	end
	if inventory[itemName] then
		return false, "You already own that"
	end
	local coins = player.leaderstats.Coins
	if coins.Value < price then
		return false, `You need {price - coins.Value} more coins`
	end

	coins.Value -= price
	inventory[itemName] = true
	return true, `Purchased {itemName}`
end
```
```roblox title="StarterPlayerScripts › ShopTest"
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local buyItem = ReplicatedStorage:WaitForChild("BuyItem") :: RemoteFunction

for _, request in { "Sword", "Sword", "Crown", 123 } do
	print(request, buyItem:InvokeServer(request))
end
```
:::

:::challenge medium | Reusable rate limiter
Write a ModuleScript `RateLimiter` that implements a **token bucket**: each player has up to `capacity` tokens, refilled at `refillPerSecond`. `limiter:consume(player)` returns `true` and spends a token if one is available, `false` otherwise. Include cleanup on `PlayerRemoving`. Use it to protect a remote so players can burst 5 calls but average only 2 per second.
@hint
Store `{ tokens = number, last = number }` per player. On each call, add `(now - last) * refillPerSecond` tokens (capped at capacity), then try to spend one.
@solution
```roblox title="ServerScriptService › RateLimiter (ModuleScript)"
local Players = game:GetService("Players")

local RateLimiter = {}
RateLimiter.__index = RateLimiter

function RateLimiter.new(capacity: number, refillPerSecond: number)
	local self = setmetatable({}, RateLimiter)
	self.capacity = capacity
	self.refill = refillPerSecond
	self.buckets = {} :: {[Player]: { tokens: number, last: number }}

	Players.PlayerRemoving:Connect(function(player)
		self.buckets[player] = nil
	end)
	return self
end

function RateLimiter:consume(player: Player): boolean
	local now = os.clock()
	local bucket = self.buckets[player]
	if not bucket then
		bucket = { tokens = self.capacity, last = now }
		self.buckets[player] = bucket
	end

	bucket.tokens = math.min(self.capacity, bucket.tokens + (now - bucket.last) * self.refill)
	bucket.last = now

	if bucket.tokens >= 1 then
		bucket.tokens -= 1
		return true
	end
	return false
end

return RateLimiter
```
```roblox title="Usage"
local RateLimiter = require(script.Parent.RateLimiter)
local limiter = RateLimiter.new(5, 2)

someRemote.OnServerEvent:Connect(function(player, ...)
	if not limiter:consume(player) then
		return
	end
	-- handle the request
end)
```
:::

:::challenge hard | Validated melee attack
Create a RemoteEvent `Attack`. The client sends the **target character model** it wants to hit. The server must validate **everything** before dealing 20 damage:

1. The target is an Instance, is a Model, and has a living Humanoid.
2. The target isn't the attacker's own character.
3. The attacker has a living character with a `HumanoidRootPart`.
4. The distance between the two root parts is at most **10 studs** (allow a small buffer for latency).
5. The attacker can attack at most once every **0.6 seconds**.

Write the full server handler. Bonus: print a warning (but don't kick) when a request fails the distance check by a large margin — a possible exploiter.
@hint
Get roots with `character:FindFirstChild("HumanoidRootPart")` and compare `(a.Position - b.Position).Magnitude`.
@hint
Check the cheap things (types, cooldown) before the expensive ones (distance), and return early on the first failure.
@solution
```roblox title="ServerScriptService › Combat"
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local attack = ReplicatedStorage:WaitForChild("Attack") :: RemoteEvent

local DAMAGE = 20
local RANGE = 10
local LATENCY_BUFFER = 3
local COOLDOWN = 0.6
local lastAttack: {[Player]: number} = {}

local function getLivingRoot(character: Model?): (Humanoid?, BasePart?)
	if not character then return nil, nil end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if humanoid and humanoid.Health > 0 and root and root:IsA("BasePart") then
		return humanoid, root
	end
	return nil, nil
end

attack.OnServerEvent:Connect(function(player, target)
	-- 1. Type checks
	if typeof(target) ~= "Instance" or not target:IsA("Model") then return end

	-- 5. Rate limit (cheap, so check early)
	local now = os.clock()
	if lastAttack[player] and now - lastAttack[player] < COOLDOWN then return end

	-- 2. Not yourself
	local character = player.Character
	if target == character then return end

	-- 3. Attacker alive
	local _, attackerRoot = getLivingRoot(character)
	if not attackerRoot then return end

	-- 1. Target alive
	local targetHumanoid, targetRoot = getLivingRoot(target)
	if not targetHumanoid or not targetRoot then return end

	-- 4. Distance
	local distance = (attackerRoot.Position - targetRoot.Position).Magnitude
	if distance > RANGE + LATENCY_BUFFER then
		if distance > RANGE * 3 then
			warn(`[Combat] {player.Name} attacked from {math.floor(distance)} studs away`)
		end
		return
	end

	lastAttack[player] = now
	targetHumanoid:TakeDamage(DAMAGE)
end)

Players.PlayerRemoving:Connect(function(player)
	lastAttack[player] = nil
end)
```
Note what the client *doesn't* send: the damage amount, the cooldown, or its own position. The server computes all of those.
:::

:::recap
- RemoteEvents: `FireServer` → `OnServerEvent(player, ...)`; `FireClient`/`FireAllClients` → `OnClientEvent(...)`.
- RemoteFunctions: `InvokeServer` yields for a reply from `OnServerInvoke`. Never `InvokeClient`.
- UnreliableRemoteEvents for frequent, loss-tolerant, tiny messages.
- Arguments are copied: metatables stripped, invisible Instances become `nil`, functions can't be sent. Send plain data.
- The `player` argument is trustworthy; **every other argument is not**. Validate type, value, existence, ownership, state, distance and rate.
- Send **intents**; the server computes prices, damage and rewards.
:::
