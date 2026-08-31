/**
 * The forecast model builder.
 *
 * Ported from index.html's `processAll`. It merges up to six responses into one
 * structure the screens render from:
 *
 *   oJ   observations (past 12h) — Open-Meteo forecast with past_days=1
 *   hJ   HARMONIE-AROME hourly (or ECMWF IFS hourly when HARMONIE is unavailable)
 *   eJ   ECMWF ENS, 51 members, daily
 *   sJ   sunshine + ET0 daily (arrives inside the IFS call)
 *   iJ   ECMWF IFS deterministic daily
 *   ihJ  ECMWF IFS hourly precipitation and weather codes
 *
 * Each may be null: the app renders as soon as the first source lands and refines
 * as the slower ones arrive, so every access here is defensive by design.
 *
 * The web app read lat/lon, preferences and the ECMWF icon responses from module
 * globals; they arrive here in `ProcessContext` instead. Behaviour is unchanged.
 */
import { percentile, probAtLeast, round1 } from './stats';
import { computeMethod6Sun, isHourDay, sunMinutesInHour } from '../solar';
import type {
  Day, ForecastModel, HourlyBlock, Hour, HresHour, Num, NumArray,
  ProcessContext, WeatherResponse,
} from './types';

/** Relative humidity from temperature and dew point, via the Magnus formula. */
export function magnusRH(T: Num, Td: Num): number | null {
  if (T == null || Td == null) return null;
  return Math.round(
    (100 * Math.exp((17.625 * Td) / (243.04 + Td))) / Math.exp((17.625 * T) / (243.04 + T))
  );
}

const at = (a: NumArray | undefined, i: number): Num => (a ? a[i] : undefined);
const roundOrNull = (v: Num): number | null => (v != null ? Math.round(v) : null);

/**
 * Most frequent weather code during daylight, per day.
 * Ties break toward the higher (more severe) code, so a day that is half sunny and
 * half showery is labelled showery rather than by array order.
 */
function daylightModeByDay(
  times: string[] | undefined,
  codes: NumArray | undefined,
  lat: number,
  offsetSec: number
): Record<string, number> {
  const byDay: Record<string, Record<number, number>> = {};
  if (times && codes) {
    for (let i = 0; i < times.length; i++) {
      const c = codes[i];
      if (c == null) continue;
      const time = times[i] as string;
      if (!isHourDay(time, lat, offsetSec)) continue;
      const day = time.slice(0, 10);
      (byDay[day] ??= {})[c] = (byDay[day]?.[c] ?? 0) + 1;
    }
  }
  const out: Record<string, number> = {};
  for (const day of Object.keys(byDay)) {
    let best = 0;
    let bestN = -1;
    for (const k of Object.keys(byDay[day] as Record<number, number>)) {
      const code = +k;
      const n = (byDay[day] as Record<number, number>)[code] as number;
      if (n > bestN || (n === bestN && code > best)) {
        best = code;
        bestN = n;
      }
    }
    out[day] = best;
  }
  return out;
}

/** Most frequent value in an array, matching the web app's reduce-based mode. */
function modeOf(arr: number[]): number | undefined {
  if (!arr.length) return undefined;
  return arr.reduce((a, b, _i, all) =>
    all.filter((v) => v === b).length >= all.filter((v) => v === a).length ? b : a
  , arr[0] as number);
}

