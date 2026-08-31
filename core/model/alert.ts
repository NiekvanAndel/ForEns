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
 */
import type { ForecastModel, Hour } from './types';
import type { NowcastProfile } from '../radar/types';

export type AlertKind = 'rain' | 'wind' | 'storm' | 'fog' | 'frost' | 'heat';
export type AlertSeverity = 'light' | 'heavy';

export interface WeatherAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  /** Phosphor icon name for the eyebrow. */
  icon: string;
  /** Eyebrow label, e.g. "Wind". Dutch, sentence case per the design system. */
  label: string;
  /** The headline sentence. */
  headline: string;
  /** The supporting line beneath it. */
  sub: string;
  /** Bar heights, 0–100, for the nowcast profile inside the hero. */
  bars: number[];
}

/** Gusts, km/h. KNMI issues code yellow at 75; 60 is "you would want to know". */
const GUST_ALERT = 60;
const GUST_HEAVY = 75;
/** Thunderstorm WMO codes. */
const STORM_CODES = new Set([95, 96, 99]);
/** Fog WMO codes. */
const FOG_CODES = new Set([45, 48]);
/** Precipitation over the alert window, mm. */
const RAIN_ALERT_MM = 1.0;
const RAIN_HEAVY_MM = 5.0;
/** Frost and heat, °C. */
const FROST_BELOW = 0;
const HEAT_ABOVE = 30;

/** How far ahead the hero looks. The design's bars span two hours, but wind and
 *  storm are worth flagging over the rest of the day. */
const ALERT_WINDOW_HOURS = 12;

/** Flat bars, used when there is no nowcast profile to draw. */
const FLAT_BARS = [4, 4, 4, 4];

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
  hoursAhead = ALERT_WINDOW_HOURS
): WeatherAlert | null {
  if (!model) return null;
  const window: Hour[] = model.futureHours.slice(0, hoursAhead);
  if (!window.length) return null;

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
    return idx <= 0 ? 'nu' : `over ${idx} uur`;
  };

  if (storm) {
    return {
      kind: 'storm', severity: 'heavy', icon: 'cloud-lightning', label: 'Onweer',
      headline: `Onweer verwacht ${inHours(storm)}`,
      sub: `Windstoten tot ${Math.round(maxGust)} km/u. Zet los spul vast en blijf binnen tijdens de bui.`,
      bars,
    };
  }

  if (maxGust >= GUST_ALERT) {
    const heavy = maxGust >= GUST_HEAVY;
    return {
      kind: 'wind',
      severity: heavy ? 'heavy' : 'light',
      icon: 'wind', label: 'Wind',
      headline: heavy
        ? `Zware windstoten tot ${Math.round(maxGust)} km/u`
        : `Harde wind, windstoten tot ${Math.round(maxGust)} km/u`,
      sub: heavy
        ? 'Kans op schade aan bomen en losse voorwerpen. Rijd voorzichtig op open wegen.'
        : `Gemiddeld ${Math.round(maxWind)} km/u. Let op bij het fietsen en op de snelweg.`,
      bars,
    };
  }

  if (rainMm >= RAIN_ALERT_MM) {
    const heavy = rainMm >= RAIN_HEAVY_MM;
    const starts = profile?.startsInMin;
    const when =
      starts == null ? 'de komende uren'
        : starts === 0 ? 'nu'
          : starts < 60 ? `over ${starts} minuten`
            : `over ${Math.round(starts / 60)} uur`;
    return {
      kind: 'rain',
      severity: heavy ? 'heavy' : 'light',
      icon: 'cloud-rain', label: 'Neerslag',
      headline: heavy ? `Zware bui ${when}` : `Regen ${when}`,
      sub: `Naar verwachting ${fmtMm(rainMm)} mm${
        profile?.confidence != null ? ` · zekerheid ${profile.confidence}%` : ''
      }.`,
      bars,
    };
  }

  if (fog) {
    return {
      kind: 'fog', severity: 'light', icon: 'cloud-fog', label: 'Zicht',
      headline: `Mist ${inHours(fog)}`,
      sub: 'Beperkt zicht op de weg. Houd afstand en gebruik mistlampen waar nodig.',
      bars,
    };
  }

  if (minTemp != null && minTemp < FROST_BELOW) {
    return {
      kind: 'frost', severity: 'light', icon: 'thermometer-simple', label: 'Vorst',
      headline: `Vorst, tot ${Math.round(minTemp)} °C`,
      sub: 'Kans op gladheid en schade aan gewassen. Bescherm kwetsbare planten.',
      bars,
    };
  }

  if (maxTemp != null && maxTemp > HEAT_ABOVE) {
    return {
      kind: 'heat', severity: 'light', icon: 'sun', label: 'Warmte',
      headline: `Warm, tot ${Math.round(maxTemp)} °C`,
      sub: 'Drink genoeg en zoek de schaduw op tijdens de warmste uren.',
      bars,
    };
  }

  // Nothing significant: the design renders no hero at all.
  return null;
}
