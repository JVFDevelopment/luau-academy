---
id: stdlib
title: The Standard Library
part: 2
summary: A guided tour of Luau's built-in libraries — math, randomness, time, UTF-8, bit manipulation, buffers, vectors and debug — with the Roblox extras you'll use every day.
time: 40 min
level: Intermediate
objectives:
- Use the full `math` library, including `lerp`, `map`, `clamp`, `noise` and trigonometry
- Generate good randomness with `math.random` and `Random`, including weighted picks
- Measure and format time with `os.time`, `os.clock`, `os.date` and `DateTime`
- Handle player text correctly with the `utf8` library
- Pack flags with `bit32` and binary data with `buffer`
- Know what the `vector` and `debug` libraries offer
---

Luau ships with a compact but capable standard library. You've already used much of `string`, `table` and `coroutine`. This module tours everything else — the tools that turn up in damage formulas, loot tables, daily rewards, chat filters and networking code.

## math

### Rounding and limits

| Function | Example | Result |
| --- | --- | --- |
| `math.floor(x)` | `math.floor(-2.5)` | `-3` |
| `math.ceil(x)` | `math.ceil(2.1)` | `3` |
| `math.round(x)` | `math.round(2.5)` | `3` (halves round away from zero) |
| `math.abs(x)` | `math.abs(-4)` | `4` |
| `math.sign(x)` | `math.sign(-9)` | `-1` (or `0`, or `1`) |
| `math.min(...)` / `math.max(...)` | `math.max(3, 9, 4)` | `9` |
| `math.clamp(x, lo, hi)` | `math.clamp(120, 0, 100)` | `100` |
| `math.fmod(a, b)` | `math.fmod(-7, 3)` | `-1` (sign follows `a`, unlike `%`) |
| `math.modf(x)` | `math.modf(3.75)` | `3  0.75` |

To round to a number of decimal places, scale, round and scale back:

```luau
local function roundTo(x, places)
	local factor = 10 ^ places
	return math.round(x * factor) / factor
end
print(roundTo(3.14159, 2))  --> 3.14
```

### Interpolation and remapping

`math.lerp(a, b, t)` returns the value a fraction `t` of the way from `a` to `b`. `math.map(x, inMin, inMax, outMin, outMax)` converts a value from one range to another:

```luau
print(math.lerp(0, 100, 0.25))        --> 25
print(math.lerp(10, 20, 0.5))         --> 15

-- A health of 30 out of 120 → a bar width between 0 and 200 pixels
print(math.map(30, 0, 120, 0, 200))   --> 50
```

These are newer additions to Luau. In older code you'll see the same thing written by hand: `a + (b - a) * t`.

### Powers, roots and logarithms

`math.sqrt(x)`, `math.exp(x)`, `math.log(x, base?)` (natural log by default), `math.log10(x)`, and `math.pow(x, y)` (the same as `x ^ y`). Logarithms are handy for level curves: the level reached with a given amount of XP often involves `math.log`.

### Trigonometry

All trig functions work in **radians**. Convert with `math.rad(degrees)` and `math.deg(radians)`:

```luau
local angle = math.rad(90)
print(math.sin(angle))          --> 1
print(math.deg(math.pi))        --> 180
```

`math.atan2(y, x)` gives the angle of a direction, correctly handling every quadrant — exactly what you need to point a turret or a UI arrow toward a target. Sine and cosine are the basis for circles and orbits:

```luau
-- 8 points evenly spaced around a circle of radius 10
for i = 0, 7 do
	local theta = (i / 8) * 2 * math.pi
	local x = math.cos(theta) * 10
	local z = math.sin(theta) * 10
	print(string.format("%.1f, %.1f", x, z))
end
```

### Special values

`math.pi`, `math.huge` (infinity) and NaN (produced by `0/0`) round out the library. Recent Luau versions add `math.isnan`, `math.isinf` and `math.isfinite`; in any version, NaN is the only value not equal to itself, so `x ~= x` detects it.

### Noise

