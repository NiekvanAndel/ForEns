/**
 * How much the 51 members disagree about each saved location's coming days.
 *
 * The overview's other fetches are deterministic: one run's answer, drawn as a
 * number. That is the right shape for "what fell" and a quietly dishonest one for
 * "what is coming" — "4 mm on Thursday" from a run the members are split down the
 * middle on is a different sentence from the same figure they all agree with, and a
 * grower deciding whether to travel deserves to be told which.
 *
 * So this is the ensemble's daily rainfall per location: where the members land, and
 * how many of them are wet at all. Its own source because it is its own cost — one
 * request per saved location, only fetched for the widget that reads it.
 *
 * Rainfall and the night's minimum. Wind has a spread too and is left out: nothing
 * draws it, and a member column costs response size on every saved location.
 *
 * The minimum is here for one sentence the add-on tier makes — "65% kans op
 * nachtvorst". A probability of frost has to be counted over members that each said
 * how cold it would get; deriving it from one deterministic minimum and a hand-picked
 * spread would be a number with nothing behind it.
 */
import { tryFetchJson } from './http';
import { memberSeries } from './ensembleHourly';
import { percentile, probAtLeast, round1 } from '../model/stats';
import type { FetchOptions } from './http';
import type { Coords } from './openMeteo';
import type { DailyBlock } from '../model/types';

const ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/** Three days, to match the deterministic outlook beside it. */
export const ENSEMBLE_OUTLOOK_DAYS = 3;

/** Millimetres over a day that count as "this member is wet". The same threshold the
 *  nowcast uses for an hour being wet, applied to a total. */
const WET_MM = 0.2;

/** Air frost, the same boundary `fieldAdvice` draws it at. */
const FROST_C = 0;

export interface EnsembleDay {
  /** `YYYY-MM-DD`, local. */
  date: string;
  /** Where the members put the day's rainfall. */
  p10: number;
  p50: number;
  p90: number;
  /** Share of members with measurable rain, 0–100 — the "will it rain at all"
   *  question, which is separate from "how much" and often the one being asked. */
  wetShare: number;
  members: number;
  /**
   * Where the members put the night's lowest temperature, °C, and how many of them
   * take it below freezing.
   *
   * Null where the response carried no minimum — an older cached run, or a location
   * the field was not asked for. Null is not "no frost": the escalation ladder says
   * nothing at all rather than reassuring somebody on the strength of a gap.
   */
  minP10: number | null;
  minP50: number | null;
  minP90: number | null;
  /** Share of members at or below 0 °C, 0–100. Null with no minimum to count. */
  frostShare: number | null;
}

export type EnsembleOutlook = EnsembleDay[];

export async function fetchEnsembleOutlook(
  coords: Coords,
  opts: FetchOptions = {}
): Promise<EnsembleOutlook | null> {
  const url =
    `${ENSEMBLE}?latitude=${coords.lat}&longitude=${coords.lon}&timezone=auto` +
    `&daily=precipitation_sum,temperature_2m_min` +
    `&models=ecmwf_ifs025&forecast_days=${ENSEMBLE_OUTLOOK_DAYS}`;
  return parseEnsembleOutlook(await tryFetchJson<{ daily?: DailyBlock }>(url, 'ENS-dag', opts));
}

/** Split out from the fetch so the parsing can be tested without a network. */
export function parseEnsembleOutlook(json: { daily?: DailyBlock } | null): EnsembleOutlook | null {
  const daily = json?.daily;
  const times = daily?.time;
  if (!daily || !times?.length) return null;

  const members = memberSeries(daily as Record<string, unknown>, 'precipitation_sum');
  const mins = memberSeries(daily as Record<string, unknown>, 'temperature_2m_min');
  // One column is the deterministic run passed through, not an ensemble — and a
  // spread of one member is a point pretending to be a range.
  if (members.length < 2) return null;

  return times.map((date, i) => {
    // A missing day in a rainfall member is no rain, which is the same reading
    // `parseDayEnsemble` takes of a missing hour.
    const values = members.map((m) => m[i] ?? 0);
    // A gap in a temperature member is unknown rather than zero — counting it as
    // zero would drag every spread toward freezing and invent frost out of a hole in
    // the data. So the minimums are filtered, and a day with none says null.
    const lows = mins
      .map((m) => m[i])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    return {
      date,
      p10: round1(percentile(values, 10) ?? 0),
      p50: round1(percentile(values, 50) ?? 0),
      p90: round1(percentile(values, 90) ?? 0),
      wetShare: Math.round(probAtLeast(values, WET_MM)),
      members: values.length,
      minP10: lows.length ? round1(percentile(lows, 10) as number) : null,
      minP50: lows.length ? round1(percentile(lows, 50) as number) : null,
      minP90: lows.length ? round1(percentile(lows, 90) as number) : null,
      // At or below zero: a member that lands exactly on the freezing point has
      // reached it, which is how every other boundary in this app is read.
      frostShare: lows.length
        ? Math.round((lows.filter((v) => v <= FROST_C).length / lows.length) * 100)
        : null,
    };
  });
}

/**
 * How much the members are of one mind about a day, as a word.
 *
 * The gap between p10 and p90, read against how much rain there is: five millimetres
 * of disagreement means something very different under a dry forecast than under a
 * wet one. So it is a ratio with a floor, not a threshold in millimetres — a floor
 * because otherwise every dry day with a trace of drizzle reads as a violent
 * disagreement.
 */
export type Agreement = 'agree' | 'mixed' | 'disagree';

export function dayAgreement(day: EnsembleDay): Agreement {
  const band = day.p90 - day.p10;
  if (band <= 1) return 'agree';
  const relative = band / Math.max(2, day.p50);
  if (relative <= 1) return 'mixed';
  return 'disagree';
}
