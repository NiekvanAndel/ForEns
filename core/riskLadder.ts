/**
 * Certainty as a product: a chance instead of a value, and a rung to act on.
 *
 * The basis version answers "how cold will it get" with a number and one certainty
 * class. That is the honest minimum, and it leaves the hardest question of the season
 * unanswered: *early but uncertain*, or *certain but too late*. A grower covering
 * blossom cannot have both, and the app can at least tell them which one they are
 * choosing.
 *
 * So the add-on tier says "65% kans op nachtvorst" — counted over the members that
 * each said how cold it would get, never derived from a single run — and puts it on a
 * ladder with three rungs, each of which is a different action.
 *
 * ## One setting behind all of it
 *
 * `RiskAppetite`. Cautious moves the rungs down, patient moves them up, and nobody
 * has to know what a percentile is. The alternative was percentile controls, which
 * hands the modeller's problem to the grower.
 *
 * ## "Je kunt nu beslissen"
 *
 * A forecast at 92% and one at 8% are both *settled*: the decision can be made and
 * will not be improved by waiting. One at 45% is open, and saying so is more useful
 * than a number the reader has to interpret — it is the difference between a
 * probability and advice about a probability.
 *
 * ## What is deliberately not here
 *
 * The turn-around alert ("het is onzekerder geworden"), stability and calibration
 * against the station all need yesterday's forecast to compare today's against, and
 * nothing in this app stores one yet. That is step 8 of the plan, and inventing it
 * from the current run would be an unfalsifiable sentence. See the docs.
 *
 * Facts, not sentences, as everywhere else in `core/`.
 */
import { threshold } from './thresholds';
import type { EnsembleOutlook } from './sources/ensembleOutlook';
import type { RiskAppetite } from './prefs';

/**
 * The three rungs, as percentages.
 *
 * 30 is "know about it", 60 is "get ready", 85 is "act on it". Published nowhere —
 * these are the plan's own figures and are meant to be argued with, which is why they
 * are one table rather than scattered through the rules.
 */
export const LADDER = {
  watch: threshold('risk.watch'),
  prepare: threshold('risk.prepare'),
  act: threshold('risk.act'),
} as const;

export type Rung = keyof typeof LADDER;

/** How far the ladder moves for a reader who is careful, or who would rather wait. */
export const APPETITE_SHIFT: Record<RiskAppetite, number> = {
  cautious: -threshold('risk.appetiteShift'),
  normal: 0,
  patient: threshold('risk.appetiteShift'),
};

/** Above this the forecast has committed; below the mirror of it, so has it. */
export const SETTLED_HIGH = threshold('risk.settledHigh');
export const SETTLED_LOW = threshold('risk.settledLow');

/** Whether the decision can be made now, or is still worth sleeping on. */
export type Decision = 'settled-yes' | 'settled-no' | 'open';

/**
 * Which rung a chance reaches for this reader, or null when it reaches none.
 *
 * Null rather than a fourth rung called "niets": a widget that draws a row per
 * location would otherwise fill with lines saying nothing is likely, which is exactly
 * the noise the tier is supposed to remove.
 */
export function rungFor(percent: number | null, appetite: RiskAppetite): Rung | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  const shift = APPETITE_SHIFT[appetite];
  const at = (rung: Rung) => Math.min(95, Math.max(5, LADDER[rung] + shift));
  if (percent >= at('act')) return 'act';
  if (percent >= at('prepare')) return 'prepare';
  if (percent >= at('watch')) return 'watch';
  return null;
}

/** Whether waiting would improve the answer. Independent of appetite: a settled
 *  forecast is settled for the careful reader and the patient one alike. */
export function decisionFor(percent: number | null): Decision | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  if (percent >= SETTLED_HIGH) return 'settled-yes';
  if (percent <= SETTLED_LOW) return 'settled-no';
  return 'open';
}

/** What a statement is about. Both are counted over members, never modelled. */
export type RiskKind = 'frost' | 'rain';

export interface RiskStatement {
  kind: RiskKind;
  /** The location's slot and name, for the row and for opening it. */
  index: number;
  name: string;
  /** `YYYY-MM-DD`, the day the chance is about. */
  date: string;
  /** 0–100, counted over the members. */
  percent: number;
  rung: Rung;
  decision: Decision;
  /**
   * The middle member's own figure, so the line can carry a value beside the chance —
   * "65% kans, mediaan −1,2 °C". A probability with no magnitude behind it is a
   * decision without a size.
   */
  median: number | null;
  /** How many members were counted. Honesty rule 4: a chance over eight members and
   *  one over fifty-one are not the same claim. */
  members: number;
}

export interface RiskInput {
  index: number;
  name: string;
  ensemble: EnsembleOutlook | null;
}

/** Rain over a day that counts as a day's work lost, mm — the figure `wetShare`
 *  is already counted at is a trace, which is the wrong question here. */
export const RAIN_DECISION_MM = 0.2;

/**
 * Every chance worth acting on, most pressing first.
 *
 * Only what reaches a rung for this reader, and only frost in the season it can
 * happen: a widget that lists "3% kans op vorst" for nine fields in July is a widget
 * that gets switched off in July and never switched on again.
 *
 * Frost before rain at the same rung, because frost is the one a night's work can
 * still prevent.
 */
export function riskStatements(
  locations: readonly RiskInput[],
  appetite: RiskAppetite
): RiskStatement[] {
  const out: RiskStatement[] = [];

  for (const loc of locations) {
    for (const day of loc.ensemble ?? []) {
      const frostRung = rungFor(day.frostShare, appetite);
      if (day.frostShare != null && frostRung) {
        out.push({
          kind: 'frost',
          index: loc.index,
          name: loc.name,
          date: day.date,
          percent: day.frostShare,
          rung: frostRung,
          decision: decisionFor(day.frostShare) ?? 'open',
          median: day.minP50,
          members: day.members,
        });
      }

      const rainRung = rungFor(day.wetShare, appetite);
      if (rainRung) {
        out.push({
          kind: 'rain',
          index: loc.index,
          name: loc.name,
          date: day.date,
          percent: day.wetShare,
          rung: rainRung,
          decision: decisionFor(day.wetShare) ?? 'open',
          median: day.p50,
          members: day.members,
        });
      }
    }
  }

  const rank: Record<Rung, number> = { act: 0, prepare: 1, watch: 2 };
  return out.sort((a, b) =>
    rank[a.rung] - rank[b.rung]
    || (a.kind === b.kind ? 0 : a.kind === 'frost' ? -1 : 1)
    || a.date.localeCompare(b.date)
    || b.percent - a.percent);
}
