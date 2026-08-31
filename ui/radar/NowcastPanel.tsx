/**
 * The nowcast panel under the full-screen radar.
 *
 * Answers the two questions a radar loop cannot: how hard, and when. The heading
 * pair names the moment the curve is pointing at and the intensity there; the curve
 * itself is the 0–2 hour profile at the chosen location, in millimetres per hour.
 *
 * Drawn with the same `smoothPath` the meteograms use, so a shower building over
 * twenty minutes reads as a slope rather than as a staircase.
 *
 * The headings are deliberately small. They were `screenTitle`, which on the
 * full-screen view took a band of height away from the map for two numbers that are
 * read in a glance — the map is the thing worth the space, and these are its caption.
 */
import { View } from 'react-native';
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

export interface NowcastPanelProps {
  profile: NowcastProfile | null;
  /** Minutes from now the loop is currently showing, so the panel tracks the scrub. */
  offsetMin: number;
  width: number;
  /** Shorter, for the card on the radar page where the map is already the subject. */
  compact?: boolean;
}

export function NowcastPanel({ profile, offsetMin, width, compact }: NowcastPanelProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const bars = profile?.bars ?? [];

  if (!bars.length) {
    return (
      <View style={{ padding: space[6] }}>
        <Text variant="bodySm" color={palette.muted} align="center">
          {ta('noData', prefs.lang)}
        </Text>
      </View>
    );
  }

  const chartHeight = compact ? 96 : 118;
  const maxMm = Math.max(1, ...bars.map((b) => b.mmPerHour));
  // A "nice" top so the axis reads 2, 4, 6 rather than 5.3.
  const top = Math.ceil(maxMm / 2) * 2 || 2;
  const spanMin = Math.max(1, bars[bars.length - 1]!.offsetMin - bars[0]!.offsetMin);
  const plotW = Math.max(1, width - PAD_LEFT - space[5]);
  const plotH = chartHeight - PAD_TOP - PAD_BOTTOM;

  const x = (min: number) => PAD_LEFT + ((min - bars[0]!.offsetMin) / spanMin) * plotW;
  const y = (mm: number) => PAD_TOP + plotH - (Math.min(mm, top) / top) * plotH;

  const points = bars.map((b) => ({ x: x(b.offsetMin), y: y(b.mmPerHour) }));
  const line = smoothPath(points);
  const area = `${line} L${points[points.length - 1]!.x},${PAD_TOP + plotH} L${points[0]!.x},${PAD_TOP + plotH} Z`;

  // What the scrubber is pointing at, interpolated between the two nearest samples.
  const atNow = intensityAt(bars, offsetMin);
  const cursorX = x(Math.min(Math.max(offsetMin, bars[0]!.offsetMin), bars[bars.length - 1]!.offsetMin));

  return (
    <View
      style={{
        paddingHorizontal: space[5],
        paddingTop: compact ? space[4] : space[3],
        paddingBottom: space[2],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View>
          <Text variant="eyebrow" color={palette.muted}>
            {ta('tabForecast', prefs.lang)}
          </Text>
          <Text variant="stat" color={palette.inkHeading} tabular style={{ fontSize: 22 }}>
            {clockAt(offsetMin)}
          </Text>
        </View>
        <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
          <Text variant="eyebrow" color={palette.muted}>
            {ta('tabPrecipShort', prefs.lang)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text
              variant="stat"
              color={atNow > 0 ? palette.valPrecip : palette.inkHeading}
              tabular
              style={{ fontSize: 22 }}
            >
              {fmtMm(atNow)}
            </Text>
            <Text variant="caption" color={palette.muted}>
              mm/u
            </Text>
          </View>
        </View>
      </View>

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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: PAD_LEFT }}>
        {bars
          .filter((_, i) => i % Math.ceil(bars.length / 4) === 0)
          .map((b) => (
            <Text key={b.offsetMin} variant="caption" color={palette.muted} tabular>
              {clockAt(b.offsetMin)}
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
