---
id: physics
title: Physics, Constraints & Collisions
part: 4
summary: Make the world move — anchoring, assemblies, velocity and impulses, modern constraints and movers, collision groups, and network ownership.
time: 40 min
level: Intermediate
objectives:
- Know how anchoring, welding and assemblies work
- Push things with velocity, impulses and forces
- Use constraints (hinges, springs, ropes) and movers (AlignPosition, LinearVelocity)
- Control what collides with what using collision groups
- Understand network ownership and why it matters for lag and exploits
---

Roblox runs a real-time physics simulation. Unanchored parts fall, bounce, roll and collide automatically. Your job is mostly to **set things up** and **nudge** them — not to calculate every motion yourself.

## Anchoring and assemblies

- An **anchored** part never moves due to physics. Map geometry should almost always be anchored.
- Unanchored parts joined together (by welds or constraints) form an **assembly** that moves as one rigid body. One part — the **root part** — represents the assembly.
- `WeldConstraint` (with `Part0` and `Part1`) rigidly glues two parts together. Use it to build multi-part objects like cars or doors.

```roblox
local weld = Instance.new("WeldConstraint")
weld.Part0 = body
weld.Part1 = wheelCover
weld.Parent = body
```

Key properties: `Anchored`, `CanCollide`, `CanTouch`, `CanQuery`, `Massless`, `CustomPhysicalProperties` (density, friction, elasticity), and read-only `AssemblyMass`. `Workspace.Gravity` defaults to 196.2 studs/s².

## Pushing things

```roblox
-- Set velocity directly (studs per second)
ball.AssemblyLinearVelocity = Vector3.new(0, 50, -30)

-- Apply an instant push, scaled by mass (so heavy things move less)
crate:ApplyImpulse(Vector3.new(0, 0, -500) * crate.AssemblyMass)

-- Spin
wheel.AssemblyAngularVelocity = Vector3.new(0, 10, 0)
wheel:ApplyAngularImpulse(Vector3.new(0, 200, 0))
```

`ApplyImpulse` is ideal for knockback and explosions; setting velocity is ideal for launch pads.

## Constraints and movers

Constraints connect parts through **Attachments** (points with their own orientation inside parts). Movers apply continuous forces to reach a goal. They replace the old deprecated BodyMovers (`BodyVelocity`, `BodyPosition`, `BodyGyro`).

| Object | Use it for |
| --- | --- |
| `HingeConstraint` | Doors, wheels; set `ActuatorType` to `Motor` or `Servo` to drive it |
| `PrismaticConstraint` | Sliding elevators and pistons |
| `SpringConstraint` | Suspension, bouncy platforms |
| `RopeConstraint` / `RodConstraint` | Hanging objects, chains, fixed-length links |
| `BallSocketConstraint` | Ragdolls, swinging lamps |
| `AlignPosition` | Move toward a target position (hover, carry objects) |
| `AlignOrientation` | Rotate toward a target orientation (keep upright) |
| `LinearVelocity` | Hold a velocity (conveyors, dashes, projectiles) |
| `AngularVelocity` | Hold a spin |
| `VectorForce` | Apply a constant force (thrusters, anti-gravity) |

```roblox
-- Make a part hover toward a target point
local attachment = Instance.new("Attachment")
attachment.Parent = drone

local align = Instance.new("AlignPosition")
align.Mode = Enum.PositionAlignmentMode.OneAttachment
align.Attachment0 = attachment
align.Position = Vector3.new(0, 30, 0)
align.MaxForce = 10000
align.Responsiveness = 15
align.Parent = drone
```

:::tip Anti-gravity with VectorForce
A `VectorForce` of `Vector3.new(0, part.AssemblyMass * workspace.Gravity, 0)` (applied relative to the world) exactly cancels gravity — the basis of floating platforms and low-gravity zones.
:::

## Collision groups

Collision groups decide which sets of parts collide. Register groups, set which pairs are collidable, then assign parts:

```roblox
local PhysicsService = game:GetService("PhysicsService")

PhysicsService:RegisterCollisionGroup("Players")
PhysicsService:RegisterCollisionGroup("Doors")
PhysicsService:CollisionGroupSetCollidable("Players", "Players", false)  -- players pass through each other

for _, part in character:GetDescendants() do
	if part:IsA("BasePart") then
		part.CollisionGroup = "Players"
	end
end
```

Common uses: no player-to-player collision, VIP doors only some characters pass through, debris that doesn't block players.

## Network ownership

To keep physics smooth, Roblox lets a **client simulate** unanchored parts near its player — that client becomes the part's **network owner**. The server owns everything else.

