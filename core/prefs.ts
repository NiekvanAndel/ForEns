/**
 * User preferences.
 *
 * Ported from index.html's PREFS, extended with the settings the ExactCast design
 * adds (theme mode, model choice, spread toggle, notifications).
 *
 * This module is pure: it defines the shape, the defaults and the merge, and knows
 * nothing about storage. The app persists it through AsyncStorage and the AgroExact
 * OAuth tokens through expo-secure-store, which is why no credential is a field here.
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
  /** Set once an AgroExact station speaks for this location. The design turns a
   *  station-backed location green, so this drives colour as well as data. */
  stationId?: string;
  stationName?: string;
  /**
   * Which integration created this location, if any.
   *
   * A place someone searched for and saved is theirs; a place the AgroExact sync
   * created stands for a station on their account. Only the second kind is removed
   * again when that station leaves the account, which is why the two have to be
   * distinguishable rather than inferred from `stationId`.
   */
  source?: 'agroexact';
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

/**
 * A connected integration.
 *
 * Kept in preferences rather than in memory because Instellingen has to be able to
 * say "verbonden met …" before any network call, and because an expired token must
 * not read as "never connected" — the difference is a warning versus an empty row.
 * Credentials are not here; they are in expo-secure-store. See `state/auth.tsx`.
 */
export interface AgroIntegration {
  /** True from the first successful sign-in until the user disconnects. */
  connected: boolean;
  /** Whoever is signed in, for the settings row. Null when AuthKit gave no email. */
  account: string | null;
  /**
   * Opt-in: let the device's own page use a station within `AGRO_MAX_DISTANCE_KM`.
   *
   * Off by default. Station locations are bound by id, so this is the one place
   * where proximity decides anything — and where you are is the one location the
   * user did not choose, so it is the one place that needs asking first.
   */
  useForCurrentLocation: boolean;
  /** Epoch ms of the last completed station sync, for the settings row. */
  lastSyncMs: number | null;
}

export interface Integrations {
  agroexact?: AgroIntegration;
}

export const DEFAULT_AGRO_INTEGRATION: AgroIntegration = {
  connected: false,
  account: null,
  useForCurrentLocation: false,
  lastSyncMs: null,
};

/**
 * Which blocks 'Actueel' shows, and in which order.
 *
 * Stored as an order plus a hidden set, rather than as the list of visible blocks in
 * order. The difference only shows up later: a block added in a future version is
 * not in either list, so it appears — in its natural place — for someone who
 * arranged their grid last month. The straightforward "here are my blocks" shape
 * would have hidden every block the app learns to draw from then on, silently, from
 * exactly the people who had bothered to arrange it.
 *
 * Both lists are ids, and an id the app no longer knows is simply skipped.
 */
export interface TileLayout {
  /** Block ids in the order they are shown. Anything not named here follows, in the
   *  order `modelTiles` produced it. */
  order: string[];
  /** Block ids switched off. */
  hidden: string[];
}

