/**
 * What can only be said once you put the locations beside each other.
 *
 * This is the whole product line of the add-on tier, in one module: not "what is the
 * weather at this field" — the basis version answers that, per field, all day — but
 * the four things that do not exist until a grower has more than one field.
 *
 *  - **The joint window.** Every location workable at the same time, which is what
 *    decides whether a contractor comes out for one day or two.
 *  - **The order.** Which field first, decided by which window shuts first. Doing the
 *    fields in the order they appear in a list is how the last one gets rained off.
 *  - **The spread.** "22 mm op Heesch, 1,4 mm op Rosmalen" is a sentence about the
 *    farm that neither field's own page can produce.
 *  - **The de-duplication.** Five fields shut on wind is one line, not five.
 *
 * ## Facts, not sentences
 *
 * Same rule as `overviewBrief` and `overviewAdvice`, learned the same way: a module
 * outside `core/i18n` that returns Dutch is a module whose output stays Dutch. Each
 * conclusion names itself and carries what fills its blanks, in canonical units.
 *
 * ## Every rule has a bar it stays under
 *
 * A conclusion that fires every morning is a line the reader learns to skip. The
 * spread stays quiet on a farm where the rain was the same everywhere, which is most
 * farms most days; the de-duplication needs at least two fields saying the same thing,
 * because on one field it is the field's own line; and the order needs two windows to
 * put in an order. The bars are gathered at the top to be argued with.
 */
import { firstWorkRun, workWindow, type OverviewRow, type WorkHour } from './overviewData';
import { threshold } from './thresholds';
import type { LocationAdvice } from './overviewFieldAdvice';
import type { AdviceFactor } from './model/fieldAdvice';

/** How far apart the wettest and driest field must be before it is worth a line. */
export const SPREAD_MM = threshold('area.spreadMm');
/** And by what factor, so two heavy fields five millimetres apart stay quiet. */
export const SPREAD_RATIO = threshold('area.spreadRatio');
/** A run shorter than this is not a window anybody plans a day around. */
export const USEFUL_RUN_H = threshold('area.usefulRun');
/** Two fields with the same thing wrong is a pattern; one is a field. */
export const SHARED_MIN = threshold('area.sharedMin');

export type AreaKind =
  /** Every location workable at once, from `from` for `hours`. */
  | 'commonWindow'
  /** No hour works everywhere; the best the day manages is `count` of `total`. */
  | 'noCommonWindow'
  /** Which field to start on, because its window shuts first. */
  | 'order'
  /** How far apart the farm's rainfall was. */
  | 'spread'
  /** The same boundary shutting several fields — said once. */
  | 'shared';

export interface AreaConclusion {
  kind: AreaKind;
  /** The location a conclusion is about, or the first of two. */
  place?: string;
  /** Its slot, so the line can open it. */
  index?: number;
  /** The other end of a pair — the driest field, the second in the order. */
  place2?: string;
  index2?: number;
  /** Local wall-clock stamps, for a window. */
  from?: string;
  to?: string;
  hours?: number;
  /** How many locations, out of how many that could answer. */
  count?: number;
  total?: number;
  /** Millimetres, canonical, for the spread. */
  mm?: number;
  mm2?: number;
  /** Which boundary is doing the shutting, for the de-duplicated line. */
  factor?: AdviceFactor;
}

/** One location's workable hours, keyed by time so locations can be intersected. */
interface Windowed {
  index: number;
  name: string;
  window: WorkHour[];
}

function windowed(rows: readonly OverviewRow[]): Windowed[] {
  return rows
    .map((row) => ({ index: row.index, name: row.name, window: workWindow(row.hours) }))
    .filter((w) => w.window.length > 0);
}

/**
 * The next stretch in which every location can be worked at once.
 *
 * Intersected by the hour, over the hours they share: a location whose forecast is
 * shorter than the rest simply stops contributing after its last hour rather than
 * being counted as workable through it. A run under two hours is not returned — it is
 * true and useless, and a joint window nobody can get to a field inside is worse than
 * none, because somebody will try.
 *
 * Where no hour works everywhere, the answer is the honest one: how many of them the
 * best hour manages. That is the "de drie in Zeeland vallen af op wind" line, and it
 * is a different sentence from "there is no window".
 */
export function jointWindow(rows: readonly OverviewRow[]): AreaConclusion | null {
  const all = windowed(rows);
  if (all.length < 2) return null;

  // The hours every location has an opinion about, in order.
  const times = all[0]!.window.map((h) => h.time)
    .filter((t) => all.every((w) => w.window.some((h) => h.time === t)));
  if (!times.length) return null;

  const workableAt = (time: string) =>
    all.filter((w) => w.window.find((h) => h.time === time)?.verdict === 'yes').length;

  // A synthetic window over the farm, so the same `firstWorkRun` that finds a run at
  // one location finds it here. Only `yes` is read; the verdict on an hour that is
  // not workable everywhere is a placeholder and never shown — which field it was and
  // why is the field's own line.
  const joint: WorkHour[] = times.map((time) => ({
    time,
    verdict: workableAt(time) === all.length ? 'yes' : 'unknown',
  }));

  const run = firstWorkRun(joint);
  if (run && run.hours >= USEFUL_RUN_H) {
    const at = times.indexOf(run.from);
    return {
      kind: 'commonWindow',
      from: run.from,
      to: times[at + run.hours] ?? times[times.length - 1],
      hours: run.hours,
      count: all.length,
      total: all.length,
    };
  }

  // Nothing joint. What the best hour of the day manages is the useful answer.
  const best = times.reduce((most, t) => Math.max(most, workableAt(t)), 0);
  return { kind: 'noCommonWindow', count: best, total: all.length };
}

