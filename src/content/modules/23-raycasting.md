---
id: raycasting
title: Raycasting & Spatial Queries
part: 4
summary: Ask the world questions — what's in this direction, what's inside this box, what's within this radius — for guns, line of sight, ground checks, placement and hitboxes.
time: 40 min
level: Intermediate
objectives:
- Cast rays with `workspace:Raycast` and read `RaycastResult`
- Filter rays with `RaycastParams`
- Cast thick shapes with `Blockcast`, `Spherecast` and `Shapecast`
- Find parts in a region with `GetPartBoundsInBox`, `GetPartBoundsInRadius` and `GetPartsInPart`
- Build hitscan weapons, line-of-sight checks and mouse-aimed tools
---

**Raycasting** fires an invisible line through the world and tells you the first thing it hits. **Spatial queries** ask "what's inside this volume?". Together they power guns, lasers, line-of-sight checks, ground detection, building placement and melee hitboxes.

## Your first raycast

```roblox
local origin = Vector3.new(0, 10, 0)
local direction = Vector3.new(0, -50, 0)   -- straight down, 50 studs long

local result = workspace:Raycast(origin, direction)
if result then
	print("Hit", result.Instance:GetFullName(), "at", result.Position)
else
	print("Hit nothing")
end
```

The **direction's length is the maximum distance**. To cast 100 studs toward a target: `(target - origin).Unit * 100`.

`Raycast` returns `nil` if nothing was hit, or a `RaycastResult`:

| Field | Meaning |
| --- | --- |
| `Instance` | The part (or Terrain) that was hit |
| `Position` | The exact hit point |
| `Normal` | The surface direction at the hit point (perpendicular to the surface) |
| `Material` | The material at the hit point |
| `Distance` | Distance from origin to the hit |

## Filtering with RaycastParams

Rays usually need to ignore things — like the shooter's own character:

```roblox
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { shooterCharacter, workspace.Effects }
params.IgnoreWater = true

local result = workspace:Raycast(origin, direction, params)
```

- `Exclude` ignores the listed Instances and their descendants; `Include` hits **only** them.
- `CollisionGroup` makes the ray respect a collision group's rules; `RespectCanCollide` skips non-collidable parts.
- Parts with `CanQuery = false` are always ignored by rays and queries — set it on decorative parts.

:::pro Reuse params
Creating `RaycastParams` every frame is wasteful. Create them once and update the filter when needed (`params:AddToFilter(instance)` appends to the list).
:::

## Shapecasts

A ray is infinitely thin, so it can slip through gaps. **Shapecasts** sweep a volume along a direction:

```roblox
local hit = workspace:Spherecast(origin, 2, direction, params)                  -- a ball of radius 2
local hit2 = workspace:Blockcast(CFrame.new(origin), Vector3.new(4, 4, 4), direction, params)
local hit3 = workspace:Shapecast(somePart, direction, params)                   -- sweep a part's shape
```

They return the same `RaycastResult`. Use them for thick projectiles, character-sized movement checks and forgiving melee swings.

## Spatial queries

Instead of a line, ask what's **inside** a region:

| Method | Region |
| --- | --- |
| `workspace:GetPartBoundsInBox(cframe, size, overlapParams)` | A box (fast, uses bounding boxes) |
| `workspace:GetPartBoundsInRadius(position, radius, overlapParams)` | A sphere (fast, uses bounding boxes) |
| `workspace:GetPartsInPart(part, overlapParams)` | The exact shape of a part (precise) |

```roblox
local overlap = OverlapParams.new()
overlap.FilterType = Enum.RaycastFilterType.Exclude
overlap.FilterDescendantsInstances = { attackerCharacter }

-- Explosion: everything within 12 studs
for _, part in workspace:GetPartBoundsInRadius(center, 12, overlap) do
	local humanoid = part.Parent and part.Parent:FindFirstChildOfClass("Humanoid")
	-- (collect unique humanoids — several parts belong to each character!)
end
```

Because a character has many parts, queries return many hits per character. **De-duplicate** by Humanoid or character before applying damage.

:::tip Zones without Touched
For "is the player standing in this zone?", calling `GetPartsInPart(zonePart)` a few times per second is far more reliable than `Touched`/`TouchEnded`.
:::

