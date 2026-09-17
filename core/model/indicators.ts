/**
 * The agronomic indicator — the one model concept the whole agro layer rests on.
 *
 * Today the app can say one thing, about one location, about today: `deriveAlert`
 * returns at most one alert and `planNotification` makes at most one notification of
 * it. Spray windows, disease pressure, temperature sums and area conclusions do not
 * fit in that. The way out is not more alert kinds but one missing noun:
 *
 *   **a derived quantity with a threshold, a state, a course in time, an origin, a
 *   certainty and a horizon.**
 *
 * Once it exists, a block on 'Actueel', a line in a chart, a window bar, a widget, a
 * notification and an area bulletin are *views of the same object* rather than six
 * features that drift apart. A notification becomes a state transition; an area
 * bulletin an aggregation of states.
 *
 * Pure, like `alert.ts`, `tiles.ts` and `layers.ts` before it: this module computes
 * and the renderers draw. It holds no words either — the levels are numbers and the
 * pages name them, the same way `tiles.ts` takes its labels as an argument.
 *
 * ## Three shapes
 *
 * Every indicator is one of three, and the shape decides how its course is built
 * rather than what it carries:
 *
 *  - **momentary** — the value at an instant: Delta T, THI, suction
 *  - **accumulating** — a running sum that only goes up: T-sum, DIV, degree days
 *  - **period** — a stretch that is open or closed: Smith, leaf wetness, spray window
 *
 * ## The four honesty rules, in the types
 *
 * The rules are not documentation here, they are fields, because a rule that lives in
 * a comment gets forgotten by the third renderer:
 *
 *  1. **Horizon** — `horizon` is the last moment the indicator claims anything about.
 *     A spray window on day 9 is not shown because there is nothing to show.
 *  2. **One certainty class** — `high | medium | low`, no decimals. The number itself
 *     is add-on territory.
 *  3. **Past solid, future dashed** — every point carries `observed`, so a chart can
 *     never accidentally draw a forecast as a measurement.
 *  4. **Origin visible** — `provenance` says what produced it, and where that is a
 *     proxy, which proxy.
 *
 * ## Why suction is the first one built, and not wind
 *
 * Wind was the obvious first indicator: the 18 km/h limit is law, and every location
 * has wind. But its threshold is a number this app would be choosing for itself, and
 * so would Delta T's, and so would every other one on the list. Suction is the only
 * quantity that arrives with its thresholds already attached — four of them, per
 * field, computed from that field's soil and crop, sitting in `/soilstations/` today,
 * alongside a state the API has already frozen per measurement.
 *
 * So the shape below gets tested against real thresholds on real fields before a
 * single self-chosen boundary enters the code. Get the threshold line right here and
 * the 18 km/h line on wind is free.
 */
import {
  isDormant, statusFromTension,
  type Placement, type SoilStatus, type SoilThresholds,
} from './soil';
// The measurement shape belongs to the source layer, as `Measurement` does for the
// weather side — see `core/model/types`, which imports it the same way.
import type { SoilSample } from '../sources/agroexact';

/** Which of the three an indicator is — see the module comment. */
export type IndicatorShape = 'momentary' | 'accumulating' | 'period';

/**
 * Honesty rule 2: one class, three values, no decimals.
 *
 * `high` is what an instrument measured, `medium` a short forecast or a proxy, `low`
 * anything far enough out that it is a direction rather than a number. The quantified
 * version — a probability, a spread — is deliberately not here: that is the add-on.
 */
export type Certainty = 'high' | 'medium' | 'low';

/**
 * Honesty rule 4: where the value came from.
 *
 * `detail` names the instrument or the proxy — "gemeten op dit perceel, 30 cm", or
 * which substitute stood in. The page prints it; this module never invents it.
 */
export interface Provenance {
  kind: 'measured' | 'modelled' | 'mixed' | 'proxy' | 'partner';
  detail: string | null;
}

/**
 * One boundary, and the level a value at or above it sits in.
 *
 * At-or-above, not above: a reading exactly on the boundary has crossed it. The web
 * app's transition alerts already read it that way, and an alert that fires while the
 * app says everything is fine is the worst kind of disagreement.
 *
 * No label: the level is a number and the page names it, so that this module carries
 * no language and the same indicator can be drawn in two of them.
 */
export interface Threshold {
  at: number;
  /** The level entered at or above `at`. Levels rise with severity from 0. */
  level: number;
}

/** One point in an indicator's course. */
export interface IndicatorPoint {
  /** Local wall-clock key, as everything else in the app uses. */
  time: string;
  value: number | null;
  level: number | null;
  /** Honesty rule 3: measured, or forecast. Decides solid against dashed. */
  observed: boolean;
}

/** Where the indicator stands now, and what is holding it there. */
export interface IndicatorState {
  level: number;
  value: number | null;
  /** The threshold that binds — what makes "48 kPa, grens 45" a sentence rather than
   *  a number. Null at level 0, where nothing binds. */
  binding: Threshold | null;
  /** How much would settle it, where the indicator can say so. Suction can — it
   *  knows the refill room — and no other indicator on the list can. */
  amount: { min: number; max: number } | null;
}

