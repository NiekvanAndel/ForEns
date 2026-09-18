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
import { sanitiseAlerts, type UserAlert } from './alerts';
import { distanceKm } from './sources/agroexact';
import { DEFAULT_OVERVIEW_LAYOUT, type WidgetSettings } from './overview';
import { DEFAULT_TILE_LAYOUT, type TileLayout } from './arrangement';
import { DEFAULT_NOW_LAYOUT } from './nowCards';

// Re-exported so the many callers that reach for these through `core/prefs` keep
// working: they are preferences to everything that uses them, and only the module
// graph cares that they are defined elsewhere.
export {
  arrangeTiles, arrangeAllTiles, reorderTiles, toggleTile, DEFAULT_TILE_LAYOUT,
} from './arrangement';
export type { TileLayout } from './arrangement';

/**
 * Which of the rule-based advice families speak.
 *
 * The layer is on by default — it is the reason the app is opened on a field — but a
 * grower with no sprayer is not served by a spray window, and somebody who wants only
 * the readings must be able to have only the readings. So: a master switch, and a set
 * of families switched off under it.
 *
 * Stored as what is *off*, for the same reason `TileLayout` is: a family added in a
 * later version then appears for someone who set this up last month, instead of being
 * withheld from exactly the people who bothered to arrange it.
 *
 * Switching a family off is not a filter over a result — nothing computes it. See
 * `core/model/fieldAdvice`.
 */
export interface AdviceLayer {
  /** The master switch. Off leaves every reading and removes every conclusion. */
  enabled: boolean;
  /** Family ids switched off. */
  hidden: string[];
}

export const DEFAULT_ADVICE_LAYER: AdviceLayer = { enabled: true, hidden: [] };

/** Whether one family speaks, master switch included. */
export function adviceFamilyOn(layer: AdviceLayer, id: string): boolean {
  return layer.enabled && !layer.hidden.includes(id);
}

/** The families that speak, out of everything the app can derive. */
export function enabledAdviceFamilies<T extends string>(
  all: readonly T[],
  layer: AdviceLayer
): T[] {
  return layer.enabled ? all.filter((id) => !layer.hidden.includes(id)) : [];
}

/** Switch one family on or off. */
export function toggleAdviceFamily(layer: AdviceLayer, id: string): AdviceLayer {
  const hidden = layer.hidden.includes(id)
    ? layer.hidden.filter((h) => h !== id)
    : [...layer.hidden, id];
  return { ...layer, hidden };
}

/**
 * How much certainty a reader wants before they act — the one setting the whole of
 * the add-on tier's certainty half runs on.
 *
 * "Voorzichtig" acts on the lower rungs of the ladder: a one-in-three chance of frost
 * is enough to go out and cover. "Afwachtend" waits for the forecast to commit.
 * Nobody has to know what p25 means, which is the point — the alternative was
 * percentile controls, and a grower who has to learn a statistics vocabulary to set
 * up an app has been handed the modeller's problem.
 */
export type RiskAppetite = 'cautious' | 'normal' | 'patient';

/**
 * AgroIntelligence — the second tier, as a switch.
 *
 * Everything in it is what the plan calls "alles wat pas ontstaat als je locaties
 * combineert, of wat over de verwachting zelf gaat": area conclusions, probabilities
 * and the comparison of windows. None of it replaces anything in the basis version,
 * which is what makes it separable — with this off the app is exactly the app it was.
 *
 * It is a licence flag in everything but name. When the add-on is sold, what sets
 * this is a subscription rather than a switch, and nothing else has to move: the
 * widgets that belong to the tier already declare it, and a tier that is off is not
 * drawn, not arranged and — this is the part that matters — **not fetched**.
 */
export interface AgroIntelLayer {
  enabled: boolean;
  risk: RiskAppetite;
}

export const DEFAULT_AGRO_INTEL: AgroIntelLayer = { enabled: false, risk: 'normal' };

