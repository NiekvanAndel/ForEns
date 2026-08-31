/**
 * A day row, rendered for whichever layer is selected.
 *
 * One row component serves all five layers: `core/model/layers` describes what the
 * row shows and the row draws it. That keeps the arithmetic testable and stops five
 * near-identical components drifting apart.
 *
 * Colour follows the quantity, not the layer's position in the switcher — design
 * rule 2 — so temperature is always `--val-temp`, millimetres always `--val-precip`,
 * and so on regardless of which tab you arrived from.
 */
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, dayNames, fmtMm, windUnitLabel } from '../../core/i18n';
import { bandGeometry, layerRow, type LayerKey, type Range } from '../../core/model/layers';
import type { Day } from '../../core/model/types';

const TRACK_HEIGHT = 6;

export interface LayerDayRowProps {
  day: Day;
  layer: LayerKey;
  scale: Range;
  showSpread: boolean;
  onPress?: () => void;
}

export function LayerDayRow({ day, layer, scale, showSpread, onPress }: LayerDayRowProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const row = layerRow(day, layer, showSpread);
  const band = bandGeometry(row.band, scale);
  const whisker = bandGeometry(row.spread, scale);

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);

  const body = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 8, paddingHorizontal: 2,
      }}
    >
      <View style={{ width: 44 }}>
        <Text variant="label" weight="bold" color={palette.inkHeading}>
          {names[date.getUTCDay()]}
        </Text>
        <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 11 }}>
          {date.getUTCDate()}/{date.getUTCMonth() + 1}
        </Text>
      </View>

      <WeatherIcon wmo={day.dayIcon ?? day.wmo} isDay={1} size={19} />

      <LeadingValue day={day} layer={layer} row={row} />

      <View style={{ flex: 1, height: 14, justifyContent: 'center' }}>
        {/* The ensemble whisker sits behind the band: the range the members allow. */}
        {whisker ? (
          <View
            style={{
              position: 'absolute',
              left: `${whisker.left * 100}%`,
              width: `${whisker.width * 100}%`,
              height: TRACK_HEIGHT + 4,
              borderRadius: (TRACK_HEIGHT + 4) / 2,
              backgroundColor: palette.accentTint,
            }}
          />
        ) : null}

        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: palette.hairline,
          }}
        />

        {band ? (
          <BandFill layer={layer} left={band.left} width={band.width} />
        ) : null}
      </View>

      <TrailingValue day={day} layer={layer} row={row} />
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

/** The filled band, tinted by the quantity the layer shows. */
function BandFill({ layer, left, width }: { layer: LayerKey; left: number; width: number }) {
  const { palette } = useTheme();
  const style = {
    position: 'absolute' as const,
    left: `${left * 100}%` as const,
    width: `${width * 100}%` as const,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  };

  if (layer === 'temp') {
    // Cold to warm across the day's own range.
    return (
      <LinearGradient
        colors={[palette.valLow, palette.valTemp]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={style}
      />
    );
  }
  if (layer === 'precip') {
    return (
      <LinearGradient
        colors={[palette.sky, palette.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={style}
      />
    );
  }
  const solid =
    layer === 'wind' ? palette.inkHeading
      : layer === 'sun' ? palette.valSun
        : palette.accent;
  return <View style={[style, { backgroundColor: solid }]} />;
}

/** The value shown to the left of the track, where the layer has a low end. */
function LeadingValue({ day, layer, row }: { day: Day; layer: LayerKey; row: ReturnType<typeof layerRow> }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  if (layer === 'temp') {
    return (
      <Text variant="label" weight="bold" color={palette.valLow} tabular align="right" style={{ width: 32 }}>
        {convTemp(row.secondary, prefs.tempUnit) ?? '—'}°
      </Text>
    );
  }
  if (layer === 'precip' && row.note) {
    // Probability leads the row: whether it rains matters before how much.
    return (
      <Text variant="caption" weight="bold" color={palette.muted} tabular align="right" style={{ width: 32 }}>
        {row.note}
      </Text>
    );
  }
  return <View style={{ width: 32 }} />;
}

/** The value shown to the right of the track — the layer's headline number. */
function TrailingValue({ day, layer, row }: { day: Day; layer: LayerKey; row: ReturnType<typeof layerRow> }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const width = 62;

  if (row.primary == null) {
    return (
      <Text variant="label" color={palette.inkDisabled} tabular style={{ width }}>
        —
      </Text>
    );
  }

  switch (layer) {
    case 'temp':
      return (
        <Text variant="label" weight="bold" color={palette.valHigh} tabular style={{ width }}>
          {convTemp(row.primary, prefs.tempUnit)}°
        </Text>
      );

    case 'precip':
      return (
        <View style={{ width, flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            variant="label"
            weight="bold"
            tabular
            color={row.primary > 0 ? palette.valPrecip : palette.valPrecipZero}
          >
            {fmtMm(row.primary)}
          </Text>
          <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 10 }}>
            {' '}mm
          </Text>
        </View>
      );

    case 'wind':
      return (
        <View style={{ width, flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="label" weight="bold" color={palette.valWind} tabular>
            {convWind(row.primary, prefs.windUnit)}
          </Text>
          <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 10 }}>
            {' '}{windUnitLabel(prefs.windUnit)}
          </Text>
        </View>
      );

    case 'sun':
      return (
        <View style={{ width }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text variant="label" weight="bold" color={palette.valSun} tabular>
              {row.primary.toFixed(1).replace('.', ',')}
            </Text>
            <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 10 }}>
              {' '}u
            </Text>
          </View>
          {row.secondary != null ? (
            <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 10 }}>
              ET₀ {fmtMm(row.secondary)} mm
            </Text>
          ) : null}
        </View>
      );

    case 'humidity':
      return (
        <View style={{ width, flexDirection: 'row', alignItems: 'baseline' }}>
          <Text variant="label" weight="bold" color={palette.inkHeading} tabular>
            {Math.round(row.primary)}
          </Text>
          <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 10 }}>
            {' '}%
          </Text>
        </View>
      );
  }
}