## Hitscan weapons

A "hitscan" gun hits instantly along a ray. The client handles aiming and visuals; the **server** validates and decides damage:

```roblox title="LocalScript (in a Tool)"
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local camera = workspace.CurrentCamera
local tool = script.Parent
local shoot = tool:WaitForChild("Shoot") :: RemoteEvent

tool.Activated:Connect(function()
	local mouse = UserInputService:GetMouseLocation()
	local ray = camera:ViewportPointToRay(mouse.X, mouse.Y)
	shoot:FireServer(ray.Origin + ray.Direction * 500)   -- send the aim POINT, not a hit
end)
```

```roblox title="Script (in the Tool)"
local tool = script.Parent
local shoot = tool:WaitForChild("Shoot") :: RemoteEvent
local RANGE, DAMAGE = 300, 25
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude

shoot.OnServerEvent:Connect(function(player, aimPoint)
	if typeof(aimPoint) ~= "Vector3" then return end
	local character = player.Character
	local handle = tool:FindFirstChild("Handle") :: BasePart?
	if not character or not handle or tool.Parent ~= character then return end

	params.FilterDescendantsInstances = { character }
	local origin = handle.Position
	local direction = (aimPoint - origin).Unit * RANGE
	local result = workspace:Raycast(origin, direction, params)
	if not result then return end

	local humanoid = result.Instance.Parent and result.Instance.Parent:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid:TakeDamage(DAMAGE)
	end
end)
```

The server re-casts from the **gun's real position** — the client only influences *where it aims*. (Competitive games add lag compensation and fire-rate checks on top; see @security.)

## Line of sight

```roblox
local function hasLineOfSight(fromPos: Vector3, target: Model, ignore: {Instance}): boolean
	local targetRoot = target:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not targetRoot then return false end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = ignore
	local result = workspace:Raycast(fromPos, targetRoot.Position - fromPos, params)
	return result ~= nil and result.Instance:IsDescendantOf(target)
end
```

Combine it with the vision cone from @cframes and you have the core of NPC perception.

:::quiz Raycasting
? What determines how far a raycast travels?
+ The length of the direction vector
- A `MaxDistance` property
- Always 1000 studs
- The size of the origin part
> Scale the unit direction by the range you want.

? What does `workspace:Raycast` return when nothing is hit?
- An empty RaycastResult
+ `nil`
- `false`
- It errors
> Always check the result before using it.

? How do you stop a gun's ray from hitting the shooter?
+ Add the shooter's character to `FilterDescendantsInstances` with `FilterType = Exclude`
- Make the character transparent
- Raycast from the client only
- Set the character's `CanCollide` to false
> Exclude filters ignore the listed Instances and their descendants.

? An explosion query returns 15 parts from 1 character. What should you do?
- Damage each part's Humanoid 15 times
+ De-duplicate by Humanoid before applying damage
- Ignore characters entirely
- Use a ray instead
> Track which Humanoids you've already damaged in a set.

? What should a client send to the server when firing a hitscan gun?
- The Humanoid it hit and the damage
+ Where it's aiming; the server raycasts and decides
- Its coin balance
- Nothing at all
> The server validates and computes the hit from trusted positions.
:::

## Challenges

:::challenge easy | Ground check
Write `isGrounded(character)` that casts a ray 4 studs straight down from the `HumanoidRootPart`, ignoring the character, and returns `true` plus the material it hit. Print the material under each player every second.
@solution
```roblox
local Players = game:GetService("Players")

local function isGrounded(character: Model): (boolean, Enum.Material?)
	local root = character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then return false, nil end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { character }
	local result = workspace:Raycast(root.Position, Vector3.new(0, -4, 0), params)
	if result then
		return true, result.Material
	end
	return false, nil
end

while true do
	task.wait(1)
	for _, player in Players:GetPlayers() do
		if player.Character then
			print(player.Name, isGrounded(player.Character))
		end
	end
end
```
:::