/** A level change, behind or ahead. "Delta T passeert 10 om 11:20". */
export interface Transition {
  time: string;
  from: number;
  to: number;
  /** False where the change is a forecast rather than something that happened. */
  observed: boolean;
}

/** The object every surface draws. */
export interface Indicator {
  /** Stable per location and quantity, for React keys and for notification ids. */
  id: string;
  shape: IndicatorShape;
  /** Which quantity, so a page can pick a formatter. */
  quantity: string;
  thresholds: Threshold[];
  /** The highest level this indicator has, so a page knows how many lamps to draw. */
  levels: number;
  course: IndicatorPoint[];
  /** Null where the course has no usable value at all — a sensor that is out. */
  now: IndicatorState | null;
  /** The next level change ahead of now, or null if none is claimed. */
  next: Transition | null;
  certainty: Certainty;
  /** Honesty rule 1: the last moment this indicator claims anything about. Null
   *  means it claims nothing beyond now, which is the truth for a purely measured
   *  indicator and is very different from claiming everything. */
  horizon: string | null;
  provenance: Provenance;
}

/**
 * Which level a value sits in.
 *
 * Thresholds must be sorted by `at` and are treated as non-decreasing: two on the
 * same value collapse the level between them, which is a real configuration rather
 * than an error — a fifth of the soil sensors on the account are set up that way, with
 * no suboptimal band at all. The highest threshold at or below the value wins, so a
 * collapsed level is simply never occupied.
 */
export function levelAt(value: number | null, thresholds: readonly Threshold[]): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  let level = 0;
  for (const t of thresholds) {
    if (value >= t.at) level = t.level;
  }
  return level;
}

/** The threshold a value is being held at — the binding reason. Null at level 0. */
export function bindingThreshold(
  value: number | null,
  thresholds: readonly Threshold[]
): Threshold | null {
  const level = levelAt(value, thresholds);
  if (level == null || level === 0) return null;
  // The last threshold that is actually crossed: with a collapsed band, that is the
  // higher of the two sitting on the same value, which is the one that binds.
  let binding: Threshold | null = null;
  for (const t of thresholds) {
    if (value != null && value >= t.at) binding = t;
  }
  return binding;
}

/**
 * The first level change after `from`, if the course claims one.
 *
 * Reads the course as it stands rather than predicting anything: where the course is
 * measurement only, there is no change ahead and this is null — which is the honest
 * answer, not a missing feature. Once a forecast joins the same series the same
 * function starts answering "passes 45 at 11:20" without changing.
 *
 * Points with no level are skipped rather than counted as a change: a gap in a sensor
 * is not the field improving.
 */
export function nextTransition(
  course: readonly IndicatorPoint[],
  from: string
): Transition | null {
  let last: IndicatorPoint | null = null;
  for (const p of course) {
    if (p.level == null) continue;
    if (p.time <= from) { last = p; continue; }
    if (last?.level != null && p.level !== last.level) {
      return { time: p.time, from: last.level, to: p.level, observed: p.observed };
    }
    last = p;
  }
  return null;
}

/**
 * Certainty from what the course is made of.
 *
 * Measured throughout is `high` — an instrument reported it, there is nothing to be
 * uncertain about in the past. Anything ahead of now is at best `medium`, and beyond
 * two days it is `low`: that is the point at which the app is describing a direction
 * rather than a value, and rule 2 would rather say so than imply a precision the
 * forecast does not have.
 */
export function certaintyOf(course: readonly IndicatorPoint[], now: string): Certainty {
  const ahead = course.filter((p) => p.time > now && p.value != null);
  if (!ahead.length) return 'high';
  const last = ahead[ahead.length - 1]!;
  const days = (new Date(last.time).getTime() - new Date(now).getTime()) / 86_400_000;
  return Number.isFinite(days) && days > 2 ? 'low' : 'medium';
}

/**
 * Assemble an indicator from a course that is already in order.
 *
 * `now` is the key the caller considers the present; everything at or before it is the
 * state, everything after is what the horizon covers. The course is not sorted here —
 * the source layer already answers oldest first, and quietly reordering a series would
 * hide a source that did not.
 */
export function buildIndicator(input: {
  id: string;
  shape: IndicatorShape;
  quantity: string;
  thresholds: readonly Threshold[];
  course: readonly IndicatorPoint[];
  now: string;
  provenance: Provenance;
  amount?: { min: number; max: number } | null;
}): Indicator {
  const { course, thresholds, now } = input;

  // The last point that is not in the future and has something to say. A sensor that
  // dropped out an hour ago still has a state; it is simply an hour old.
  let latest: IndicatorPoint | null = null;
  for (const p of course) {
    if (p.time <= now && p.value != null) latest = p;
  }

  const ahead = course.filter((p) => p.time > now && p.value != null);
  const levels = thresholds.reduce((m, t) => Math.max(m, t.level), 0) + 1;

  return {
    id: input.id,
    shape: input.shape,
    quantity: input.quantity,
    thresholds: [...thresholds],
    levels,
    course: [...course],
    now: latest == null ? null : {
      level: latest.level ?? 0,
      value: latest.value,
      binding: bindingThreshold(latest.value, thresholds),
      amount: input.amount ?? null,
    },
    next: nextTransition(course, now),
    certainty: certaintyOf(course, now),
    // Rule 1: claim exactly as far as there is something to claim, and no further.
    horizon: ahead.length ? ahead[ahead.length - 1]!.time : null,
    provenance: input.provenance,
  };
}

