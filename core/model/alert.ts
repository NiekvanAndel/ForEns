/**
 * Significant-weather alerts for the Nowcast hero.
 *
 * The design renders this hero *conditionally* — its README is explicit that it is
 * "not rain-only": Westkapelle shows a wind alert with no precipitation at all, and
 * Maastricht shows no hero because nothing is happening. index.html has no
 * equivalent, so the thresholds are defined here.
 *
 * Thresholds follow KNMI's public warning practice, one step below the official
 * code-yellow criteria — this is a "worth knowing" hero, not a weather warning, and
 * over-firing it would train people to ignore it.
 *
 * ## The words are not here
 *
 * Every sentence comes from `core/i18n/alertStrings`, and the numbers in them are
 * converted to the reader's own units on the way. That was not true for a long while:
 * the headlines were Dutch string literals built right here, so the one block on the
 * page that says something urgent was the one block that ignored the language the app
 * was set to — and so was the notification built from it, since both read these same
 * fields.
 *
 * What is left in this file is the measuring: which condition wins, at what threshold,
 * and with which figure. That is the part that must not be duplicated anywhere — see
 * `docs/push_contract.md`.
 */
import { threshold } from '../thresholds';
import { alertPhrases } from '../i18n/alertStrings';
import { convTemp, convWind, tempUnitLabel, windUnitLabel } from '../i18n/units';
import type { LangCode } from '../i18n/strings';
import type { TempUnit, WindUnit } from '../i18n/units';
import type { ForecastModel, Hour } from './types';
import type { NowcastProfile } from '../radar/types';

export type AlertKind = 'rain' | 'wind' | 'storm' | 'fog' | 'frost' | 'heat';
export type AlertSeverity = 'light' | 'heavy';

export interface WeatherAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  /** Phosphor icon name for the eyebrow. */
  icon: string;
  /** Eyebrow label, e.g. "Wind". In the app's language, sentence case per the
   *  design system. */
  label: string;
  /** The headline sentence. */
  headline: string;
  /** The supporting line beneath it. */
  sub: string;
  /** Bar heights, 0–100, for the nowcast profile inside the hero. */
  bars: number[];
}

/** Gusts, km/h. KNMI issues code yellow at 75; 60 is "you would want to know". */
const GUST_ALERT = threshold('alert.gust');
const GUST_HEAVY = threshold('alert.gustHeavy');
/** Thunderstorm WMO codes. Not a boundary anyone chose: the code says what it says. */
const STORM_CODES = new Set([95, 96, 99]);
/** Fog WMO codes, likewise. */
const FOG_CODES = new Set([45, 48]);
/** Precipitation over the alert window, mm. */
const RAIN_ALERT_MM = threshold('alert.rain');
const RAIN_HEAVY_MM = threshold('alert.rainHeavy');
/** Frost and heat, °C. */
const FROST_BELOW = threshold('alert.frost');
const HEAT_ABOVE = threshold('alert.heat');

/** How far ahead the hero looks. The design's bars span two hours, but wind and
 *  storm are worth flagging over the rest of the day. */
const ALERT_WINDOW_HOURS = threshold('alert.window');

/** Flat bars, used when there is no nowcast profile to draw. */
const FLAT_BARS = [4, 4, 4, 4];

/**
 * How the alert is written: in whose language, and in whose units.
 *
 * Defaulted throughout, so a caller that has no preferences to hand — a test, the
 * widget writer before they load — still gets a sentence rather than an exception.
 */
export interface AlertOptions {
  lang?: LangCode;
  tempUnit?: TempUnit;
  windUnit?: WindUnit;
  /** How far ahead to look. See `ALERT_WINDOW_HOURS`. */
  hoursAhead?: number;
}

function barsFrom(profile: NowcastProfile | null): number[] {
  if (!profile || !profile.bars.length) return FLAT_BARS;
  return profile.bars.map((b) => Math.round(b.height));
}

const fmtMm = (mm: number) => mm.toFixed(1).replace('.', ',');

/**
 * Decide whether anything is worth a hero, and describe it.
 *
 * Only the most severe single condition is returned: the design gives the hero one
 * headline, and stacking three warnings into it would break the layout and bury the
 * one that matters. Order of precedence is by how much it should change behaviour —
 * storm, then wind, then rain, then fog, then frost, then heat.
 */
