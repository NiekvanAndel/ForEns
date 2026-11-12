/**
 * The selected location over the loop, drawn above the slider and on the same axis:
 * the field's value per frame (dashed) and, where the location has a weather station,
 * what that station measured (solid). No legend, on purpose — there is no room, and the
 * dash is the whole distinction.
 *
 * Under the slider, across the panel's full width, folded away like the rainfall
 * curve. Frames evenly spaced as on the slider, so the cursor moves as the thumb does;
 * station readings are placed between frames by time (`frameIndexAt`).
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import {
  fieldValueIn, frameIndexAt, stationValueFor,
  type FieldFrame, type FieldManifest, type FieldVariable,
} from '../../core/fields';
import type { SavedLocation } from '../../core/prefs';
import { usePrefs } from '../../state/prefs';
import { useStationRange } from '../../state/stations';

/** Room on the left for the min/max labels, and a little on the right for the dot. */
export const CHART_LEFT = 30;
const LEFT = CHART_LEFT;
const RIGHT = 4;
const HEIGHT = 72;
const PAD_Y = 6;
/** The chart follows the loading rasters at most this often, not once per frame. */
const SETTLE_MS = 400;

/** `value`, once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** `YYYY-MM-DD` in UTC. */
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface FieldChartProps {
  variable: FieldVariable;
  manifest: FieldManifest;
  frames: readonly FieldFrame[];
  /** Per frame, in the manifest's unit. Numbers only — see `fieldSeries` in FullMap. */
  mapValues: readonly (number | null)[];
  index: number;
  location: SavedLocation;
}

export function FieldChart({
  variable, manifest, frames, mapValues, index, location,
}: FieldChartProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width)),
    []
  );

  const times = useMemo(() => frames.map((f) => Date.parse(f.time)), [frames]);
  const unit = manifest.unit;
  const show = (v: number | null) => fieldValueIn(unit, v, prefs);

  const settledValues = useSettled(mapValues, SETTLE_MS);
  const mapSeries = useMemo(
    () => settledValues.map(show),
    // `show` closes over prefs and unit only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settledValues, unit, prefs.tempUnit, prefs.windUnit]
  );

  // The location's own station binding only: resolving "nearest station" would pull
  // the account's station list into this screen as well.
  const stationId = location.stationId ?? null;
  // Offset 0: the rows come back keyed on the UTC clock, which is what the frames use.
  const range = useMemo(
    () => ({
      from: utcDay((times[0] ?? Date.now()) - 3600_000),
      to: utcDay(times[times.length - 1] ?? Date.now()),
    }),
    [times]
  );
  const { data: rows } = useStationRange(stationId, 0, range, !!stationId, true);

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

  const scale = useMemo(() => {
    const all = [
      ...mapSeries.filter((v): v is number => v != null),
      ...stationSeries.map((p) => p.v),
    ];
    if (!all.length) return null;
    let lo = Math.min(...all);
    let hi = Math.max(...all);
    if (hi - lo < 1) {
      const mid = (hi + lo) / 2;
      lo = mid - 0.5;
      hi = mid + 0.5;
    }
    return { lo, hi };
  }, [mapSeries, stationSeries]);

  const last = Math.max(1, frames.length - 1);
  const usable = Math.max(0, width - LEFT - RIGHT);
  const px = (i: number) => LEFT + (i / last) * usable;
  const py = (v: number) =>
    scale ? PAD_Y + (1 - (v - scale.lo) / (scale.hi - scale.lo)) * (HEIGHT - 2 * PAD_Y) : 0;

  // The lines depend on the data and the width only, never on the slider: a step moves
  // the cursor (two plain Views) and leaves the SVG alone.
  const paths = useMemo(() => {
    if (!scale || !width) return null;
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
    return {
      map: pathOf(mapSeries.map((v, i) => ({ x: i, v }))),
      station: pathOf(stationSeries),
    };
    // px/py derive from scale, width and the frame count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, width, last, mapSeries, stationSeries]);

  if (!scale || frames.length < 2) return null;

  const fmt = (v: number) =>
    variable === 'wind' && prefs.windUnit === 'ms' ? v.toFixed(1) : String(Math.round(v));
  const cursorX = px(index);
  const mapNow = mapSeries[index];

  return (
    <View onLayout={onLayout} style={{ height: HEIGHT }}>
      {paths ? (
        <ChartLines
          width={width}
          mapPath={paths.map}
          stationPath={paths.station}
          color={palette.accent}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, bottom: 0, left: cursorX - 0.5, width: 1,
          backgroundColor: palette.muted, opacity: 0.5,
        }}
      />
      {mapNow != null ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: cursorX - 3.5, top: py(mapNow) - 3.5,
            width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5,
            borderColor: palette.accent, backgroundColor: palette.surfaceCard,
          }}
        />
      ) : null}
      <Text
        variant="caption" color={palette.muted} tabular
        style={{ position: 'absolute', left: 0, top: -2 }}
      >
        {fmt(scale.hi)}
      </Text>
      <Text
        variant="caption" color={palette.muted} tabular
        style={{ position: 'absolute', left: 0, bottom: -2 }}
      >
        {fmt(scale.lo)}
      </Text>
    </View>
  );
}

const ChartLines = memo(function ChartLines({
  width, mapPath, stationPath, color,
}: {
  width: number;
  mapPath: string;
  stationPath: string;
  color: string;
}) {
  return (
    <Svg width={width} height={HEIGHT}>
      {stationPath ? <Path d={stationPath} stroke={color} strokeWidth={2} fill="none" /> : null}
      {mapPath ? (
        <Path d={mapPath} stroke={color} strokeWidth={2} fill="none" strokeDasharray="4 3" />
      ) : null}
    </Svg>
  );
});
