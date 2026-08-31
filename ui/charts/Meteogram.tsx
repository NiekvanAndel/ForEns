/**
 * The meteogram: temperature over precipitation, with a wind row beneath.
 *
 * index.html drew this with Chart.js. Chart.js has no React Native renderer, so it
 * is redrawn here in react-native-svg — which also removes the app's only remaining
 * runtime dependency on a charting library.
 *
 * Two axes share one plot: temperature reads against the left scale as a smoothed
 * line, precipitation against a hidden right scale as bars from the baseline. The
 * ensemble band, where the hourly members have loaded, sits behind the bars.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Line, Rect, Text as SvgText, G } from 'react-native-svg';
import { Text } from '../Text';
import { space, useTheme } from '../../theme';
import { WindArrow } from '../WindArrow';
import { niceRange, scaleX, scaleY, smoothPath, type Point } from '../../core/model/smooth';
import type { DetailHour } from '../../core/model/dayDetail';

export interface MeteogramProps {
  hours: DetailHour[];
  height?: number;
  /** Draw the wind arrow row beneath the plot. */
  showWind?: boolean;
}

const PAD_LEFT = 30;
const PAD_RIGHT = 26;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;

export function Meteogram({ hours, height = 160, showWind = true }: MeteogramProps) {
  const { palette } = useTheme();
  const [width, setWidth] = useState(0);

  const temps = hours.map((h) => h.temp);
  const hasTemp = temps.some((t) => t != null);
  const maxMm = Math.max(...hours.map((h) => h.precip ?? 0), 1);

  if (!hours.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" color={palette.muted}>
          Geen uurdata beschikbaar
        </Text>
      </View>
    );
  }

  const finiteTemps = temps.filter((t): t is number => t != null);
  const tRange = hasTemp
    ? niceRange(Math.min(...finiteTemps), Math.max(...finiteTemps))
    : { lo: 0, hi: 1 };

  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const n = hours.length;

  const px = (i: number) => scaleX(i, n, PAD_LEFT, plotW);
  const tempY = (v: number) => scaleY(v, tRange.lo, tRange.hi, PAD_TOP, plotH);
  // Precipitation grows from the baseline and is allowed at most 60% of the plot,
  // so a downpour cannot bury the temperature line.
  const mmHeight = (mm: number) => (mm / maxMm) * plotH * 0.6;

  const barWidth = Math.max(2, Math.min(14, (plotW / Math.max(1, n)) * 0.62));

  const tempRuns: Point[][] = [];
  let run: Point[] = [];
  temps.forEach((t, i) => {
    if (t == null) {
      if (run.length) tempRuns.push(run);
      run = [];
    } else {
      run.push({ x: px(i), y: tempY(t) });
    }
  });
  if (run.length) tempRuns.push(run);

  const baseline = PAD_TOP + plotH;
  const gridValues = [tRange.lo, (tRange.lo + tRange.hi) / 2, tRange.hi];
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {hasTemp
              ? gridValues.map((v, i) => (
                  <G key={`g${i}`}>
                    <Line
                      x1={PAD_LEFT} x2={width - PAD_RIGHT}
                      y1={tempY(v)} y2={tempY(v)}
                      stroke={palette.hairlineSoft} strokeWidth={1}
                    />
                    <SvgText
                      x={PAD_LEFT - 5} y={tempY(v) + 3}
                      fontSize={9} fill={palette.muted} textAnchor="end"
                      fontFamily="Figtree_500Medium"
                    >
                      {Math.round(v)}°
                    </SvgText>
                  </G>
                ))
              : null}

            {/* Ensemble band for precipitation, where the hourly members have loaded. */}
            {hours.map((h, i) =>
              h.ens && h.ens.precipP90 > 0 ? (
                <Rect
                  key={`e${i}`}
                  x={px(i) - barWidth / 2 - 1}
                  y={baseline - mmHeight(h.ens.precipP90)}
                  width={barWidth + 2}
                  height={mmHeight(h.ens.precipP90) - mmHeight(h.ens.precipP10)}
                  fill={palette.sky}
                  opacity={0.2}
                  rx={2}
                />
              ) : null
            )}

            {hours.map((h, i) =>
              (h.precip ?? 0) > 0 ? (
                <Rect
                  key={`b${i}`}
                  x={px(i) - barWidth / 2}
                  y={baseline - mmHeight(h.precip)}
                  width={barWidth}
                  height={mmHeight(h.precip)}
                  fill={h.isPast ? palette.accentDark : palette.accent}
                  opacity={h.isPast ? 0.45 : 0.85}
                  rx={2}
                />
              ) : null
            )}

            <Line
              x1={PAD_LEFT} x2={width - PAD_RIGHT}
              y1={baseline} y2={baseline}
              stroke={palette.hairline} strokeWidth={1}
            />

            {tempRuns.map((r, i) => (
              <Path
                key={`t${i}`}
                d={smoothPath(r)}
                stroke={palette.valTemp}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
              />
            ))}

            {/* Millimetres on the right, so the bars are readable as quantities. */}
            {maxMm > 0.2 ? (
              <SvgText
                x={width - PAD_RIGHT + 4} y={baseline - mmHeight(maxMm) + 3}
                fontSize={9} fill={palette.valPrecip} textAnchor="start"
                fontFamily="Figtree_500Medium"
              >
                {maxMm.toFixed(1).replace('.', ',')}
              </SvgText>
            ) : null}

            {hours.map((h, i) =>
              i % labelStep === 0 ? (
                <SvgText
                  key={`l${i}`}
                  x={px(i)} y={height - 5}
                  fontSize={9} fill={palette.muted} textAnchor="middle"
                  fontFamily="Figtree_500Medium"
                >
                  {h.time.slice(11, 13)}
                </SvgText>
              ) : null
            )}
          </Svg>
        ) : null}
      </View>

      {showWind && hours.some((h) => h.windDir != null) ? (
        <View
          style={{
            flexDirection: 'row',
            paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT,
            marginTop: space[1],
          }}
        >
          {hours.map((h, i) => (
            <View key={h.time} style={{ flex: 1, alignItems: 'center' }}>
              {i % labelStep === 0 && h.windDir != null ? (
                <WindArrow deg={h.windDir} size={11} color={palette.muted} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
