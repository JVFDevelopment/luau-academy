---
id: datastores
title: DataStores & Saving Data
part: 5
summary: Save player progress safely — DataStoreService basics, UpdateAsync, retries, session data caches, autosave, BindToClose, schema defaults and migrations, ordered leaderboards, and avoiding data loss.
time: 55 min
level: Advanced
objectives:
- Read and write data with `GetAsync`, `SetAsync` and `UpdateAsync`
- Handle failures with `pcall`, retries and budgets
- Build a session-cache data system with autosave and `BindToClose`
- Never overwrite good data after a failed load
- Version your schema and fill in defaults for old saves
- Build global leaderboards with OrderedDataStores
---

Players expect their progress to be there next time. **DataStoreService** stores data on Roblox's servers, keyed by strings, and it's the most important system to get *right* — bugs here cause data loss, and data loss destroys trust in your game.

:::studio Enable API access in Studio
Data stores don't work in Studio until you enable **Game Settings → Security → Enable Studio Access to API Services** (the place must be published). Consider using a separate data store name in Studio so testing never touches real player data.
:::

## The basics

```roblox
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("PlayerData_v1")

local key = "Player_" .. player.UserId

-- Read
local ok, data = pcall(function()
	return store:GetAsync(key)
end)

-- Write (overwrites whatever is there)
local ok2, err = pcall(function()
	store:SetAsync(key, { coins = 100, level = 3 })
end)
```

- Data stores live on the **server** only.
- **Keys** identify records — use `UserId`, never names.
- **Values** can be numbers, strings, booleans, and tables of those (no Instances, no Vector3s/CFrames — convert them to numbers or arrays first). Each key holds up to about 4 MB.
- Every call can **fail** (network issues, throttling, Roblox outages). Always use `pcall`.
- Requests are rate-limited by a **budget** that scales with player count, and writes to the same key are limited to about one every 6 seconds. You can inspect budgets with `DataStoreService:GetRequestBudgetForRequestType(Enum.DataStoreRequestType.GetAsync)`.

## UpdateAsync: safe read-modify-write

`SetAsync` blindly overwrites. If two servers write the same key, one silently wins. `UpdateAsync` gives you the current stored value and lets you return the new one atomically:

```roblox
local ok, newCoins = pcall(function()
	return store:UpdateAsync("Global_Donations", function(old)
		return (old or 0) + 50
	end)
end)
```

Rules for the transform function:

- It may be called **more than once** if the value changed concurrently — keep it pure, with no side effects.
- It **must not yield**.
- Return `nil` to **cancel** the write.

Prefer `UpdateAsync` for player data saves too: it lets you check the stored value before overwriting (for example, to refuse to save if your session no longer "owns" the data).

## The session data pattern

You don't read and write the data store every time a player earns a coin. Instead:

:::steps
1. **Load once** when the player joins, into a server-side table (the *session cache*).
2. **Read and modify the cache** during play. It's instant and never fails.
3. **Save the cache** periodically (autosave), when the player leaves, and when the server shuts down.
:::

```roblox title="ServerScriptService › DataService (ModuleScript)"
--!strict
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local store = DataStoreService:GetDataStore("PlayerData_v1")

export type Data = {
	version: number,
	coins: number,
	level: number,
	inventory: {string},
}

local TEMPLATE: Data = { version = 2, coins = 0, level = 1, inventory = {} }

local DataService = {}
local sessions: {[Player]: Data} = {}
local loadFailed: {[Player]: boolean} = {}

local function deepCopy<T>(t: T): T
	if type(t) ~= "table" then return t end
	local out = {}
	for k, v in t :: any do
		out[k] = deepCopy(v)
	end
	return out :: any
end

-- Fill in missing fields from the template and upgrade old versions
local function reconcile(data: any): Data
	for key, value in TEMPLATE do
		if data[key] == nil then
			data[key] = deepCopy(value)
		end
	end
	if data.version < 2 then
		-- v1 stored "gold"; v2 renamed it to "coins"
		data.coins += (data.gold or 0)
		data.gold = nil
		data.version = 2
	end
	return data
end

local function retry<T>(attempts: number, fn: () -> T): (boolean, any)
	local lastErr
	for i = 1, attempts do
		local ok, result = pcall(fn)
		if ok then return true, result end
		lastErr = result
		task.wait(2 ^ (i - 1))
	end
	return false, lastErr
end

local function load(player: Player)
	local key = "Player_" .. player.UserId
	local ok, stored = retry(3, function()
		return store:GetAsync(key)
	end)
	if not player.Parent then return end -- left while we were loading

	if not ok then
		loadFailed[player] = true
		player:Kick("We couldn't load your data. Please rejoin in a moment — your progress is safe.")
		return
	end
	sessions[player] = reconcile(stored or deepCopy(TEMPLATE))
end

local function save(player: Player)
	local data = sessions[player]
	if not data or loadFailed[player] then
		return -- NEVER save if we didn't load successfully
	end
	local key = "Player_" .. player.UserId
	local ok, err = retry(3, function()
		return store:UpdateAsync(key, function()
			return data
		end)
	end)
	if not ok then
		warn(`[DataService] Failed to save {player.Name}: {err}`)
	end
end

function DataService.get(player: Player): Data?
	return sessions[player]
end

function DataService.Start()
	Players.PlayerAdded:Connect(load)
	for _, p in Players:GetPlayers() do task.spawn(load, p) end

	Players.PlayerRemoving:Connect(function(player)
		save(player)
		sessions[player] = nil
		loadFailed[player] = nil
	end)

	-- Autosave every 2 minutes
	task.spawn(function()
		while true do
			task.wait(120)
			for player in sessions do
				task.spawn(save, player)
			end
		end
	end)

	-- Save everyone before the server shuts down
	game:BindToClose(function()
		local pending = 0
		for player in sessions do
			pending += 1
			task.spawn(function()
				save(player)
				pending -= 1
			end)
		end
		while pending > 0 do
			task.wait()
		end
	end)
end

return DataService
```

