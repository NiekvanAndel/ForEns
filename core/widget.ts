/**
 * The widget payload.
 *
 * The widget is SwiftUI and cannot run any of this app's TypeScript, so the two
 * communicate through a JSON blob in the shared App Group container. This module
 * defines that contract and builds the payload from the same `ForecastModel` the
 * screens render, which is the reason the app and the widget cannot disagree about
 * the weather.
 *
 * Everything is pre-formatted here rather than in Swift: unit conversion, the
 * comma decimals, the day names. The widget then only lays out strings, so a
 * change to the user's units does not need a Swift change too.
 */
import type { ForecastModel } from './model/types';
import type { Prefs, SavedLocation } from './prefs';
import { convTemp, convWind, fmtMm, windUnitLabel, dayNames, wmoText } from './i18n';
import { layerRow } from './model/layers';
import type { WeatherAlert } from './model/alert';
import { wmoSymbol } from './model/conditions';

/** Bumped when the shape changes, so an old widget reading new data can bail out
 *  rather than render nonsense. */
export const WIDGET_PAYLOAD_VERSION = 1;

export interface WidgetHour {
  /** "14" — hour only; the widget has no room for minutes. */
  label: string;
  temp: string;
  mm: string;
  /** SF Symbol name, so the widget needs no icon mapping of its own. */
  symbol: string;
  wet: boolean;
}

export interface WidgetDay {
  /** "wo" — short day name in the user's language. */
  label: string;
  high: string;
  low: string;
  mm: string;
  symbol: string;
  /** Bar geometry as fractions, already scaled across the days shown. */
  barLeft: number;
  barWidth: number;
}

export interface WidgetPayload {
  version: number;
  /** When this was written, epoch milliseconds. */
  updatedMs: number;
  locationName: string;
  /** True when the location is backed by an AgroExact station, which the widget
   *  renders in green — the one place the design allows it. */
  station: boolean;
  stationName: string | null;
  temp: string;
  high: string;
  low: string;
  condition: string;
  symbol: string;
  wind: string;
  windUnit: string;
  precip24: string;
  humidity: string;
  /** Alert headline, when something is worth showing. */
  alertKind: string | null;
  alertHeadline: string | null;
  hours: WidgetHour[];
  days: WidgetDay[];
  /** 0–2h nowcast bar heights, 0–100. */
  nowcastBars: number[];
}

export interface BuildWidgetOptions {
  model: ForecastModel;
  prefs: Prefs;
  location: SavedLocation;
  alert?: WeatherAlert | null;
  nowcastBars?: number[];
  nowMs?: number;
}

export function buildWidgetPayload({
  model, prefs, location, alert, nowcastBars, nowMs,
}: BuildWidgetOptions): WidgetPayload {
  const now = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1];
  const today = model.days[0];
  const names = dayNames(prefs.lang);

  const dash = '—';
  const temp = (v: number | null | undefined) => {
    const c = convTemp(v ?? null, prefs.tempUnit);
    return c == null ? dash : `${c}°`;
  };

  const precip24 =
    model.pastHours.reduce((s, h) => s + (h.precip ?? 0), 0) +
    model.futureHours.slice(0, 24).reduce((s, h) => s + (h.precip ?? 0), 0);

  const shownDays = model.days.slice(0, 5);
  // One scale across the days shown, matching how the app draws them: a widget bar
  // that filled its own row would say nothing about which day is warmer.
  const lows = shownDays
    .map((d) => layerRow(d, 'temp').secondary)
    .filter((v): v is number => v != null);
  const highs = shownDays
    .map((d) => layerRow(d, 'temp').primary)
    .filter((v): v is number => v != null);
  const scaleLo = lows.length ? Math.min(...lows) : 0;
  const scaleHi = highs.length ? Math.max(...highs) : 1;
  const span = scaleHi - scaleLo || 1;

  return {
    version: WIDGET_PAYLOAD_VERSION,
    updatedMs: nowMs ?? Date.now(),
    locationName: location.name,
    station: !!location.stationId,
    stationName: location.stationName ?? null,
    temp: temp(now?.temp),
    high: temp(today?.hresTempMax ?? today?.tempHi),
    low: temp(today?.hresTempMin ?? today?.tempLo),
    condition: wmoText(now?.wmo ?? 3, prefs.lang),
    symbol: wmoSymbol(now?.wmo ?? 3, (now?.isDay ?? 1) === 1),
    wind: String(convWind(now?.wind ?? null, prefs.windUnit) ?? dash),
    windUnit: windUnitLabel(prefs.windUnit),
    precip24: fmtMm(precip24),
    humidity: now?.humidity != null ? String(now.humidity) : dash,
    alertKind: alert?.kind ?? null,
    alertHeadline: alert?.headline ?? null,

    hours: model.futureHours.slice(0, 6).map((h) => ({
      label: h.time.slice(11, 13),
      temp: temp(h.temp),
      mm: fmtMm(h.precip ?? 0),
      symbol: wmoSymbol(h.wmo, h.isDay === 1),
      wet: (h.precip ?? 0) > 0,
    })),

    days: shownDays.map((d) => {
      const row = layerRow(d, 'temp');
      const lo = row.secondary;
      const hi = row.primary;
      const date = new Date(d.date + 'T12:00:00Z');
      const left = lo != null ? (lo - scaleLo) / span : 0;
      const right = hi != null ? (hi - scaleLo) / span : 0;
      return {
        label: (names[date.getUTCDay()] ?? '').slice(0, 2),
        high: temp(hi),
        low: temp(lo),
        mm: fmtMm(layerRow(d, 'precip').primary ?? 0),
        symbol: wmoSymbol(d.dayIcon ?? d.wmo, true),
        barLeft: Math.min(1, Math.max(0, left)),
        barWidth: Math.min(1, Math.max(0.02, right - left)),
      };
    }),

    nowcastBars: nowcastBars ?? [],
  };
}
