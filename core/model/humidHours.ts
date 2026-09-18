import { threshold } from '../thresholds';
/**
 * The one kernel under all the disease models: hours above a humidity threshold.
 *
 * Smith, Cercospora-DIV, 10-10-48 and Gubler-Thomas are the same calculation with
 * different parameters — contiguous hours at or above a relative humidity, with the
 * temperature over them. Writing that once is the reason the plan puts the disease
 * models in the base version rather than behind a paywall: a paywall through the
 * middle of one kernel is a permanent source of mess, because you build it, you test
 * it, and then you spend forever hiding parts of it per crop.
 *
 * Pure, and it knows nothing about any crop. The models are parameters and a reading
 * of the runs it returns.
 *
 * ## Which humidity
 *
 * Decided in the plan: **at 10 cm where a CropExact stands, at 1.50 m otherwise.
 * Never both.** Two numbers answering the same question is exactly what the honesty
 * rules forbid, and the height is not a detail — the air in the crop is damper and
 * stays damp longer than the air at chest height, which is the whole reason an
 * infection model wants it. So the choice is made once, at the edge, by
 * `humidityAt10cm`, and the measuring height travels with the result as its origin.
 *
 * ## Gaps are breaks, not bridges
 *
 * A run ends where an hour has no reading. An infection period is a claim that the
 * leaf stayed wet for eleven hours together, and an hour nobody measured cannot be
 * counted toward it — bridging the gap would turn a sensor outage into a disease
 * warning. That is a different answer from the charts, which draw a gap and move on;
 * here the gap changes the number.
 */

/** One hour, as any of the models needs it. */
export interface HumidHour {
  /** Local wall-clock hour, `YYYY-MM-DDTHH:00`. */
  time: string;
  /** Relative humidity, %. Null where nothing measured it. */
  humidity: number | null;
  /** Temperature over the same hour, °C. */
  temp: number | null;
}

/** A stretch of hours that stayed at or above the threshold, unbroken. */
export interface HumidRun {
  /** First and last hour in the run, inclusive. */
  from: string;
  to: string;
  /** How many hours it covers. */
  hours: number;
  /** The mean temperature over them, which is what every model weighs the run by.
   *  Null where not one hour in the run reported a temperature. */
  meanTemp: number | null;
  /** The coldest and warmest hour in it — Smith reads the first, and a run that dips
   *  below a crop's floor partway through is not the same as one that does not. */
  minTemp: number | null;
  maxTemp: number | null;
}

/**
 * Where the humidity behind these hours was measured.
 *
 * Carried because honesty rule 4 applies to a derived figure as much as to a reading:
 * a Smith period computed from the air at 10 cm and one computed at 1.50 m are not
 * the same claim, and the page has to be able to say which it is showing.
 */
export type HumidSource = 'canopy10cm' | 'standard150cm';

export interface HumidHoursInput {
  hours: readonly HumidHour[];
  /** At or above this, in %. Smith uses 90; the others differ. */
  minHumidity: number;
  /** Hours below this temperature break a run, where a model has such a floor.
   *  Absent means temperature does not break runs, only describes them. */
  minTemp?: number;
}

/**
 * Every unbroken stretch at or above the threshold.
 *
 * At or above, not above: a published model's 90% means 90 counts. Getting that wrong
 * is invisible in a dry week and shifts every period in a damp one.
 *
 * The hours are read in the order given. They are not sorted here — the source layer
 * already answers oldest first, and quietly reordering would hide a source that did
 * not, which on a model that counts *consecutive* hours would be a silent corruption
 * rather than a visible one.
 */
export function humidRuns({ hours, minHumidity, minTemp }: HumidHoursInput): HumidRun[] {
  const runs: HumidRun[] = [];
  let current: HumidHour[] = [];

  const close = () => {
    if (!current.length) return;
    const temps = current.map((h) => h.temp).filter((t): t is number => t != null);
    runs.push({
      from: current[0]!.time,
      to: current[current.length - 1]!.time,
      hours: current.length,
      meanTemp: temps.length
        ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10
        : null,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
    });
    current = [];
  };

  for (const hour of hours) {
    // A gap breaks the run. See the note at the top: an hour nobody measured cannot
    // be counted toward a claim that the leaf stayed wet through it.
    const wet = hour.humidity != null && hour.humidity >= minHumidity;
    const warm = minTemp == null || (hour.temp != null && hour.temp >= minTemp);
    if (wet && warm) current.push(hour);
    else close();
  }
  close();

  return runs;
}

