/**
 * The map, full screen — its own page, outside the tabs.
 *
 * The top row's map button leads here from anywhere in the app, and so does the
 * full-screen button on 'Radar'. Both open on the location that is already selected,
 * because the selection is shared state rather than something passed along: whatever
 * station the radar page was drawing is the one this page opens on, and it cannot
 * drift out of step with it.
 *
 * It sits at the root of the stack rather than in the tab group, so it is pushed
 * over the tab bar instead of beside it. A map with a floating capsule of six icons
 * across the bottom is a map with a strip of it missing.
 *
 * The page body — the map, the profile and the timeline — is `ui/radar/FullMap`, so
 * this file is what every route file in this app is: a page and the frame round it.
 * There is no `ScreenFrame` here on purpose: the sideways swipe belongs to the pages
 * under the tab bar, and on a map you can pan it would fight the pan. Changing
 * location from here is done by tapping one of the pins, which is what they are for.
 */
import { useEffect, useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { FullMap } from '../ui/radar/FullMap';
import { useRadarFrames } from '../ui/radar/useRadarFrames';
import { usePrefs } from '../state/prefs';
import { useForecast } from '../state/forecast';

export default function MapScreen() {
  const { prefs, location, selectLocation } = usePrefs();
  const { nowcast } = useForecast();
  const router = useRouter();
  const radar = useRadarFrames();

  useEffect(() => {
    const ctrl = new AbortController();
    radar.fetch(ctrl.signal);
    return () => ctrl.abort();
    // `fetch` is stable; re-running on every render would refetch the loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every saved location except the one the map is centred on, which it already
  // marks. Carrying the index along is what lets a tap select it.
  const places = useMemo(
    () =>
      prefs.locations
        .map((l, index) => ({ location: l, index }))
        .filter((p) => p.location !== location),
    [prefs.locations, location]
  );

  return (
    <>
      {/* Up from the bottom, as the modal it replaces used to arrive: this is a
          place you step into and come back from, not a page in a sequence. */}
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <FullMap
        onClose={() => router.back()}
        lat={location.lat}
        lon={location.lon}
        frames={radar.frames}
        activeIndex={radar.index}
        onScrub={radar.setIndex}
        playing={radar.playing}
        onTogglePlay={radar.togglePlay}
        places={places}
        onSelectPlace={selectLocation}
        profile={nowcast}
        locationName={location.name}
      />
    </>
  );
}
