/**
 * Curve smoothing for the detail charts.
 *
 * Ported verbatim from index.html's `smoothPath` — a Catmull-Rom spline converted to
 * cubic Béziers, with the control-point pull weighted by segment length so a dense
 * cluster of hours does not overshoot into a loop.
 *
 * The output is an SVG path, which react-native-svg consumes directly, so the web
 * app's charts port without redrawing them.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A smoothed path through `pts`.
 * `t` is the tension, 0 giving straight segments and larger values rounder corners.
 */
export function smoothPath(pts: readonly Point[], t?: number | null): string {
  if (!pts.length) return '';
  const first = pts[0] as Point;
  if (pts.length < 2) return `M${first.x},${first.y}`;
  const tension = t == null ? 0.35 : t;

  let d = `M${first.x},${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? (pts[i] as Point);
    const p1 = pts[i] as Point;
    const p2 = pts[i + 1] as Point;
    const p3 = pts[i + 2] ?? p2;

    const d01 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const d12 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const d23 = Math.hypot(p3.x - p2.x, p3.y - p2.y);

    let s12a = d12 / (d01 + d12);
    if (!Number.isFinite(s12a)) s12a = 0;
    let s12b = d12 / (d12 + d23);
    if (!Number.isFinite(s12b)) s12b = 0;

    const fb = tension * s12a;
    const fa = tension * s12b;
    const c1x = p1.x + fb * (p2.x - p0.x);
    const c1y = p1.y + fb * (p2.y - p0.y);
    const c2x = p2.x - fa * (p3.x - p1.x);
    const c2y = p2.y - fa * (p3.y - p1.y);

    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Map a value onto a pixel coordinate within a plotted area. */
export function scaleY(value: number, lo: number, hi: number, top: number, height: number): number {
  const span = hi - lo || 1;
  return top + height - ((value - lo) / span) * height;
}

/** Even horizontal spacing for `count` points across a width. */
export function scaleX(index: number, count: number, left: number, width: number): number {
  if (count <= 1) return left + width / 2;
  return left + (index / (count - 1)) * width;
}

/**
 * A "nice" axis range: padded, and rounded outward to a readable step so the
 * gridlines land on values a reader recognises rather than on 17.3.
 */
export function niceRange(lo: number, hi: number, padFraction = 0.1): { lo: number; hi: number } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 };
  if (hi === lo) {
    hi = lo + 1;
  }
  const pad = (hi - lo) * padFraction;
  let a = lo - pad;
  let b = hi + pad;

  const span = b - a;
  const magnitude = Math.pow(10, Math.floor(Math.log10(span)));
  const step = span / magnitude > 5 ? magnitude : span / magnitude > 2 ? magnitude / 2 : magnitude / 5;

  a = Math.floor(a / step) * step;
  b = Math.ceil(b / step) * step;
  // Floating-point residue from the divisions above would otherwise show up as
  // gridline labels like "-0.00000000001".
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { lo: round(a), hi: round(b) };
}
