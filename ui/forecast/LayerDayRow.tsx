/**
 * A day row, rendered for whichever layer is selected.
 *
 * The middle of the row is the ensemble beam: a shaded band where the 51 members
 * fall, a hairline at their median, and a marker at the value being reported. When
 * the marker sits away from the median you can see the deterministic run disagreeing
 * with the members; when it sits outside the band entirely, `resolveDayValues` has
 * already swapped in the median and the number carries a `~`.
 *
 * All of that geometry comes from `core/model/beam` as fractions, so this component
 * only places and colours things.
 *
 * Colour follows the quantity, not the layer's position in the switcher — design
 * rule 2 — so temperature is always `--val-temp`, millimetres always `--val-precip`,
 * and so on regardless of which tab you arrived from.
 *
 * The value columns are sized per layer rather than to one width that fits the
 * widest of them. "24 km/u" and "88%" do not need the same room, and a column wide
 * enough for the first left the beam — the part actually being read — short on every
 * other tab. Layers with nothing on the left get no left column at all.
 *
 * Type is a step up from the design's list sizes. The list left its card and gained
 * the card's padding on both sides; spending that on white space rather than on
 * legibility would have been a poor trade for a page that is one long column of
 * numbers.
 */
import type { ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import { radius, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, dayNames, fmtMm, windUnitLabel } from '../../core/i18n';
import { layerRow, type LayerKey } from '../../core/model/layers';
import { layerBeam, type Beam, type BeamTone, type Scale } from '../../core/model/beam';
import { resolveDayValues } from '../../core/model/dayValues';
import type { Day } from '../../core/model/types';

const TRACK_HEIGHT = 8;
const MARKER_WIDTH = 4;

/** Room each layer's own numbers need, so the beam keeps the rest. Measured against
 *  the widest realistic reading: "-12°" for temperature, "24,8 mm", "112 km/u". */
const COLUMNS: Record<LayerKey, { lead: number; trail: number }> = {
  overview: { lead: 0, trail: 0 },
  temp: { lead: 42, trail: 48 },
  precip: { lead: 38, trail: 70 },
  wind: { lead: 0, trail: 86 },
  sun: { lead: 0, trail: 62 },
  humidity: { lead: 40, trail: 46 },
};

export interface LayerDayRowProps {
  day: Day;
  dayIndex: number;
  layer: LayerKey;
  scale: Scale;
  /** Evaporation scale, for the sunshine row's second bar. */
  et0Max?: number;
  /** A hairline above the row, so a run of them reads as one table. */
  divider?: boolean;
  onPress?: () => void;
}

export function LayerDayRow({
  day, dayIndex, layer, scale, et0Max = 5, divider, onPress,
}: LayerDayRowProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const values = resolveDayValues(day, { dayIndex });
  const beam = layerBeam(day, layer, dayIndex, scale);

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);
  const hasEns = day.ensLoaded ?? false;
  const cols = COLUMNS[layer];

  const body = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 9,
        paddingVertical: 10, paddingHorizontal: 4,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: palette.hairlineSoft,
      }}
    >
      <View style={{ width: 46 }}>
        <Text variant="bodySm" weight="bold" color={palette.inkHeading} numberOfLines={1}>
          {names[date.getUTCDay()]}
        </Text>
        <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 12 }}>
          {date.getUTCDate()}/{date.getUTCMonth() + 1}
        </Text>
      </View>

      <WeatherIcon wmo={values.wmo ?? day.wmo} isDay={1} size={25} />

      {cols.lead > 0 ? (
        <LeadingValue day={day} layer={layer} dayIndex={dayIndex} width={cols.lead} />
      ) : null}

      <View style={{ flex: 1, gap: 4 }}>
        {layer === 'sun' ? (
          <SunBars day={day} scale={scale} et0Max={et0Max} />
        ) : (
          <BeamTrack beam={beam} />
        )}
        <SpreadCaption day={day} layer={layer} hasEns={hasEns} />
      </View>

      <TrailingValue day={day} layer={layer} dayIndex={dayIndex} width={cols.trail} />
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // The row opens a sheet, so it acknowledges the tap rather than looking inert
      // for the moment before the sheet arrives.
      style={({ pressed }) => ({
        borderRadius: radius.tile,
        backgroundColor: pressed ? palette.pressedRow : 'transparent',
      })}
    >
      {body}
    </Pressable>
  );
}

