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
 * ## What it says out loud
 *
 * Three things the contract insists on, because each of them makes the number on
 * screen mean something other than it appears to:
 *
 *  - **The anchor is not now.** The hourly radar for hour H is stored at H:10, so the
 *    newest window can end over an hour ago. The panel names that time.
 *  - **Missing radar hours make the total a floor**, not an estimate.
 *  - **Uncalibrated hours** are raw radar rather than gauge-corrected.
 *
 * And one the contract does not, because it only exists in this app: where the
 * location has a rain gauge standing in it, the figure is that gauge's own total and
 * says so — see `useCumulativeReading`.
 */
import { Pressable, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { Scrubber } from './Scrubber';
import {
  clockAt, coverageOf, formatMm, sinceLabel, windowLabel,
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

  const coverage = coverageOf(window);

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
          <Origin reading={reading} />
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

      {coverage.missing > 0 ? (
        <Warning
          text={
            `${coverage.missing} van de ${window.hours_expected} radaruren ontbreekt — ` +
            'het totaal is een ondergrens.'
          }
        />
      ) : null}

      {coverage.uncalibrated > 0 ? (
        <Warning
          text={
            `${coverage.uncalibrated} uur is ongekalibreerde radar, zonder correctie ` +
            'op regenmeters.'
          }
        />
      ) : null}

      {reading.stationGap ? (
        <Warning
          text={
            `${reading.stationName ?? 'Het station'} meldde ${reading.stationGap.hoursFound} ` +
            `van de ${reading.stationGap.hoursExpected} uur; de radarwaarde wordt getoond.`
          }
        />
      ) : null}

      {reading.outsideCrop ? (
        <Warning text="Deze locatie ligt buiten het gebied van de neerslagsom." />
      ) : null}

      {manifest.source !== 'radar' ? (
        <Warning text={`Testdata (${manifest.source}) — geen echte metingen.`} />
      ) : null}
    </View>
  );
}

/** Where the figure came from. Two sources answer the same question here and they are
 *  not the same kind of answer, so the panel never shows one without saying which. */
function Origin({ reading }: { reading: CumulativeReading }) {
  const { palette } = useTheme();
  if (reading.mm == null) return null;

  if (reading.origin === 'station') {
    return (
      <Text variant="caption" color={palette.textStation} weight="semibold">
        {reading.stationName ? `Gemeten · ${reading.stationName}` : 'Gemeten op dit station'}
      </Text>
    );
  }
  return (
    <Text variant="caption" color={palette.muted}>
      Radar, gekalibreerd op regenmeters
    </Text>
  );
}

function Warning({ text }: { text: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
      <View style={{ paddingTop: 1 }}>
        <Icon name="warning" size={13} color={palette.muted} />
      </View>
      <Text variant="caption" color={palette.muted} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
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
