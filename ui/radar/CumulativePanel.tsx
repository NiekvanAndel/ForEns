/**
 * The panel under the map while the cumulative layer is up.
 *
 * It replaces the nowcast profile rather than joining it. The curve answers "how hard
 * will it rain here in the next two hours" and this answers "how much has fallen
 * since a moment in the past"; they share a location and nothing else, and a
 * time-scrubber under a static total would invite the reader to drag it looking for
 * motion that is not there.
 *
 * ## The curve is the control, until it is folded away
 *
 * `CumulativeChart` draws the total at each window, shortest on the left, and dragging
 * across it picks the window — the same arrangement the nowcast curve has, and for the
 * same reason: a line a reader can see moving is a line they will try to drag. What
 * the chart adds over a bare track is the shape of the climb, which is the difference
 * between rain that fell this morning and rain that was already there yesterday.
 *
 * Swiped down, all of this folds and `CumulativeTimeline` stands in its place with a
 * play button and a slider, because something on screen has to be draggable. The two
 * are never visible together, which is also why the small play button in the header
 * here and the full-sized one in that row are not a duplicate pair. The fold itself
 * belongs to `FullMap`, which owns it for whichever layer is up.
 *
 * The play button walks from the last hour out to two days, so the cursor moves with
 * the number rather than against it.
 *
 * ## What it says, and what it no longer says
 *
 * The anchor is named rather than called "now": the hourly radar for hour H is stored
 * at H:10, so the newest window can end over an hour ago, and that is the one caveat
 * a reader cannot work around by looking at the map.
 *
 * The contract also asks for two coverage warnings — missing radar hours make the
 * total a floor, uncalibrated hours are raw radar — and those were a stack of three
 * lines under the slider. Taken out at the client's direction (15 Sep 2026): on a
 * 48 hour window all of them fire at once, which spends half the panel on caveats
 * about a number the reader has not finished reading. The data is still in the
 * manifest and `coverageOf` still derives it, so putting it back anywhere is a
 * render, not a rebuild.
 *
 * What stays beside the figure is its provenance, because that is not a caveat but
 * part of the reading: a gauge's own total and a calibrated radar estimate are two
 * different kinds of answer to the same question — see `useCumulativeReading`. While
 * the layer runs on the dummy build, the radar line says so, or synthetic rainfall
 * reads as measured.
 */
import { Pressable, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { CumulativeChart } from './CumulativeChart';
import {
  clockAt, formatMm, sinceLabel,
  type CumulativeManifest, type CumulativeWindow,
} from '../../core/radar/cumulative';
import type { CumulativeReading, SeriesPoint } from '../../core/radar/reading';
import type { CumulativeStatus } from './useCumulative';

export interface CumulativePanelProps {
  status: CumulativeStatus;
  manifest: CumulativeManifest | null;
  /** Shortest first — the order the slider's track runs in. */
  windows: CumulativeWindow[];
  index: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  reading: CumulativeReading;
  /** The accumulation curve for this location, one point per window. */
  series: SeriesPoint[];
  locationName?: string;
  retryAfterSec: number | null;
  /** Width available to the chart, which has to be told rather than measure itself. */
  width: number;
}

export function CumulativePanel({
  status, manifest, windows, index, onIndexChange, playing, onTogglePlay,
  reading, series, locationName, retryAfterSec, width,
}: CumulativePanelProps) {
  const { palette } = useTheme();
  const window = windows[index];

  if (status === 'unavailable') {
    return (
      <Notice
        icon="clock"
        title="Neerslagsom nog niet beschikbaar"
        detail={
          retryAfterSec
            ? `De lagen worden opgebouwd. Probeer het over ${Math.ceil(retryAfterSec / 60)} min opnieuw.`
            : 'De lagen worden opgebouwd. Probeer het zo opnieuw.'
        }
      />
    );
  }

  if (status === 'error') {
    return (
      <Notice
        icon="warning"
        title="Neerslagsom niet geladen"
        detail="De som kon niet worden opgehaald. Controleer je verbinding."
      />
    );
  }

  if (!manifest || !window) {
    return <Notice icon="drop" title="Neerslagsom laden…" detail="" />;
  }

  return (
    <View style={{ paddingHorizontal: space[5], gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          {locationName ? (
            <Text variant="label" weight="bold" color={palette.inkHeading} numberOfLines={1}>
              {locationName}
            </Text>
          ) : null}
          <Text variant="stat" weight="bold" color={palette.appValue} tabular>
            {reading.mm != null ? formatMm(reading.mm) : reading.loading ? '…' : '—'}
          </Text>
          <Origin reading={reading} source={manifest.source} />
        </View>

        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Opbouw pauzeren' : 'Opbouw afspelen'}
          disabled={windows.length < 2}
          hitSlop={8}
          style={{
            width: 34, height: 34, borderRadius: radius.pill,
            backgroundColor: windows.length < 2 ? palette.inkDisabled : palette.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={15} color="#fff" weight="fill" />
        </Pressable>

      </View>

      {/* The window in clock terms. "tot" and not "nu": the newest complete radar
          hour can be over an hour old, which is the one caveat a reader cannot work
          around by looking at the map. */}
      <Text variant="caption" color={palette.muted} tabular>
        {`${sinceLabel(window)} tot ${clockAt(manifest.anchor)}`}
      </Text>

      <CumulativeChart
        series={series}
        index={index}
        onIndexChange={onIndexChange}
        width={width}
      />

    </View>
  );
}

/**
 * Where the figure came from.
 *
 * Two sources answer the same question here and they are not the same kind of answer,
 * so the panel never shows one without saying which. It also carries the two things a
 * bare dash cannot explain by itself: a location the layer does not cover, and a
 * layer built from synthetic data.
 */
function Origin({ reading, source }: { reading: CumulativeReading; source: string }) {
  const { palette } = useTheme();

  if (reading.mm == null) {
    // The crop is tighter than the map, so this is a real answer rather than a gap:
    // without it the dash reads as a loading state that never finishes.
    if (reading.outsideCrop) {
      return (
        <Text variant="caption" color={palette.muted}>
          Buiten het gebied van de neerslagsom
        </Text>
      );
    }
    return null;
  }

  // A station's own measurement is a measurement whatever the radar layer is built
  // from, so the dummy note belongs to the radar line and only to it.
  if (reading.origin === 'station') {
    return (
      <Text variant="caption" color={palette.textStation} weight="semibold">
        {reading.stationName ? `Gemeten · ${reading.stationName}` : 'Gemeten op dit station'}
      </Text>
    );
  }
  return (
    <Text variant="caption" color={palette.muted}>
      {source === 'radar'
        ? 'Radar, gekalibreerd op regenmeters'
        : `Radar · testdata (${source}), geen echte metingen`}
    </Text>
  );
}

function Notice({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space[5], flexDirection: 'row',
        alignItems: 'center', gap: space[3], minHeight: 56,
      }}
    >
      <Icon name={icon} size={20} color={palette.muted} />
      <View style={{ flex: 1 }}>
        <Text variant="label" weight="bold" color={palette.inkHeading}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" color={palette.muted}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
