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
  while (i < src.length && depth > 0) {
    const c = src[i] as string;
    const prev = src[i - 1];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inStr = c;
    } else if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return src.slice(start, i);
}

/** Extract a `const name = ...;` single-line declaration. */
function extractConst(src: string, name: string): string {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*[^;\\n]+`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`oracle: const ${name} not found in index.html`);
  return m[0] + ';';
}

export interface OracleOptions {
  /** UTC offset in seconds, as the web app's `S._utcOffset`. */
  utcOffsetSec?: number;
}

/**
 * Build a sandbox exposing the named functions from index.html.
 * Dependencies must be listed too — nothing is resolved automatically.
 */
export function loadOracle(
  names: readonly string[],
  opts: OracleOptions = {}
): Record<string, (...args: any[]) => any> {
  const parts: string[] = [];
  // The extracted code refers to `S._utcOffset` and the method-6 constants.
  parts.push(`var S = { _utcOffset: ${opts.utcOffsetSec ?? 0} };`);
  for (const c of ['M6_FALLBACK_OPACITY', 'M6_S0']) {
    try {
      parts.push(extractConst(SOURCE, c));
    } catch {
      /* not every oracle needs them */
    }
  }
  for (const n of names) parts.push(extractFunction(SOURCE, n));
  parts.push(`({ ${names.join(', ')} })`);

  const context = vm.createContext({ Math, Date, Number, JSON, console, isNaN, parseInt, parseFloat });
  return vm.runInContext(parts.join('\n'), context) as Record<string, (...a: any[]) => any>;
}
