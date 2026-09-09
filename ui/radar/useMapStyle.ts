/**
 * The basemap style, with its labels in the app's language.
 *
 * MapLibre takes either a style URL or a whole style object. Handing it the URL is
 * what the app did, and what a stock style then draws is a basemap labelled the way
 * its author chose — for OpenFreeMap's Bright, an international field, which is how
 * a Dutch app came to call the Belgian capital BRUSSELS.
 *
 * So the style is fetched here, rewritten by `localiseStyle`, and passed as an
 * object instead. Everything about *what* to rewrite is in `mapStyle.ts` and is
 * pure; this is only the fetching, the caching and the falling back.
 *
 * ## It falls back to the URL, always
 *
 * A basemap is the backdrop to the radar, not the point of it. If the style will not
 * load or will not parse, the hook returns the plain URL and MapLibre fetches it
 * itself exactly as before — an English label is a far better outcome than a blank
 * map. Nothing here can leave the map worse than it was.
 *
 * ## Why a query and not an effect
 *
 * Both maps mount and unmount constantly — the pager builds a copy of the radar page
 * per location, and the map page is pushed and popped — and a style is a few hundred
 * kilobytes. Through the query cache the second mount is free, and a language or
 * appearance change is a different key rather than a refetch of the same one. The
 * style itself changes about never, so it is held for a day.
 */
import { useQuery } from '@tanstack/react-query';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { localiseStyle, mapStyleFor } from './mapStyle';
import { usePrefs } from '../../state/prefs';
import { useTheme } from '../../theme';

/** A basemap style is a static document; refetching it during a session is waste. */
const STYLE_STALE_MS = 24 * 60 * 60_000;

export const mapStyleKey = (url: string, lang: string) => ['map-style', url, lang] as const;

export function useLocalisedMapStyle(): string | StyleSpecification {
  const { appearance } = useTheme();
  const { prefs } = usePrefs();
  const url = mapStyleFor(appearance);

  const { data } = useQuery({
    queryKey: mapStyleKey(url, prefs.lang),
    staleTime: STYLE_STALE_MS,
    gcTime: STYLE_STALE_MS,
    // One retry: a basemap that will not come is not worth a third round trip when
    // the URL below draws the same map with different labels.
    retry: 1,
    queryFn: async ({ signal }): Promise<StyleSpecification> => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return localiseStyle((await response.json()) as StyleSpecification, prefs.lang);
    },
  });

  return data ?? url;
}
