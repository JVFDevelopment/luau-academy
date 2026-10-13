---
id: security
title: Security & Anti-Exploit
part: 6
summary: Think like an exploiter to protect your game — what cheaters can actually do, server authority, validating remotes, NaN and type tricks, movement sanity checks, backdoors in free models, and economy safety.
time: 45 min
level: Advanced
objectives:
- Know exactly what an exploiter can and can't do
- Apply server authority to every gameplay decision
- Defeat malformed input: wrong types, NaN, infinity, huge strings and tables
- Add movement and action sanity checks without false positives
- Spot backdoors in free models and plugins
- Protect your economy from duplication and race conditions
---

Every popular Roblox game is attacked. Exploiters use tools that let them run their own Luau code **on their client**. You can't stop that — but you can make it useless, by never letting the client decide anything that matters.

## What exploiters can do

| They CAN | They CAN'T |
| --- | --- |
| Run any code on their own client | Run code on the server (unless you give them a way) |
| Read every LocalScript and ModuleScript that's replicated to them | Read `ServerScriptService` or `ServerStorage` |
| Fire any RemoteEvent / invoke any RemoteFunction with **any arguments**, at any rate | Fake the `player` argument on the server |
| Change anything on their client: UI, local parts, their own character | Directly change what other players see (except via owned physics) |
| Move their character anywhere: speed, fly, teleport, noclip | Change server-side values like leaderstats directly |
| Move unanchored parts they have network ownership of | Bypass your server-side checks |

The lesson: **the server is your only trusted environment.** Every rule that matters must be enforced there.

## Server authority

For every feature, ask: *"If a cheater sent the worst possible request, what would happen?"*

| Feature | Insecure | Secure |
| --- | --- | --- |
| Shop | Client sends price | Client sends item ID; server looks up price and checks balance |
| Combat | Client sends damage | Server computes damage from the equipped weapon; validates range and cooldown |
| Rewards | Client says "I finished the obby" | Server tracks checkpoints in order, checks timing |
| Trading | Client sends final inventories | Server holds both offers, validates ownership, swaps atomically |
| Cooldowns | Enforced in a LocalScript | Enforced (also) on the server |

Client-side checks are still nice for responsiveness and UX — just never *rely* on them.

## Validating input

From @remotes, every argument after `player` is untrusted. Beyond basic `typeof` checks, exploiters send nasty edge cases:

```roblox
local function isFiniteNumber(x: unknown): boolean
	return typeof(x) == "number" and x == x and x ~= math.huge and x ~= -math.huge
end

local function isValidAmount(x: unknown, max: number): boolean
	return isFiniteNumber(x) and x :: number >= 1 and x :: number <= max and (x :: number) % 1 == 0
end
```

:::danger The NaN trap
NaN (`0/0`) is a number, so it passes `typeof(x) == "number"`. Every comparison with NaN is **false** — so `if amount < 0 then return end` lets it through, and `coins - NaN` turns a player's coins into NaN, which can break saves and leaderboards. Check `x ~= x`, or validate with *positive* conditions (`amount >= 1 and amount <= max`), which NaN fails.
:::

Other things to validate:

- **Strings** — maximum length (`#s` and `utf8.len`), allowed characters, filtering for display.
- **Tables** — the expected shape only; don't iterate a giant attacker-supplied table; cap sizes.
- **Instances** — `typeof(x) == "Instance"`, `IsA`, and that it's *the kind of thing you expect where you expect it* (e.g. `x:IsDescendantOf(workspace.Shops)`), and that the player is allowed to use it.
- **Enums / IDs** — look them up in a server-side table instead of trusting them: `CONFIG.Items[id]`.

## Rate limits and cooldowns

Any action a human does a few times a second, a script can do thousands of times. Enforce cooldowns **on the server** for abilities, purchases, chat-like features and anything that touches data stores. Use per-player timestamps or token buckets (@remotes). Clean up per-player tables on leave.

## Movement checks

Because characters are client-owned, speed hacks and teleports are possible. A simple, careful server check:

