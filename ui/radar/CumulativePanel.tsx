/**
 * The panel under the map while the cumulative layer is up.
 *
 * It replaces the nowcast profile rather than joining it. The curve answers "how hard
 * will it rain here in the next two hours" and this answers "how much has fallen
 * since a moment in the past"; they share a location and nothing else, and a
 * time-scrubber under a static total would invite the reader to drag it looking for
 * motion that is not there.
 *
 * ## The slider is the length of the window, and it grows to the right
 *
 * Every window ends at the same moment, so what the slider chooses is how far back
 * the counting starts. Dragging right reaches further back, and because the windows
 * nest, the total can only grow as it goes — which is the whole reading: drag out
 * through the night and watch the shower add up. The play button walks the same way,
 * from the last hour out to two days, so the thumb moves with the number rather than
 * against it.
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
import { Scrubber } from './Scrubber';
import {
  clockAt, formatMm, sinceLabel, windowLabel,
  type CumulativeManifest, type CumulativeWindow,
} from '../../core/radar/cumulative';
import type { CumulativeReading } from './useCumulativeReading';
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
  locationName?: string;
  retryAfterSec: number | null;
}

export function CumulativePanel({
  status, manifest, windows, index, onIndexChange, playing, onTogglePlay,
  reading, locationName, retryAfterSec,
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
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[3] }}>
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

        {/* The window as a word, beside the figure it belongs to. The slider's
            position is that same length as a distance along a track, which is
            readable at a glance and unreadable as a number. */}
        <View
          style={{
            backgroundColor: palette.surfaceAlt,
            borderRadius: radius.pill,
            paddingVertical: 4, paddingHorizontal: space[3],
          }}
        >
          <Text variant="caption" weight="bold" color={palette.inkHeading} tabular>
            {windowLabel(window.hours)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Opbouw pauzeren' : 'Opbouw afspelen'}
          disabled={windows.length < 2}
          style={{
            width: 42, height: 42, borderRadius: radius.pill,
            backgroundColor: windows.length < 2 ? palette.inkDisabled : palette.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={18} color="#fff" weight="fill" />
        </Pressable>

        <View style={{ flex: 1, gap: 4 }}>
          <Scrubber
            value={index}
            steps={windows.length}
            onChange={onIndexChange}
            disabled={windows.length < 2}
            accessibilityLabel="Terugkijkperiode"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color={palette.muted} tabular>
              {sinceLabel(window)}
            </Text>
            {/* Never "nu": the newest complete radar hour can be over an hour old. */}
            <Text variant="caption" color={palette.muted} tabular>
              {`tot ${clockAt(manifest.anchor)}`}
            </Text>
          </View>
        </View>
      </View>

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
