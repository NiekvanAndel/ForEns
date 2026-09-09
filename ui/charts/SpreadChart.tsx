/**
 * An hourly line with an ensemble band behind it.
 *
 * This is the chart the web app drew with `buildLineGrafiek` — a smoothed line for
 * the central value, a translucent band for the p10–p90 range, and optional gust
 * dashes above the wind line.
 *
 * The band is the point of the chart: a line alone claims a precision the ensemble
 * does not have, and the whole reason the app carries 51 members is to show where
 * that claim is weak.
 *
 * ## Reading a value off it
 *
 * Dragging across the chart puts a cursor on the nearest hour and a label beside it
 * with the hour, the value and — where the members have loaded — the range they
 * span. The label is what the band is for: "18°" and "18°, and the members say
 * anywhere from 16 to 21" are different forecasts, and only one of them is on the
 * line.
 *
 * The cursor lives as long as the finger does. Reading a chart is a glance, not a
 * mode, and a cursor left behind is a mark on the chart that has to be explained.
 *
 * The gesture only takes over once the finger has moved sideways, and gives up as
 * soon as it moves down: the chart sits inside a sheet that scrolls, and a chart
 * that swallowed a vertical drag would trap the reader on it.
 */
import { useState } from 'react';
import Svg, { Path, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Text } from '../Text';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { niceRange, scaleX, scaleY, smoothPath, type Point } from '../../core/model/smooth';

export interface SpreadSeries {
  /** Central value per sample; null gaps break the line rather than interpolating. */
  values: (number | null)[];
  /** Optional p10–p90 band per sample. */
  band?: ({ lo: number; hi: number } | null)[];
  /** Optional secondary line, e.g. gusts above mean wind. */
  secondary?: (number | null)[];
}

export interface SpreadChartProps {
  labels: string[];
  series: SpreadSeries;
  color: string;
  /** Unit suffix for the axis labels. Kept short: it rides the top gridline, where
   *  a long unit collides with the plot. */
  unit?: string;
  /** Unit for the cursor's readout, where the axis abbreviates. Wind labels its axis
   *  with nothing and sunshine with "m", and neither is what a reader pointing at an
   *  hour wants to be told. Defaults to the axis unit. */
  valueUnit?: string;
  height?: number;
  /** Draw the zero line where the quantity can be negative. */
  showZero?: boolean;
  /** Hard floor for the axis. Precipitation and sunshine cannot go below zero, and
   *  a padded "nice" range would otherwise label the axis -0,2 mm. */
  clampMin?: number;
}

const PAD_LEFT = 42;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 18;
const GRID_LINES = 3;

