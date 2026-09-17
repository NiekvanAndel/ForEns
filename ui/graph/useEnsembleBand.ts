/**
 * The ensemble members behind the band on 'Grafiek'.
 *
 * Only the part of the window that has not happened yet is asked for. A band around
 * a measurement would say the thermometer might have read something else, and asking
 * the ensemble API for last month is a request whose answer is thrown away.
 *
 * Through `useQuery` like every other fetch in the app, so the window a reader
 * switches away from and back to is answered from cache, and two copies of the page
 * in the location pager share one request.
 */
import { useQuery } from '@tanstack/react-query';
import { fetchEnsembleRange, type EnsembleMembers } from '../../core/sources/ensembleRange';

/** An ensemble run is issued a few times a day; within an hour the answer is the
 *  same one. */
const STALE_MS = 60 * 60 * 1000;

export interface EnsembleBandQuery {
  lat: number;
  lon: number;
  /** The forecast part of the window, as local calendar days. */
  from: string;
  to: string;
  enabled: boolean;
}

export function useEnsembleMembers({ lat, lon, from, to, enabled }: EnsembleBandQuery) {
  return useQuery<EnsembleMembers>({
    // Rounded, because a band is a regional thing and a location moved fifty metres
    // is not a different forecast — three decimals is about a hundred metres.
    queryKey: ['ensemble-range', lat.toFixed(3), lon.toFixed(3), from, to],
    enabled: enabled && from <= to,
    staleTime: STALE_MS,
    queryFn: ({ signal }) => fetchEnsembleRange(lat, lon, from, to, { signal }),
    // One retry: the band is an enrichment, and a chart without it is still the
    // chart. Failing quietly beats three rounds of waiting for an ornament.
    retry: 1,
  });
}
