/**
 * The day's ensemble spread, at the top of a measurand section.
 *
 * The web app draws this in every per-measurand popup and it is the clearest thing
 * it does: the outer band is where 80% of the members fall (p10–p90), the inner one
 * where half of them do (p25–p75), the hairline is their median, and the dot is the
 * value the app is actually reporting. A dot near the median means the models agree;
 * a dot at the edge of the outer band means the deterministic run is an outlier, and
 * a dot missing from the band entirely means it was overruled — which is when the
 * number beside it carries a `~`.
 *
 * Beneath, the same three ranges in figures, because a band is a shape and a farmer
 * planning a spray window wants a number.
 */
import { View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { place, type Scale } from '../../core/model/beam';

const TRACK_HEIGHT = 14;

export interface DayBarProps {
  label: string;
  scale: Scale;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  /** The reported value, and whether it is the deterministic run or a stand-in. */
  value: number | null;
  direct?: boolean;
  color: string;
  /** Formats a value for the figures under the bar. */
  format: (v: number | null) => string;
  /** True once the ensemble has loaded; before that there is nothing to draw. */
  hasEns: boolean;
}

export function DayBar({
  label, scale, p10, p25, p50, p75, p90, value, direct = true, color, format, hasEns,
}: DayBarProps) {
  const { palette } = useTheme();

  const at = (v: number | null) => (hasEns ? place(v, scale) : null);
  const outer = { from: at(p10), to: at(p90) };
  const inner = { from: at(p25), to: at(p75) };
  const mid = at(p50);
  const dot = place(value, scale);

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text variant="eyebrow" color={palette.muted}>
          {label}
        </Text>
        <Text variant="label" weight="bold" color={color} tabular style={{ marginLeft: 'auto' }}>
          {format(value)}
        </Text>
        {!direct ? (
          <Text variant="caption" color={palette.muted} style={{ fontSize: 10, opacity: 0.6 }}>
            ~ ENS P50
          </Text>
        ) : null}
      </View>

      <View
        style={{
          height: TRACK_HEIGHT,
          borderRadius: radius.band,
          backgroundColor: palette.hairline,
        }}
      >
        <Span from={outer.from} to={outer.to} color={color} opacity={0.22} />
        <Span from={inner.from} to={inner.to} color={color} opacity={0.45} />
        {mid != null ? (
          <View
            style={{
              position: 'absolute', left: `${mid * 100}%`, marginLeft: -0.5,
              width: 1, height: '100%', backgroundColor: palette.muted,
            }}
          />
        ) : null}
        {dot != null ? (
          <View
            style={{
              position: 'absolute', left: `${dot * 100}%`, marginLeft: -5,
              top: (TRACK_HEIGHT - 10) / 2,
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: color,
              borderWidth: 2, borderColor: palette.appCard,
            }}
          />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 10 }}>
          {format(scale.lo)}
        </Text>
        <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 10 }}>
          {hasEns
            ? `P10–P90 ${format(p10)}–${format(p90)}`
            : 'Modelleden laden…'}
        </Text>
        <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 10 }}>
          {format(scale.hi)}
        </Text>
      </View>

      {hasEns ? (
        <View style={{ flexDirection: 'row', gap: space[4], flexWrap: 'wrap', marginTop: 2 }}>
          <Figure label="P50" value={format(p50)} color={color} />
          <Figure label="P25–P75" value={`${format(p25)}–${format(p75)}`} color={palette.ink} />
          <Figure label="P10–P90" value={`${format(p10)}–${format(p90)}`} color={palette.ink} />
        </View>
      ) : null}
    </View>
  );
}

function Span({
  from, to, color, opacity,
}: { from: number | null; to: number | null; color: string; opacity: number }) {
  if (from == null || to == null) return null;
  return (
    <View
      style={{
        position: 'absolute',
        left: `${from * 100}%`,
        width: `${Math.max(0.6, (to - from) * 100)}%`,
        height: '100%',
        borderRadius: radius.band,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'baseline' }}>
      <Text variant="caption" color={palette.muted} style={{ fontSize: 11 }}>
        {label}
      </Text>
      <Text variant="caption" weight="bold" color={color} tabular style={{ fontSize: 11 }}>
        {value}
      </Text>
    </View>
  );
}
