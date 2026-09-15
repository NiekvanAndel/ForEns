/**
 * The colour ramp for the field layer, on the map.
 *
 * Built from the manifest's own legend, never from constants here: the pipeline is
 * allowed to change the scale without an app release, and a legend that disagreed with
 * the pixels would be worse than none. For temperature that ramp *is*
 * `core/model/temperatureColor.ts`, exported into the manifest, so this strip, the
 * pixels under it and the figures elsewhere in the app are all one scale.
 *
 * ## Standing, in the top-left corner
 *
 * Upright rather than lying down, and in the corner under the back button, which is
 * where every layer's legend now goes (the cumulative one moved to match). Two reasons.
 * A warm-at-the-top strip reads as a thermometer, which is the mental model a reader
 * already has for a colour scale of temperature. And upright it costs a narrow column
 * at the edge instead of a band across the bottom, where the panel and the attribution
 * already are.
 *
 * Drawn as a stack of thin slices rather than a gradient, because the scale is
 * continuous — unlike the cumulative layer's bands, where each block stands for a
 * range — and there is no gradient primitive here that does not pull in a dependency.
 * At this size the slices are the same picture.
 *
 * Only the ends and the middle are labelled. The exact figure for the place a reader
 * cares about is the number in its bubble, not something to be eyeballed off a strip.
 */
import { View } from 'react-native';
import { radius, shadowFloat, useTheme } from '../../theme';
import { Text } from '../Text';
import { legendColorFor, unitLabel, type FieldLegend as Legend } from '../../core/fields';
import { mapChrome } from '../radar/mapStyle';

/** Slices down the strip. Enough that the steps are invisible at this height. */
const SLICES = 40;
/** The strip itself. Tall enough to read a ramp off, short enough to leave the map. */
const STRIP_WIDTH = 8;
const STRIP_HEIGHT = 120;

export interface FieldLegendProps {
  legend: Legend;
  /** The manifest's CF unit, printed beside the top figure. */
  unit: string;
  /** How far down it floats; the caller clears the map's own chrome. */
  top: number;
}

export function FieldLegend({ legend, unit, top }: FieldLegendProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  const { vmin, vmax } = legend;
  if (!(vmax > vmin)) return null;

  const at = (f: number) => vmin + f * (vmax - vmin);
  const label = unitLabel(unit);

  return (
    <View
      style={[
        {
          position: 'absolute', left: 14, top,
          backgroundColor: chrome.bg,
          borderRadius: radius.tile,
          paddingVertical: 8, paddingHorizontal: 8,
          flexDirection: 'row', gap: 6,
        },
        shadowFloat,
      ]}
      accessibilityLabel={`Legenda: ${Math.round(vmin)} tot ${Math.round(vmax)} ${label}`}
    >
      <View style={{ width: STRIP_WIDTH, height: STRIP_HEIGHT, borderRadius: 3, overflow: 'hidden' }}>
        {Array.from({ length: SLICES }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              // Top slice is the warm end: the strip is read as a thermometer.
              backgroundColor:
                legendColorFor(legend, at(1 - i / (SLICES - 1))) ?? 'transparent',
            }}
          />
        ))}
      </View>

      <View style={{ height: STRIP_HEIGHT, justifyContent: 'space-between' }}>
        <Text variant="caption" color={chrome.ink} tabular>
          {`${Math.round(vmax)} ${label}`}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {Math.round(at(0.5))}
        </Text>
        <Text variant="caption" color={chrome.ink} tabular>
          {Math.round(vmin)}
        </Text>
      </View>
    </View>
  );
}
