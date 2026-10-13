#!/usr/bin/env node
/*
 * Luau Academy — static site builder
 * ----------------------------------
 * Zero dependencies. Turns the Markdown lessons in src/content into a fully
 * static site in ./dist that can be deployed to Netlify (or any static host).
 *
 *   node build.js
 *
 * Content syntax (beyond normal Markdown) is documented in README.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');

/* ------------------------------------------------------------------ */
/* Site configuration                                                  */
/* ------------------------------------------------------------------ */

const SITE = {
  name: 'Luau Academy',
  description:
    'A free, in-depth Luau course. Learn the language from zero, master every major Roblox engine system, and prove your skills with quizzes and coding challenges.',
  credit: 'A free Luau course brought to you by Koala, Roblox developer of 5+ years',
  author: 'Koala',
  url: (process.env.URL || '').replace(/\/$/, ''), // Netlify sets URL during builds
};

const PARTS = [
  { n: 1, roman: 'I', title: 'Luau Fundamentals', blurb: 'The core language — values, logic, functions and tables. Everything else is built on this.' },
  { n: 2, roman: 'II', title: 'Advanced Luau', blurb: 'Metatables, OOP, the type system, error handling, coroutines and the standard library.' },
  { n: 3, roman: 'III', title: 'Roblox Engine Essentials', blurb: 'Instances, events, the client-server model, remotes, ModuleScripts and characters.' },
  { n: 4, roman: 'IV', title: 'World & Gameplay Systems', blurb: '3D math, physics, raycasting, animation, UI, input, cameras and NPC AI.' },
  { n: 5, roman: 'V', title: 'Data, Economy & Services', blurb: 'Saving player data, monetization and the services that power live games.' },
  { n: 6, roman: 'VI', title: 'Professional Development', blurb: 'Security, performance, architecture, tooling — and a capstone game to tie it all together.' },
];

const XP = {
  quiz: 10,
  predict: 15,
  module: 50,
  challenge: { easy: 25, medium: 50, hard: 100, boss: 250 },
};

// Rank thresholds as fractions of the maximum XP available in the course.
const RANKS = [
  { name: 'Newcomer', at: 0 },
  { name: 'Apprentice Scripter', at: 0.03 },
  { name: 'Scripter', at: 0.12 },
  { name: 'Developer', at: 0.26 },
  { name: 'Systems Builder', at: 0.45 },
  { name: 'Senior Developer', at: 0.66 },
  { name: 'Luau Master', at: 0.9 },
];

const LANGS = {
  luau: { label: 'Luau', hl: true, run: true },
  lua: { label: 'Luau', hl: true, run: true },
  roblox: { label: 'Roblox Studio', hl: true, run: false },
  output: { label: 'Output', hl: false, output: true },
  text: { label: 'Text', hl: false },
  bash: { label: 'Terminal', hl: false },
  json: { label: 'JSON', hl: false },
  toml: { label: 'TOML', hl: false },
};

/* ------------------------------------------------------------------ */
/* Icons (stroke icons, 24x24)                                         */
/* ------------------------------------------------------------------ */

const ICON_PATHS = {
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  tip: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  danger: '<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z"/><path d="m15 9-6 6M9 9l6 6"/>',
  note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  studio: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pro: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  quiz: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  bar: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  map: '<path d="m1 6 7-4 8 4 7-4v16l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};

function icon(name, cls = '') {
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7cff"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#d16bff"/></linearGradient><mask id="lm"><rect width="32" height="32" fill="#fff"/><circle cx="19.5" cy="12.5" r="7" fill="#000"/></mask></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg)"/><circle cx="15" cy="17" r="8.5" fill="#fff" mask="url(#lm)"/><circle cx="23.5" cy="8.5" r="2.3" fill="#fff"/></svg>`;

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[`'"’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

const pad2 = (n) => String(n).padStart(2, '0');

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

// Small deterministic PRNG so quiz option shuffles are stable between builds.
function seededRandom(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function parseAttrs(str) {
  const attrs = {};
  const re = /(\w+)=(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(str || ''))) attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return attrs;
}

function parseRanges(str) {
  const set = new Set();
  if (!str) return set;
  for (const part of String(str).split(',')) {
    const [a, b] = part.split('-').map(Number);
    if (!b) set.add(a);
    else for (let i = a; i <= b; i++) set.add(i);
  }
  return set;
}

/* ------------------------------------------------------------------ */
/* Luau syntax highlighter                                             */
/* ------------------------------------------------------------------ */

const LUAU = {
  kw: new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'for', 'function', 'if', 'in', 'local', 'not', 'or', 'repeat', 'return', 'then', 'until', 'while', 'continue']),
  consts: new Set(['true', 'false', 'nil']),
  builtins: new Set(['print', 'warn', 'error', 'assert', 'pcall', 'xpcall', 'require', 'typeof', 'tostring', 'tonumber', 'ipairs', 'pairs', 'next', 'select', 'setmetatable', 'getmetatable', 'rawget', 'rawset', 'rawequal', 'rawlen', 'unpack', 'newproxy', 'gcinfo', 'tick', 'time', 'wait', 'spawn', 'delay', 'elapsedTime', 'loadstring', 'getfenv', 'setfenv']),
  libs: new Set(['math', 'string', 'table', 'task', 'coroutine', 'os', 'debug', 'utf8', 'bit32', 'buffer', 'vector']),
  globals: new Set(['game', 'workspace', 'script', 'shared', '_G', 'Enum', 'Instance', 'Vector3', 'Vector2', 'CFrame', 'Color3', 'BrickColor', 'UDim', 'UDim2', 'TweenInfo', 'Ray', 'RaycastParams', 'OverlapParams', 'NumberSequence', 'NumberSequenceKeypoint', 'ColorSequence', 'ColorSequenceKeypoint', 'NumberRange', 'Random', 'DateTime', 'Rect', 'Region3', 'PhysicalProperties', 'Font', 'Axes', 'Faces', 'PathWaypoint', 'SharedTable', 'Vector3int16', 'Vector2int16', 'CatalogSearchParams', 'Content']),
  types: new Set(['number', 'string', 'boolean', 'any', 'unknown', 'never', 'thread', 'userdata', 'buffer', 'vector']),
};

function tokenizeLuau(code) {
  const toks = [];
  const push = (cls, text) => {
    if (!text) return;
    const last = toks[toks.length - 1];
    if (last && last.cls === cls && cls !== 'punc') last.text += text;
    else toks.push({ cls, text });
  };
  const n = code.length;
  let i = 0;
  let expectFnName = false;
  let depth = 0;
  let typeDecl = false;
  let typeDeclDepth = 0;

  const peekNonSpace = (j) => {
    while (j < n && (code[j] === ' ' || code[j] === '\t')) j++;
    return code[j] || '';
  };
  const prevTok = () => {
    for (let k = toks.length - 1; k >= 0; k--) if (toks[k].cls !== 'ws') return toks[k];
    return null;
  };

  while (i < n) {
    const c = code[i];

    // whitespace
    if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(code[j])) j++;
      const ws = code.slice(i, j);
      if (typeDecl && ws.includes('\n') && depth <= typeDeclDepth) typeDecl = false;
      push('ws', ws);
      i = j;
      continue;
    }

    // comments
    if (c === '-' && code[i + 1] === '-') {
      const lm = code.slice(i + 2).match(/^\[(=*)\[/);
      let j;
      if (lm) {
        const close = ']' + lm[1] + ']';
        const end = code.indexOf(close, i + 2 + lm[0].length);
        j = end === -1 ? n : end + close.length;
      } else {
        j = code.indexOf('\n', i);
        if (j === -1) j = n;
      }
      push('com', code.slice(i, j));
      i = j;
      continue;
    }

    // long strings
    if (c === '[') {
      const lm = code.slice(i).match(/^\[(=*)\[/);
      if (lm) {
        const close = ']' + lm[1] + ']';
        const end = code.indexOf(close, i + lm[0].length);
        const j = end === -1 ? n : end + close.length;
        push('str', code.slice(i, j));
        i = j;
        continue;
      }
    }

    // quoted strings
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && code[j] !== c && code[j] !== '\n') {
        if (code[j] === '\\') j++;
        j++;
      }
      j = Math.min(n, j + 1);
      push('str', code.slice(i, j));
      i = j;
      continue;
    }

    // interpolated strings
    if (c === '`') {
      let j = i + 1;
      let start = i;
      while (j < n && code[j] !== '`') {
        if (code[j] === '\\') {
          j += 2;
          continue;
        }
        if (code[j] === '{') {
          push('str', code.slice(start, j));
          push('interp', '{');
          let d = 1;
          let k = j + 1;
          while (k < n) {
            if (code[k] === '{') d++;
            else if (code[k] === '}') {
              d--;
              if (d === 0) break;
            }
            k++;
          }
          for (const t of tokenizeLuau(code.slice(j + 1, k))) push(t.cls, t.text);
          push('interp', '}');
          j = k + 1;
          start = j;
          continue;
        }
        j++;
      }
      j = Math.min(n, j + 1);
      push('str', code.slice(start, j));
      i = j;
      continue;
    }

    // numbers
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(code[i + 1] || '') && code[i - 1] !== '.')) {
      const m = code
        .slice(i)
        .match(/^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|(?:[0-9][0-9_]*(?:\.(?!\.)[0-9_]*)?|\.[0-9][0-9_]*)(?:[eE][+-]?[0-9]+)?)/);
      push('num', m[0]);
      i += m[0].length;
      continue;
    }

    // identifiers & keywords
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
      const w = code.slice(i, j);
      const next = peekNonSpace(j);
      const prevChar = code[i - 1] || '';
      const prev = prevTok();
      const prevText = prev ? prev.text : '';
      let cls = 'id';

      const lineStart = code.lastIndexOf('\n', i - 1) + 1;
      const before = code.slice(lineStart, i).trim();

      if (expectFnName) {
        cls = 'fn';
        if (next !== '.' && next !== ':') expectFnName = false;
      } else if (prevChar === '.' && code[i - 2] !== '.') {
        cls = next === '(' ? 'call' : 'prop';
      } else if (prevChar === ':' && code[i - 2] !== ':' && !typeDecl) {
        cls = 'method';
      } else if (w === 'type' && /[A-Za-z_]/.test(next) && (before === '' || before === 'export')) {
        cls = 'kw';
        typeDecl = true;
        typeDeclDepth = depth;
      } else if (w === 'export' && code.slice(j).match(/^\s+type\s/)) {
        cls = 'kw';
      } else if (LUAU.kw.has(w)) {
        cls = 'kw';
        if (w === 'function') expectFnName = /[A-Za-z_]/.test(next);
      } else if (LUAU.consts.has(w)) {
        cls = 'const';
      } else if (w === 'self') {
        cls = 'self';
      } else if (next === '.' && LUAU.libs.has(w)) {
        cls = 'lib';
      } else if (w === 'typeof' || (w === 'type' && next === '(')) {
        cls = 'builtin';
      } else if (LUAU.builtins.has(w)) {
        cls = 'builtin';
      } else if (LUAU.globals.has(w)) {
        cls = 'global';
      } else if (typeDecl) {
        cls = next === ':' && code[j] !== ':' ? 'prop' : 'type';
      } else if (
        prevText.endsWith('::') ||
        prevText.endsWith('->') ||
        (prevText.endsWith(':') && /\s/.test(prevChar))
      ) {
        cls = 'type';
      } else if (LUAU.types.has(w) && next !== '(' && next !== '.' && next !== '=') {
        cls = 'type';
      } else if (next === '(') {
        cls = 'call';
      }
      push(cls, w);
      i = j;
      continue;
    }

    // operators
    const om = code
      .slice(i)
      .match(/^(\.\.\.|\.\.=|\/\/=|\.\.|==|~=|<=|>=|->|::|\+=|-=|\*=|\/=|%=|\^=|\/\/|[+\-*/%^#<>=&|?~])/);
    if (om) {
      push('op', om[0]);
      i += om[0].length;
      continue;
    }

    if (c === '(' || c === '{' || c === '[') depth++;
    if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1);
    push('punc', c);
    i++;
  }
  return toks;
}

