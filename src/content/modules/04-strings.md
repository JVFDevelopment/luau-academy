---
id: strings
title: Strings
part: 1
summary: Everything about text — escapes, interpolation, slicing, the string library, `string.format`, and Luau's powerful pattern matching.
time: 40 min
level: Beginner
objectives:
- Write strings with escapes, long brackets and interpolation
- Slice and inspect strings with `sub`, `#`, `find` and `byte`
- Format numbers and text precisely with `string.format`
- Search, extract and replace text with Luau patterns
- Split, join and transform strings for real game features
---

Strings are everywhere in a game: player names, chat commands, UI labels, data keys, error messages. Luau's string tools are compact but surprisingly powerful once you know them.

## Writing strings

A string literal is text between matching quotes. Single and double quotes behave identically, so pick whichever avoids escaping:

```luau
local a = "It's easy"         -- double quotes, so the apostrophe is fine
local b = 'She said "hi"'     -- single quotes, so the double quotes are fine
```

### Escape sequences

Inside quotes, a backslash starts an **escape sequence** for characters you can't type directly:

| Escape | Meaning |
| --- | --- |
| `\n` | New line |
| `\t` | Tab |
| `\\` | A literal backslash |
| `\"` and `\'` | A literal quote |
| `\u{2764}` | The Unicode character with that hex code (here, ❤) |
| `\z` | Skips the following whitespace and line breaks (for wrapping long strings) |

```luau
print("Line one\nLine two")
print("Name:\tKoala")
print("C:\\Games\\Roblox")
```

```output
Line one
Line two
Name:	Koala
C:\Games\Roblox
```

### Long strings

Double square brackets create a **long string** that can span multiple lines. Escapes are *not* processed inside, which makes them great for blocks of text:

```luau
local rules = [[
Welcome to the arena!
1. No teaming
2. Have fun
]]
print(rules)
```

A newline directly after the opening `[[` is ignored. If your text contains `]]`, add equal signs: `[==[ ... ]==]`.

## Strings are immutable

You can never change a string in place. Every operation — uppercasing, replacing, slicing — returns a **new** string and leaves the original untouched:

```luau
local name = "koala"
name:upper()            -- creates "KOALA" and throws it away
print(name)             --> koala

name = name:upper()     -- keep the result
print(name)             --> KOALA
```

## Concatenation

You've already met `..`, which joins strings. Numbers are converted automatically:

```luau
local item = "Sword"
local price = 150
print("Buy " .. item .. " for " .. price .. " coins")
```

:::warning Building strings in a loop
Each `..` creates a brand-new string. Joining thousands of pieces with `..` inside a loop is slow because it copies everything each time. Instead, collect the pieces in a table and join them once with `table.concat(pieces, separator)` — you'll learn this in @tables.
:::

## String interpolation

Luau's **interpolated strings** use backticks. Anything inside `{ }` is evaluated as an expression and converted to text:

```luau
local player = "Koala"
local coins = 120
local multiplier = 2

print(`{player} has {coins} coins`)
print(`With the boost that's {coins * multiplier}!`)
print(`Level up in {100 - coins % 100} more coins`)
```

```output
Koala has 120 coins
With the boost that's 240!
Level up in 80 more coins
```

Interpolation is the most readable way to build messages, and it's what you'll see in modern Roblox code. A few details:

- Values are converted with `tostring`, so tables and Instances print however they normally would.
- To include a literal brace, escape it: `` `\{not code}` ``.
- Interpolation has no formatting options (like "2 decimal places") — use `string.format` for that.
- You can't call a function with a backtick string and no parentheses — write ``print(`hi`)``, not ``print`hi` ``.

## Methods and the colon

Every string function lives in the `string` library, and you can call them two ways:

```luau
local s = "hello"
print(string.upper(s))   --> HELLO
print(s:upper())         --> HELLO
```

`s:upper()` is shorthand for `string.upper(s)` — the colon passes the string itself as the first argument. Most code uses the colon form because it reads naturally. To call a method on a literal, wrap it in parentheses: `("hello"):upper()`.

## Indexing and slicing

Strings are indexed from **1** (not 0), and negative indices count from the end. `string.sub(s, i, j)` returns the characters from position `i` through `j` inclusive:

```luau
local word = "Roblox"
--            123456     (positive positions)
--           -654321     (negative positions)

