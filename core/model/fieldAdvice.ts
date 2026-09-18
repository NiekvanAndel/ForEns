/**
 * The four rule-based families of the basis layer: spraying, frost, workability and
 * fertilising.
 *
 * The disease models were the first clients of the indicator layer; these are the
 * rest of what the plan calls the basis tier. Every boundary below is a **legal
 * limit, a physical threshold or published practice** — not one of them is a number
 * this app chose for a grower, which is precisely the criterion that keeps the family
 * out of the add-on and in the version everybody gets.
 *
 * Structured like `diseasePressure`, and for the same reason: three surfaces will ask
 * the same question, and a second path answering it separately drifts from the first.
 * The families compute here and the pages draw.
 *
 * ## Word-free, like every kernel here
 *
 * A reading carries a **factor** — which boundary binds — plus the reading, the
 * boundary and the unit it is in. The page turns that into "Wind 21 km/u, grens 18"
 * in the reader's own language and the reader's own units, exactly as `tiles.ts` and
 * `diseaseTiles.ts` do. Nothing in this module is translatable, because nothing in it
 * is words.
 *
 * ## Three levels, the same three everywhere
 *
 * 0 nothing in the way, 1 worth knowing, 2 shut. The same ladder the disease card and
 * the soil status draw, so a lamp means one thing across the app.
 *
 * ## What it refuses to do
 *
 * - **No family speaks past its own horizon.** A spray window on day nine is not a
 *   spray window; it is a guess with a tractor attached. Each family carries the last
 *   moment it claims anything about, and the caller can see it.
 * - **A proxy says it is one.** Inversion is inferred from a calm night, ground frost
 *   from the screen temperature at 1.50 m, and workability from a water balance
 *   rather than from the root zone. All three carry `provenance.kind = 'proxy'`.
 * - **It signals, it does not prescribe.** A reading says what was observed and which
 *   boundary it crossed. Whether to go out is the grower's, and every input that
 *   would decide it — the variety, the machine, the last pass — is not in this app.
 */
import { certaintyAt, type Certainty, type Provenance } from './indicators';
import { deltaT, wetBulb } from './psychro';
import type { Day, Hour } from './types';

/** The four families, each switchable on its own. See `AdviceLayer` in `core/prefs`. */
export type AdviceFamily = 'spray' | 'frost' | 'workability' | 'fertilise';

/** Every family, in the order a page draws them. */
export const ADVICE_FAMILIES: readonly AdviceFamily[] = [
  'spray', 'frost', 'workability', 'fertilise',
];

/**
 * Which boundary binds — the reason, as an id rather than a sentence.
 *
 * One per way a family can be decided, including the "nothing in the way" cases: a
 * page needs to name those too, and an absent reading would leave it guessing whether
 * the family was quiet or switched off.
 */
export type AdviceFactor =
  // Spraying
  | 'sprayOpen' | 'sprayWind' | 'sprayCold' | 'sprayHeat'
  | 'sprayDeltaTLow' | 'sprayDeltaTHigh' | 'sprayRain' | 'sprayInversion'
  // Frost
  | 'frostNone' | 'frostGround' | 'frostAir' | 'frostBlossom' | 'frostIrrigation'
  // Workability
  | 'traffic' | 'mowing' | 'drought'
  // Fertilising
  | 'fertFrozen' | 'fertFrostAhead' | 'fertEmission' | 'fertLeaching' | 'fertTSum';

/** Which family a unit belongs to, so the page can convert it as it draws. */
export type AdviceUnit = 'kmh' | 'C' | 'mm' | 'pct' | 'days';

export interface AdviceReading {
  /** Stable per family and factor, for React keys and for notification ids later. */
  id: string;
  family: AdviceFamily;
  factor: AdviceFactor;
  /** 0 nothing in the way · 1 worth knowing · 2 shut. */
  level: 0 | 1 | 2;
  /** The figure behind the level, in the app's own internal units. */
  value: number | null;
  /** What that figure is measured against. Null where the factor has no boundary. */
  limit: number | null;
  unit: AdviceUnit | null;
  /** The hour the figure was read from, where it is one hour rather than a window. */
  at: string | null;
  /** The open stretch, where the family has one. `to` is exclusive. */
  window: { from: string; to: string } | null;
  /** What closes that window, so an open spray window can say what ends it. */
  closes: AdviceFactor | null;
  certainty: Certainty;
  /** Honesty rule 1: the last moment this reading claims anything about. */
  horizon: string | null;
  provenance: Provenance;
}

