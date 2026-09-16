/**
 * Which fields need attention today, and why.
 *
 * The widgets above this one answer "what is the weather". This answers the question
 * behind them — *so what do I do* — and it is the only thing on the page that ranks
 * locations by how much they should worry somebody rather than by a reading.
 *
 * ## A fixed set of rules, deliberately
 *
 * No scoring, no weighting, no model. Each rule is a sentence a grower would say, and
 * it either applies to a location or it does not: eighteen millimetres fell, there is
 * no workable hour left today, it will freeze tonight. A rule that fires is a fact
 * with a number in it, which is checkable — and a rule that fires when it should not
 * can be found and changed, which a score cannot.
 *
 * The thresholds are first drafts and are meant to be argued with. They are gathered
 * at the top rather than scattered through the rules so that arguing with them is one
 * edit; see DEFERRED, where revisiting the whole set is written down as work.
 *
 * ## Facts, not sentences
 *
 * Each rule returns what it found — the location, the kind, the figures — and the
 * widget words it. The alert block learned this the hard way: sentences built in a
 * module outside `core/i18n` are sentences that stay Dutch for ever.
 */
import { firstWorkRun, workWindow, type OverviewRow, type WorkWindowLimits } from './overviewData';
import { DEFAULT_WORK_LIMITS } from './overviewData';

/**
 * The numbers every rule is drawn against.
 *
 * First drafts, all of them. The rainfall figures are the ones a Dutch arable grower
 * would recognise — fifteen millimetres is "the land is shut", ten on the way is
 * "finish what you are doing" — and the rest follow from the work window.
 */
export interface AdviceLimits extends WorkWindowLimits {
  /** Millimetres over the last 24 hours that shut the land. */
  soakedMm: number;
  /** Millimetres coming in the next 24 that are worth hurrying for. */
  rainAheadMm: number;
  /** A run shorter than this is not a window anybody plans around. */
  usefulRunHours: number;
  /** At or below this tonight is a frost worth naming. */
  frostC: number;
}

export const DEFAULT_ADVICE_LIMITS: AdviceLimits = {
  ...DEFAULT_WORK_LIMITS,
  soakedMm: 15,
  rainAheadMm: 10,
  usefulRunHours: 3,
  frostC: 0,
};

/**
 * What a rule found. `kind` picks the sentence; `values` fills its blanks.
 *
 * `urgency` is what orders the list and nothing else — it is not shown, and it is not
 * a score anybody should read. Attention before opportunity, and within attention the
 * thing that is already true before the thing that is coming.
 */
export type AdviceKind =
  /** So much has fallen that the land is shut. */
  | 'soaked'
  /** Rain on the way, with workable hours before it — go now. */
  | 'raceTheRain'
  /** Nothing workable in the next 24 hours at all. */
  | 'noWindow'
  /** It will freeze tonight. */
  | 'frost'
  /** Workable now, for long enough to be worth starting. */
  | 'windowNow'
  /** Workable later today, for long enough to plan. */
  | 'windowLater';

export interface Advice {
  /** The saved location's slot, for opening it. */
  index: number;
  name: string;
  kind: AdviceKind;
  /** Millimetres, hours, degrees — whichever the sentence needs. Canonical units. */
  mm?: number;
  hours?: number;
  /** `HH:MM`, where the sentence names a time. */
  at?: string;
  tempC?: number;
}

/** Lower sorts first. Attention before opportunity; what is already true before what
 *  is coming. */
const URGENCY: Record<AdviceKind, number> = {
  soaked: 0,
  noWindow: 1,
  raceTheRain: 2,
  frost: 3,
  windowNow: 4,
  windowLater: 5,
};

/**
 * At most one line per location: the most pressing thing about it.
 *
 * One, because a list with two lines about the same field is a list somebody stops
 * reading — and because the rules are ordered by how much they should change what
 * happens next, so the first that fires is the one worth the space.
 */
export function adviceForRow(
  row: OverviewRow,
  limits: AdviceLimits = DEFAULT_ADVICE_LIMITS
): Advice | null {
  const base = { index: row.index, name: row.name };
  const window = workWindow(row.hours, limits);
  const run = firstWorkRun(window);
  const workableNow = window[0]?.verdict === 'yes';

  // Already shut. Nothing about the forecast changes what to do today.
  if (row.rain24 != null && row.rain24 >= limits.soakedMm) {
    return { ...base, kind: 'soaked', mm: row.rain24 };
  }

  // Nothing to plan at all — worth saying before anything about when.
  if (window.length && run == null) {
    return { ...base, kind: 'noWindow' };
  }

  // Rain on the way with time before it: the one piece of advice on this page that
  // is genuinely time-critical, so it outranks a frost tonight.
  if (row.rainNext24 != null && row.rainNext24 >= limits.rainAheadMm) {
    const untilWet = hoursUntilWet(row, limits);
    if (untilWet != null && untilWet >= limits.usefulRunHours) {
      return { ...base, kind: 'raceTheRain', mm: row.rainNext24, hours: untilWet };
    }
  }

  if (row.tonightMinC != null && row.tonightMinC <= limits.frostC) {
    return { ...base, kind: 'frost', tempC: row.tonightMinC };
  }

  if (run && run.hours >= limits.usefulRunHours) {
    return workableNow
      ? { ...base, kind: 'windowNow', hours: run.hours }
      : { ...base, kind: 'windowLater', hours: run.hours, at: run.from.slice(11, 16) };
  }

  return null;
}

/** How many hours from now until the first wet one. Null where none is forecast. */
function hoursUntilWet(row: OverviewRow, limits: AdviceLimits): number | null {
  const at = row.hours.findIndex((h) => (h.precip ?? 0) >= limits.wetMm);
  return at < 0 ? null : at;
}

/**
 * The page's advice, most pressing first.
 *
 * Capped, because advice that runs to eight lines is a list of the weather again. The
 * cap is on the *list* and not on the rules: every location is still examined, so the
 * four that surface are the four that matter and not the first four in the saved
 * order.
 */
export function adviceFor(
  rows: readonly OverviewRow[],
  limits: AdviceLimits = DEFAULT_ADVICE_LIMITS,
  limit = 4
): Advice[] {
  return rows
    .map((row) => adviceForRow(row, limits))
    .filter((a): a is Advice => a !== null)
    .sort((a, b) => URGENCY[a.kind] - URGENCY[b.kind])
    .slice(0, limit);
}

/** Whether a piece of advice is a warning or an opening — the widget colours them
 *  differently, and a grower reads the two in different moods. */
export function isOpportunity(kind: AdviceKind): boolean {
  return kind === 'windowNow' || kind === 'windowLater';
}
