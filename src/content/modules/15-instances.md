---
id: instances
title: The DataModel & Instances
part: 3
summary: Everything in a Roblox game is an Instance in one big tree. Learn to find, create, clone, configure and destroy Instances — plus services, enums, datatypes, models, attributes and tags.
time: 50 min
level: Beginner
objectives:
- Navigate the DataModel tree and fetch services with `GetService`
- Choose correctly between dot access, `FindFirstChild` and `WaitForChild`
- Create Instances the right way — and set `Parent` last
- Use properties, enums and datatypes like `Vector3`, `Color3` and `BrickColor`
- Clone templates, destroy safely and move whole models with `PivotTo`
- Store custom data with attributes and label Instances with tags
---

Welcome to Part III. From here on, we're writing code for the Roblox engine. Everything you've learned about Luau still applies — but now you'll be working with the objects that make up a real game: parts, models, players, sounds, scripts and UI.

## Everything is an Instance

Every object in a Roblox game — a brick, a sound, a script, a player, even the lighting — is an **Instance**. Instances form a single tree called the **DataModel**, whose root is the global `game`. The Explorer window shows this tree:

:::tree The DataModel
game (DataModel)
  Workspace # the 3D world: parts, models, terrain, characters
    Terrain
    Map (Model)
      Floor (Part)
      Door (Model)
  Players # one Player object per connected player
  Lighting # sky, time of day, post-processing effects
  ReplicatedStorage # shared between server and clients
  ServerScriptService # server scripts
  ServerStorage # server-only assets
  StarterGui # UI given to each player
  StarterPlayer
  SoundService
:::

Every Instance has a **Parent** (except `game` itself) and can have **children**. Moving an Instance in the tree is as simple as changing its `Parent`.

## Services

The top-level children of `game` are **services** — built-in managers that each handle one area of the engine. Always get them with `game:GetService`:

```roblox
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
```

`GetService` returns the service by its **class name**, creating it if it doesn't exist yet. Writing `game.Players` usually works too, but it looks up the service by its *name*, which isn't guaranteed — and some services don't exist until something asks for them. `GetService` is always correct, so it's the convention. Put these lines at the top of your scripts.

`workspace` is a special global that refers to the Workspace service directly.

| Service | Responsible for |
| --- | --- |
| `Workspace` | The 3D world and its physics |
| `Players` | Connected players and their characters |
| `ReplicatedStorage` | Assets and ModuleScripts both sides can see |
| `ServerScriptService` | Server scripts (never sent to clients) |
| `ServerStorage` | Server-only assets (never sent to clients) |
| `StarterGui` / `StarterPack` / `StarterPlayer` | What each player gets when they join or respawn |
| `Lighting` | Time of day, sky, atmosphere and effects |
| `SoundService` | Global audio settings |
| `RunService` | Frame-by-frame events, and checking server vs. client |
| `TweenService` | Smooth animation of properties |
| `UserInputService` | Keyboard, mouse, touch and gamepad input |
| `DataStoreService` | Saving data between sessions |

## Classes, properties, methods and events

Every Instance belongs to a **class** that defines what it can do. A class has:

- **Properties** — data you read and write with a dot: `part.Anchored = true`
- **Methods** — functions you call with a colon: `part:Destroy()`
- **Events** — signals you connect to: `part.Touched:Connect(fn)` (covered in @events)

Classes inherit from each other. A `Part` *is a* `BasePart`, which *is a* `PVInstance`, which *is an* `Instance`. Everything an `Instance` can do, a `Part` can do too. That's why you should check kinds of objects with `IsA`, which understands inheritance:

```roblox
local part = Instance.new("Part")
print(part.ClassName)            --> Part
print(part:IsA("Part"))          --> true
print(part:IsA("BasePart"))      --> true   (Part inherits from BasePart)
print(part:IsA("Instance"))      --> true
print(part:IsA("Model"))         --> false
```

Checking `obj.ClassName == "Part"` misses `MeshPart`, `WedgePart`, `UnionOperation` and other `BasePart`s. Prefer `obj:IsA("BasePart")`.