export const DEFAULT_TILE_LAYOUT: TileLayout = { order: [], hidden: [] };

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
  integrations: Integrations;
  model: ModelPref;
  shortModel: ShortModelPref;
  showSpread: boolean;
  notifyRain: boolean;
  notifyWind: boolean;
  notifyFrost: boolean;
  quietHours: boolean;
  /** The 'Actueel' grid's arrangement. See `TileLayout`. */
  tiles: TileLayout;
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
  integrations: {},
  model: 'ecmwf',
  shortModel: 'nowcast',
  showSpread: true,
  notifyRain: false,
  notifyWind: false,
  notifyFrost: false,
  quietHours: true,
  tiles: DEFAULT_TILE_LAYOUT,
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
  for (const k of [
    'useHarmonie', 'showSpread',
    'notifyRain', 'notifyWind', 'notifyFrost', 'quietHours',
  ] as const) {
    take(k, bool);
  }

  // Integrations are stored state that outlives the code that wrote them, so each
  // field is taken on its own and anything missing falls back to the default rather
  // than leaving a half-built object behind.
  const agro = (s.integrations as Integrations | undefined)?.agroexact;
  if (agro && typeof agro === 'object') {
    out.integrations = {
      agroexact: {
        connected: typeof agro.connected === 'boolean' ? agro.connected : false,
        account: typeof agro.account === 'string' ? agro.account : null,
        useForCurrentLocation:
          typeof agro.useForCurrentLocation === 'boolean' ? agro.useForCurrentLocation : false,
        lastSyncMs: typeof agro.lastSyncMs === 'number' ? agro.lastSyncMs : null,
      },
    };
  }

  // Ids only, and both halves independently: a stored layout that lost one of them
  // must not cost the reader the other.
  const ids = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  const tiles = s.tiles as TileLayout | undefined;
  if (tiles && typeof tiles === 'object') {
    out.tiles = { order: ids(tiles.order), hidden: ids(tiles.hidden) };
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

/** The AgroExact integration as stored, or the disconnected default. */
export function agroIntegration(prefs: Prefs): AgroIntegration {
  return prefs.integrations.agroexact ?? DEFAULT_AGRO_INTEGRATION;
}

/** Locations the AgroExact sync owns, in list order. */
export function stationLocations(prefs: Prefs): SavedLocation[] {
  return prefs.locations.filter((l) => l.source === 'agroexact');
}

/** One station, as the sync needs it: the station itself plus the town it stands in. */
export interface StationPlace {
  stationId: string;
  stationName: string;
  lat: number;
  lon: number;
  /** The town the coordinates fall in, from a reverse lookup. */
  place: string;
  sub?: string;
}

/**
 * Reconcile the saved locations with the stations on the account.
 *
 * The account is the authority over its own stations, and nothing else: locations
 * the user saved themselves are left exactly where they are, in their order. A
 * station that has gone from the account takes its location with it — that is the
 * point of the sync — but a station that is merely absent from a failed request must
 * never reach this function, or a network blip would delete someone's pages.
 *
 * Two stations in the same town produce two locations. They are different
 * instruments in different fields, and collapsing them would leave the reader unable
 * to say which one the numbers came from.
 *
 * The viewed page is kept on the same *location*, not the same index: adding or
 * removing a station must not silently move someone to a different place.
 */
export function syncStationLocations(prefs: Prefs, stations: readonly StationPlace[]): Prefs {
  const viewed = prefs.locations[prefs.activeLocation];
  const byId = new Map(stations.map((s) => [s.stationId, s]));

  const kept: SavedLocation[] = [];
  const seen = new Set<string>();

  for (const l of prefs.locations) {
    if (l.source !== 'agroexact') {
      kept.push(l);
      continue;
    }
    const station = l.stationId ? byId.get(l.stationId) : undefined;
    if (!station) continue; // the station left the account
    seen.add(station.stationId);
    // A station can be renamed or moved; the location follows it.
    kept.push({
      ...l,
      name: station.place,
      sub: station.sub ?? l.sub,
      lat: station.lat,
      lon: station.lon,
      stationId: station.stationId,
      stationName: station.stationName,
      source: 'agroexact',
    });
  }

  for (const s of stations) {
    if (seen.has(s.stationId)) continue;
    kept.push({
      name: s.place,
      sub: s.sub,
      lat: s.lat,
      lon: s.lon,
      stationId: s.stationId,
      stationName: s.stationName,
      source: 'agroexact',
    });
  }

  // The app must always have somewhere to show.
  const locations = kept.length ? kept : [DEFAULT_LOCATION];
  const at = viewed ? locations.indexOf(viewed) : -1;
  const activeLocation =
    at >= 0
      ? at
      : Math.min(Math.max(0, prefs.activeLocation), locations.length - 1);

  return { ...prefs, locations, activeLocation };
}

/**
 * Forget the AgroExact integration, keeping the places it created.
 *
 * A town does not stop existing because a token expired, and someone who has been
 * swiping to Rosmalen every morning should keep that page — it simply goes back to
 * being an ordinary Open-Meteo location. Only the station binding is dropped.
 */
export function unlinkStationLocations(prefs: Prefs): Prefs {
  return {
    ...prefs,
    locations: prefs.locations.map((l) =>
      l.source === 'agroexact'
        ? { ...l, source: undefined, stationId: undefined, stationName: undefined }
        : l
    ),
    integrations: {},
  };
}

/**
 * The blocks to draw, in the reader's order, with the hidden ones dropped.
 *
 * `all` is every block the app can draw, in its natural order. Ids in `order` come
 * first, in that order; anything the layout has never heard of keeps its natural
 * place behind them, which is what lets a new block appear for someone who arranged
 * their grid before it existed.
 */
export function arrangeTiles<T extends { id: string }>(
  all: readonly T[],
  layout: TileLayout
): T[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  const named = layout.order
    .map((id) => byId.get(id))
    .filter((t): t is T => t !== undefined);
  const seen = new Set(named.map((t) => t.id));
  const rest = all.filter((t) => !seen.has(t.id));
  const hidden = new Set(layout.hidden);
  return [...named, ...rest].filter((t) => !hidden.has(t.id));
}

/** The same, but keeping the hidden blocks — what the editor lists. */
export function arrangeAllTiles<T extends { id: string }>(
  all: readonly T[],
  layout: TileLayout
): T[] {
  return arrangeTiles(all, { order: layout.order, hidden: [] });
}

/**
 * Move a block, writing the whole arrangement back.
 *
 * `visibleIds` is what the editor is showing, hidden blocks included, so the stored
 * order is rewritten from the list the reader was actually looking at. Storing only
 * the moved pair instead would leave the rest of the order implicit, and the next
 * new block would land in the middle of somebody's carefully arranged grid.
 */
export function reorderTiles(layout: TileLayout, ids: string[], from: number, to: number): TileLayout {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return layout;
  const order = [...ids];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved as string);
  return { ...layout, order };
}

/** Switch one block on or off. */
export function toggleTile(layout: TileLayout, id: string): TileLayout {
  const hidden = layout.hidden.includes(id)
    ? layout.hidden.filter((h) => h !== id)
    : [...layout.hidden, id];
  return { ...layout, hidden };
}