- **Pro:** objects a player interacts with feel responsive.
- **Con:** the owning client controls that part's physics — an exploiter can fling it anywhere.

For important objects (NPCs, vehicles you want server-authoritative, ball in a sports game), set the owner explicitly on the server:

```roblox
npcRoot:SetNetworkOwner(nil)          -- server simulates it
vehicleSeat:SetNetworkOwner(driver)   -- the driver simulates their car (smooth driving)
```

`SetNetworkOwner` works on unanchored parts; `part:SetNetworkOwnershipAuto()` returns to automatic mode. Players always own their own character.

:::quiz Physics
? What happens to an anchored part when something hits it?
+ Nothing — anchored parts aren't moved by physics
- It falls
- It becomes unanchored
- It bounces back
> Anchored parts are fixed in place.

? Which is best for a sudden knockback?
- Setting `Position` every frame
+ `ApplyImpulse`
- A WeldConstraint
- `CanCollide = false`
> Impulses are instant pushes that respect mass.

? Which modern object replaces the deprecated `BodyVelocity`?
- `AlignOrientation`
+ `LinearVelocity`
- `HingeConstraint`
- `WeldConstraint`
> LinearVelocity holds a velocity; BodyMovers are deprecated.

? How do you stop players colliding with each other?
+ Put their parts in a collision group that isn't collidable with itself
- Anchor every character
- Set `Workspace.Gravity` to 0
- Use `SetNetworkOwner(nil)`
> Collision groups control which groups collide.

? Why call `npcRoot:SetNetworkOwner(nil)`?
+ So the server simulates the NPC instead of a nearby client
- To delete the NPC
- To make the NPC invisible to clients
- To anchor it
> Server ownership stops nearby clients from controlling (or flinging) the NPC.
:::

## Challenges

:::challenge easy | Launch pad
Make a pad that launches any character who touches it upward at 120 studs/s and forward along the pad's `LookVector` at 60 studs/s, with a 1-second per-character cooldown.
@solution
```roblox
local pad = workspace:WaitForChild("LaunchPad") :: BasePart
local cooldown: {[Model]: number} = {}

pad.Touched:Connect(function(hit)
	local character = hit:FindFirstAncestorOfClass("Model")
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not character or not root then return end

	local now = os.clock()
	if cooldown[character] and now - cooldown[character] < 1 then return end
	cooldown[character] = now

	root.AssemblyLinearVelocity = pad.CFrame.LookVector * 60 + Vector3.new(0, 120, 0)
end)
```
Characters are client-owned, so this velocity change is applied by the server and the character's owner picks it up — it works, but in fast-paced games you may also fire the client to apply it locally for responsiveness.
:::

:::challenge medium | Swinging door
Build a door that swings on a `HingeConstraint` with `ActuatorType = Servo`. A ProximityPrompt toggles `TargetAngle` between 0 and 90. The door part must be unanchored and attached to an anchored frame part.
@solution
```roblox
local frame = workspace.DoorFrame :: BasePart   -- anchored
local door = workspace.Door :: BasePart         -- unanchored
local prompt = door:WaitForChild("ProximityPrompt") :: ProximityPrompt

local a0 = Instance.new("Attachment")
a0.Position = Vector3.new(frame.Size.X / 2, 0, 0)
a0.Parent = frame
local a1 = Instance.new("Attachment")
a1.Position = Vector3.new(-door.Size.X / 2, 0, 0)
a1.Parent = door
-- Hinges rotate around the attachments' X axis; orient them so X points up
a0.Axis = Vector3.yAxis
a1.Axis = Vector3.yAxis

local hinge = Instance.new("HingeConstraint")
hinge.Attachment0 = a0
hinge.Attachment1 = a1
hinge.ActuatorType = Enum.ActuatorType.Servo
hinge.ServoMaxTorque = 1e6
hinge.AngularSpeed = 3
hinge.Parent = door

local open = false
prompt.Triggered:Connect(function()
	open = not open
	hinge.TargetAngle = if open then 90 else 0
end)
```
Positioning attachments correctly depends on how your parts are built — use Studio's constraint visualization (Model tab → Constraints → Show Details) to check.
:::

:::recap
- Anchor static geometry; weld parts into assemblies.
- Push with `AssemblyLinearVelocity` and `ApplyImpulse`; spin with angular velocity.
- Constraints (hinge, spring, rope...) and movers (AlignPosition, LinearVelocity, VectorForce) replace BodyMovers.
- Collision groups control what collides.
- Network ownership trades responsiveness for trust — set server ownership for important objects.
:::
