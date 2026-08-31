/**
 * Assembling one day's hours for a detail sheet.
 *
 * The web app worked this out inline inside each popup renderer, which is why the
 * six popups disagreed about it in places. It is one decision, so it is made once
 * here:
 *
 *  - Days 0–1 use the HARMONIE hourly series, which is the highest resolution the
 *    app has and only runs 48 hours.
 *  - Day 0 also prepends the observed hours already past, so the sheet shows the
 *    whole calendar day rather than starting at "now".
 *  - Day 2 onward uses the ECMWF IFS hourly series, which is three-hourly beyond
 *    90 hours — flagged per hour so a chart can draw those as sparser samples
 *    rather than implying detail that is not there. That series carries the whole
 *    hour, not only its millimetres, so every section of the sheet reads the same
 *    hours; the web app fetched a different subset per popup.
 */
import type { ForecastModel, Day, Hour } from './types';
import type { DayEnsemble } from '../sources/ensembleHourly';

export interface DetailHour {
  time: string;
  hour: number;
  /** Millimetres in this hour. */
  precip: number;
  wmo: number;
  temp: number | null;
  wind: number | null;
  gusts: number | null;
  windDir: number | null;
  humidity: number | null;
  dewpoint: number | null;
  sunMin: number | null;
  et0h: number | null;
  /** True for an hour that has already happened. */
  isPast: boolean;
  /** True where the model is three-hourly, so this sample stands for three hours. */
  is3h: boolean;
  /** Per-hour ensemble, once the day's hourly ensemble has loaded. */
  ens?: DayEnsemble[string];
}

export type DetailSource = 'harmonie' | 'ifs' | 'observed';

export interface DayDetail {
  date: string;
  hours: DetailHour[];
  /** Which model supplied the hourly series. */
  source: DetailSource;
  /** Label for the source line, e.g. "HARMONIE-AROME". */
  sourceLabel: string;
  /** Index of the day within the forecast, 0 being today. */
  dayIndex: number;
}

function fromHour(h: Hour, isPast: boolean): DetailHour {
  return {
    time: h.time,
    hour: parseInt(h.time.slice(11, 13), 10),
    precip: h.precip ?? 0,
    wmo: h.wmo ?? 0,
    temp: h.temp,
    wind: h.wind,
    gusts: h.gusts ?? null,
    windDir: h.windDir ?? null,
    humidity: h.humidity,
    dewpoint: h.dewpoint ?? null,
    sunMin: h.sunMin ?? null,
    et0h: h.et0h ?? null,
    isPast,
    is3h: false,
  };
}

export function buildDayDetail(
  model: ForecastModel,
  day: Day,
  ensemble?: DayEnsemble
): DayDetail {
  const dayIndex = model.days.findIndex((d) => d.date === day.date);
  const onThisDay = (t: string) => t.slice(0, 10) === day.date;

  const harmonieHours = model.futureHours.filter((h) => onThisDay(h.time));
  const observedHours = model.pastHours.filter((h) => onThisDay(h.time));

  let hours: DetailHour[];
  let source: DetailSource;

  if (day.useHarm && harmonieHours.length) {
    // Today keeps its already-observed hours, so the sheet covers the whole day.
    hours = [
      ...observedHours.map((h) => fromHour(h, true)),
      ...harmonieHours.map((h) => fromHour(h, false)),
    ];
    source = 'harmonie';
  } else {
    const ifsHours = model.hresHoursByDay[day.date] ?? [];
    if (ifsHours.length) {
      hours = ifsHours.map((h) => ({
        time: h.time,
        hour: h.hour,
        precip: h.precip,
        wmo: h.wmo,
        temp: h.temp,
        wind: h.wind,
        gusts: h.gusts,
        windDir: h.windDir,
        humidity: h.humidity,
        dewpoint: h.dewpoint,
        sunMin: h.sunMin,
        et0h: h.et0h,
        isPast: false,
        is3h: h.is3h,
      }));
      source = 'ifs';
    } else if (harmonieHours.length || observedHours.length) {
      // Beyond HARMONIE's range but before IFS hourly has landed.
      hours = [
        ...observedHours.map((h) => fromHour(h, true)),
        ...harmonieHours.map((h) => fromHour(h, false)),
      ];
      source = observedHours.length && !harmonieHours.length ? 'observed' : 'harmonie';
    } else {
      hours = [];
      source = 'ifs';
    }
  }

  // Sunshine minutes from method 6, where the day carries them per hour.
  if (day.sun6Hourly) {
    for (const h of hours) {
      const m = day.sun6Hourly[h.time];
      if (m != null) h.sunMin = m;
    }
  }

  if (ensemble) {
    for (const h of hours) {
      const e = ensemble[h.time];
      if (e) h.ens = e;
    }
  }

  hours.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  const sourceLabel =
    source === 'harmonie' ? 'HARMONIE-AROME'
      : source === 'observed' ? 'Waarneming'
        : 'ECMWF IFS';

  return { date: day.date, hours, source, sourceLabel, dayIndex: Math.max(0, dayIndex) };
}

/**
 * A plain-language reading of the day's precipitation ensemble.
 *
 * The web app built this string inline. It is the most useful sentence on the
 * sheet — the whole point of carrying 51 members is being able to say how much the
 * members disagree — so it is worth stating precisely rather than as "kans op regen".
 */
export function precipNarrative(day: Day): string | null {
  if (!day.ensLoaded) return null;
  const { pChance, precipP25, precipP90, precipMedian, p5mm, p20mm } = day;

  if (pChance <= 5) return 'De leden zijn het eens: vrijwel zeker droog.';

  const parts: string[] = [`${Math.round(pChance)}% kans op neerslag`];
  if (precipP25 > 0) {
    parts.push(`75% kans op meer dan ${fmt(precipP25)} mm`);
  }
  if (precipP90 > 0) {
    parts.push(`10% kans op meer dan ${fmt(precipP90)} mm`);
  }
  if (p20mm >= 10) {
    parts.push(`${Math.round(p20mm)}% kans op meer dan 20 mm`);
  } else if (p5mm >= 20) {
    parts.push(`${Math.round(p5mm)}% kans op meer dan 5 mm`);
  }

  // A median of zero with a high p90 is the case worth naming: most members stay
  // dry, a few are very wet, and an average would hide both.
  if (precipMedian === 0 && precipP90 > 1) {
    parts.push('de meeste leden blijven droog, enkele zijn nat');
  }

  return parts.join(' · ');
}

const fmt = (v: number) => v.toFixed(1).replace('.', ',');

/** How much the members disagree, as a label for the spread badge. */
export function spreadLabel(day: Day): 'eens' | 'redelijk eens' | 'oneens' | null {
  if (!day.ensLoaded) return null;
  const range = day.precipP90 - day.precipP10;
  const tempRange = day.tempMaxP90 - day.tempMaxP10;
  // Either measure can carry the disagreement, so the wider one decides.
  const score = Math.max(range / 5, tempRange / 6);
  if (score < 0.5) return 'eens';
  if (score < 1.2) return 'redelijk eens';
  return 'oneens';
}
