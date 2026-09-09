/**
 * The hour-by-hour list under a day sheet's chart.
 *
 * The web app prints one of these in every day popup, showing whichever measurand
 * the popup is about — millimetres in the precipitation popup, percent in the
 * humidity one, and so on. It is the part a reader scans for "when", which the chart
 * above can only suggest.
 *
 * One component covers every measurand rather than six near-copies, because six
 * near-copies is precisely how the web app's popups came to disagree with each
 * other. Hours already past are dimmed and labelled as measurements, not forecasts.
 *
 * Three-hourly samples beyond the deterministic run's hourly window are marked, so
 * a gap in the model is visible rather than implied.
 *
 * The icon and the readings are sized as on the forecast page's day rows, and read
 * from the same constants. A sheet opened from a row is the same table one level
 * deeper; the hours were set two points smaller than the days above them for no
 * reason a reader could see.
 *
 * The readings sit in proportional columns, and at one fixed size — nothing here
 * shrinks to fit.
 *
 * They used to, and that is what made one hour's row smaller than the next. On iOS
 * `adjustsFontSizeToFit` does not honour its floor on a text with a nested child,
 * which every reading here has: the unit is nested inside the number so the two
 * cannot be pulled apart. So an hour whose reading was a few points wider than its
 * neighbour's — "0,1 mm" against "0 mm" — did not shrink by the 15% the floor
 * promised, it shrank as far as iOS liked, and the row read as a different size from
 * the ones above and below it.
 *
 * The columns are sized for the widest reading each can hold ("-12 °C", "24,8 mm",
 * "120 km/u", "60 min") at the size they are set in, with room to spare on the
 * narrowest phone the app runs on. Nothing has to shrink, so nothing does, and every
 * hour reads at the same size as every other.
 *
 * Precipitation, temperature and wind rows also carry the hour's ensemble, once it
 * has loaded: the p10–p90 range the members allow, and for precipitation the share
 * of them that are wet at all. That is the difference between "1 mm" and "1 mm, but
 * a third of the members say nothing" — and, on an afternoon a front might reach
 * early, between "18°" and "18°, give or take four".
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, fmtMm, t, tempUnitLabel, windUnitLabel } from '../../core/i18n';
import type { LayerKey } from '../../core/model/layers';
import type { DetailHour } from '../../core/model/dayDetail';
import { sunnyHourWmo } from '../../core/model/conditions';

/** As on the day rows: temperature and precipitation lead, the longer units follow
 *  a size down. See `OverviewDayRow`, which these deliberately match. */
const VALUE_SIZE = 17;
const VALUE_SIZE_SMALL = 15;
const UNIT_SIZE = 12;
const UNIT_SIZE_SMALL = 11;
const ICON_SIZE = 30;
/** Room for "23:00" at the size above. */
const TIME_WIDTH = 46;

export interface HourlyListProps {
  layer: LayerKey;
  hours: DetailHour[];
  /** Named in the header, so it is clear which model the column came from. */
  sourceLabel: string;
}

