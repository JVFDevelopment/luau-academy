---
id: animation
title: TweenService & Animations
part: 4
summary: Bring things to life — smooth property tweens with easing, tweening models and UI, frame-by-frame animation with RunService, and character animations with the Animator.
time: 40 min
level: Intermediate
objectives:
- Create, play, pause and chain tweens with `TweenInfo`
- Choose easing styles and directions that feel right
- Tween models and run custom per-frame animations
- Load and play character animations through the Animator
- Use animation priorities, markers and replication rules
---

Snapping a door from closed to open works, but it feels cheap. Smooth motion — doors swinging, coins bobbing, UI sliding in, characters swinging swords — is a huge part of what makes a game feel polished.

## TweenService

A **tween** smoothly changes one or more properties from their current values to target values over time:

```roblox
local TweenService = game:GetService("TweenService")

local info = TweenInfo.new(
	1.5,                          -- duration in seconds
	Enum.EasingStyle.Quad,        -- easing style
	Enum.EasingDirection.Out,     -- easing direction
	0,                            -- repeat count (-1 = forever)
	false,                        -- reverses?
	0                             -- delay before starting
)

local tween = TweenService:Create(door, info, {
	CFrame = door.CFrame * CFrame.new(0, 8, 0),
	Transparency = 0.5,
})
tween:Play()
```

You can tween numbers, booleans, `Vector3`, `CFrame`, `Color3`, `UDim2`, `Vector2` and a few other datatypes. Tween controls: `:Play()`, `:Pause()`, `:Cancel()`, and the `Completed` event (which passes a `PlaybackState`):

```roblox
tween.Completed:Wait()        -- yield until finished
print("Door opened")
```

### Easing

Easing controls the *feel* of motion:

| Style | Feel |
| --- | --- |
| `Linear` | Constant speed — mechanical |
| `Quad`, `Cubic`, `Quart` | Smooth acceleration, progressively stronger |
| `Sine` | Very gentle — great for idle bobbing |
| `Back` | Overshoots slightly, then settles — playful UI |
| `Bounce` | Bounces at the end |
| `Elastic` | Springy wobble |
| `Exponential` | Very sharp start or stop |

Direction: `In` starts slow, `Out` ends slow (usually best for UI and doors), `InOut` does both.

### A bobbing, spinning coin

```roblox
local coin = workspace.Coin
local bob = TweenService:Create(coin,
	TweenInfo.new(1, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true),
	{ Position = coin.Position + Vector3.new(0, 1, 0) }
)
bob:Play()   -- repeats forever, reversing each time
```

:::warning One tween per property
If two tweens animate the same property of the same object at once, the newer one wins and the older one is cancelled for that property. Cancel or reuse tweens deliberately (e.g. keep a reference and `:Cancel()` it before starting a new one).
:::

### Tweening a model

Models have no `CFrame` property to tween. Two common approaches:

1. Tween a `CFrameValue` and call `model:PivotTo(value)` whenever it changes.
2. Weld the model to one anchored root part and tween that part's `CFrame` (other parts must be unanchored and welded).

```roblox
local cfValue = Instance.new("CFrameValue")
cfValue.Value = model:GetPivot()
cfValue.Changed:Connect(function(cf)
	model:PivotTo(cf)
end)
TweenService:Create(cfValue, TweenInfo.new(2), { Value = model:GetPivot() * CFrame.new(0, 0, -20) }):Play()
```

### Where to tween

Tweens run where they're created. A tween on the **server** changes properties that replicate — every player sees it, but the network sends many updates and motion can look slightly choppy. For purely cosmetic motion (bobbing pickups, UI), tween on the **client** for perfectly smooth results. A good pattern: the server sets the *state* ("door is open" as an attribute), and each client tweens the visuals.

## Frame-by-frame animation

For motion that tweens can't express — following a moving target, physics-like springs, procedural effects — update every frame with `RunService` and use the **delta time** so speed doesn't depend on frame rate:

```roblox
local RunService = game:GetService("RunService")
local SPEED = 90 -- degrees per second

RunService.Heartbeat:Connect(function(dt)
	fan.CFrame *= CFrame.Angles(0, math.rad(SPEED * dt), 0)
end)
```

Smoothly following a target with exponential smoothing:

```roblox
RunService.RenderStepped:Connect(function(dt)
	local alpha = 1 - math.exp(-10 * dt)       -- frame-rate independent
	follower.Position = follower.Position:Lerp(target.Position, alpha)
end)
```

`TweenService:GetValue(alpha, style, direction)` gives you any easing curve as a number, so you can apply easing in your own per-frame code.

## Character animations

Character animations are created in the **Animation Editor** (or imported), published, and referenced by an asset ID. Play them through the character's **Animator** (inside the Humanoid):

```roblox
local animation = Instance.new("Animation")
animation.AnimationId = "rbxassetid://1234567890" -- your animation's ID

local humanoid = character:WaitForChild("Humanoid") :: Humanoid
local animator = humanoid:WaitForChild("Animator") :: Animator
local track = animator:LoadAnimation(animation)

track.Priority = Enum.AnimationPriority.Action
track:Play(0.1)          -- fade in over 0.1s
track:AdjustSpeed(1.5)
track.Stopped:Wait()
```

