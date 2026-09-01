/**
 * The nowcast panel under the full-screen radar.
 *
 * Answers what the radar loop cannot: how hard it rains here, and when. The header
 * names the place and the intensity at the moment the loop is showing; the curve is
 * the 0–2 hour profile in millimetres per hour.
 *
 * Drawn with the same `smoothPath` the meteograms use, so a shower building over
 * twenty minutes reads as a slope rather than as a staircase.
 *
 * The header is caption-sized on purpose. It was `screenTitle`, which spent a band
 * of height on two numbers read in a glance — the map is what deserves the space.
 *
 * `domain` is the shared axis from `radarAxis`: the span the radar loop covers.
 * Both this chart and the scrubber under it read that one axis, which is what makes
 * the cursor and the thumb move as one — drawn against their own spans they could
 * not, and the cursor sat against the left edge whatever the scrubber did.
 *
 * The curve is clipped to that span rather than widening it. The profile reaches two
 * hours forward; a past-only radar provider does not, and drawing the whole profile
 * put a forecast on the chart that the map beside it had no pictures for. What is
 * drawn is what the loop can show, with the ends interpolated so the curve still
 * meets both edges.
 *
 * The chart is a scrubber too: dragging across it moves the loop, since a line you
 * can see moving is a line you will try to drag.
 */
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { usePrefs } from '../../state/prefs';
import { fmtMm, ta } from '../../core/i18n';
import { smoothPath } from '../../core/model/smooth';
import { intensityAt, type NowcastProfile } from '../../core/radar';

const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PAD_LEFT = 26;

/** On the radar page the card holds the chart, its axis labels and the timeline,
 *  and all three have to sit above the tab bar without the map giving up its own
 *  height. Short enough that the play button is never behind the bar. */
const CHART_HEIGHT_COMPACT = 78;
/** Full screen has the room, and the panel folds away when it is in the way. */
const CHART_HEIGHT_FULL = 118;

export interface NowcastPanelProps {
  profile: NowcastProfile | null;
  /** Minutes from now the loop is currently showing, so the panel tracks the scrub. */
  offsetMin: number;
  width: number;
  /** Shorter, for the card on the radar page where the map is already the subject. */
  compact?: boolean;
  /** The axis span, in minutes from now — the window the radar loop covers. The
   *  curve is clipped to it. Defaults to the profile's own range. */
  domain?: { from: number; to: number };
  /** Named on the left of the header. */
  locationName?: string;
  /** Dragging across the chart scrubs, reporting a position 0–1 along the axis. */
  onScrubFraction?: (fraction: number) => void;
}