// ── The boundaries ──────────────────────────────────────────────────────────────

/** Wind, km/h. 5 m/s is the legal limit for spraying in the Netherlands. */
export const SPRAY_WIND_MAX = 18;
/** Delta T, °C: under 2 the droplets hang, over 8 they are gone before the leaf. */
export const SPRAY_DELTA_T_MIN = 2;
export const SPRAY_DELTA_T_MAX = 8;
/** Air temperature, °C. */
export const SPRAY_TEMP_MAX = 25;
export const SPRAY_TEMP_MIN = 1;
/** How long a spray needs to stay on, and how much rain takes it off again. */
export const SPRAY_RAINFAST_H = 2;
export const SPRAY_RAINFAST_MM = 0.2;
/** The inversion proxy: a night that has lost its wind, km/h. */
export const INVERSION_WIND_MAX = 5;
/** How many hours the calm has to hold before it counts as layered air. */
const INVERSION_HOLD_H = 3;
/** How far ahead a spray window is worth naming, hours. */
export const SPRAY_HORIZON_H = 48;

/** Air frost, and the ground-frost band above it: grass runs colder than 1.50 m. */
export const FROST_AIR = 0;
export const FROST_GROUND = 2;
/** Blossom frost — the figure fruit growers act on, °C. */
export const FROST_BLOSSOM = -2;
/** Below this wet bulb, frost irrigation takes more heat out than it puts in, °C. */
export const FROST_WETBULB_LIMIT = -5;
export const FROST_HORIZON_H = 72;

/** The running water balance behind trafficability: days, and its surplus in mm. */
export const BALANCE_DAYS = 7;
export const TRAFFIC_MARGINAL_MM = 5;
export const TRAFFIC_BLOCKED_MM = 15;
/** A mowing window is three days under a millimetre. */
export const MOWING_DAYS = 3;
export const MOWING_DRY_MM = 1;
/** The deficit over a fortnight, and when it is worth naming, mm. */
export const DROUGHT_DAYS = 14;
export const DROUGHT_MARGINAL_MM = 25;
export const DROUGHT_BLOCKED_MM = 50;

/** Ammonia goes off warm, dry ground before it is in it: °C and %RH. */
export const EMISSION_TEMP = 15;
export const EMISSION_RH = 60;
/** How many of the next twelve hours have to be both before it is a risk. */
const EMISSION_MARGINAL_H = 3;
const EMISSION_BLOCKED_H = 6;
/** Rain over two days that would take the nitrogen past the root zone, mm. */
export const LEACHING_MM = 25;
/** The published figure for the first grass dressing. */
export const TSUM_TARGET = 180;
export const FERT_HORIZON_H = 48;

// ── Shared helpers ──────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The app carries whole units and a tenth beside them; the tenth is the true one. */
const tempOf = (h: Hour) => h.tempExact ?? h.temp;
const windOf = (h: Hour) => h.windExact ?? h.wind;

const sumPrecip = (hours: readonly Hour[]) =>
  round1(hours.reduce((s, h) => s + (h.precip ?? 0), 0));

const sumEt0 = (hours: readonly Hour[]) =>
  round1(hours.reduce((s, h) => s + (h.et0h ?? 0), 0));

const modelled: Provenance = { kind: 'modelled', detail: null };
const proxy: Provenance = { kind: 'proxy', detail: null };

/** The hour a horizon reaches, or null where the series is shorter than the family. */
function horizonOf(hours: readonly Hour[], span: number): string | null {
  const last = hours.slice(0, span).at(-1);
  return last?.time ?? null;
}

// ── Spraying ────────────────────────────────────────────────────────────────────

/** What shuts one hour, and the numbers behind it. Null where the hour is open. */
export interface SprayBlock {
  factor: AdviceFactor;
  value: number | null;
  limit: number;
  unit: AdviceUnit;
  /** True where the rule is inferred rather than measured — inversion. */
  proxy?: boolean;
}

