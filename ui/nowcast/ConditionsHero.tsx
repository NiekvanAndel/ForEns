/**
 * The conditions hero — the chosen location's own measurements.
 *
 * Works for any address; a station-backed one turns the title AgroExact green and
 * adds the source line with its dot. Layout follows the design's ConditionsHero:
 * the ▲/▼ pair beside the big reading, a three-cell divider row, then the next
 * three hours.
 *
 * Reading colours follow the quantity, not the card (design rule 2): ▲ is val-high,
 * ▼ is val-low, temperature is val-temp, millimetres are val-precip, and a zero is
 * dimmed to val-precip-zero so real numbers stand out.
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Card, Rule, VRule } from '../Card';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, fmtMm, windUnitLabel, t } from '../../core/i18n';
import type { ForecastModel, Hour } from '../../core/model/types';
import type { SavedLocation } from '../../core/prefs';

export interface ConditionsHeroProps {
  model: ForecastModel;
  location: SavedLocation;
  /** Source line under the title, e.g. "HARMONIE-AROME" or a station name. */
  sourceLabel: string;
  /** Local time string for the header. */
  timeLabel: string;
}

export function ConditionsHero({ model, location, sourceLabel, timeLabel }: ConditionsHeroProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  const now = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1];
  const today = model.days[0];
  const station = !!location.stationId;

  const hi = today?.hresTempMax ?? today?.tempHi ?? null;
  const lo = today?.hresTempMin ?? today?.tempLo ?? null;

  // 24-hour precipitation: what has already fallen plus what is still to come today.
  const precip24 =
    model.pastHours.reduce((s, h) => s + (h.precip ?? 0), 0) +
    model.futureHours.slice(0, 24).reduce((s, h) => s + (h.precip ?? 0), 0);

  return (
    <Card pad={0}>
      <View style={{ paddingHorizontal: space[7], paddingTop: 18, paddingBottom: space[5] }}>
        {/* No location name: the page already carries it above, and repeating it
            here cost the card a line without telling the reader anything. What is
            left is what the card alone knows — when these readings are from, and
            which model or station they came from. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="label" weight="semibold" color={palette.muted} tabular>
            {timeLabel}
          </Text>
          {station ? (
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.agroBright }}
            />
          ) : null}
          <Text variant="caption" color={station ? palette.agroInk : palette.muted}>
            {sourceLabel}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: space[4] }}>
          <View style={{ gap: 2 }}>
            <Text variant="stat" color={palette.valHigh} tabular style={{ fontSize: 19 }}>
              ▲ {hi != null ? convTemp(hi, prefs.tempUnit) : '—'}°
            </Text>
            <Text variant="stat" color={palette.valLow} tabular style={{ fontSize: 19 }}>
              ▼ {lo != null ? convTemp(lo, prefs.tempUnit) : '—'}°
            </Text>
          </View>

          <Text variant="metric" color={palette.appValue} tabular>
            {now?.temp != null ? convTemp(now.temp, prefs.tempUnit) : '—'}°
          </Text>

          <View style={{ marginLeft: 'auto' }}>
            <WeatherIcon wmo={now?.wmo ?? 3} isDay={now?.isDay ?? 1} size={54} />
          </View>
        </View>
      </View>

      <Rule />
      <View style={{ flexDirection: 'row' }}>
        <StatCell label={t('hWind', lang)}>
          <WindArrow deg={now?.windDir ?? null} size={15} />
          <Text variant="stat" color={palette.valWind} tabular>
            {convWind(now?.wind ?? null, prefs.windUnit) ?? '—'}
          </Text>
          <Unit>{windUnitLabel(prefs.windUnit)}</Unit>
        </StatCell>
        <VRule />
        <StatCell label={t('hRain24', lang)}>
          <Text
            variant="stat"
            color={precip24 > 0 ? palette.valPrecip : palette.valPrecipZero}
            tabular
          >
            {fmtMm(precip24)}
          </Text>
          <Unit>mm</Unit>
        </StatCell>
        <VRule />
        <StatCell label={t('hHumidity', lang)}>
          <Text variant="stat" color={palette.inkHeading} tabular>
            {now?.humidity ?? '—'}
          </Text>
          <Unit>%</Unit>
        </StatCell>
      </View>

      <Rule />
      <View style={{ paddingHorizontal: space[5], paddingTop: 4, paddingBottom: 10 }}>
        {model.futureHours.slice(0, 3).map((h) => (
          <HourRow key={h.time} hour={h} />
        ))}
      </View>
    </Card>
  );
}

function StatCell({ label, children }: { label: string; children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: space[4], paddingHorizontal: space[2] }}>
      <Text variant="caption" weight="bold" color={palette.muted} style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5 }}>
        {children}
      </View>
    </View>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 11.5 }}>
      {children}
    </Text>
  );
}

/** One of the next three hours: time, glyph, temperature, mm, wind, sunshine. */
function HourRow({ hour }: { hour: Hour }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const mm = hour.precip ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 2 }}>
      <Text variant="bodySm" weight="bold" color={palette.muted} tabular style={{ width: 46 }}>
        {hour.time.slice(11, 16)}
      </Text>
      <WeatherIcon wmo={hour.wmo} isDay={hour.isDay} size={19} />
      <Text variant="bodySm" weight="bold" color={palette.valTemp} tabular style={{ width: 34 }}>
        {convTemp(hour.temp, prefs.tempUnit) ?? '—'}°
      </Text>
      <View style={{ width: 58, flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          variant="bodySm"
          weight="bold"
          tabular
          color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
        >
          {fmtMm(mm)}
        </Text>
        <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 11 }}>
          {' '}mm
        </Text>
      </View>
      <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <WindArrow deg={hour.windDir ?? null} size={13} />
        <Text variant="bodySm" weight="bold" color={palette.valWind} tabular>
          {convWind(hour.wind, prefs.windUnit) ?? '—'}
        </Text>
      </View>
      <Text variant="bodySm" weight="bold" color={palette.valSun} tabular align="right" style={{ width: 34 }}>
        {hour.sunMin ?? 0}m
      </Text>
    </View>
  );
}