// ── The first indicator: suction ────────────────────────────────────────────────

/** A placement's thresholds as the indicator layer's own shape. */
export function soilThresholdSteps(t: SoilThresholds): Threshold[] {
  return [
    { at: t.scarce, level: 1 },
    { at: t.irrigate, level: 2 },
    { at: t.critical, level: 3 },
  ];
}

/**
 * Suction in the root zone, as an indicator.
 *
 * The first client of the layer, and the one that proves the shape: every field on
 * `Indicator` is filled from something that already exists rather than from a number
 * this app picked.
 *
 * | field | where it comes from |
 * | --- | --- |
 * | thresholds | the placement's frozen `threshold_0_to_1 / 1_to_2 / 2_to_3` |
 * | state | `status_code`, frozen per measurement at ingest |
 * | course | the suction series from `/soil_aggregates/` |
 * | origin | measured in this field, at this depth — the strongest origin in the app |
 * | certainty | high for the past; a forecast is not in API v2 yet |
 * | horizon | null while the series is measurement only |
 *
 * **The stored status wins over a recomputed one.** `status_code` was computed at
 * ingest against the settings in force that day; recomputing last season's rows
 * against today's thresholds is precisely the retroactive rewrite the placement exists
 * to prevent. `statusFromTension` only fills in where a row carries no status.
 *
 * Returns null when the sensor is out of the ground — fourteen days without a
 * measurement, per `isDormant`. That is a state, not a fault: the soil blocks come
 * off the page, the location stays as an ordinary weather location, and nothing
 * reports that anything has broken. Also null without thresholds: an indicator whose
 * threshold nobody knows is a number, and the whole point of this layer is that it is
 * not that.
 */
export function waterTensionIndicator(
  samples: readonly SoilSample[],
  placement: Placement,
  /** The moment the page considers now, as the app's own local key. */
  nowKey: string,
  /** For the dormancy check, which is about wall-clock age rather than key order. */
  now: Date = new Date()
): Indicator | null {
  if (!samples.length) return null;

  const last = samples[samples.length - 1]!;
  if (isDormant(last.measTime, now)) return null;

  // The sample the state will be read from — the last one that is not in the future.
  // The amount has to come from that same sample rather than from the end of the
  // series, or the day a suction forecast joins it the badge will state a top-up
  // computed from tomorrow next to a reading from this morning.
  let current: SoilSample | null = null;
  for (const s of samples) {
    if (s.time <= nowKey) current = s;
  }

  const thresholds = soilThresholdSteps(placement.thresholds);

  const course: IndicatorPoint[] = samples.map((s) => ({
    time: s.time,
    value: s.tension,
    // The API's own status first: it was frozen against the settings of its own day.
    // Only where a row carries none does the placement's threshold set stand in.
    level: s.status ?? statusFromTension(s.tension, placement.thresholds),
    // Everything from these endpoints is a measurement. The suction forecast exists
    // in the web app but not in API v2, so there is nothing dashed to draw yet.
    observed: s.time <= nowKey,
  }));

  return buildIndicator({
    id: `soil:${placement.placementId}:tension`,
    shape: 'momentary',
    quantity: 'waterTension',
    thresholds,
    course,
    now: nowKey,
    amount: current ? refillAmount(current) : null,
    provenance: {
      kind: 'measured',
      // The origin line is not decoration: a suction reading cannot be read without
      // the crop, the soil and the depth, so it travels with the indicator.
      detail: [placement.crop, placement.soil, `${placement.depthCm} cm`]
        .filter(Boolean)
        .join(' · '),
    },
  });
}

/**
 * How much to top up, where the reading says both ends of it.
 *
 * "Vul 18–33 mm bij": the lower end brings the field out of scarcity, the upper end
 * fills the root zone. No other indicator on the list can say an amount at all, which
 * is what makes suction the strongest evidence for a badge that claims a decision.
 *
 * Only offered while there is a decision to support — from "irrigate now" upward. At
 * status 0 and 1 there is refill room too, but stating it would read as an
 * instruction to irrigate a field that does not need it.
 */
function refillAmount(s: SoilSample): { min: number; max: number } | null {
  if (s.status == null || s.status < 2) return null;
  if (s.refillMm == null) return null;
  const min = s.refillToScarceMm ?? s.refillMm;
  return { min: Math.min(min, s.refillMm), max: s.refillMm };
}

/** Re-exported so a page can name a level without importing the soil model too. */
export type { SoilStatus };
