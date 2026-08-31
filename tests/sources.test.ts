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
  agroHeaders, agroBaseUrl, agroRecords, distanceKm, circularMean,
  nearestStation, fetchStationData, AGRO_DEFAULT_BASE,
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
  it('prefixes a bare token but leaves a scheme intact', () => {
    expect(agroHeaders({ token: 'abc123' }).Authorization).toBe('Token abc123');
    expect(agroHeaders({ token: 'Token abc123' }).Authorization).toBe('Token abc123');
    expect(agroHeaders({ token: 'Bearer xyz' }).Authorization).toBe('Bearer xyz');
    expect(agroHeaders({ token: '' }).Authorization).toBeUndefined();
  });

  it('falls back to the default base URL', () => {
    expect(agroBaseUrl({ token: 't' })).toBe(AGRO_DEFAULT_BASE);
    expect(agroBaseUrl({ token: 't', baseUrl: '  ' })).toBe(AGRO_DEFAULT_BASE);
    expect(agroBaseUrl({ token: 't', baseUrl: 'https://x.test/api' })).toBe('https://x.test/api');
  });

  it('unwraps records from any of the shapes the API uses', () => {
    expect(agroRecords([{ a: 1 }])).toHaveLength(1);
    for (const key of ['records', 'data', 'results', 'stations', 'readings']) {
      expect(agroRecords({ [key]: [{ a: 1 }, { b: 2 }] }), key).toHaveLength(2);
    }
    expect(agroRecords(null)).toEqual([]);
    expect(agroRecords({ nope: 1 })).toEqual([]);
  });

  // This is the function index.html referenced but never defined.
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

  it('picks the nearest station', () => {
    const stations = [
      { id: 'far', name: 'Far', lat: 52.4, lon: 4.9, type: 'ATMO' },
      { id: 'near', name: 'Near', lat: 51.70, lon: 5.31, type: 'ATMO' },
    ];
    const n = nearestStation(stations, 51.6978, 5.3037)!;
    expect(n.id).toBe('near');
    expect(n.dist).toBeLessThan(1);
    expect(nearestStation([], 0, 0)).toBeNull();
  });

  it('averages bearings around the compass wrap', () => {
    // 350 and 10 average to 0, not 180.
    expect(circularMean([350, 10])).toBeCloseTo(0, 5);
    expect(circularMean([90, 90])).toBeCloseTo(90, 5);
    expect(circularMean([])).toBeNull();
  });

  it('folds readings into local hours, converting m/s to km/h', async () => {
    const readings = [
      // Two readings inside 12:00 local (offset +2h => 10:00Z and 10:30Z).
      { timestamp: '2026-06-15T10:00:00Z', temperature_150: 18, windspeed: 5, wind_direction: 350, precipitation: 0.2, humidity_150: 60 },
      { timestamp: '2026-06-15T10:30:00Z', temperature_150: 20, windspeed: 7, wind_direction: 10, precipitation: 0.4, humidity_150: 70 },
      { timestamp: '2026-06-15T11:00:00Z', temperature_150: 22, windspeed: 3, gust: 12, wind_direction: 180, precipitation: 0, humidity_150: 55 },
    ];
    const f = mockFetch(() => ({ body: { readings } }));
    const data = (await fetchStationData({ token: 't' }, 'st1', 7200, 51.7, {
      fetchImpl: f,
      wmoByHour: { '2026-06-15T12:00': 61 },
    }))!;

    expect(data.hours.map((h) => h.time)).toEqual(['2026-06-15T12:00', '2026-06-15T13:00']);

    const noon = data.hours[0]!;
    // Temperature and humidity are means over the hour.
    expect(noon.temp).toBe(19);
    expect(noon.humidity).toBe(65);
    // Wind is a mean converted from m/s: mean(5,7) = 6 m/s = 21.6 km/h.
    expect(noon.wind).toBe(22);
    // Precipitation is a sum, not a mean.
    expect(noon.precip).toBe(0.6);
    // Bearings average around the wrap: 350 and 10 give 0, not 180.
    expect(noon.windDir).toBe(0);
    // The weather code comes from the model, since a station cannot measure one.
    expect(noon.wmo).toBe(61);
    expect(noon.agro).toBe(true);

    // Gusts are the hour's maximum, not its mean: 12 m/s = 43.2 km/h.
    expect(data.hours[1]!.gusts).toBe(43);

    // "Current" is the newest reading, keeping its own sub-hour timestamp.
    expect(data.current.measTime).toBe('2026-06-15T11:00:00Z');
    expect(data.current.time).toBe('2026-06-15T13:00');
    expect(data.current.temp).toBe(22);
  });

  it('returns null when the station has no readings', async () => {
    const f = mockFetch(() => ({ body: { readings: [] } }));
    expect(await fetchStationData({ token: 't' }, 'st1', 7200, 51.7, { fetchImpl: f })).toBeNull();
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
