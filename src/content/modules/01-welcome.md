---
id: welcome
title: Welcome to Luau
part: 1
summary: What Luau is, how this course works, and how to write and run your very first script — both in the browser and in Roblox Studio.
time: 20 min
level: Beginner
objectives:
- Understand what Luau is and where it came from
- Run Luau code in the browser and in Roblox Studio
- Know the three kinds of scripts and where each one runs
- Write your first program with `print`, `warn` and comments
- Read an error message and jump straight to the line that caused it
---

Welcome! You're about to learn the language behind every single Roblox experience — from tiny obbies to front-page games with millions of players. This first module gets you set up, explains how the course works, and has you writing real code within minutes.

No experience needed. If you've never programmed before, you're in exactly the right place. If you have, skim this module and jump into the quizzes to check you're not missing anything Luau-specific.

## What is Luau?

**Luau** (pronounced *loo-ow*, like the Hawaiian feast) is a fast, small, safe programming language created by Roblox. It started life as a fork of **Lua 5.1** — a popular language used in games for decades — and Roblox has spent years rebuilding and extending it:

- A completely rewritten compiler and virtual machine that runs code dramatically faster than the original Lua.
- **Gradual type checking**, so tooling can catch bugs before you ever press Play.
- Modern syntax: string interpolation, compound assignment (`+=`), `continue`, `if` expressions and more.
- A much richer standard library, including the `task` scheduler, `buffer` and `vector`.
- Optional **native code generation** that compiles hot code straight to machine code.

Luau has been open source since 2021 under the MIT license, and while Roblox is by far its biggest user, other game studios use it too. The language itself is the same everywhere — what changes is the set of *APIs* (built-in objects and functions) the host program gives you. On Roblox, that means things like `game`, `workspace`, `Instance` and `Vector3`.

| Feature | Lua 5.1 | Luau |
| --- | --- | --- |
| Type annotations & checking | No | Yes — `--!strict` |
| String interpolation | No | Yes — `` `Hi {name}` `` |
| Compound assignment | No | Yes — `x += 1` |
| `continue` in loops | No | Yes |
| `if` expressions | No | Yes — `if a then b else c` |
| Floor division operator | No | Yes — `7 // 2` |
| Native code generation | No | Yes — `--!native` |

:::info Reading old Lua tutorials
Most Lua 5.1 material still applies to Luau, so older tutorials aren't useless. Just be aware that Luau removed or restricts a few things: there's no `goto`, no `__gc` metamethod, `getfenv`/`setfenv` are deprecated (and switch off optimizations), and `loadstring` is disabled by default on Roblox.
:::

## How this course works

The course is split into **six parts**. Parts I and II teach the Luau language itself. Parts III–VI teach the Roblox engine: how to build worlds, systems, data, security and full games. Every module mixes reading with doing:

:::cards
- **Run buttons** — Pure-Luau code blocks have a **Run** button. It opens the example in the official Luau Playground right below the code so you can tweak it.
- **Predict the output** — Read some code, type exactly what you think it prints, and check yourself. This is the fastest way to build an accurate mental model.
- **Knowledge checks** — Short quizzes with an explanation for every answer.
- **Challenges** — Real coding tasks rated Easy, Medium, Hard or Boss, each with progressive hints and a reference solution.
- **XP & ranks** — Everything you complete earns XP. Climb from *Newcomer* to *Luau Master* and unlock a certificate.
- **Saved locally** — Your progress is stored in your browser. No account required.
:::

:::pro Type it, don't paste it
It's tempting to copy-paste examples. Don't — at least not in Part I. Typing code yourself forces you to notice every symbol, and the small typos you make (and fix) are some of the best teachers you'll get.
:::

## Running code in your browser

For the first two parts of the course you don't need anything installed. Click **Run** on the block below — the Luau Playground opens underneath it. Then press the playground's own **Run** button and watch the output appear.

```luau
print("Hello, Luau!")
```

