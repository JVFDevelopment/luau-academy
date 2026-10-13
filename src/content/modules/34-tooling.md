---
id: tooling
title: Professional Tooling
part: 6
summary: Work like a studio — version control with Git, editing in VS Code with Rojo, luau-lsp, StyLua and Selene, packages with Wally, toolchain managers, testing, Lune scripts, and team workflows.
time: 35 min
level: Advanced
objectives:
- Understand why professional teams develop outside Studio
- Sync files with Studio using Rojo
- Lint, format and type-check with Selene, StyLua and luau-lsp
- Manage packages with Wally and tools with Rokit
- Write automated tests and scripts
- Use Git and team features effectively
---

Roblox Studio is all you need to build a great game. But as projects and teams grow, many developers move their **code** into regular files and a code editor, gaining version control, powerful editing, automated checks and package management. This module is a map of that ecosystem.

## Why code outside Studio?

- **Version control (Git):** full history, branches, reverting mistakes, reviewing changes, collaborating without overwriting each other.
- **Better editing:** VS Code (or another editor) with multi-cursor editing, refactoring, fast search and extensions.
- **Automation:** formatting, linting and type-checking on every save and on every commit.
- **Packages:** reuse well-tested community libraries with versioning.

Studio is still where you build worlds, UI and test gameplay — the tools below just sync code in and out.

## The core toolkit

| Tool | Purpose |
| --- | --- |
| **Rojo** | Syncs files on disk ↔ Instances in Studio; builds place files |
| **luau-lsp** | Language server for VS Code: autocomplete, type-checking, go-to-definition for Luau and the Roblox API |
| **StyLua** | Opinionated auto-formatter — no more style debates |
| **Selene** | Linter that catches bugs and bad practices (unused variables, shadowing, deprecated APIs) |
| **Wally** | Package manager for Roblox libraries |
| **Rokit** (or Aftman/Foreman) | Installs and pins versions of these command-line tools per project |
| **Lune** | Runs Luau scripts outside Roblox — automation, build scripts, tests |
| **Git + GitHub** | Version control and collaboration |

## Rojo in a nutshell

A Rojo project maps folders to places in the DataModel with a `default.project.json`:

```json
{
  "name": "my-game",
  "tree": {
    "$className": "DataModel",
    "ReplicatedStorage": {
      "Shared": { "$path": "src/shared" }
    },
    "ServerScriptService": {
      "Server": { "$path": "src/server" }
    },
    "StarterPlayer": {
      "StarterPlayerScripts": {
        "Client": { "$path": "src/client" }
      }
    }
  }
}
```

File names decide script types: `Thing.server.luau` → Script, `Thing.client.luau` → LocalScript, `Thing.luau` → ModuleScript, and a folder with an `init.luau` becomes a ModuleScript containing its children. Run `rojo serve`, connect from the Rojo Studio plugin, and edits in VS Code appear in Studio instantly.

Many teams keep **code** in Git via Rojo while the **map and assets** stay in the Roblox place file (a "partially managed" setup) — a great starting point.

## Quality checks

```bash
stylua src
```

```bash
selene src
```

Configure luau-lsp to use your Rojo project (it reads a sourcemap) so it understands your Instance hierarchy and `require` paths. Turn on `--!strict` everywhere. Run all of these automatically in CI (e.g. GitHub Actions) so problems are caught before code merges.

## Packages with Wally

```toml
[package]
name = "koala/my-game"
version = "0.1.0"
realm = "shared"
registry = "https://github.com/UpliftGames/wally-index"

[dependencies]
Trove = "sleitnick/trove@1.1.0"
Signal = "sleitnick/signal@2.0.1"
```

`wally install` downloads them into a `Packages` folder you map into `ReplicatedStorage` with Rojo. Always pin versions and review what you install — packages are code that runs in your game.

Libraries you'll often see: **Trove/Janitor** (cleanup), **Signal/GoodSignal** (events), **Promise** (async), **ProfileStore** (data), **Fusion** or **React (react-lua)** (declarative UI), **Iris** (debug UI), and networking libraries that add typed, compact remotes.

## Testing

Automated tests catch regressions — especially for pure logic like damage formulas, inventory rules and data migrations.