function highlightLines(code, hl) {
  const tokens = hl ? tokenizeLuau(code) : [{ cls: 'plain', text: code }];
  const lines = [''];
  for (const t of tokens) {
    const parts = t.text.split('\n');
    parts.forEach((p, idx) => {
      if (idx > 0) lines.push('');
      if (!p) return;
      const plain = t.cls === 'ws' || t.cls === 'id' || t.cls === 'plain';
      lines[lines.length - 1] += plain ? esc(p) : `<span class="tk-${t.cls}">${esc(p)}</span>`;
    });
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Markdown renderer                                                   */
/* ------------------------------------------------------------------ */

const CALLOUTS = {
  note: { label: 'Note', icon: 'note' },
  info: { label: 'Good to know', icon: 'info' },
  tip: { label: 'Tip', icon: 'tip' },
  pro: { label: 'Pro tip', icon: 'pro' },
  warning: { label: 'Watch out', icon: 'warning' },
  danger: { label: 'Danger zone', icon: 'danger' },
  security: { label: 'Security', icon: 'shield' },
  studio: { label: 'In Roblox Studio', icon: 'studio' },
};

class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.headings = ctx.headings || [];
    ctx.used = ctx.used || new Set();
    ctx.counters = ctx.counters || { q: 0, c: 0, p: 0, quiz: 0 };
    ctx.quizIds = ctx.quizIds || [];
    ctx.predictIds = ctx.predictIds || [];
    ctx.challenges = ctx.challenges || [];
  }

  uniqueId(base) {
    let id = base;
    let k = 2;
    while (this.ctx.used.has(id)) id = `${base}-${k++}`;
    this.ctx.used.add(id);
    return id;
  }

  link(href) {
    const m = href.match(/^@([\w-]+)(#.*)?$/);
    if (m) {
      if (this.ctx.moduleIds && !this.ctx.moduleIds.has(m[1])) {
        console.warn(`  ! Unknown module link @${m[1]} in ${this.ctx.id}`);
      }
      return `${this.ctx.root}learn/${m[1]}/${m[2] || ''}`;
    }
    const p = href.match(/^~\/(.*)$/);
    if (p) return this.ctx.root + p[1];
    return href;
  }

  inline(text) {
    const codes = [];
    let s = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '`') {
        let n = 0;
        while (text[i + n] === '`') n++;
        const fence = '`'.repeat(n);
        let j = i + n;
        let found = -1;
        while ((j = text.indexOf(fence, j)) !== -1) {
          if (text[j + n] !== '`' && text[j - 1] !== '`') {
            found = j;
            break;
          }
          j++;
        }
        if (found !== -1) {
          let code = text.slice(i + n, found);
          if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
          codes.push(`<code>${esc(code)}</code>`);
          s += `\u0001${codes.length - 1}\u0001`;
          i = found + n;
          continue;
        }
        s += fence;
        i += n;
        continue;
      }
      s += text[i];
      i++;
    }

    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const url = this.link(href.replace(/&amp;/g, '&'));
      const ext = /^https?:/.test(url);
      return `<a href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}${ext ? icon('external', 'icon-ext') : ''}</a>`;
    });
    // Bare module references: "@tables" or "@tables#iteration" → link titled with the module name
    s = s.replace(/(^|[\s(])@([a-z][a-z0-9-]*[a-z0-9])(#[\w-]+)?/g, (all, pre, id, hash) => {
      const titles = this.ctx.moduleTitles;
      if (!titles) return all;
      if (!titles.has(id)) {
        console.warn(`  ! Unknown module reference @${id} in ${this.ctx.id}`);
        return all;
      }
      return `${pre}<a class="xref" href="${this.ctx.root}learn/${id}/${hash || ''}">${esc(titles.get(id))}</a>`;
    });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\+\+([^+\s][^+]*?)\+\+/g, '<kbd>$1</kbd>');
    s = s.replace(/\u0001(\d+)\u0001/g, (_, k) => codes[+k]);
    return s;
  }

  blocks(lines) {
    if (typeof lines === 'string') lines = lines.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) {
        out.push(`<p>${this.inline(para.join(' '))}</p>`);
        para = [];
      }
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let m;

      // fenced code
      if ((m = line.match(/^(\s*)```\s*([\w-]*)\s*(.*)$/))) {
        flush();
        const indent = m[1].length;
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          const lead = lines[i].match(/^\s*/)[0].length;
          body.push(lines[i].slice(Math.min(indent, lead)));
          i++;
        }
        i++;
        out.push(this.code(body.join('\n'), m[2] || 'text', parseAttrs(m[3])));
        continue;
      }

      // containers
      if ((m = line.match(/^:::(\w+)\s*(.*)$/))) {
        flush();
        const body = [];
        let d = 1;
        let fence = false;
        i++;
        while (i < lines.length) {
          const l = lines[i];
          if (/^\s*```/.test(l)) fence = !fence;
          if (!fence) {
            if (/^:::\w/.test(l)) d++;
            else if (/^:::\s*$/.test(l)) {
              d--;
              if (d === 0) break;
            }
          }
          body.push(l);
          i++;
        }
        i++;
        out.push(this.container(m[1], m[2].trim(), body));
        continue;
      }

      if (/^\s*$/.test(line)) {
        flush();
        i++;
        continue;
      }

      // headings
      if ((m = line.match(/^(#{2,4})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/))) {
        flush();
        const level = m[1].length;
        const html = this.inline(m[2]);
        const plain = stripTags(html.replace(/<[^>]+>/g, ''));
        const id = this.uniqueId(m[3] || slugify(plain));
        if (level <= 3 && !this.ctx.nested) this.ctx.headings.push({ level, id, text: plain });
        out.push(
          `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${html}</h${level}>`
        );
        i++;
        continue;
      }

      if (/^(---|\*\*\*)\s*$/.test(line)) {
        flush();
        out.push('<hr>');
        i++;
        continue;
      }

      // tables
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        const rows = [];
        const head = this.splitRow(line);
        const aligns = this.splitRow(lines[i + 1]).map((c) =>
          c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''
        );
        i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows.push(this.splitRow(lines[i]));
          i++;
        }
        const al = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
        out.push(
          `<div class="table-wrap"><table><thead><tr>${head
            .map((h, k) => `<th${al(k)}>${this.inline(h)}</th>`)
            .join('')}</tr></thead><tbody>${rows
            .map((r) => `<tr>${r.map((c, k) => `<td${al(k)}>${this.inline(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table></div>`
        );
        continue;
      }

      // lists
      if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
        flush();
        const { html, next } = this.list(lines, i);
        out.push(html);
        i = next;
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        flush();
        const body = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          body.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push(`<blockquote>${this.nested(body)}</blockquote>`);
        continue;
      }

      // raw html block
      if (/^<(div|figure|svg|table|details|section|aside|img|iframe|p|ul|ol)\b/.test(line)) {
        flush();
        const body = [];
        while (i < lines.length && !/^\s*$/.test(lines[i])) {
          body.push(lines[i]);
          i++;
        }
        out.push(body.join('\n'));
        continue;
      }

      para.push(line.trim());
      i++;
    }
    flush();
    return out.join('\n');
  }

  nested(lines) {
    const wasNested = this.ctx.nested;
    this.ctx.nested = true;
    const html = this.blocks(lines);
    this.ctx.nested = wasNested;
    return html;
  }

  splitRow(line) {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
    const cells = [];
    let cur = '';
    let tick = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '\\' && s[i + 1] === '|') {
        cur += '|';
        i++;
        continue;
      }
      if (ch === '`') {
        let n = 0;
        while (s[i + n] === '`') n++;
        if (tick === 0) tick = n;
        else if (tick === n) tick = 0;
        cur += s.slice(i, i + n);
        i += n - 1;
        continue;
      }
      if (ch === '|' && tick === 0) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }

  list(lines, start) {
    const items = [];
    let i = start;
    let fence = false;
    while (i < lines.length) {
      const l = lines[i];
      if (fence) {
        items[items.length - 1].lines.push(l.slice(Math.min(items[items.length - 1].content, l.match(/^\s*/)[0].length)));
        if (/^\s*```\s*$/.test(l)) fence = false;
        i++;
        continue;
      }
      const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (m) {
        const indent = m[1].replace(/\t/g, '    ').length;
        items.push({
          indent,
          content: indent + m[2].length + 1,
          ordered: /\d/.test(m[2]),
          num: parseInt(m[2], 10) || 1,
          lines: [m[3]],
        });
        i++;
        continue;
      }
      if (/^\s*$/.test(l)) {
        let j = i + 1;
        while (j < lines.length && /^\s*$/.test(lines[j])) j++;
        if (items.length && j < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[j]) || /^\s{2,}\S/.test(lines[j]))) {
          items[items.length - 1].lines.push('');
          i++;
          continue;
        }
        break;
      }
      if (/^\s+\S/.test(l) && items.length) {
        const it = items[items.length - 1];
        const lead = l.match(/^\s*/)[0].length;
        const stripped = l.slice(Math.min(it.content, lead));
        if (/^\s*```/.test(stripped)) fence = true;
        it.lines.push(stripped);
        i++;
        continue;
      }
      break;
    }

    const build = (idx, base) => {
      const ordered = items[idx].ordered;
      const startNum = items[idx].num;
      let html = ordered ? `<ol${startNum !== 1 ? ` start="${startNum}"` : ''}>` : '<ul>';
      while (idx < items.length && items[idx].indent >= base) {
        const it = items[idx];
        const complex = it.lines.some((x) => x === '' || /^\s*```/.test(x) || /^:::/.test(x));
        let inner = complex ? this.nested(it.lines) : this.inline(it.lines.join(' '));
        idx++;
        if (idx < items.length && items[idx].indent > base) {
          const sub = build(idx, items[idx].indent);
          inner += sub.html;
          idx = sub.next;
        }
        html += `<li>${inner}</li>`;
      }
      html += ordered ? '</ol>' : '</ul>';
      return { html, next: idx };
    };

    const res = build(0, items[0].indent);
    return { html: res.html, next: i };
  }

  code(code, lang, attrs) {
    code = code.replace(/\s+$/, '');
    const L = LANGS[lang] || { label: lang.toUpperCase(), hl: false };
    const lines = highlightLines(code, L.hl);
    const hl = parseRanges(attrs.hl);
    const numbered = L.hl && lines.length >= 4 && attrs.nums !== 'off';
    const body = lines
      .map((l, k) => `<span class="ln${hl.has(k + 1) ? ' hl' : ''}">${l}</span>`)
      .join('');
    const title = attrs.title ? esc(attrs.title) : L.label;
    const badge = attrs.title ? `<span class="code-lang">${L.label}</span>` : '';
    const actions = L.output
      ? ''
      : `<button type="button" class="code-btn" data-copy aria-label="Copy code">${icon('copy')}<span>Copy</span></button>` +
        (L.run && attrs.run !== 'off'
          ? `<button type="button" class="code-btn code-run" data-run aria-label="Run in the Luau Playground">${icon('play')}<span>Run</span></button>`
          : '');
    return `<figure class="code${numbered ? ' numbered' : ''}${L.output ? ' code-output' : ''}" data-lang="${esc(lang)}">
<figcaption class="code-head"><span class="code-dots"><i></i><i></i><i></i></span><span class="code-title">${title}</span>${badge}<span class="code-actions">${actions}</span></figcaption>
<pre class="code-pre" tabindex="0"><code>${body}</code></pre></figure>`;
  }

  container(type, arg, body) {
    if (CALLOUTS[type]) {
      const c = CALLOUTS[type];
      return `<aside class="callout callout-${type}"><div class="callout-icon">${icon(c.icon)}</div><div class="callout-body"><div class="callout-title">${
        arg ? this.inline(arg) : c.label
      }</div>${this.nested(body)}</div></aside>`;
    }
    switch (type) {
      case 'quiz':
        return this.quiz(arg, body);
      case 'challenge':
        return this.challenge(arg, body);
      case 'predict':
        return this.predict(arg, body);
      case 'tree':
        return this.tree(arg, body);
      case 'compare':
        return `<div class="compare">${this.nested(body)}</div>`;
      case 'steps':
        return `<div class="steps">${this.nested(body)}</div>`;
      case 'deepdive':
        return `<details class="deepdive"><summary><span class="deepdive-tag">Deep dive</span><span class="deepdive-title">${this.inline(
          arg || 'Under the hood'
        )}</span>${icon('right', 'deepdive-chev')}</summary><div class="deepdive-body">${this.nested(body)}</div></details>`;
      case 'recap':
        return `<section class="recap"><div class="recap-head">${icon('flag')}<span>${arg ? this.inline(arg) : 'Module recap'}</span></div>${this.nested(body)}</section>`;
      case 'cards':
        return `<div class="mini-cards">${this.nested(body)}</div>`;
      case 'html':
        return body.join('\n');
      default:
        throw new Error(`Unknown container :::${type} in ${this.ctx.id}`);
    }
  }

  quiz(arg, body) {
    const ctx = this.ctx;
    const questions = [];
    let cur = null;
    let fence = false;
    for (const line of body) {
      if (/^\s*```/.test(line)) fence = !fence;
      let m;
      if (!fence || /^\s*```\s*\w/.test(line)) {
        if ((m = line.match(/^\?\s+(.*)$/))) {
          cur = { prompt: [m[1]], opts: [], explain: [] };
          questions.push(cur);
          continue;
        }
        if (cur && !fence && (m = line.match(/^([+-])\s+(.*)$/))) {
          cur.opts.push({ ok: m[1] === '+', text: m[2] });
          continue;
        }
        if (cur && !fence && cur.opts.length && (m = line.match(/^>\s?(.*)$/))) {
          cur.explain.push(m[1]);
          continue;
        }
      }
      if (!cur) continue;
      if (cur.opts.length === 0) cur.prompt.push(line);
      else if (line.trim() || cur.explain.length) cur.explain.push(line);
    }

    ctx.counters.quiz++;
    const qs = questions.map((q) => {
      ctx.counters.q++;
      const id = `${ctx.id}-q${ctx.counters.q}`;
      ctx.quizIds.push(id);
      const rand = seededRandom(id);
      const opts = q.opts.map((o) => ({ ...o, r: rand() })).sort((a, b) => a.r - b.r);
      const answer = opts.findIndex((o) => o.ok);
      if (answer === -1 || opts.filter((o) => o.ok).length !== 1) {
        throw new Error(`Quiz question ${id} must have exactly one correct (+) option`);
      }
      return { id, q, opts, answer };
    });

    return `<section class="quiz" data-quiz>
<header class="quiz-head"><span class="quiz-icon">${icon('quiz')}</span><div class="quiz-heading"><div class="quiz-kicker">Knowledge check</div><div class="quiz-title">${
      arg ? this.inline(arg) : 'Test your understanding'
    }</div></div><div class="quiz-score" data-quiz-score>${qs.length} questions</div></header>
${qs
  .map(
    ({ id, q, opts, answer }, idx) => `<div class="quiz-q" data-qid="${id}" data-answer="${answer}">
<div class="quiz-prompt"><span class="quiz-n">${idx + 1}</span><div class="quiz-prompt-body">${this.nested(q.prompt)}</div></div>
<div class="quiz-opts">${opts
      .map(
        (o, k) =>
          `<button type="button" class="quiz-opt" data-i="${k}"><span class="quiz-key">${'ABCDEF'[k]}</span><span class="quiz-text">${this.inline(
            o.text
          )}</span></button>`
      )
      .join('')}</div>
<div class="quiz-feedback" hidden><div class="quiz-verdict"></div>${q.explain.length ? `<div class="quiz-explain">${this.nested(q.explain)}</div>` : ''}</div>
</div>`
  )
  .join('\n')}
</section>`;
  }

  challenge(arg, body) {
    const ctx = this.ctx;
    const [diffRaw, ...titleParts] = arg.split('|');
    const diff = (diffRaw || 'easy').trim().toLowerCase();
    if (!XP.challenge[diff]) throw new Error(`Unknown challenge difficulty "${diff}" in ${ctx.id}`);
    const title = titleParts.join('|').trim() || 'Challenge';
    ctx.counters.c++;
    const id = `${ctx.id}-c${ctx.counters.c}`;
    const xp = XP.challenge[diff];
    ctx.challenges.push({ id, xp, title, diff });

    const sections = { desc: [], hints: [], solution: [] };
    let target = sections.desc;
    let fence = false;
    for (const line of body) {
      if (/^\s*```/.test(line)) fence = !fence;
      if (!fence && /^@hint\s*$/.test(line)) {
        target = [];
        sections.hints.push(target);
        continue;
      }
      if (!fence && /^@solution\s*$/.test(line)) {
        target = sections.solution;
        continue;
      }
      target.push(line);
    }
    const label = { easy: 'Easy', medium: 'Medium', hard: 'Hard', boss: 'Boss' }[diff];
    return `<section class="challenge ch-${diff}" id="${id}" data-cid="${id}" data-xp="${xp}">
<header class="ch-head"><span class="ch-icon">${icon(diff === 'boss' ? 'award' : 'target')}</span><div class="ch-heading"><div class="ch-kicker">Challenge ${ctx.counters.c} · <span class="ch-diff">${label}</span></div><h4 class="ch-title">${this.inline(
      title
    )}</h4></div><div class="ch-xp">${icon('zap')}+${xp} XP</div></header>
<div class="ch-body">${this.nested(sections.desc)}</div>
${sections.hints
  .map(
    (h, k) =>
      `<details class="ch-hint"${k > 0 ? ' data-locked' : ''}><summary>${icon('tip')}<span>Hint ${k + 1}</span></summary><div class="ch-reveal">${this.nested(h)}</div></details>`
  )
  .join('\n')}
${
  sections.solution.length
    ? `<details class="ch-solution"><summary>${icon('eye')}<span>Reveal a solution</span></summary><div class="ch-reveal">${this.nested(sections.solution)}</div></details>`
    : ''
}
<footer class="ch-foot"><button type="button" class="btn btn-solve" data-solve>${icon('check')}<span>Mark as solved</span></button><span class="ch-note">Honor system — solve it in Studio or the playground, then check it off.</span></footer>
</section>`;
  }

  predict(arg, body) {
    const ctx = this.ctx;
    ctx.counters.p++;
    const id = `${ctx.id}-p${ctx.counters.p}`;
    ctx.predictIds.push(id);
    const codeLines = [];
    const answer = [];
    const explain = [];
    let fence = false;
    for (const line of body) {
      if (/^\s*```/.test(line)) {
        fence = !fence;
        codeLines.push(line);
        continue;
      }
      if (fence) {
        codeLines.push(line);
        continue;
      }
      let m;
      if ((m = line.match(/^=\s?(.*)$/))) answer.push(m[1]);
      else if ((m = line.match(/^>\s?(.*)$/))) explain.push(m[1]);
      else if (line.trim()) codeLines.push(line);
    }
    const multi = answer.length > 1;
    return `<section class="predict" data-pid="${id}" data-answer="${esc(JSON.stringify(answer))}">
<header class="pr-head"><span class="pr-icon">${icon('eye')}</span><div><div class="pr-kicker">Predict the output</div><div class="pr-title">${
      arg ? this.inline(arg) : 'What does this print?'
    }</div></div><div class="pr-xp">${icon('zap')}+${XP.predict} XP</div></header>
${this.nested(codeLines)}
<div class="pr-form">${
      multi
        ? `<textarea class="pr-input" rows="${Math.min(answer.length, 8)}" placeholder="Type the output, one line per print…" spellcheck="false"></textarea>`
        : `<input class="pr-input" type="text" placeholder="Type the exact output…" spellcheck="false" autocomplete="off">`
    }<div class="pr-actions"><button type="button" class="btn btn-primary btn-sm" data-check>Check</button><button type="button" class="btn btn-ghost btn-sm" data-reveal>Reveal</button></div></div>
<div class="pr-result" hidden></div>
<div class="pr-explain" hidden><div class="pr-answer-label">Expected output</div><pre class="pr-answer">${esc(answer.join('\n'))}</pre>${
      explain.length ? this.nested(explain) : ''
    }</div>
</section>`;
  }

  tree(arg, body) {
    const CLASS_GLYPH = {
      service: ['svc', '◆'],
      script: ['script', 'S'],
      localscript: ['local', 'L'],
      modulescript: ['module', 'M'],
      part: ['part', '▢'],
      model: ['model', '▲'],
      folder: ['folder', '▬'],
      remote: ['remote', 'R'],
      remotefn: ['remotefn', 'F'],
      bindable: ['bindable', 'B'],
      gui: ['gui', '▣'],
      value: ['value', 'V'],
      humanoid: ['humanoid', 'H'],
      player: ['player', 'P'],
      sound: ['sound', '♪'],
      tool: ['tool', 'T'],
      camera: ['camera', 'C'],
      attachment: ['attachment', 'A'],
      actor: ['actor', '⚑'],
      anim: ['anim', '▶'],
      instance: ['inst', '•'],
    };
    const SERVICES = /^(game|Workspace|Players|Lighting|ReplicatedFirst|ReplicatedStorage|ServerScriptService|ServerStorage|StarterGui|StarterPack|StarterPlayer|StarterPlayerScripts|StarterCharacterScripts|SoundService|Teams|TextChatService|Chat|MaterialService|CoreGui|PlayerGui|PlayerScripts|Backpack|DataModel)$/;
    const kind = (name, cls) => {
      const c = (cls || '').toLowerCase();
      if (!cls && SERVICES.test(name)) return 'service';
      if (c === 'script') return 'script';
      if (c === 'localscript') return 'localscript';
      if (c === 'modulescript') return 'modulescript';
      if (/^(part|meshpart|unionoperation|wedgepart|spawnlocation|basepart|trusspart|cornerwedgepart|terrain)$/.test(c)) return 'part';
      if (c === 'model') return 'model';
      if (c === 'folder' || c === 'configuration') return 'folder';
      if (/^(remoteevent|unreliableremoteevent)$/.test(c)) return 'remote';
      if (c === 'remotefunction') return 'remotefn';
      if (/^bindable/.test(c)) return 'bindable';
      if (/(gui|frame|label|button|textbox|ui\w+|imagelabel|scrollingframe|viewportframe)$/.test(c)) return 'gui';
      if (/value$/.test(c)) return 'value';
      if (c === 'humanoid' || c === 'animator') return 'humanoid';
      if (c === 'player') return 'player';
      if (/^sound/.test(c)) return 'sound';
      if (c === 'tool') return 'tool';
      if (c === 'camera') return 'camera';
      if (c === 'attachment') return 'attachment';
      if (c === 'actor') return 'actor';
      if (/^animation/.test(c)) return 'anim';
      if (/service$/.test(c)) return 'service';
      return 'instance';
    };
    const nodes = body
      .filter((l) => l.trim())
      .map((l) => {
        const indent = l.match(/^\s*/)[0].length;
        let rest = l.trim();
        let note = '';
        const hashAt = rest.indexOf(' # ');
        if (hashAt !== -1) {
          note = rest.slice(hashAt + 3);
          rest = rest.slice(0, hashAt).trim();
        }
        const m = rest.match(/^(.*?)\s*(?:\((\w+)\))?$/);
        return { indent, name: m[1], cls: m[2], note };
      });
    let html = '';
    const stack = [];
    for (const node of nodes) {
      while (stack.length && stack[stack.length - 1] >= node.indent) {
        stack.pop();
        html += '</ul></li>';
      }
      const [k, glyph] = CLASS_GLYPH[kind(node.name, node.cls)];
      html += `<li><div class="tree-row"><span class="ti ti-${k}">${glyph}</span><span class="tree-name">${esc(node.name)}</span>${
        node.cls ? `<span class="tree-class">${esc(node.cls)}</span>` : ''
      }${node.note ? `<span class="tree-note">${this.inline(node.note)}</span>` : ''}</div><ul>`;
      stack.push(node.indent);
    }
    while (stack.length) {
      stack.pop();
      html += '</ul></li>';
    }
    return `<figure class="tree">${arg ? `<figcaption class="tree-cap">${icon('layers')}${this.inline(arg)}</figcaption>` : ''}<ul class="tree-root">${html.replace(/<ul><\/ul>/g, '')}</ul></figure>`;
  }
}

/* ------------------------------------------------------------------ */
/* Front matter                                                        */
/* ------------------------------------------------------------------ */

function parseFrontMatter(src) {
  src = src.replace(/\r\n?/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let lastKey = null;
  for (const line of m[1].split('\n')) {
    const li = line.match(/^\s*-\s+(.*)$/);
    if (li && lastKey) {
      if (!Array.isArray(data[lastKey])) data[lastKey] = [];
      data[lastKey].push(li[1]);
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      lastKey = kv[1];
      data[kv[1]] = kv[2] === '' ? [] : kv[2];
    }
  }
  return { data, body: src.slice(m[0].length) };
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

let ASSET_V = '1';

function layout({ title, description, root, body, bodyClass = '', page = '', canonical = '' }) {
  const fullTitle = title ? `${title} · ${SITE.name}` : `${SITE.name} — Learn Luau, free`;
  const nav = [
    ['curriculum', `${root}#curriculum`, 'Curriculum'],
    ['cheatsheet', `${root}cheatsheet/`, 'Cheat Sheet'],
    ['playground', `${root}playground/`, 'Playground'],
    ['progress', `${root}progress/`, 'Progress'],
  ];
  const abs = SITE.url && canonical !== null ? `${SITE.url}/${canonical}` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || SITE.description)}">
<meta name="author" content="${esc(SITE.author)}">
<meta name="theme-color" content="#0b0e16">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || SITE.description)}">
${abs ? `<link rel="canonical" href="${esc(abs)}">\n<meta property="og:url" content="${esc(abs)}">\n<meta property="og:image" content="${esc(SITE.url)}/assets/img/og.svg">` : ''}
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="${root}assets/css/style.css?v=${ASSET_V}">
<script>(function(){try{var t=localStorage.getItem('la-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
</head>
<body class="${bodyClass}" data-root="${root}" data-page="${page}">
<a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
  <div class="topbar-inner">
    <button type="button" class="icon-btn nav-toggle" aria-label="Open course navigation" data-nav-toggle>${icon('menu')}</button>
    <a class="brand" href="${root}" aria-label="${esc(SITE.name)} home">${LOGO}<span class="brand-name">Luau<span>Academy</span></span></a>
    <nav class="topnav" aria-label="Primary">${nav
      .map(([k, href, label]) => `<a href="${href}"${page === k ? ' aria-current="page"' : ''}>${label}</a>`)
      .join('')}</nav>
    <div class="topbar-right">
      <button type="button" class="search-btn" data-search-open aria-label="Search the course">${icon('search')}<span class="search-btn-label">Search</span><kbd>Ctrl K</kbd></button>
      <a class="xp-pill" href="${root}progress/" data-xp-pill title="Your rank and XP">${icon('zap')}<span class="xp-pill-text"><span class="xp-rank" data-xp-rank>Newcomer</span><span class="xp-num"><span data-xp-total>0</span> XP</span></span><span class="xp-pill-bar"><i data-xp-bar></i></span></a>
      <button type="button" class="icon-btn theme-toggle" data-theme-toggle aria-label="Toggle color theme">${icon('sun', 'i-sun')}${icon('moon', 'i-moon')}</button>
    </div>
  </div>
</header>
${body}
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <a class="brand" href="${root}">${LOGO}<span class="brand-name">Luau<span>Academy</span></span></a>
      <p class="footer-credit">${esc(SITE.credit)}.</p>
      <p class="footer-small">Free forever. No accounts — your progress is saved privately in your browser.</p>
    </div>
    <div class="footer-cols">
      <div><h4>Course</h4><a href="${root}learn/welcome/">Start learning</a><a href="${root}#curriculum">Curriculum</a><a href="${root}progress/">Your progress</a><a href="${root}progress/#certificate">Certificate</a></div>
      <div><h4>Tools</h4><a href="${root}cheatsheet/">Cheat sheet</a><a href="${root}playground/">Playground</a><a href="#" data-search-open>Search</a></div>
      <div><h4>Official docs</h4><a href="https://luau.org" target="_blank" rel="noopener">luau.org</a><a href="https://create.roblox.com/docs" target="_blank" rel="noopener">Roblox Creator Hub</a><a href="https://play.luau.org" target="_blank" rel="noopener">Luau Playground</a></div>
    </div>
  </div>
  <div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(SITE.name)} · Made by ${esc(SITE.author)}</span><span>Not affiliated with or endorsed by Roblox Corporation. Roblox is a trademark of Roblox Corporation.</span></div>
</footer>
<div class="search-modal" data-search-modal hidden>
  <div class="search-backdrop" data-search-close></div>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search the course">
    <div class="search-field">${icon('search')}<input type="search" placeholder="Search lessons, APIs, concepts…" data-search-input autocomplete="off" spellcheck="false"><kbd data-search-close>Esc</kbd></div>
    <div class="search-results" data-search-results></div>
    <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
  </div>
</div>
<div class="toast-stack" data-toasts aria-live="polite"></div>
<script src="${root}assets/js/course-data.js?v=${ASSET_V}"></script>
<script src="${root}assets/js/vendor/lz-string.min.js"></script>
<script src="${root}assets/js/app.js?v=${ASSET_V}"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function sidebarHtml(modules, current, root) {
  return PARTS.map(
    (p) => `<div class="sb-part">
<div class="sb-part-title"><span class="sb-roman">Part ${p.roman}</span>${esc(p.title)}</div>
<ul>${modules
      .filter((m) => m.part === p.n)
      .map(
        (m) =>
          `<li><a href="${root}learn/${m.id}/" class="sb-link${m.id === current ? ' active' : ''}" data-mod="${m.id}"${
            m.id === current ? ' aria-current="page"' : ''
          }><span class="sb-status" aria-hidden="true"></span><span class="sb-num">${pad2(m.num)}</span><span class="sb-title">${esc(
            m.title
          )}</span></a></li>`
      )
      .join('')}</ul>
</div>`
  ).join('');
}

function tocHtml(headings) {
  if (!headings.length) return '';
  return `<nav class="toc-inner" aria-label="On this page"><div class="toc-title">On this page</div><ul>${headings
    .map((h) => `<li class="toc-l${h.level}"><a href="#${h.id}" data-toc-link>${esc(h.text)}</a></li>`)
    .join('')}</ul></nav>`;
}

function modulePage(mod, modules) {
  const root = '../../';
  const part = PARTS.find((p) => p.n === mod.part);
  const idx = modules.indexOf(mod);
  const prev = modules[idx - 1];
  const next = modules[idx + 1];
  const objectives = Array.isArray(mod.objectives) ? mod.objectives : [];
  const r = new Renderer({ id: mod.id, root });
  const stats = [];
  if (mod.quizIds.length) stats.push(`${mod.quizIds.length} quiz questions`);
  if (mod.predictIds.length) stats.push(`${mod.predictIds.length} predict-the-output`);
  if (mod.challenges.length) stats.push(`${mod.challenges.length} challenge${mod.challenges.length === 1 ? '' : 's'}`);

  const body = `<div class="learn-layout">
<div class="sb-overlay" data-nav-close></div>
<aside class="sidebar" aria-label="Course modules" data-sidebar>
  <div class="sb-head"><a href="${root}#curriculum" class="sb-back">${icon('map')}Curriculum</a><button type="button" class="icon-btn sb-close" data-nav-close aria-label="Close navigation">${icon('close')}</button></div>
  <div class="sb-progress"><div class="sb-progress-row"><span>Course progress</span><span data-course-pct>0%</span></div><div class="bar"><i data-course-bar></i></div></div>
  <nav class="sb-scroll">${sidebarHtml(modules, mod.id, root)}</nav>
</aside>
<main id="main" class="lesson" data-module="${mod.id}">
  <header class="lesson-hero">
    <div class="crumbs"><a href="${root}#part-${part.n}">Part ${part.roman} · ${esc(part.title)}</a></div>
    <div class="module-kicker">Module ${pad2(mod.num)}</div>
    <h1>${esc(mod.title)}</h1>
    <p class="lead">${r.inline(mod.summary || '')}</p>
    <div class="meta-row">
      ${mod.time ? `<span class="meta">${icon('clock')}${esc(mod.time)}</span>` : ''}
      ${mod.level ? `<span class="meta">${icon('bar')}${esc(mod.level)}</span>` : ''}
      ${stats.length ? `<span class="meta">${icon('target')}${stats.join(' · ')}</span>` : ''}
    </div>
    <div class="lesson-progress"><div class="bar"><i data-mod-bar></i></div><span data-mod-pct>0% complete</span></div>
  </header>
  ${
    objectives.length
      ? `<section class="objectives"><div class="objectives-head">${icon('target')}<span>What you'll learn</span></div><ul>${objectives
          .map((o) => `<li>${icon('check')}<span>${r.inline(o)}</span></li>`)
          .join('')}</ul></section>`
      : ''
  }
  <article class="prose">
${mod.html}
  </article>
  <section class="finish" data-finish="${mod.id}">
    <div class="finish-glow"></div>
    <div class="finish-icon">${icon('trophy')}</div>
    <div class="finish-text">
      <h2 class="finish-title" data-finish-title>Finished this module?</h2>
      <p data-finish-sub>Mark it complete to earn <strong>+${XP.module} XP</strong> and unlock your progress toward the certificate.</p>
    </div>
    <button type="button" class="btn btn-primary btn-lg" data-complete="${mod.id}">${icon('check')}<span>Mark module complete</span></button>
  </section>
  <nav class="pager" aria-label="Module navigation">
    ${
      prev
        ? `<a class="pager-link prev" href="${root}learn/${prev.id}/"><span class="pager-dir">${icon('left')}Previous</span><span class="pager-title">${pad2(prev.num)} · ${esc(prev.title)}</span></a>`
        : '<span></span>'
    }
    ${
      next
        ? `<a class="pager-link next" href="${root}learn/${next.id}/"><span class="pager-dir">Next${icon('right')}</span><span class="pager-title">${pad2(next.num)} · ${esc(next.title)}</span></a>`
        : `<a class="pager-link next" href="${root}progress/#certificate"><span class="pager-dir">Finish${icon('right')}</span><span class="pager-title">Claim your certificate</span></a>`
    }
  </nav>
</main>
<aside class="toc" data-toc>${tocHtml(mod.headings)}</aside>
</div>`;

  return layout({
    title: `${pad2(mod.num)} · ${mod.title}`,
    description: stripTags(mod.summary || SITE.description),
    root,
    body,
    bodyClass: 'page-learn',
    page: 'learn',
    canonical: `learn/${mod.id}/`,
  });
}

const HERO_CODE = `--!strict
local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Parent = leaderstats

	print(\`Welcome, {player.DisplayName}!\`)
end

Players.PlayerAdded:Connect(onPlayerAdded)`;

function homePage(modules, totals) {
  const root = './';
  const r = new Renderer({ id: 'home', root });
  const heroCode = r.code(HERO_CODE, 'roblox', { title: 'ServerScriptService › Leaderstats' });
  const features = [
    ['book', 'Deep, plain-English lessons', 'Every concept is explained from first principles, with diagrams, real Roblox examples and the “why” behind best practices.'],
    ['play', 'Run code instantly', 'Pure-Luau examples have a Run button that opens them in the official Luau Playground — no install required.'],
    ['eye', 'Predict the output', 'Train your mental model of Luau by predicting exactly what code prints before you run it.'],
    ['quiz', 'Knowledge checks', `${totals.quiz} quiz questions with instant feedback and explanations for every answer.`],
    ['target', 'Hands-on challenges', `${totals.challenges} coding challenges, from warm-ups to boss fights, each with progressive hints and a full solution.`],
    ['award', 'XP, ranks & a certificate', 'Earn XP as you learn, climb from Newcomer to Luau Master and claim a printable certificate at the end.'],
  ];
  const buildList = [
    'Leaderboards & data that saves between sessions',
    'Secure shops, currencies and developer products',
    'Combat systems with server-side hit validation',
    'NPCs that patrol, chase and pathfind',
    'Polished UI with tweens and responsive layouts',
    'Clean, modular codebases that scale with your team',
  ];
  const faq = [
    ['Do I need any programming experience?', 'No. Part I assumes you have never written code before. If you already know another language, you can move quickly through it — the quizzes will tell you if you have gaps.'],
    ['Is it really free?', 'Yes. Every module, challenge and the certificate are free, with no account or sign-up. Your progress is stored in your own browser.'],
    ['Do I need Roblox Studio?', 'For Parts I and II you can run almost everything in the browser with the Run buttons. Parts III–VI teach the Roblox engine, so you will want Roblox Studio (free) installed.'],
    ['How long does the course take?', `About ${Math.round(totals.minutes / 60)} hours of reading, plus however long you spend on challenges. Go at your own pace — a module a day is a great rhythm.`],
    ['Will my progress sync between devices?', 'Progress is saved locally. You can export it from the Progress page and import it on another device.'],
  ];

  const body = `<main id="main" class="home">
<section class="hero">
  <div class="hero-bg" aria-hidden="true"><div class="glow g1"></div><div class="glow g2"></div><div class="grid-bg"></div></div>
  <div class="hero-inner">
    <div class="hero-copy">
      <a class="credit-pill" href="#about"><span class="credit-emoji" aria-hidden="true">🐨</span><span>${esc(SITE.credit)}</span></a>
      <h1>Master Luau.<br><span class="grad-text">Build anything on Roblox.</span></h1>
      <p class="hero-lead">The complete, free course for the Luau programming language — from your very first <code>print</code> to secure, scalable, production-ready game systems. ${totals.modules} modules. ${totals.challenges} challenges. Zero paywalls.</p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="${root}learn/welcome/" data-continue>${icon('play')}<span data-continue-label>Start learning — it's free</span></a>
        <a class="btn btn-ghost btn-lg" href="#curriculum">${icon('map')}<span>View curriculum</span></a>
      </div>
      <div class="hero-proof">
        <span>${icon('check')}No sign-up</span><span>${icon('check')}Beginner friendly</span><span>${icon('check')}Up to date with modern Luau</span>
      </div>
    </div>
    <div class="hero-visual">
      <div class="hero-window">${heroCode}</div>
      <div class="float-card fc-1"><span class="fc-icon">${icon('zap')}</span><div><b>+50 XP</b><small>Challenge solved</small></div></div>
      <div class="float-card fc-2"><span class="fc-icon ok">${icon('check')}</span><div><b>Quiz 5 / 5</b><small>Perfect score</small></div></div>
      <div class="float-card fc-3"><span class="fc-icon rank">${icon('award')}</span><div><b>Rank up!</b><small>You're now a Developer</small></div></div>
    </div>
  </div>
  <div class="stats-strip">
    <div><b>${totals.modules}</b><span>Modules</span></div>
    <div><b>${totals.sections}+</b><span>Lessons</span></div>
    <div><b>${totals.quiz}</b><span>Quiz questions</span></div>
    <div><b>${totals.predict}</b><span>Predict-the-output</span></div>
    <div><b>${totals.challenges}</b><span>Challenges</span></div>
  </div>
</section>

<section class="section features">
  <div class="section-head"><div class="eyebrow">How it works</div><h2>Learn it. Run it. Prove it.</h2><p>Reading about code isn't enough. Every module mixes explanation with active practice so the knowledge actually sticks.</p></div>
  <div class="feature-grid">${features
    .map(([ic, t, d]) => `<div class="feature"><span class="feature-icon">${icon(ic)}</span><h3>${t}</h3><p>${d}</p></div>`)
    .join('')}</div>
</section>

<section class="section curriculum" id="curriculum">
  <div class="section-head"><div class="eyebrow">Curriculum</div><h2>From zero to production-ready</h2><p>${totals.modules} modules across six parts. Each one builds on the last — but feel free to jump to whatever you need.</p>
  <div class="overall"><div class="overall-row"><span>Your progress</span><span data-course-pct>0%</span></div><div class="bar bar-lg"><i data-course-bar></i></div></div></div>
  ${PARTS.map(
    (p) => `<div class="part" id="part-${p.n}">
    <div class="part-head"><div class="part-num">Part ${p.roman}</div><div><h3>${esc(p.title)}</h3><p>${esc(p.blurb)}</p></div><div class="part-progress" data-part-progress="${p.n}"></div></div>
    <div class="module-grid">${modules
      .filter((m) => m.part === p.n)
      .map(
        (m) => `<a class="module-card" href="${root}learn/${m.id}/" data-mod-card="${m.id}">
      <div class="mc-top"><span class="mc-num">${pad2(m.num)}</span><span class="mc-status" data-mod-status></span></div>
      <h4>${esc(m.title)}</h4>
      <p>${esc(stripTags(r.inline(m.summary || '')))}</p>
      <div class="mc-meta"><span>${icon('clock')}${esc(m.time || '')}</span><span>${icon('target')}${m.challenges.length} challenge${m.challenges.length === 1 ? '' : 's'}</span><span class="mc-level">${esc(m.level || '')}</span></div>
      <div class="bar bar-sm"><i data-mod-card-bar></i></div>
    </a>`
      )
      .join('')}</div>
  </div>`
  ).join('')}
</section>

<section class="section build">
  <div class="build-inner">
    <div><div class="eyebrow">Outcomes</div><h2>What you'll be able to build</h2><p>By the end of the course you'll understand not just <em>how</em> to write Luau, but how professional Roblox developers structure, secure and optimize real games.</p>
    <a class="btn btn-primary" href="${root}learn/capstone/">${icon('flag')}<span>Peek at the capstone project</span></a></div>
    <ul class="build-list">${buildList.map((b) => `<li>${icon('check')}<span>${b}</span></li>`).join('')}</ul>
  </div>
</section>

<section class="section about" id="about">
  <div class="about-card">
    <div class="about-avatar" aria-hidden="true">🐨</div>
    <div>
      <div class="eyebrow">About this course</div>
      <h2>Made by Koala</h2>
      <p class="about-credit">${esc(SITE.credit)}.</p>
      <p>Luau Academy is a free, structured path through everything you need to know to script on Roblox — the language itself, the engine's systems, and the habits that separate working code from great code. No ads, no accounts, no paywalls. Just learn.</p>
    </div>
  </div>
</section>

<section class="section faq">
  <div class="section-head"><div class="eyebrow">FAQ</div><h2>Questions, answered</h2></div>
  <div class="faq-list">${faq
    .map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}${icon('right', 'faq-chev')}</summary><p>${esc(a)}</p></details>`)
    .join('')}</div>
</section>

<section class="section final-cta">
  <div class="final-card"><h2>Your first script is five minutes away.</h2><p>Start with Module 01 and write real Luau today.</p><a class="btn btn-primary btn-lg" href="${root}learn/welcome/" data-continue>${icon('play')}<span data-continue-label>Start learning — it's free</span></a></div>
</section>
</main>`;

  return layout({ title: '', root, body, bodyClass: 'page-home', page: 'home', canonical: '' });
}

function simplePage({ title, description, root, page, html, headings, lead, kicker, canonical }) {
  const body = `<div class="doc-layout">
<main id="main" class="doc">
  <header class="doc-hero"><div class="module-kicker">${esc(kicker || '')}</div><h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</header>
  <article class="prose">${html}</article>
</main>
${headings && headings.length ? `<aside class="toc" data-toc>${tocHtml(headings)}</aside>` : ''}
</div>`;
  return layout({ title, description, root, body, bodyClass: `page-doc page-${page}`, page, canonical });
}

const PLAYGROUND_SNIPPETS = [
  ['Hello, Luau', 'print("Hello, Luau!")\n\nlocal name = "Koala"\nprint(`Welcome to Luau Academy, {name}!`)'],
  [
    'FizzBuzz',
    'for i = 1, 30 do\n\tif i % 15 == 0 then\n\t\tprint("FizzBuzz")\n\telseif i % 3 == 0 then\n\t\tprint("Fizz")\n\telseif i % 5 == 0 then\n\t\tprint("Buzz")\n\telse\n\t\tprint(i)\n\tend\nend',
  ],
  [
    'Tables & iteration',
    'local inventory = {\n\tSword = 1,\n\tPotion = 5,\n\tArrow = 64,\n}\n\nfor item, count in inventory do\n\tprint(`{item}: {count}`)\nend\n\nlocal scores = {42, 17, 99, 63}\ntable.sort(scores, function(a, b)\n\treturn a > b\nend)\nprint(table.concat(scores, ", "))',
  ],
  [
    'Closures',
    'local function makeCounter()\n\tlocal count = 0\n\treturn function()\n\t\tcount += 1\n\t\treturn count\n\tend\nend\n\nlocal a = makeCounter()\nlocal b = makeCounter()\nprint(a(), a(), a()) --> 1 2 3\nprint(b()) --> 1',
  ],
  [
    'A class with metatables',
    '--!strict\nlocal Account = {}\nAccount.__index = Account\n\ntype AccountData = { owner: string, balance: number }\nexport type Account = typeof(setmetatable({} :: AccountData, Account))\n\nfunction Account.new(owner: string): Account\n\treturn setmetatable({ owner = owner, balance = 0 }, Account)\nend\n\nfunction Account.deposit(self: Account, amount: number)\n\tassert(amount > 0, "amount must be positive")\n\tself.balance += amount\nend\n\nlocal acc = Account.new("Koala")\nacc:deposit(250)\nprint(acc.owner, acc.balance)',
  ],
  [
    'Coroutines',
    'local producer = coroutine.wrap(function()\n\tfor i = 1, 3 do\n\t\tcoroutine.yield(`item {i}`)\n\tend\n\treturn "done"\nend)\n\nprint(producer())\nprint(producer())\nprint(producer())\nprint(producer())',
  ],
  [
    'Type checking',
    '--!strict\ntype Shape = { kind: "circle", radius: number } | { kind: "rect", w: number, h: number }\n\nlocal function area(s: Shape): number\n\tif s.kind == "circle" then\n\t\treturn math.pi * s.radius ^ 2\n\telse\n\t\treturn s.w * s.h\n\tend\nend\n\nprint(area({ kind = "circle", radius = 2 }))\nprint(area({ kind = "rect", w = 3, h = 4 }))',
  ],
];

function playgroundPage() {
  const root = '../';
  const body = `<main id="main" class="playground-page">
  <header class="pg-hero"><div class="module-kicker">Playground</div><h1>Run Luau in your browser</h1><p class="lead">This is the official Luau Playground, embedded. It runs real Luau with type checking — perfect for Parts I and II. Roblox-specific APIs like <code>game</code>, <code>Instance</code> and <code>workspace</code> only exist inside Roblox Studio.</p></header>
  <div class="pg-layout">
    <aside class="pg-snippets"><div class="pg-snippets-title">${icon('code')}Starter snippets</div>${PLAYGROUND_SNIPPETS.map(
      ([t], k) => `<button type="button" class="pg-snippet" data-snippet="${k}">${icon('play')}<span>${esc(t)}</span></button>`
    ).join('')}<p class="pg-note">Tip: every runnable code block in the course has a <b>Run</b> button that opens it right here.</p></aside>
    <div class="pg-frame-wrap"><iframe class="pg-frame" data-pg-frame src="https://play.luau.org/" title="Luau Playground" loading="lazy" allow="clipboard-write"></iframe>
    <div class="pg-frame-foot"><span>Powered by the official <a href="https://play.luau.org" target="_blank" rel="noopener">Luau Playground</a></span><a href="https://play.luau.org" target="_blank" rel="noopener" data-pg-open>Open in new tab ${icon('external')}</a></div></div>
  </div>
  <script type="application/json" id="pg-snippets">${JSON.stringify(PLAYGROUND_SNIPPETS.map(([, c]) => c)).replace(/</g, '\\u003c')}</script>
</main>`;
  return layout({ title: 'Playground', description: 'Run Luau code in your browser with the official Luau Playground.', root, body, bodyClass: 'page-playground', page: 'playground', canonical: 'playground/' });
}

function progressPage() {
  const root = '../';
  const body = `<main id="main" class="progress-page">
  <header class="doc-hero"><div class="module-kicker">Your progress</div><h1>Progress & certificate</h1><p class="lead">Everything here is stored privately in this browser. Export it to move to another device.</p></header>
  <div id="progress-app" class="progress-app"><noscript>Enable JavaScript to see your progress.</noscript></div>
</main>`;
  return layout({ title: 'Your Progress', description: 'Track your Luau Academy progress, rank and certificate.', root, body, bodyClass: 'page-progress', page: 'progress', canonical: 'progress/' });
}

function notFoundPage() {
  const root = '/';
  const body = `<main id="main" class="notfound"><div class="nf-code">404</div><h1>This page went <code>nil</code>.</h1><p>The page you're looking for doesn't exist — maybe it was renamed, or the link had a typo.</p><div class="hero-cta"><a class="btn btn-primary" href="/">${icon('left')}<span>Back home</span></a><a class="btn btn-ghost" href="/#curriculum">${icon('map')}<span>Curriculum</span></a></div></main>`;
  return layout({ title: 'Page not found', root, body, bodyClass: 'page-404', page: '404', canonical: null });
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

function sectionsForSearch(html, url, moduleTitle, kind) {
  const entries = [];
  const parts = html.split(/(?=<h[23] id=")/);
  for (const part of parts) {
    const hm = part.match(/^<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/);
    if (!hm) continue;
    const heading = stripTags(hm[3].replace(/<a class="anchor"[^>]*>#<\/a>/, '').replace(/<[^>]+>/g, ''));
    const text = stripTags(part.slice(hm[0].length)).slice(0, 700);
    entries.push({ h: heading, m: moduleTitle, u: `${url}#${hm[2]}`, k: kind, x: text });
  }
  return entries;
}