`math.noise(x, y?, z?)` returns smooth **Perlin noise**: nearby inputs give nearby outputs, roughly in the range -1 to 1. It's the secret behind natural-looking terrain, flickering lights and wobbly cameras.

```luau
for i = 1, 5 do
	print(string.format("%.3f", math.noise(i * 0.1, 0.5)))
end
```

:::tip Noise at whole numbers is 0
Perlin noise returns `0` at integer coordinates. Scale your inputs (like `x * 0.1`) and add a fractional offset or seed so you don't sample exactly on the grid.
:::

## Randomness

### math.random

```luau
print(math.random())        --> a decimal in [0, 1)
print(math.random(10))      --> a whole number from 1 to 10
print(math.random(5, 8))    --> a whole number from 5 to 8
```

`math.random` is fine for quick tasks. Roblox seeds it automatically.

### The Random object (Roblox)

Roblox's `Random` datatype gives you **independent, seedable** generators. The same seed always produces the same sequence — perfect for procedurally generated maps that every server builds identically, or for replays:

```roblox
local rng = Random.new(12345)        -- seed; omit for a random seed
print(rng:NextInteger(1, 6))         -- whole number in [1, 6]
print(rng:NextNumber())              -- decimal in [0, 1)
print(rng:NextNumber(5, 10))         -- decimal in [5, 10)
print(rng:NextUnitVector())          -- random direction as a Vector3

local deck = {"A", "K", "Q", "J"}
rng:Shuffle(deck)                    -- shuffle an array in place
```

### Weighted random choice

Loot tables rarely pick uniformly. Give each option a **weight** and pick proportionally:

```luau
local LOOT = {
	{ item = "Common Sword", weight = 70 },
	{ item = "Rare Shield", weight = 25 },
	{ item = "Legendary Crown", weight = 5 },
}

local function pickWeighted(entries)
	local total = 0
	for _, e in entries do
		total += e.weight
	end
	local roll = math.random() * total
	for _, e in entries do
		roll -= e.weight
		if roll < 0 then
			return e.item
		end
	end
	return entries[#entries].item   -- floating-point safety net
end

print(pickWeighted(LOOT))
```

:::warning Paid random items
If players spend Robux (directly or indirectly) on random items, Roblox policy requires you to disclose the odds and to respect regional restrictions via `PolicyService`. More on this in @monetization.
:::

## Time

| Function | Returns | Use it for |
| --- | --- | --- |
| `os.time()` | Whole seconds since 1 Jan 1970 (UTC) | Timestamps you save: daily rewards, bans, cooldowns across sessions |
| `os.clock()` | High-precision seconds of CPU time | Measuring how long code takes |
| `os.date(format?, time?)` | A formatted string or a date table | Showing dates; `"*t"` gives a table, `"!*t"` gives UTC |
| `os.difftime(t2, t1)` | `t2 - t1` in seconds | Readability |

```luau
local start = os.clock()
local sum = 0
for i = 1, 1e6 do
	sum += i
end
print(string.format("Took %.2f ms", (os.clock() - start) * 1000))

local now = os.date("!*t")   -- UTC date table
print(now.year, now.month, now.day, now.hour)
```

### Daily rewards

A classic use of `os.time()`: store when a player last claimed, and compare.

```luau
local DAY = 24 * 60 * 60

local function canClaim(lastClaim)
	return os.time() - lastClaim >= DAY
end
```

On Roblox you'll also meet `DateTime.now()` (millisecond precision, with formatting helpers like `:FormatLocalTime("LLL", "en-us")`), `time()` (seconds since the server started) and `workspace:GetServerTimeNow()` (a clock that clients and server agree on — great for synchronized countdowns).

## utf8

Player names, chat and signs can contain any language and emoji, and those characters often take several bytes. The `utf8` library works with **characters** (codepoints) instead of bytes:

