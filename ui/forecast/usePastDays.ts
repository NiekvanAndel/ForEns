/**
 * The last two days, as rows for the table on 'Verwachting'.
 *
 * Two fetches behind one hook: the station's hourly record where the location has an
 * instrument, and Open-Meteo's observation feed always — as the filler for the hours
 * the station was quiet, as the only source where there is no station, and as the only
 * source of a weather code and a sunshine figure in either case. `core/model/pastDays`
 * merges and aggregates them; this only decides what to ask for and when.
 *
 * Nothing is fetched for a copy of the page sliding past in the location pager. Two
 * days of history for a location the reader may not stop on is two requests for rows
 * nobody will see.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPastHours } from '../../core/sources/pastWeather';
import { buildPastDays, mergePastHours } from '../../core/model/pastDays';
import { dayKey } from '../../core/model/series';
import { useStationRange } from '../../state/stations';
import type { Day } from '../../core/model/types';
import type { SavedLocation } from '../../core/prefs';

/** How many days back the table reaches. */
export const PAST_DAYS = 2;

/** Yesterday is not going to change; an hour is a generous margin on "settled". */
const STALE_MS = 60 * 60 * 1000;

/** The dates the rows cover, oldest first — the days before today, not today
 *  itself, which is already the forecast's own first row. */
export function pastDates(now = new Date(), count = PAST_DAYS): string[] {
  const out: string[] = [];
  for (let back = count; back >= 1; back--) {
    out.push(dayKey(new Date(now.getTime() - back * 86_400_000)));
  }
  return out;
}

export interface PastDaysQuery {
  location: SavedLocation;
  stationId: string | null;
  offsetSec: number | null;
  lat: number;
  enabled: boolean;
}

export function usePastDays({
  location, stationId, offsetSec, lat, enabled,
}: PastDaysQuery): { days: Day[]; loading: boolean } {
  const dates = useMemo(() => pastDates(), []);
  const range = { from: dates[0] as string, to: dates[dates.length - 1] as string };

  const modelled = useQuery({
    queryKey: ['past-hours', location.lat.toFixed(3), location.lon.toFixed(3), range.from],
    enabled,
    staleTime: STALE_MS,
    queryFn: ({ signal }) =>
      fetchPastHours({ lat: location.lat, lon: location.lon }, PAST_DAYS, { signal }),
  });

  // The hourly roll-up rather than the raw ten-minute readings: a day row is a day's
  // minimum, maximum and total, and an hour is as fine as that needs.
  const measured = useStationRange(stationId, offsetSec, range, enabled && !!stationId, false);

  const days = useMemo(
    () =>
      buildPastDays({
        dates,
        hours: mergePastHours(measured.data ?? [], modelled.data ?? []),
        lat,
        offsetSec: offsetSec ?? 0,
      }),
    [dates, measured.data, modelled.data, lat, offsetSec]
  );

  return {
    days,
    // Only while there is nothing to show. A row drawn from the model and refined
    // when the station lands is better than a spinner for both.
    loading: days.length === 0 && (modelled.isLoading || (!!stationId && measured.isLoading)),
  };
}