```roblox
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local lastPos: {[Player]: Vector3} = {}
local strikes: {[Player]: number} = {}
local MAX_SPEED = 40       -- generous: walk speed + dashes + latency
local CHECK_EVERY = 0.5

local elapsed = 0
RunService.Heartbeat:Connect(function(dt)
	elapsed += dt
	if elapsed < CHECK_EVERY then return end
	local window = elapsed
	elapsed = 0

	for _, player in Players:GetPlayers() do
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root then
			local prev = lastPos[player]
			local pos = root.Position
			if prev then
				local flat = Vector3.new(pos.X - prev.X, 0, pos.Z - prev.Z).Magnitude
				if flat / window > MAX_SPEED then
					strikes[player] = (strikes[player] or 0) + 1
					root.CFrame = CFrame.new(prev)        -- rubber-band back
					if strikes[player] >= 5 then
						warn(`[AntiCheat] {player.Name} moving too fast`)
					end
				else
					strikes[player] = math.max(0, (strikes[player] or 0) - 0.25)
				end
			end
			lastPos[player] = root.Position
		end
	end
end)

Players.PlayerRemoving:Connect(function(p) lastPos[p] = nil strikes[p] = nil end)
```

:::warning Avoid false positives
Lag spikes, legitimate teleports (your own spawn/teleport code), vehicles, launch pads and knockback all create fast movement. Be **generous**, whitelist your own teleports (e.g. update `lastPos` when *you* move a player), prefer **correcting** (rubber-banding) over **punishing**, and log before you kick. Banning innocent players is worse than missing a cheater.
:::

## Backdoors and malicious assets

Free models, plugins and packages can contain hidden scripts that give their author control of your game — often via `require(someAssetId)` with an obfuscated ID, `getfenv`, or `loadstring`. Before using third-party assets:

- Search the model for every `Script`, `LocalScript` and `ModuleScript` (Explorer search: `ClassName:Script` or filter by class) and read them.
- Be suspicious of `require(<number>)`, long obfuscated strings, `getfenv`/`setfenv`, `loadstring`, and scripts hidden deep inside meshes or welds.
- Keep `LoadStringEnabled` **off** (`ServerScriptService` property) unless you absolutely need it.
- Only install plugins from creators you trust; review the permissions plugins request (script injection, HTTP).

## Economy safety

- **Single source of truth.** Currency lives in the server's session data; leaderstats are a display copy.
- **Atomic operations.** When trading or crafting, check *and* modify in one step without yielding in between, so two requests can't both pass the check before either deducts ("double spend").
- **Unique IDs** (`HttpService:GenerateGUID`) for valuable items let you trace and remove duplicates.
- **Log** large transactions server-side (to analytics or your own webhook via a server-side proxy) so you can investigate.
- **Don't save during a trade** half-way; commit the whole swap, then save.

```roblox
-- ❌ Race: two simultaneous requests can both pass the check before either deducts
if data.coins >= price then
	task.wait()            -- any yield here is dangerous
	data.coins -= price
end

-- ✅ Check and modify together, no yield in between
if data.coins >= price then
	data.coins -= price
	grant(item)
end
```

## Defense in depth

No single check stops everything. Layer them: strict remote validation, server-side cooldowns, sanity checks on movement and rates, server-owned physics for important objects, secrets kept server-side, careful asset hygiene, and logging so you can notice and respond. And keep your game fun for honest players — that's the real goal.

:::quiz Security
? An exploiter fires your `BuyItem` remote with `price = -99999`. Which design is immune?
+ The server ignores client prices and looks up its own
- Checking `price ~= nil`
- Hiding the remote in a folder named "Secret"
- Checking on the client that price is positive
> Never accept values the server should compute.

? Why does `if amount < 0 then return end` fail to stop NaN?
+ Every comparison with NaN is false, so the check passes NaN through
- NaN is negative
- NaN isn't a number type
- Luau converts NaN to 0
> Validate with positive conditions or `x ~= x`.

? Can an exploiter read your LocalScripts and ModuleScripts in ReplicatedStorage?
+ Yes
- No, they're compiled
- Only in Studio
- Only if the game is uncopylocked
> Anything replicated to the client can be read.

? What's the safest response when a player trips a movement check?
+ Correct their position (rubber-band) and log; act harshly only on repeated, clear violations
- Kick immediately
- Ban permanently
- Ignore it
> False positives from lag are common; prefer correction and evidence.

? Which is a red flag in a free model?
+ `require(84719384)` hidden inside a part
- A WeldConstraint
- A MeshPart
- A SurfaceAppearance
> Requiring an asset ID can load arbitrary code from someone else.
:::

## Challenges

:::challenge medium | Harden a remote
This handler is full of holes. Rewrite it securely.