/** Whether the add-on tier speaks at all. */
export function agroIntelOn(prefs: Pick<Prefs, 'agroIntel'>): boolean {
  return prefs.agroIntel.enabled;
}

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
   * The soil sensor that stands on this place, where one does.
   *
   * Separate from `stationId` because the two are different instruments and a place
   * can have either, both or neither: a weather pole measures the air above a region,
   * a soil sensor measures the water in one field. A location that has both shows the
   * soil blocks alongside the weather ones; a location that has only a soil sensor is
   * a field, named after the field.
   */
  soilStationId?: string;
  /** Its name at the time, for a list that reads before the sensors load. */
  soilStationName?: string;
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
  /** Their display name, when AuthKit gave one. Kept beside the email because the
   *  greeting on the overview page is drawn before the auth context is ready, and an
   *  email is not a name — see `greetingName`. */
  accountName?: string | null;
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
  /**
   * Whether the significant-weather block appears on 'Nu' at all.
   *
   * The outer of the two layers: with it off there is no block and no notification
   * of any kind, because a notification about something the app has been told not to
   * show is a contradiction. See `core/model/alert`.
   */
  alertsEnabled: boolean;
  /**
   * Whether the same alerts are also delivered as push, from the server.
   *
   * The inner layer, and a different promise from the block: a block is read when
   * the app is opened, and a push arrives whether it is or not. Off until someone
   * asks for it, and asking is what triggers the permission prompt — see
   * `core/push`.
   */
  pushEnabled: boolean;
  /**
   * Thresholds the reader set themselves, from a block on 'Actueel'.
   *
   * Alongside the six built-in conditions rather than instead of them: those are the
   * app's judgement about weather worth knowing, these are one person's about their
   * own crop. See `core/alerts`.
   */
  userAlerts: UserAlert[];
  /**
   * Which of the agro topics may notify, by id — see `core/notifyScope`.
   *
   * Opt-in, like every notification here, and stored as what was *asked for* rather
   * than as what is allowed: whether a topic may actually send also depends on
   * whether its component is switched on, and freezing that into storage would mean
   * switching a family back on silently left its notifications off.
   */
  notifyAgro: string[];
  notifyRain: boolean;
  notifyWind: boolean;
  notifyFrost: boolean;
  quietHours: boolean;
  /** Which rule-based advice is drawn. See `AdviceLayer`. */
  advice: AdviceLayer;
  /** The AgroIntelligence add-on, and what it is set to. See `AgroIntelLayer`. */
  agroIntel: AgroIntelLayer;
  /** The order of the cards on 'Nu'. See `core/nowCards`. */
  nowCards: TileLayout;
  /** The 'Actueel' grid's arrangement. See `TileLayout`. */
  tiles: TileLayout;
  /**
   * The same, kept separately for a location a soil sensor speaks for.
   *
   * A field's page has blocks a weather page never shows and, more to the point, a
   * different order worth having: on a field the suction and the refill room are what
   * you open the app for, and on a town it is the rain and the wind. One arrangement
   * for both would mean every soil block someone drags to the top reorders their
   * ordinary pages too, and every weather block they hide disappears from their field.
   */
  soilTiles: TileLayout;
  /** The overview page's, in the same shape and through the same machinery — see
   *  `core/overview`. One implementation of "your order, minus what you switched
   *  off", reused rather than written twice. */
  overview: TileLayout;
  /** What each overview widget is set to, by widget id — sparse, holding only what a
   *  reader actually changed. See `widgetSettings` in `core/overview`. */
  overviewSettings: Record<string, WidgetSettings>;
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
  alertsEnabled: true,
  userAlerts: [],
  pushEnabled: false,
  notifyAgro: [],
  notifyRain: false,
  notifyWind: false,
  notifyFrost: false,
  quietHours: true,
  advice: DEFAULT_ADVICE_LAYER,
  agroIntel: DEFAULT_AGRO_INTEL,
  nowCards: DEFAULT_NOW_LAYOUT,
  tiles: DEFAULT_TILE_LAYOUT,
  soilTiles: DEFAULT_TILE_LAYOUT,
  overview: DEFAULT_OVERVIEW_LAYOUT,
  overviewSettings: {},
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
    'useHarmonie', 'showSpread', 'alertsEnabled', 'pushEnabled',
    'notifyRain', 'notifyWind', 'notifyFrost', 'quietHours',
  ] as const) {
    take(k, bool);
  }

  // One malformed rule must not cost the reader the others, so they are taken one
  // at a time rather than as a block. See `sanitiseAlerts`.
  out.userAlerts = sanitiseAlerts(s.userAlerts);

  // Integrations are stored state that outlives the code that wrote them, so each
  // field is taken on its own and anything missing falls back to the default rather
  // than leaving a half-built object behind.
  const agro = (s.integrations as Integrations | undefined)?.agroexact;
  if (agro && typeof agro === 'object') {
    out.integrations = {
      agroexact: {
        connected: typeof agro.connected === 'boolean' ? agro.connected : false,
        account: typeof agro.account === 'string' ? agro.account : null,
        accountName: typeof agro.accountName === 'string' ? agro.accountName : null,
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
  // The master switch and the hidden set are read separately: a stored layer that
  // lost one must not cost the reader the other, and a stored value with no `enabled`
  // beside it was written before the switch existed — which means on, minus these.
  const advice = s.advice as AdviceLayer | undefined;
  if (advice && typeof advice === 'object') {
    out.advice = {
      enabled: typeof advice.enabled === 'boolean' ? advice.enabled : true,
      hidden: ids(advice.hidden),
    };
  }

  // The tier and its one setting, read separately: a stored layer that lost the risk
  // appetite must not switch the tier off, and one that lost the switch must not turn
  // a paid tier on for somebody who never had it — so `enabled` falls back to off.
  const intel = s.agroIntel as AgroIntelLayer | undefined;
  if (intel && typeof intel === 'object') {
    out.agroIntel = {
      enabled: intel.enabled === true,
      risk: intel.risk === 'cautious' || intel.risk === 'patient' ? intel.risk : 'normal',
    };
  }

  out.notifyAgro = ids(s.notifyAgro);

  const nowCards = s.nowCards as TileLayout | undefined;
  if (nowCards && typeof nowCards === 'object') {
    out.nowCards = { order: ids(nowCards.order), hidden: ids(nowCards.hidden) };
  }

  const overview = s.overview as TileLayout | undefined;
  if (overview && typeof overview === 'object') {
    out.overview = { order: ids(overview.order), hidden: ids(overview.hidden) };
  }

  // Per-widget settings, read key by key. A stored bag that picked up a value of the
  // wrong type — a `limit` that came back a string from some older writer — must cost
  // that one key and not every setting the reader has.
  const bag = s.overviewSettings;
  if (bag && typeof bag === 'object' && !Array.isArray(bag)) {
    const settings: Record<string, WidgetSettings> = {};
    for (const [id, raw] of Object.entries(bag as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const w = raw as WidgetSettings;
      const one: WidgetSettings = {};
      if (Number.isInteger(w.location) && (w.location as number) >= 0) one.location = w.location;
      if (Number.isInteger(w.limit) && (w.limit as number) > 0) one.limit = w.limit;
      if (Number.isInteger(w.hours) && (w.hours as number) > 0) one.hours = w.hours;
      if (w.window === 'today' || w.window === '24h') one.window = w.window;
      if (Object.keys(one).length) settings[id] = one;
    }
    out.overviewSettings = settings;
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
    if (!station) {
      // A location the soil sync created has no weather station and never had one.
      // This sync is the authority over weather stations only; dropping a field
      // because it is not in a list of poles would delete it on every refresh.
      if (l.soilStationId) kept.push(l);
      continue; // otherwise: the station left the account
    }
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
 * How near a soil sensor has to be to a place before it is the *same* place.
 *
 * Two hundred metres, set by the grower on 17 September 2026 and not a guess: a soil
 * sensor measures the water in one field, and at two kilometres you are on somebody
 * else's. The plan carried ~2 km as an open assumption; this replaces it.
 *
 * The consequence is deliberate and worth stating. Almost no soil sensor will fall
 * inside it, so almost every one becomes a location of its own — named after the
 * field, which is what a grower calls it anyway. A wider radius would have produced
 * fewer pages and attached suction readings to the wrong ground, and of those two
 * this one is the mistake you cannot see.
 *
 * **A place that carries a weather station never hosts one**, however near it stands.
 * Also the grower's call, and it is about what a page is *for*: a weather station's
 * page is the air over a region, a soil sensor's page is the water in one field. Two
 * instruments answering different questions get two pages, even when they share a
 * fence post. So the radius only ever applies to an ordinary saved place.
 */
export const SOIL_COUPLING_KM = 0.2;

/** One soil sensor, as the sync needs it. No reverse lookup: a field is called by its
 *  own name, not by the nearest town. */
export interface SoilPlace {
  stationId: string;
  stationName: string;
  lat: number;
  lon: number;
}

/**
 * Reconcile the saved locations with the soil sensors on the account.
 *
 * Runs alongside `syncStationLocations` and is the authority over soil sensors only,
 * exactly as that one is over weather stations. The same rule applies for the same
 * reason: a sensor missing from a *failed* request must never reach here, or a network
 * blip deletes someone's fields.
 *
 * Three outcomes per sensor:
 *
 *  - an ordinary saved place within `SOIL_COUPLING_KM` takes it, and keeps its own
 *    name. The reader already calls that place something.
 *  - a place that carries a weather station never takes it, at any distance: two
 *    instruments answering different questions get two pages.
 *  - otherwise it becomes its own location, named after the field.
 *  - a place at most one sensor. Two sensors on one field are two fields as far as
 *    this app can tell, and the second gets its own page rather than overwriting the
 *    first's readings.
 */
/**
 * Whether a place may take a soil sensor.
 *
 * One sensor per place, and never a place that is already a weather station's — see
 * `SOIL_COUPLING_KM` on why two instruments do not share a page.
 */
function canHost(l: SavedLocation): boolean {
  return !l.soilStationId && !l.stationId;
}

export function syncSoilLocations(prefs: Prefs, sensors: readonly SoilPlace[]): Prefs {
  const viewed = prefs.locations[prefs.activeLocation];
  const byId = new Map(sensors.map((s) => [s.stationId, s]));

  // Drop bindings to sensors that have left the account, and delete the locations
  // that existed only to carry one. A place the reader saved themselves, or that a
  // weather station stands on, stays — it is still a place.
  const base: SavedLocation[] = [];
  for (const l of prefs.locations) {
    if (!l.soilStationId) { base.push(l); continue; }
    if (byId.has(l.soilStationId)) { base.push(l); continue; }
    const wasOnlyASensor = l.source === 'agroexact' && !l.stationId;
    if (!wasOnlyASensor) {
      base.push({ ...l, soilStationId: undefined, soilStationName: undefined });
    }
  }

  // A field this sync created earlier, that something else has since put a place on
  // top of, is folded back into that place.
  //
  // The two syncs run independently and either can land first. Where the soil sync
  // goes first there are no weather locations yet, so a sensor makes its own page —
  // and then the station sync adds a pole fifty metres away as a second page for the
  // same ground. Dropping the page here lets the loop below re-couple its sensor to
  // the place that is now there, which is the answer the order should have produced.
  const hosted: SavedLocation[] = base.filter((l) => {
    const ownPage = !!l.soilStationId && l.source === 'agroexact' && !l.stationId;
    if (!ownPage) return true;
    return !base.some((other) => other !== l && canHost(other)
      && distanceKm(l.lat, l.lon, other.lat, other.lon) <= SOIL_COUPLING_KM);
  });

  const taken = new Set(
    hosted.map((l) => l.soilStationId).filter((id): id is string => !!id)
  );
  const locations = [...hosted];

  for (const s of sensors) {
    if (taken.has(s.stationId)) {
      // Already bound: follow the sensor if it was moved or renamed.
      const i = locations.findIndex((l) => l.soilStationId === s.stationId);
      const at = locations[i];
      if (at) locations[i] = { ...at, soilStationName: s.stationName };
      continue;
    }

    let nearest = -1;
    let best = SOIL_COUPLING_KM;
    locations.forEach((l, i) => {
      if (!canHost(l)) return;
      const d = distanceKm(l.lat, l.lon, s.lat, s.lon);
      if (d <= best) { best = d; nearest = i; }
    });

    const host = nearest >= 0 ? locations[nearest] : undefined;
    if (host) {
      locations[nearest] = {
        ...host,
        soilStationId: s.stationId,
        soilStationName: s.stationName,
      };
    } else {
      locations.push({
        // The field's own name. A reverse-geocoded town would put four fields on the
        // same village and leave the reader unable to say which one they are reading.
        name: s.stationName,
        lat: s.lat,
        lon: s.lon,
        soilStationId: s.stationId,
        soilStationName: s.stationName,
        source: 'agroexact',
      });
    }
    taken.add(s.stationId);
  }

  const out = locations.length ? locations : [DEFAULT_LOCATION];
  const at = viewed ? out.indexOf(viewed) : -1;
  const activeLocation =
    at >= 0 ? at : Math.min(Math.max(0, prefs.activeLocation), out.length - 1);

  return { ...prefs, locations: out, activeLocation };
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
    // The binding goes from every place that carries one, not only from the places
    // this integration created. A soil sensor can be coupled to somewhere the reader
    // saved themselves, and leaving that binding behind would have the app going on
    // asking a signed-out account for the field's readings.
    locations: prefs.locations.map((l) => {
      const dropped = l.soilStationId || l.soilStationName
        ? { ...l, soilStationId: undefined, soilStationName: undefined }
        : l;
      return dropped.source === 'agroexact'
        ? { ...dropped, source: undefined, stationId: undefined, stationName: undefined }
        : dropped;
    }),
    integrations: {},
  };
}




