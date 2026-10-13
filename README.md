# Luau Academy

A free Luau course brought to you by Koala, Roblox developer of 5+ years.

A static site that teaches Luau and Roblox scripting from zero to production: lessons, runnable examples (via the official Luau Playground), quizzes, predict-the-output exercises, coding challenges, XP/ranks, search and a printable certificate. No accounts — progress is stored in the browser.

## Deploying to Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub** and pick this repo.
2. Netlify reads `netlify.toml` automatically:
   - Build command: `node build.js`
   - Publish directory: `dist`
3. Deploy. There are no npm dependencies to install.

## Local development

```bash
node build.js    # builds ./dist
node serve.js    # previews at http://localhost:4173
```

## Writing content

Lessons live in `src/content/modules/*.md` (ordered by filename). Each file starts with front matter:

```text
---
id: tables
title: Tables
part: 1
summary: One-line summary shown on cards.
time: 50 min
level: Beginner
objectives:
- First objective
- Second objective
---
```

Beyond normal Markdown (headings, lists, tables, links, `code`, **bold**, *italic*), the builder supports:

| Syntax | Result |
| --- | --- |
| ```` ```luau ```` | Highlighted code with a **Run** button (pure Luau) |
| ```` ```roblox title="ServerScriptService › Script" ```` | Highlighted Roblox code (no Run button) |
| ```` ```output ```` | Console output block |
| `:::tip`, `:::note`, `:::info`, `:::pro`, `:::warning`, `:::danger`, `:::security`, `:::studio` | Callouts (optional title after the type) |
| `:::quiz Title` | Quiz. `? question`, `+ correct`, `- wrong`, `> explanation` |
| `:::predict` | Predict-the-output. A code block, then `= expected line` lines and `> explanation` |
| `:::challenge easy \| Title` | Challenge (easy/medium/hard/boss). `@hint` and `@solution` sections |
| `:::tree Caption` | Explorer-style tree; indent 2 spaces; `Name (ClassName) # note` |
| `:::compare`, `:::steps`, `:::cards`, `:::recap`, `:::deepdive Title` | Layout helpers |
| `@module-id` | Link to another module, titled automatically |
| `++Ctrl++` | Keyboard key |

Other pages (like the cheat sheet) live in `src/content/pages/*.md`.