| Function | Purpose |
| --- | --- |
| `utf8.len(s)` | Number of characters (or `nil` + position if the text is invalid UTF-8) |
| `utf8.char(...)` | Build a string from codepoints |
| `utf8.codepoint(s, i?, j?)` | Codepoints of characters |
| `utf8.codes(s)` | Iterate `position, codepoint` pairs |
| `utf8.offset(s, n)` | Byte position of the `n`th character |
| `utf8.charpattern` | A pattern matching one UTF-8 character |

```luau
local name = "Zoë🐨"
print(#name, utf8.len(name))   --> 8 4   (ë is 2 bytes, 🐨 is 4)

for _, code in utf8.codes(name) do
	print(utf8.char(code))
end
```

Roblox adds `utf8.graphemes`, which iterates user-perceived characters (some emoji are several codepoints combined). Use character-aware functions whenever you limit the length of player-entered text.

## bit32

`bit32` operates on the bits of 32-bit unsigned integers. Its most common game use is packing several yes/no **flags** into one number:

```luau
local FLAGS = {
	CAN_FLY = 0b0001,
	CAN_SWIM = 0b0010,
	IS_VIP = 0b0100,
	IS_ADMIN = 0b1000,
}

local permissions = bit32.bor(FLAGS.CAN_SWIM, FLAGS.IS_VIP)   -- 0b0110

print(bit32.btest(permissions, FLAGS.IS_VIP))    --> true
print(bit32.btest(permissions, FLAGS.CAN_FLY))   --> false

permissions = bit32.band(permissions, bit32.bnot(FLAGS.IS_VIP))  -- clear a flag
print(bit32.btest(permissions, FLAGS.IS_VIP))    --> false
```

Other functions include `bxor`, `lshift`, `rshift`, `arshift`, `extract`, `replace`, `countlz`, `countrz` and `byteswap`.

## buffer

A **buffer** is a fixed-size block of raw bytes that you read and write at specific offsets. Buffers are compact and fast — great for custom serialization, compressing network traffic or storing large grids:

```luau
-- Pack a position (3 floats) and a health value (1 byte) into 13 bytes
local b = buffer.create(13)
buffer.writef32(b, 0, 12.5)    -- x
buffer.writef32(b, 4, 3.0)     -- y
buffer.writef32(b, 8, -40.25)  -- z
buffer.writeu8(b, 12, 87)      -- health 0-255

print(buffer.len(b))                               --> 13
print(buffer.readf32(b, 8), buffer.readu8(b, 12))  --> -40.25 87
```

| Functions | Purpose |
| --- | --- |
| `buffer.create(size)`, `buffer.len(b)` | Create and measure |
| `readi8/u8/i16/u16/i32/u32/f32/f64`, matching `write…` | Read/write numbers of a given size at an offset |
| `readstring`, `writestring` | Read/write raw strings |
| `readbits`, `writebits` | Read/write individual bit ranges |
| `fromstring`, `tostring` | Convert to and from strings |
| `copy`, `fill` | Bulk operations |

Offsets start at **0**, unlike tables. Buffers can be sent through RemoteEvents and saved in data stores, which is why high-performance networking libraries use them.

## vector

Luau has a native 3-component `vector` type with a small library: `vector.create`, `magnitude`, `normalize`, `dot`, `cross`, `angle`, `floor`, `ceil`, `abs`, `sign`, `clamp`, `min`, `max`, and the constants `vector.zero` and `vector.one`. Vectors support `+ - * /` directly.

```luau
local a = vector.create(3, 4, 0)
print(vector.magnitude(a))   --> 5
```

On Roblox, you'll mostly use the familiar `Vector3` type, which has methods and properties for all of this (`.Magnitude`, `.Unit`, `:Dot()`, `:Cross()`) — covered in @cframes.

## debug

| Function | Purpose |
| --- | --- |
| `debug.traceback(msg?, level?)` | The current call stack as a string |
| `debug.info(fnOrLevel, "sln")` | Source, line and name info about a function or stack level |
| `debug.profilebegin(label)` / `debug.profileend()` | **Roblox:** label a section of code in the MicroProfiler |
| `debug.setmemorycategory(name)` | **Roblox:** attribute this script's memory to a named category in the Developer Console |