/**
 * Why one hour cannot be sprayed, or null when it can.
 *
 * Only the first reason is returned. The badge gets one line, and six stacked
 * warnings is the wall of text this layer exists to replace — so the order is by how
 * hard the boundary is: the legal wind limit, then the temperatures a spray is simply
 * not applied at, then the physics of the droplet, then what the sky is about to do.
 *
 * `rainAfter` is the rain over the rainfastness window that follows this hour, and
 * `after` the hours that follow it, both handed in so this stays a function of one
 * hour and its context rather than of the whole series.
 */
export function sprayBlock(
  hour: Hour,
  rainAfter: number,
  after: readonly Hour[]
): SprayBlock | null {
  const wind = windOf(hour);
  if (wind != null && wind > SPRAY_WIND_MAX) {
    return { factor: 'sprayWind', value: round1(wind), limit: SPRAY_WIND_MAX, unit: 'kmh' };
  }

  const temp = tempOf(hour);
  if (temp != null && temp < SPRAY_TEMP_MIN) {
    return { factor: 'sprayCold', value: round1(temp), limit: SPRAY_TEMP_MIN, unit: 'C' };
  }
  if (temp != null && temp > SPRAY_TEMP_MAX) {
    return { factor: 'sprayHeat', value: round1(temp), limit: SPRAY_TEMP_MAX, unit: 'C' };
  }

  const dt = deltaT(temp, hour.humidity);
  if (dt != null && dt < SPRAY_DELTA_T_MIN) {
    return { factor: 'sprayDeltaTLow', value: dt, limit: SPRAY_DELTA_T_MIN, unit: 'C' };
  }
  if (dt != null && dt > SPRAY_DELTA_T_MAX) {
    return { factor: 'sprayDeltaTHigh', value: dt, limit: SPRAY_DELTA_T_MAX, unit: 'C' };
  }

  if (rainAfter >= SPRAY_RAINFAST_MM) {
    return { factor: 'sprayRain', value: rainAfter, limit: SPRAY_RAINFAST_MM, unit: 'mm' };
  }

  // Inversion is in no feed the app reads, so it is inferred: at night, once the wind
  // has gone and stays gone, the air layers and a fine droplet travels sideways for
  // kilometres. A proxy, and it says so — honesty rule 4.
  if (hour.isDay === 0 && wind != null && wind < INVERSION_WIND_MAX) {
    const hold = after.slice(0, INVERSION_HOLD_H);
    const stays = hold.length > 0
      && hold.every((h) => { const w = windOf(h); return w != null && w < INVERSION_WIND_MAX; });
    if (stays) {
      return {
        factor: 'sprayInversion', value: round1(wind),
        limit: INVERSION_WIND_MAX, unit: 'kmh', proxy: true,
      };
    }
  }

  return null;
}

/**
 * The spray window: whether it is open now, and the first stretch that is.
 *
 * One reading, because a grower asks one question here. Open, it names the stretch
 * and what closes it; shut, it names what is holding it and when it opens again.
 */
function sprayReading(hours: readonly Hour[], nowKey: string): AdviceReading | null {
  const span = hours.slice(0, SPRAY_HORIZON_H);
  if (!span.length) return null;

  const blocks = span.map((h, i) =>
    sprayBlock(h, sumPrecip(hours.slice(i + 1, i + 1 + SPRAY_RAINFAST_H)), hours.slice(i + 1)));

  // The first contiguous run of open hours — the stretch a grower plans around.
  let start = -1;
  let end = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] == null) {
      if (start < 0) start = i;
      end = i;
    } else if (start >= 0) break;
  }

  const opens = start >= 0 ? span[start] : undefined;
  const lastOpen = end >= 0 ? span[end] : undefined;
  const window = opens && lastOpen
    // Exclusive: the window runs up to the first hour that is no longer open.
    ? { from: opens.time, to: span[end + 1]?.time ?? lastOpen.time }
    : null;

  const horizon = horizonOf(hours, SPRAY_HORIZON_H);
  const now = blocks[0];

  if (!now) {
    // Open. The useful half is the other end: how long it lasts, and on what it ends.
    const closing = end + 1 < blocks.length ? blocks[end + 1] : null;
    return {
      id: 'advice:spray',
      family: 'spray',
      factor: 'sprayOpen',
      level: 0,
      // The figure behind an open window is what will close it, so the badge can say
      // "sluit op Delta T 8,2" rather than leaving the reader to guess.
      value: closing?.value ?? null,
      limit: closing?.limit ?? null,
      unit: closing?.unit ?? null,
      at: null,
      window,
      closes: closing?.factor ?? null,
      certainty: 'high',
      horizon,
      provenance: modelled,
    };
  }

  return {
    id: 'advice:spray',
    family: 'spray',
    factor: now.factor,
    // An inversion is inferred, so it warns rather than shuts: the reader can look at
    // their own field and disagree with it, which they cannot do with the wind limit.
    level: now.proxy ? 1 : 2,
    value: now.value,
    limit: now.limit,
    unit: now.unit,
    at: span[0]?.time ?? null,
    window,
    closes: null,
    certainty: window ? certaintyAt(window.from, nowKey) : 'medium',
    horizon,
    provenance: now.proxy ? proxy : modelled,
  };
}

