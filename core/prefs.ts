/**
 * User preferences.
 *
 * Ported from index.html's PREFS, extended with the settings the ExactCast design
 * adds (theme mode, model choice, spread toggle, notifications).
 *
 * This module is pure: it defines the shape, the defaults and the merge, and knows
 * nothing about storage. The app persists it through AsyncStorage and the AgroExact
 * token through expo-secure-store, which is why the token is not a field here.
 */
import type { LangCode } from './i18n/strings';
import type { PresUnit, TempUnit, WindUnit, FontSizePref } from './i18n/units';

export type ThemeMode = 'light' | 'dark' | 'auto';
/** Which deterministic model drives days 3–14. */
export type ModelPref = 'ecmwf' | 'gfs' | 'mix';
/** Which source drives the 0–2h view. */
export type ShortModelPref = 'nowcast' | 'radar';

export interface SavedLocation {
  name: string;
  lat: number;
  lon: number;
  /** Region/country line, shown under the name. */
  sub?: string;
  /** Set once a nearby AgroExact station has been matched. The design turns a
   *  station-backed location green, so this drives colour as well as data. */
  stationId?: string;
  stationName?: string;
  /**
   * The device's own position, kept up to date by `DeviceLocationProvider`.
   *
   * There is at most one, and it is the first page. The GPS arrow in the top bar is
   * its page indicator: filled when this is the location being viewed, hollow when
   * one of the saved places is. It used to be a button that appended wherever you
   * happened to be as a new pin, which grew the list by one every time it was
   * pressed and never said which of them was you.
   */
  current?: boolean;
}

export interface Prefs {
  lang: LangCode;
  tempUnit: TempUnit;
  windUnit: WindUnit;
  presUnit: PresUnit;
  theme: ThemeMode;
  fontSize: FontSizePref;
  locations: SavedLocation[];
  /** Index into `locations` of the location being viewed. */
  activeLocation: number;
  useHarmonie: boolean;
  agroExact: boolean;
  agroBase: string;
  model: ModelPref;
  shortModel: ShortModelPref;
  showSpread: boolean;
  notifyRain: boolean;
  notifyWind: boolean;
  notifyFrost: boolean;
  quietHours: boolean;
}

/** 's-Hertogenbosch is the web app's default and the design's station-backed example. */
export const DEFAULT_LOCATION: SavedLocation = {
  name: "'s-Hertogenbosch",
  lat: 51.6978,
  lon: 5.3037,
};

export const DEFAULT_PREFS: Prefs = {
  lang: 'nl',
  tempUnit: 'C',
  windUnit: 'kmh',
  presUnit: 'hPa',
  theme: 'auto',
  fontSize: 'md',
  locations: [DEFAULT_LOCATION],
  activeLocation: 0,
  useHarmonie: true,
  agroExact: false,
  agroBase: '',
  model: 'ecmwf',
  shortModel: 'nowcast',
  showSpread: true,
  notifyRain: false,
  notifyWind: false,
  notifyFrost: false,
  quietHours: true,
};

/**
 * Merge stored preferences over the defaults, dropping anything malformed.
 *
 * Stored state outlives the code that wrote it, so a field removed or retyped in a
 * later version must not be able to crash startup — an unreadable value falls back
 * to its default rather than propagating.
 */
export function mergePrefs(stored: unknown): Prefs {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PREFS };
  const s = stored as Partial<Prefs>;
  const out: Prefs = { ...DEFAULT_PREFS };

  const take = <K extends keyof Prefs>(key: K, valid: (v: unknown) => boolean) => {
    if (s[key] !== undefined && valid(s[key])) out[key] = s[key] as Prefs[K];
  };
  const oneOf = (...vals: string[]) => (v: unknown) => typeof v === 'string' && vals.includes(v);
  const bool = (v: unknown) => typeof v === 'boolean';

  take('lang', oneOf('nl', 'en', 'de', 'fr', 'es'));
  take('tempUnit', oneOf('C', 'F', 'K'));
  take('windUnit', oneOf('kmh', 'ms', 'kn', 'bft'));
  take('presUnit', oneOf('hPa', 'mbar', 'inHg'));
  take('theme', oneOf('light', 'dark', 'auto'));
  take('fontSize', oneOf('sm', 'md', 'lg'));
  take('model', oneOf('ecmwf', 'gfs', 'mix'));
  take('shortModel', oneOf('nowcast', 'radar'));
  take('agroBase', (v) => typeof v === 'string');
  for (const k of [
    'useHarmonie', 'agroExact', 'showSpread',
    'notifyRain', 'notifyWind', 'notifyFrost', 'quietHours',
  ] as const) {
    take(k, bool);
  }

  if (Array.isArray(s.locations)) {
    const valid = s.locations.filter(
      (l): l is SavedLocation =>
        !!l && typeof l.name === 'string' &&
        Number.isFinite(l.lat) && Number.isFinite(l.lon)
    );
    // An empty list would leave the app with nothing to show, so keep the default.
    if (valid.length) out.locations = valid;
  }

  if (typeof s.activeLocation === 'number') {
    // Clamp rather than trust: the list may have shrunk since it was written.
    out.activeLocation = Math.min(Math.max(0, Math.floor(s.activeLocation)), out.locations.length - 1);
  }

  return out;
}

/** Where the device is, if it has been resolved. The first page, by construction. */
export function currentLocationIndex(prefs: Prefs): number {
  return prefs.locations.findIndex((l) => l.current);
}

/**
 * Put the device's position at the head of the list, replacing the previous one.
 *
 * Returns a new `Prefs`. The selected place is kept selected across the change: a
 * position fix arriving in the background must not move the reader off the page
 * they were reading.
 */
export function withCurrentLocation(prefs: Prefs, loc: SavedLocation): Prefs {
  const fix: SavedLocation = { ...loc, current: true };
  const at = currentLocationIndex(prefs);
  if (at >= 0) {
    const locations = prefs.locations.map((l, i) => (i === at ? fix : l));
    return { ...prefs, locations };
  }
  return {
    ...prefs,
    locations: [fix, ...prefs.locations],
    // Everything shifted one to the right, the viewed page included.
    activeLocation: prefs.activeLocation + 1,
  };
}

/** The location currently being viewed, always defined. */
export function activeLocation(prefs: Prefs): SavedLocation {
  return prefs.locations[prefs.activeLocation] ?? prefs.locations[0] ?? DEFAULT_LOCATION;
}
