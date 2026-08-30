/**
 * Place search and reverse lookup.
 *
 * Ported from index.html's `geocode` and `_doGeoSearch`. Two changes:
 *
 *  - Nominatim requires a real identifying User-Agent and permits one request per
 *    second. A browser sets its own UA and the web app ignored the rate limit; a
 *    native client must not, so the header is set and calls are debounced by the
 *    caller (`SEARCH_DEBOUNCE_MS`).
 *  - Result parsing moves out of HTML string building into plain data.
 */
import { fetchJson, type FetchOptions } from './http';

const OPEN_METEO_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Nominatim's usage policy allows at most one request per second. */
export const SEARCH_DEBOUNCE_MS = 350;
export const NOMINATIM_MIN_INTERVAL_MS = 1000;

/** Identifies the app to Nominatim, as its policy requires. */
export const USER_AGENT = 'ExactCastAI/0.1 (https://agroexact.nl)';

export interface Place {
  lat: number;
  lon: number;
  /** Short label for the location pill. */
  name: string;
  /** Region and country, shown under the name in the results list. */
  sub?: string;
  /** Full name, kept so a saved favourite can be shown in detail. */
  fullName: string;
}

interface OpenMeteoGeoResponse {
  results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string; country?: string }>;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/** Single best match by name — used when resolving a saved place, not for search. */
export async function geocode(
  name: string,
  lang = 'nl',
  opts: FetchOptions = {}
): Promise<Place> {
  const url =
    `${OPEN_METEO_GEO}?name=${encodeURIComponent(name)}&count=1` +
    `&language=${lang}&format=json`;
  const d = await fetchJson<OpenMeteoGeoResponse>(url, 'Geocode', opts);
  const first = d.results?.[0];
  if (!first) throw new Error(`Plaats niet gevonden: ${name}`);
  return {
    lat: first.latitude,
    lon: first.longitude,
    name: first.name,
    sub: [first.admin1, first.country].filter(Boolean).join(', ') || undefined,
    fullName: first.name,
  };
}

/**
 * Search suggestions, as the search overlay lists them.
 *
 * The web app split `display_name` at commas: the first two parts became the title
 * and the next two the subtitle. That is kept, because it produces sensible Dutch
 * results ("Rosmalen, 's-Hertogenbosch" over "Rosmalen, 's-Hertogenbosch, Noord-
 * Brabant, Nederland").
 */
export async function searchPlaces(
  query: string,
  lang = 'nl',
  opts: FetchOptions = {}
): Promise<Place[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&limit=7` +
    `&accept-language=${lang}`;
  const results = await fetchJson<NominatimResult[]>(url, 'Zoeken', {
    ...opts,
    headers: { 'User-Agent': USER_AGENT, ...(opts.headers ?? {}) },
  });
  return results.map((r) => {
    const parts = r.display_name.split(',');
    return {
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      name: parts.slice(0, 2).join(',').trim(),
      sub: parts.slice(2, 4).join(',').trim() || undefined,
      fullName: parts.slice(0, 3).join(',').trim(),
    };
  });
}

interface NominatimReverse {
  display_name?: string;
  address?: Record<string, string>;
}

/** Name for a coordinate, used after a GPS fix. Falls back to the coordinates
 *  themselves rather than leaving the location title empty. */
export async function reverseGeocode(
  lat: number,
  lon: number,
  lang = 'nl',
  opts: FetchOptions = {}
): Promise<Place> {
  const url =
    `${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=${lang}`;
  try {
    const r = await fetchJson<NominatimReverse>(url, 'Locatie', {
      ...opts,
      headers: { 'User-Agent': USER_AGENT, ...(opts.headers ?? {}) },
    });
    const a = r.address ?? {};
    const name =
      a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? a.county ?? null;
    if (name) {
      return { lat, lon, name, sub: a.state ?? a.country, fullName: r.display_name ?? name };
    }
    if (r.display_name) {
      const parts = r.display_name.split(',');
      return {
        lat, lon,
        name: parts.slice(0, 2).join(',').trim(),
        sub: parts.slice(2, 4).join(',').trim() || undefined,
        fullName: r.display_name,
      };
    }
  } catch {
    // Fall through to coordinates.
  }
  const coords = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  return { lat, lon, name: coords, fullName: coords };
}
