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
 * On a location an AgroExact station speaks for, they are the blocks on that
 * account's dashboard — the ones the grower chose on the web, in their order, with
 * their titles and their time windows, translated by the API. The app does not have
 * an opinion about which of them matter.
 *
 * Everywhere else there is no dashboard to read, so the same grid is built from the
 * weather model instead: twelve figures, fixed. See `core/model/tiles`.
 *
 * The catalog is only *asked for* where there is a station, which is the difference
 * between a grid and twelve dashes. It is a property of the account, not of the
 * location, so a connected account answers with its blocks wherever it is asked —
 * and on a location with no station there is nothing to compute them against, so
 * every one of them came back empty. A pull to refresh fetched the same nothing
 * again, which is what made it look broken rather than merely blank.
 *
 * The two are told apart by the dot, not by the layout. A location can also be both
 * at once — a rain gauge fills in the rainfall and leaves the wind to the model — so
 * the distinction has to live on the block rather than on the page.
 *
 * ## The swipe
 *
 * `ScreenFrame` gives the page its top row and the sideways swipe between locations,
 * as on every other tab. The copies either side are drawn from the cached forecast
 * and ask `usePeeking` before fetching anything: a page sliding past does not need a
 * round trip to the account, and the modelled grid it draws instead is the same
 * shape, so the swipe lands on a grid rather than on a spinner.
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
import { usePeeking } from '../../ui/peek';
import { ConditionTile } from '../../ui/current/ConditionTile';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useDashboardBlocks, useLocationStation } from '../../state/stations';
import { dashboardTiles, modelTiles, type Tile, type TileLabels } from '../../core/model/tiles';
import { measurementTimeLabel } from '../../core/model/station';
import { ta } from '../../core/i18n';

/** Two across. A third column puts a title like "Luchtvochtigheid" on three lines. */
const COLUMNS = 2;

function CurrentPage() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { model, phase, error, refresh, offsetSec } = useForecast();
  const insets = useSafeAreaInsets();
  const peeking = usePeeking();
  const router = useRouter();

  const station = useLocationStation(location);
  // No station, no request: see the note at the top of the file.
  const dashboard = useDashboardBlocks(station?.id ?? null, !peeking && !!station);

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

  // The account's own blocks where there are any, the model's where there are not.
  // A station whose dashboard is empty or unreachable still gets a page: an account
  // with nothing selected on it is a settings problem, and an empty grid would say
  // the station had stopped reporting.
  const tiles: Tile[] = useMemo(() => {
    if (station && dashboard.blocks.length) {
      return dashboardTiles(
        dashboard.blocks.map((b) => ({
          id: b.id, title: b.title, attribute: b.attribute,
          timeLabel: b.timeLabel, unit: b.unit, value: b.value,
        }))
      );
    }
    return model ? modelTiles(model, labels) : [];
  }, [station, dashboard.blocks, model, labels]);

  // The forecast is refreshed by the control itself; the dashboard is this page's
  // own, so the pull has to ask for it too.
  const refreshControl = useRefreshControl(dashboard.refetch);

  // A measurement carries its own timestamp, to the minute; a modelled hour does not.
  const measured = model?.station?.current;
  const timeLabel = measured
    ? measurementTimeLabel(measured.measTime, offsetSec)
    : model
      ? model.nowHour.slice(11, 16)
      : '';

  const loading = !model || (dashboard.loading && !!station);

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
