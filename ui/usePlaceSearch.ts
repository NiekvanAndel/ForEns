/**
 * Debounced place search.
 *
 * Nominatim's usage policy allows one request per second, so the query is debounced
 * rather than fired per keystroke. Both screens that carry a top bar needed this and
 * had grown slightly different copies of it — one of which never cleared its timer
 * on unmount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPlaces, SEARCH_DEBOUNCE_MS, type Place } from '../core/sources/geocoding';
import type { LangCode } from '../core/i18n';

export interface PlaceSearch {
  results: Place[];
  searching: boolean;
  onSearch: (query: string) => void;
}

export function usePlaceSearch(lang: LangCode): PlaceSearch {
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearch = useCallback(
    (query: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (!query.trim()) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      timer.current = setTimeout(() => {
        searchPlaces(query, lang)
          .then(setResults)
          .catch(() => setResults([]))
          .finally(() => setSearching(false));
      }, SEARCH_DEBOUNCE_MS);
    },
    [lang]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { results, searching, onSearch };
}