- Write logic as **pure functions in ModuleScripts** so it's testable without the engine.
- Use a test framework such as **Jest Lua** (Roblox's port of Jest) or TestEZ, run in Studio or from the command line with tools like `run-in-roblox` or Open Cloud Luau execution.
- Use **Lune** to run pure-Luau tests and scripts locally in milliseconds.

```luau
-- A tiny hand-rolled test you can run anywhere
local function expectEqual(actual, expected, name)
	if actual ~= expected then
		error(`{name}: expected {expected}, got {actual}`)
	end
	print("✓ " .. name)
end

local function applyDamage(hp, dmg, armor)
	return math.max(0, hp - math.floor(dmg * (1 - armor)))
end

expectEqual(applyDamage(100, 20, 0), 80, "plain damage")
expectEqual(applyDamage(100, 20, 0.5), 90, "armor halves damage")
expectEqual(applyDamage(10, 50, 0), 0, "health never negative")
```

## Team workflows

- **Team Create** lets several people edit a place at once; **Collaborative Editing** handles scripts with drafts you commit.
- **Packages** (Roblox's own, not Wally) let you reuse models across places and update every copy at once.
- Use **Git branches** and **pull requests** for code review, even when working alone — reviewing your own diff catches bugs.
- Keep separate **places** (or experiences) for development/testing and production, and separate data store names for each.
- **Open Cloud** APIs let external tools publish places, manage data stores and send messages to live servers — useful for automation and admin dashboards.

:::info You don't need all of this on day one
Start with what solves a problem you actually have: Git for history, then Rojo when you want VS Code, then linting and formatting, then packages and tests. Studio alone is a perfectly valid way to ship great games.
:::

:::quiz Tooling
? What does Rojo do?
+ Syncs code files on disk with Instances in Studio
- Hosts your game's servers
- Formats code
- Stores player data
> Rojo bridges file-based workflows and Studio.

? Which tool automatically formats Luau code?
- Selene
+ StyLua
- Wally
- Lune
> StyLua is the formatter; Selene is the linter.

? In Rojo, what does `Thing.server.luau` become?
+ A Script
- A LocalScript
- A ModuleScript
- A Folder
> `.server.luau` → Script, `.client.luau` → LocalScript, plain `.luau` → ModuleScript.

? What kind of code is easiest to unit test?
+ Pure functions in ModuleScripts
- Code inside Touched handlers
- LocalScripts in StarterGui
- Code that reads `workspace` everywhere
> Pure logic can be tested without the engine.

? Why keep separate data store names for testing?
+ So testing can never damage real players' data
- Testing is faster that way
- Roblox requires it
- To save Robux
> Isolate test data from production data.
:::

## Challenges

:::challenge easy | Version your project
Create a Git repository for one of your projects (Studio's place file, or a Rojo project). Make three commits with meaningful messages, then use `git log --oneline` to view the history. Try reverting a deliberate mistake with `git revert`.
@solution
```bash
git init
```
```bash
git add -A
```
```bash
git commit -m "Add round system"
```
```bash
git log --oneline
```
Meaningful messages describe *why* a change was made ("Fix double reward on fast respawn"), not just *what* ("update script").
:::

:::challenge medium | Test your logic
Take three pure functions you wrote earlier in the course (for example `withCommas`, `parseCommand` and a damage formula). Write a small test file using an `expectEqual` helper with at least four cases each, including edge cases (zero, negative numbers, empty strings, extra spaces). Run it in the playground until everything passes.
@solution
```luau
local function expectEqual(actual, expected, name)
	assert(actual == expected, `{name}: expected {tostring(expected)}, got {tostring(actual)}`)
	print("✓ " .. name)
end

local function withCommas(n)
	local digits = tostring(math.floor(math.abs(n)))
	local out = digits:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	out = out:gsub("^,", "")
	return (if n < 0 then "-" else "") .. out
end

expectEqual(withCommas(0), "0", "zero")
expectEqual(withCommas(999), "999", "below a thousand")
expectEqual(withCommas(1000), "1,000", "exactly a thousand")
expectEqual(withCommas(-1234567), "-1,234,567", "negative millions")
```
Add the other functions the same way. Every bug you find later becomes a new test case so it can never come back.
:::

:::recap
- Professional teams often keep code in files with **Git**, editing in VS Code and syncing with **Rojo**.
- **luau-lsp** (types/autocomplete), **StyLua** (format), **Selene** (lint), **Wally** (packages), **Rokit** (tool versions), **Lune** (scripts/tests).
- Make logic pure and testable; run checks automatically.
- Use Team Create, branches, reviews, and separate test/production data.
- Adopt tools gradually as real needs appear.
:::
