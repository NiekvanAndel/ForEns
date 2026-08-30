/**
 * Token bridge.
 *
 * The ExactCast AI Design System's `tokens/*.css` is the single source of truth for
 * colour, type, spacing, shape and motion. This script reads those files and emits
 * `theme/tokens.generated.ts` as typed constants, so no token is ever hand-copied
 * into a component. When the design system is updated, re-run `npm run tokens`.
 *
 * Only values React Native can actually use are emitted. CSS-only constructs —
 * gradients, backdrop-filter, box-shadow, transitions — are collected separately
 * under `css` so a component can translate them deliberately (a gradient becomes
 * expo-linear-gradient, a shadow becomes shadowOffset/shadowRadius) rather than
 * silently dropping them.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_DIR = join(ROOT, 'iOS', 'ExactCast AI Design System', 'tokens');
const OUT = join(ROOT, 'theme', 'tokens.generated.ts');

const FILES = ['colors.css', 'typography.css', 'spacing.css', 'shape.css', 'motion.css', 'fonts.css'];

/** Cut `@media (...) { ... }` blocks out of the source with brace matching, so a
 *  nested `:root` is never mistaken for the top-level one. Returns the remaining
 *  CSS plus the bodies of every dark-appearance media block. */
function extractDarkMedia(css) {
  const darkBodies = [];
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    const open = css.indexOf('{', at);
    if (open === -1) {
      out += css.slice(i);
      break;
    }
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const query = css.slice(at, open);
    const body = css.slice(open + 1, j - 1);
    out += css.slice(i, at);
    // Only the dark-scheme query carries a palette; any other media block is dropped,
    // since RN has no viewport queries to apply it to.
    if (/prefers-color-scheme\s*:\s*dark/.test(query)) darkBodies.push(body);
    i = j;
  }
  return { rest: out, darkBodies };
}

const DECL = /--([\w-]+)\s*:\s*([^;]+);?/g;
function readDecls(body, into) {
  for (const [, name, value] of body.matchAll(DECL)) into[name] = value.trim();
}

/** Pull `--name:value;` pairs into a light and a dark table.
 *
 *  Light  = `:root` plus `[data-appearance="light"]`, which re-pins the appearance-
 *           linked tokens to their light values and must therefore win over `:root`.
 *  Dark   = `[data-appearance="dark"]` plus every `:root` inside a
 *           `prefers-color-scheme: dark` media query. */
function parse(css) {
  const root = {};
  const dark = {};

  // Strip comments first so a `/* ... : ... */` note is never read as a declaration.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const { rest, darkBodies } = extractDarkMedia(clean);

  for (const body of darkBodies) {
    for (const [, , inner] of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) readDecls(inner, dark);
  }

  const light = [];
  for (const [, rawSel, body] of rest.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = rawSel.trim();
    if (sel.includes('[data-appearance="dark"]')) readDecls(body, dark);
    else if (sel === ':root') light.push([0, body]);
    else if (sel.includes('[data-appearance="light"]')) light.push([1, body]);
  }
  // `:root` first, then the light appearance block, regardless of file order.
  for (const [, body] of light.sort((a, b) => a[0] - b[0])) readDecls(body, root);

  return { root, dark };
}

/** A bare colour literal: `#rgb`, `#rrggbb`, `rgb(...)` or `rgba(...)` and nothing else.
 *  Tested before the CSS-only check, so a four-part `rgba()` is never mistaken for a
 *  multi-value shorthand. */
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([^()]*\))$/i;

/** Values React Native's style engine cannot consume: gradients, filters, easings,
 *  transforms, and multi-part shorthands such as box-shadow. */
const CSS_ONLY = /(gradient|blur\(|saturate\(|cubic-bezier|translateY|brightness|px\s+-?[\d.]+px)/;
const isCssOnly = (v) => !COLOR.test(v) && (CSS_ONLY.test(v) || v.split(',').length > 3);

/** Resolve `var(--x)` chains to a literal, so RN never sees a var(). */
function resolve(value, table, seen = new Set()) {
  let out = value;
  for (let i = 0; i < 10 && out.includes('var('); i++) {
    out = out.replace(/var\(--([\w-]+)(?:\s*,\s*([^()]*))?\)/g, (m, name, fallback) => {
      if (seen.has(name)) return fallback ?? m;
      seen.add(name);
      return table[name] ?? fallback ?? m;
    });
  }
  return out.trim();
}

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const num = (v) => {
  const m = /^(-?[\d.]+)px$/.exec(v);
  return m ? Number(m[1]) : null;
};

const all = {};
const darkAll = {};
for (const f of FILES) {
  const { root, dark } = parse(readFileSync(join(TOKENS_DIR, f), 'utf8'));
  Object.assign(all, root);
  Object.assign(darkAll, dark);
}

const colors = {};
const cssOnly = {};
const numbers = {};
const strings = {};

for (const [name, raw] of Object.entries(all)) {
  const v = resolve(raw, all);
  if (COLOR.test(v)) {
    colors[camel(name)] = v;
  } else if (isCssOnly(v)) {
    cssOnly[camel(name)] = v;
  } else if (num(v) !== null) {
    numbers[camel(name)] = num(v);
  } else {
    strings[camel(name)] = v;
  }
}

const darkColors = {};
for (const [name, raw] of Object.entries(darkAll)) {
  const v = resolve(raw, { ...all, ...darkAll });
  if (COLOR.test(v)) darkColors[camel(name)] = v;
}

const lit = (o) =>
  '{\n' +
  Object.entries(o)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${typeof v === 'number' ? v : JSON.stringify(v)},`)
    .join('\n') +
  '\n}';

const banner = `/* GENERATED by scripts/build-tokens.mjs — do not edit.
 * Source: iOS/ExactCast AI Design System/tokens/*.css
 * Re-run with: npm run tokens
 */`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${banner}

/** Every colour token, resolved to a literal. */
export const colors = ${lit(colors)} as const;

/** Colour tokens redefined for the dark appearance. */
export const darkColors = ${lit(darkColors)} as const;

/** Numeric tokens (px values) — spacing, radii, type sizes. */
export const numbers = ${lit(numbers)} as const;

/** Non-numeric, non-colour tokens — font stacks, weights, unitless line heights. */
export const strings = ${lit(strings)} as const;

/** CSS-only values. Translate these deliberately; never pass them to a RN style. */
export const css = ${lit(cssOnly)} as const;

export type ColorToken = keyof typeof colors;
`,
  'utf8'
);

console.log(
  `theme/tokens.generated.ts — ${Object.keys(colors).length} colors, ` +
    `${Object.keys(darkColors).length} dark, ${Object.keys(numbers).length} numbers, ` +
    `${Object.keys(strings).length} strings, ${Object.keys(cssOnly).length} css-only`
);
