---
id: cframes
title: Vector3, CFrame & 3D Math
part: 4
summary: The math of 3D worlds — vectors, distances, directions, dot and cross products, and CFrames for position plus rotation, including local vs. world space.
time: 50 min
level: Intermediate
objectives:
- Do vector arithmetic and compute distances and directions
- Use `Magnitude`, `Unit`, `Dot`, `Cross` and `Lerp`
- Build CFrames with `new`, `lookAt`, `Angles` and `fromAxisAngle`
- Understand that CFrame multiplication applies *local* transforms
- Convert between object space and world space
- Solve classic problems: facing, orbiting, offsets and "is it in front of me?"
---

Every position, direction, velocity and rotation in a Roblox world is described with **Vector3** and **CFrame**. This module gives you the 3D intuition that combat, cameras, NPCs and building systems all rely on.

## Vector3

A `Vector3` has `X`, `Y` and `Z` components. Roblox is **Y-up**: Y is height.

```roblox
local a = Vector3.new(1, 2, 3)
local b = Vector3.new(4, 6, 3)

print(a + b)          --> 5, 8, 6
print(b - a)          --> 3, 4, 0
print(a * 2)          --> 2, 4, 6
print(a.X, a.Y, a.Z)  --> 1 2 3
```

Handy constants: `Vector3.zero`, `Vector3.one`, `Vector3.xAxis`, `Vector3.yAxis`, `Vector3.zAxis`.

### Distance and direction

The vector **from A to B** is `B - A`. Its length is the **distance**; its unit version is the **direction**:

```roblox
local offset = targetPos - myPos
local distance = offset.Magnitude      -- length in studs
local direction = offset.Unit          -- length 1, pointing at the target
```

`Magnitude` is the most common calculation in game code: "is the player within 10 studs of the chest?"

```roblox
if (root.Position - chest.Position).Magnitude <= 10 then
	-- close enough to open
end
```

:::warning Unit of a zero vector
`Vector3.zero.Unit` is `NaN, NaN, NaN`. Before normalizing, make sure the vector isn't zero — for example when a target is exactly at your position.
:::

### Moving toward a point

```roblox
-- Move 5 studs from 'from' toward 'to'
local newPos = from + (to - from).Unit * 5

-- Halfway point
local midpoint = from:Lerp(to, 0.5)
```

### Dot product

`a:Dot(b)` multiplies matching components and adds them. For **unit** vectors it equals the cosine of the angle between them:

| `a:Dot(b)` for unit vectors | Meaning |
| --- | --- |
| `1` | Same direction |
| `0` | Perpendicular |
| `-1` | Opposite directions |

That makes "is the target in front of me?" a one-liner:

```roblox
local toTarget = (target.Position - root.Position).Unit
local facing = root.CFrame.LookVector
local inFront = facing:Dot(toTarget) > 0.5   -- within ~60° of straight ahead
```

### Cross product

`a:Cross(b)` returns a vector **perpendicular** to both. It's used to build orientations (e.g. a "right" vector from forward and up) and to find a surface's sideways direction.

## CFrame

A **CFrame** ("coordinate frame") stores a **position and a rotation** together. Every BasePart has one, and setting `part.CFrame` moves *and* rotates it at once.

```roblox
local cf = part.CFrame
print(cf.Position)       -- where it is
print(cf.LookVector)     -- its forward direction (the -Z axis)
print(cf.RightVector)    -- its right (+X)
print(cf.UpVector)       -- its up (+Y)
print(cf.Rotation)       -- the rotation only, with position zero
```

### Building CFrames

| Constructor | Result |
| --- | --- |
| `CFrame.new(x, y, z)` / `CFrame.new(vec)` | Position with no rotation |
| `CFrame.lookAt(pos, target)` | At `pos`, facing `target` |
| `CFrame.Angles(rx, ry, rz)` | Rotation only, in **radians** (X, then Y, then Z) |
| `CFrame.fromAxisAngle(axis, angle)` | Rotate around an arbitrary axis |
| `CFrame.fromOrientation(rx, ry, rz)` | Rotation matching the Properties window's `Orientation` |
| `CFrame.identity` | No position, no rotation |

