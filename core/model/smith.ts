/**
 * The Smith period: when the weather has been right for potato blight.
 *
 * The published rule, and this app implements it and nothing more: **two consecutive
 * days on each of which the minimum temperature is at least 10 °C and there are at
 * least eleven hours at 90% relative humidity or above.** Two such days in a row are a
 * Smith period; one day that qualifies with a qualifying day before it extends one.
 *
 * ## It signals, it does not prescribe
 *
 * A Smith period says the weather has been suitable for infection. It does not say
 * there is blight in the field, and this app must never word it as though it did — the
 * plan's rule is "ga kijken", never "ga spuiten", and the reason is not squeamishness:
 * the model is about weather, the decision is about a crop, a variety, a spray
 * interval and a grower's own tolerance, and none of those are in here.
 *
 * ## Why it is the first model built
 *
 * Because it is the plainest use of the kernel — count hours, check a floor, look for
 * two in a row — so it tests `humidHours` against something published rather than
 * against a shape this app invented. Cercospora's DIV weighs its hours by temperature
 * and 10-10-48 waits on a leaf-wetness sensor the API does not serve; both read the
 * same runs once that is settled.
 *
 * ## An incomplete day is not a quiet day
 *
 * A day the station only half reported is skipped, and it **breaks** the run rather
 * than continuing it. Counting eleven humid hours out of nineteen would answer a
 * different question from the one the model claims, and treating a gap as "no
 * infection risk" would clear a field on the strength of missing data — which is the
 * failure mode that matters, because the two happen together: a station drops readings
 * in exactly the weather that produces them.
 */
import { humidDays, type HumidHour, type HumidSource } from './humidHours';

/** Smith's own numbers. Named so a reader can check them against the literature. */
export const SMITH = {
  /** Relative humidity, %. At or above. */
  humidity: 90,
  /** Hours per day at or above it. */
  hoursPerDay: 11,
  /** The day's minimum temperature, °C. At or above. */
  minTemp: 10,
  /** Consecutive qualifying days that make a period. */
  days: 2,
} as const;

/** One day, and whether the weather in it met both of Smith's conditions. */
export interface SmithDay {
  date: string;
  /** Hours at or above 90% RH. */
  humidHours: number;
  /** The day's coldest hour, °C. */
  minTemp: number | null;
  /** Both conditions met, on a day that is complete enough to ask. */
  qualifies: boolean;
  /** False where the day is missing hours — then `qualifies` is false too, and for a
   *  different reason than "the weather was fine". A page that says so is being
   *  honest; one that shows a quiet day is not. */
  complete: boolean;
}

/** A stretch of consecutive qualifying days. Two or more is a Smith period. */
export interface SmithPeriod {
  from: string;
  to: string;
  days: number;
  /** True once it has reached `SMITH.days`. A single qualifying day is carried too,
   *  because a grower watching one build wants to see the first day, not only the
   *  moment it becomes a period. */
  complete: boolean;
}

export interface SmithInput {
  hours: readonly HumidHour[];
  /** Which height the humidity was measured at — carried through to the result, since
   *  a period found at 10 cm is a different claim from one found at 1.50 m. */
  source: HumidSource;
}

export interface SmithResult {
  days: SmithDay[];
  /** Every run of qualifying days, oldest first, complete ones and the single days
   *  that could still become one. */
  periods: SmithPeriod[];
  /** True where a period is running on the most recent day the hours cover. */
  active: boolean;
  source: HumidSource;
}

/**
 * Smith over a window of hours.
 *
 * The hours are read in the order given, and days are taken from their local keys, so
 * the day boundary is the location's own rather than the device's — the same rule
 * everything else in this app follows.
 */
export function smith({ hours, source }: SmithInput): SmithResult {
  const days: SmithDay[] = humidDays(hours, SMITH.humidity).map((d) => ({
    date: d.date,
    humidHours: d.hours,
    minTemp: d.minTemp,
    complete: d.complete,
    qualifies: d.complete
      && d.hours >= SMITH.hoursPerDay
      && d.minTemp != null
      && d.minTemp >= SMITH.minTemp,
  }));

  const periods: SmithPeriod[] = [];
  for (const day of days) {
    const last = periods[periods.length - 1];
    // Consecutive by the calendar, not by position in the list: a gap in the data
    // leaves a day out entirely, and two qualifying days either side of a missing one
    // are not two days in a row.
    const follows = last != null && nextDay(last.to) === day.date;
    if (!day.qualifies) continue;
    if (follows && last) {
      last.to = day.date;
      last.days += 1;
      last.complete = last.days >= SMITH.days;
    } else {
      periods.push({ from: day.date, to: day.date, days: 1, complete: SMITH.days <= 1 });
    }
  }

  const lastDay = days[days.length - 1]?.date ?? null;
  const active = periods.some((p) => p.complete && p.to === lastDay);

  return { days, periods, active, source };
}

/** The calendar day after a `YYYY-MM-DD`, in UTC so no zone can shift it. */
function nextDay(date: string): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + 86_400_000).toISOString().slice(0, 10);
}