/** How many hours of a calendar day were at or above the threshold, day by day. */
export interface HumidDay {
  /** `YYYY-MM-DD`, the location's own local day. */
  date: string;
  /** Hours at or above the threshold, whether or not they were consecutive. */
  hours: number;
  /** The day's coldest and warmest hour, over every hour that reported one — not only
   *  the humid ones. Smith's temperature floor is a property of the day. */
  minTemp: number | null;
  maxTemp: number | null;
  /** Whether every hour of the day is present. A day assembled from nineteen hours
   *  cannot be compared against a threshold counted in hours, and a model that did so
   *  would clear a grower's field on the strength of missing data. */
  complete: boolean;
}

/** Hours in a full calendar day, for `complete`. */
const HOURS_PER_DAY = 24;

/**
 * The same hours, folded into days.
 *
 * Smith and DIV both ask a question per day — "eleven hours above 90% and a minimum
 * over 10°" — so the fold belongs here rather than in each of them.
 *
 * `complete` is the part worth caring about. A model that counted eleven humid hours
 * out of the nineteen it happened to have would be answering a different question from
 * the one it claims, and it would answer it most often exactly when a station has been
 * dropping readings. Callers are expected to skip incomplete days rather than treat
 * them as quiet ones.
 */
export function humidDays(
  hours: readonly HumidHour[],
  minHumidity: number
): HumidDay[] {
  const byDate = new Map<string, HumidHour[]>();
  for (const hour of hours) {
    const date = hour.time.slice(0, 10);
    const list = byDate.get(date);
    if (list) list.push(hour);
    else byDate.set(date, [hour]);
  }

  return [...byDate.entries()].map(([date, day]) => {
    const temps = day.map((h) => h.temp).filter((t): t is number => t != null);
    return {
      date,
      hours: day.filter((h) => h.humidity != null && h.humidity >= minHumidity).length,
      minTemp: temps.length ? Math.min(...temps) : null,
      maxTemp: temps.length ? Math.max(...temps) : null,
      complete: day.length >= HOURS_PER_DAY,
    };
  }).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The hours the disease models run on, from whichever instrument stands here.
 *
 * The plan's decision, in one function: **the air at 10 cm where a CropExact stands,
 * the air at 1.50 m otherwise, never both.** Two numbers answering one question is
 * what the honesty rules forbid, and this is the only place the question is asked.
 *
 * The height is not a detail. Air inside a crop canopy is damper than air at chest
 * height and stays damp for hours longer after dawn, which is exactly the stretch an
 * infection model counts. A Smith period found at 10 cm and one found at 1.50 m are
 * different claims about the same field, so the source travels with the hours and the
 * page says which it is showing.
 *
 * `soil` wins only where it actually reports — a PRO whose canopy probe is silent
 * falls back rather than producing a week of empty hours, and the result then says
 * `standard150cm`, which is the truth about what was used.
 */
export function humidHoursFrom(
  /** The location's own hours at 1.50 m, from the model or its weather station. */
  standard: readonly HumidHour[],
  /** What a canopy sensor reported, where one stands here. */
  canopy: readonly HumidHour[] = []
): { hours: HumidHour[]; source: HumidSource } {
  const usable = canopy.filter((h) => h.humidity != null);
  return usable.length
    ? { hours: [...canopy], source: 'canopy10cm' }
    : { hours: [...standard], source: 'standard150cm' };
}

/**
 * Leaf wetness, above which the app treats the leaf as wet.
 *
 * Ninety-five per cent relative humidity. Set by the grower on 18 September 2026, and
 * it is the same rule the web app's own derivation uses on its humidity half.
 */
export const LEAF_WET_HUMIDITY = threshold('leafWet.humidity');

/**
 * Hours the leaf was probably wet — **a proxy, never a measurement.**
 *
 * `leaf_wet` is in the web app's model and not in API v2, and even there it is derived
 * rather than measured. So this is a derivation of a derivation, and the honesty rules
 * are the whole reason it is allowed at all: it is carried because it is genuinely
 * useful, it is labelled a proxy wherever it is shown, and it never earns a green dot.
 *
 * The web app's own rule is rain in the last hour **or** humidity above 95%. This is
 * the humidity half; rainfall would need the gauge's hour alongside, and a PLUS or PRO
 * could supply it. Adding that clause is a change here and nowhere else.
 *
 * **Not good enough for Mills.** The plan is explicit: apple scab waits for a real leaf
 * wetness sensor, because Mills counts wet hours directly and a proxy that is wrong by
 * two hours moves an infection period. This feeds the wet-hour counts the other models
 * use as a supporting figure, and that is its ceiling.
 */
export function leafWetHours(hours: readonly HumidHour[]): {
  hours: number;
  /** Always true. A field on the result, so no caller can print this figure without
   *  having had to look at the word "proxy" on the way. */
  proxy: true;
} {
  return {
    hours: hours.filter((h) => h.humidity != null && h.humidity > LEAF_WET_HUMIDITY).length,
    proxy: true,
  };
}