### The rules that prevent data loss

:::danger Never save over data you failed to load
If `GetAsync` fails and you fall back to the default template, then save on leave — you just **replaced the player's real progress with a fresh save**. Track load failures and refuse to save (or kick the player so they can retry later). This single bug is the most common cause of "I lost all my stuff" reports.
:::

- **Deep-copy the template** for new players, or everyone shares one table (@tables).
- **Save on `PlayerRemoving`, on an interval, and in `BindToClose`.** Servers shut down for updates; `BindToClose` gives you up to about 30 seconds to finish saving — save players **in parallel**, as above.
- **Handle players leaving mid-load** (`if not player.Parent then return end`).
- **Version your data** and migrate old shapes forward when loading.
- **Don't store derived or huge data.** Store what you can't recompute.

## Session locking

If a player leaves one server and quickly joins another, the new server might load **before** the old server finished saving — loading stale data, which later overwrites the newer save. **Session locking** prevents this: the save record stores which server currently owns the session (and when), and other servers wait or refuse until the lock is released or expires — all done inside `UpdateAsync`.

Implementing robust locking is subtle. Most professional games use a battle-tested library such as **ProfileStore** (the successor to ProfileService), which handles locking, autosaving, reconciliation and `BindToClose` for you. Understanding the pattern above means you'll understand exactly what such libraries do.

## Leaderboards with OrderedDataStore

An **OrderedDataStore** stores only **numbers** and can return entries **sorted**:

```roblox
local wins = DataStoreService:GetOrderedDataStore("Wins_v1")

-- Write (usually when a player's wins change, or on save)
pcall(function()
	wins:SetAsync(tostring(player.UserId), totalWins)
end)

-- Read the top 10
local ok, pages = pcall(function()
	return wins:GetSortedAsync(false, 10)   -- false = descending
end)
if ok then
	for rank, entry in pages:GetCurrentPage() do
		print(rank, entry.key, entry.value)   -- key is the UserId string
	end
end
```

Refresh global leaderboards every minute or so — not every frame — and convert UserIds to names with `Players:GetNameFromUserIdAsync` (cache the results).

## Related services

- **MemoryStoreService** — fast, temporary, cross-server data (matchmaking queues, live global events, short-lived leaderboards). Data expires automatically. Covered in @services.
- **Data store versioning & listing** — `ListVersionsAsync`, `ListKeysAsync` and similar let you inspect and roll back data, which is invaluable when investigating support tickets.
- Respect privacy requests: when Roblox notifies you that a user's data must be erased, delete their keys.

:::quiz DataStores
? Why load player data once into a server-side table instead of calling `GetAsync` constantly?
+ Data store calls are slow, rate-limited and can fail; the cache is instant and reliable
- `GetAsync` only works once per player
- The cache saves automatically
- Clients can read the cache
> Load once, play from the cache, save periodically.

? `GetAsync` fails for a player. What must you NOT do?
- Retry
- Kick them with a friendly message
+ Fall back to default data and save it when they leave
- Log a warning
> Saving defaults over a failed load overwrites their real progress.

