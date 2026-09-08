/**
 * Source-layer tests.
 *
 * The fetch cascade has no counterpart in index.html to compare against — it was
 * inline in `run()` — so these pin the behaviour that matters: retry and fallback
 * rules, and the AgroExact folding the web app never actually executed.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseDayEnsemble } from '../core/sources/ensembleHourly';
import { fetchJson, tryFetchJson, SourceError } from '../core/sources/http';
import { loadHourly, loadStage1, urls } from '../core/sources/openMeteo';
import {
  agroHeaders, distanceKm, nearestStation, stationsNear, localHourKey,
  fetchStations, fetchStationHours, fetchLatestMeasurement, AgroAuthError,
} from '../core/sources/agroexact';
import { searchPlaces } from '../core/sources/geocoding';

/** Build a fetch stand-in from a url→response map. */
function mockFetch(handler: (url: string) => { status?: number; body: unknown } | undefined) {
  return vi.fn(async (url: string) => {
    const r = handler(String(url));
    if (!r) throw new Error('network down');
    return {
      ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300,
      status: r.status ?? 200,
      json: async () => r.body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('fetchJson', () => {
  it('retries a 429 and then succeeds', async () => {
    let calls = 0;
    const f = mockFetch(() => {
      calls++;
      return calls < 2 ? { status: 429, body: {} } : { body: { ok: true } };
    });
    const out = await fetchJson<{ ok: boolean }>('https://x.test/a', 'T', { fetchImpl: f });
    expect(out.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('treats a 200 with an error body as a failure, as Open-Meteo sends it', async () => {
    const f = mockFetch(() => ({ body: { error: true, reason: 'No data' } }));
    await expect(fetchJson('https://x.test/a', 'T', { fetchImpl: f, retries: 0 }))
      .rejects.toThrow(/T: No data/);
  });

  it('reports the HTTP status once retries are spent', async () => {
    const f = mockFetch(() => ({ status: 500, body: {} }));
    const err = await fetchJson('https://x.test/a', 'T', { fetchImpl: f, retries: 0 })
      .catch((e) => e as SourceError);
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).status).toBe(500);
  });

  it('tryFetchJson resolves to null instead of throwing', async () => {
    const f = mockFetch(() => ({ status: 500, body: {} }));
    expect(await tryFetchJson('https://x.test/a', 'T', { fetchImpl: f, retries: 0 })).toBeNull();
  });
});

describe('hourly source cascade', () => {
  const c = { lat: 51.7, lon: 5.3 };
  const good = { hourly: { time: ['2026-06-15T00:00'], temperature_2m: [17] } };
  const allNull = { hourly: { time: ['2026-06-15T00:00'], temperature_2m: [null, null] } };

  it('prefers HARMONIE-NL when it returns data', async () => {
    const f = mockFetch((u) => (u.includes('netherlands') ? { body: good } : { body: {} }));
    const r = await loadHourly(c, true, { fetchImpl: f });
    expect(r.state).toEqual({ model: 'netherlands', failed: false, disabled: false });
    expect(r.hourly).toEqual(good);
  });

  it('falls through to HARMONIE-EU when NL returns an all-null series', async () => {
    const f = mockFetch((u) =>
      u.includes('netherlands') ? { body: allNull } : u.includes('europe') ? { body: good } : { body: {} }
    );
    const r = await loadHourly(c, true, { fetchImpl: f });
    expect(r.state.model).toBe('europe');
  });

  it('falls back to IFS and marks HARMONIE failed when neither domain answers', async () => {
    const f = mockFetch((u) =>
      u.includes('harmonie') ? { body: allNull } : { body: { hourly: { time: [], temperature_2m: [] } } }
    );
    const r = await loadHourly(c, true, { fetchImpl: f });
    expect(r.state).toEqual({ model: null, failed: true, disabled: false });
    expect(r.hourly).not.toBeNull();
  });

  it('goes straight to IFS when HARMONIE is switched off, without marking it failed', async () => {
    const f = mockFetch(() => ({ body: good }));
    const r = await loadHourly(c, false, { fetchImpl: f });
    expect(r.state).toEqual({ model: null, failed: false, disabled: true });
    expect(String((f as any).mock.calls[0][0])).toContain('ecmwf_ifs');
  });

  it('renders without observations when only they fail', async () => {
    const f = mockFetch((u) =>
      u.includes('past_days') ? undefined : { body: { ...good, utc_offset_seconds: 7200 } }
    );
    const s1 = await loadStage1(c, true, { fetchImpl: f, retries: 0 });
    expect(s1.observations).toBeNull();
    expect(s1.hourly).not.toBeNull();
    // The offset must still be found, since the solar maths depends on it.
    expect(s1.offsetSec).toBe(7200);
  });
});

describe('url construction', () => {
  const c = { lat: 51.6978, lon: 5.3037 };
  it('requests the cloud layers method-6 sunshine needs', () => {
    for (const u of [urls.observations(c), urls.harmonie(c, 'netherlands'), urls.ifsHourly(c)]) {
      expect(u).toContain('cloud_cover_low');
      expect(u).toContain('shortwave_radiation');
    }
  });
  it('asks one IFS hourly call for everything the day sheets read', () => {
    // The web app made a separate fetch per popup — precipitation for one, dew
    // point for another, gusts for a third — which is how its popups came to
    // disagree about the same hour.
    const u = urls.ifsHourlyDetail(c, 7);
    for (const field of [
      'temperature_2m', 'dewpoint_2m', 'precipitation', 'weather_code',
      'windspeed_10m', 'winddirection_10m', 'wind_gusts_10m',
      'sunshine_duration', 'et0_fao_evapotranspiration',
    ]) {
      expect(u, field).toContain(field);
    }
    expect(u).toContain('models=ecmwf_ifs');
    expect(urls.ifsHourlyDetail(c, 16)).toContain('forecast_days=16');
  });

  it('asks the ensemble endpoint for the requested horizon', () => {
    expect(urls.ensemble(c, 14)).toContain('forecast_days=14');
    expect(urls.ensemble(c, 14)).toContain('ecmwf_ifs025');
  });
});

describe('AgroExact', () => {
  it('sends the access token as a bearer token', () => {
    expect(agroHeaders('abc123').Authorization).toBe('Bearer abc123');
    expect(agroHeaders('abc123', 'Token').Authorization).toBe('Token abc123');
  });

  it('retries an API key once under the Token scheme before giving up', async () => {
    const seen: string[] = [];
    const f = vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
      const auth = init?.headers?.Authorization ?? '';
      seen.push(auth);
      return {
        ok: auth.startsWith('Token '),
        status: auth.startsWith('Token ') ? 200 : 401,
        json: async () => [],
      } as unknown as Response;
    });
    await fetchStations('key', { fetchImpl: f as unknown as typeof fetch });
    expect(seen).toEqual(['Bearer key', 'Token key']);
  });

  it('reports a rejected credential as an auth error, not as no data', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response);
    await expect(fetchStations('dead', { fetchImpl: f as unknown as typeof fetch }))
      .rejects.toBeInstanceOf(AgroAuthError);
  });

  it('keeps rain gauges and drops stations without coordinates', async () => {
    const body = [
      { station_id: 'a', name: 'Weide', latitude: '51.70', longitude: '5.30', version_type: 'ATMO' },
      { station_id: 'b', name: 'Regen', latitude: '51.80', longitude: '5.40', version_type: 'RAIN' },
      { station_id: 'c', name: 'Kwijt', latitude: null, longitude: null, version_type: 'ATMO' },
    ];
    const f = mockFetch(() => ({ body }));
    const stations = await fetchStations('t', { fetchImpl: f });
    // A rain gauge answers with a full record once external data is substituted in,
    // so it stays; a station with no position cannot become a location at all.
    expect(stations.map((s) => s.id)).toEqual(['a', 'b']);
    expect(stations[0]!.lat).toBeCloseTo(51.7, 4);
  });

  it('measures distance correctly', () => {
    expect(distanceKm(51.6978, 5.3037, 51.6978, 5.3037)).toBe(0);
    // 's-Hertogenbosch to Eindhoven is about 32 km.
    const d = distanceKm(51.6978, 5.3037, 51.4416, 5.4697);
    expect(d).toBeGreaterThan(29);
    expect(d).toBeLessThan(35);
    // A degree of latitude is ~111 km anywhere.
    expect(distanceKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
    // A degree of longitude shrinks with latitude; the flat approximation would not.
    expect(distanceKm(60, 0, 60, 1)).toBeLessThan(distanceKm(0, 0, 0, 1) / 1.9);
  });

  it('picks the nearest station, and lists the ones within a radius', () => {
    const stations = [
      { id: 'far', name: 'Far', lat: 52.4, lon: 4.9, type: 'ATMO' },
      { id: 'near', name: 'Near', lat: 51.70, lon: 5.31, type: 'ATMO' },
    ];
    const n = nearestStation(stations, 51.6978, 5.3037)!;
    expect(n.id).toBe('near');
    expect(n.dist).toBeLessThan(1);
    expect(nearestStation([], 0, 0)).toBeNull();
    expect(stationsNear(stations, 51.6978, 5.3037, 10).map((s) => s.id)).toEqual(['near']);
  });

  it('buckets UTC instants into the location\'s own local hour', () => {
    // +2h: 22:30Z is half past midnight the next day, locally.
    expect(localHourKey('2026-06-15T22:30:00Z', 7200)).toBe('2026-06-16T00:00');
    expect(localHourKey('2026-06-15T10:00:00Z', 3600)).toBe('2026-06-15T11:00');
    expect(localHourKey('not a date', 0)).toBe('');
  });

  it('maps hourly aggregates onto the hour they describe, in km/h', async () => {
    // An aggregate is stamped at the END of its window: 12:00Z covers 11:00–12:00Z,
    // which at +2h is the local hour starting at 13:00.
    const body = [
      {
        timestamp: '2026-06-15T12:00:00Z', station_name: 'Weide',
        temperature_150: 22, temperature_150_avg: 19, temperature_150_min: 17,
        temperature_150_max: 21, humidity_150_avg: 65, dewpoint: 12,
        windspeed_avg: 6, gust_max: 12, wind_direction: 240, precipitation: 0.62,
      },
    ];
    const f = mockFetch(() => ({ body }));
    const { hours, stationName } = await fetchStationHours('t', 'st1', 7200, 26, { fetchImpl: f });

    expect(Object.keys(hours)).toEqual(['2026-06-15T13:00']);
    const h = hours['2026-06-15T13:00']!;
    // The hourly average, not the last measurement inside the hour.
    expect(h.temp).toBe(19);
    expect(h.tempMin).toBe(17);
    expect(h.tempMax).toBe(21);
    // 6 m/s = 21.6 km/h, 12 m/s = 43.2 km/h.
    expect(h.wind).toBe(22);
    expect(h.gusts).toBe(43);
    expect(h.precip).toBe(0.6);
    expect(stationName).toBe('Weide');
  });

  it('asks for the partial hour and for externally completed data', async () => {
    let asked = '';
    const f = mockFetch((url) => { asked = url; return { body: [] }; });
    await fetchStationHours('t', 'st1', 0, 26, { fetchImpl: f });
    expect(asked).toContain('/aggregates/st1/');
    expect(asked).toContain('hours=26');
    // Without this the live hour is withheld and reads as a station gone quiet.
    expect(asked).toContain('include_partial=true');
    // The app wants every quantity the station can answer for, substituted where
    // its own sensors cannot: a rain gauge gets a full record, not a lone figure.
    expect(asked).toContain('station_only=false');
  });

  it('reads the latest measurement with its own minute', async () => {
    const body = [{
      timestamp: '2026-06-15T11:42:00Z', station_name: 'Weide',
      temperature_150: 21.4, humidity_150: 58, dewpoint: '12.5',
      windspeed: 4, gust: 9, wind_direction: 200, precipitation: 0,
    }];
    let asked = '';
    const f = mockFetch((url) => { asked = url; return { body }; });
    const { current } = await fetchLatestMeasurement('t', 'st1', 7200, { fetchImpl: f });

    expect(asked).toContain('latest=true');
    expect(asked).toContain('station_only=false');
    expect(current!.measTime).toBe('2026-06-15T11:42:00Z');
    expect(current!.time).toBe('2026-06-15T13:00');
    expect(current!.temp).toBe(21);
    expect(current!.wind).toBe(14);
    expect(current!.dewpoint).toBe(13);
  });

  it('reports no measurement rather than failing when the station is silent', async () => {
    const f = mockFetch(() => ({ body: [] }));
    const { current } = await fetchLatestMeasurement('t', 'st1', 0, { fetchImpl: f });
    expect(current).toBeNull();
  });
});

describe('searchPlaces', () => {
  it('splits display_name into a title and subtitle, and sends a User-Agent', async () => {
    const f = mockFetch(() => ({
      body: [
        { lat: '51.7', lon: '5.3', display_name: "Rosmalen, 's-Hertogenbosch, Noord-Brabant, Nederland" },
      ],
    }));
    const out = await searchPlaces('rosmalen', 'nl', { fetchImpl: f });
    expect(out[0]!.name).toBe("Rosmalen, 's-Hertogenbosch");
    expect(out[0]!.sub).toBe('Noord-Brabant, Nederland');
    expect(out[0]!.lat).toBeCloseTo(51.7);
    const init = (f as any).mock.calls[0][1];
    expect(init.headers['User-Agent']).toMatch(/ExactCastAI/);
  });

  it('returns nothing for a blank query without calling the API', async () => {
    const f = mockFetch(() => ({ body: [] }));
    expect(await searchPlaces('   ', 'nl', { fetchImpl: f })).toEqual([]);
    expect((f as any).mock.calls).toHaveLength(0);
  });
});

describe('parseDayEnsemble', () => {
  const times = ['2026-06-15T00:00', '2026-06-15T01:00'];

  it('reads members for precipitation, temperature and wind from one response', () => {
    const out = parseDayEnsemble({
      hourly: {
        time: times,
        precipitation_member01: [0, 2],
        precipitation_member02: [0, 4],
        temperature_2m_member01: [12, 14],
        temperature_2m_member02: [16, 18],
        windspeed_10m_member01: [10, 20],
        windspeed_10m_member02: [30, 40],
      },
    });
    expect(out[times[1]!]!.precipP50).toBeCloseTo(3, 5);
    expect(out[times[0]!]!.temp!.p50).toBeCloseTo(14, 5);
    expect(out[times[0]!]!.wind!.p50).toBeCloseTo(20, 5);
  });

  it('treats a missing precipitation member as dry but a missing temperature as unknown', () => {
    // A gap in a rain series means no rain; the same gap in a temperature series
    // would drag the whole spread toward freezing if it were counted as zero.
    const out = parseDayEnsemble({
      hourly: {
        time: [times[0]!],
        precipitation_member01: [null],
        precipitation_member02: [4],
        temperature_2m_member01: [null],
        temperature_2m_member02: [20],
      },
    });
    // The dry member is counted, so the median sits between 0 and 4 rather than at 4.
    expect(out[times[0]!]!.precipP50).toBeCloseTo(2, 5);
    // The absent temperature member is dropped, so the one real value stands alone.
    expect(out[times[0]!]!.temp!.p50).toBe(20);
  });

  it('leaves a field absent rather than inventing a flat spread', () => {
    const out = parseDayEnsemble({
      hourly: { time: [times[0]!], precipitation_member01: [1] },
    });
    expect(out[times[0]!]!.temp).toBeUndefined();
    expect(out[times[0]!]!.wind).toBeUndefined();
  });

  it('falls back to the deterministic series when no member columns are present', () => {
    const out = parseDayEnsemble({
      hourly: { time: [times[0]!], precipitation: [3], temperature_2m: [17] },
    });
    expect(out[times[0]!]!.precipP50).toBe(3);
    expect(out[times[0]!]!.temp!.p50).toBe(17);
  });
});