print(word:sub(1, 3))   --> Rob
print(word:sub(4))      --> lox   (to the end)
print(word:sub(-3))     --> lox   (last three characters)
print(word:sub(2, -2))  --> oblo
print(word:sub(1, 1))   --> R     (first character)
print(#word)            --> 6
```

There's no `word[1]` for strings — use `word:sub(1, 1)`.

## The essential string functions

| Function | What it does | Example | Result |
| --- | --- | --- | --- |
| `s:upper()` / `s:lower()` | Change case | `("Hi"):upper()` | `"HI"` |
| `s:len()` or `#s` | Length in bytes | `#"abc"` | `3` |
| `s:rep(n)` | Repeat `n` times | `("ab"):rep(3)` | `"ababab"` |
| `s:reverse()` | Reverse | `("abc"):reverse()` | `"cba"` |
| `s:sub(i, j)` | Slice | `("hello"):sub(2, 3)` | `"el"` |
| `s:find(p)` | Find position of a match | `("hello"):find("ll")` | `3  4` |
| `s:match(p)` | Extract the first match | `("Lv 42"):match("%d+")` | `"42"` |
| `s:gmatch(p)` | Iterate over all matches | see below | |
| `s:gsub(p, r)` | Replace matches | `("a.b"):gsub("%.", "-")` | `"a-b"  1` |
| `s:split(sep)` | Split into a table | `("a,b"):split(",")` | `{"a", "b"}` |
| `s:format(...)` | Formatted output | `("%d%%"):format(50)` | `"50%"` |
| `s:byte(i)` / `string.char(n)` | Character ↔ code | `("A"):byte()` | `65` |

### Comparing case-insensitively

Because `"Apple" == "apple"` is `false`, normalize both sides when case shouldn't matter — for example when matching chat commands:

```luau
local input = "HeLLo"
if input:lower() == "hello" then
	print("Matched!")
end
```

### Splitting

`string.split` (a Luau addition) breaks a string into a table of pieces:

```luau
local parts = ("sword,shield,potion"):split(",")
print(parts[1], parts[2], parts[3]) --> sword shield potion
print(#parts)                       --> 3
```

Empty pieces are kept: `("a,,b"):split(",")` gives `{"a", "", "b"}`.

## string.format

`string.format` builds a string from a **template** containing format specifiers that start with `%`:

| Specifier | Formats | Example | Result |
| --- | --- | --- | --- |
| `%s` | Any value as a string | `("Hi %s"):format("Koala")` | `Hi Koala` |
| `%d` | A whole number | `("%d coins"):format(42)` | `42 coins` |
| `%.2f` | A decimal with 2 places | `("%.2f"):format(3.14159)` | `3.14` |
| `%5d` | Pad to width 5 | `("[%5d]"):format(42)` | `[   42]` |
| `%-5s` | Left-align in width 5 | `("[%-5s]"):format("ab")` | `[ab   ]` |
| `%02d` | Pad with zeros | `("%02d"):format(7)` | `07` |
| `%x` | Hexadecimal | `("%x"):format(255)` | `ff` |
| `%q` | Quoted, escaped string | `("%q"):format('a"b')` | `"a\"b"` |
| `%%` | A literal percent sign | `("%d%%"):format(90)` | `90%` |

```luau
local minutes, seconds = 3, 7
print(string.format("Time left: %d:%02d", minutes, seconds)) --> Time left: 3:07

local accuracy = 0.8734
print(("Accuracy: %.1f%%"):format(accuracy * 100))           --> Accuracy: 87.3%
```

## Patterns

Patterns are Luau's lightweight version of regular expressions. They power `find`, `match`, `gmatch` and `gsub`. A pattern describes the *shape* of text you're looking for.

### Character classes

| Class | Matches |
| --- | --- |
| `.` | Any character |
| `%a` | Letters |
| `%d` | Digits |
| `%l` / `%u` | Lowercase / uppercase letters |
| `%s` | Whitespace (space, tab, newline) |
| `%w` | Letters and digits ("alphanumeric") |
| `%p` | Punctuation |
| `%x` | Hexadecimal digits |
| `[abc]` | Any one of `a`, `b` or `c` |
| `[a-z]` | Any character in a range |
| `[^abc]` | Any character **except** these |

An uppercase class is the **opposite**: `%D` is any non-digit, `%S` any non-whitespace, `%W` any non-alphanumeric.

### Quantifiers and anchors

| Symbol | Meaning |
| --- | --- |
| `+` | One or more (as many as possible) |
| `*` | Zero or more (as many as possible) |
| `-` | Zero or more (as **few** as possible) |
| `?` | Optional — zero or one |
| `^` | At the start of the pattern: anchors to the beginning of the string |
| `$` | At the end of the pattern: anchors to the end of the string |

### Magic characters

These characters have special meaning in patterns: `^ $ ( ) % . [ ] * + - ?`. To match one literally, escape it with `%` — `%.` matches an actual dot, `%%` an actual percent sign.

:::tip Plain find
When you just want to find literal text — say, user input — pass `true` as the fourth argument to `find` to switch patterns off entirely: `message:find(word, 1, true)`. That way a player typing `.` or `%` can't break your search.
:::

### Captures

Parentheses **capture** part of a match, and `match` returns the captures:

```luau
local key, value = ("speed=16"):match("(%w+)=(%w+)")
print(key, value) --> speed 16

local level = ("Player reached level 27!"):match("level (%d+)")
print(level, typeof(level)) --> 27 string
```

Captures are always strings — convert with `tonumber` when you need a number.

### Practical patterns

```luau
-- Trim whitespace from both ends
local trimmed = ("   hello world   "):match("^%s*(.-)%s*$")
print(`[{trimmed}]`) --> [hello world]

-- Validate a username: only letters, digits and underscores, 3 to 20 long
local function isValidName(name)
	return #name >= 3 and #name <= 20 and name:match("^[%w_]+$") ~= nil
end
print(isValidName("Koala_99")) --> true
print(isValidName("no spaces")) --> false

-- Iterate over every number in a string
for n in ("Scores: 10, 25, 7"):gmatch("%d+") do
	print(tonumber(n))
end
```

### Replacing with gsub

`gsub` ("global substitute") replaces every match and returns **two** values: the new string and the number of replacements.

```luau
local text, count = ("2024-01-15"):gsub("%-", "/")
print(text, count) --> 2024/01/15 2
```

The replacement can reference captures with `%1`, `%2`… or be a **function** that computes each replacement:

```luau
-- Swap "first last" to "last, first"
print((("Ada Lovelace"):gsub("(%a+) (%a+)", "%2, %1"))) --> Lovelace, Ada

-- Double every number using a function
local doubled = ("3 apples and 5 pears"):gsub("%d+", function(n)
	return tostring(tonumber(n) * 2)
end)
print(doubled) --> 6 apples and 10 pears
```

:::note Why the extra parentheses?
`print(s:gsub(...))` prints **both** return values — the string *and* the count. Wrapping a call in an extra pair of parentheses, `print((s:gsub(...)))`, keeps only the first value. Assigning to a single variable (`local doubled = ...`) also keeps just the first.
:::

## Characters, bytes and UTF-8

Strings are sequences of **bytes**. For plain English text one character is one byte, but emoji and many non-English characters take several bytes. That means `#` counts *bytes*, not visible characters:

```luau
print(#"hello")    --> 5
print(#"héllo")    --> 6  (é takes two bytes)
print(utf8.len("héllo")) --> 5
```

When you work with player-entered text (names, chat, signs), use the `utf8` library for character-aware operations. On Roblox, any text one player writes that other players can see must also go through **text filtering** — covered in @services and @security.

:::quiz Strings
? What does `("Roblox"):sub(-3)` return?
- `"Rob"`
+ `"lox"`
- `"x"`
- `"blox"`
> Negative indices count from the end; `sub(-3)` returns the last three characters.

? Which line correctly prints `Hi Koala` using interpolation?
+ ``print(`Hi {name}`)``
- `print("Hi {name}")`
- `print('Hi ${name}')`
- `print(Hi .. {name})`
> Interpolation only works in backtick strings, with the expression inside `{ }` — no `$`.

? What does `("a.b.c"):gsub(".", "-")` produce?
- `"a-b-c"`
+ `"-----"`
- `"a.b.c"`
- An error
> `.` is a magic character meaning *any character*, so every character gets replaced. To match a literal dot, escape it: `"%."`.

? Strings in Luau are immutable. What does that mean?
- They can't be printed
- They can only contain letters
+ Operations return new strings instead of changing the original
- They can't be stored in tables
> `s:upper()` returns a new string; `s` itself is unchanged until you reassign it.

? What does `%d` match in a pattern?
- The letter d
+ A single digit
- Any number of digits
- A decimal point
> `%d` is one digit. `%d+` is one or more digits.

? What does `string.format("%05.1f", 3.14159)` produce?
- `3.1`
- `3.14159`
+ `003.1`
- `00003`
> Width 5 padded with zeros, 1 decimal place: `003.1` is five characters long.
:::

:::predict Slicing
```luau
local s = "Roblox"
print(s:sub(2, 4), s:sub(-3), #s)
```
= obl lox 6
> Positions 2 to 4 are `o`, `b`, `l`. `sub(-3)` takes the last three characters. The string has six characters.
:::

:::predict Formatting
```luau
print(("ha"):rep(3))
print(string.format("%03d|%.1f", 7, 3.14159))
print(`{2 + 3} is {if 2 + 3 > 4 then "big" else "small"}`)
```
= hahaha
= 007|3.1
= 5 is big
> `rep` repeats the string. `%03d` pads to three digits with zeros. `%.1f` keeps one decimal. Interpolation can contain any expression, including an `if` expression.
:::

:::predict gsub returns two values
```luau
local text, count = ("a-b-c"):gsub("%-", "+")
print(text, count)
```
= a+b+c 2
> `gsub` returns the new string and how many replacements were made. `%-` matches a literal dash.
:::

## Challenges

:::challenge easy | Shout and whisper
Given `local message = "Welcome to the Arena"`, print:

1. The message in all caps.
2. The message in all lowercase.
3. The number of characters.
4. The message reversed.
5. The first word only (use `find` or `match`).
@hint
`%a+` matches one run of letters; `match` returns the first one it finds.
@solution
```luau
local message = "Welcome to the Arena"
print(message:upper())
print(message:lower())
print(#message)
print(message:reverse())
print(message:match("%a+"))
```
:::

:::challenge medium | Title Case
Write a function `titleCase(s)` that capitalizes the first letter of every word and lowercases the rest. `titleCase("the QUICK brown fox")` should return `"The Quick Brown Fox"`.
@hint
`gsub` with the pattern `"(%a)(%a*)"` captures the first letter of each word and the rest separately.
@hint
Use a function as the replacement: it receives the captures and returns the new text.
@solution
```luau
local function titleCase(s)
	local result = s:gsub("(%a)(%a*)", function(first, rest)
		return first:upper() .. rest:lower()
	end)
	return result
end

print(titleCase("the QUICK brown fox")) --> The Quick Brown Fox
```
Assigning to `result` before returning keeps only the first return value of `gsub`.
:::

:::challenge medium | Number with commas
Leaderboards look much better with `1,234,567` than `1234567`. Write `withCommas(n)` that formats a whole number with thousands separators. Make sure `999` stays `999`, `1000` becomes `1,000`, and negative numbers work too.
@hint
It's easier to insert a comma after every three digits if you work on the *reversed* string.
@hint
`("7654321"):gsub("(%d%d%d)", "%1,")` gives `"765,432,1"`. Reverse it back — then deal with a possible leading comma.
@solution
```luau
local function withCommas(n)
	local digits = tostring(math.floor(math.abs(n)))
	local out = digits:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	out = out:gsub("^,", "")
	return (if n < 0 then "-" else "") .. out
end

print(withCommas(999))      --> 999
print(withCommas(1000))     --> 1,000
print(withCommas(1234567))  --> 1,234,567
print(withCommas(-50000))   --> -50,000
```
:::

:::challenge hard | Chat command parser
Admin commands arrive as chat messages like `"!give Koala 250"` or `"!kick Builderman"`. Write `parseCommand(message)` that returns the command name and a table of arguments — or `nil` if the message isn't a command (doesn't start with `!`).

