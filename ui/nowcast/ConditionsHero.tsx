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
 * the two numbers a grower opens the page for, so they lead the card with the
 * condition glyph beside them, and everything else is one quiet line underneath.
 *
 * The rainfall band takes the card's own ground rather than a blue tint. A panel
 * inside a card is a second card, and the millimetres are already the biggest
 * coloured numbers on the page — they did not need a box drawn round them to be
 * found. What separates the band from the line below it is a hairline, which is what
 * separates everything else in this app.
 *
 * That is a demotion for the temperature, which used to be a 58-point number filling
 * half the card with the reading least likely to be the reason anyone looked. It is
 * still the largest mark in the bottom row — it is what that row is anchored on —
 * but it no longer outweighs the strip above it.
 *
 * The three-cell divider row went with it. Temperature, its range, wind and humidity
 * read as one line with bullets between them in the space the cells took, spread the
 * full width of the card so nothing is crowded into its left half.
 *
 * Every reading on that line sits on one baseline, the wind arrow included: it is a
 * glyph like any other and stands on the line rather than floating centred in its
 * own group, which is what had it sitting higher than the numbers beside it. The
 * temperature keeps the larger size — it is what the line is anchored on — and wind
 * and humidity stay at label size, as they read best.
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
 *
 * Temperature and wind are printed to a tenth where the feed reports one — always
 * from an AgroExact station, usually from the model too — and as whole numbers where
 * it does not, so nothing here reads "17,0". See `fmtDecimal`. This is the card with
 * the room for that precision; the dense rows elsewhere still round.
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Card, Rule } from '../Card';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { fmtMm, fmtTempValue, fmtWindValue, windUnitLabel, ta } from '../../core/i18n';
import { recent24 } from '../../core/model/station';
import type { ForecastModel } from '../../core/model/types';
import type { SavedLocation } from '../../core/prefs';

/** The rainfall readings run a fifth larger than a `stat`, and the glyph beside them
 *  with them: this card is read for the millimetres, so they are the one place on the
 *  page where a number is allowed to be bigger than the type scale's own step. */
const RAIN_SIZE = 25;
const RAIN_UNIT_SIZE = 14;
const RAIN_GLYPH_SIZE = 55;

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
    // The exact readings, not the whole-unit ones the dense rows draw: this card
    // has the room for the tenth the station or the model actually reported.
    temp: measured?.temp ?? modelled?.tempExact ?? modelled?.temp ?? null,
    wind: measured?.wind ?? modelled?.windExact ?? modelled?.wind ?? null,
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

        {/* The rainfall band: the two readings, then the weather they belong to at
            the end of the row.

            Each reading takes the width its own words need. Splitting the row into
            equal halves instead broke the second label over three lines and its value
            over two, with the glyph sitting on top of the millimetres: a label whose
            length changes with the language cannot be given a fixed share of a
            phone's width.

            "Laatste 24 uur" rather than the `hRain24` string the rest of the app
            uses: beside "Laatste uur" the pair reads as two windows onto the same
            gauge, where "Neerslag 24u" named the quantity a second time. It is an
            app string, so `strings.ts` stays a faithful port of index.html. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[5], marginTop: space[4] }}>
          <RainStat label={ta('lastHour', lang)} mm={lastHour} />
          <View style={{ width: 1, height: 40, backgroundColor: palette.hairline }} />
          <RainStat label={ta('last24h', lang)} mm={precip24} />
          {/* The icon stays modelled: a station measures quantities, not conditions. */}
          <View style={{ marginLeft: 'auto' }}>
            <WeatherIcon wmo={now.wmo} isDay={now.isDay} size={RAIN_GLYPH_SIZE} />
          </View>
        </View>
      </View>

      <Rule soft />

      {/* Everything else, as one line: temperature and its range, then wind, then
          humidity, spread across the card and sitting on one baseline. */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
          // Wraps rather than clips at the largest text size, where three readings
          // and their units no longer fit across one phone.
          flexWrap: 'wrap', rowGap: space[3], columnGap: space[3],
          paddingHorizontal: space[5], paddingVertical: space[4],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="stat" color={palette.appValue} tabular>
            {fmtTempValue(now.temp, prefs.tempUnit)}°
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text variant="caption" weight="bold" color={palette.valHigh} tabular>
              ▲{fmtTempValue(hi, prefs.tempUnit)}°
            </Text>
            <Text variant="caption" weight="bold" color={palette.muted}>
              {' / '}
            </Text>
            <Text variant="caption" weight="bold" color={palette.valLow} tabular>
              ▼{fmtTempValue(lo, prefs.tempUnit)}°
            </Text>
          </View>
        </View>

        <Bullet />

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <WindArrow deg={now.windDir} size={15} />
          <Text variant="label" color={palette.valWind} tabular>
            {fmtWindValue(now.wind, prefs.windUnit)}
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
    </Card>
  );
}

/** One rainfall reading in the band: what it is, and how much. */
function RainStat({ label, mm }: { label: string; mm: number }) {
  const { palette } = useTheme();
  return (
    <View>
      <Text
        variant="caption"
        weight="bold"
        color={palette.muted}
        numberOfLines={1}
        style={{ letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3, fontSize: 10.5 }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text
          variant="stat"
          color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
          numberOfLines={1}
          tabular
          style={{ fontSize: RAIN_SIZE }}
        >
          {fmtMm(mm)}
        </Text>
        <Text
          variant="caption"
          weight="semibold"
          color={palette.muted}
          style={{ fontSize: RAIN_UNIT_SIZE }}
        >
          mm
        </Text>
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