export function processAll(
  oJ: WeatherResponse | null | undefined,
  hJ: WeatherResponse | null | undefined,
  eJ: WeatherResponse | null | undefined,
  sJ: WeatherResponse | null | undefined,
  iJ: WeatherResponse | null | undefined,
  ihJ: WeatherResponse | null | undefined,
  ctx: ProcessContext
): ForecastModel | null {
  if (!oJ && !hJ) return null;
  const { lat, lon } = ctx;
  const iphJ = ihJ; // precipitation + weather_code live in the IFS hourly response

  // `current_weather.time` is in the API's local zone (timezone=auto), and may carry
  // minutes. Truncating to the hour gives one cut point for all three series.
  const cwTime = oJ?.current_weather?.time ?? hJ?.current_weather?.time ?? '';
  const nowHour = cwTime.slice(0, 13) + ':00';

  const offsetSec = oJ?.utc_offset_seconds ?? hJ?.utc_offset_seconds ?? 0;

  // ── Past 12 hours. Only with observations; without them there is no history. ──
  const pastHours: Hour[] = [];
  if (oJ?.hourly?.time) {
    const oh = oJ.hourly;
    const ot = oh.time as string[];
    const pastCandidates: number[] = [];
    for (let i = 0; i < ot.length; i++) if ((ot[i] as string) < nowHour) pastCandidates.push(i);
    for (const i of pastCandidates.slice(-12)) {
      const time = ot[i] as string;
      pastHours.push({
        time,
        temp: roundOrNull(at(oh.temperature_2m, i)),
        precip: round1(at(oh.precipitation, i) ?? 0),
        wind: roundOrNull(at(oh.windspeed_10m, i)),
        humidity: roundOrNull(at(oh.relativehumidity_2m, i)),
        wmo: (at(oh.weathercode, i) ?? 0) as number,
        isDay: isHourDay(time, lat, offsetSec),
        isPast: true,
      });
    }
  }

  // ── Next 48 hours, from HARMONIE where available, else the observation feed. ──
  const harmSrc = (hJ ?? oJ) as WeatherResponse;
  const hh = harmSrc.hourly as HourlyBlock;
  const ht = (hh.time ?? []) as string[];
  const futureHours: Hour[] = [];
  for (let i = 0; i < ht.length; i++) {
    const time = ht[i] as string;
    if (time >= nowHour && futureHours.length < 48) {
      // Sunshine minutes: daylight in the hour, gated by the WMO direct-beam
      // threshold, then scaled by cloud cover. Replaced by method 6 below where
      // the cloud-layer fields are available.
      let sunMin = 0;
      const maxMin = sunMinutesInHour(time, lat, offsetSec);
      if (maxMin !== 0) {
        const dni = at(hh.direct_normal_irradiance, i) ?? 0;
        if (dni >= 120) {
          const cc = at(hh.cloudcover, i) ?? 100;
          sunMin = Math.round((1 - cc / 100) * maxMin);
        }
      }
      futureHours.push({
        time,
        temp: roundOrNull(at(hh.temperature_2m, i)),
        precip: round1(at(hh.precipitation, i) ?? 0),
        wind: roundOrNull(at(hh.windspeed_10m, i)),
        gusts: roundOrNull(at(hh.windgusts_10m, i)),
        feelsLike: roundOrNull(at(hh.apparent_temperature, i)),
        et0h: at(hh.et0_fao_evapotranspiration, i) != null
          ? round1(at(hh.et0_fao_evapotranspiration, i) as number) : null,
        pressure: roundOrNull(at(hh.surface_pressure, i)),
        dewpoint: roundOrNull(at(hh.dewpoint_2m, i)),
        humidity: roundOrNull(at(hh.relativehumidity_2m, i)),
        wmo: (at(hh.weathercode, i) ?? 0) as number,
        isDay: isHourDay(time, lat, offsetSec),
        sunMin,
        windDir: roundOrNull(at(hh.winddirection_10m, i)),
        isPast: false,
        // Per-hour ensemble figures are computed lazily when a day sheet opens.
        pChance: null, p2mm: null, p10mm: null,
        precipP10: null, precipP25: null, precipP50: null, precipP75: null, precipP90: null,
      });
    }
  }

  // ── Ensemble members, daily. ──
  const ed = (eJ?.daily ?? {}) as Record<string, unknown>;
  const edt = (ed.time as string[] | undefined) ?? [];
  const memberSeries = (prefix: string): NumArray[] =>
    Object.keys(ed)
      .filter((k) => k.startsWith(prefix + '_member'))
      .map((k) => ed[k] as NumArray);
  const orSingle = (m: NumArray[], fallback: unknown): NumArray[] =>
    m.length ? m : [(fallback as NumArray) ?? []];

  const PM2 = orSingle(memberSeries('precipitation_sum'), ed.precipitation_sum);
  const TMaxM2 = orSingle(memberSeries('temperature_2m_max'), ed.temperature_2m_max);
  const TMinM2 = orSingle(memberSeries('temperature_2m_min'), ed.temperature_2m_min);
  const WM2 = orSingle(memberSeries('windspeed_10m_max'), ed.windspeed_10m_max);

  // ── Day skeleton. IFS supplies the date axis because it always runs 14–16 days;
  //    ENS values are looked up per date and may be absent while it is still loading. ──
  const today = nowHour.slice(0, 10);
  interface DayBucket {
    date: string; ps: number[]; taMax: number[]; taMin: number[];
    waMax: number[]; ha: number[]; wmos: number[];
  }
  const dayMap: Record<string, DayBucket> = {};
  const dayOrder: string[] = [];
  const edtIndex = new Map(edt.map((d, i) => [d, i]));
  const ifsDates = iJ?.daily?.time;
  const dateSource: string[] = ifsDates?.length ? ifsDates : edt.length ? edt : [];
  for (const d of dateSource) {
    if (d < today) continue;
    const ei = edtIndex.has(d) ? (edtIndex.get(d) as number) : -1;
    dayMap[d] = {
      date: d,
      ps: ei >= 0 ? PM2.map((m) => (m[ei] ?? 0) as number) : [],
      taMax: ei >= 0 ? TMaxM2.map((m) => (m[ei] ?? -Infinity) as number) : [],
      taMin: ei >= 0 ? TMinM2.map((m) => (m[ei] ?? Infinity) as number) : [],
      waMax: ei >= 0 ? WM2.map((m) => (m[ei] ?? -Infinity) as number) : [],
      ha: [],
      wmos: [],
    };
    dayOrder.push(d);
  }

  // ── Daily sunshine (seconds) and ET0 (mm), from the deterministic call. ──
  const sunByDay: Record<string, number> = {};
  const et0ByDay: Record<string, number> = {};
  if (sJ?.daily?.time) {
    const dt = sJ.daily.time;
    const sd = sJ.daily.sunshine_duration ?? [];
    const et = sJ.daily.et0_fao_evapotranspiration ?? [];
    dt.forEach((day, i) => {
      if (sd[i] != null) sunByDay[day] = sd[i] as number;
      if (et[i] != null) et0ByDay[day] = et[i] as number;
    });
  }

  // ── HARMONIE aggregated to days (today and tomorrow only). ──
  interface HarmDay {
    temps: number[]; precips: number[]; winds: number[]; wmos: number[]; rhvals?: number[];
  }
  const harmDays: Record<string, HarmDay> = {};
  if (hJ?.hourly?.time) {
    const hb = hJ.hourly;
    const htm = hb.time ?? [];
    htm.forEach((t, i) => {
      const day = t.slice(0, 10);
      const o = (harmDays[day] ??= { temps: [], precips: [], winds: [], wmos: [] });
      const temp = at(hb.temperature_2m, i);
      if (temp != null) o.temps.push(temp);
      const p = at(hb.precipitation, i);
      if (p != null) o.precips.push(p);
      const w = at(hb.windspeed_10m, i);
      if (w != null) o.winds.push(w);
      const c = at(hb.weathercode, i);
      if (c != null) o.wmos.push(c);
      const dew = at(hb.dewpoint_2m, i);
      if (dew != null && temp != null) {
        const rh = magnusRH(temp, dew);
        if (rh != null) (o.rhvals ??= []).push(rh);
      }
    });
  }

  // ── IFS deterministic daily values, and a label for the run they came from. ──
  const hresDays: Record<string, Partial<Day>> = {};
  let hresRunLabel: string | null = null;
  const ifsTime = iJ?.daily?.time;
  if (iJ?.daily && ifsTime) {
    const id = iJ.daily;
    // IFS runs at 00, 06, 12 and 18 UTC. Open-Meteo does not report which run a
    // response came from, so the most recent one that has had ~3h to publish is
    // the best available estimate.
    const utcH = (ctx.now ?? new Date()).getUTCHours();
    const runs = [0, 6, 12, 18];
    const lastRun = runs.filter((r) => utcH >= r + 3).pop() ?? 18;
    hresRunLabel = `IFS ${String(lastRun).padStart(2, '0')}z`;
    ifsTime.forEach((t, i) => {
      hresDays[t] = {
        hresTempMax: roundOrNull(at(id.temperature_2m_max, i)),
        hresTempMin: roundOrNull(at(id.temperature_2m_min, i)),
        hresPrecip: round1(at(id.precipitation_sum, i) ?? 0),
        hresPrecipChance: at(id.precipitation_probability_max, i) ?? null,
        hresWindMax: roundOrNull(at(id.windspeed_10m_max, i)),
        hresWindDir: roundOrNull(at(id.winddirection_10m_dominant, i)),
        hresWmo: at(id.weather_code, i) ?? null,
        // Daily RH extremes: the maximum pairs the coldest hour with the wettest
        // dew point, the minimum the warmest hour with the driest.
        hresRhMax: (() => {
          const rh = magnusRH(at(id.temperature_2m_min, i), at(id.dewpoint_2m_max, i));
          return rh == null ? null : Math.min(100, rh);
        })(),
        hresRhMin: (() => {
          const rh = magnusRH(at(id.temperature_2m_max, i), at(id.dewpoint_2m_min, i));
          return rh == null ? null : Math.min(100, rh);
        })(),
      };
    });
  }

  // ── IFS hourly, grouped by day. ──
  // The whole hour, not only its millimetres: the day sheets read temperature, wind,
  // humidity and sunshine from here for every day beyond HARMONIE's range. The web
  // app fetched each of those separately, per popup.
  const hresHoursByDay: Record<string, HresHour[]> = {};
  if (iphJ?.hourly?.time) {
    const ph = iphJ.hourly;
    const pt = ph.time ?? [];
    const pp = ph.precipitation ?? [];
    const pw = ph.weather_code ?? ph.weathercode ?? [];
    const ptemp = ph.temperature_2m ?? [];
    const pdew = ph.dewpoint_2m ?? [];
    const prh = ph.relativehumidity_2m ?? [];
    const pwind = ph.windspeed_10m ?? [];
    const pdir = ph.winddirection_10m ?? [];
    const pgust = ph.wind_gusts_10m ?? ph.windgusts_10m ?? [];
    const psun = ph.sunshine_duration ?? [];
    const pet0 = ph.et0_fao_evapotranspiration ?? [];
    pt.forEach((t, i) => {
      const hourNum = parseInt(t.slice(11, 13), 10);
      // The first 90 hours are genuinely hourly; beyond that the model is
      // three-hourly, so only every third hour carries a real value.
      const isReal = i < 90 || hourNum % 3 === 0;
      if (!isReal) return;
      const day = t.slice(0, 10);
      const sunSec = at(psun, i);
      (hresHoursByDay[day] ??= []).push({
        time: t,
        hour: hourNum,
        precip: pp[i] != null ? round1(pp[i] as number) : 0,
        wmo: (pw[i] ?? 0) as number,
        is3h: i >= 90,
        temp: roundOrNull(at(ptemp, i)),
        dewpoint: roundOrNull(at(pdew, i)),
        // Relative humidity is not in every IFS response; derive it from the dew
        // point when it is absent, exactly as the web app's humidity popup did.
        humidity: roundOrNull(at(prh, i)) ?? magnusRH(at(ptemp, i), at(pdew, i)),
        wind: roundOrNull(at(pwind, i)),
        windDir: roundOrNull(at(pdir, i)),
        gusts: roundOrNull(at(pgust, i)),
        sunMin: sunSec != null ? Math.round(sunSec / 60) : null,
        et0h: at(pet0, i) != null ? round1(at(pet0, i) as number) : null,
      });
    });
  }

  // ── IFS hourly RH extremes per day, from temperature and dew point. ──
  const hresRhByDay: Record<string, { min: number; max: number }> = {};
  if (ihJ?.hourly?.time) {
    const t = ihJ.hourly.time;
    const htemp = ihJ.hourly.temperature_2m ?? [];
    const hdew = ihJ.hourly.dewpoint_2m ?? [];
    t.forEach((time, i) => {
      const rh = magnusRH(htemp[i], hdew[i]);
      if (rh == null) return;
      const day = time.slice(0, 10);
      const cur = (hresRhByDay[day] ??= { min: 100, max: 0 });
      cur.min = Math.min(cur.min, rh);
      cur.max = Math.max(cur.max, rh);
    });
  }

  // ── Day icons: the daylight mode of hourly codes. HARMONIE for days 0–1 where
  //    available, otherwise the ECMWF icon call. ──
  const extH = ctx.ecmwfHourlyExt?.hourly?.time ? ctx.ecmwfHourlyExt : ctx.ecmwfHourly ?? null;
  const ecmwfIconByDay = extH?.hourly?.time
    ? daylightModeByDay(extH.hourly.time, extH.hourly.weather_code ?? extH.hourly.weathercode, lat, offsetSec)
    : {};
  const harmIconByDay = hJ?.hourly?.time
    ? daylightModeByDay(hJ.hourly.time, hJ.hourly.weathercode ?? hJ.hourly.weather_code, lat, offsetSec)
    : {};

  // ── Method-6 sunshine, from hourly cloud layers plus radiation. ──
  const harmAvailable = hJ != null && ctx.useHarmonie && !ctx.harmFailed;
  const sun6Harm = harmAvailable && hJ?.hourly ? computeMethod6Sun(hJ.hourly, lat, lon, offsetSec) : {};
  const sun6Ecmwf = iJ?.hourly ? computeMethod6Sun(iJ.hourly, lat, lon, offsetSec) : {};

  // Align the hour strip's sunshine minutes with method 6 wherever it has an answer.
  for (const h of futureHours) {
    const dd = h.time.slice(0, 10);
    const m6 = sun6Harm[dd]?.perHour?.[h.time] ?? sun6Ecmwf[dd]?.perHour?.[h.time];
    if (m6 != null) h.sunMin = m6;
  }

  const noInf = (a: number[], sentinel: number) => a.filter((v) => v !== sentinel);
  const pctRound = (a: number[], p: number) => Math.round(percentile(a, p) as number);

  const days: Day[] = dayOrder.slice(0, 14).map((d, dayIdx) => {
    const o = dayMap[d] as DayBucket;
    const harm = harmDays[d] ?? ({} as HarmDay);
    const useHarm = dayIdx <= 1 && harmAvailable;

    const dayIcon =
      dayIdx <= 1 && harmAvailable && harmIconByDay[d] != null
        ? (harmIconByDay[d] as number)
        : ecmwfIconByDay[d] != null
          ? (ecmwfIconByDay[d] as number)
          : hresDays[d]?.hresWmo ?? null;

    const wmoMode = o.wmos.length ? modeOf(o.wmos) : harm.wmos?.length ? modeOf(harm.wmos) : 0;

    // Sunshine: method 6 where the hourly fields allow it, otherwise the daily total.
    const s6 = useHarm && sun6Harm[d] ? sun6Harm[d] : sun6Ecmwf[d] ?? null;
    const sunHours = s6 ? round1(s6.hours) : sunByDay[d] != null ? round1((sunByDay[d] as number) / 3600) : null;
    const sunModel: Day['sunModel'] = s6
      ? useHarm && sun6Harm[d] ? 'harmonie' : 'ecmwf'
      : sunByDay[d] != null ? 'daily' : null;

    const taMax = noInf(o.taMax, -Infinity);
    const taMin = noInf(o.taMin, Infinity);
    const waMax = noInf(o.waMax, -Infinity);
    const hres = hresDays[d];

    return {
      date: d,
      useHarm,
      precipP10: round1(percentile(o.ps, 10) as number),
      precipP25: round1(percentile(o.ps, 25) as number),
      precipMedian: round1(percentile(o.ps, 50) as number),
      precipP75: round1(percentile(o.ps, 75) as number),
      precipP90: round1(percentile(o.ps, 90) as number),
      pChance: Math.round(probAtLeast(o.ps, 0.1)),
      p5mm: Math.round(probAtLeast(o.ps, 5)),
      p20mm: Math.round(probAtLeast(o.ps, 20)),
      tempLo: pctRound(taMin, 10),
      tempHi: pctRound(taMax, 90),
      tempMaxP10: pctRound(taMax, 10),
      tempMaxP50: pctRound(taMax, 50),
      tempMaxP90: pctRound(taMax, 90),
      tempMinP10: pctRound(taMin, 10),
      tempMinP50: pctRound(taMin, 50),
      tempMinP90: pctRound(taMin, 90),
      tempMaxP25: pctRound(taMax, 25),
      tempMaxP75: pctRound(taMax, 75),
      tempMinP25: pctRound(taMin, 25),
      tempMinP75: pctRound(taMin, 75),
      windP10: pctRound(waMax, 10),
      windP25: pctRound(waMax, 25),
      windP75: pctRound(waMax, 75),
      windP50: pctRound(waMax, 50),
      windP90: pctRound(waMax, 90),
      humidityMedian: o.ha.length
        ? pctRound(o.ha, 50)
        : hres?.hresRhMin != null && hres?.hresRhMax != null
          ? Math.round((hres.hresRhMin + hres.hresRhMax) / 2)
          : null,
      humidityP10: o.ha.length ? pctRound(o.ha, 10) : hres?.hresRhMin ?? null,
      humidityP25: o.ha.length ? pctRound(o.ha, 25) : hres?.hresRhMin ?? null,
      humidityP75: o.ha.length ? pctRound(o.ha, 75) : hres?.hresRhMax ?? null,
      humidityP90: o.ha.length ? pctRound(o.ha, 90) : hres?.hresRhMax ?? null,
      sunHours,
      et0: et0ByDay[d] != null ? round1(et0ByDay[d] as number) : null,
      windDir: hres?.hresWindDir ?? null,
      sunModel,
      sunOpacity: s6 ? Math.round(s6.op * 100) / 100 : null,
      sunOpacityDerived: s6 ? s6.derived : false,
      sun6Hourly: s6 ? s6.perHour ?? null : null,
      dayIcon,
      wmo: (wmoMode ?? hres?.hresWmo ?? 0) as number,
      nMembers: PM2.length,
      ensLoaded: o.ps.length > 0,
      ...(hres ?? {}),
      harmTempMax: harm.temps?.length ? Math.round(Math.max(...harm.temps)) : null,
      harmTempMin: harm.temps?.length ? Math.round(Math.min(...harm.temps)) : null,
      harmPrecip: harm.precips?.length ? round1(harm.precips.reduce((a, b) => a + b, 0)) : null,
      harmWindMax: harm.winds?.length ? Math.round(Math.max(...harm.winds)) : null,
      harmRhMin: harm.rhvals?.length ? Math.min(...harm.rhvals) : null,
      harmRhMax: harm.rhvals?.length ? Math.max(...harm.rhvals) : null,
      hresRhMin: hresRhByDay[d]?.min ?? null,
      hresRhMax: hresRhByDay[d]?.max ?? null,
    } as Day;
  });

  const curH = futureHours[0] ?? pastHours[pastHours.length - 1];
  return {
    pastHours,
    futureHours,
    allHours: [...pastHours, ...futureHours],
    nowHour,
    days,
    currentTemp: curH?.temp ?? 0,
    currentWmo: curH?.wmo ?? 0,
    nMembers: PM2.length,
    hresRunLabel: hresRunLabel ?? null,
    hresHoursByDay,
  };
}