```roblox
-- Place a part 10 studs up, rotated 45° around Y
part.CFrame = CFrame.new(0, 10, 0) * CFrame.Angles(0, math.rad(45), 0)

-- Make a turret face the player
turret.CFrame = CFrame.lookAt(turret.Position, playerRoot.Position)
```

## Multiplication = local transforms

The most important CFrame rule: **`cf * other` applies `other` relative to `cf`** — in `cf`'s own local space.

```roblox
-- 5 studs in front of the part, wherever it faces
local inFront = part.CFrame * CFrame.new(0, 0, -5)

-- Spin the part 10° around its OWN up axis
part.CFrame = part.CFrame * CFrame.Angles(0, math.rad(10), 0)

-- A point 3 studs to the part's right, as a world position
local worldPoint = part.CFrame * Vector3.new(3, 0, 0)
```

Order matters — CFrame multiplication is **not commutative**:

- `cf * CFrame.Angles(...)` rotates around the part's **own** center and axes.
- `CFrame.Angles(...) * cf` rotates the part around the **world origin**, swinging it in a big arc.

:::tip Forward is -Z
In local space, "forward" is negative Z. `CFrame.new(0, 0, -5)` means "5 studs ahead" and `LookVector` points along -Z.
:::

## Object space and world space

Sometimes you need to go the other way: "where is the player **relative to** this door?"

| Method | Converts |
| --- | --- |
| `cf:ToObjectSpace(otherCf)` | A world CFrame → relative to `cf` |
| `cf:ToWorldSpace(localCf)` | A relative CFrame → world (same as `cf * localCf`) |
| `cf:PointToObjectSpace(v)` | A world position → local coordinates |
| `cf:PointToWorldSpace(v)` | A local position → world (same as `cf * v`) |
| `cf:VectorToObjectSpace(v)` / `VectorToWorldSpace(v)` | Directions (ignore position) |
| `cf:Inverse()` | The opposite transform |

```roblox
local localPos = door.CFrame:PointToObjectSpace(root.Position)
if localPos.Z < 0 then
	print("Player is in front of the door")
else
	print("Player is behind the door")
end
```

A classic use: **welding-free attachment offsets**. Store `offset = base.CFrame:ToObjectSpace(item.CFrame)` once; later, `item.CFrame = base.CFrame * offset` puts the item back in the same relative spot, however the base has moved.

## Classic recipes

```roblox
-- Orbit: place 8 parts in a circle around a center, all facing it
for i = 0, 7 do
	local angle = i / 8 * math.pi * 2
	local pos = center + Vector3.new(math.cos(angle), 0, math.sin(angle)) * 20
	local p = Instance.new("Part")
	p.Anchored = true
	p.CFrame = CFrame.lookAt(pos, center)
	p.Parent = workspace
end

-- Face a target but stay upright (ignore height difference)
local flatTarget = Vector3.new(target.X, root.Position.Y, target.Z)
root.CFrame = CFrame.lookAt(root.Position, flatTarget)

-- Rotate in place around the WORLD Y axis, keeping position
part.CFrame = CFrame.new(part.Position) * CFrame.Angles(0, math.rad(90), 0) * part.CFrame.Rotation

-- Smoothly blend between two CFrames
part.CFrame = startCf:Lerp(endCf, 0.3)
```

:::quiz 3D math
? How do you get the distance between two positions `a` and `b`?
+ `(b - a).Magnitude`
- `a:Dot(b)`
- `(b - a).Unit`
- `a.Magnitude - b.Magnitude`
> Subtract to get the offset vector, then take its length.

? For unit vectors, `a:Dot(b) == -1` means…
- They're perpendicular
- They're identical
+ They point in opposite directions
- One of them is zero
> Dot product of unit vectors is the cosine of the angle between them.

? `part.CFrame * CFrame.new(0, 0, -5)` gives…
+ A CFrame 5 studs in front of the part, in the direction it faces
- A CFrame 5 studs toward world -Z
- The part moved 5 studs down
- An error
> Multiplying applies the offset in the part's local space, and local forward is -Z.

