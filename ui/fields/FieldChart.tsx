/**
 * The selected location over the loop, drawn above the slider and on the same axis:
 * the field's value per frame (dashed) and, where the location has a weather station,
 * what that station measured (solid). No legend, on purpose — there is no room, and the
 * dash is the whole distinction.
 *
 * x is the slider's own: frames evenly spaced, so the dense last two hours stay as wide
 * as the half-hourly stretch before them. Station readings are placed between frames by
 * time (`frameIndexAt`), which compresses the older part but keeps the cursor on the
 * thumb.
 */
import { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import {
  fieldValueIn, frameIndexAt, sampleField, stationValueFor,
  type FieldFrame, type FieldManifest, type FieldVariable,
} from '../../core/fields';
import type { SavedLocation } from '../../core/prefs';
import { usePrefs } from '../../state/prefs';
import { useLocationStation, useStationRange } from '../../state/stations';

/** Half the scrubber's thumb: the track's first and last step sit this far in. */
const INSET = 11;
const HEIGHT = 72;
const PAD_Y = 6;

/** `YYYY-MM-DD` in UTC. */
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface FieldChartProps {
  variable: FieldVariable;
  manifest: FieldManifest;
  frames: readonly FieldFrame[];
  frameValues: readonly (Uint16Array | null)[];
  index: number;
  location: SavedLocation;
}

export function FieldChart({
  variable, manifest, frames, frameValues, index, location,
}: FieldChartProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const times = useMemo(() => frames.map((f) => Date.parse(f.time)), [frames]);
  const unit = manifest.unit;
  const show = (v: number | null) => fieldValueIn(unit, v, prefs);

  const mapSeries = useMemo(
    () =>
      frameValues.map((values) =>
        values ? show(sampleField(manifest, values, location.lat, location.lon)) : null
      ),
    // `show` closes over prefs and unit only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameValues, manifest, location.lat, location.lon, prefs.tempUnit, prefs.windUnit]
  );

  const station = useLocationStation(location);
  // Offset 0: the rows come back keyed on the UTC clock, which is what the frames use.
  const range = useMemo(
    () => ({
      from: utcDay((times[0] ?? Date.now()) - 3600_000),
      to: utcDay(times[times.length - 1] ?? Date.now()),
    }),
    [times]
  );
  const { data: rows } = useStationRange(station?.id ?? null, 0, range, !!station, true);

  const stationSeries = useMemo(() => {
    if (!rows?.length) return [];
    const out: { x: number; v: number }[] = [];
    for (const row of rows) {
      const x = frameIndexAt(times, Date.parse(`${row.time}:00Z`));
      const v = show(stationValueFor(variable, row));
      if (x != null && v != null) out.push({ x, v });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, times, variable, prefs.tempUnit, prefs.windUnit]);

  const all = [
    ...mapSeries.filter((v): v is number => v != null),
    ...stationSeries.map((p) => p.v),
  ];
  if (!all.length || frames.length < 2) return null;

  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.5;
    hi = mid + 0.5;
  }
  const last = frames.length - 1;
  const usable = Math.max(0, width - 2 * INSET);
  const px = (i: number) => INSET + (i / last) * usable;
  const py = (v: number) => PAD_Y + (1 - (v - lo) / (hi - lo)) * (HEIGHT - 2 * PAD_Y);

  const pathOf = (points: { x: number; v: number | null }[]) => {
    let d = '';
    let pen = false;
    for (const p of points) {
      if (p.v == null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const mapPath = pathOf(mapSeries.map((v, i) => ({ x: i, v })));
  const stationPath = pathOf(stationSeries);
  const cursorX = px(index);
  const mapNow = mapSeries[index];
  const stationNow = stationSeries.reduce<{ x: number; v: number } | null>(
    (best, p) => (!best || Math.abs(p.x - index) < Math.abs(best.x - index) ? p : best),
    null
  );
  const fmt = (v: number) => (variable === 'wind' && prefs.windUnit === 'ms' ? v.toFixed(1) : String(Math.round(v)));

  return (
    <View onLayout={onLayout} style={{ height: HEIGHT, marginBottom: 6 }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Line
            x1={cursorX} x2={cursorX} y1={0} y2={HEIGHT}
            stroke={palette.muted} strokeWidth={1} strokeOpacity={0.5}
          />
          {stationPath ? (
            <Path d={stationPath} stroke={palette.accent} strokeWidth={2} fill="none" />
          ) : null}
          {mapPath ? (
            <Path
              d={mapPath} stroke={palette.accent} strokeWidth={2} fill="none"
              strokeDasharray="4 3"
            />
          ) : null}
          {stationNow && Math.abs(stationNow.x - index) <= 0.5 ? (
            <Circle cx={px(stationNow.x)} cy={py(stationNow.v)} r={3} fill={palette.accent} />
          ) : null}
          {mapNow != null ? (
            <Circle
              cx={cursorX} cy={py(mapNow)} r={3}
              fill={palette.surfaceCard} stroke={palette.accent} strokeWidth={1.5}
            />
          ) : null}
        </Svg>
      )}
      <Text
        variant="caption" color={palette.muted} tabular
        style={{ position: 'absolute', left: 0, top: -2 }}
      >
        {fmt(hi)}
      </Text>
      <Text
        variant="caption" color={palette.muted} tabular
        style={{ position: 'absolute', left: 0, bottom: -2 }}
      >
        {fmt(lo)}
      </Text>
    </View>
  );
}
