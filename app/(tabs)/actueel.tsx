/**
 * Actueel — every figure this location has, as a grid.
 *
 * 'Nu' leads with the two rainfall readings and puts everything else on one line
 * under them, because that is what a glance wants. This is the page for the reader
 * who came to look something up: one block per figure, the same size, so they are
 * scanned rather than read.
 *
 * ## Where the blocks come from
 *
 * The same twelve everywhere, from the forecast model — which on a location an
 * AgroExact station speaks for has already had that station's readings merged into
 * it, per quantity. So a station location shows measured numbers without this page
 * asking the account anything. See `core/model/tiles`.
 *
 * It did ask, at first: the account's own dashboard catalog decided the blocks, and
 * the API translated their titles. That fell to two things at once — the set is
 * meant to be these twelve, and the page has to speak the language set in
 * Instellingen rather than the one the server picks.
 *
 * Which blocks are measured is a per-block matter, not a per-page one: a rain gauge
 * fills in the rainfall and leaves the wind to the model, so the green dot lives on
 * the block.
 *
 * ## The swipe
 *
 * `ScreenFrame` gives the page its top row and the sideways swipe between locations,
 * as on every other tab. The copies either side cost nothing extra now that the grid
 * is read straight out of the forecast: the pager already hands each neighbour its
 * cached model, so a page sliding past draws a full grid without a single request —
 * no `usePeeking` guard needed, because there is nothing to guard.
 */
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { TAB_BAR_CLEARANCE } from '../../ui/GlassTabBar';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { ConditionTile } from '../../ui/current/ConditionTile';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useLocationStation } from '../../state/stations';
import { modelTiles, type Tile, type TileLabels } from '../../core/model/tiles';
import { measurementTimeLabel } from '../../core/model/station';
import { ta } from '../../core/i18n';

/** Two across. A third column puts a title like "Luchtvochtigheid" on three lines. */
const COLUMNS = 2;

function CurrentPage() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { model, phase, error, refresh, offsetSec } = useForecast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const station = useLocationStation(location);

  const labels: TileLabels = useMemo(
    () => ({
      temperature: ta('temperature', prefs.lang),
      humidity: ta('humidity', prefs.lang),
      windSpeed: ta('windNow', prefs.lang),
      windGust: ta('gusts', prefs.lang),
      windDirection: ta('windDirection', prefs.lang),
      gustMax: ta('gustMax', prefs.lang),
      rain: ta('rain', prefs.lang),
      tempMax: ta('tempMax', prefs.lang),
      tempMin: ta('tempMin', prefs.lang),
      now: ta('now', prefs.lang),
      today: ta('today', prefs.lang),
      last6h: ta('last6h', prefs.lang),
      last12h: ta('last12h', prefs.lang),
      last24h: ta('last24h', prefs.lang).toLowerCase(),
    }),
    [prefs.lang]
  );

  const tiles: Tile[] = useMemo(
    () => (model ? modelTiles(model, labels) : []),
    [model, labels]
  );

  // Everything on this page comes out of the forecast, which the control refreshes
  // by itself — including the station readings merged into it.
  const refreshControl = useRefreshControl();

  // A measurement carries its own timestamp, to the minute; a modelled hour does not.
  const measured = model?.station?.current;
  const timeLabel = measured
    ? measurementTimeLabel(measured.measTime, offsetSec)
    : model
      ? model.nowHour.slice(11, 16)
      : '';

  const loading = !model;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: space[5],
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space[4],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <LocationTitle />

      {phase === 'error' ? (
        <Card>
          <Text variant="body" color={palette.muted} align="center">
            {error ?? ta('noData', prefs.lang)}
          </Text>
          <Pressable onPress={refresh} accessibilityRole="button" style={{ marginTop: space[4] }}>
            <Text variant="label" color={palette.accentDark} align="center">
              {ta('retry', prefs.lang)}
            </Text>
          </Pressable>
        </Card>
      ) : loading ? (
        <Card>
          <View style={{ paddingVertical: space[8], alignItems: 'center', gap: space[3] }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        </Card>
      ) : (
        <>
          {/* Where the grid is from and when. The station's name earns its line here
              in a way it does not on 'Nu': the reader is looking at a wall of
              numbers, and which instrument produced them is the first question. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
            <Text variant="label" weight="semibold" color={palette.muted} tabular>
              {timeLabel}
            </Text>
            {station ? (
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.agroBright }}
              />
            ) : null}
            <Text
              variant="caption"
              color={station ? palette.agroInk : palette.muted}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {station
                ? `AgroExact - ${station.name ?? location.stationName ?? 'station'}`
                : ta('yourLocation', prefs.lang)}
            </Text>
          </View>

          <Grid tiles={tiles} />

          {/* Only where there is nothing measuring this place. On a station-backed
              location the dots already say which blocks are instruments, and a
              sentence about connecting one would be advice to somebody who has. */}
          {!station ? (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space[2],
                paddingHorizontal: space[2],
              }}
            >
              <Icon name="info" size={13} color={palette.muted} />
              <Text variant="caption" color={palette.muted} style={{ flexShrink: 1 }}>
                {ta('modelledBlocks', prefs.lang)}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/**
 * The blocks, two to a row.
 *
 * Laid out as rows of fixed length rather than as a wrapping flex box, because a
 * wrap gives the last row's single block the full width and a grid with one wide
 * block at the bottom reads as a mistake. An odd count leaves a gap instead, which
 * reads as what it is.
 */
function Grid({ tiles }: { tiles: Tile[] }) {
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += COLUMNS) rows.push(tiles.slice(i, i + COLUMNS));

  return (
    <View style={{ gap: space[3] }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space[3] }}>
          {row.map((tile) => (
            <ConditionTile key={tile.id} tile={tile} />
          ))}
          {/* Holds the missing half of an odd last row open. */}
          {row.length < COLUMNS
            ? Array.from({ length: COLUMNS - row.length }, (_, j) => (
                <View key={`gap${j}`} style={{ flex: 1 }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

/**
 * The route: the shared chrome, wrapped around the page above.
 *
 * `ScreenFrame` takes the component rather than its output, because the pager behind
 * it invokes one copy per location — see `LocationPager`.
 */
export default function CurrentScreen() {
  return <ScreenFrame page={CurrentPage} />;
}