/** The track, its shaded member bands, the medians and the reported markers. */
function BeamTrack({ beam }: { beam: Beam }) {
  const { palette } = useTheme();
  const shade = useShades();

  return (
    <View
      style={{
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        backgroundColor: palette.hairline,
      }}
    >
      {beam.ranges.map((r, i) => (
        <View
          key={`r${i}`}
          style={{
            position: 'absolute',
            left: `${r.from * 100}%`,
            width: `${(r.to - r.from) * 100}%`,
            height: '100%',
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: shade(r.tone, 0.3),
          }}
        />
      ))}

      {beam.medians.map((m, i) => (
        <View
          key={`m${i}`}
          style={{
            position: 'absolute',
            left: `${m.at * 100}%`,
            marginLeft: -0.5,
            width: 1,
            height: '100%',
            backgroundColor: shade(m.tone, 0.75),
          }}
        />
      ))}

      {beam.markers.map((m, i) => (
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            left: `${m.at * 100}%`,
            marginLeft: -MARKER_WIDTH / 2,
            width: MARKER_WIDTH,
            height: '100%',
            borderRadius: 2,
            backgroundColor: shade(m.tone, 1),
          }}
        />
      ))}
    </View>
  );
}

/** Sunshine has no ensemble, so its row is two plain bars: hours of sun against the
 *  day's own daylight, and evaporation against the week's largest. */
function SunBars({ day, scale, et0Max }: { day: Day; scale: Scale; et0Max: number }) {
  const { palette } = useTheme();
  const sun = day.sunHours != null ? Math.min(1, day.sunHours / (scale.hi || 1)) : 0;
  const et0 = day.et0 != null ? Math.min(1, day.et0 / (et0Max || 1)) : 0;
  return (
    <View style={{ gap: 3 }}>
      <Bar fraction={sun} color={palette.valSun} />
      <Bar fraction={et0} color={palette.agroBright} />
    </View>
  );
}

function Bar({ fraction, color }: { fraction: number; color: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: palette.hairline }}>
      <View
        style={{
          position: 'absolute', left: 0, height: '100%',
          width: `${Math.max(1, fraction * 100)}%`,
          borderRadius: 3, backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * The members' range in words under the beam — the numbers the bands are showing.
 *
 * Temperature gets two of them. Its beam has always drawn two bands on one axis,
 * one for the night's minimum and one for the day's maximum, and a single caption
 * running from the coldest minimum to the warmest maximum described neither: it
 * spanned the gap between the bands, which no member ever occupies. The minimum's
 * spread and the maximum's spread are separate questions — how cold does it get,
 * how warm does it get — so they are separate numbers, placed under their own bands
 * and in their own colours.
 */
function SpreadCaption({ day, layer, hasEns }: { day: Day; layer: LayerKey; hasEns: boolean }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  if (layer === 'sun') return null;

  if (layer === 'temp') {
    if (!hasEns) return <Caption>—</Caption>;
    const t = (v: unknown) => convTemp(v as number, prefs.tempUnit);
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Caption color={palette.valLow}>
          {t(day.tempMinP10)}–{t(day.tempMinP90)}°
        </Caption>
        <Caption color={palette.valHigh}>
          {t(day.tempMaxP10)}–{t(day.tempMaxP90)}°
        </Caption>
      </View>
    );
  }

  if (!hasEns) return <Caption>—</Caption>;

  const text = (() => {
    switch (layer) {
      case 'precip':
        return day.precipP10 === 0 && day.precipP90 === 0
          ? '0 mm'
          : `${fmtMm(day.precipP10)}–${fmtMm(day.precipP90)} mm`;
      case 'wind':
        return `${convWind(day.windP10, prefs.windUnit)}–${convWind(day.windP90, prefs.windUnit)} ${windUnitLabel(prefs.windUnit)}`;
      case 'humidity':
        return day.humidityP10 != null && day.humidityP90 != null
          ? `${Math.round(day.humidityP10)}–${Math.round(day.humidityP90)}%`
          : '—';
      default:
        return null;
    }
  })();

  if (!text) return null;
  return <Caption align="center">{text}</Caption>;
}

function Caption({
  children, color, align,
}: { children: ReactNode; color?: string; align?: 'center' }) {
  const { palette } = useTheme();
  return (
    <Text
      variant="caption"
      color={color ?? palette.muted}
      tabular
      align={align}
      numberOfLines={1}
      style={{ fontSize: 11.5 }}
    >
      {children}
    </Text>
  );
}

/** Tones, at the opacity the part calls for: band, median hairline, marker. */
function useShades() {
  const { palette } = useTheme();
  return (tone: BeamTone, weight: number): string => {
    const base =
      tone === 'low' ? palette.valLow
        : tone === 'high' ? palette.valHigh
          : tone === 'precip' ? palette.valPrecip
            : tone === 'sun' ? palette.valSun
              : tone === 'et0' ? palette.agroBright
                : palette.muted;
    return weight >= 1 ? base : withAlpha(base, weight);
  };
}

/** Fade a token colour. Tokens are hex or rgb(a); anything else is left alone, which
 *  degrades to a solid colour rather than to an invalid style. */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgb) {
    const parts = rgb[1]!.split(',').map((p) => p.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return color;
}

/** The value shown left of the beam, where the layer has a low end. */
function LeadingValue({
  day, layer, dayIndex, width,
}: { day: Day; layer: LayerKey; dayIndex: number; width: number }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });

  if (layer === 'temp') {
    return (
      <Value
        width={width}
        align="right"
        value={convTemp(v.tempMin.value, prefs.tempUnit)}
        suffix="°"
        color={palette.valLow}
        approx={!v.tempMin.direct}
      />
    );
  }
  if (layer === 'humidity') {
    return (
      <Value
        width={width}
        align="right"
        value={v.humidityMin.value != null ? Math.round(v.humidityMin.value) : null}
        suffix="%"
        color={palette.valHigh}
        approx={!v.humidityMin.direct}
      />
    );
  }
  if (layer === 'precip') {
    // Probability leads: whether it rains matters before how much.
    return (
      <Value
        width={width}
        align="right"
        value={day.ensLoaded ? Math.round(day.pChance) : null}
        suffix="%"
        color={palette.muted}
      />
    );
  }
  return <View style={{ width }} />;
}