// ── Frost ───────────────────────────────────────────────────────────────────────

function frostReadings(hours: readonly Hour[], nowKey: string): AdviceReading[] {
  const span = hours.slice(0, FROST_HORIZON_H);
  if (!span.length) return [];

  let coldest: Hour | null = null;
  for (const h of span) {
    const t = tempOf(h);
    if (t == null) continue;
    if (coldest == null || t < (tempOf(coldest) ?? Infinity)) coldest = h;
  }
  if (coldest == null) return [];

  const min = round1(tempOf(coldest) as number);
  const horizon = horizonOf(hours, FROST_HORIZON_H);
  const certainty = certaintyAt(coldest.time, nowKey);

  const factor: AdviceFactor =
    min <= FROST_BLOSSOM ? 'frostBlossom'
      : min < FROST_AIR ? 'frostAir'
        : min < FROST_GROUND ? 'frostGround'
          : 'frostNone';

  const out: AdviceReading[] = [{
    id: 'advice:frost',
    family: 'frost',
    factor,
    level: factor === 'frostNone' ? 0 : factor === 'frostGround' ? 1 : 2,
    value: min,
    limit: factor === 'frostBlossom' ? FROST_BLOSSOM
      : factor === 'frostGround' ? FROST_GROUND : FROST_AIR,
    unit: 'C',
    at: coldest.time,
    window: null,
    closes: null,
    certainty,
    horizon,
    // The ground-frost band is read off the screen temperature at 1.50 m, which is
    // not where the frost would be.
    provenance: factor === 'frostGround' ? proxy : modelled,
  }];

  // Whether irrigation can hold the bud only answers a question somebody has: it
  // appears when there is frost coming, and stays silent on a mild night.
  if (min < FROST_AIR) {
    const tw = wetBulb(min, coldest.humidity);
    if (tw != null) {
      out.push({
        id: 'advice:frost-irrigation',
        family: 'frost',
        factor: 'frostIrrigation',
        // Above the limit the ice holds the bud at zero; below it, evaporation takes
        // out more heat than freezing puts in and irrigating makes it worse.
        level: tw > FROST_WETBULB_LIMIT ? 0 : 2,
        value: tw,
        limit: FROST_WETBULB_LIMIT,
        unit: 'C',
        at: coldest.time,
        window: null,
        closes: null,
        certainty,
        horizon,
        provenance: modelled,
      });
    }
  }

  return out;
}

// ── Workability ─────────────────────────────────────────────────────────────────