The playground runs *pure* Luau. That's perfect for learning the language, but it doesn't know about Roblox-specific things like `workspace` or `Instance.new`. Code blocks that need Roblox are labelled **Roblox Studio** and have no Run button.

## Setting up Roblox Studio

Roblox Studio is the free editor you use to build Roblox experiences. You'll need it from Part III onward, so it's worth setting up now.

:::steps
1. Download Roblox Studio from [create.roblox.com](https://create.roblox.com) and sign in with your Roblox account.
2. On the start screen, choose **New → Baseplate**. This gives you an empty world with a floor and a spawn point.
3. Open the **View** tab in the top ribbon and turn on **Explorer**, **Properties** and **Output**. You'll use these three windows constantly.
4. In the Explorer, hover over **ServerScriptService**, click the **+** button and choose **Script**. A new script opens with `print("Hello world!")` already inside.
5. Press **Play** (++F5++). Your character spawns and the Output window shows the message. Press **Stop** (++Shift+F5++) to return to editing.
:::

Here's what a fresh Baseplate looks like in the Explorer. Each line is an *Instance* — an object in your game. You'll learn all about them in @instances.

:::tree A fresh Baseplate place
game
  Workspace # everything physically in the 3D world
    Camera (Camera)
    Baseplate (Part)
    SpawnLocation (SpawnLocation)
  Players # one Player object per connected player
  Lighting
  ReplicatedFirst
  ReplicatedStorage
  ServerScriptService # server-only scripts live here
    Script (Script) # your first script
  ServerStorage
  StarterGui
  StarterPack
  StarterPlayer
  SoundService
:::

:::studio Play, Run, or Start Server?
- **Play** (++F5++) simulates a real session: a server *and* your client, with your character spawned.
- **Run** (++F8++) only runs the server — no character. Handy for testing world logic.
- **Test → Start** with multiple players launches a local server plus several client windows, which is how you'll test multiplayer code later.
:::

## The three kinds of scripts

Roblox has three script objects. You'll study each one properly later, but it helps to know the cast from day one.

| Script type | Runs on | Typical use |
| --- | --- | --- |
| **Script** | The server (by default) | Game rules, data saving, spawning, anything authoritative |
| **LocalScript** | One player's device (the client) | Input, camera, UI, visual effects |
| **ModuleScript** | Wherever it's `require`d | Reusable code shared between other scripts |

The server is the single source of truth that every player connects to. Each player's device is a *client*. That split — and why it matters for security — is the subject of @client-server.

## Your first program

Replace the contents of your Script with this:

```roblox title="ServerScriptService › Script"
print("Hello, world!")
```

Press Play and look at the Output window:

```output
Hello, world!
```

Let's name the pieces, because you'll see this pattern thousands of times:

- `print` is a **function** — a named piece of code that does a job. This one displays text in the Output.
- The parentheses `( )` **call** the function, which means "run it now".
- `"Hello, world!"` is the **argument** we hand to the function. It's a **string** — text — so it's wrapped in quotes.

You can pass `print` several arguments separated by commas. It prints them all on one line with spaces between them:

```luau
print("Coins:", 100)
print("Level", 5, "unlocked!")
```

```output
Coins: 100
Level 5 unlocked!
```

### print, warn and error

Luau gives you three ways to send messages to the Output, and they look different on purpose:

```roblox
print("Normal message")        -- white/grey text
warn("Something looks off")    -- orange text, easy to spot
error("Something broke!")      -- red text, and it STOPS this script
print("This line never runs")
```

`warn` is great for "this is suspicious but not fatal" situations. `error` is different: it raises an error that stops the current script immediately. Nothing after it runs. You'll learn to *catch* errors in @errors.

## Comments

A **comment** is text that Luau completely ignores. Comments are for humans — including future you.

```luau
-- A single-line comment starts with two dashes.
print("hi") -- Comments can also go at the end of a line.

--[[
	A block comment can span
	as many lines as you like.
]]

--[=[
	If your comment itself contains ]] you can add equals signs
	between the brackets to make the delimiters unique.
]=]
```

Good comments explain **why** something is done, not **what** the code literally says. `-- add 1 to x` above `x += 1` is noise. `-- the first wave is free, so start counting at 1` is useful.

Comments are also handy for temporarily disabling code while you test things — just put `--` in front of a line.

:::note Directive comments
You'll sometimes see comments like `--!strict` or `--!native` on the very first line of a script. These are *directives*: special comments that change how Luau checks or compiles the file. We cover them in @types and @performance.
:::

## How Luau reads your code

A script is a list of **statements** that run from top to bottom, one at a time. A few ground rules:

- **Luau is case-sensitive.** `print`, `Print` and `PRINT` are three different names. Only the first one exists.
- **Whitespace mostly doesn't matter.** Spaces, tabs and blank lines are for readability. Indentation makes structure visible to *you*; Luau doesn't need it.
- **Semicolons are optional.** You can end a statement with `;`, but almost nobody does in Luau.
- **Statements don't need to be on separate lines**, though they should be for readability.

```luau
print("one") print("two")   -- legal, but harder to read
print("three");             -- legal, but unusual style
```

## Reading error messages

Errors are not failures — they're the language telling you exactly what went wrong and where. Learning to read them calmly is a superpower. Here's a typical one:

```output
ServerScriptService.Script:3: attempt to perform arithmetic (add) on nil and number
```

It has three parts:

1. **Where** — `ServerScriptService.Script` is the full path to the script.
2. **Which line** — `:3:` means line 3. Click the message in the Output to jump straight there.
3. **What** — the description of the problem. Here, something on line 3 tried to add a number to a value that was `nil` (nothing).

There are two broad kinds of errors:

- **Syntax errors** happen before the script even starts: the code isn't valid Luau (a missing `end`, a stray quote). Studio underlines them in red and lists them in the **Script Analysis** window.
- **Runtime errors** happen while the code runs: the code is valid, but something impossible was attempted, like calling a function that doesn't exist.

| Message | What it usually means |
| --- | --- |
| `attempt to call a nil value` | You called something that doesn't exist — often a typo or wrong capitalization. |
| `attempt to index nil with 'Name'` | You wrote `thing.Name` but `thing` is `nil`. |
| `Expected 'end' (to close 'function' at line 1), got <eof>` | You forgot an `end`. |
| `attempt to perform arithmetic (add) on nil and number` | A value you're doing math with is `nil`. |
| `Infinite yield possible on 'Workspace:WaitForChild("Door")'` | A warning: you're waiting for an object that hasn't appeared (yet). |

## How to learn effectively

A few habits that make a huge difference:

1. **Predict, then run.** Before running code, say out loud what you think it will do. When you're wrong, you've found a gap in your understanding — that's the valuable moment.
2. **Break things on purpose.** Delete an `end`, misspell a name, pass the wrong value. Seeing the error in a safe context makes it familiar when it happens for real.
3. **Small steps.** Write two or three lines, run them, then add more. Debugging ten new lines is much harder than debugging two.
4. **Use the official docs.** The [Roblox Engine API reference](https://create.roblox.com/docs/reference/engine) lists every class, property, method and event. You don't memorize APIs — you learn to look them up quickly.

:::quiz Module 1 check-in
? Which language did Luau begin as a fork of?
- JavaScript
+ Lua 5.1
- Python
- C#
> Luau started as a fork of Lua 5.1 and has since been heavily extended with types, new syntax, a faster VM and a bigger standard library.

? Where should a server Script usually go so that it runs when the game starts?
+ ServerScriptService
- StarterGui
- Lighting
- SoundService
> ServerScriptService is the standard home for server code. Scripts there run on the server and their source is never sent to players.

? What happens to the lines after `error("oops")` in the same script?
- They run normally
+ They don't run — the error stops the script
- They run only in Studio
- They run, but in red
> `error` raises a runtime error that halts the current script (more precisely, the current *thread*). You can catch errors with `pcall`, which you'll learn later.

? Which of these is a valid Luau comment?
+ `-- this is a comment`
- `// this is a comment`
- `# this is a comment`
- `/* this is a comment */`
> Luau comments start with two dashes. Block comments use `--[[ ... ]]`.

? You see `Workspace.Door.Script:12: attempt to call a nil value`. Where do you look first?
+ Line 12 of the Script inside Workspace.Door
- Line 1 of every script in the game
- The Properties window of the Baseplate
- ServerScriptService
> The error tells you the script's full path and the exact line number. Clicking the message in the Output jumps there.

? Is `Print("hi")` the same as `print("hi")`?
- Yes — Luau ignores capitalization
+ No — Luau is case-sensitive, so `Print` is a different name that doesn't exist
- Yes, but only on the server
- No — `Print` prints in bold
> Names in Luau are case-sensitive. `Print` is `nil`, so calling it gives "attempt to call a nil value".
:::

:::predict Comments and multiple arguments
```luau
print("A")
print("B", "C")
-- print("D")
print("E") -- print("F")
```
= A
= B C
= E
> Line 3 is entirely a comment, so it never runs. On line 4, everything after `--` is a comment, so only `print("E")` runs. `print("B", "C")` prints both arguments separated by a space.
:::

:::predict Block comments
```luau
print("start")
--[[
print("middle")
]]
print("end")
```
= start
= end
> Everything between `--[[` and `]]` is a comment, including the `print("middle")` line.
:::

## Challenges

:::challenge easy | Introduce yourself
Write a script that prints three separate lines:

1. Your name (or username)
2. Your favourite Roblox game
3. One thing you want to build after this course

Add a comment at the very top explaining what the script does. Run it in the playground or in Studio.
@hint
You need three separate `print` calls, each with a string in quotes.
@solution
```luau
-- Prints a short introduction about me.
print("Name: Koala")
print("Favourite game: Natural Disaster Survival")
print("I want to build: a co-op dungeon crawler")
```
Any text works, of course — the important parts are three `print` calls, strings in quotes, and a `--` comment.
:::

:::challenge easy | Fix the broken script
This script has **two** bugs and won't run. Find and fix them without looking at the hints first.

```luau
Print("Welcome!")
print("Loading...)
print("Done")
```
@hint
One bug is about capitalization. Luau is case-sensitive.
@hint
The other bug is a string that is never closed. Every opening `"` needs a closing `"`.
@solution
```luau
print("Welcome!")
print("Loading...")
print("Done")
```
`Print` must be lowercase, and `"Loading...` was missing its closing quote. Notice that the *syntax* error (the unclosed string) is reported before the script runs at all, while the `Print` problem only appears at runtime.
:::

:::challenge easy | The three message types
In Roblox Studio, create a Script in ServerScriptService that:

1. Prints `Game starting`.
2. Warns `Low on players`.
3. Raises an error with the message `Something went wrong`.
4. Has a fourth line that prints `You will never see this`.

Run it and look at the colors in the Output. Then click the red error message and notice where it takes you.
@hint
Use `print`, `warn` and `error` — one per line.
@solution
```roblox title="ServerScriptService › Script"
print("Game starting")
warn("Low on players")
error("Something went wrong")
print("You will never see this")
```
The Output shows a normal line, an orange warning, then a red error with the script path and line number. The last `print` never runs because `error` stopped the script.
:::

:::recap
- **Luau** is Roblox's fast, gradually-typed language, derived from Lua 5.1 and open source.
- Pure Luau runs in the **Luau Playground**; Roblox-specific code needs **Roblox Studio**.
- **Scripts** run on the server, **LocalScripts** on a player's device, **ModuleScripts** wherever they're required.
- `print` shows a message, `warn` shows a highlighted warning, `error` stops the script.
- Comments start with `--` (single line) or `--[[ ]]` (block).
- Error messages tell you the **script**, the **line** and **what** went wrong — read them carefully.
:::
