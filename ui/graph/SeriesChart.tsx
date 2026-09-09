/**
 * The chart on 'Grafiek': one quantity over a chosen period.
 *
 * `SpreadChart` draws an hourly forecast with its ensemble band behind it, and that
 * is a different picture from this one: it is always the same length, always the
 * same resolution, and everything on it comes from one place. This chart is asked
 * for anything from one day to a month, at hour or day resolution, over samples that
 * are partly measured and partly forecast — and the last of those is what earns it
 * its own file rather than another two flags on that one.
 *
 * ## Measured and forecast are drawn differently, always
 *
 * Solid up to now, dashed after it, with a hairline where the two meet. A single
 * unbroken line across that boundary would say the last third of the chart is known
 * in the same way as the first two thirds, which on a station-backed location is the
 * one thing this page must never say. Bars do the same with fill: solid for what
 * fell, hollow for what is expected.
 *
 * ## The running total
 *
 * Rainfall bars can carry a cumulative line, on the same axis as the bars rather
 * than on a second one down the right-hand edge. Two axes on a phone is two scales
 * to hold in your head at a glance, and the reason to want the total here is to see
 * it *against* the showers that produced it.
 *
 * The cost of one axis is real and is the reason the line can be switched off from
 * the legend: a month's total dwarfs any single hour, so with the line up the bars
 * flatten. Off, the axis goes back to fitting the bars alone — which is why the
 * toggle is not a nicety but the other half of the decision to share the axis.
 *
 * ## Reading a value off it
 *
 * Dragging puts a cursor on the nearest sample and a label beside it, exactly as
 * `SpreadChart` does — same gesture thresholds, same "the cursor lives as long as
 * the finger does" rule. The thresholds matter more here: this page sits inside the
 * location pager, so a horizontal drag that the chart does not claim will change
 * location instead. The chart claims sideways movement first, which is why reading a
 * value does not throw the reader into the next village.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Text } from '../Text';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { niceRange, scaleX, scaleY, smoothPath, type Point } from '../../core/model/smooth';
import type { Sample, SeriesShape } from '../../core/model/series';

// Just enough for a three-figure axis label and its air. It was 42, which put the
// plot a finger's width in from a card that is already inset from the screen — three
// nested margins for one chart, and the width belongs to the data.
const PAD_LEFT = 30;
const PAD_RIGHT = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 18;
const GRID_LINES = 3;
/** About this many labels along the bottom, whatever the sample count. */
const X_LABELS = 6;
/** How many empty forecast samples a line may be drawn straight through. Two, so a
 *  three-hourly series joins up and a genuinely absent afternoon does not. */
const FORECAST_GAP_BRIDGE = 2;

export interface SeriesChartProps {
  samples: Sample[];
  shape: SeriesShape;
  color: string;
  /** Axis label for one sample, e.g. "14:00" or "14/6". */
  axisLabel: (sample: Sample) => string;
  /** The cursor's own, fuller label — a date as well as a time. */
  readLabel: (sample: Sample) => string;
  /** Turns an internal value into the reader's units and words. */
  format: (value: number) => string;
  /** Marks the secondary line in the readout, e.g. "⤴" for gusts. Without it the
   *  secondary is neither drawn nor read out. */
  secondaryLabel?: string;
  /** Draw the running total carried on the samples, on the shared axis. */
  showCumulative?: boolean;
  /** Names the running total in the cursor's readout. */
  cumulativeLabel?: string;
  /** Its own colour, so it reads apart from the bars it runs over. */
  cumulativeColor?: string;
  /**
   * The three lines a banded series can draw, each on its own.
   *
   * The band's edges are worth picking out in colour where they mean something —
   * the day's coldest and warmest, the driest and dampest hour — and worth being
   * able to put away again, because three lines and a fill over thirty days is a
   * great deal of ink for a reader who came to look at one of them.
   */
  showValue?: boolean;
  showBandLo?: boolean;
  showBandHi?: boolean;
  bandLoColor?: string;
  bandHiColor?: string;
  /** Short unit riding the top gridline. */
  unit?: string;
  /** Hard floor and ceiling for the axis, where the quantity has them — humidity
   *  cannot leave 0–100, and rainfall cannot go below zero. */
  axisMin?: number;
  axisMax?: number;
  /** Pin the axis to those bounds rather than fitting the data inside them. */
  axisFixed?: boolean;
  /** How the axis labels read, where a number is not the answer. A bearing wants
   *  its compass point: 90 is not a quantity, it is east. */
  formatAxis?: (value: number) => string;
  /** How many gaps the gridlines divide the axis into. Four puts a pinned compass
   *  axis on N, O, Z, W and N again; three would land it on ZO and WNW. */
  gridLines?: number;
  height?: number;
  /** Text for an empty window, so the page's wording stays in one place. */
  emptyLabel: string;
  /**
   * What the chart is drawn on.
   *
   * Hollow marks — a forecast bar, a forecast dot, the cursor's ring — are filled
   * with the ground they stand on, so they read as outlines rather than as shapes.
   * Get it wrong and they are solid white marks on a cream page. It defaults to the
   * card colour because that is where this chart lived first; the graph page hands
   * in the page's own ground now that the chart sits directly on it.
   */
  background?: string;
}