:::tip The API reference
The [Roblox Engine API reference](https://create.roblox.com/docs/reference/engine) documents every class: its properties, methods, events and what it inherits from. Get used to looking things up there — nobody memorizes it all.
:::

## Finding Instances

### Dot access

You can walk the tree with dots, just like table fields:

```roblox
local door = workspace.Map.Door
```

This is concise, but if any step doesn't exist you get *"Door is not a valid member of Model"*. Use it only when you're **certain** the object exists — for example, for objects placed in the server's Workspace in Studio, accessed by a server script.

### FindFirstChild

`FindFirstChild(name)` returns the child, or `nil` if there isn't one. It never errors, so it's perfect for checking whether something exists:

```roblox
local humanoid = character:FindFirstChild("Humanoid")
if humanoid then
	humanoid.Health = 0
end
```

Pass `true` as the second argument to search **all descendants** recursively: `model:FindFirstChild("Handle", true)`.

Related helpers:

| Method | Returns |
| --- | --- |
| `FindFirstChildOfClass("Humanoid")` | First child whose class is exactly `Humanoid` |
| `FindFirstChildWhichIsA("BasePart")` | First child that `IsA` the class (inheritance-aware) |
| `FindFirstAncestor("Map")` | Nearest ancestor with that name |
| `FindFirstAncestorOfClass("Model")` / `FindFirstAncestorWhichIsA(...)` | Nearest ancestor of that class |

### WaitForChild

`WaitForChild(name)` **yields** until the child exists, then returns it. Use it when something *will* exist but might not **yet** — which is extremely common on the client, where objects arrive over the network gradually:

```roblox
-- In a LocalScript
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local gui = player:WaitForChild("PlayerGui")
local shop = gui:WaitForChild("ShopGui")
```

If the child takes more than 5 seconds to appear, Studio prints an *"Infinite yield possible"* warning — a hint that the name may be wrong or the object may never arrive. You can pass a timeout as the second argument; it then returns `nil` instead of waiting forever:

```roblox
local optional = workspace:WaitForChild("Bonus", 3)   -- nil after 3 seconds
```

:::info Which one should I use?
- **Dot access:** you're sure it exists right now (e.g. server code reading the static map).
- **FindFirstChild:** it might legitimately not exist, and you'll handle `nil`.
- **WaitForChild:** it will exist, but maybe not yet — client code, or things created at runtime.
:::

### Names with spaces, and name collisions

If a name isn't a valid identifier, use brackets: `workspace["Spawn Area"]`. And beware: if a child has the same name as a **property**, dot access returns the *property*. A child named `Name` or `Parent` can only be reached with `FindFirstChild`. Give children clear, unique names.

### Children and descendants

```roblox
for _, child in workspace.Map:GetChildren() do        -- direct children only
	print(child.Name)
end

for _, descendant in workspace.Map:GetDescendants() do -- children, grandchildren, ...
	if descendant:IsA("BasePart") then
		descendant.Anchored = true
	end
end

print(door:IsDescendantOf(workspace))  --> true
print(door:GetFullName())              --> Workspace.Map.Door
```

## Creating Instances

`Instance.new(className)` creates a new object. It starts with no parent, so it isn't in the game until you set `Parent`:

```roblox
local part = Instance.new("Part")
part.Name = "Platform"
part.Size = Vector3.new(10, 1, 10)
part.Position = Vector3.new(0, 20, 0)
part.Anchored = true
part.Color = Color3.fromRGB(80, 160, 255)
part.Material = Enum.Material.SmoothPlastic
part.Parent = workspace     -- set Parent LAST
```

:::pro Set Parent last
Set every property **before** parenting. Once an Instance is in the game, each property change can trigger replication, physics updates and change events. Configuring it first and parenting once is noticeably faster — and avoids clients briefly seeing a half-configured object. For the same reason, avoid the old `Instance.new("Part", workspace)` form.
:::

## Properties, datatypes and enums

### Common BasePart properties

| Property | Type | Notes |
| --- | --- | --- |
| `Position` | `Vector3` | Center of the part in world space |
| `Size` | `Vector3` | Dimensions in studs |
| `CFrame` | `CFrame` | Position **and** rotation together (@cframes) |
| `Anchored` | `boolean` | Anchored parts ignore physics and stay put |
| `CanCollide` | `boolean` | Whether other parts bump into it |
| `CanTouch` | `boolean` | Whether it fires `Touched` events |
| `Transparency` | `number` | 0 = solid, 1 = invisible |
| `Color` | `Color3` | Exact color |
| `Material` | `Enum.Material` | Plastic, Neon, Wood, Glass, ... |

### Datatypes

Roblox adds many datatypes. You create them with constructors:

```roblox
local position = Vector3.new(0, 10, 0)
local red = Color3.fromRGB(255, 0, 0)
local fromHue = Color3.fromHSV(0.6, 0.8, 1)    -- hue, saturation, value from 0 to 1
local legacy = BrickColor.new("Bright blue")
local uiSize = UDim2.new(0.5, 0, 0, 50)        -- for UI (see @ui)
```

Datatypes are **immutable values**. You can't do `part.Position.Y = 10` — you must build a new value and assign it: `part.Position = Vector3.new(part.Position.X, 10, part.Position.Z)`. Or add an offset: `part.Position += Vector3.new(0, 5, 0)`.

### Enums

**Enums** are fixed lists of named options, accessed through the global `Enum`:

```roblox
part.Material = Enum.Material.Neon
part.Shape = Enum.PartType.Ball
humanoid:ChangeState(Enum.HumanoidStateType.Jumping)

if part.Material == Enum.Material.Neon then
	print("Glowing!")
end
```

Enums prevent typos (`"Neonn"` would silently fail; `Enum.Material.Neonn` errors immediately) and autocomplete in Studio.

## Cloning

`:Clone()` makes a copy of an Instance **and all its descendants**. The standard pattern is to keep a **template** somewhere players can't see it, and clone it whenever you need one:

```roblox
local ServerStorage = game:GetService("ServerStorage")
local coinTemplate = ServerStorage:WaitForChild("Coin")

for i = 1, 10 do
	local coin = coinTemplate:Clone()
	coin.Position = Vector3.new(i * 5, 3, 0)
	coin.Parent = workspace
end
```

Clones start with no parent. Instances whose `Archivable` property is `false` can't be cloned (the clone is `nil`).

## Destroying

`:Destroy()` permanently removes an Instance and all its descendants: it sets `Parent` to `nil`, locks the `Parent` so it can't come back, and **disconnects all their event connections**. Use it whenever you're done with something:

```roblox
coin:Destroy()
```

| Approach | When to use |
| --- | --- |
| `obj:Destroy()` | You're done with it forever. The default choice. |
| `obj.Parent = nil` | You want to remove it temporarily and maybe re-parent it later. |
| `obj:ClearAllChildren()` | Destroy every child but keep the object itself. |
| `Debris:AddItem(obj, seconds)` | Destroy it automatically after a delay (bullets, effects). |

```roblox
local Debris = game:GetService("Debris")
local explosion = Instance.new("Explosion")
explosion.Position = Vector3.new(0, 5, 0)
explosion.Parent = workspace
Debris:AddItem(explosion, 2)
```

## Models

A **Model** groups Instances into one object — a car, a house, a character. To move or rotate a whole model, use its **pivot**:

```roblox
local house = workspace.House
print(house:GetPivot())                         -- the model's current CFrame
house:PivotTo(CFrame.new(0, 0, 50))             -- move the whole model
house:PivotTo(house:GetPivot() * CFrame.Angles(0, math.rad(90), 0))  -- rotate 90°
```

Never move a model by changing each part's `Position` one by one — it's slow and breaks joints. Other useful members include `PrimaryPart` (the part the pivot is based on by default), `:GetBoundingBox()` and `:ScaleTo(factor)`.

## Attributes

**Attributes** let you attach your own custom data to any Instance. They show up in the Properties window, replicate from server to clients, and fire change events:

```roblox
local door = workspace.Door
door:SetAttribute("Locked", true)
door:SetAttribute("KeyColor", Color3.fromRGB(255, 200, 0))

print(door:GetAttribute("Locked"))       --> true
print(door:GetAttribute("Missing"))      --> nil

door:GetAttributeChangedSignal("Locked"):Connect(function()
	print("Locked is now", door:GetAttribute("Locked"))
end)
```

Attributes support strings, numbers, booleans and most Roblox datatypes (`Vector3`, `Color3`, `CFrame`, `UDim2`, `NumberRange`, ...) — but **not** tables or Instance references. Setting an attribute to `nil` removes it.

:::note Attributes vs. Value objects
Older code stores data in child objects like `IntValue` or `StringValue` (`coins.Value = 10`). Value objects are still used for **leaderstats** (see @players) and `ObjectValue` can store Instance references, but for most custom data, attributes are simpler and lighter.
:::

## Tags

**Tags** are string labels you put on Instances to mark them as belonging to a group — `"KillBrick"`, `"Coin"`, `"Interactable"`. One script can then find and handle *every* tagged object instead of putting a copy of the same script inside each one:

```roblox
local CollectionService = game:GetService("CollectionService")

for _, brick in CollectionService:GetTagged("KillBrick") do
	brick.Touched:Connect(function(hit)
		local humanoid = hit.Parent:FindFirstChildOfClass("Humanoid")
		if humanoid then
			humanoid.Health = 0
		end
	end)
end
```

You can add tags in Studio's Properties window or in code with `instance:AddTag("Coin")`, check them with `:HasTag()`, and remove them with `:RemoveTag()`. You'll build a complete tag-driven system in @services.

:::quiz Instances
? Why use `game:GetService("Players")` instead of `game.Players`?
+ It finds the service by class name and creates it if needed, so it always works
- `game.Players` is a syntax error
- `GetService` makes the service run faster
- `game.Players` only works on the client
> Services are looked up reliably by class name. It's the universal convention.

? What does `FindFirstChild` return if the child doesn't exist?
- It errors
- It waits until it exists
+ `nil`
- An empty Instance
> `FindFirstChild` never errors and never yields — it returns `nil` when nothing matches.

? Which is the best way to check whether `obj` is any kind of part (Part, MeshPart, WedgePart…)?
- `obj.ClassName == "Part"`
+ `obj:IsA("BasePart")`
- `typeof(obj) == "Part"`
- `obj.Name == "Part"`
> `IsA` understands class inheritance; every kind of part inherits from `BasePart`.

? Why should `Parent` be set last when creating an Instance?
+ Property changes after parenting trigger replication and events, which is slower and can show half-configured objects
- Parent can't be changed once set
- Other properties are ignored after parenting
- It's required for the object to be visible in Studio
> Configure first, parent once.

? Which line correctly raises a part by 5 studs?
- `part.Position.Y += 5`
+ `part.Position += Vector3.new(0, 5, 0)`
- `part.Y = part.Y + 5`
- `part.Position:SetY(5)`
> Datatypes like `Vector3` are immutable — build a new value and assign it.

? What's the right way to move an entire Model?
- Change each part's `Position`
- Set the Model's `Position` property
+ `model:PivotTo(newCFrame)`
- Clone it at the new location
> `PivotTo` moves and rotates the whole model as one unit.

? What can't be stored in an attribute?
- A `Color3`
- A boolean
+ A table
- A `Vector3`
> Attributes support primitives and most datatypes, but not tables or Instance references.
:::

:::predict Cloning
```roblox
local folder = Instance.new("Folder")
local a = Instance.new("Part")
a.Name = "A"
a.Parent = folder
local b = a:Clone()
b.Parent = folder
print(#folder:GetChildren(), b.Name, b.Parent == folder)
```
= 2 A true
> A clone keeps every property, including `Name`. After parenting it, the folder has two children.
:::

:::predict Class checks
```roblox
local p = Instance.new("Part")
print(p:IsA("BasePart"), p:IsA("Model"), p.ClassName)
```
= true false Part
> `Part` inherits from `BasePart`, not from `Model`. `ClassName` is the exact class.
:::

:::predict Attributes
```roblox
local p = Instance.new("Part")
p:SetAttribute("Health", 50)
p:SetAttribute("Health", p:GetAttribute("Health") - 20)
print(p:GetAttribute("Health"), p:GetAttribute("Missing"))
```
= 30 nil
> Attributes behave like a small key-value store on the Instance. Missing attributes read as `nil`.
:::

## Challenges

:::challenge easy | Staircase builder
Write a server script that builds a staircase of 15 anchored steps rising into the air. Each step should be `6 × 1 × 3` studs, placed 3 studs further forward and 1 stud higher than the last. Color them with a gradient using `Color3.fromHSV(i / 15, 0.7, 1)`. Put all steps in a Folder named `Staircase`.
@hint
Create the Folder first and parent it to `workspace`. Then loop `for i = 1, 15 do` and build each part, parenting it to the folder last.
@solution
```roblox title="ServerScriptService › Staircase"
local folder = Instance.new("Folder")
folder.Name = "Staircase"
folder.Parent = workspace

for i = 1, 15 do
	local step = Instance.new("Part")
	step.Name = "Step" .. i
	step.Size = Vector3.new(6, 1, 3)
	step.Position = Vector3.new(0, i, i * 3)
	step.Anchored = true
	step.Color = Color3.fromHSV(i / 15, 0.7, 1)
	step.Material = Enum.Material.SmoothPlastic
	step.Parent = folder
end
```
:::

:::challenge easy | Kill bricks by tag
Add three parts to your place and give each the tag `KillBrick` (Properties window → Tags). Write one server script that makes every tagged part bright red Neon and kills any character that touches it.
@solution
```roblox title="ServerScriptService › KillBricks"
local CollectionService = game:GetService("CollectionService")

for _, brick in CollectionService:GetTagged("KillBrick") do
	brick.Color = Color3.fromRGB(255, 40, 40)
	brick.Material = Enum.Material.Neon

	brick.Touched:Connect(function(hit)
		local humanoid = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid")
		if humanoid then
			humanoid.Health = 0
		end
	end)
end
```
This only handles bricks that exist when the script starts. In @services you'll handle bricks tagged later, too.
:::

:::challenge medium | Coin scatter
Create a template coin (a small yellow cylinder Part named `Coin`) in **ServerStorage**. Write a script that clones it 25 times at random positions within a 100 × 100 stud area above the baseplate. Give each coin a `Value` attribute — 70% of coins are worth 1, 25% are worth 5 and 5% are worth 25 — and tint the valuable ones differently.
@hint
`math.random(-50, 50)` for X and Z. For the value, roll `math.random()` once and compare it against thresholds.
@solution
```roblox title="ServerScriptService › CoinScatter"
local ServerStorage = game:GetService("ServerStorage")
local template = ServerStorage:WaitForChild("Coin")

local coins = Instance.new("Folder")
coins.Name = "Coins"
coins.Parent = workspace

for _ = 1, 25 do
	local coin = template:Clone()
	local roll = math.random()
	local value = if roll < 0.05 then 25 elseif roll < 0.30 then 5 else 1

	coin:SetAttribute("Value", value)
	if value == 25 then
		coin.Color = Color3.fromRGB(80, 220, 255)
	elseif value == 5 then
		coin.Color = Color3.fromRGB(255, 120, 40)
	end
	coin.Position = Vector3.new(math.random(-50, 50), 3, math.random(-50, 50))
	coin.Anchored = true
	coin.Parent = coins
end
```
:::

:::challenge hard | Explorer printer
Write a recursive function `printTree(instance, depth)` that prints an Instance and all its descendants as an indented tree, like the Explorer, including each object's class: `Door (Model)`. Skip descendants of any object with the attribute `HideInTree` set to `true`. Run it on a Model or on `workspace`.
@hint
Indent with `string.rep("  ", depth)`. Recurse into `:GetChildren()` with `depth + 1`.
@solution
```roblox
local function printTree(instance: Instance, depth: number?)
	local level = depth or 0
	print(string.rep("  ", level) .. `{instance.Name} ({instance.ClassName})`)

	if instance:GetAttribute("HideInTree") == true then
		return
	end
	for _, child in instance:GetChildren() do
		printTree(child, level + 1)
	end
end

printTree(workspace)
```
:::

:::recap
- Everything is an Instance in the DataModel tree rooted at `game`. Get services with `game:GetService`.
- Classes have properties (`.`), methods (`:`) and events. Check kinds with `IsA`, which respects inheritance.
- Dot access when certain; `FindFirstChild` when it may be missing; `WaitForChild` when it will arrive later.
- `Instance.new` → set properties → set `Parent` last. Datatypes are immutable: assign new values.
- Clone templates from storage; `Destroy` when done (or `Debris:AddItem` for delays).
- Move models with `PivotTo`. Store custom data in attributes; group objects with tags.
:::