```luau
local function whereAmI()
	local source, line, name = debug.info(1, "sln")
	print(name, line)
end
whereAmI()   --> whereAmI <line number>
```

## Global functions

Finally, the functions that live directly in the global scope. You've met nearly all of them:

| Group | Functions |
| --- | --- |
| Output | `print`, `warn` (Roblox), `error` |
| Types | `type`, `typeof`, `tostring`, `tonumber` |
| Iteration | `pairs`, `ipairs`, `next`, `select` |
| Metatables | `setmetatable`, `getmetatable`, `rawget`, `rawset`, `rawequal`, `rawlen` |
| Errors | `pcall`, `xpcall`, `assert` |
| Modules | `require` |
| Misc | `unpack` (old alias for `table.unpack`), `gcinfo` (memory in KB), `newproxy` |

:::quiz Standard library
? What does `math.lerp(10, 20, 0.25)` return?
+ `12.5`
- `15`
- `2.5`
- `17.5`
> `10 + (20 - 10) * 0.25` = `12.5`.

? Which tool gives the same random sequence every time for a given seed?
- `math.random()` without arguments
+ `Random.new(seed)`
- `os.clock()`
- `math.noise()` with no arguments
> A `Random` object seeded with a fixed number reproduces the same sequence — ideal for procedural generation.

? You want to save "when did this player last claim their daily reward". Which do you store?
+ `os.time()`
- `os.clock()`
- `time()`
- `tick()`
> `os.time()` is a real-world UTC timestamp that survives server restarts. `os.clock()` and `time()` are relative to the current machine or server.