? Which rotates a part around its own center?
+ `part.CFrame * CFrame.Angles(0, r, 0)`
- `CFrame.Angles(0, r, 0) * part.CFrame`
- `part.Position * CFrame.Angles(0, r, 0)`
- `part.CFrame + CFrame.Angles(0, r, 0)`
> Right-multiplying rotates in local space; left-multiplying rotates around the world origin.

? What units does `CFrame.Angles` take?
- Degrees
+ Radians
- Studs
- Percent of a full turn
> Convert with `math.rad(degrees)`.
:::

## Challenges

:::challenge easy | Proximity glow
Write a server script that, 10 times a second, checks every player's distance to a part named `Beacon`. If **any** player is within 15 studs, make the beacon Neon; otherwise SmoothPlastic.
@solution
```roblox
local Players = game:GetService("Players")
local beacon = workspace:WaitForChild("Beacon") :: BasePart
local RANGE = 15

while true do
	task.wait(0.1)
	local near = false
	for _, player in Players:GetPlayers() do
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if root and (root.Position - beacon.Position).Magnitude <= RANGE then
			near = true
			break
		end
	end
	beacon.Material = if near then Enum.Material.Neon else Enum.Material.SmoothPlastic
end
```
:::

:::challenge medium | Spinning orbit
Make 6 small parts orbit a central part at a radius of 12 studs, completing one orbit every 4 seconds, each also spinning around its own Y axis. Use `RunService.Heartbeat` and its delta time for smooth, frame-rate-independent motion.
@hint
Track a running `angle += dt * (2π / 4)`. Each part's angle is `angle + i * (2π / 6)`.
@solution
```roblox
local RunService = game:GetService("RunService")
local center = workspace:WaitForChild("Center") :: BasePart

local COUNT, RADIUS, PERIOD = 6, 12, 4
local parts = {}
for i = 1, COUNT do
	local p = Instance.new("Part")
	p.Size = Vector3.new(2, 2, 2)
	p.Anchored = true
	p.CanCollide = false
	p.Parent = workspace
	parts[i] = p
end

local angle = 0
RunService.Heartbeat:Connect(function(dt)
	angle += dt * (math.pi * 2 / PERIOD)
	for i, p in parts do
		local a = angle + i * (math.pi * 2 / COUNT)
		local pos = center.Position + Vector3.new(math.cos(a), 0, math.sin(a)) * RADIUS
		p.CFrame = CFrame.new(pos) * CFrame.Angles(0, angle * 3, 0)
	end
end)
```
:::

:::challenge hard | Vision cone
Write `canSee(npcRoot, targetPos, range, fovDegrees)` that returns `true` only if the target is within `range` studs **and** within a cone of `fovDegrees` total width in front of the NPC (using the dot product). Test it with a part that turns green when the player is in its vision cone and red otherwise. Bonus: ignore height so looking up/down doesn't matter.
@hint
The cone's half-angle is `fovDegrees / 2`. Compare `LookVector:Dot(direction)` against `math.cos(math.rad(fovDegrees / 2))`.
@solution
```roblox
local function canSee(npcRoot: BasePart, targetPos: Vector3, range: number, fovDegrees: number): boolean
	local offset = targetPos - npcRoot.Position
	offset = Vector3.new(offset.X, 0, offset.Z) -- bonus: ignore height
	local distance = offset.Magnitude
	if distance > range or distance < 1e-3 then
		return distance < 1e-3
	end
	local look = npcRoot.CFrame.LookVector
	local flatLook = Vector3.new(look.X, 0, look.Z).Unit
	return flatLook:Dot(offset.Unit) >= math.cos(math.rad(fovDegrees / 2))
end
```
You'll combine this with a raycast for line of sight in @raycasting and use it for NPC AI in @npcs.
:::

:::recap
- `Vector3` math: `+ - *`, `Magnitude` (distance), `Unit` (direction), `Lerp`, `Dot` (alignment), `Cross` (perpendicular).
- A `CFrame` is position + rotation. Build with `new`, `lookAt`, `Angles` (radians), `fromAxisAngle`.
- `cf * x` applies `x` in `cf`'s local space; order matters. Forward is -Z (`LookVector`).
- Convert spaces with `ToObjectSpace`/`ToWorldSpace` and the `Point`/`Vector` variants.
:::