```roblox
giftRemote.OnServerEvent:Connect(function(player, targetName, amount)
	local target = game.Players[targetName]
	player.leaderstats.Coins.Value -= amount
	target.leaderstats.Coins.Value += amount
end)
```

List every attack you're defending against in comments.
@solution
```roblox
local Players = game:GetService("Players")
local MAX_GIFT = 10000
local COOLDOWN = 5
local lastGift: {[Player]: number} = {}

local function coinsOf(p: Player): IntValue?
	local ls = p:FindFirstChild("leaderstats")
	return ls and ls:FindFirstChild("Coins") :: IntValue?
end

giftRemote.OnServerEvent:Connect(function(player, targetUserId, amount)
	-- Rate limiting: spam / economy scripting
	local now = os.clock()
	if lastGift[player] and now - lastGift[player] < COOLDOWN then return end

	-- Types: wrong types, NaN, infinity, decimals, negative (steal coins), huge values
	if typeof(targetUserId) ~= "number" or typeof(amount) ~= "number" then return end
	if amount ~= amount or amount % 1 ~= 0 or amount < 1 or amount > MAX_GIFT then return end

	-- Target must be a real, different player in this server (no self-gifts, no name tricks)
	local target = Players:GetPlayerByUserId(targetUserId)
	if not target or target == player then return end

	local fromCoins, toCoins = coinsOf(player), coinsOf(target)
	if not fromCoins or not toCoins then return end

	-- Can't gift more than you have; check-and-modify with no yield in between
	if fromCoins.Value < amount then return end
	lastGift[player] = now
	fromCoins.Value -= amount
	toCoins.Value += amount
end)

Players.PlayerRemoving:Connect(function(p) lastGift[p] = nil end)
```
In a real game, modify the server-side session data (the source of truth), then update leaderstats from it.
:::

:::challenge hard | Obby checkpoint validation
An obby awards 500 coins for finishing. Design the server-side logic so that finishing only counts if the player touched every checkpoint **in order** (`Checkpoint1` … `Checkpoint10`) during the current life, and took at least 60 seconds (the fastest legitimate time). Reset progress on death. Explain how this defeats teleport exploits.
@solution
```roblox title="ServerScriptService › ObbyValidation"
local Players = game:GetService("Players")
local checkpoints = workspace:WaitForChild("Checkpoints")
local finish = workspace:WaitForChild("Finish") :: BasePart
local COUNT, MIN_TIME, REWARD = 10, 60, 500

local progress: {[Player]: { next: number, startedAt: number }} = {}

local function playerFromHit(hit: BasePart): Player?
	local character = hit:FindFirstAncestorOfClass("Model")
	return character and Players:GetPlayerFromCharacter(character)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(character)
		progress[player] = { next = 1, startedAt = os.clock() }
		local humanoid = character:WaitForChild("Humanoid") :: Humanoid
		humanoid.Died:Once(function()
			progress[player] = nil
		end)
	end)
end)

for i = 1, COUNT do
	local cp = checkpoints:WaitForChild("Checkpoint" .. i) :: BasePart
	cp.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		local p = player and progress[player]
		if p and p.next == i then
			p.next = i + 1
		end
	end)
end

finish.Touched:Connect(function(hit)
	local player = playerFromHit(hit)
	local p = player and progress[player]
	if not player or not p or p.next ~= COUNT + 1 then return end
	if os.clock() - p.startedAt < MIN_TIME then
		warn(`[Obby] {player.Name} finished impossibly fast`)
		return
	end
	progress[player] = nil -- one reward per life
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if coins then coins.Value += REWARD end
end)

Players.PlayerRemoving:Connect(function(p) progress[p] = nil end)
```
A teleporting exploiter can touch the finish instantly — but the server only pays out if every checkpoint was touched in order **and** a realistic amount of time passed. To cheat, they'd effectively have to complete the obby.
:::

:::recap
- Exploiters control their client completely and can call any remote with any arguments. The server is the only trusted environment.
- Enforce every rule on the server: prices, damage, rewards, cooldowns, ownership.
- Validate types **and** values — watch for NaN, infinity, decimals, huge strings and tables.
- Sanity-check movement generously; correct before punishing; whitelist your own teleports.
- Audit third-party assets for backdoors (`require(id)`, obfuscation, `loadstring`).
- Keep the economy atomic, logged and server-owned.
:::
