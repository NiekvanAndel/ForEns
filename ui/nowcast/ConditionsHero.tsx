/**
 * The conditions hero — the chosen location's own measurements.
 *
 * Works for any address; a station-backed one turns the source line AgroExact green
 * and gives it its dot.
 *
 * ## Why the rain is the card
 *
 * The layout follows the client's mock-up, and its argument is that this is a
 * rainfall app: what fell in the last hour and what has fallen over the last day are
 * the two numbers a grower opens the page for, so they sit in a tinted strip of
 * their own with the condition glyph beside them, and everything else is one quiet
 * line underneath.
 *
 * That is a demotion for the temperature, which used to be a 58-point number filling
 * half the card with the reading least likely to be the reason anyone looked. It is
 * still the largest mark in the bottom row — it is what that row is anchored on —
 * but it no longer outweighs the strip above it.
 *
 * The three-cell divider row went with it. Temperature, its range, wind and humidity
 * read as one sentence with bullets between them in the space the cells took, and
 * the rule-and-cell grid was carrying no information the spacing does not.
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
 * — what happens next, rather than what it is doing now.
 *
 * Reading colours follow the quantity, not the card (design rule 2): ▲ is val-high,
 * ▼ is val-low, millimetres are val-precip, and a zero is dimmed to val-precip-zero
 * so real numbers stand out.
 */
import { View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Card } from '../Card';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, fmtMm, windUnitLabel, t, ta } from '../../core/i18n';
import { recent24 } from '../../core/model/station';
import type { ForecastModel } from '../../core/model/types';
import type { SavedLocation } from '../../core/prefs';

/** The temperature stays the biggest mark in the bottom row without competing with
 *  the strip above it: a step up from `stat`, well short of the old `metric`. */
const TEMP_SIZE = 27;

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

  // The hour that has just finished, not the one running: a full hour is a total,
  // where the current one is still being added to. `pastHours` already carries the
  // station's own rainfall where there is a gauge — see `applyStationObservations`.
  const lastHour = model.pastHours[model.pastHours.length - 1]?.precip ?? 0;

  return (
    <Card pad={0}>
      <View style={{ paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[4] }}>
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

        {/* The strip: the two rainfall readings, and the weather they belong to. */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            gap: space[3],
            marginTop: space[3],
            paddingVertical: space[3], paddingHorizontal: space[4],
            backgroundColor: palette.accentTint,
            borderRadius: radius.tile,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[5] }}>
            <RainStat label={ta('lastHour', lang)} mm={lastHour} />
            <View style={{ width: 1, height: 30, backgroundColor: palette.hairline }} />
            <RainStat label={t('hRain24', lang)} mm={precip24} />
          </View>
          {/* The icon stays modelled: a station measures quantities, not conditions. */}
          <WeatherIcon wmo={now.wmo} isDay={now.isDay} size={44} />
        </View>

        {/* Everything else, as one line: temperature and its range, then wind, then
            humidity, separated by bullets rather than by rules. */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap',
            gap: space[2],
            marginTop: space[4],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="stat" color={palette.appValue} tabular style={{ fontSize: TEMP_SIZE }}>
              {now.temp != null ? convTemp(now.temp, prefs.tempUnit) : '—'}°
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text variant="caption" weight="bold" color={palette.valHigh} tabular>
                ▲{hi != null ? convTemp(hi, prefs.tempUnit) : '—'}°
              </Text>
              <Text variant="caption" weight="bold" color={palette.muted}>
                {' / '}
              </Text>
              <Text variant="caption" weight="bold" color={palette.valLow} tabular>
                ▼{lo != null ? convTemp(lo, prefs.tempUnit) : '—'}°
              </Text>
            </View>
          </View>

          <Bullet />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <WindArrow deg={now.windDir} size={14} />
            <Text variant="label" color={palette.valWind} tabular>
              {convWind(now.wind, prefs.windUnit) ?? '—'}
            </Text>
            <Unit>{windUnitLabel(prefs.windUnit)}</Unit>
          </View>

          <Bullet />

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text variant="label" color={palette.inkHeading} tabular>
              {now.humidity ?? '—'}
            </Text>
            <Unit>%</Unit>
          </View>
        </View>
      </View>
    </Card>
  );
}

/** One rainfall reading in the strip: what it is, and how much. */
function RainStat({ label, mm }: { label: string; mm: number }) {
  const { palette } = useTheme();
  return (
    <View>
      <Text
        variant="caption"
        weight="bold"
        color={palette.muted}
        style={{ letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3, fontSize: 10.5 }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text variant="stat" color={mm > 0 ? palette.valPrecip : palette.valPrecipZero} tabular>
          {fmtMm(mm)}
        </Text>
        <Unit>mm</Unit>
      </View>
    </View>
  );
}

/** The separator between the readings on the bottom line. */
function Bullet() {
  const { palette } = useTheme();
  return (
    <Text variant="caption" color={palette.inkDisabled}>
      •
    </Text>
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
