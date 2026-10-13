---
id: cheatsheet
title: Luau Cheat Sheet
kicker: Reference
summary: The syntax and APIs you'll reach for every day, on one page. Use ++Ctrl+K++ to search the full course.
---

## Variables & types

```luau
local name = "Koala"            -- string
local coins = 100               -- number (all numbers are doubles)
local alive = true              -- boolean
local nothing = nil             -- nil
local list = {1, 2, 3}          -- table (array)
local dict = { hp = 100 }       -- table (dictionary)
local a, b = 1, 2               -- multiple assignment
a, b = b, a                     -- swap
print(type(coins), typeof(coins))
print(tostring(42), tonumber("42"))
```

Only `false` and `nil` are falsy — `0` and `""` are truthy.

## Operators

| Kind | Operators |
| --- | --- |
| Arithmetic | `+ - * / // % ^` |
| Compound | `+= -= *= /= //= %= ^= ..=` |
| Comparison | `== ~= < > <= >=` |
| Logical | `and or not` |
| Other | `..` (concat), `#` (length) |

```luau
local label = if score >= 50 then "Pass" else "Fail"
local name = input or "Guest"           -- default value
local hum = char and char:FindFirstChild("Humanoid")  -- guard
```

## Strings

```luau
local s = `Hello {name}, you have {coins} coins`  -- interpolation
s:upper()  s:lower()  s:sub(1, 3)  s:sub(-3)  #s  s:rep(3)  s:reverse()
s:find("x", 1, true)   s:match("%d+")   s:gmatch("%a+")   s:gsub("a", "b")
s:split(",")   string.format("%.2f | %03d | %s", 3.14159, 7, "x")
```

Patterns: `%a` letters, `%d` digits, `%s` space, `%w` alphanumeric, `.` any, `+ * - ?` quantifiers, `^ $` anchors, `()` captures, `%` escapes.

## Control flow

```luau
if x > 10 then
elseif x > 5 then
else
end

while cond do end
repeat until cond
for i = 1, 10, 2 do end
for i, v in array do end
for k, v in dict do end
-- break, continue
```

## Functions

```luau
local function add(a: number, b: number): number
	return a + b
end

local function stats(...)
	local n = select("#", ...)
	return n, {...}
end

local double = function(x) return x * 2 end
obj:method(x)        -- same as obj.method(obj, x)
```

## Tables

```luau
table.insert(t, v)       table.insert(t, 1, v)    table.remove(t)    table.remove(t, i)
table.find(t, v)         table.sort(t, function(a, b) return a > b end)
table.concat(t, ", ")    table.clone(t)           table.clear(t)     table.freeze(t)
table.create(n, v)       table.unpack(t)          table.pack(...)
```

Remove while iterating: loop backwards. Copying a table variable copies the **reference**.

## Classes

```luau
local Class = {}
Class.__index = Class

function Class.new(name)
	local self = setmetatable({}, Class)
	self.name = name
	return self
end

function Class:greet()
	return "Hi, " .. self.name
end

local Sub = setmetatable({}, { __index = Class })
Sub.__index = Sub
```

Metamethods: `__index __newindex __call __tostring __eq __lt __le __add __sub __mul __div __idiv __mod __pow __unm __concat __len __iter __mode __metatable`.

## Types

```luau
--!strict
type Item = { id: string, price: number, tags: {string}, discount: number? }
type Shape = { kind: "circle", r: number } | { kind: "rect", w: number, h: number }
export type Result<T> = { ok: true, value: T } | { ok: false, error: string }
local function first<T>(list: {T}): T? return list[1] end
local part = thing :: BasePart   -- cast (no runtime effect)
```

## Errors & tasks

```luau
local ok, result = pcall(fn, arg)
xpcall(fn, function(err) return debug.traceback(err) end)
error("message", 2)    assert(cond, "message")

task.spawn(fn)   task.defer(fn)   task.delay(2, fn)   task.wait(1)   task.cancel(thread)
coroutine.create(fn)   coroutine.resume(co)   coroutine.yield()   coroutine.wrap(fn)
```

## Roblox essentials

```roblox
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local part = Instance.new("Part")
part.Anchored = true
part.Position = Vector3.new(0, 10, 0)
part.Parent = workspace                         -- parent last

obj:FindFirstChild("Name")    obj:WaitForChild("Name")    obj:GetChildren()    obj:GetDescendants()
obj:IsA("BasePart")   obj:Clone()   obj:Destroy()   model:PivotTo(cf)
obj:SetAttribute("K", v)   obj:GetAttribute("K")   obj:AddTag("Tag")

local conn = part.Touched:Connect(function(hit) end)
conn:Disconnect()   signal:Once(fn)   signal:Wait()
obj:GetPropertyChangedSignal("Prop"):Connect(fn)
```

## Remotes

```roblox
-- Client                                   -- Server
remote:FireServer(args)                     remote.OnServerEvent:Connect(function(player, args) end)
remote.OnClientEvent:Connect(fn)            remote:FireClient(player, args)   remote:FireAllClients(args)
local r = fn:InvokeServer(args)             fn.OnServerInvoke = function(player, args) return r end
```

**Never trust the client.** Validate type, value (NaN!), ownership, distance, state and rate on the server.

## 3D math

```roblox
(b - a).Magnitude   (b - a).Unit   a:Dot(b)   a:Cross(b)   a:Lerp(b, t)
CFrame.new(pos)   CFrame.lookAt(pos, target)   CFrame.Angles(0, math.rad(90), 0)
cf * CFrame.new(0, 0, -5)    -- 5 studs forward (local space)
cf.Position   cf.LookVector   cf.RightVector   cf.UpVector   cf:ToObjectSpace(other)
workspace:Raycast(origin, direction, params)
```

## Services quick reference

| Service | For |
| --- | --- |
| `Players` | Players, characters, `LocalPlayer` |
| `ReplicatedStorage` | Shared modules, remotes, assets |
| `ServerScriptService` / `ServerStorage` | Server code / server assets |
| `RunService` | `Heartbeat`, `RenderStepped`, `IsServer()` |
| `TweenService` | Smooth property animation |
| `UserInputService` / `ContextActionService` | Input |
| `DataStoreService` | Saving data |
| `MarketplaceService` | Game passes, developer products |
| `CollectionService` | Tags and components |
| `PathfindingService` | NPC navigation |
| `HttpService` | JSON, GUIDs, web requests |
| `TextService` | Filtering player text |
| `TeleportService` / `MessagingService` / `MemoryStoreService` | Multi-server features |
| `PhysicsService` | Collision groups |
| `Debris` | Timed cleanup |

## Glossary

| Term | Meaning |
| --- | --- |
| **Client** | A player's device. Runs LocalScripts; can be tampered with. |
| **Server** | The authoritative machine running the game for everyone. |
| **Replication** | The server automatically sending world changes to clients. |
| **RemoteEvent** | A message across the client–server boundary. |
| **Instance** | Any object in the game tree (parts, scripts, players, ...). |
| **Service** | A top-level Instance managing one engine area. |
| **Closure** | A function plus the outer variables (upvalues) it captured. |
| **Metatable** | A table that customizes another table's behavior. |
| **Yield** | Pause the current thread so others can run. |
| **Debounce** | Ignoring repeat triggers for a short time. |
| **Network ownership** | Which machine simulates an unanchored part's physics. |
| **Session data** | A player's data cached on the server while they play. |
| **Idempotent** | Safe to run more than once with the same result. |
