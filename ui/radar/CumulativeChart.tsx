/**
 * The accumulation curve: how the total at this location built up.
 *
 * One point per published window, shortest on the left — and the axis is signed,
 * −1u to −48u, because a bare "48u" under a rising line reads as a forecast running
 * two days out rather than a total counted backwards from now.
 *
 * Because the windows nest —
 * the 24 hour field is the newest 24 hours of the 48 hour one — those points read as
 * a running sum, and the line can only climb. What it shows is the shape of that
 * climb: a steep left-hand end is rain that fell in the last few hours, a flat one
 * is a total that was already there yesterday and has not moved since.
 *
 * It is the control as well as the picture, exactly as the nowcast curve is: dragging
 * across it picks the window, and the map follows. A line a reader can see moving is
 * a line they will try to drag, and a slider underneath it would be a second control
 * for the one choice.
 *
 * ## Gaps are drawn as gaps
 *
 * A window whose raster has not arrived has no point. The line is drawn through the
 * points that exist and the cursor still lands on the window it is over, because the
 * alternative — a zero, or a straight line across the gap — is a claim that it
 * stopped raining.
 */
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import type { SeriesPoint } from '../../core/radar/reading';
import { axisLabel } from '../../core/radar/cumulative';

const PAD_TOP = 10;
const PAD_BOTTOM = 6;
/** Room for the millimetre axis on the left. */
const PAD_LEFT = 30;
const HEIGHT = 104;

/** The cursor's grab handle — a ring rather than a disc, so it sits around the point
 *  on the curve rather than on top of it. Matching the nowcast panel's. */
const HANDLE_RADIUS = 9;

export interface CumulativeChartProps {
  /** One point per window, shortest first. */
  series: readonly SeriesPoint[];
  /** The window the map is showing, as an index into `series`. */
  index: number;
  onIndexChange: (index: number) => void;
  width: number;
}

export function CumulativeChart({ series, index, onIndexChange, width }: CumulativeChartProps) {
  const { palette } = useTheme();

  const plotW = Math.max(1, width - PAD_LEFT);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const last = Math.max(1, series.length - 1);

  // Scaled to what is drawn. A "nice" top so the axis reads 10 or 20 rather than
  // 17.4, and never zero — a dry window still needs an axis to sit on.
  const peak = Math.max(0, ...series.map((p) => p.mm ?? 0));
  const top = niceTop(peak);

  const x = (i: number) => PAD_LEFT + (i / last) * plotW;
  const y = (mm: number) => PAD_TOP + plotH - (Math.min(mm, top) / top) * plotH;

  const points = series
    .map((point, i) => (point.mm == null ? null : { x: x(i), y: y(point.mm), i }))
    .filter((p): p is { x: number; y: number; i: number } => p != null);

  // Straight segments, not a spline: between two windows the total is a sum that only
  // rises, and a smoothed curve through six points dips below its own samples — which
  // here would draw rain un-falling.
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = points.length
    ? `${line} L${points[points.length - 1]!.x},${PAD_TOP + plotH} L${points[0]!.x},${PAD_TOP + plotH} Z`
    : '';

  const report = (px: number) => {
    const fraction = Math.min(1, Math.max(0, (px - PAD_LEFT) / plotW));
    const next = Math.round(fraction * last);
    if (next !== index) onIndexChange(next);
  };

  const scrub = Gesture.Pan()
    // No slop: a tap on the chart should move the cursor there, not wait for a drag.
    .minDistance(0)
    .onBegin((e) => { runOnJS(report)(e.x); })
    .onUpdate((e) => { runOnJS(report)(e.x); });

  const cursorX = x(Math.min(Math.max(index, 0), last));
  const atCursor = series[index]?.mm ?? null;

  return (
    <View>
      <GestureDetector gesture={scrub}>
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <SvgGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.sky} stopOpacity={0.3} />
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

          {area ? <Path d={area} fill="url(#cumulativeFill)" /> : null}
          {points.length > 1 ? (
            <Path
              d={line}
              stroke={palette.accentDark}
              strokeWidth={2.5}
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}

          {/* Every window is a sample, not a point on a continuous curve, so each one
              is marked: the line between them is interpolation and these are not. */}
          {points.map((p) => (
            <Circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={p.i === index ? 0 : 2.5}
              fill={palette.accentDark}
              opacity={0.8}
            />
          ))}

          <Line
            x1={cursorX}
            x2={cursorX}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke={palette.muted}
            strokeWidth={1}
            strokeDasharray="3 4"
          />

          {atCursor != null ? (
            <>
              <Circle
                cx={cursorX}
                cy={y(atCursor)}
                r={HANDLE_RADIUS}
                fill={palette.appCard}
                fillOpacity={0.9}
                stroke={palette.accentDark}
                strokeWidth={2.5}
              />
              <Circle cx={cursorX} cy={y(atCursor)} r={2.5} fill={palette.accentDark} />
            </>
          ) : null}
        </Svg>
      </GestureDetector>

      {/* The axis top, against the grid line it belongs to. The bottom is always
          zero, which needs no label. */}
      <View style={{ position: 'absolute', left: 0, top: PAD_TOP - 7, width: PAD_LEFT - 4 }}>
        <Text variant="caption" color={palette.muted} align="right" tabular>
          {top}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row', justifyContent: 'space-between',
          paddingLeft: PAD_LEFT, marginTop: space[1],
        }}
      >
        {series.map((point, i) => (
          <Text
            key={point.hours}
            variant="caption"
            color={i === index ? palette.inkHeading : palette.muted}
            weight={i === index ? 'bold' : 'regular'}
            tabular
          >
            {axisLabel(point.hours)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * An axis top a reader can divide in half in their head.
 *
 * Never zero: a window with no rain in it still needs a scale, and a top of zero puts
 * every grid line on the same pixel.
 */
function niceTop(peak: number): number {
  if (!(peak > 0)) return 2;
  const steps = [2, 5, 10, 20, 30, 50, 75, 100, 150, 200];
  for (const step of steps) if (peak <= step) return step;
  return Math.ceil(peak / 100) * 100;
}