export function NowcastPanel({
  profile, offsetMin, width, compact, domain, locationName, onScrubFraction,
}: NowcastPanelProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  // The quarter-hourly series where the provider supplies one — it reaches back
  // over the observed frames — and the hero's four forward bars otherwise.
  const samples = profile?.series?.length ? profile.series : (profile?.bars ?? []);

  if (!samples.length) {
    return (
      <View style={{ padding: space[6] }}>
        <Text variant="bodySm" color={palette.muted} align="center">
          {ta('noData', prefs.lang)}
        </Text>
      </View>
    );
  }

  const chartHeight = compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT_FULL;

  const from = domain?.from ?? samples[0]!.offsetMin;
  const to = domain?.to ?? samples[samples.length - 1]!.offsetMin;
  const spanMin = Math.max(1, to - from);
  const plotW = Math.max(1, width - PAD_LEFT - space[5]);
  const plotH = chartHeight - PAD_TOP - PAD_BOTTOM;

  // Everything inside the axis, with an interpolated value at each edge so the curve
  // reaches them even when no sample falls exactly there.
  const inside = samples.filter((b) => b.offsetMin > from && b.offsetMin < to);
  const visible = [
    { offsetMin: from, mmPerHour: intensityAt(samples, from) },
    ...inside,
    { offsetMin: to, mmPerHour: intensityAt(samples, to) },
  ];

  // Scaled to what is drawn, not to the whole profile: a downpour clipped off the
  // right-hand edge must not flatten the shower that is on screen.
  const maxMm = Math.max(1, ...visible.map((b) => b.mmPerHour));
  // A "nice" top so the axis reads 2, 4, 6 rather than 5.3.
  const top = Math.ceil(maxMm / 2) * 2 || 2;

  const x = (min: number) => PAD_LEFT + ((min - from) / spanMin) * plotW;
  const y = (mm: number) => PAD_TOP + plotH - (Math.min(mm, top) / top) * plotH;

  const points = visible.map((b) => ({ x: x(b.offsetMin), y: y(b.mmPerHour) }));
  const line = smoothPath(points);
  const area = `${line} L${points[points.length - 1]!.x},${PAD_TOP + plotH} L${points[0]!.x},${PAD_TOP + plotH} Z`;

  // Dragging across the plot scrubs the loop. Reported as a fraction of the axis so
  // the caller maps it back to a frame — this component knows nothing about frames.
  const report = (x: number) => {
    if (!onScrubFraction) return;
    onScrubFraction(Math.min(1, Math.max(0, (x - PAD_LEFT) / plotW)));
  };

  const scrub = Gesture.Pan()
    .enabled(!!onScrubFraction)
    // No slop: a tap on the chart should move the cursor there, not wait for a drag.
    .minDistance(0)
    .onBegin((e) => { runOnJS(report)(e.x); })
    .onUpdate((e) => { runOnJS(report)(e.x); });

  // What the scrubber is pointing at, interpolated between the two nearest samples.
  const atNow = intensityAt(samples, offsetMin);
  const cursorX = x(Math.min(Math.max(offsetMin, from), to));
  // Ticks across the whole axis, not only where the curve is.
  const ticks = [0, 0.33, 0.66, 1].map((f) => from + f * spanMin);

  return (
    <View
      style={{
        paddingHorizontal: space[5],
        paddingTop: compact ? space[4] : space[3],
        paddingBottom: space[2],
      }}
    >
      {/* Where, and how hard — one line, at the size of a caption rather than a
          headline, because the map above is the thing being read. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[3] }}>
        <Text
          variant="bodySm"
          weight="semibold"
          color={palette.inkHeading}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          {locationName ?? ta('yourLocation', prefs.lang)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <Text
            variant="bodySm"
            weight="bold"
            color={atNow > 0 ? palette.valPrecip : palette.inkHeading}
            tabular
          >
            {fmtMm(atNow)}
          </Text>
          <Text variant="caption" color={palette.muted}>
            mm/u
          </Text>
        </View>
      </View>

      <GestureDetector gesture={scrub}>
      <Svg width={width} height={chartHeight} style={{ marginTop: space[2] }}>
        <Defs>
          <SvgGradient id="nowcastFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.sky} stopOpacity={0.28} />
            <Stop offset="1" stopColor={palette.sky} stopOpacity={0.02} />
          </SvgGradient>
        </Defs>

        {[0, top / 2, top].map((v) => (
          <Line
            key={v}
            x1={PAD_LEFT}
            x2={PAD_LEFT + plotW}
            y1={y(v)}
            y2={y(v)}
            stroke={palette.hairline}
            strokeWidth={1}
            strokeDasharray={v === 0 ? undefined : '3 5'}
          />
        ))}

        <Path d={area} fill="url(#nowcastFill)" />
        <Path d={line} stroke={palette.accentDark} strokeWidth={2.5} fill="none" />

        <Line
          x1={cursorX}
          x2={cursorX}
          y1={PAD_TOP}
          y2={PAD_TOP + plotH}
          stroke={palette.muted}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <Circle cx={cursorX} cy={y(atNow)} r={4.5} fill={palette.accentDark} />
      </Svg>
      </GestureDetector>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: PAD_LEFT }}>
        {ticks.map((min) => (
          <Text key={min} variant="caption" color={palette.muted} tabular>
            {clockAt(min)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Wall-clock time this many minutes from now. */
function clockAt(offsetMin: number): string {
  const d = new Date(Date.now() + offsetMin * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