function build() {
  const t0 = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  // Load modules
  const modDir = path.join(SRC, 'content', 'modules');
  const files = fs.readdirSync(modDir).filter((f) => f.endsWith('.md')).sort();
  const modules = files.map((f, k) => {
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(modDir, f), 'utf8'));
    if (!data.id) throw new Error(`${f} is missing an id`);
    return { ...data, file: f, num: k + 1, part: parseInt(data.part, 10) || 1, body };
  });
  const moduleIds = new Set(modules.map((m) => m.id));
  const moduleTitles = new Map(modules.map((m) => [m.id, m.title]));

  // Render module content
  for (const mod of modules) {
    const ctx = { id: mod.id, root: '../../', moduleIds, moduleTitles };
    const r = new Renderer(ctx);
    mod.html = r.blocks(mod.body);
    mod.headings = ctx.headings;
    mod.quizIds = ctx.quizIds;
    mod.predictIds = ctx.predictIds;
    mod.challenges = ctx.challenges;
  }

  // Course data for the client
  const maxXp =
    modules.length * XP.module +
    modules.reduce(
      (s, m) => s + m.quizIds.length * XP.quiz + m.predictIds.length * XP.predict + m.challenges.reduce((a, c) => a + c.xp, 0),
      0
    );
  const totals = {
    modules: modules.length,
    quiz: modules.reduce((s, m) => s + m.quizIds.length, 0),
    predict: modules.reduce((s, m) => s + m.predictIds.length, 0),
    challenges: modules.reduce((s, m) => s + m.challenges.length, 0),
    sections: modules.reduce((s, m) => s + m.headings.filter((h) => h.level === 2).length, 0),
    minutes: modules.reduce((s, m) => s + (parseInt(m.time, 10) || 0), 0),
  };
  const course = {
    name: SITE.name,
    credit: SITE.credit,
    xp: { quiz: XP.quiz, predict: XP.predict, module: XP.module },
    maxXp,
    ranks: RANKS.map((rk) => ({ name: rk.name, min: Math.round(rk.at * maxXp) })),
    parts: PARTS,
    modules: modules.map((m) => ({
      id: m.id,
      num: m.num,
      title: m.title,
      part: m.part,
      time: m.time || '',
      quiz: m.quizIds,
      predict: m.predictIds,
      challenges: m.challenges.map((c) => ({ id: c.id, xp: c.xp })),
    })),
  };

  // Asset version (cache busting)
  const hash = crypto.createHash('md5');
  hash.update(JSON.stringify(course));
  for (const f of ['css/style.css', 'js/app.js']) hash.update(fs.readFileSync(path.join(SRC, 'assets', f)));
  ASSET_V = hash.digest('hex').slice(0, 10);
  course.v = ASSET_V;

  copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
  write('assets/js/course-data.js', `window.COURSE=${JSON.stringify(course)};\n`);

  // Pages
  write('index.html', homePage(modules, totals));
  for (const mod of modules) write(`learn/${mod.id}/index.html`, modulePage(mod, modules));

  const search = [];
  for (const mod of modules) {
    search.push({ h: mod.title, m: `Module ${pad2(mod.num)}`, u: `learn/${mod.id}/`, k: 'module', x: stripTags(mod.summary || '') });
    search.push(...sectionsForSearch(mod.html, `learn/${mod.id}/`, `${pad2(mod.num)} · ${mod.title}`, 'section'));
  }

  // Markdown pages (cheat sheet, etc.)
  const pageDir = path.join(SRC, 'content', 'pages');
  if (fs.existsSync(pageDir)) {
    for (const f of fs.readdirSync(pageDir).filter((x) => x.endsWith('.md'))) {
      const { data, body } = parseFrontMatter(fs.readFileSync(path.join(pageDir, f), 'utf8'));
      const ctx = { id: data.id, root: '../', moduleIds, moduleTitles };
      const r = new Renderer(ctx);
      const html = r.blocks(body);
      write(
        `${data.id}/index.html`,
        simplePage({
          title: data.title,
          description: data.summary,
          root: '../',
          page: data.id,
          html,
          headings: ctx.headings,
          lead: r.inline(data.summary || ''),
          kicker: data.kicker || '',
          canonical: `${data.id}/`,
        })
      );
      search.push(...sectionsForSearch(html, `${data.id}/`, data.title, 'page'));
    }
  }

  write('assets/js/search-index.js', `window.SEARCH_INDEX=${JSON.stringify(search)};\n`);
  write('playground/index.html', playgroundPage());
  write('progress/index.html', progressPage());
  write('404.html', notFoundPage());
  write('robots.txt', `User-agent: *\nAllow: /\n${SITE.url ? `Sitemap: ${SITE.url}/sitemap.xml\n` : ''}`);
  if (SITE.url) {
    const urls = ['', 'cheatsheet/', 'playground/', 'progress/', ...modules.map((m) => `learn/${m.id}/`)];
    write(
      'sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
        .map((u) => `  <url><loc>${SITE.url}/${u}</loc></url>`)
        .join('\n')}\n</urlset>\n`
    );
  }

  console.log(
    `Built ${modules.length} modules · ${totals.quiz} quiz questions · ${totals.predict} predictions · ${totals.challenges} challenges · ${maxXp} max XP in ${Date.now() - t0}ms`
  );
}

build();
