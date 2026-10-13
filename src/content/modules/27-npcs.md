---
id: npcs
title: NPCs, Pathfinding & AI
part: 4
summary: Build NPCs that patrol, detect players, chase them around obstacles with PathfindingService, and attack — organized as a clean state machine.
time: 45 min
level: Advanced
objectives:
- Move Humanoid NPCs with `MoveTo` and handle `MoveToFinished`
- Compute and follow paths with `PathfindingService`, including jumps and blocked paths
- Detect players with range, vision cones and line of sight
- Structure AI as a finite state machine
- Keep NPCs smooth and cheap: network ownership and update rates
---

Enemies, shopkeepers, pets and guards all need to move and make decisions. This module combines what you've learned — CFrames, raycasts, events, OOP and coroutines — into practical NPC AI.

## Moving a Humanoid NPC

An NPC is usually a character model with a Humanoid, just like a player. `Humanoid:MoveTo(position)` walks it toward a point:

```roblox
local npc = workspace.Guard
local humanoid = npc:WaitForChild("Humanoid") :: Humanoid
local root = npc:WaitForChild("HumanoidRootPart") :: BasePart

root:SetNetworkOwner(nil)           -- let the server simulate it smoothly

humanoid:MoveTo(Vector3.new(20, 0, 40))
local reached = humanoid.MoveToFinished:Wait()   -- true if it arrived, false if it timed out
```

`MoveTo` walks in a **straight line** and gives up after about 8 seconds. Walls get in the way — that's what pathfinding is for.

:::tip Network ownership matters for NPCs
If a nearby player's client becomes the NPC's network owner, the NPC can stutter as ownership changes — and an exploiter could move it. Set `root:SetNetworkOwner(nil)` on the server for NPCs.
:::

## PathfindingService

```roblox
local PathfindingService = game:GetService("PathfindingService")

local path = PathfindingService:CreatePath({
	AgentRadius = 2,
	AgentHeight = 5,
	AgentCanJump = true,
	WaypointSpacing = 4,
})

local function walkTo(goal: Vector3): boolean
	local ok = pcall(function()
		path:ComputeAsync(root.Position, goal)
	end)
	if not ok or path.Status ~= Enum.PathStatus.Success then
		return false
	end

	for _, waypoint in path:GetWaypoints() do
		if waypoint.Action == Enum.PathWaypointAction.Jump then
			humanoid.Jump = true
		end
		humanoid:MoveTo(waypoint.Position)
		if not humanoid.MoveToFinished:Wait() then
			return false   -- got stuck
		end
	end
	return true
end
```

Important details:

- `ComputeAsync` can fail — wrap it in `pcall` and check `path.Status`.
- Waypoints marked `Jump` need `humanoid.Jump = true`.
- The world can change after the path is computed. Connect `path.Blocked` (it passes the blocked waypoint's index) and recompute if a blocked waypoint is still ahead of you.
- **Pathfinding modifiers** (`PathfindingModifier` on parts or regions, with costs set via the path's `Costs` table) let you make NPCs prefer roads or avoid water; `PathfindingLink` connects areas with special moves like ladders or teleporters.

### Chasing a moving target

Players move, so a chasing NPC recomputes its path regularly (e.g. every 0.5 s) and only follows the first few waypoints before recomputing. When the target is close with clear line of sight, skip pathfinding and `MoveTo` directly.

## Perception

Combine distance, a vision cone (@cframes) and a line-of-sight raycast (@raycasting):

```roblox
local Players = game:GetService("Players")
local SIGHT_RANGE = 60
local FOV_COS = math.cos(math.rad(110 / 2))

local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { npc }

local function findTarget(): Model?
	local best, bestDist = nil, SIGHT_RANGE
	for _, player in Players:GetPlayers() do
		local character = player.Character
		local hum = character and character:FindFirstChildOfClass("Humanoid")
		local targetRoot = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if hum and hum.Health > 0 and targetRoot then
			local offset = targetRoot.Position - root.Position
			local dist = offset.Magnitude
			if dist < bestDist and root.CFrame.LookVector:Dot(offset.Unit) >= FOV_COS then
				local hit = workspace:Raycast(root.Position, offset, params)
				if hit and hit.Instance:IsDescendantOf(character) then
					best, bestDist = character, dist
				end
			end
		end
	end
	return best
end
```

## State machines

AI quickly becomes spaghetti if everything is one big `if`. A **finite state machine** gives the NPC one current **state**, with clear rules for switching:

```text
            sees player                 within 5 studs
  PATROL ───────────────▶ CHASE ─────────────────────▶ ATTACK
    ▲                       │  ▲                          │
    │   lost player for 3s  │  └──────────────────────────┘
    └───────────────────────┘        target moved away
```

```roblox
local state = "Patrol"
local target: Model? = nil
local lastSeen = 0

local STATES = {}

function STATES.Patrol()
	target = findTarget()
	if target then
		return "Chase"
	end
	-- walk to the next patrol point (non-blocking: one MoveTo per tick)
	return "Patrol"
end

function STATES.Chase()
	local seen = findTarget()
	if seen then
		target, lastSeen = seen, os.clock()
	elseif os.clock() - lastSeen > 3 then
		return "Patrol"
	end
	local targetRoot = target and target:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not targetRoot then return "Patrol" end
	if (targetRoot.Position - root.Position).Magnitude < 5 then
		return "Attack"
	end
	humanoid:MoveTo(targetRoot.Position)
	return "Chase"
end

function STATES.Attack()
	local targetRoot = target and target:FindFirstChild("HumanoidRootPart") :: BasePart?
	local targetHum = target and target:FindFirstChildOfClass("Humanoid")
	if not targetRoot or not targetHum or targetHum.Health <= 0 then
		return "Patrol"
	end
	if (targetRoot.Position - root.Position).Magnitude > 6 then
		return "Chase"
	end
	targetHum:TakeDamage(10)
	task.wait(1) -- attack cooldown
	return "Attack"
end

while humanoid.Health > 0 do
	state = STATES[state]()
	task.wait(0.2)   -- think 5 times per second, not every frame
end
```

Each state is small and testable; adding a "Flee" or "Stunned" state means adding one function and a couple of transitions.

## Scaling to many NPCs

- **Think less often.** 5–10 decisions per second is plenty; movement itself is smooth regardless.
- **Stagger updates** so 50 NPCs don't all compute paths on the same frame.
- **Share work**: one loop updating every NPC is cheaper than 50 separate scripts. Combine with an `NPC` class (@oop) and tags (@services).
- **Sleep when nobody's near.** NPCs far from all players can stop thinking entirely.
- Consider simple custom movement (CFrame/AlignPosition) instead of Humanoids for large crowds of simple enemies — Humanoids are relatively expensive.

:::quiz NPCs
? Why use PathfindingService instead of a single `MoveTo` to the target?
+ `MoveTo` walks in a straight line and can't route around obstacles
- `MoveTo` only works on players
- Pathfinding is faster to compute
- `MoveTo` can't be used on the server
> Paths route around walls and include jump waypoints.

? What should you do when a waypoint's `Action` is `Jump`?
+ Set `humanoid.Jump = true` before moving to it
- Skip that waypoint
- Recompute the path
- Teleport the NPC
> Jump waypoints mark gaps or ledges the agent must jump.

? Why call `root:SetNetworkOwner(nil)` on an NPC?
+ So the server simulates it, avoiding stutter and client tampering
- To stop it from moving
- To make it invisible
- To enable pathfinding
> Server ownership keeps NPC physics consistent and trusted.

? What's the main benefit of a state machine for AI?
+ Clear, separate behaviors with explicit transitions
- It makes NPCs move faster
- It removes the need for pathfinding
- It's required by Roblox
> Each state handles one behavior, which keeps logic readable and extendable.

? How often should a typical NPC "think"?
- Every frame
+ A few times per second
- Once per minute
- Only when a player clicks it
> Decisions don't need 60 Hz; movement stays smooth regardless.
:::

## Challenges

:::challenge medium | Patrol route
Make an NPC walk forever between the parts in a `PatrolPoints` folder (in name order `P1`, `P2`, …) using pathfinding, pausing 1 second at each point. If a path fails, skip to the next point.
@solution
```roblox
local PathfindingService = game:GetService("PathfindingService")
local npc = script.Parent
local humanoid = npc:WaitForChild("Humanoid") :: Humanoid
local root = npc:WaitForChild("HumanoidRootPart") :: BasePart
root:SetNetworkOwner(nil)

local points = workspace:WaitForChild("PatrolPoints"):GetChildren()
table.sort(points, function(a, b) return a.Name < b.Name end)

local path = PathfindingService:CreatePath({ AgentCanJump = true })

local function walkTo(goal: Vector3): boolean
	local ok = pcall(path.ComputeAsync, path, root.Position, goal)
	if not ok or path.Status ~= Enum.PathStatus.Success then return false end
	for _, wp in path:GetWaypoints() do
		if wp.Action == Enum.PathWaypointAction.Jump then humanoid.Jump = true end
		humanoid:MoveTo(wp.Position)
		if not humanoid.MoveToFinished:Wait() then return false end
	end
	return true
end

local i = 1
while humanoid.Health > 0 do
	walkTo((points[i] :: BasePart).Position)
	task.wait(1)
	i = i % #points + 1
end
```
:::

:::challenge boss | Guard AI
Build a complete guard using everything in this module: it **patrols** between points, **chases** players it can see (range + 120° vision cone + line of sight) using pathfinding that recomputes every 0.5 s, **attacks** within 5 studs (15 damage, 1.2 s cooldown), and **returns to patrol** after losing sight for 4 seconds. Write it as an `NPC` class with a state machine, so you can spawn several guards from a template, each with its own patrol folder. Make sure guards clean up (stop their loops) when destroyed or killed.
@hint
Store `state`, `target`, `lastSeen` on `self`. One `task.spawn`ed loop per NPC that runs `self[self.state](self)` and checks `self.alive`.
@hint
Set `self.alive = false` on `humanoid.Died` and on `model.Destroying`; the loop exits when it's false.
@solution
```roblox title="ServerScriptService › NPC (ModuleScript)"
local Players = game:GetService("Players")
local PathfindingService = game:GetService("PathfindingService")

local NPC = {}
NPC.__index = NPC

local SIGHT, ATTACK_RANGE, LOSE_AFTER = 60, 5, 4
local FOV_COS = math.cos(math.rad(60))

function NPC.new(model: Model, patrolFolder: Folder)
	local self = setmetatable({}, NPC)
	self.model = model
	self.humanoid = model:WaitForChild("Humanoid") :: Humanoid
	self.root = model:WaitForChild("HumanoidRootPart") :: BasePart
	self.root:SetNetworkOwner(nil)
	self.points = patrolFolder:GetChildren()
	table.sort(self.points, function(a, b) return a.Name < b.Name end)
	self.pointIndex = 1
	self.state = "patrol"
	self.target = nil
	self.lastSeen = 0
	self.lastAttack = 0
	self.lastPath = 0
	self.alive = true
	self.path = PathfindingService:CreatePath({ AgentCanJump = true })
	self.params = RaycastParams.new()
	self.params.FilterType = Enum.RaycastFilterType.Exclude
	self.params.FilterDescendantsInstances = { model }

	self.humanoid.Died:Once(function() self.alive = false end)
	model.Destroying:Once(function() self.alive = false end)
	task.spawn(function() self:run() end)
	return self
end

function NPC:findTarget(): Model?
	local best, bestDist = nil, SIGHT
	for _, player in Players:GetPlayers() do
		local c = player.Character
		local h = c and c:FindFirstChildOfClass("Humanoid")
		local r = c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
		if h and h.Health > 0 and r then
			local offset = r.Position - self.root.Position
			local d = offset.Magnitude
			if d < bestDist and d > 0 and self.root.CFrame.LookVector:Dot(offset.Unit) >= FOV_COS then
				local hit = workspace:Raycast(self.root.Position, offset, self.params)
				if hit and hit.Instance:IsDescendantOf(c) then
					best, bestDist = c, d
				end
			end
		end
	end
	return best
end

function NPC:moveToward(goal: Vector3)
	if os.clock() - self.lastPath < 0.5 then return end
	self.lastPath = os.clock()
	local ok = pcall(self.path.ComputeAsync, self.path, self.root.Position, goal)
	if ok and self.path.Status == Enum.PathStatus.Success then
		local wps = self.path:GetWaypoints()
		local wp = wps[math.min(3, #wps)]
		if wp then
			if wp.Action == Enum.PathWaypointAction.Jump then self.humanoid.Jump = true end
			self.humanoid:MoveTo(wp.Position)
		end
	else
		self.humanoid:MoveTo(goal)
	end
end

function NPC:patrol()
	local seen = self:findTarget()
	if seen then
		self.target, self.lastSeen = seen, os.clock()
		return "chase"
	end
	local point = self.points[self.pointIndex] :: BasePart
	if (point.Position - self.root.Position).Magnitude < 4 then
		self.pointIndex = self.pointIndex % #self.points + 1
	else
		self:moveToward(point.Position)
	end
	return "patrol"
end

function NPC:chase()
	local seen = self:findTarget()
	if seen then
		self.target, self.lastSeen = seen, os.clock()
	elseif os.clock() - self.lastSeen > LOSE_AFTER then
		self.target = nil
		return "patrol"
	end
	local r = self.target and self.target:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not r then return "patrol" end
	if (r.Position - self.root.Position).Magnitude <= ATTACK_RANGE then
		return "attack"
	end
	self:moveToward(r.Position)
	return "chase"
end

function NPC:attack()
	local t = self.target
	local h = t and t:FindFirstChildOfClass("Humanoid")
	local r = t and t:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not h or not r or h.Health <= 0 then
		self.target = nil
		return "patrol"
	end
	if (r.Position - self.root.Position).Magnitude > ATTACK_RANGE + 1 then
		return "chase"
	end
	self.humanoid:MoveTo(self.root.Position) -- stop moving
	if os.clock() - self.lastAttack >= 1.2 then
		self.lastAttack = os.clock()
		h:TakeDamage(15)
	end
	return "attack"
end

function NPC:run()
	while self.alive do
		self.state = self[self.state](self)
		task.wait(0.2)
	end
end

return NPC
```
```roblox title="ServerScriptService › SpawnGuards"
local ServerStorage = game:GetService("ServerStorage")
local NPC = require(script.Parent.NPC)

for _, patrol in workspace.GuardRoutes:GetChildren() do
	local guard = ServerStorage.GuardTemplate:Clone()
	guard:PivotTo((patrol:GetChildren()[1] :: BasePart).CFrame + Vector3.new(0, 3, 0))
	guard.Parent = workspace
	NPC.new(guard, patrol)
end
```
:::

:::recap
- `Humanoid:MoveTo` walks in a straight line; `MoveToFinished` tells you if it arrived.
- `PathfindingService:CreatePath` + `ComputeAsync` (in `pcall`) + waypoints (handle `Jump`, `Blocked`).
- Perception = range + vision cone + line-of-sight ray.
- Structure AI as a state machine; think a few times per second.
- Server-own NPC physics; share and stagger work for many NPCs.
:::