/**
 * Which field to start on: the one whose window shuts first.
 *
 * Only among the locations that are workable *now* — an order over fields that
 * nobody can get on to yet is a plan for a day that has not started. Two at least,
 * because ordering one field is not an order.
 *
 * The second name is carried so the line can say what follows, which is the
 * difference between an instruction and a plan.
 */
export function workOrder(rows: readonly OverviewRow[]): AreaConclusion | null {
  const open = windowed(rows)
    .map((w) => {
      const run = firstWorkRun(w.window);
      // Workable now: the run starts at the first hour the forecast has.
      if (!run || run.from !== w.window[0]?.time) return null;
      return { ...w, closesIn: run.hours };
    })
    .filter((w): w is Windowed & { closesIn: number } => w != null)
    .sort((a, b) => a.closesIn - b.closesIn);

  if (open.length < 2) return null;
  const first = open[0]!;
  const second = open[1]!;
  // Two fields that shut at the same hour are not an order, they are a coincidence.
  if (first.closesIn === second.closesIn) return null;

  return {
    kind: 'order',
    place: first.name,
    index: first.index,
    place2: second.name,
    index2: second.index,
    hours: first.closesIn,
    to: first.window[first.closesIn]?.time,
    count: open.length,
  };
}

/**
 * How far apart the farm's rainfall was over the last day.
 *
 * Both a gap and a ratio, because either alone fires on the wrong mornings: a gap
 * alone calls 30 mm and 19 mm a spread, and a ratio alone calls 0,3 mm and 0,1 mm
 * one. It takes both to mean what a grower means by "it missed us".
 */
export function rainSpread(rows: readonly OverviewRow[]): AreaConclusion | null {
  const with24 = rows.filter((r) => r.rain24 != null) as (OverviewRow & { rain24: number })[];
  if (with24.length < 2) return null;

  const sorted = [...with24].sort((a, b) => b.rain24 - a.rain24);
  const wet = sorted[0]!;
  const dry = sorted[sorted.length - 1]!;
  const gap = wet.rain24 - dry.rain24;
  if (gap < SPREAD_MM) return null;
  if (wet.rain24 < dry.rain24 * SPREAD_RATIO) return null;

  return {
    kind: 'spread',
    place: wet.name, index: wet.index, mm: wet.rain24,
    place2: dry.name, index2: dry.index, mm2: dry.rain24,
    total: with24.length,
  };
}

/**
 * The same boundary shutting several fields, said once.
 *
 * The de-duplication the plan asks for, and the clearest thing the tier does to a
 * long list: five fields each saying "niet spuitbaar — wind" is one fact about the
 * farm and five lines about fields. Only the shut ones count — a boundary that merely
 * wants watching at five fields is not five fields lost.
 *
 * The example name is carried, not all of them: a line that names five places is the
 * list it was meant to replace.
 */
export function sharedBoundaries(advice: readonly LocationAdvice[]): AreaConclusion[] {
  const byFactor = new Map<AdviceFactor, { count: number; place: string; index: number }>();

  for (const a of advice) {
    // One field, one vote per boundary: a location whose spray window is shut and
    // whose frost is coming counts once in each, never twice in either.
    const seen = new Set<AdviceFactor>();
    for (const r of a.readings) {
      if (r.level < 2 || seen.has(r.factor)) continue;
      seen.add(r.factor);
      const at = byFactor.get(r.factor);
      if (at) at.count++;
      else byFactor.set(r.factor, { count: 1, place: a.name, index: a.index });
    }
  }

  return [...byFactor.entries()]
    .filter(([, v]) => v.count >= SHARED_MIN)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([factor, v]) => ({
      kind: 'shared' as const,
      factor,
      count: v.count,
      total: advice.length,
      place: v.place,
      index: v.index,
    }));
}

/**
 * Everything the area has to say, in the order a grower reads it.
 *
 * What is shut first, then when the farm can be worked together, then where to start,
 * then how unevenly it rained. That order is the morning: the obstacles decide the
 * plan, and the plan decides the sequence.
 */
export function areaConclusions(
  rows: readonly OverviewRow[],
  advice: readonly LocationAdvice[]
): AreaConclusion[] {
  if (rows.length < 2) return [];

  const out: AreaConclusion[] = [...sharedBoundaries(advice)];
  const joint = jointWindow(rows);
  if (joint) out.push(joint);
  const order = workOrder(rows);
  if (order) out.push(order);
  const spread = rainSpread(rows);
  if (spread) out.push(spread);

  return out;
}
