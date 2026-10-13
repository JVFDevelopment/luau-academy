---
id: input-camera
title: Input, Camera & RunService
part: 4
summary: Read keyboard, mouse, touch and gamepad input, bind cross-platform actions, control the camera, and run code every frame with RunService.
time: 40 min
level: Intermediate
objectives:
- Handle input with `UserInputService` and respect `gameProcessedEvent`
- Bind cross-platform actions with `ContextActionService`
- Detect the player's device and adapt
- Script the camera: scriptable cameras, shakes and mouse rays
- Choose the right `RunService` event for per-frame work
---

All input and camera work happens on the **client** — the server has no keyboard and no screen. You'll do this work in LocalScripts, sending intents to the server when something gameplay-relevant happens.

## UserInputService

```roblox
local UserInputService = game:GetService("UserInputService")

UserInputService.InputBegan:Connect(function(input: InputObject, gameProcessed: boolean)
	if gameProcessed then
		return -- the player was typing in chat or clicking a UI button
	end

	if input.KeyCode == Enum.KeyCode.E then
		print("E pressed")
	elseif input.UserInputType == Enum.UserInputType.MouseButton1 then
		print("Left click at", input.Position)
	end
end)

UserInputService.InputEnded:Connect(function(input, gameProcessed)
	if input.KeyCode == Enum.KeyCode.LeftShift then
		print("Stopped sprinting")
	end
end)
```

:::warning Always check gameProcessedEvent
The second argument is `true` when Roblox already used the input — typing in chat, clicking a button, interacting with the core UI. Without the check, typing "e" in chat would also trigger your "E to interact" logic.
:::

Other useful members:

| Member | Purpose |
| --- | --- |
| `InputChanged` | Mouse movement, scroll wheel, thumbstick movement |
| `UserInputService:IsKeyDown(Enum.KeyCode.W)` | Is a key held right now? |
| `UserInputService:GetMouseLocation()` | Mouse position in viewport pixels |
| `UserInputService.MouseBehavior` | `Default`, `LockCenter` (first-person style), `LockCurrentPosition` |
| `UserInputService.TouchEnabled` / `KeyboardEnabled` / `GamepadEnabled` | What the device supports |
| `UserInputService:GetLastInputType()` / `LastInputTypeChanged` | What the player is actually using right now |
| `JumpRequest` | Fires when the player tries to jump (any device) |

## ContextActionService

Hard-coding keys gets messy when you need keyboard, gamepad *and* touch. `ContextActionService` binds one **action** to several inputs, can create an on-screen **touch button** automatically, and can be unbound when the action no longer applies:

```roblox
local ContextActionService = game:GetService("ContextActionService")

local function handleDash(actionName: string, inputState: Enum.UserInputState, input: InputObject)
	if inputState == Enum.UserInputState.Begin then
		print("Dash!")
		dashRemote:FireServer()
	end
	return Enum.ContextActionResult.Sink   -- consume the input
end

ContextActionService:BindAction("Dash", handleDash, true,   -- true = create a mobile button
	Enum.KeyCode.Q, Enum.KeyCode.ButtonX)
ContextActionService:SetTitle("Dash", "Dash")

-- Later (e.g. when the ability is unequipped):
ContextActionService:UnbindAction("Dash")
```

Return `Enum.ContextActionResult.Pass` to let other bindings handle the input too. Bindings with the same input stack — the most recent one gets it first.

:::info Newer option
Roblox also offers an instance-based **Input Action System** (`InputContext`, `InputAction`, `InputBinding`) that lets you define actions and their bindings in the Explorer. The concepts — actions mapped to many inputs — are the same.
:::

## Supporting every device

- Use **ProximityPrompts** for world interactions (@events) — they adapt automatically.
- Use `Activated` on buttons (@ui).
- For custom controls, bind actions to keyboard **and** gamepad keys and provide touch buttons.
- Adjust UI hints to the device: show "Press E" on keyboard, "Press X" on gamepad, a button on touch. `LastInputTypeChanged` tells you when to switch.

## The camera

Each client has `workspace.CurrentCamera`. By default Roblox scripts it to follow the character. To take control, set its type to `Scriptable`:

```roblox
local camera = workspace.CurrentCamera
camera.CameraType = Enum.CameraType.Scriptable
camera.CFrame = CFrame.lookAt(Vector3.new(0, 50, 50), Vector3.zero)   -- overview shot
camera.FieldOfView = 60

-- Give control back
camera.CameraType = Enum.CameraType.Custom
```

Common camera tools:

| Member | Purpose |
| --- | --- |
| `CameraSubject` | What the default camera follows (a Humanoid or part) |
| `ViewportPointToRay(x, y)` | A ray from a viewport pixel into the world (use with `GetMouseLocation()`) |
| `ScreenPointToRay(x, y)` | Same, but for positions that exclude the top-bar inset (e.g. from `input.Position`) |
| `WorldToViewportPoint(pos)` | Where a 3D point appears on screen, and whether it's visible |
| `ViewportSize` | Screen size in pixels |

```roblox
-- What's under the mouse?
local mouse = UserInputService:GetMouseLocation()
local ray = camera:ViewportPointToRay(mouse.X, mouse.Y)
local hit = workspace:Raycast(ray.Origin, ray.Direction * 1000)
```

