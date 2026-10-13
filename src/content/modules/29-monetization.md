---
id: monetization
title: Monetization
part: 5
summary: Earn Robux fairly and safely — game passes, developer products with a correct `ProcessReceipt`, purchase prompts, Premium benefits, and the policies you must follow.
time: 40 min
level: Intermediate
objectives:
- Check and grant game passes, including after an in-game purchase
- Sell developer products with an idempotent, data-safe `ProcessReceipt`
- Prompt purchases from the client and grant on the server
- Reward Premium subscribers
- Follow Roblox's rules for paid random items and fair design
---

Roblox games earn Robux through purchases players make inside them. Getting the code right matters twice over: players must **always** receive what they paid for, and exploiters must **never** get things for free.

## Game passes vs. developer products

| | Game pass | Developer product |
| --- | --- | --- |
| Bought | Once, owned forever | Any number of times |
| Examples | VIP, 2× coins, extra inventory slot | Coin packs, revives, skips |
| Check ownership | `UserOwnsGamePassAsync` | Not applicable — consumed |
| Granting | On join + on purchase | In `ProcessReceipt` |

Create both in the **Creator Dashboard** (or Studio's Monetization settings) to get their IDs.

## Game passes

```roblox
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local VIP_PASS = 123456789 -- your pass ID

local function hasPass(player: Player, passId: number): boolean
	local ok, owns = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, passId)
	return ok and owns
end

local function applyVip(player: Player)
	player:SetAttribute("VIP", true)
	-- e.g. give a chat tag, a VIP door, 2x coins (checked wherever coins are awarded)
end

Players.PlayerAdded:Connect(function(player)
	if hasPass(player, VIP_PASS) then
		applyVip(player)
	end
end)

-- Grant immediately when bought in-game
MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, wasPurchased)
	if wasPurchased and passId == VIP_PASS then
		applyVip(player)
	end
end)
```

Prompt the purchase from a client button (or the server) with `MarketplaceService:PromptGamePassPurchase(player, passId)`. The prompt itself is handled by Roblox; you only react to the result.

## Developer products and ProcessReceipt

When a developer product is bought, Roblox calls your server's **`MarketplaceService.ProcessReceipt`** callback with a receipt. Your job is to grant the item **and record that you did**, then return:

- `Enum.ProductPurchaseDecision.PurchaseGranted` — you've **durably** granted it. Roblox finalizes the purchase.
- `Enum.ProductPurchaseDecision.NotProcessedYet` — something failed. Roblox will **call again later** (e.g. when the player rejoins).

```roblox title="ServerScriptService › Purchases"
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local DataService = require(script.Parent.DataService) -- your session data module

local PRODUCTS: {[number]: (player: Player, data: any) -> ()} = {
	[11111111] = function(player, data) data.coins += 100 end,    -- 100 coins
	[22222222] = function(player, data) data.coins += 1000 end,   -- 1000 coins
	[33333333] = function(player, data)                           -- instant revive
		local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if humanoid then humanoid.Health = humanoid.MaxHealth end
	end,
}

MarketplaceService.ProcessReceipt = function(receipt)
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet  -- they left; try again next time
	end

	local data = DataService.get(player)
	local grant = PRODUCTS[receipt.ProductId]
	if not data or not grant then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	-- Idempotency: never grant the same purchase twice
	data.purchaseIds = data.purchaseIds or {}
	if data.purchaseIds[receipt.PurchaseId] then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end

	local ok = pcall(grant, player, data)
	if not ok then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	data.purchaseIds[receipt.PurchaseId] = true
	-- Ideally save now so the grant is durable before confirming
	return Enum.ProductPurchaseDecision.PurchaseGranted
end
```

:::danger ProcessReceipt rules
- Assign **one** `ProcessReceipt` callback for the whole game, on the server.
- Only return `PurchaseGranted` after the item is **actually granted and recorded** — ideally saved. If you return it and then fail to save, the player paid for nothing.
- Make it **idempotent**: Roblox may deliver the same receipt more than once. Store `PurchaseId`s you've processed (prune old ones occasionally).
- Never yield indefinitely inside it, and never trust the client to say a purchase happened.
:::

Prompt with `MarketplaceService:PromptProductPurchase(player, productId)`.

## Premium

Roblox pays creators **Premium Payouts** based on how much time Premium subscribers spend in their game. You can also give Premium members perks:

```roblox
if player.MembershipType == Enum.MembershipType.Premium then
	player:SetAttribute("PremiumBonus", true)
end
Players.PlayerMembershipChanged:Connect(function(player)
	-- re-check when they subscribe mid-session
end)
```

`MarketplaceService:PromptPremiumPurchase(player)` shows the upsell. Keep Premium perks cosmetic or convenience-based so non-Premium players aren't disadvantaged.

## Getting product info

`MarketplaceService:GetProductInfo(id, Enum.InfoType.GamePass)` (or `.Product`) returns name, description, price and icon — wrap it in `pcall` and cache the result, then show it in your shop UI so prices are never hard-coded twice.

## Policy and fair design

- **Paid random items** (loot boxes, gacha, crates bought with Robux or with currency bought with Robux) must show the **odds** before purchase, and must respect regional restrictions: check `PolicyService:GetPolicyInfoForPlayerAsync(player).ArePaidRandomItemsRestricted` and disable them where required.
- Don't misrepresent what a purchase gives, and deliver what you advertise.
- Avoid pay-to-win designs that make free players' experience miserable. Fair monetization (cosmetics, convenience, time-savers, supporter perks) keeps players around — and long-term players spend more.
- Follow Roblox's Community Standards and advertising rules; read the current terms in the Creator Hub, as policies evolve.

:::quiz Monetization
? Which do you use for a purchasable "+500 coins" that can be bought repeatedly?
+ A developer product
- A game pass
- A badge
- A RemoteEvent
> Developer products are consumable and handled in ProcessReceipt.

? When should `ProcessReceipt` return `PurchaseGranted`?
+ Only after the item has been granted and recorded
- Immediately, before granting
- Only on the client
- Never — Roblox grants automatically
> Returning it finalizes the purchase. Grant (and ideally save) first.

? Why store processed `PurchaseId`s?
+ Receipts can be delivered more than once; this prevents double-granting
- Roblox requires it to show the prompt
- To refund players
- To calculate Premium payouts
> Idempotency makes repeated deliveries harmless.

? A player bought a game pass mid-session. How do you grant it immediately?
+ Listen to `PromptGamePassPurchaseFinished` on the server
- Wait for them to rejoin
- Call `ProcessReceipt`
- Check every frame with `UserOwnsGamePassAsync`
> The event tells you right away; re-check on join for later sessions.

? What must paid random items do?
+ Disclose odds and respect `PolicyService` restrictions
- Always give a legendary item
- Be free for Premium users
- Use OrderedDataStores
> It's a Roblox policy requirement.
:::

## Challenges

:::challenge medium | 2× coins pass
Implement a `2x Coins` game pass: check ownership on join (with `pcall`), grant immediately on in-game purchase, and write `awardCoins(player, amount)` that doubles the amount for pass owners. Add a client button that prompts the purchase.
@solution
```roblox title="ServerScriptService › DoubleCoins"
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local PASS_ID = 123456789

local function grant(player: Player)
	player:SetAttribute("DoubleCoins", true)
end

Players.PlayerAdded:Connect(function(player)
	local ok, owns = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, PASS_ID)
	if ok and owns then grant(player) end
end)

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
	if purchased and passId == PASS_ID then grant(player) end
end)

local function awardCoins(player: Player, amount: number)
	local multiplier = if player:GetAttribute("DoubleCoins") then 2 else 1
	local coins = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Coins")
	if coins then coins.Value += amount * multiplier end
end
```
```roblox title="StarterGui › Shop › BuyPass (LocalScript)"
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local button = script.Parent :: TextButton

button.Activated:Connect(function()
	MarketplaceService:PromptGamePassPurchase(Players.LocalPlayer, 123456789)
end)
```
The attribute replicates, so the client can also show "2× active" in the UI — but only the server's `awardCoins` decides the amount.
:::

:::challenge hard | Bulletproof receipts
Extend the `ProcessReceipt` example so that each grant is **saved before** returning `PurchaseGranted`: call a `DataService.saveNow(player)` that returns `true` only if the save succeeded, and return `NotProcessedYet` otherwise. Keep at most the 50 most recent `PurchaseId`s in the player's data so it doesn't grow forever. Explain why this ordering protects players.
@solution
```roblox
MarketplaceService.ProcessReceipt = function(receipt)
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	local data = player and DataService.get(player)
	local grant = PRODUCTS[receipt.ProductId]
	if not player or not data or not grant then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	data.recentPurchases = data.recentPurchases or {}
	if table.find(data.recentPurchases, receipt.PurchaseId) then
		return Enum.ProductPurchaseDecision.PurchaseGranted -- already handled
	end

	local ok = pcall(grant, player, data)
	if not ok then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	table.insert(data.recentPurchases, receipt.PurchaseId)
	while #data.recentPurchases > 50 do
		table.remove(data.recentPurchases, 1)
	end

	if not DataService.saveNow(player) then
		-- Roll back the in-memory grant so a retry doesn't double it
		-- (or design grants to be applied only once per PurchaseId, as we do above).
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	return Enum.ProductPurchaseDecision.PurchaseGranted
end
```
If the server crashed after granting but before saving, the purchase would vanish — but because we only confirm *after* a successful save, Roblox retries the receipt later, and the stored `PurchaseId` prevents a double grant once it *was* saved.
:::

:::recap
- Game passes: owned forever — check with `UserOwnsGamePassAsync` on join and handle `PromptGamePassPurchaseFinished`.
- Developer products: consumable — one server `ProcessReceipt`, idempotent via `PurchaseId`, return `PurchaseGranted` only after granting and saving.
- Prompt from the client; grant on the server.
- Reward Premium players with fair perks.
- Disclose odds for paid random items and respect `PolicyService`.
:::