function workabilityReadings(
  past: readonly Hour[],
  days: readonly Day[],
  nowKey: string
): AdviceReading[] {
  const out: AdviceReading[] = [];

  // Trafficability, from what the week put in against what it took out. A crude
  // balance, and carried as one: until a SoilExact stands in the field this is an
  // argument about the air over it, not a measurement of the ground under it.
  const week = past.slice(-BALANCE_DAYS * 24);
  if (week.length >= 24) {
    const surplus = round1(sumPrecip(week) - sumEt0(week));
    out.push({
      id: 'advice:traffic',
      family: 'workability',
      factor: 'traffic',
      level: surplus >= TRAFFIC_BLOCKED_MM ? 2 : surplus >= TRAFFIC_MARGINAL_MM ? 1 : 0,
      value: surplus,
      limit: TRAFFIC_BLOCKED_MM,
      unit: 'mm',
      at: nowKey,
      window: null,
      closes: null,
      certainty: 'high',
      // Behind now only: a balance is what has happened, and nothing here claims
      // anything about tomorrow.
      horizon: null,
      provenance: proxy,
    });
  }

  // Three dry days in a row — what grass needs between the cut and the bale.
  const ahead = days.filter((d) => d.date >= nowKey.slice(0, 10));
  if (ahead.length >= MOWING_DAYS) {
    let run = 0;
    let from: string | null = null;
    for (const day of ahead) {
      if ((day.precipMedian ?? 0) < MOWING_DRY_MM) {
        if (run === 0) from = day.date;
        run++;
        if (run >= MOWING_DAYS) break;
      } else {
        run = 0;
        from = null;
      }
    }
    const found = run >= MOWING_DAYS && from != null;
    out.push({
      id: 'advice:mowing',
      family: 'workability',
      factor: 'mowing',
      // Not two: no mowing window is a fact about the week, not a boundary crossed.
      level: found ? 0 : 1,
      value: found ? MOWING_DAYS : run,
      limit: MOWING_DAYS,
      unit: 'days',
      at: found ? `${from}T00:00` : null,
      window: null,
      closes: null,
      certainty: found ? certaintyAt(`${from}T00:00`, nowKey) : 'medium',
      horizon: `${ahead.at(-1)?.date}T00:00`,
      provenance: modelled,
    });
  }

  // The same balance the other way round, over a fortnight.
  const fortnight = past.slice(-DROUGHT_DAYS * 24);
  if (fortnight.length >= 7 * 24) {
    const deficit = round1(sumEt0(fortnight) - sumPrecip(fortnight));
    out.push({
      id: 'advice:drought',
      family: 'workability',
      factor: 'drought',
      level: deficit >= DROUGHT_BLOCKED_MM ? 2 : deficit >= DROUGHT_MARGINAL_MM ? 1 : 0,
      value: deficit,
      limit: DROUGHT_BLOCKED_MM,
      unit: 'mm',
      at: nowKey,
      window: null,
      closes: null,
      certainty: 'high',
      horizon: null,
      provenance: proxy,
    });
  }

  return out;
}

// ── Fertilising ─────────────────────────────────────────────────────────────────

function fertiliseReadings(
  hours: readonly Hour[],
  past: readonly Hour[],
  nowKey: string,
  tSum: number | null | undefined
): AdviceReading[] {
  const out: AdviceReading[] = [];
  const span = hours.slice(0, FERT_HORIZON_H);
  if (!span.length) return out;
  const horizon = horizonOf(hours, FERT_HORIZON_H);

  // Frozen ground leads, because it is the one boundary in this family that is not
  // advice: spreading on frozen or snow-covered ground is prohibited.
  const recent = past.slice(-12).map(tempOf).filter((t): t is number => t != null);
  const nextDay = span.slice(0, 24).map(tempOf).filter((t): t is number => t != null);
  const frozen = recent.length > 0 && Math.max(...recent) < FROST_AIR;
  const frostAhead = nextDay.length > 0 && Math.min(...nextDay) < FROST_AIR;
  if (frozen || frostAhead) {
    out.push({
      id: 'advice:fert-frozen',
      family: 'fertilise',
      factor: frozen ? 'fertFrozen' : 'fertFrostAhead',
      level: frozen ? 2 : 1,
      value: round1(frozen ? Math.max(...recent) : Math.min(...nextDay)),
      limit: FROST_AIR,
      unit: 'C',
      at: nowKey,
      window: null,
      closes: null,
      certainty: 'high',
      horizon: horizonOf(hours, 24),
      provenance: modelled,
    });
  }

  // Warm and dry drives the ammonia off before it is in the ground.
  const half = span.slice(0, 12);
  const risky = half.filter((h) => {
    const t = tempOf(h);
    return t != null && t > EMISSION_TEMP && (h.humidity ?? 100) < EMISSION_RH;
  }).length;
  const warmest = half.map(tempOf).filter((t): t is number => t != null);
  out.push({
    id: 'advice:fert-emission',
    family: 'fertilise',
    factor: 'fertEmission',
    level: risky >= EMISSION_BLOCKED_H ? 2 : risky >= EMISSION_MARGINAL_H ? 1 : 0,
    // The figure is the warmest hour of the twelve, which is what the boundary is
    // about; the count decides the level and would read as an hour count in °C.
    value: warmest.length ? round1(Math.max(...warmest)) : null,
    limit: EMISSION_TEMP,
    unit: 'C',
    at: nowKey,
    window: null,
    closes: null,
    certainty: 'high',
    horizon: horizonOf(hours, 12),
    provenance: modelled,
  });

  // And rain to come takes it the other way: straight past the roots.
  const rain = sumPrecip(span);
  if (rain >= LEACHING_MM / 2) {
    out.push({
      id: 'advice:fert-leaching',
      family: 'fertilise',
      factor: 'fertLeaching',
      level: rain >= LEACHING_MM ? 2 : 1,
      value: rain,
      limit: LEACHING_MM,
      unit: 'mm',
      at: null,
      window: null,
      closes: null,
      certainty: certaintyAt(horizon, nowKey),
      horizon,
      provenance: modelled,
    });
  }

  // Only with a season behind it. The app holds a fortnight of weather and a T-sum
  // counts from 1 January, so a sum over what happens to be in memory would be a
  // number nobody could act on — see `tSum`.
  if (tSum != null && Number.isFinite(tSum)) {
    out.push({
      id: 'advice:fert-tsum',
      family: 'fertilise',
      factor: 'fertTSum',
      level: tSum >= TSUM_TARGET ? 0 : 1,
      value: Math.round(tSum),
      limit: TSUM_TARGET,
      unit: null,
      at: nowKey,
      window: null,
      closes: null,
      certainty: 'high',
      horizon: null,
      provenance: modelled,
    });
  }

  return out;
}

