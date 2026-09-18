/**
 * The coming days as windows rather than as weather — one row per location, one bar
 * per day, so the days can be compared across the farm at a glance.
 *
 * The bar for *one* location is the basis version's job. Putting three of them under
 * each other so a grower can see that Thursday works everywhere and Friday only in
 * the north is the add-on: it is a statement about the farm, and no single field's
 * page can make it.
 *
 * ## Saturation is certainty
 *
 * Each day carries how much the members agree about it, so the page can draw a
 * confident day solid and an uncertain one pale. That is honesty rule 2 given a
 * visual form: the reader sees a window fade as it moves further out, instead of
 * reading the same flat green block on Saturday that Wednesday got.
 *
 * ## Whole hours, whole days, the location's own clock
 *
 * The hours come from the short outlook, which is already trimmed to the hour the
 * reader is in *at that location*. So today's bar is the rest of today, not a day
 * that started at midnight — which is what a grower means by "vandaag" at four in the
 * afternoon.
 *
 * Pure and word-free, like every kernel here.
 */
import { firstWorkRun, workWindow, type OutlookHour, type WorkWindowLimits } from './overviewData';
import { dayAgreement, type Agreement, type EnsembleOutlook } from './sources/ensembleOutlook';

export interface DayWindow {
  /** `YYYY-MM-DD`, local. */
  date: string;
  /** How many of the day's hours are workable, and how many it has at all. Today is
   *  short because it has already started; the bar says so by being short. */
  workable: number;
  hours: number;
  /** The longest run, which is what a day is planned around rather than a count of
   *  scattered green hours. Null where the day has none. */
  run: { from: string; hours: number } | null;
  /** How much the members agree about this day. Null without the ensemble, and then
   *  the page draws the bar at full strength rather than inventing a doubt. */
  agreement: Agreement | null;
}

/** How many days to compare. The outlook carries three; a fourth would be a guess. */
export const COMPARE_DAYS = 3;

/**
 * The next days of one location, as windows.
 *
 * `limits` is passed straight through to `workWindow`, so the verdicts here and the
 * hour strip on the basis page cannot disagree about the same hour.
 */
export function dayWindows(
  hours: readonly OutlookHour[],
  ensemble: EnsembleOutlook | null,
  limits?: WorkWindowLimits
): DayWindow[] {
  if (!hours.length) return [];

  const byDate = new Map<string, OutlookHour[]>();
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const at = byDate.get(date);
    if (at) at.push(h);
    else byDate.set(date, [h]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, COMPARE_DAYS)
    .map(([date, dayHours]) => {
      // The whole day, not the first 24 of the series: `workWindow` counts from the
      // start of what it is given, and each day is given its own hours.
      const window = workWindow(dayHours, limits, dayHours.length);
      const ens = ensemble?.find((d) => d.date === date) ?? null;
      return {
        date,
        workable: window.filter((h) => h.verdict === 'yes').length,
        hours: window.length,
        run: firstWorkRun(window),
        agreement: ens ? dayAgreement(ens) : null,
      };
    });
}

/**
 * The share of a day that can be worked, 0–1.
 *
 * Its own function because a bar drawn from `workable / hours` would make today's
 * three remaining hours look like a bad day rather than a short one. A caller that
 * wants the day's *quality* asks for this; one that wants its *length* reads `hours`.
 */
export function workableShare(day: DayWindow): number {
  return day.hours ? day.workable / day.hours : 0;
}

/** How solid to draw a day, 0–1. An unknown agreement is drawn at full strength:
 *  the app has no reason to doubt it, and fading it would be inventing one. */
export function certaintyOpacity(agreement: Agreement | null): number {
  switch (agreement) {
    case 'disagree': return 0.4;
    case 'mixed': return 0.7;
    default: return 1;
  }
}
