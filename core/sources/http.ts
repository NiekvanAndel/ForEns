/**
 * HTTP helpers shared by every source.
 *
 * Ported from index.html's `safeFetch`, which handles two Open-Meteo behaviours that
 * a plain fetch does not: 429 rate limiting, and error responses that arrive with
 * HTTP 200 and `{"error": true, "reason": "..."}` in the body.
 */

export class SourceError extends Error {
  constructor(
    readonly source: string,
    message: string,
    readonly status?: number
  ) {
    super(`${source}: ${message}`);
    this.name = 'SourceError';
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface FetchOptions {
  retries?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * GET and parse JSON, retrying on rate limits, transport failures, and Open-Meteo's
 * body-level errors. Returns the parsed body; throws `SourceError` once retries are
 * spent.
 */
export async function fetchJson<T = unknown>(
  url: string,
  source: string,
  opts: FetchOptions = {}
): Promise<T> {
  const { retries = 2, signal, headers, fetchImpl = fetch } = opts;
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetchImpl(url, { signal, headers });
      if (r.status === 429 && i < retries) {
        await sleep(600 * (i + 1));
        continue;
      }
      if (!r.ok) {
        if (i < retries) {
          await sleep(400 * (i + 1));
          continue;
        }
        throw new SourceError(source, `HTTP ${r.status}`, r.status);
      }
      const body = (await r.json()) as T & { error?: boolean; reason?: string };
      // Open-Meteo reports some failures with a 200 and an error body.
      if (body?.error) {
        if (i < retries) {
          await sleep(800 * (i + 1));
          continue;
        }
        throw new SourceError(source, body.reason ?? 'API error');
      }
      return body;
    } catch (e) {
      if (e instanceof SourceError) throw e;
      if ((e as Error)?.name === 'AbortError') throw e;
      lastError = e as Error;
      if (i === retries) break;
      await sleep(400 * (i + 1));
    }
  }
  throw new SourceError(source, lastError?.message ?? 'request failed');
}

/**
 * GET and parse JSON, resolving to null instead of throwing.
 * Used where a source is genuinely optional and the app renders without it.
 */
export async function tryFetchJson<T = unknown>(
  url: string,
  source: string,
  opts: FetchOptions = {}
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, source, opts);
  } catch {
    return null;
  }
}