export function HourlyList({ layer, hours, sourceLabel }: HourlyListProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  if (!hours.length) return null;

  // Three of the measurands have a per-hour ensemble behind them, and only once it
  // lands. The others read from a deterministic run alone.
  const ensField: EnsField | null =
    layer === 'precip' ? 'precip' : layer === 'temp' ? 'temp' : layer === 'wind' ? 'wind' : null;
  const withEns = ensField != null && hours.some((h) => hourSpread(h, ensField) != null);

  return (
    <View style={{ marginTop: space[4] }}>
      <Text variant="eyebrow" color={palette.muted} style={{ marginBottom: space[2] }}>
        {t('perHour', prefs.lang)} · {sourceLabel}
        {withEns ? ' · ENS' : ''}
      </Text>
      {hours.map((h, i) => (
        <View
          key={h.time}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingVertical: 8,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: palette.hairlineSoft,
            opacity: h.isPast ? 0.5 : 1,
          }}
        >
          <Text
            variant="bodySm"
            weight="semibold"
            color={palette.muted}
            tabular
            numberOfLines={1}
            style={{ width: TIME_WIDTH }}
          >
            {h.time.slice(11, 16)}
          </Text>

          <WeatherIcon wmo={sunnyHourWmo(h)} isDay={hourIsDay(h)} size={ICON_SIZE} />

          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <HourValue layer={layer} hour={h} />
          </View>

          {withEns && ensField ? <EnsembleColumns hour={h} field={ensField} /> : null}

          {h.isPast ? (
            <Text variant="caption" color={palette.muted} style={{ fontSize: 10 }}>
              {t('measurement', prefs.lang)}
            </Text>
          ) : h.is3h ? (
            <Text variant="caption" color={palette.muted} style={{ fontSize: 10 }}>
              3u
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

type EnsField = 'precip' | 'temp' | 'wind';

/** The members' p10–p90 for one field in one hour, in canonical units. */
function hourSpread(h: DetailHour, field: EnsField): { lo: number; hi: number } | null {
  const e = h.ens;
  if (!e) return null;
  if (field === 'precip') return { lo: e.precipP10, hi: e.precipP90 };
  const s = field === 'temp' ? e.temp : e.wind;
  return s ? { lo: s.p10, hi: s.p90 } : null;
}

/** What the 51 members say about this hour: the range they span, and — for
 *  precipitation, where "does it rain at all" is a separate question from "how
 *  much" — how many of them are wet. Held to fixed widths so the column reads down. */
function EnsembleColumns({ hour, field }: { hour: DetailHour; field: EnsField }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const spread = hourSpread(hour, field);

  const range = !spread
    ? ''
    : field === 'precip'
      ? `(${fmtMm(spread.lo)}–${fmtMm(spread.hi)})`
      : field === 'temp'
        ? `(${convTemp(spread.lo, prefs.tempUnit)}–${convTemp(spread.hi, prefs.tempUnit)}°)`
        : `(${convWind(spread.lo, prefs.windUnit)}–${convWind(spread.hi, prefs.windUnit)})`;

  return (
    <>
      <Text
        variant="caption"
        color={palette.muted}
        tabular
        align="right"
        style={{ width: 78, fontSize: 11 }}
      >
        {range}
      </Text>
      {/* Only precipitation has a probability worth a column: a temperature is
          always "happening", so the range is the whole of its uncertainty. */}
      {field === 'precip' ? (
        <Text
          variant="caption"
          weight="bold"
          color={hour.ens && hour.ens.pChance >= 40 ? palette.valPrecip : palette.muted}
          tabular
          align="right"
          style={{ width: 34, fontSize: 12 }}
        >
          {hour.ens ? `${Math.round(hour.ens.pChance)}%` : ''}
        </Text>
      ) : null}
    </>
  );
}

/** Day or night for the icon. The hour already knows its own date, and the sheet
 *  never crosses a location, so the model's own flag is enough. */
function hourIsDay(h: DetailHour): 0 | 1 {
  const hour = h.hour;
  return hour >= 6 && hour < 21 ? 1 : 0;
}

/**
 * One reading's column.
 *
 * Proportional with a floor, as on the day rows. Fixed widths sized for the widest
 * reading strand the narrow ones; no width at all is what let a long reading eat its
 * neighbour's room. A column both bounds the text — so `adjustsFontSizeToFit` shrinks
 * within its floor instead of collapsing — and puts every hour's reading under the
 * one above it.
 */
function Col({
  flex, minWidth, children,
}: { flex: number; minWidth: number; children: ReactNode }) {
  return (
    <View
      style={{
        flex, minWidth,
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end',
        gap: 3,
      }}
    >
      {children}
    </View>
  );
}

/** The one number this list is about. */
function HourValue({ layer, hour }: { layer: LayerKey; hour: DetailHour }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  switch (layer) {
    case 'precip':
      return (
        <Col flex={1} minWidth={0}>
          <Pair
            value={fmtMm(hour.precip)}
            unit="mm"
            color={hour.precip > 0 ? palette.valPrecip : palette.valPrecipZero}
          />
        </Col>
      );

    case 'temp':
      return (
        <Col flex={1} minWidth={0}>
          <Pair
            value={convTemp(hour.temp, prefs.tempUnit)}
            unit={tempUnitLabel(prefs.tempUnit)}
            color={palette.valTemp}
          />
        </Col>
      );

    case 'wind':
      return (
        <Col flex={1} minWidth={0}>
          <WindArrow deg={hour.windDir} size={12} color={palette.muted} />
          <Pair
            value={convWind(hour.wind, prefs.windUnit)}
            unit={windUnitLabel(prefs.windUnit)}
            color={palette.valWind}
          />
          {hour.gusts != null ? (
            <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 11 }}>
              ⤴ {convWind(hour.gusts, prefs.windUnit)}
            </Text>
          ) : null}
        </Col>
      );

    case 'sun':
      return (
        <Col flex={1} minWidth={0}>
          <Pair
            value={hour.sunMin != null ? Math.round(hour.sunMin) : null}
            unit="min"
            color={palette.valSun}
          />
        </Col>
      );

    case 'humidity':
      return (
        <Col flex={1} minWidth={0}>
          <Pair
            value={hour.humidity != null ? Math.round(hour.humidity) : null}
            unit="%"
            color={palette.accentDark}
          />
        </Col>
      );

    // The overview list carries the whole hour, since that is what it is for. The
    // proportions follow the day row's: temperature and precipitation lead, wind
    // takes the most room for the longest unit, sunshine closes. Each floor is the
    // width of that column's widest reading, and the four together leave room to
    // spare beside the time and the icon on the narrowest phone the app runs on.
    case 'overview':
      return (
        <>
          <Col flex={2.6} minWidth={46}>
            <Pair
              value={convTemp(hour.temp, prefs.tempUnit)}
              unit={tempUnitLabel(prefs.tempUnit)}
              color={palette.valTemp}
            />
          </Col>
          <Col flex={2.8} minWidth={56}>
            <Pair
              value={fmtMm(hour.precip)}
              unit="mm"
              color={hour.precip > 0 ? palette.valPrecip : palette.valPrecipZero}
            />
          </Col>
          <Col flex={3} minWidth={56}>
            <Pair
              value={convWind(hour.wind, prefs.windUnit)}
              unit={windUnitLabel(prefs.windUnit)}
              color={palette.muted}
              small
            />
          </Col>
          <Col flex={2.4} minWidth={42}>
            <Pair
              value={hour.sunMin != null ? Math.round(hour.sunMin) : null}
              unit="min"
              color={palette.valSun}
              small
            />
          </Col>
        </>
      );
  }
}

/**
 * One reading and its unit, in a single text node.
 *
 * Nested rather than two boxes in a row, for the reason `OverviewDayRow` gives: two
 * boxes are two independently shrinkable things, and a narrow column squeezes both
 * until each wraps on its own.
 *
 * No `adjustsFontSizeToFit`: its column is wide enough for the widest reading it can
 * hold, and on a text with a nested child the prop ignores its own floor. See the
 * note at the top of the file.
 */
function Pair({
  value, unit, color, small,
}: { value: string | number | null; unit: string; color: string; small?: boolean }) {
  const { palette } = useTheme();
  const size = small ? VALUE_SIZE_SMALL : VALUE_SIZE;
  if (value == null) {
    return (
      <Text variant="bodySm" color={palette.inkDisabled} tabular style={{ fontSize: size }}>
        —
      </Text>
    );
  }
  return (
    <Text
      variant="bodySm"
      weight="bold"
      color={color}
      tabular
      numberOfLines={1}
      style={{ fontSize: size }}
    >
      {value}
      <Text
        variant="caption"
        weight="semibold"
        color={palette.muted}
        style={{ fontSize: small ? UNIT_SIZE_SMALL : UNIT_SIZE }}
      >
        {' '}{unit}
      </Text>
    </Text>
  );
}
