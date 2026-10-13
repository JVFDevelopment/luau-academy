---
id: tables
title: Tables
part: 1
summary: Luau's one data structure that does it all — arrays, dictionaries, nested data, iteration, the table library, references vs. copies, sets, stacks and queues.
time: 50 min
level: Beginner
objectives:
- Build arrays and dictionaries and read, write and delete entries
- Iterate correctly with generalized iteration, `ipairs` and `pairs`
- Use the table library: `insert`, `remove`, `find`, `sort`, `concat`, `clone`, `freeze`…
- Understand that tables are references — and how to copy them safely
- Avoid the classic `#` and remove-while-iterating bugs
- Model sets, stacks, queues and records with tables
---

If there's one module in Part I to master, it's this one. **Tables** are Luau's only built-in data structure, and they're used for *everything*: lists of players, inventories, configuration, objects, modules, even the classes you'll build later. Once tables click, Luau clicks.

## Creating tables

A table is created with curly braces — a **table constructor**:

```luau
local empty = {}
local fruits = {"apple", "banana", "cherry"}
local player = { name = "Koala", level = 12, alive = true }
```

A table stores **key → value** pairs. Keys and values can be (almost) anything: numbers, strings, booleans, other tables, functions, Instances. The only illegal key is `nil` (and NaN).

Two shapes come up constantly, and Luau optimizes for both:

- **Arrays** (also called lists): keys are consecutive whole numbers starting at **1**.
- **Dictionaries** (also called maps): keys are usually strings, describing named fields.

## Arrays

```luau
local inventory = {"Sword", "Shield", "Potion"}

print(inventory[1])   --> Sword   (arrays start at 1!)
print(inventory[3])   --> Potion
print(inventory[4])   --> nil     (nothing there)
print(#inventory)     --> 3       (length)

inventory[2] = "Bow"  -- replace an item
inventory[#inventory + 1] = "Arrow"  -- append to the end
print(#inventory)     --> 4
```

:::warning Arrays start at 1
In most languages arrays start at 0. In Luau the first element is at index **1** and the last is at index `#t`. Off-by-one mistakes here are the most common table bug for newcomers.
:::

## Dictionaries

```luau
local player = {
	name = "Koala",
	level = 12,
	["favorite color"] = "green",   -- keys that aren't valid names use [ ]
}

print(player.name)                 --> Koala
print(player["level"])             --> 12   (same as player.level)
print(player["favorite color"])    --> green

player.coins = 500                 -- add a new field
player.level += 1                  -- update a field
player.alive = nil                 -- remove a field (there was none, but this is how)
```

`player.name` is just a shorter way to write `player["name"]`. Use the dot when the key is a valid identifier, and brackets when it isn't — or when the key is stored in a variable:

```luau
local stat = "level"
print(player[stat])    --> 13
print(player.stat)     --> nil  (looks for a key literally named "stat"!)
```

### Removing entries

Setting a key to `nil` deletes it. A table can't "contain" `nil` — a missing key and a key set to `nil` are the same thing.

### Mixed and non-string keys

You can use any value as a key, including numbers that aren't part of an array and even Instances — which is incredibly useful on Roblox:

```roblox
local lastHit = {}
lastHit[player] = os.clock()     -- key is a Player Instance
```

You *can* mix array-style and dictionary-style entries in one table (`{"a", "b", count = 2}`), but keep that to a minimum. Mixed tables are confusing to iterate and can't be sent over the network reliably (see @remotes).

## Nested tables

Values can be tables too, so you can model rich data:

```luau
local gameData = {
	players = {
		{ name = "Koala", score = 120 },
		{ name = "Builderman", score = 95 },
	},
	settings = {
		maxPlayers = 12,
		map = "Volcano",
	},
}

print(gameData.players[1].name)       --> Koala
print(gameData.settings.map)          --> Volcano
print(#gameData.players)              --> 2
```

## Iterating

### Generalized iteration (the modern way)

Luau lets you loop over any table directly:

```luau
local scores = { Koala = 120, Builderman = 95, Noob = 3 }

for name, score in scores do
	print(name, score)
end
```

For arrays, generalized iteration visits indices **1, 2, 3 … in order**. For dictionary entries, the order is **unspecified** — it may differ from how you wrote them, and you must never depend on it. If you need a specific order, sort the keys first (see below).