? Why can `#name` differ from the number of characters a player sees?
- `#` counts words
+ `#` counts bytes, and many characters use more than one byte
- `#` ignores spaces
- `#` only works on ASCII
> Use `utf8.len` (or Roblox's `utf8.graphemes`) for character counts.

? What does `math.noise(3, 7)` return?
- A random number
- `1`
+ `0`
- An error
> Perlin noise is 0 at integer coordinates. Scale and offset your inputs.

? What's a good use of `bit32.btest`?
+ Checking whether a flag bit is set in a permissions number
- Testing whether a string is binary
- Rounding numbers to 32 bits
- Checking if a buffer is empty
> `btest(a, b)` returns `true` if `a` and `b` share any set bits.
:::

:::predict Rounding functions
```luau
print(math.floor(-2.5), math.ceil(-2.5), math.round(-2.5))
```
= -3 -2 -3
> `floor` rounds toward negative infinity, `ceil` toward positive infinity, and `round` rounds halves away from zero.
:::

:::predict Remapping
```luau
print(math.map(5, 0, 10, 100, 200), math.clamp(-5, 0, 10))
```
= 150 0
> 5 is halfway through 0–10, so it maps halfway through 100–200. `clamp` pins -5 to the minimum, 0.
:::

## Challenges

:::challenge easy | Dice statistics
Roll a six-sided die 6,000 times with `math.random(1, 6)` and count how many times each face appears. Print each face's count and percentage with one decimal place. Are they roughly equal?
@solution
```luau
local counts = {0, 0, 0, 0, 0, 0}
local rolls = 6000

for _ = 1, rolls do
	local face = math.random(1, 6)
	counts[face] += 1
end

for face, count in counts do
	print(string.format("%d: %d (%.1f%%)", face, count, count / rolls * 100))
end
```
Each face should land near 16.7%. Try 60 rolls instead and notice how much more uneven small samples are.
:::

:::challenge medium | Loot box with odds
Build a loot table with at least four rarities and weights. Write `rollLoot()` using weighted selection, then simulate 10,000 rolls and print the observed percentage of each rarity next to its **expected** percentage (weight / total weight). This is exactly how you'd verify the odds you disclose to players.
@solution
```luau
local TABLE = {
	{ rarity = "Common", weight = 60 },
	{ rarity = "Uncommon", weight = 25 },
	{ rarity = "Rare", weight = 12 },
	{ rarity = "Legendary", weight = 3 },
}

local totalWeight = 0
for _, entry in TABLE do
	totalWeight += entry.weight
end

local function rollLoot()
	local roll = math.random() * totalWeight
	for _, entry in TABLE do
		roll -= entry.weight
		if roll < 0 then
			return entry.rarity
		end
	end
	return TABLE[#TABLE].rarity
end

local results = {}
local N = 10000
for _ = 1, N do
	local r = rollLoot()
	results[r] = (results[r] or 0) + 1
end

for _, entry in TABLE do
	local observed = (results[entry.rarity] or 0) / N * 100
	local expected = entry.weight / totalWeight * 100
	print(string.format("%-10s observed %5.2f%%  expected %5.2f%%", entry.rarity, observed, expected))
end
```
:::

:::challenge medium | Cooldown formatter
Given a future Unix timestamp `readyAt` (from `os.time()`), write `formatRemaining(readyAt)` that returns `"Ready!"` if the time has passed, otherwise a string like `"3h 07m 15s"`. Test with `os.time() + 11235`.
@hint
Remaining seconds → hours with `// 3600`, minutes with `% 3600 // 60`, seconds with `% 60`.
@solution
```luau
local function formatRemaining(readyAt)
	local left = readyAt - os.time()
	if left <= 0 then
		return "Ready!"
	end
	local h = left // 3600
	local m = left % 3600 // 60
	local s = left % 60
	return string.format("%dh %02dm %02ds", h, m, s)
end

print(formatRemaining(os.time() + 11235)) --> 3h 07m 15s
print(formatRemaining(os.time() - 5))     --> Ready!
```
:::

:::challenge hard | Compact grid encoder
A building game stores a 16×16 grid where each cell holds a block ID from 0 to 255. Write `encode(grid)` that packs the grid (a 2D table `grid[y][x]`) into a **buffer** of exactly 256 bytes, and `decode(b)` that turns it back into a 2D table. Verify that `decode(encode(grid))` matches the original for a randomly filled grid, and print the buffer's size.
@hint
Map 2D coordinates to a single offset: `(y - 1) * 16 + (x - 1)` — remember buffer offsets start at 0 while your table indices start at 1.
@solution
```luau
local SIZE = 16

local function encode(grid)
	local b = buffer.create(SIZE * SIZE)
	for y = 1, SIZE do
		for x = 1, SIZE do
			buffer.writeu8(b, (y - 1) * SIZE + (x - 1), grid[y][x])
		end
	end
	return b
end

local function decode(b)
	local grid = {}
	for y = 1, SIZE do
		grid[y] = {}
		for x = 1, SIZE do
			grid[y][x] = buffer.readu8(b, (y - 1) * SIZE + (x - 1))
		end
	end
	return grid
end

local original = {}
for y = 1, SIZE do
	original[y] = {}
	for x = 1, SIZE do
		original[y][x] = math.random(0, 255)
	end
end

local packed = encode(original)
local restored = decode(packed)

local same = true
for y = 1, SIZE do
	for x = 1, SIZE do
		if restored[y][x] ~= original[y][x] then
			same = false
		end
	end
end
print(buffer.len(packed), same) --> 256 true
```
The same grid as a table of numbers would use many kilobytes of memory, and much more if serialized to JSON.
:::

:::recap
- `math`: rounding (`floor`, `ceil`, `round`), `clamp`, `lerp`, `map`, trig in radians, `atan2`, `noise`, `huge`, `pi`.
- Randomness: `math.random` for quick rolls; `Random.new(seed)` for reproducible streams and `:Shuffle`; weighted picks for loot.
- Time: save `os.time()`; benchmark with `os.clock()`; format with `os.date` or `DateTime`; sync with `workspace:GetServerTimeNow()`.
- `utf8` for character-aware text; `bit32` for flags; `buffer` for compact binary data (0-based offsets).
- `vector` is Luau's native vector library; on Roblox you'll mostly use `Vector3`.
- `debug.traceback` and `debug.info` for diagnostics; `debug.profilebegin` for the MicroProfiler.
:::