/** The layer's headline number, right of the beam. */
function TrailingValue({
  day, layer, dayIndex, width,
}: { day: Day; layer: LayerKey; dayIndex: number; width: number }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });
  const row = layerRow(day, layer, false, dayIndex);

  switch (layer) {
    case 'temp':
      return (
        <Value
          width={width}
          value={convTemp(v.tempMax.value, prefs.tempUnit)}
          suffix="°"
          color={palette.valHigh}
          approx={!v.tempMax.direct}
        />
      );

    case 'precip':
      return (
        <Value
          width={width}
          value={v.precip.value != null ? fmtMm(v.precip.value) : null}
          suffix=" mm"
          color={v.precip.value ? palette.valPrecip : palette.valPrecipZero}
          approx={!v.precip.direct}
        />
      );

    case 'wind':
      return (
        <View style={{ width, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <WindArrow deg={v.windDir} size={11} color={palette.muted} />
          <Value
            value={convWind(v.wind.value, prefs.windUnit)}
            suffix={` ${windUnitLabel(prefs.windUnit)}`}
            color={palette.valWind}
            approx={!v.wind.direct}
          />
        </View>
      );

    case 'humidity':
      return (
        <Value
          width={width}
          value={v.humidityMax.value != null ? Math.round(v.humidityMax.value) : null}
          suffix="%"
          color={palette.accentDark}
          approx={!v.humidityMax.direct}
        />
      );

    case 'sun':
      return (
        <View style={{ width }}>
          <Value
            value={v.sunHours != null ? v.sunHours.toFixed(1).replace('.', ',') : null}
            suffix=" u"
            color={palette.valSun}
          />
          <Text
            variant="caption"
            color={palette.agroBright}
            tabular
            numberOfLines={1}
            style={{ fontSize: 11 }}
          >
            {v.et0 != null ? `${fmtMm(v.et0)} mm` : '—'}
          </Text>
        </View>
      );

    default:
      return (
        <Value
          width={width}
          value={row.primary != null ? Math.round(row.primary) : null}
          suffix=""
          color={palette.inkHeading}
        />
      );
  }
}

function Value({
  value, suffix, color, approx, width, align,
}: {
  value: string | number | null;
  suffix?: string;
  color: string;
  approx?: boolean;
  width?: number;
  align?: 'right';
}) {
  const { palette } = useTheme();
  // One text node with the unit nested, not a row of two: a row of two is two
  // shrinkable boxes, and a narrow column squeezes both until each wraps on its own.
  return (
    <Text
      variant="bodySm"
      weight="bold"
      color={value == null ? palette.inkDisabled : color}
      tabular
      numberOfLines={1}
      align={align === 'right' ? 'right' : undefined}
      style={{ width }}
    >
      {value ?? '—'}
      {value != null && suffix ? (
        <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 11 }}>
          {suffix}
        </Text>
      ) : null}
      {value != null && approx ? (
        <Text variant="caption" color={palette.muted} style={{ fontSize: 9 }}>
          ~
        </Text>
      ) : null}
    </Text>
  );
}