/**
 * The temperature sum, as Dutch practice counts it: daily means from 1 January, with
 * the days below zero left out.
 *
 * Pure and fed from outside, so that the one indicator needing a season of data can
 * have it the day the station history is wired through, and say nothing until then.
 */
export function tSum(dailyMeans: readonly (number | null | undefined)[]): number {
  let total = 0;
  for (const mean of dailyMeans) {
    if (mean == null || !Number.isFinite(mean)) continue;
    if (mean > 0) total += mean;
  }
  return round1(total);
}

// ── The layer ───────────────────────────────────────────────────────────────────

export interface FieldAdviceInput {
  /** The hours ahead, oldest first, starting at the hour in progress. */
  hours: readonly Hour[];
  /** The hours behind, oldest first, ending at now. */
  past: readonly Hour[];
  /** The forecast days, for the families that reason in days rather than hours. */
  days: readonly Day[];
  /** The key the page considers now, in the app's own local wall-clock form. */
  nowKey: string;
  /** Which families to run. Omitted means all of them. */
  families?: readonly AdviceFamily[];
  /** The temperature sum so far this year, where the caller has a season of it. */
  tSum?: number | null;
}

/**
 * Every rule-based reading for one location.
 *
 * A family that is switched off is **not computed**, which is the difference between
 * a preference and a filter: switching the spray window off should cost nothing, not
 * hide a result that was worked out anyway.
 *
 * A family whose inputs are missing produces nothing rather than a reading with a
 * dash in it. An indicator is a statement, and a statement with no number behind it
 * is not a quieter statement — it is a wrong one.
 */
export function fieldAdvice({
  hours, past, days, nowKey, families, tSum: sum,
}: FieldAdviceInput): AdviceReading[] {
  const run = new Set(families ?? ADVICE_FAMILIES);
  const out: AdviceReading[] = [];

  if (run.has('spray')) {
    const spray = sprayReading(hours, nowKey);
    if (spray) out.push(spray);
  }
  if (run.has('frost')) out.push(...frostReadings(hours, nowKey));
  if (run.has('workability')) out.push(...workabilityReadings(past, days, nowKey));
  if (run.has('fertilise')) out.push(...fertiliseReadings(hours, past, nowKey, sum));

  return out;
}

/** The worst level in a set — one figure per location, as `diseasePressure` has. */
export function adviceLevel(readings: readonly AdviceReading[]): 0 | 1 | 2 {
  return readings.reduce<0 | 1 | 2>((worst, r) => (r.level > worst ? r.level : worst), 0);
}

/** The same set, worst first: what is shut is what changes a morning. */
export function byUrgency(readings: readonly AdviceReading[]): AdviceReading[] {
  return [...readings].sort((a, b) => b.level - a.level);
}