? Why prefer `UpdateAsync` over `SetAsync`?
+ It reads the current value and writes atomically, so you can check before overwriting
- It's the only function that saves tables
- It doesn't need `pcall`
- It ignores rate limits
> SetAsync blindly overwrites; UpdateAsync lets you reason about the stored value.

? What's true of the `UpdateAsync` transform function?
+ It may run multiple times and must not yield
- It runs exactly once and may yield
- It runs on the client
- It must return a string
> Keep it pure and fast; return nil to cancel.

? What is `game:BindToClose` for here?
+ Saving everyone's data before the server shuts down
- Closing the data store
- Kicking players
- Locking the session
> Servers shut down for updates; BindToClose gives you time to save.

? What does an OrderedDataStore store?
- Any table
+ Numbers, which can be retrieved sorted
- Only strings
- Instances
> Ideal for global leaderboards.
:::

## Challenges

:::challenge medium | Persistent coins
Using the session pattern, save a player's `Coins` leaderstat. Load it when they join (default 0), keep the session table and leaderstat in sync, save on leave, autosave every 60 seconds, and save in `BindToClose`. Never save if the load failed.
@hint
Store the value in your session table and update the IntValue from it whenever you change it — the session table is the source of truth.
@solution
```roblox title="ServerScriptService › CoinSaver"
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("Coins_v1")

local sessions: {[Player]: { coins: number }} = {}

local function setCoins(player: Player, amount: number)
	local data = sessions[player]
	if not data then return end
	data.coins = amount
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if coins then coins.Value = amount end
end

Players.PlayerAdded:Connect(function(player)
	local ok, stored = pcall(store.GetAsync, store, "Player_" .. player.UserId)
	if not player.Parent then return end
	if not ok then
		player:Kick("Data failed to load. Please rejoin.")
		return
	end

	sessions[player] = { coins = if type(stored) == "number" then stored else 0 }

	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = sessions[player].coins
	coins.Parent = ls
	ls.Parent = player
end)

local function save(player: Player)
	local data = sessions[player]
	if not data then return end -- not loaded → never save
	local ok, err = pcall(store.UpdateAsync, store, "Player_" .. player.UserId, function()
		return data.coins
	end)
	if not ok then warn("Save failed:", err) end
end

Players.PlayerRemoving:Connect(function(player)
	save(player)
	sessions[player] = nil
end)

task.spawn(function()
	while true do
		task.wait(60)
		for player in sessions do task.spawn(save, player) end
	end
end)

game:BindToClose(function()
	local pending = 0
	for player in sessions do
		pending += 1
		task.spawn(function()
			save(player)
			pending -= 1
		end)
	end
	while pending > 0 do task.wait() end
end)

-- Example: award coins through setCoins so cache and leaderstat stay in sync
-- setCoins(player, sessions[player].coins + 10)
```
:::

:::challenge hard | Global wins board
Create an OrderedDataStore of wins. Every 60 seconds, fetch the top 10 and display them on a SurfaceGui in the world as `1. Name — 42 wins`, resolving UserIds to usernames with a cache so each name is fetched only once per server. Handle failures without breaking the loop.
@solution
```roblox title="ServerScriptService › WinsBoard"
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local winsStore = DataStoreService:GetOrderedDataStore("Wins_v1")

local board = workspace:WaitForChild("Leaderboard")
local list = board:WaitForChild("SurfaceGui"):WaitForChild("List") :: TextLabel

local nameCache: {[number]: string} = {}

local function getName(userId: number): string
	if nameCache[userId] then return nameCache[userId] end
	local ok, name = pcall(Players.GetNameFromUserIdAsync, Players, userId)
	local result = if ok then name else "Unknown"
	nameCache[userId] = result
	return result
end

while true do
	local ok, pages = pcall(winsStore.GetSortedAsync, winsStore, false, 10)
	if ok then
		local lines = {}
		for rank, entry in pages:GetCurrentPage() do
			local userId = tonumber(entry.key)
			local name = if userId then getName(userId) else entry.key
			table.insert(lines, `{rank}. {name} — {entry.value} wins`)
		end
		list.Text = table.concat(lines, "\n")
	else
		warn("Leaderboard refresh failed:", pages)
	end
	task.wait(60)
end
```
:::

:::recap
- Data stores are server-only, keyed by strings (use `UserId`), store plain data, and **every call can fail** — use `pcall` and retries.
- Load once into a session cache; play from the cache; save on leave, on an interval and in `BindToClose`.
- **Never save after a failed load.** Deep-copy templates. Version and reconcile data.
- Prefer `UpdateAsync`; its callback may rerun and must not yield.
- Session locking prevents cross-server overwrites — libraries like ProfileStore handle it.
- OrderedDataStores power global leaderboards.
:::
