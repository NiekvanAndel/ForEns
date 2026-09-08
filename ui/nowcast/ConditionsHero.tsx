/**
 * The conditions hero — the chosen location's own measurements.
 *
 * Works for any address; a station-backed one turns the title AgroExact green and
 * adds the source line with its dot. Layout follows the design's ConditionsHero:
 * the ▲/▼ pair beside the big reading, then a three-cell divider row.
 *
 * ## Everything here looks backwards, on purpose
 *
 * The card's subject is what it is doing *now*, so its supporting figures are the
 * last 24 hours rather than the rest of today: the maximum and the minimum since
 * this time yesterday, and the rain that has actually fallen in them. The ▲/▼ pair
 * used to be today's forecast extremes, which put a modelled afternoon next to a
 * measured present — and on a station-backed location that mixed an instrument's
 * reading with a model's opinion inside one row of numbers. Now every figure on the
 * card is an observation, and where AgroExact covers the location, a measurement.
 *
 * The hourly slider is its own card below this one. It answers a different question
 * — what happens next, rather than what it is doing now — and inside the hero it was
 * a fourth band on a card that already had three, with the reader having to work out
 * where "now" ended and "next" began.
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
import { recent24 } from '../../core/model/station';
import type { ForecastModel } from '../../core/model/types';
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

  const modelled = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1];
  const measured = model.station?.current ?? null;
  // Measurements are merged per quantity, exactly as the hour strip merges them: a
  // rain gauge fills in the rainfall and leaves the wind to the model.
  const now = {
    temp: measured?.temp ?? modelled?.temp ?? null,
    wind: measured?.wind ?? modelled?.wind ?? null,
    windDir: measured?.windDir ?? modelled?.windDir ?? null,
    humidity: measured?.humidity ?? modelled?.humidity ?? null,
    wmo: modelled?.wmo ?? 3,
    isDay: modelled?.isDay ?? 1,
  };
  const station = !!model.station || !!location.stationId;

  const { tempMin: lo, tempMax: hi, precip: precip24 } = recent24(model);

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
            {now.temp != null ? convTemp(now.temp, prefs.tempUnit) : '—'}°
          </Text>

          <View style={{ marginLeft: 'auto' }}>
            {/* The icon stays modelled: a station measures quantities, not conditions. */}
            <WeatherIcon wmo={now.wmo} isDay={now.isDay} size={54} />
          </View>
        </View>
      </View>

      <Rule />
      <View style={{ flexDirection: 'row' }}>
        <StatCell label={t('hWind', lang)}>
          <WindArrow deg={now.windDir} size={15} />
          <Text variant="stat" color={palette.valWind} tabular>
            {convWind(now.wind, prefs.windUnit) ?? '—'}
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
            {now.humidity ?? '—'}
          </Text>
          <Unit>%</Unit>
        </StatCell>
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
