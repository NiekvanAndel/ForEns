/**
 * Ensemble statistics.
 *
 * Ported from index.html (`pct`, `pge`, `normalCDFUpper`, `r1`). Behaviour is
 * deliberately identical, including the linear-interpolation percentile definition
 * and the Abramowitz & Stegun normal approximation, so the parity tests can compare
 * against the web app value for value.
 */

export type Maybe = number | null | undefined;

/** Drop nulls and NaNs, keeping only finite numbers. */
export function finite(arr: readonly Maybe[]): number[] {
  const out: number[] = [];
  for (const v of arr) if (v != null && Number.isFinite(v)) out.push(v as number);
  return out;
}

/**
 * Percentile `p` (0–100) by linear interpolation between order statistics.
 * Returns null when no finite values are present.
 */
export function percentile(arr: readonly Maybe[], p: number): number | null {
  const s = finite(arr).sort((a, b) => a - b);
  if (!s.length) return null;
  const i = (p / 100) * (s.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  const a = s[lo] as number;
  const b = s[hi] as number;
  return a + (b - a) * (i - lo);
}

/** Share of members at or above `threshold`, as a percentage (0–100). */
export function probAtLeast(arr: readonly Maybe[], threshold: number): number {
  const v = finite(arr);
  if (!v.length) return 0;
  return (v.filter((x) => x >= threshold).length / v.length) * 100;
}

/**
 * P(X > threshold) for a normal X, via the Abramowitz & Stegun 26.2.17
 * approximation to the standard normal CDF. Returns a probability in [0, 1].
 *
 * With no spread the distribution is a point mass, so the result is a step.
 */
export function normalCDFUpper(mean: number, spread: number, threshold: number): number {
  if (!spread || spread <= 0) return mean >= threshold ? 1 : 0;
  const z = (threshold - mean) / spread;
  if (z < -6) return 1;
  if (z > 6) return 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return Math.min(1, Math.max(0, z >= 0 ? phi : 1 - phi));
}

/** Round to one decimal, mapping NaN to 0 — matches the web app's `r1`. */
export function round1(v: number): number {
  return Number.isNaN(v) ? 0 : Math.round(v * 10) / 10;
}

/** Median of a non-empty numeric array. */
export function median(a: readonly number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  if (!s.length) return NaN;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** The five-number spread the day rows and detail sheets are built from. */
export interface Spread {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

export function spread(arr: readonly Maybe[]): Spread {
  return {
    p10: percentile(arr, 10),
    p25: percentile(arr, 25),
    p50: percentile(arr, 50),
    p75: percentile(arr, 75),
    p90: percentile(arr, 90),
  };
}