export function SeriesChart({
  samples, shape, color, axisLabel, readLabel, format,
  secondaryLabel, unit = '', height = 190, emptyLabel,
  showCumulative, cumulativeLabel, cumulativeColor, axisMin, axisMax, axisFixed,
  formatAxis, gridLines = GRID_LINES,
  showValue = true, showBandLo, showBandHi, bandLoColor, bandHiColor, background,
}: SeriesChartProps) {
  const { palette } = useTheme();
  const ground = background ?? palette.appCard;
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  /** The label's own size, measured so it can be kept inside the chart. */
  const [label, setLabel] = useState({ w: 0, h: 0 });

  const n = samples.length;
  // The axis fits what is drawn, and nothing else: with the running total switched
  // off it goes back to fitting the bars alone. See the note at the top.
  const all = samples.flatMap((s) => [
    ...(s.value != null ? [s.value] : []),
    ...(s.band ? [s.band.lo, s.band.hi] : []),
    ...(secondaryLabel && s.secondary != null ? [s.secondary] : []),
    ...(showCumulative && s.cumulative != null ? [s.cumulative] : []),
  ]);

  if (!n || !all.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" color={palette.muted}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const range = niceRange(Math.min(...all), Math.max(...all));
  // Bars stand on zero; a bar chart with a floating baseline misreads every height
  // on it. A line keeps the padded range, so a flat day is not a flat line — but
  // never past a bound the quantity itself has: a padded range around a humid
  // afternoon would otherwise label the axis 104%.
  const fixed = axisFixed && axisMin != null && axisMax != null;
  const padded = shape === 'bar' ? 0 : Math.min(range.lo, Math.min(...all));
  const lo = fixed ? axisMin : axisMin != null ? Math.max(padded, axisMin) : padded;
  const hi = fixed
    ? axisMax
    : Math.max(axisMax != null ? Math.min(range.hi, axisMax) : range.hi, lo + 0.1);

  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const px = (i: number) => scaleX(i, n, PAD_LEFT, plotW);
  const py = (v: number) => scaleY(Math.min(Math.max(v, lo), hi), lo, hi, PAD_TOP, plotH);

  const gridValues = Array.from(
    { length: gridLines + 1 },
    (_, i) => lo + ((hi - lo) * i) / gridLines
  );
  const labelStep = Math.max(1, Math.ceil(n / X_LABELS));

  /** Where the measured half ends, in plot coordinates. */
  const firstFuture = samples.findIndex((s) => s.future);
  const boundaryX = firstFuture > 0 ? (px(firstFuture - 1) + px(firstFuture)) / 2 : null;

  const pointAt = (x: number) => {
    const f = plotW > 0 ? (x - PAD_LEFT) / plotW : 0;
    setCursor(Math.min(n - 1, Math.max(0, Math.round(f * (n - 1)))));
  };
  const clearCursor = () => setCursor(null);

  const scrub = Gesture.Pan()
    // Sideways is reading the chart; the pager's own swipe needs 18 points, so
    // claiming at 6 means a drag that starts on the chart stays on the chart.
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => { runOnJS(pointAt)(e.x); })
    .onUpdate((e) => { runOnJS(pointAt)(e.x); })
    .onFinalize(() => { runOnJS(clearCursor)(); });

  const at = cursor != null && cursor < n ? samples[cursor] ?? null : null;
  const cursorX = cursor != null ? px(cursor) : 0;
  // The marker rides whichever line the chart is actually about. With the running
  // total up that is the total — it is the mark the eye is following, and a dot
  // sitting on a bar top halfway down the plot reads as pointing at something else.
  const onCumulative = !!showCumulative && at?.cumulative != null;
  const cursorValue = onCumulative ? at?.cumulative : at?.value;
  const cursorY = cursorValue != null ? py(cursorValue) : null;
  const cursorInk = onCumulative ? cumulativeColor ?? color : color;

  const reading = at
    ? [
        readLabel(at),
        at.value != null ? format(at.value) : '—',
        at.band ? `${format(at.band.lo)}–${format(at.band.hi)}` : '',
        secondaryLabel && at.secondary != null ? `${secondaryLabel} ${format(at.secondary)}` : '',
        showCumulative && at.cumulative != null
          ? `${cumulativeLabel ?? 'Σ'} ${format(at.cumulative)}`
          : '',
      ].filter(Boolean).join(' · ')
    : '';

  const labelLeft = Math.min(Math.max(cursorX - label.w / 2, 0), Math.max(0, width - label.w));
  const labelTop =
    cursorY != null && cursorY - label.h - 8 >= 0 ? cursorY - label.h - 8 : (cursorY ?? PAD_TOP) + 10;

  return (
    <GestureDetector gesture={scrub}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {gridValues.map((v, i) => (
              <G key={`g${i}`}>
                <Line
                  x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={py(v)} y2={py(v)}
                  stroke={palette.hairlineSoft} strokeWidth={1}
                />
                <SvgText
                  x={PAD_LEFT - 6} y={py(v) + 3}
                  fontSize={9} fill={palette.muted} textAnchor="end"
                  fontFamily="Figtree_500Medium"
                >
                  {/* The unit rides only the top tick: on every gridline the labels
                      collide at this size. A label that is a word rather than a
                      number carries its own meaning and takes no unit at all. */}
                  {formatAxis
                    ? formatAxis(v)
                    : `${formatTick(v)}${i === gridValues.length - 1 ? unit : ''}`}
                </SvgText>
              </G>
            ))}

            {/* Where measurement stops and forecast begins. */}
            {boundaryX != null ? (
              <Line
                x1={boundaryX} x2={boundaryX} y1={PAD_TOP} y2={height - PAD_BOTTOM}
                stroke={palette.muted} strokeWidth={1} strokeDasharray="2 3" opacity={0.55}
              />
            ) : null}

            {shape === 'bar' ? (
              <Bars samples={samples} px={px} py={py} n={n} plotW={plotW} zeroY={py(lo)} color={color} />
            ) : shape === 'dots' ? (
              <Dots samples={samples} px={px} py={py} color={color} cardColor={ground} />
            ) : (
              <Lines
                samples={samples}
                px={px}
                py={py}
                color={color}
                drawSecondary={!!secondaryLabel}
                cardColor={ground}
                showValue={showValue}
                lo={showBandLo ? bandLoColor ?? color : null}
                hi={showBandHi ? bandHiColor ?? color : null}
              />
            )}

            {/* Over the bars, not under them: the total is read against the showers
                that made it, and a line behind them would be hidden by the tallest
                ones — which are exactly the ones it is explaining. */}
            {showCumulative
              ? splitRuns(samples, (s) => s.cumulative, px, py).map((r, i) => (
                  <Path
                    key={`c${i}`}
                    d={smoothPath(r.points)}
                    stroke={cumulativeColor ?? color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    // Dashed past the boundary, exactly as the value line is: what
                    // has fallen and what is expected to are different claims, and
                    // a total that ran on unbroken would blur them into one.
                    strokeDasharray={r.future ? '5 4' : undefined}
                    opacity={r.future ? 0.75 : 1}
                  />
                ))
              : null}

            {samples.map((s, i) =>
              i % labelStep === 0 ? (
                <SvgText
                  key={`l${i}`}
                  x={px(i)} y={height - 5}
                  fontSize={9} fill={palette.muted} textAnchor="middle"
                  fontFamily="Figtree_500Medium"
                >
                  {axisLabel(s)}
                </SvgText>
              ) : null
            )}

            {at ? (
              <G>
                <Line
                  x1={cursorX} x2={cursorX} y1={PAD_TOP} y2={height - PAD_BOTTOM}
                  stroke={palette.muted} strokeWidth={1} opacity={0.5}
                />
                {cursorY != null ? (
                  <Circle
                    cx={cursorX} cy={cursorY} r={4.5}
                    fill={at.future ? ground : cursorInk}
                    stroke={at.future ? cursorInk : ground}
                    strokeWidth={2}
                  />
                ) : null}
              </G>
            ) : null}
          </Svg>
        ) : null}

        {at ? (
          <View
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              // Only on a change, or every drag frame would set state twice.
              if (Math.abs(w - label.w) > 0.5 || Math.abs(h - label.h) > 0.5) setLabel({ w, h });
            }}
            pointerEvents="none"
            style={[
              {
                position: 'absolute', left: labelLeft, top: labelTop,
                // The tinted surface, not the card's own: a label in the card's
                // colour is a shadow with words in it.
                backgroundColor: palette.surfaceAlt,
                borderRadius: radius.tile,
                paddingVertical: 4,
                paddingHorizontal: space[2],
                maxWidth: Math.max(0, width),
              },
              shadowFloat,
            ]}
          >
            <Text variant="caption" weight="bold" color={palette.inkHeading} tabular numberOfLines={2}>
              {reading}
            </Text>
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/**
 * The line, its band, and its gusts — split at the boundary.
 *
 * Runs break on a gap *and* on the measured/forecast boundary, so neither is ever
 * bridged. The boundary sample is repeated into the forecast run, which is what
 * makes the two halves touch rather than leaving a notch between them.
 */
function Lines({
  samples, px, py, color, drawSecondary, cardColor, showValue, lo, hi,
}: {
  samples: Sample[];
  px: (i: number) => number;
  py: (v: number) => number;
  color: string;
  drawSecondary: boolean;
  cardColor: string;
  // Required, not optional with a default. Three separate edits in this file have
  // silently dropped a new optional prop at the call site — the code typechecks, the
  // legend still draws, and the lines simply never appear. Required props make that
  // a compile error instead of something you find by looking at the chart.
  /** False hides the central line, leaving the band and whichever edges are up. */
  showValue: boolean;
  /** Colour for the band's lower and upper edge, or null to leave it undrawn. */
  lo: string | null;
  hi: string | null;
}) {
  const bandPath = (() => {
    const top: Point[] = [];
    const bottom: Point[] = [];
    samples.forEach((s, i) => {
      if (!s.band) return;
      top.push({ x: px(i), y: py(s.band.hi) });
      bottom.push({ x: px(i), y: py(s.band.lo) });
    });
    if (top.length < 2) return null;
    const lower = smoothPath([...bottom].reverse()).replace(/^M/, 'L');
    return `${smoothPath(top)} ${lower} Z`;
  })();

  const main = showValue ? splitRuns(samples, (s) => s.value, px, py) : [];
  const secondary = drawSecondary ? splitRuns(samples, (s) => s.secondary, px, py) : [];
  // The band's own edges, drawn through the same run splitting as everything else so
  // they break where the data does and dash on the same side of the boundary.
  const edges = [
    { colour: lo, runs: lo ? splitRuns(samples, (s) => s.band?.lo, px, py) : [] },
    { colour: hi, runs: hi ? splitRuns(samples, (s) => s.band?.hi, px, py) : [] },
  ];

  return (
    <G>
      {bandPath ? <Path d={bandPath} fill={color} opacity={0.16} /> : null}

      {/* Under the central line: it is the one the chart is about, and an edge drawn
          over it would cross it wherever the two meet. */}
      {edges.map(({ colour, runs }, e) =>
        runs.map((r, i) => (
          <Path
            key={`e${e}-${i}`}
            d={smoothPath(r.points)}
            stroke={colour as string}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={r.future ? '5 4' : undefined}
            opacity={r.future ? 0.6 : 0.9}
          />
        ))
      )}

      {secondary.map((r, i) => (
        <Path
          key={`s${i}`}
          d={smoothPath(r.points)}
          stroke={color} strokeWidth={1.5} strokeDasharray="3 3"
          opacity={r.future ? 0.35 : 0.6} fill="none"
        />
      ))}

      {main.map((r, i) => (
        <Path
          key={`v${i}`}
          d={smoothPath(r.points)}
          stroke={color} strokeWidth={2} fill="none" strokeLinecap="round"
          // Forecast is dashed and a shade lighter, so the two are told apart at a
          // glance and not only by looking for the boundary rule.
          strokeDasharray={r.future ? '5 4' : undefined}
          opacity={r.future ? 0.7 : 1}
        />
      ))}

      {/* A single sample cannot draw a line, so mark it as a point. */}
      {main.map((r, i) =>
        r.points.length === 1 ? (
          <Circle
            key={`p${i}`} cx={r.points[0]!.x} cy={r.points[0]!.y} r={3}
            fill={r.future ? cardColor : color} stroke={color} strokeWidth={1.5}
          />
        ) : null
      )}
    </G>
  );
}

/**
 * A reading with nothing in between two of them: one mark per sample.
 *
 * A wind direction is the case this exists for. A stroke from 315° to 45° draws the
 * wind swinging through south, which is the one thing it did not do — so there is no
 * stroke, and each reading stands on its own. Forecast points are hollow, as a
 * forecast is everywhere else on this chart.
 */
function Dots({
  samples, px, py, color, cardColor,
}: {
  samples: Sample[];
  px: (i: number) => number;
  py: (v: number) => number;
  color: string;
  cardColor: string;
}) {
  return (
    <G>
      {samples.map((s, i) =>
        s.value == null ? null : (
          <Circle
            key={`d${i}`}
            cx={px(i)} cy={py(s.value)} r={2.6}
            fill={s.future ? cardColor : color}
            stroke={color}
            strokeWidth={s.future ? 1.2 : 0}
            opacity={s.future ? 0.85 : 1}
          />
        )
      )}
    </G>
  );
}

/** Rainfall, as bars standing on zero: solid for what fell, hollow for what is
 *  expected. */
function Bars({
  samples, px, py, n, plotW, zeroY, color,
}: {
  samples: Sample[];
  px: (i: number) => number;
  py: (v: number) => number;
  n: number;
  plotW: number;
  zeroY: number;
  color: string;
}) {
  // Bar and gap fill one slot, so any sample count fits the width. A month of hours
  // leaves sub-pixel bars, which is why a window that long is bucketed into days
  // before it ever reaches here — see `core/model/series`.
  const slot = plotW / Math.max(1, n);
  const barW = Math.max(0.6, slot * 0.7);

  return (
    <G>
      {samples.map((s, i) => {
        if (s.value == null) return null;
        const y = py(s.value);
        const h = Math.max(s.value > 0 ? 1 : 0, zeroY - y);
        if (h <= 0) return null;
        return (
          <Rect
            key={`b${i}`}
            x={px(i) - barW / 2} y={y} width={barW} height={h}
            rx={Math.min(2, barW / 2)}
            fill={s.future ? 'none' : color}
            stroke={s.future ? color : 'none'}
            strokeWidth={s.future ? 1 : 0}
            opacity={s.future ? 0.75 : 1}
          />
        );
      })}
    </G>
  );
}

/**
 * Split a series into runs that can each be drawn as one path.
 *
 * A run breaks on a gap and at the measured/forecast boundary, so neither is ever
 * bridged by a stroke that would claim more than the data does. The boundary sample
 * is repeated into the forecast run, which is what makes the two halves touch rather
 * than leaving a notch between them.
 *
 * A gap in the *forecast* of up to `FORECAST_GAP_BRIDGE` samples is drawn straight
 * through: past its ninetieth hour the model goes three-hourly, and that is one
 * series sampled coarsely rather than three separate opinions with silence between
 * them. A gap in measurement is a station that stopped reporting, and stays a gap —
 * the whole point of a measured line is that it only claims what it saw.
 *
 * Shared by the value line, the gusts above it and the rainfall running total, so
 * all three break at the same places and dash on the same side of the boundary.
 */
function splitRuns(
  samples: readonly Sample[],
  read: (s: Sample) => number | null | undefined,
  px: (i: number) => number,
  py: (v: number) => number
): { points: Point[]; future: boolean }[] {
  const out: { points: Point[]; future: boolean }[] = [];
  let run: Point[] = [];
  let future = false;
  /** Consecutive empty samples seen since the last point in the open run. */
  let missing = 0;

  samples.forEach((s, i) => {
    const v = read(s);
    if (v == null) {
      missing += 1;
      if (run.length && (!s.future || missing > FORECAST_GAP_BRIDGE)) {
        out.push({ points: run, future });
        run = [];
      }
      return;
    }
    missing = 0;
    const point = { x: px(i), y: py(v) };
    if (run.length && s.future !== future) {
      // Close the solid run on this point too, so the dashes start where the solid
      // line ends rather than one sample later.
      out.push({ points: [...run, point], future });
      run = [point];
      future = s.future;
      return;
    }
    if (!run.length) future = s.future;
    run.push(point);
  });

  if (run.length) out.push({ points: run, future });
  return out;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 10 || Number.isInteger(v)) return String(Math.round(v));
  return v.toFixed(1).replace('.', ',');
}