```luau
local name, args = parseCommand("!give Koala 250")
print(name, args[1], args[2]) --> give Koala 250
print(parseCommand("hello"))  --> nil
```

Extra credit: ignore extra spaces between words, and make the command name lowercase so `!GIVE` works too.
@hint
Check the first character with `message:sub(1, 1)` or anchor a pattern with `^!`.
@hint
`gmatch("%S+")` iterates over every run of non-space characters — perfect for splitting on any amount of whitespace.
@solution
```luau
local function parseCommand(message)
	if message:sub(1, 1) ~= "!" then
		return nil
	end

	local words = {}
	for word in message:sub(2):gmatch("%S+") do
		table.insert(words, word)
	end
	if #words == 0 then
		return nil
	end

	local name = table.remove(words, 1):lower()
	return name, words
end

local name, args = parseCommand("!GIVE   Koala   250")
print(name, args[1], args[2]) --> give Koala 250
```
`table.insert` and `table.remove` come from the table library — you'll master them in the next modules. In a real game, the *server* must also check that the speaker is actually an admin before running anything!
:::

:::recap
- Use `"..."` or `'...'`, escapes like `\n`, and `[[...]]` for multi-line text.
- Strings are immutable; methods return new strings. `s:method()` is `string.method(s)`.
- Interpolate with backticks: `` `Hello {name}` ``. Format precisely with `string.format`.
- Strings are 1-indexed; `sub` takes negative indices from the end.
- Patterns: classes (`%a %d %s %w`), quantifiers (`+ * - ?`), anchors (`^ $`), captures `()`. Escape magic characters with `%`.
- `gsub` returns the new string **and** a count. `find(s, 1, true)` searches literally.
- `#` counts bytes; use `utf8` functions for player-entered text.
:::