### ipairs and pairs

You'll see two functions all over older code, and it's worth knowing exactly how they differ:

| Loop | Visits | Order | Stops at first `nil`? |
| --- | --- | --- | --- |
| `for i, v in ipairs(t)` | Array part only: 1, 2, 3… | In order | **Yes** |
| `for k, v in pairs(t)` | Every key | Unspecified | No |
| `for k, v in t` | Every key | Array part in order, then the rest | No |

```luau
local t = {"a", "b", nil, "d"}
for i, v in ipairs(t) do
	print(i, v)       --> 1 a, 2 b   (stops at the hole at index 3)
end
```

All three are fine in modern Luau. Generalized iteration is the most concise, and `ipairs` is handy when you deliberately want to stop at the first gap.

## The length operator and holes

`#t` returns the length of the **array part** — but only if the array has no **holes** (`nil`s in the middle):

```luau
local ok = {1, 2, 3}
print(#ok)  --> 3

local holey = {1, 2, nil, 4}
print(#holey)  --> 4 or 2 — either answer is "correct"!
```

:::danger Never put holes in arrays
If an array has a `nil` in the middle, `#` may return the position before *any* hole. Its result is not reliable. To remove from the middle of an array, use `table.remove`, which shifts later items down and keeps the array solid.
:::

`#` also doesn't count dictionary keys: `#{ a = 1, b = 2 }` is `0`. To count entries in a dictionary, loop and count.

## The table library

| Function | What it does |
| --- | --- |
| `table.insert(t, v)` | Append `v` to the end |
| `table.insert(t, i, v)` | Insert `v` at index `i`, shifting later items up |
| `table.remove(t)` | Remove and return the last item |
| `table.remove(t, i)` | Remove and return item `i`, shifting later items down |
| `table.find(t, v)` | Index of the first element equal to `v`, or `nil` |
| `table.sort(t, comp?)` | Sort the array **in place** |
| `table.concat(t, sep?)` | Join an array of strings/numbers into one string |
| `table.clone(t)` | A **shallow** copy of the table |
| `table.clear(t)` | Remove every entry (keeps the same table object) |
| `table.freeze(t)` | Make the table read-only; `table.isfrozen(t)` checks |
| `table.create(n, v?)` | Preallocate an array of `n` items, optionally filled with `v` |
| `table.move(a, f, e, t, b?)` | Copy `a[f..e]` into `b` (or `a`) starting at index `t` |
| `table.unpack(t, i?, j?)` | Return array items as separate values |
| `table.pack(...)` | Pack values into a table with an `n` count |

```luau
local queue = {"Koala", "Builderman"}
table.insert(queue, "Noob")            -- {"Koala", "Builderman", "Noob"}
table.insert(queue, 1, "VIP")          -- {"VIP", "Koala", "Builderman", "Noob"}

local first = table.remove(queue, 1)   -- "VIP"; queue shifts down
print(first, #queue)                   --> VIP 3

print(table.find(queue, "Noob"))       --> 3
print(table.find(queue, "Zombie"))     --> nil

print(table.concat(queue, ", "))       --> Koala, Builderman, Noob
```

### Sorting

`table.sort` sorts an array in place. By default it uses `<`, which works for numbers or strings. Pass a **comparison function** to sort any other way — it receives two elements and returns `true` if the first should come **before** the second:

```luau
local scores = {42, 7, 99, 15}
table.sort(scores)
print(table.concat(scores, " "))  --> 7 15 42 99

table.sort(scores, function(a, b)
	return a > b   -- descending
end)
print(table.concat(scores, " "))  --> 99 42 15 7

local players = {
	{ name = "Koala", score = 120 },
	{ name = "Noob", score = 3 },
	{ name = "Builderman", score = 95 },
}
table.sort(players, function(a, b)
	return a.score > b.score
end)
print(players[1].name)  --> Koala
```

:::warning Comparators must be strict
A comparator must return `false` when two elements are equal — use `<` or `>`, **never** `<=` or `>=`. An inconsistent comparator can make `table.sort` raise *"invalid order function for sorting"* or produce garbage.
:::

### Sorting a dictionary

Dictionaries have no order, so you can't sort them directly. Instead, collect the keys into an array, sort that, then iterate it:

```luau
local stock = { sword = 3, apple = 10, potion = 5 }

local names = {}
for name in stock do
	table.insert(names, name)
end
table.sort(names)

for _, name in names do
	print(name, stock[name])  --> apple 10, potion 5, sword 3
end
```

## Tables are references

This is the single most important concept in this module. A variable doesn't *contain* a table — it holds a **reference** to it (think: the table's address). Assigning a table to another variable copies the reference, **not** the table:

```luau
local a = {1, 2, 3}
local b = a          -- b refers to the SAME table
b[1] = 100
print(a[1])          --> 100  (a changed too!)
```

The same happens when you pass a table to a function: the function receives a reference and can modify the original.

```luau
local function addBonus(stats)
	stats.coins += 50
end

local myStats = { coins = 10 }
addBonus(myStats)
print(myStats.coins)  --> 60
```

That's also why `{} == {}` is `false`: `==` on tables compares **identity** (are they the same table?), not contents.

### Shallow vs. deep copies

`table.clone` makes a new table with the same keys and values — a **shallow** copy. Nested tables inside are still shared:

```luau
local original = { name = "Koala", stats = { hp = 100 } }
local copy = table.clone(original)

copy.name = "Clone"
copy.stats.hp = 1

print(original.name)      --> Koala   (top level was copied)
print(original.stats.hp)  --> 1       (nested table is shared!)
```

When you need a fully independent copy, write a recursive **deep copy**:

```luau
local function deepCopy(t)
	local result = {}
	for k, v in t do
		result[k] = if type(v) == "table" then deepCopy(v) else v
	end
	return result
end
```

:::pro When does copying matter?
Constantly on Roblox. A classic bug: using one "default data" table as the starting data for every player. Without a deep copy, every player shares — and edits — the *same* table. You'll avoid this in @datastores.
:::

## Freezing tables

`table.freeze` makes a table **read-only**. Any attempt to change it raises an error. It's perfect for configuration that should never change at runtime:

```luau
local CONFIG = table.freeze({
	MAX_PLAYERS = 12,
	ROUND_TIME = 180,
})

-- CONFIG.ROUND_TIME = 999  --> error: attempt to modify a readonly table
```

Freezing is shallow too — nested tables stay writable unless you freeze them as well.

## Common data structures

Tables can model any classic data structure.

### Sets

A **set** is a collection of unique items where you only care whether something is present. Use the items as **keys** with the value `true`:

```luau
local admins = { [12345] = true, [67890] = true }

local function isAdmin(userId)
	return admins[userId] == true
end

print(isAdmin(12345))  --> true
print(isAdmin(11111))  --> false
```

:::tip Sets beat table.find
Looking up `set[key]` takes the same tiny amount of time no matter how big the set is. `table.find(array, value)` has to check every element one by one. For frequent "is this in the list?" checks, use a set.
:::

### Stacks (last in, first out)

```luau
local undoStack = {}
table.insert(undoStack, "place block")
table.insert(undoStack, "paint block")
print(table.remove(undoStack))  --> paint block  (last in, first out)
```

### Queues (first in, first out)

```luau
local matchQueue = {}
table.insert(matchQueue, "Koala")
table.insert(matchQueue, "Builderman")
print(table.remove(matchQueue, 1))  --> Koala  (first in, first out)
```

`table.remove(t, 1)` shifts every remaining element, so for very large queues you'd track head and tail indices instead — but for matchmaking queues of a few dozen players it's perfectly fine.

### Records and arrays of records

The most common shape in game code is an array of dictionaries ("records"):

```luau
local shopItems = {
	{ id = "speed_coil", name = "Speed Coil", price = 250 },
	{ id = "gravity_coil", name = "Gravity Coil", price = 400 },
	{ id = "sword", name = "Classic Sword", price = 100 },
}

for _, item in shopItems do
	print(`{item.name}: {item.price} coins`)
end
```

## Removing while iterating

Removing items from an array while looping **forward** over it skips elements, because everything shifts down underneath your loop:

```luau
local enemies = {"dead", "dead", "alive", "dead"}

-- Bug: forward iteration skips the second "dead"
for i = 1, #enemies do
	if enemies[i] == "dead" then
		table.remove(enemies, i)
	end
end
```

The fix is to iterate **backwards**, so removals only shift elements you've already visited:

```luau
local enemies = {"dead", "dead", "alive", "dead"}
for i = #enemies, 1, -1 do
	if enemies[i] == "dead" then
		table.remove(enemies, i)
	end
end
print(table.concat(enemies, ", "))  --> alive
```

Or build a new array containing only what you want to keep — often the clearest option of all.

:::quiz Tables
? What does `local t = {"a", "b", "c"}; print(t[0])` print?
- `a`
+ `nil`
- `c`
- An error
> Arrays start at index 1. Index 0 holds nothing.

? `local a = {1}; local b = a; b[1] = 5` — what is `a[1]` now?
- `1`
+ `5`
- `nil`
- An error
> `b = a` copies the reference, so both variables point at the same table.

? Which loop is guaranteed to visit dictionary keys in a specific order?
- `for k, v in pairs(t)`
- `for k, v in t`
- `for i, v in ipairs(t)`
+ None of them — dictionary order is unspecified; sort the keys yourself
> Only the array part has a defined order. For dictionaries, collect and sort the keys.

? Which comparator correctly sorts numbers in descending order?
+ `function(a, b) return a > b end`
- `function(a, b) return a >= b end`
- `function(a, b) return b - a end`
- `function(a, b) return a < b end`
> Comparators must return a boolean and be strict. `>=` can break the sort; `b - a` returns a number, which is always truthy.

? What's the safest way to remove matching items from an array while looping?
- Loop forward with a numeric `for`
+ Loop backwards from `#t` to `1`
- Set the items to `nil`
- Use `pairs`
> Iterating backwards means removals only shift items you've already checked. Setting to `nil` creates holes.

? What does `table.clone` produce?
- A deep copy, including nested tables
+ A shallow copy — nested tables are still shared
- A frozen copy
- A reference to the same table
> `table.clone` copies one level. Nested tables are the same objects in both copies.

? What's the best structure for checking "is this userId an admin?" many times?
- An array searched with `table.find`
+ A set: `{ [userId] = true }`
- A string of comma-separated ids
- A frozen array
> Set lookups take constant time regardless of size; `table.find` scans every element.
:::

:::predict References
```luau
local a = { hp = 100 }
local b = a
local c = table.clone(a)
b.hp = 50
c.hp = 10
print(a.hp, b.hp, c.hp)
```
= 50 50 10
> `a` and `b` are the same table, so changing `b.hp` changes `a.hp`. `c` is a separate copy.
:::

:::predict table.insert and table.remove
```luau
local t = {"a", "b", "c"}
table.insert(t, 2, "x")
local removed = table.remove(t)
print(table.concat(t, ""), removed, #t)
```
= axb c 3
> Inserting `"x"` at index 2 gives `{"a", "x", "b", "c"}`. `table.remove(t)` removes and returns the last element, `"c"`, leaving three elements.
:::

:::predict ipairs stops at holes
```luau
local t = {10, 20, nil, 40}
local count = 0
for _, v in ipairs(t) do
	count += 1
end
print(count)
```
= 2
> `ipairs` stops at the first `nil`, which is at index 3.
:::

## Challenges

:::challenge easy | Inventory basics
Start with `local inventory = {"Sword", "Shield"}`. Then:

1. Add `"Potion"` and `"Map"` to the end.
2. Insert `"Helmet"` at the front.
3. Remove `"Shield"` (find its index first — don't hard-code it).
4. Print the final inventory as a comma-separated string and its length.
@hint
`table.find` returns the index of a value; pass it to `table.remove`.
@solution
```luau
local inventory = {"Sword", "Shield"}
table.insert(inventory, "Potion")
table.insert(inventory, "Map")
table.insert(inventory, 1, "Helmet")

local shieldIndex = table.find(inventory, "Shield")
if shieldIndex then
	table.remove(inventory, shieldIndex)
end

print(table.concat(inventory, ", "), #inventory)
--> Helmet, Sword, Potion, Map 4
```
:::

:::challenge easy | Word counter
Given a sentence, count how many times each word appears and print the counts. `"the cat and the hat and the bat"` should report `the 3`, `and 2`, `cat 1`, `hat 1`, `bat 1` (any order).
@hint
Use a dictionary where each word is a key and the value is its count. `gmatch("%a+")` gives you each word.
@solution
```luau
local sentence = "the cat and the hat and the bat"
local counts = {}

for word in sentence:gmatch("%a+") do
	counts[word] = (counts[word] or 0) + 1
end

for word, n in counts do
	print(word, n)
end
```
`(counts[word] or 0) + 1` handles the first time a word is seen, when `counts[word]` is still `nil`.
:::

:::challenge medium | Leaderboard
Given this data, print a ranked leaderboard sorted by score (highest first). Ties should be broken alphabetically by name.

```luau
local scores = { Koala = 120, Builderman = 95, Noob = 120, Guest = 40 }
```

Expected output:

```output
1. Koala - 120
2. Noob - 120
3. Builderman - 95
4. Guest - 40
```
@hint
Convert the dictionary into an array of `{ name = ..., score = ... }` records, then sort that.
@hint
In your comparator: if the scores differ, compare scores; otherwise compare names with `<`.
@solution
```luau
local scores = { Koala = 120, Builderman = 95, Noob = 120, Guest = 40 }

local entries = {}
for name, score in scores do
	table.insert(entries, { name = name, score = score })
end

table.sort(entries, function(a, b)
	if a.score ~= b.score then
		return a.score > b.score
	end
	return a.name < b.name
end)

for rank, entry in entries do
	print(`{rank}. {entry.name} - {entry.score}`)
end
```
:::

:::challenge medium | Remove the defeated
You have an array of enemies:

```luau
local enemies = {
	{ name = "Goblin", hp = 0 },
	{ name = "Orc", hp = 0 },
	{ name = "Troll", hp = 30 },
	{ name = "Bat", hp = 0 },
	{ name = "Dragon", hp = 500 },
}
```

Remove every enemy with `hp <= 0` **in place** (modify this table, don't build a new one), then print the names that remain.
@hint
Loop backwards: `for i = #enemies, 1, -1 do`.
@solution
```luau
for i = #enemies, 1, -1 do
	if enemies[i].hp <= 0 then
		table.remove(enemies, i)
	end
end

for _, enemy in enemies do
	print(enemy.name)  --> Troll, Dragon
end
```
:::

:::challenge hard | Deep copy and deep equal
Write two recursive functions:

1. `deepCopy(t)` — returns a fully independent copy of a table, including nested tables.
2. `deepEqual(a, b)` — returns `true` if two values are equal *by content*: same primitive value, or tables with the same keys whose values are all `deepEqual`.

```luau
local original = { name = "Koala", pos = { x = 1, y = 2 }, tags = {"vip", "builder"} }
local copy = deepCopy(original)
print(copy == original)             --> false
print(deepEqual(copy, original))    --> true
copy.pos.x = 99
print(original.pos.x)               --> 1
print(deepEqual(copy, original))    --> false
```
@hint
`deepEqual`: if either value isn't a table, compare with `==`. Otherwise check every key in `a` exists in `b` with an equal value — **and** that `b` has no extra keys.
@solution
```luau
local function deepCopy(t)
	local result = {}
	for k, v in t do
		result[k] = if type(v) == "table" then deepCopy(v) else v
	end
	return result
end

local function deepEqual(a, b)
	if type(a) ~= "table" or type(b) ~= "table" then
		return a == b
	end
	for k, v in a do
		if not deepEqual(v, b[k]) then
			return false
		end
	end
	for k in b do
		if a[k] == nil then
			return false
		end
	end
	return true
end
```
This `deepCopy` doesn't handle tables that contain themselves (cycles) or copy metatables. Handling cycles needs a "seen" table that maps originals to copies — a great extension if you want more practice.
:::

:::recap
- Tables hold key → value pairs. Arrays use keys `1..n`; dictionaries use named keys.
- `t.key` is sugar for `t["key"]`. Setting a key to `nil` removes it.
- Loop with `for k, v in t do`. Arrays iterate in order; dictionary order is unspecified.
- `#t` is only reliable for arrays **without holes**. Use `table.insert` / `table.remove` to keep arrays solid.
- Know the table library: `insert`, `remove`, `find`, `sort`, `concat`, `clone`, `clear`, `freeze`, `create`.
- Tables are **references**. `table.clone` is shallow; write a deep copy when nested data must be independent.
- Sets (`{[x] = true}`) give fast membership checks. Remove while iterating by going **backwards**.
:::
