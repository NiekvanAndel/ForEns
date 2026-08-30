/**
 * The parity oracle.
 *
 * Reads the original implementations straight out of `index.html` and evaluates them
 * in an isolated scope, so the ported TypeScript can be checked against the code that
 * is actually in production rather than against a hand-copied snapshot that would
 * drift. If a port changes behaviour, these tests fail.
 *
 * The web app reads the UTC offset from a module-level `S` object; the harness
 * supplies a stand-in so the extracted functions run unmodified.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SOURCE = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

/** Extract `function name(...) { ... }` by matching braces from the opening one. */
function extractFunction(src: string, name: string): string {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`oracle: function ${name} not found in index.html`);
  const start = m.index;
  const open = src.indexOf('{', re.lastIndex - 1);
  let depth = 1;
  let i = open + 1;
  let inStr: string | null = null;
  let inLine = false;
  let inBlock = false;
  while (i < src.length && depth > 0) {
    const c = src[i] as string;
    const next = src[i + 1];
    const prev = src[i - 1];
    if (inLine) {
      if (c === '\n') inLine = false;
    } else if (inBlock) {
      if (c === '*' && next === '/') { inBlock = false; i++; }
    } else if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === '/' && next === '/') {
      // Comments must be skipped wholesale: index.html's Dutch comments contain
      // apostrophes ("the API's local timezone") that would otherwise open a string
      // and swallow the braces that follow.
      inLine = true;
      i++;
    } else if (c === '/' && next === '*') {
      inBlock = true;
      i++;
    } else if (c === '"' || c === "'" || c === '`') {
      inStr = c;
    } else if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  if (depth !== 0) throw new Error(`oracle: unbalanced braces extracting ${name}`);
  return src.slice(start, i);
}

/** Extract a `const name = { ... };` whose value spans multiple lines, by matching
 *  braces (or brackets) from the opening one. */
function extractObjectConst(src: string, name: string): string {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*[[{]`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`oracle: const ${name} not found in index.html`);
  const open = re.lastIndex - 1;
  const openCh = src[open] as string;
  const closeCh = openCh === '{' ? '}' : ']';
  let depth = 1;
  let i = open + 1;
  let inStr: string | null = null;
  while (i < src.length && depth > 0) {
    const c = src[i] as string;
    const prev = src[i - 1];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === openCh) depth++;
    else if (c === closeCh) depth--;
    i++;
  }
  if (depth !== 0) throw new Error(`oracle: unbalanced braces extracting const ${name}`);
  return src.slice(m.index, i) + ';';
}

/** Extract the whole `const ...;` statement that declares `name`.
 *  index.html declares several constants per statement (`const A=1, B=2;`), so this
 *  returns the full statement and callers must dedupe before concatenating. */
function extractConst(src: string, name: string): string {
  const re = new RegExp(`const\\s+[^;\\n]*\\b${name}\\s*=\\s*[^;\\n]+`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`oracle: const ${name} not found in index.html`);
  return m[0] + ';';
}

export interface OracleOptions {
  /** UTC offset in seconds, as the web app's `S._utcOffset`. */
  utcOffsetSec?: number;
  /** Extra fields merged into the `S` global (lat, lon, harmFailed, …). */
  S?: Record<string, unknown>;
  /** The `PREFS` global, for code that branches on preferences. */
  PREFS?: Record<string, unknown>;
  /** Freezes `new Date()` so the IFS run label is deterministic.
   *  Calls with arguments still behave normally, which the solar maths relies on. */
  nowMs?: number;
  /** Multi-line object constants the extracted functions close over, e.g. `LANG`. */
  objectConsts?: readonly string[];
}

/** A Date whose no-argument constructor is pinned, leaving every other form intact. */
function frozenDate(nowMs: number): DateConstructor {
  const Frozen = function (this: unknown, ...args: unknown[]) {
    if (!(this instanceof Frozen)) return new (Date as any)().toString();
    return args.length === 0
      ? new (Date as any)(nowMs)
      : new (Date as any)(...(args as ConstructorParameters<DateConstructor>));
  } as unknown as DateConstructor;
  Frozen.parse = Date.parse;
  Frozen.UTC = Date.UTC;
  Frozen.now = () => nowMs;
  Object.defineProperty(Frozen, 'prototype', { value: Date.prototype });
  return Frozen;
}

/**
 * Build a sandbox exposing the named functions from index.html.
 * Dependencies must be listed too — nothing is resolved automatically.
 */
export type OracleFn = (...args: any[]) => any;

/** Generic over the requested names, so callers get concrete keys rather than an
 *  index signature — which `noUncheckedIndexedAccess` would otherwise widen to
 *  `| undefined` at every call site. */
export function loadOracle<const N extends readonly string[]>(
  names: N,
  opts: OracleOptions = {}
): { [K in N[number]]: OracleFn } {
  const parts: string[] = [];
  // The extracted code refers to `S`, `PREFS` and the method-6 constants.
  parts.push(`var S = __S; var PREFS = __PREFS;`);
  const consts = new Set<string>();
  for (const c of ['M6_FALLBACK_OPACITY', 'M6_S0']) {
    try {
      consts.add(extractConst(SOURCE, c));
    } catch {
      /* not every oracle needs them */
    }
  }
  parts.push(...consts);
  for (const c of opts.objectConsts ?? []) parts.push(extractObjectConst(SOURCE, c));
  for (const n of names) parts.push(extractFunction(SOURCE, n));
  parts.push(`({ ${names.join(', ')} })`);

  const context = vm.createContext({
    Math,
    Date: opts.nowMs != null ? frozenDate(opts.nowMs) : Date,
    Number, JSON, console, isNaN, parseInt, parseFloat, Object, Array, Map, Set, Infinity, NaN,
    __S: { _utcOffset: opts.utcOffsetSec ?? 0, ...(opts.S ?? {}) },
    __PREFS: { useHarmonie: true, ...(opts.PREFS ?? {}) },
  });
  return vm.runInContext(parts.join('\n'), context) as { [K in N[number]]: OracleFn };
}