export function SpreadChart({
  labels, series, color, unit = '', valueUnit, height = 140, showZero, clampMin,
}: SpreadChartProps) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);
  /** The hour under the finger, or null when nobody is pointing at one. */
  const [cursor, setCursor] = useState<number | null>(null);
  /** The label's own size, so it can be kept inside the chart rather than clipped
   *  at the edges. Measured rather than guessed: its width depends on the reading. */
  const [label, setLabel] = useState({ w: 0, h: 0 });

  const finite = (a: (number | null | undefined)[]) =>
    a.filter((v): v is number => v != null && Number.isFinite(v));

  const all = [
    ...finite(series.values),
    ...finite(series.secondary ?? []),
    ...(series.band ?? []).flatMap((b) => (b ? [b.lo, b.hi] : [])),
  ];

  if (!all.length || !labels.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" color={palette.muted}>
          Geen uurdata beschikbaar
        </Text>
      </View>
    );
  }

  const range = niceRange(Math.min(...all), Math.max(...all));
  let lo = showZero ? Math.min(0, range.lo) : range.lo;
  const hi = Math.max(range.hi, (clampMin ?? lo) + 0.1);
  if (clampMin != null) lo = Math.max(lo, clampMin);

  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const n = labels.length;

  const px = (i: number) => scaleX(i, n, PAD_LEFT, plotW);
  const py = (v: number) => scaleY(v, lo, hi, PAD_TOP, plotH);

  /** Split into runs of consecutive non-null samples, so a gap is a gap. */
  const runs: Point[][] = [];
  let run: Point[] = [];
  series.values.forEach((v, i) => {
    if (v == null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ x: px(i), y: py(v) });
    }
  });
  if (run.length) runs.push(run);

  const bandPath = (() => {
    const band = series.band;
    if (!band) return null;
    const top: Point[] = [];
    const bottom: Point[] = [];
    band.forEach((b, i) => {
      if (!b) return;
      top.push({ x: px(i), y: py(b.hi) });
      bottom.push({ x: px(i), y: py(b.lo) });
    });
    if (top.length < 2) return null;
    // Down the upper edge, back along the lower one, closed.
    const upper = smoothPath(top);
    const lowerPts = [...bottom].reverse();
    const lower = smoothPath(lowerPts).replace(/^M/, 'L');
    return `${upper} ${lower} Z`;
  })();

  const secondaryRuns: Point[][] = [];
  if (series.secondary) {
    let sr: Point[] = [];
    series.secondary.forEach((v, i) => {
      if (v == null) {
        if (sr.length) secondaryRuns.push(sr);
        sr = [];
      } else {
        sr.push({ x: px(i), y: py(v) });
      }
    });
    if (sr.length) secondaryRuns.push(sr);
  }

  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, i) => lo + ((hi - lo) * i) / GRID_LINES);

  // Roughly six labels, whatever the sample count.
  const labelStep = Math.max(1, Math.ceil(n / 6));

  /** The sample nearest a touch, in the plot's own coordinates. */
  const pointAt = (x: number) => {
    if (n < 1) return;
    const f = plotW > 0 ? (x - PAD_LEFT) / plotW : 0;
    setCursor(Math.min(n - 1, Math.max(0, Math.round(f * (n - 1)))));
  };
  const clearCursor = () => setCursor(null);

  const scrub = Gesture.Pan()
    // Sideways is reading the chart, downwards is scrolling the sheet it sits in.
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => { runOnJS(pointAt)(e.x); })
    .onUpdate((e) => { runOnJS(pointAt)(e.x); })
    .onFinalize(() => { runOnJS(clearCursor)(); });

  const at = cursor != null && cursor < n ? cursor : null;
  const atValue = at != null ? series.values[at] ?? null : null;
  const atBand = at != null ? series.band?.[at] ?? null : null;
  const cursorX = at != null ? px(at) : 0;
  const cursorY = atValue != null ? py(atValue) : null;

  const readUnit = valueUnit ?? unit;
  const reading = [
    at != null ? `${labels[at]}:00` : '',
    atValue != null ? `${formatTick(atValue)}${readUnit}` : '—',
    atBand ? `${formatTick(atBand.lo)}–${formatTick(atBand.hi)}${readUnit}` : '',
  ].filter(Boolean).join(' · ');

  // Beside the point, and inside the chart: pinned above unless the point is too
  // near the top for the label to fit, and never past either edge.
  const labelLeft = Math.min(
    Math.max(cursorX - label.w / 2, 0),
    Math.max(0, width - label.w)
  );
  const labelTop =
    cursorY != null && cursorY - label.h - 8 >= 0
      ? cursorY - label.h - 8
      : (cursorY ?? PAD_TOP) + 10;

  return (
    <GestureDetector gesture={scrub}>
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {gridValues.map((v, i) => (
            <G key={i}>
              <Line
                x1={PAD_LEFT} x2={width - PAD_RIGHT}
                y1={py(v)} y2={py(v)}
                stroke={palette.hairlineSoft}
                strokeWidth={1}
              />
              <SvgText
                x={PAD_LEFT - 6} y={py(v) + 3}
                fontSize={9} fill={palette.muted} textAnchor="end"
                fontFamily="Figtree_500Medium"
              >
                {/* The unit rides only the top tick: repeating it on every
                    gridline made the labels collide at this size. */}
                {formatTick(v)}{i === gridValues.length - 1 ? unit : ''}
              </SvgText>
            </G>
          ))}

          {bandPath ? <Path d={bandPath} fill={color} opacity={0.16} /> : null}

          {runs.map((r, i) => (
            <Path
              key={`v${i}`}
              d={smoothPath(r)}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          ))}

          {secondaryRuns.map((r, i) => (
            <Path
              key={`s${i}`}
              d={smoothPath(r)}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
              fill="none"
            />
          ))}

          {/* A single sample cannot draw a line, so mark it as a point. */}
          {runs.map((r, i) =>
            r.length === 1 ? (
              <Circle key={`p${i}`} cx={r[0]!.x} cy={r[0]!.y} r={3} fill={color} />
            ) : null
          )}

          {labels.map((l, i) =>
            i % labelStep === 0 ? (
              <SvgText
                key={`l${i}`}
                x={px(i)} y={height - 5}
                fontSize={9} fill={palette.muted} textAnchor="middle"
                fontFamily="Figtree_500Medium"
              >
                {l}
              </SvgText>
            ) : null
          )}

          {at != null ? (
            <G>
              <Line
                x1={cursorX} x2={cursorX}
                y1={PAD_TOP} y2={height - PAD_BOTTOM}
                stroke={palette.muted}
                strokeWidth={1}
                opacity={0.5}
              />
              {cursorY != null ? (
                <Circle
                  cx={cursorX} cy={cursorY} r={4.5}
                  fill={color}
                  stroke={palette.appCard}
                  strokeWidth={2}
                />
              ) : null}
            </G>
          ) : null}
        </Svg>
      ) : null}

      {at != null ? (
        <View
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            // Only on a change, or every drag frame would set state twice.
            if (Math.abs(w - label.w) > 0.5 || Math.abs(h - label.h) > 0.5) {
              setLabel({ w, h });
            }
          }}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: labelLeft,
              top: labelTop,
              // The tinted surface, not the card's own: the chart sits on a card,
              // and a label in the card's colour is a shadow with words in it.
              backgroundColor: palette.surfaceAlt,
              borderRadius: radius.tile,
              paddingVertical: 4,
              paddingHorizontal: space[2],
            },
            shadowFloat,
          ]}
        >
          <Text variant="caption" weight="bold" color={palette.inkHeading} tabular numberOfLines={1}>
            {reading}
          </Text>
        </View>
      ) : null}
    </View>
    </GestureDetector>
  );
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100) return String(Math.round(v));
  if (abs >= 10) return String(Math.round(v));
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1).replace('.', ',');
}