### Camera shake

Apply a small random offset on top of the camera each frame, decaying over time:

```roblox
local RunService = game:GetService("RunService")
local intensity = 0

local function shake(amount: number)
	intensity = math.max(intensity, amount)
end

RunService:BindToRenderStep("CameraShake", Enum.RenderPriority.Camera.Value + 1, function(dt)
	if intensity <= 0.01 then return end
	local offset = Vector3.new(math.random() - 0.5, math.random() - 0.5, 0) * intensity
	camera.CFrame *= CFrame.new(offset)
	intensity *= math.exp(-8 * dt)   -- decay smoothly
end)
```

`BindToRenderStep` with a priority **after** the camera's own update lets you modify the camera after Roblox positions it.

## RunService

RunService fires events every frame. Pick the right one:

| Event | When | Typical use |
| --- | --- | --- |
| `PreRender` (also `RenderStepped`) | Client only, before the frame renders | Camera and visuals that must be perfectly in sync with rendering |
| `PreAnimation` | Before animations are applied | Procedural animation tweaks |
| `PreSimulation` (also `Stepped`) | Before physics | Setting forces/velocities |
| `PostSimulation` (also `Heartbeat`) | After physics | General per-frame game logic, on server and client |

Each passes `deltaTime` — the time since the last frame — so multiply speeds by it (as in @animation).

:::warning Keep per-frame work light
Code connected to `RenderStepped`/`PreRender` delays the frame until it finishes — heavy work there directly lowers FPS. Prefer `Heartbeat` for game logic, and don't do anything per-frame that could be event-driven.
:::

`RunService:IsServer()`, `:IsClient()` and `:IsStudio()` tell you where code is running.

:::quiz Input & camera
? What does `gameProcessedEvent = true` mean?
+ Roblox already handled the input (e.g. chat typing or a UI click)
- The input came from a gamepad
- The server processed the input
- The key was held down
> Ignore those inputs for gameplay actions.

? Why use ContextActionService for a dash ability?
+ One action can bind keyboard and gamepad keys and create a mobile button, and can be unbound later
- It's the only way to read keys
- It runs on the server
- It's required for RemoteEvents
> Actions abstract over devices and contexts.

? Which camera type lets your script fully control the camera?
- Custom
- Follow
+ Scriptable
- Fixed
> Scriptable cameras stay exactly where you put them.

? With `GetMouseLocation()`, which ray function should you use?
+ `ViewportPointToRay`
- `ScreenPointToRay`
- `WorldToViewportPoint`
- `Raycast`
> `GetMouseLocation` returns viewport coordinates, which include the top-bar inset.

? Which RunService event is best for general game logic every frame?
- RenderStepped
+ Heartbeat
- PreAnimation
- BindToClose
> Heartbeat runs after physics on both server and client without delaying rendering.
:::

## Challenges

:::challenge easy | Sprint
Holding **Left Shift** sets the local character's `WalkSpeed` to 26; releasing it sets 16. Ignore inputs Roblox already processed. (On a real competitive game, the server would validate speed — see @security.)
@solution
```roblox title="StarterPlayerScripts › Sprint"
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local player = Players.LocalPlayer

local function setSpeed(speed: number)
	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.WalkSpeed = speed
	end
end

UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.LeftShift then
		setSpeed(26)
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift then
		setSpeed(16)
	end
end)
```
:::

:::challenge medium | Cutscene camera
When a player touches a part named `CutsceneTrigger` (detect on the client), switch to a scriptable camera that tweens through three camera parts (`Cam1`, `Cam2`, `Cam3` in a folder) over 2 seconds each, then returns control to the player. Make sure it only plays once per spawn.
@solution
```roblox title="StarterPlayerScripts › Cutscene"
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local trigger = workspace:WaitForChild("CutsceneTrigger") :: BasePart
local shots = workspace:WaitForChild("CutsceneCams")

local played = false
player.CharacterAdded:Connect(function()
	played = false
end)

trigger.Touched:Connect(function(hit)
	if played or not player.Character or not hit:IsDescendantOf(player.Character) then
		return
	end
	played = true

	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = (shots:WaitForChild("Cam1") :: BasePart).CFrame
	for _, name in {"Cam2", "Cam3"} do
		local target = shots:WaitForChild(name) :: BasePart
		local tween = TweenService:Create(camera, TweenInfo.new(2, Enum.EasingStyle.Sine), { CFrame = target.CFrame })
		tween:Play()
		tween.Completed:Wait()
	end
	task.wait(1)
	camera.CameraType = Enum.CameraType.Custom
end)
```
:::

:::recap
- Input is client-only. `UserInputService.InputBegan/Ended/Changed`; always respect `gameProcessedEvent`.
- `ContextActionService` binds actions across keyboard, gamepad and touch, and unbinds cleanly.
- Support every device: ProximityPrompts, `Activated`, touch buttons, device-aware hints.
- `workspace.CurrentCamera`: `Scriptable` for full control; `ViewportPointToRay` + `GetMouseLocation` for mouse rays; `BindToRenderStep` for camera effects.
- RunService: `PreRender` for visuals, `Heartbeat` for logic, always use `dt`, keep per-frame work light.
:::
