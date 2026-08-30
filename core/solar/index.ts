/**
 * Solar geometry and the method-6 sunshine model.
 *
 * Ported from index.html (`getSunriseSunset`, `sunMinutesInHour`, `isHourDay`,
 * `solarPos`, `computeMethod6Sun`). The web app read the UTC offset from a module
 * global (`S._utcOffset`); here it is an explicit parameter, which is the only
 * behavioural change — the arithmetic is unchanged.
 *
 * Open-Meteo returns local wall-clock times with `timezone=auto`, while the solar
 * maths works in UTC, so every conversion goes through `offsetSec`.
 */
import { median } from '../model/stats';

const M6_FALLBACK_OPACITY = 0.15;

export interface SunTimes {
  /** Hours past UTC midnight. */
  rise: number;
  set: number;
}

/**
 * Sunrise and sunset as UTC hours, from the day of year and latitude.
 * A declination approximation good to a few minutes at mid latitudes.
 *
 * Polar day returns the whole day; polar night returns a zero-length day.
 */
export function getSunriseSunset(dateStr: string, lat: number): SunTimes {
  const d = new Date(dateStr + 'T12:00:00Z');
  const doy = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const phi = (lat * Math.PI) / 180;
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * doy - 1.39);
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  if (cosH0 <= -1) return { rise: 0, set: 24 }; // midnight sun
  if (cosH0 >= 1) return { rise: 12, set: 12 }; // polar night
  const H0 = (Math.acos(cosH0) * 12) / Math.PI;
  return { rise: 12 - H0, set: 12 + H0 };
}

/** Daylight minutes (0–60) falling inside the hour that `timeStr` starts. */
export function sunMinutesInHour(timeStr: string, lat: number, offsetSec: number): number {
  const date = timeStr.slice(0, 10);
  const localHour = parseInt(timeStr.slice(11, 13), 10);
  const utcOffsetH = (offsetSec || 0) / 3600;
  const utcHourStart = (((localHour - utcOffsetH) % 24) + 24) % 24;
  const utcHourEnd = utcHourStart + 1;
  const { rise, set } = getSunriseSunset(date, lat);
  const overlapStart = Math.max(utcHourStart, rise);
  const overlapEnd = Math.min(utcHourEnd, set);
  const overlapH = Math.max(0, overlapEnd - overlapStart);
  return Math.round(overlapH * 60);
}

/** 1 when the given local hour falls in daylight, else 0. */
export function isHourDay(timeStr: string, lat: number, offsetSec: number): 0 | 1 {
  const date = timeStr.slice(0, 10);
  const localHour =
    parseInt(timeStr.slice(11, 13), 10) + parseInt(timeStr.slice(14, 16) || '0', 10) / 60;
  const utcOffsetH = (offsetSec || 0) / 3600;
  const utcHour = (((localHour - utcOffsetH) % 24) + 24) % 24;
  const { rise, set } = getSunriseSunset(date, lat);
  return utcHour >= rise && utcHour < set ? 1 : 0;
}

/** Daylight length in hours for a calendar date. */
export function daylightHours(dateStr: string, lat: number): number {
  const { rise, set } = getSunriseSunset(dateStr, lat);
  return Math.max(0, set - rise);
}

export interface SolarPosition {
  /** Cosine of the solar zenith angle; negative below the horizon. */
  cosz: number;
  doy: number;
}

/** NOAA solar position from a UTC timestamp. */
export function solarPos(utcMs: number, lat: number, lon: number): SolarPosition {
  const rad = Math.PI / 180;
  const d = new Date(utcMs);
  const doy = Math.floor((utcMs - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  const hr = d.getUTCHours() + d.getUTCMinutes() / 60;
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (hr - 12) / 24);
  const eot =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const dec =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const tst = hr * 60 + eot + 4 * lon;
  const ha = (tst / 4 - 180) * rad;
  const cosz =
    Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha);
  return { cosz, doy };
}

/** The hourly cloud-layer and radiation fields method 6 consumes. */
export interface HourlyCloudFields {
  time?: string[];
  cloud_cover_low?: Maybe[];
  cloud_cover_mid?: Maybe[];
  cloud_cover_high?: Maybe[];
  cloudcover_low?: Maybe[];
  cloudcover_mid?: Maybe[];
  cloudcover_high?: Maybe[];
  shortwave_radiation?: Maybe[];
}
type Maybe = number | null | undefined;

