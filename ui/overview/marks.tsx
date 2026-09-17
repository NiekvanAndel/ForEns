/**
 * The small marks the overview's widgets are drawn with: a sparkline, a ring, an
 * arrow.
 *
 * A summary page lives or dies on how much it can say per line. A figure says one
 * thing; a figure with the shape of the day behind it says three — how much, when,
 * and whether it is over. So almost every reading on this page carries a mark, and
 * they are all here so that twelve widgets cannot end up with twelve idioms.
 *
 * Deliberately tiny and deliberately unlabelled. These are not charts to read values
 * off — the figure beside them is for that — they are for the shape. Anything that
 * needed an axis belongs on 'Grafiek', which is one tap away from every line here.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import type { Trend } from '../../core/overviewData';

/** How wide one bar may get, however much room the mark is given. See `grow`. */
const MAX_BAR_WIDTH = 4;

/**
 * A row of bars, one per sample, scaled to the tallest.
 *
 * Rainfall's mark. Scaled to its own maximum rather than to a shared one, because
 * the question it answers is "when did it fall", and a location with 0,4 mm should
 * show the shape of that afternoon rather than a flat line under the field that had
 * twelve. The figure beside it is what makes them comparable.
 */
export function BarSpark({
  values, color, width = 64, height = 18, floor = 0.2, grow,
}: {
  values: readonly (number | null)[];
  color: string;
  width?: number;
  height?: number;
  /** The tallest bar stands for at least this, so a trace does not fill the mark. */
  floor?: number;
  /**
   * Take whatever width the row has left instead of a fixed one.
   *
   * A fixed width is right where the mark shares a line with a name and a figure —
   * it must not push either out. Where the mark has the line to itself, as in the
   * rainfall widgets, a fixed width leaves half a card empty turned sideways, and
   * twenty-four hours squeezed into seventy points loses exactly the shape the mark
   * is there for.
   *
   * It costs a frame: SVG needs a number, and the number is not known until the row
   * has been laid out. The mark draws nothing on that first frame rather than
   * flashing at its fallback width and jumping.
   */
  grow?: boolean;
}) {
  const { palette } = useTheme();
  const [measured, setMeasured] = useState(0);
  const nums = values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0));

  const box = grow ? measured : width;
  if (!nums.length || box <= 0) {
    return (
      <View
        onLayout={grow ? (e) => setMeasured(e.nativeEvent.layout.width) : undefined}
        style={grow ? { flex: 1, height } : { width, height }}
      />
    );
  }

  const max = Math.max(floor, ...nums);
  const slot = box / nums.length;
  // Wide, the bars stay slim and the air between them grows, rather than the bars
  // fattening into a bar chart: twenty-four sixteen-point blocks is a different kind
  // of drawing from the one this mark is, and it is not the kind that reads at a
  // glance. Each bar is centred in its slot so the spacing stays even.
  const barW = Math.max(1, Math.min(slot - 1, MAX_BAR_WIDTH));
  const inset = (slot - barW) / 2;

  const svg = (
    <Svg width={box} height={height}>
      {nums.map((v, i) => {
        const h = v > 0 ? Math.max(1.5, (v / max) * height) : 0;
        return h > 0 ? (
          <Rect
            key={i}
            x={i * slot + inset}
            y={height - h}
            width={barW}
            height={h}
            rx={Math.min(1, barW / 2)}
            fill={color}
          />
        ) : (
          // A dry hour is a dot on the baseline, not a gap: a run of nothing should
          // still read as hours that were measured.
          <Rect
            key={i}
            x={i * slot + inset}
            y={height - 1}
            width={barW}
            height={1}
            fill={palette.hairline}
          />
        );
      })}
    </Svg>
  );

  if (!grow) return svg;
  return (
    <View
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      style={{ flex: 1, height }}
    >
      {svg}
    </View>
  );
}

/**
 * A line through the samples, for a reading that moves rather than accumulates.
 *
 * No smoothing: at this size a curve through a dozen points is a curve the data did
 * not make. Gaps break the line, as they do everywhere else in this app.
 */
export function LineSpark({
  values, color, width = 64, height = 18,
}: {
  values: readonly (number | null)[];
  color: string;
  width?: number;
  height?: number;
}) {
  const nums = values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null));
  const present = nums.filter((v): v is number => v != null);
  if (present.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...present);
  const max = Math.max(...present);
  // A flat series would divide by zero and, drawn against its own range, would look
  // like violent movement. Give it a span and it sits in the middle, which is true.
  const span = max - min || 1;
  const pad = 2;

  let d = '';
  let open = false;
  nums.forEach((v, i) => {
    if (v == null) {
      open = false;
      return;
    }
    const x = (i / (nums.length - 1)) * width;
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    d += `${open ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
    open = true;
  });

  return (
    <Svg width={width} height={height}>
      <Path d={d.trim()} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * A ring filled to a fraction, with something in the middle.
 *
 * Borrowed from the activity rings everybody already knows how to read: a closed ring
 * is a good day. Used for the share of the coming hours a field can be worked, which
 * is the one figure on this page that is genuinely a proportion — a number between
 * nought and one, where the answer is how much of the ring is filled and not what the
 * number is.
 */
export function Ring({
  fraction, color, size = 44, thickness = 5, children,
}: {
  fraction: number;
  color: string;
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const { palette } = useTheme();
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, fraction));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={palette.hairlineSoft} strokeWidth={thickness} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round"
          strokeDasharray={`${circumference * filled} ${circumference}`}
          // Twelve o'clock, going clockwise: a ring that started at three reads as
          // being at a quarter past before it has any value in it.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Which way a reading is going. The arrows are the Trends screen's: up, down, or a
 *  bar for no change — a flat arrow would be an arrow pointing nowhere. */
export function TrendMark({ trend, color }: { trend: Trend; color?: string }) {
  const { palette } = useTheme();
  const ink = color ?? palette.muted;
  if (trend === 'flat') return <Icon name="minus" size={13} color={palette.inkDisabled} weight="bold" />;
  return <Icon name={trend === 'up' ? 'trend-up' : 'trend-down'} size={13} color={ink} weight="bold" />;
}

/**
 * How much the ensemble members are of one mind, as a small band.
 *
 * Two marks in one: a track showing where p10 to p90 sits against the widest band on
 * screen, and a tick at the median. Nothing is labelled, because the word beside it
 * ("eens", "oneens") is the label — the band is there to show *how* unevenly, which a
 * word cannot.
 */
export function SpreadBand({
  lo, hi, mid, max, color, width = 56, height = 10,
}: {
  lo: number;
  hi: number;
  mid: number;
  /** The widest band among the rows, so the tracks are comparable down the column. */
  max: number;
  color: string;
  width?: number;
  height?: number;
}) {
  const { palette } = useTheme();
  const scale = Math.max(1, max);
  const x = (v: number) => Math.max(0, Math.min(1, v / scale)) * width;
  const left = x(lo);
  const right = Math.max(left + 2, x(hi));

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={height / 2 - 1} width={width} height={2} rx={1} fill={palette.hairlineSoft} />
      <Rect x={left} y={height / 2 - 3} width={right - left} height={6} rx={3} fill={color} opacity={0.35} />
      <Rect x={Math.min(width - 2, x(mid))} y={0} width={2} height={height} rx={1} fill={color} />
    </Svg>
  );
}

/** A count of others, as the line that closes a filtered widget. */
export function RestLine({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <Text variant="label" weight="regular" color={palette.muted} style={{ paddingTop: 6 }}>
      {children}
    </Text>
  );
}