:::challenge medium | Explosion damage with falloff
Write `explode(position, radius, maxDamage)` that finds every Humanoid within `radius`, damages each **once**, with damage falling off linearly from `maxDamage` at the center to 0 at the edge (based on root-part distance), and applies an outward impulse to each character's root part.
@hint
Use `GetPartBoundsInRadius`, then a `seen` set keyed by Humanoid.
@solution
```roblox
local function explode(position: Vector3, radius: number, maxDamage: number)
	local seen: {[Humanoid]: boolean} = {}
	for _, part in workspace:GetPartBoundsInRadius(position, radius) do
		local model = part:FindFirstAncestorOfClass("Model")
		local humanoid = model and model:FindFirstChildOfClass("Humanoid")
		local root = model and model:FindFirstChild("HumanoidRootPart") :: BasePart?
		if humanoid and root and not seen[humanoid] then
			seen[humanoid] = true
			local offset = root.Position - position
			local falloff = 1 - math.clamp(offset.Magnitude / radius, 0, 1)
			humanoid:TakeDamage(maxDamage * falloff)
			if offset.Magnitude > 0.01 then
				root:ApplyImpulse(offset.Unit * 60 * root.AssemblyMass * falloff)
			end
		end
	end
end
```
:::

:::challenge hard | Building placement preview
On the client, show a semi-transparent preview block that follows the mouse, snapped to a 4-stud grid, sitting **on top of** whatever surface the mouse points at (use the hit `Position` and `Normal`). Turn it red when it would overlap another part (check with `GetPartsInPart` on a slightly shrunk copy) and green otherwise. Clicking only prints whether placement is valid — the real placement would be a server-validated remote.
@hint
Ray from the camera with `ViewportPointToRay`. Place the block center at `hit.Position + hit.Normal * (blockSize / 2)`, then round each axis to the grid.
@solution
```roblox title="StarterPlayerScripts › PlacementPreview"
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local camera = workspace.CurrentCamera
local GRID, SIZE = 4, 4

local preview = Instance.new("Part")
preview.Size = Vector3.one * SIZE
preview.Anchored = true
preview.CanCollide = false
preview.CanQuery = false
preview.Transparency = 0.5
preview.Parent = workspace

local checker = Instance.new("Part")
checker.Size = Vector3.one * (SIZE - 0.2)
checker.Anchored = true
checker.CanCollide = false
checker.CanQuery = false
checker.Transparency = 1
checker.Parent = workspace

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local overlap = OverlapParams.new()
overlap.FilterType = Enum.RaycastFilterType.Exclude

local valid = false
local function snap(v: number) return math.round(v / GRID) * GRID end

RunService.RenderStepped:Connect(function()
	local character = game:GetService("Players").LocalPlayer.Character
	rayParams.FilterDescendantsInstances = { preview, checker, character }
	overlap.FilterDescendantsInstances = { preview, checker, character }

	local mouse = UserInputService:GetMouseLocation()
	local ray = camera:ViewportPointToRay(mouse.X, mouse.Y)
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 500, rayParams)
	if not hit then
		preview.Transparency = 1
		valid = false
		return
	end

	local center = hit.Position + hit.Normal * (SIZE / 2)
	local snapped = Vector3.new(snap(center.X), snap(center.Y), snap(center.Z))
	preview.Position = snapped
	checker.Position = snapped
	valid = #workspace:GetPartsInPart(checker, overlap) == 0
	preview.Transparency = 0.5
	preview.Color = if valid then Color3.fromRGB(80, 220, 120) else Color3.fromRGB(230, 70, 70)
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.UserInputType == Enum.UserInputType.MouseButton1 then
		print("Place here?", valid, preview.Position)
	end
end)
```
:::

:::recap
- `workspace:Raycast(origin, direction, params)` → `RaycastResult` (`Instance`, `Position`, `Normal`, `Material`, `Distance`) or `nil`.
- Direction length = range. Filter with reusable `RaycastParams` (Exclude/Include); `CanQuery = false` hides parts from queries.
- Shapecasts (`Spherecast`, `Blockcast`, `Shapecast`) sweep volumes.
- Region queries: `GetPartBoundsInBox`, `GetPartBoundsInRadius`, `GetPartsInPart` — de-duplicate characters.
- Clients aim; servers raycast and decide.
:::