export function deriveAlert(
  model: ForecastModel | null,
  profile: NowcastProfile | null,
  opts: AlertOptions = {}
): WeatherAlert | null {
  if (!model) return null;
  const window: Hour[] = model.futureHours.slice(0, opts.hoursAhead ?? ALERT_WINDOW_HOURS);
  if (!window.length) return null;

  const lang = opts.lang ?? 'nl';
  const tempUnit = opts.tempUnit ?? 'C';
  const windUnit = opts.windUnit ?? 'kmh';
  const p = alertPhrases(lang);

  /** A wind speed as the reader has asked to see it, unit and all. */
  const wind = (kmh: number) => `${convWind(kmh, windUnit) ?? 0} ${windUnitLabel(windUnit, lang)}`;
  const temp = (c: number) => `${convTemp(c, tempUnit) ?? 0} ${tempUnitLabel(tempUnit)}`;

  const bars = barsFrom(profile);
  const maxGust = Math.max(0, ...window.map((h) => h.gusts ?? 0));
  const maxWind = Math.max(0, ...window.map((h) => h.wind ?? 0));
  const storm = window.find((h) => STORM_CODES.has(h.wmo));
  const fog = window.find((h) => FOG_CODES.has(h.wmo));
  const temps = window.map((h) => h.temp).filter((t): t is number => t != null);
  const minTemp = temps.length ? Math.min(...temps) : null;
  const maxTemp = temps.length ? Math.max(...temps) : null;

  // Prefer the nowcast's own total for rain, since it is the higher-resolution
  // source for the next two hours; fall back to the hourly model beyond that.
  const rainMm = profile?.wet
    ? profile.totalMm
    : window.reduce((s, h) => s + (h.precip ?? 0), 0);

  const inHours = (h: Hour) => {
    const idx = window.indexOf(h);
    return idx <= 0 ? p.now : p.inHours(idx);
  };

  if (storm) {
    return {
      kind: 'storm', severity: 'heavy', icon: 'cloud-lightning', label: p.labels.storm,
      headline: p.stormHeadline(inHours(storm)),
      sub: p.stormSub(wind(maxGust)),
      bars,
    };
  }

  if (maxGust >= GUST_ALERT) {
    const heavy = maxGust >= GUST_HEAVY;
    return {
      kind: 'wind',
      severity: heavy ? 'heavy' : 'light',
      icon: 'wind', label: p.labels.wind,
      headline: heavy ? p.windHeavyHeadline(wind(maxGust)) : p.windHeadline(wind(maxGust)),
      sub: heavy ? p.windHeavySub : p.windSub(wind(maxWind)),
      bars,
    };
  }

  if (rainMm >= RAIN_ALERT_MM) {
    const heavy = rainMm >= RAIN_HEAVY_MM;
    const starts = profile?.startsInMin;
    const when =
      starts == null ? p.comingHours
        : starts === 0 ? p.now
          : starts < 60 ? p.inMinutes(starts)
            : p.inHours(Math.round(starts / 60));
    return {
      kind: 'rain',
      severity: heavy ? 'heavy' : 'light',
      icon: 'cloud-rain', label: p.labels.rain,
      headline: heavy ? p.rainHeavyHeadline(when) : p.rainHeadline(when),
      // No confidence figure. The nowcast's `confidence` is a function of lead time
      // alone — 95 falling to 50 as the shower moves out to the end of the run — and
      // says nothing about how sure the model is of *this* shower. Printed as
      // "zekerheid 91%" beside a millimetre total it reads as a verified probability,
      // which is a good deal more than it is.
      sub: p.rainSub(`${fmtMm(rainMm)} mm`),
      bars,
    };
  }

  if (fog) {
    return {
      kind: 'fog', severity: 'light', icon: 'cloud-fog', label: p.labels.fog,
      headline: p.fogHeadline(inHours(fog)),
      sub: p.fogSub,
      bars,
    };
  }

  if (minTemp != null && minTemp < FROST_BELOW) {
    return {
      kind: 'frost', severity: 'light', icon: 'thermometer-simple', label: p.labels.frost,
      headline: p.frostHeadline(temp(minTemp)),
      sub: p.frostSub,
      bars,
    };
  }

  if (maxTemp != null && maxTemp > HEAT_ABOVE) {
    return {
      kind: 'heat', severity: 'light', icon: 'sun', label: p.labels.heat,
      headline: p.heatHeadline(temp(maxTemp)),
      sub: p.heatSub,
      bars,
    };
  }

  // Nothing significant: the design renders no hero at all.
  return null;
}
