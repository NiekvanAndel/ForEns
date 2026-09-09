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
 * can see moving is a line you will try to drag. The cursor is drawn as a grabbable
 * handle rather than as a dot on the line — a ring the size of a fingertip — because
 * that is what says the line can be dragged. The whole plot takes the gesture, so
 * the handle is an affordance rather than a target, but a mark you would not think
 * to grab is a control nobody finds.
 *
 * Play and pause sit in the header, beside the place name. They used to be at the
 * head of the scrubber below, glued to the track and reading as part of it; up here
 * they are next to the other thing this panel says about the loop as a whole, and
 * the track gets the full width it wants.
 *
 * It folds away with the curve on the map page, which is only safe because the row
 * that replaces it there carries a full-sized play button of its own — see
 * `FullMap`. The two are never on screen at once.
 *
 * The dashed rule at the observed/forecast boundary is the same mark the scrubber
 * puts on its track, from the same `forecastBoundary` — two drawings of one
 * boundary, not two boundaries.
 */
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
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

/** The cursor's grab handle. Big enough to read as one, small enough not to hide the
 *  curve it sits on — which is why it is a ring rather than a filled disc. */
const HANDLE_RADIUS = 9;

/**
 * Whether this profile has a curve to draw — and therefore to drag.
 *
 * The chart is the scrubber wherever there is one, and the slider below is shown
 * only where there is not. Both pages ask this rather than reaching into the shape
 * of a profile themselves, so the answer cannot drift from what the panel draws.
 */
export function hasNowcastCurve(profile: NowcastProfile | null): boolean {
  return !!(profile?.series?.length || profile?.bars?.length);
}

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
  /** Where observation ends and forecast begins, 0–1 along the axis. Drawn as a
   *  dashed rule; the scrubber below marks the same fraction on its track. */
  boundaryFraction?: number | null;
  /** Play and pause, beside the name. Omitted where there is no loop to run. */
  playing?: boolean;
  onTogglePlay?: () => void;
  /** Nothing to play: a loop of one frame, or none loaded. */
  playDisabled?: boolean;
}

interface NowcastHeaderProps {
  profile: NowcastProfile | null;
  /** Minutes from now the loop is showing, for the intensity on the right. */
  offsetMin: number;
  locationName?: string;
  playing?: boolean;
  onTogglePlay?: () => void;
  playDisabled?: boolean;
}

/**
 * Where, how hard, and whether the loop is running.
 *
 * One line, at the size of a caption rather than a headline, because the map above
 * is the thing being read. Drawn even when there is no profile: the play button
 * belongs to the radar loop, which may be perfectly good over a location the
 * nowcast has nothing to say about.
 */
function NowcastHeader({
  profile, offsetMin, locationName, playing, onTogglePlay, playDisabled,
}: NowcastHeaderProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const samples = profile?.series?.length ? profile.series : (profile?.bars ?? []);
  const atNow = samples.length ? intensityAt(samples, offsetMin) : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      {onTogglePlay ? (
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Animatie pauzeren' : 'Animatie afspelen'}
          disabled={playDisabled}
          hitSlop={8}
          style={{
            width: 30, height: 30, borderRadius: radius.pill,
            backgroundColor: playDisabled ? palette.inkDisabled : palette.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} color="#fff" weight="fill" />
        </Pressable>
      ) : null}

      <Text
        variant="bodySm"
        weight="semibold"
        color={palette.inkHeading}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {locationName ?? ta('yourLocation', prefs.lang)}
      </Text>

      {atNow != null ? (
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
      ) : null}
    </View>
  );
}

export function NowcastPanel({
  profile, offsetMin, width, compact, domain, locationName, onScrubFraction,
  boundaryFraction, playing, onTogglePlay, playDisabled,
}: NowcastPanelProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  // The quarter-hourly series where the provider supplies one — it reaches back
  // over the observed frames — and the hero's four forward bars otherwise.
  const samples = profile?.series?.length ? profile.series : (profile?.bars ?? []);

  const chartHeight = compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT_FULL;

  // Read before the empty case returns below, so both have to survive an empty
  // profile — a location the nowcast has nothing to say about still draws a header.
  const from = domain?.from ?? samples[0]?.offsetMin ?? 0;
  const to = domain?.to ?? samples[samples.length - 1]?.offsetMin ?? 0;
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
  const atNow = samples.length ? intensityAt(samples, offsetMin) : 0;
  const cursorX = x(Math.min(Math.max(offsetMin, from), to));
  // Ticks across the whole axis, not only where the curve is.
  const ticks = [0, 0.33, 0.66, 1].map((f) => from + f * spanMin);

  const header = (
    <NowcastHeader
      profile={profile}
      offsetMin={offsetMin}
      locationName={locationName}
      playing={playing}
      onTogglePlay={onTogglePlay}
      playDisabled={playDisabled}
    />
  );

  const frame = {
    paddingHorizontal: space[5],
    paddingTop: compact ? space[4] : space[3],
    // On the radar card this is usually the last thing in it, so the axis labels
    // need air under them; on the map page a slider follows and would be pushed off.
    paddingBottom: compact ? space[4] : space[2],
  };

  if (!samples.length) {
    return (
      <View style={frame}>
        {header}
        <View style={{ paddingVertical: space[5] }}>
          <Text variant="bodySm" color={palette.muted} align="center">
            {ta('noData', prefs.lang)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={frame}>
      {header}

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

        {/* The same boundary the scrubber ticks on its track. */}
        {boundaryFraction != null ? (
          <Line
            x1={PAD_LEFT + boundaryFraction * plotW}
            x2={PAD_LEFT + boundaryFraction * plotW}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke={palette.muted}
            strokeWidth={1.5}
            strokeDasharray="2 3"
            opacity={0.55}
          />
        ) : null}

        <Line
          x1={cursorX}
          x2={cursorX}
          y1={PAD_TOP}
          y2={PAD_TOP + plotH}
          stroke={palette.muted}
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        {/* A ring, not a dot: it has to look like something you can take hold of,
            and a filled disc this size would sit on the curve rather than around
            the point on it. */}
        <Circle
          cx={cursorX}
          cy={y(atNow)}
          r={HANDLE_RADIUS}
          fill={palette.appCard}
          fillOpacity={0.9}
          stroke={palette.accentDark}
          strokeWidth={2.5}
        />
        <Circle cx={cursorX} cy={y(atNow)} r={2.5} fill={palette.accentDark} />
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