| AnimationTrack member | Purpose |
| --- | --- |
| `:Play(fadeTime?, weight?, speed?)` / `:Stop(fadeTime?)` | Start/stop with blending |
| `.Looped` | Repeat continuously |
| `.Priority` | `Core` < `Idle` < `Movement` < `Action` (… `Action4`) — higher overrides lower |
| `:GetMarkerReachedSignal("Hit")` | Fires at named markers you add in the editor — perfect for timing hitboxes and sounds |
| `.Length`, `.TimePosition`, `.IsPlaying` | State |

:::info Replication of animations
Animations played on a player's **own character** from their client replicate to everyone automatically. That's why combat games typically play attack animations on the client (instantly responsive) while the server handles damage. Load each animation **once** per character and reuse the track, rather than calling `LoadAnimation` every time.
:::

:::note Animation ownership
An animation asset must be owned by the game's creator (you or your group) to play in that game. Using someone else's animation ID usually won't work.
:::

:::quiz Tweens & animation
? Which easing direction usually feels best for UI sliding in?
- In
+ Out
- InOut
- Linear
> Out starts fast and settles gently — it feels responsive.

? How do you make a tween repeat forever and reverse each time?
+ `TweenInfo.new(t, style, dir, -1, true)`
- `tween:Loop()`
- `TweenInfo.new(t, style, dir, math.huge)`
- Call `Play()` in a while loop
> RepeatCount `-1` means forever; `reverses = true` plays it back.

? Why multiply by `dt` in a Heartbeat animation?
+ So speed is the same regardless of frame rate
- To make it run on the server
- Because CFrame requires it
- To reduce memory
> Delta time converts "per second" rates into "per frame" steps.

? Where do you load animations for a character?
- Humanoid:LoadAnimation on any side, every time
+ The character's Animator, once per animation, reusing the track
- TweenService
- ReplicatedStorage
> `Animator:LoadAnimation` is the modern API; reuse tracks.

? What are animation markers useful for?
+ Triggering hitboxes or sounds at exact moments in an animation
- Changing the animation's ID
- Making animations loop
- Replicating animations to the server
> `GetMarkerReachedSignal("Name")` fires at markers you place in the editor.
:::

## Challenges

:::challenge easy | Elevator platform
Make an anchored platform that tweens up 30 studs over 4 seconds (Sine, InOut), waits 2 seconds at the top, tweens back down, waits 2 seconds, and repeats forever. Players standing on it should ride along.
@solution
```roblox
local TweenService = game:GetService("TweenService")
local platform = workspace:WaitForChild("Elevator") :: BasePart

local bottom = platform.CFrame
local top = bottom * CFrame.new(0, 30, 0)
local info = TweenInfo.new(4, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)

while true do
	local up = TweenService:Create(platform, info, { CFrame = top })
	up:Play()
	up.Completed:Wait()
	task.wait(2)
	local down = TweenService:Create(platform, info, { CFrame = bottom })
	down:Play()
	down.Completed:Wait()
	task.wait(2)
end
```
Tweening the CFrame of an anchored part carries characters standing on it.
:::

:::challenge medium | Server state, client visuals
Create a door with a `Open` boolean attribute. A server script toggles it every 5 seconds. A **LocalScript** listens to `GetAttributeChangedSignal("Open")` and tweens the door's CFrame open (rotate 90° around a hinge side) or closed on that client. Explain why this is smoother than tweening on the server.
@hint
To rotate around one edge, combine: `closedCf * CFrame.new(-w/2, 0, 0) * CFrame.Angles(0, math.rad(90), 0) * CFrame.new(w/2, 0, 0)`.
@solution
```roblox title="ServerScriptService › DoorState"
local door = workspace:WaitForChild("Door")
while true do
	task.wait(5)
	door:SetAttribute("Open", not door:GetAttribute("Open"))
end
```
```roblox title="StarterPlayerScripts › DoorVisuals"
local TweenService = game:GetService("TweenService")
local door = workspace:WaitForChild("Door") :: BasePart
local closed = door.CFrame
local w = door.Size.X
local opened = closed * CFrame.new(-w / 2, 0, 0) * CFrame.Angles(0, math.rad(90), 0) * CFrame.new(w / 2, 0, 0)
local info = TweenInfo.new(0.6, Enum.EasingStyle.Back, Enum.EasingDirection.Out)
local current: Tween?

local function update()
	if current then current:Cancel() end
	current = TweenService:Create(door, info, {
		CFrame = if door:GetAttribute("Open") then opened else closed,
	})
	current:Play()
end

door:GetAttributeChangedSignal("Open"):Connect(update)
update()
```
The server only sends one tiny attribute change; each client animates at its own full frame rate. (Note: the door's *collision* on the server stays where the server has it — for a physical door, the server should also move it, or toggle `CanCollide`.)
:::

:::recap
- `TweenService:Create(obj, TweenInfo, goals)` → `:Play()`. Pick easing styles/directions for feel; `-1` repeats forever.
- One tween per property at a time; cancel old tweens deliberately.
- Tween models via a `CFrameValue` + `PivotTo`, or a welded root part.
- Cosmetic motion belongs on the client; the server sets state.
- Per-frame motion: `RunService` + `dt`.
- Character animations: `Animator:LoadAnimation` once, set `Priority`, use markers; client-played animations on your own character replicate.
:::
