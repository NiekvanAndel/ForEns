/**
 * Reading the stations the reader's own rules watch, from a background run.
 *
 * The forecast the task already fetches answers for one location. A rule names
 * AgroExact stations, which are a different thing entirely — so this is the extra
 * fetch, and it is deliberately the smallest one that will do: the distinct stations
 * across every enabled rule, once each, whatever number of rules point at them.
 *
 * It needs an access token outside React, which `core/auth/store` provides. Without
 * an account there is nothing to fetch and nothing to evaluate, which is not an
 * error — most devices are in that state.
 *
 * Everything fails soft and per station. One station that times out costs its own
 * rules a run, not the rest: a background window is thirty seconds and a rule that
 * could not be seen keeps its state rather than being treated as clear.
 */
import { backgroundAccessToken } from './auth/store';
import { fetchStationObservations } from './sources/agroexact';
import { stationCanAnswer, stationTileValue } from './model/stationTiles';
import { watchedStationIds, type UserAlert } from './alerts';
import type { StationValue } from './alertRun';
import type { StationObservations } from './sources/agroexact';

/** How many stations a single run will fetch. A grower with forty rules across forty
 *  stations is not the case to optimise for, and a background window that spends
 *  itself on requests delivers nothing at all. */
const MAX_STATIONS = 12;

export interface AlertReadingsResult {
  /** Keyed by alert id: one entry per station that rule watches and could be read. */
  readings: Record<string, StationValue[]>;
  /** False where nothing could be read at all — no account, or every fetch failed.
   *  The caller leaves every rule's state alone rather than treating the run as a
   *  clean sheet. */
  ok: boolean;
}

export async function fetchAlertReadings(
  alerts: readonly UserAlert[],
  offsetSec: number,
  nowKey: string,
  /** Injected for the tests, which have no keychain and no network. */
  deps?: {
    token?: () => Promise<string | null>;
    observations?: (token: string, stationId: string, offsetSec: number) => Promise<StationObservations>;
  }
): Promise<AlertReadingsResult> {
  const live = alerts.filter((a) => a.enabled && a.stationIds.length);
  if (!live.length) return { readings: {}, ok: true };

  const getToken = deps?.token ?? backgroundAccessToken;
  const token = await getToken();
  if (!token) return { readings: {}, ok: false };

  const fetchOne = deps?.observations
    ?? ((t: string, id: string, off: number) => fetchStationObservations(t, id, off));

  const ids = watchedStationIds(live).slice(0, MAX_STATIONS);
  const records = new Map<string, StationObservations>();

  // In parallel: a background window is short, and twelve sequential round trips is
  // most of it. One failure resolves to nothing rather than rejecting the lot.
  await Promise.all(
    ids.map(async (id) => {
      try {
        records.set(id, await fetchOne(token, id, offsetSec));
      } catch {
        // This station's rules keep their state; see the note at the top.
      }
    })
  );

  if (!records.size) return { readings: {}, ok: false };

  const readings: Record<string, StationValue[]> = {};
  for (const alert of live) {
    if (!stationCanAnswer(alert.tileId)) continue;
    const values: StationValue[] = [];
    for (const id of alert.stationIds) {
      const record = records.get(id);
      if (!record) continue;
      values.push({
        stationId: id,
        stationName: record.stationName,
        value: stationTileValue(alert.tileId, record, nowKey),
      });
    }
    if (values.length) readings[alert.id] = values;
  }

  return { readings, ok: true };
}