export interface Method6Day {
  /** Modelled sunshine for the day, in hours. */
  hours: number;
  /** High-cloud opacity used, either derived from radiation or the fallback. */
  op: number;
  /** True when `op` came from at least two cirrus-only radiation samples. */
  derived: boolean;
  /** Sunshine minutes per local hour timestamp. */
  perHour: Record<string, number>;
}

/**
 * Sunshine duration per day from three cloud layers plus shortwave radiation.
 *
 * Clear-sky fraction uses the Geleyn–Hollingsworth maximum-random overlap of the
 * low and mid layers, then blends toward the all-layer overlap in proportion to how
 * opaque the high cloud is. That opacity is measured per day where the sky offers a
 * clean sample — cirrus-only hours with meaningful sun — by comparing observed GHI
 * against Haurwitz clear-sky GHI, and falls back to a climatological 0.15 otherwise.
 */
export function computeMethod6Sun(
  H: HourlyCloudFields | null | undefined,
  lat: number,
  lon: number,
  offsetSec: number
): Record<string, Method6Day> {
  if (!H || !H.time) return {};
  const t = H.time;
  const cl = H.cloud_cover_low ?? H.cloudcover_low ?? [];
  const cm = H.cloud_cover_mid ?? H.cloudcover_mid ?? [];
  const ch = H.cloud_cover_high ?? H.cloudcover_high ?? [];
  const ghiArr = H.shortwave_radiation ?? [];
  if (!cl.length || !cm.length || !ch.length) return {};

  const toUtcMs = (s: string) => Date.parse(s + 'Z') - (offsetSec || 0) * 1000;

  interface Row { date: string; time: string; clrLM: number; clrAll: number; dl: number }
  const rows: Row[] = [];
  const opByDate: Record<string, number[]> = {};
  const hasData: Record<string, true> = {};

  for (let i = 0; i < t.length; i++) {
    if (cl[i] == null && cm[i] == null && ch[i] == null) continue; // gap in the series
    const time = t[i] as string;
    const date = time.slice(0, 10);
    hasData[date] = true;
    const a = (cl[i] ?? 0) / 100;
    const b = (cm[i] ?? 0) / 100;
    const c = (ch[i] ?? 0) / 100;
    const clrLM = 1 - Math.max(a, b);
    const clrAll = b < 1 ? ((1 - Math.max(a, b)) * (1 - Math.max(b, c))) / (1 - b) : 0;
    const dl = sunMinutesInHour(time, lat, offsetSec);
    rows.push({ date, time, clrLM, clrAll, dl });

    const ghi = ghiArr[i];
    if (ghi != null) {
      // Sample the sun at the hour midpoint, not its start.
      const { cosz } = solarPos(toUtcMs(time) + 1800000, lat, lon);
      const ghiClear = cosz > 0 ? 1098 * cosz * Math.exp(-0.059 / cosz) : 0; // Haurwitz
      if (cosz > 0.2 && a < 0.1 && b < 0.1 && c > 0.2 && ghiClear > 20) {
        const T = Math.max(0, Math.min(1, ghi / ghiClear));
        const op = Math.max(0, Math.min(1, (1 - T) / c));
        (opByDate[date] ??= []).push(op);
      }
    }
  }

  const opDay: Record<string, number> = {};
  for (const date of Object.keys(hasData)) {
    const s = opByDate[date] ?? [];
    opDay[date] = s.length >= 2 ? median(s) : M6_FALLBACK_OPACITY;
  }

  const sunMin: Record<string, number> = {};
  const perHour: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const op = opDay[r.date] as number;
    const m = (r.clrLM - op * (r.clrLM - r.clrAll)) * r.dl;
    sunMin[r.date] = (sunMin[r.date] ?? 0) + m;
    (perHour[r.date] ??= {})[r.time] = Math.round(m);
  }

  const out: Record<string, Method6Day> = {};
  for (const date of Object.keys(sunMin)) {
    out[date] = {
      hours: (sunMin[date] as number) / 60,
      op: opDay[date] as number,
      derived: (opByDate[date] ?? []).length >= 2,
      perHour: perHour[date] ?? {},
    };
  }
  return out;
}
