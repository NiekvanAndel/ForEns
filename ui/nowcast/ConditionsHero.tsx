/**
 * The conditions hero — the chosen location's own measurements.
 *
 * Works for any address; a station-backed one turns the source line AgroExact green
 * and gives it its dot.
 *
 * ## Why the rain is the card
 *
 * The layout follows the client's mock-up, and its argument is that this is a
 * rainfall app: what fell in the last hour and what has fallen over the day are the
 * two numbers a grower opens the page for, so they sit in a tinted strip of their
 * own with the condition glyph beside them, and everything else is one quiet line
 * underneath.
 *
 * That is a demotion for the temperature, which used to be a 58-point number filling
 * half the card with the reading least likely to be the reason anyone looked. It is
 * still the largest thing in the bottom row — it is what that row is anchored on —
 * but it no longer outweighs the strip above it.
 *
 * The three-cell divider row went with it. Temperature, its day range, wind and
 * humidity read as one sentence with bullets between them in the space the cells
 * took, and the rule-and-cell grid was carrying no information the spacing does not.
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

  const now = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1];
  const today = model.days[0];
  const station = !!location.stationId;

  const hi = today?.hresTempMax ?? today?.tempHi ?? null;
  const lo = today?.hresTempMin ?? today?.tempLo ?? null;

  // The hour that has just finished, not the one running: a station's last full hour
  // is a measurement, where the current hour is a total still being added to.
  const lastHour = model.pastHours[model.pastHours.length - 1]?.precip ?? 0;

  // 24-hour precipitation: what has already fallen plus what is still to come today.
  const precip24 =
    model.pastHours.reduce((s, h) => s + (h.precip ?? 0), 0) +
    model.futureHours.slice(0, 24).reduce((s, h) => s + (h.precip ?? 0), 0);

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

        {/* The strip: the two rainfall readings, and the weather it belongs to. */}
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
          <WeatherIcon wmo={now?.wmo ?? 3} isDay={now?.isDay ?? 1} size={44} />
        </View>

        {/* Everything else, as one line: temperature and its day range, then wind,
            then humidity, separated by bullets rather than by rules. */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap',
            gap: space[2],
            marginTop: space[4],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text
              variant="stat"
              color={palette.appValue}
              tabular
              style={{ fontSize: TEMP_SIZE }}
            >
              {now?.temp != null ? convTemp(now.temp, prefs.tempUnit) : '—'}°
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
            <WindArrow deg={now?.windDir ?? null} size={14} />
            <Text variant="label" color={palette.valWind} tabular>
              {convWind(now?.wind ?? null, prefs.windUnit) ?? '—'}
            </Text>
            <Unit>{windUnitLabel(prefs.windUnit)}</Unit>
          </View>

          <Bullet />

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text variant="label" color={palette.inkHeading} tabular>
              {now?.humidity ?? '—'}
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
        <Text
          variant="stat"
          color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
          tabular
        >
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
