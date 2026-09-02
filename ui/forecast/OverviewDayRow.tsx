/**
 * The overview day row — everything about a day on one line.
 *
 * This is the web app's `overzicht` tab: day and date, the condition icon, minimum
 * and maximum temperature, wind with its direction, precipitation, and sunshine
 * hours. No bar and no ensemble whisker; the point of this row is breadth, and the
 * per-measurand tabs are where a single quantity is read closely.
 *
 * Values come from `resolveDayValues`, so a reading the ensemble median stood in for
 * carries the same `~` the web app prints — the deterministic run was an outlier and
 * the reader should know the number is the ensemble's, not IFS's.
 *
 * Used by both 'Nu' and the 'Verwachting' overview tab, so the two cannot disagree —
 * which is why the columns are proportional rather than fixed widths. The same row
 * has to fit inside a card on 'Nu' and the full page width on 'Verwachting', and
 * fixed widths sized for the second overflowed the first: "2,8 mm" wrapped onto
 * three lines and the column alignment went with it.
 *
 * Each reading is one `Text` node with its unit nested inside, not a flex row of two.
 * A row of two is two independently shrinkable boxes, and a narrow column squeezes
 * both until each wraps on its own — which is how "2,8 mm" became "2," / "8" / "m" /
 * "m". Nested text has no inner layout to squeeze: it is a single line box that
 * cannot break, whatever width it is given.
 *
 * The columns run left to right in the order the web app used: day, condition,
 * temperature, wind, precipitation, sunshine. Wind was briefly stacked under the
 * temperatures to buy precipitation room, back when precipitation was wrapping —
 * but the wrapping had a different cause, and one flat row of columns is easier to
 * read down than a row with one two-storey cell in it.
 */
import { View, Pressable } from 'react-native';
import { radius, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, dayNames, fmtMm, windUnitLabel } from '../../core/i18n';
import { resolveDayValues } from '../../core/model/dayValues';
import type { Day } from '../../core/model/types';

/** Room for the longest weekday abbreviation and a two-digit date. */
const DAY_WIDTH = 40;
/** Tight, because five columns share what is left after the day and the icon. */
const COL_GAP = 5;

/**
 * How big the numbers get.
 *
 * Six columns share the row, so "as big as it fits" depends on the phone: the sizes
 * here fit comfortably from an iPhone 15 up, and on a 375-point screen a freezing
 * day ("-12° 24°") is a few points too wide for them. So the readings also carry
 * `adjustsFontSizeToFit` with a floor of 0.85, which shrinks that one column by up
 * to two points on the narrow screens rather than truncating it — every other row
 * and every wider phone keeps the full size.
 *
 * That prop was removed from this file once before, when it was hiding a
 * precipitation reading that wrapped because it was built from two text nodes. The
 * structure is one node now; this is the prop doing its actual job.
 *
 * Temperature and precipitation lead; wind and sunshine follow a size down, since
 * they carry the longer units.
 */
const VALUE_SIZE = 17;
const VALUE_SIZE_SMALL = 15;
/** The units and the `~`, scaled with the numbers they belong to. */
const UNIT_SIZE = 12;
const UNIT_SIZE_SMALL = 11;
const ICON_SIZE = 30;

export interface OverviewDayRowProps {
  day: Day;
  /** Position in the forecast. Decides which model speaks for the day. */
  dayIndex: number;
  /** A hairline above the row, so a run of them reads as one table. */
  divider?: boolean;
  onPress?: () => void;
}

export function OverviewDayRow({ day, dayIndex, divider, onPress }: OverviewDayRowProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);

  const body = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 11, paddingHorizontal: 4,
        gap: COL_GAP,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: palette.hairlineSoft,
      }}
    >
      <View style={{ width: DAY_WIDTH }}>
        <Text variant="bodySm" weight="bold" color={palette.inkHeading} numberOfLines={1}>
          {names[date.getUTCDay()]}
        </Text>
        <Text
          variant="caption"
          color={palette.muted}
          tabular
          numberOfLines={1}
          style={{ fontSize: 12 }}
        >
          {date.getUTCDate()}/{date.getUTCMonth() + 1}
        </Text>
      </View>

      <WeatherIcon wmo={v.wmo ?? day.wmo} isDay={1} size={ICON_SIZE} />

      {/* Minimum and maximum, low colour then high — the pair reads as one range. */}
      <View
        style={{
          flex: 3, minWidth: 56, flexDirection: 'row', alignItems: 'baseline',
          justifyContent: 'flex-end', gap: 6,
        }}
      >
        <Reading
          value={convTemp(v.tempMin.value, prefs.tempUnit)}
          suffix="°"
          color={palette.valLow}
          approx={!v.tempMin.direct}
        />
        <Reading
          value={convTemp(v.tempMax.value, prefs.tempUnit)}
          suffix="°"
          color={palette.valHigh}
          approx={!v.tempMax.direct}
        />
      </View>

      <View
        style={{
          flex: 2.6, minWidth: 50, flexDirection: 'row', alignItems: 'center',
          justifyContent: 'flex-end', gap: 3,
        }}
      >
        <WindArrow deg={v.windDir} size={12} color={palette.muted} />
        <Reading
          value={convWind(v.wind.value, prefs.windUnit)}
          suffix={` ${windUnitLabel(prefs.windUnit)}`}
          color={palette.muted}
          approx={!v.wind.direct}
          small
        />
      </View>

      <View style={{ flex: 3, minWidth: 54, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Reading
          value={v.precip.value != null ? fmtMm(v.precip.value) : null}
          suffix=" mm"
          color={v.precip.value ? palette.valPrecip : palette.valPrecipZero}
          approx={!v.precip.direct}
        />
      </View>

      <View style={{ flex: 2.2, minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Reading
          value={v.sunHours != null ? v.sunHours.toFixed(1).replace('.', ',') : null}
          suffix=" u"
          color={palette.valSun}
          small
        />
      </View>
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

/** One number, with its unit and the `~` the web app uses to mark an ensemble
 *  stand-in — all in one text node, so nothing inside it can be squeezed apart. */
function Reading({
  value, suffix, color, approx, small,
}: {
  value: string | number | null;
  suffix?: string;
  color: string;
  approx?: boolean;
  small?: boolean;
}) {
  const { palette } = useTheme();
  if (value == null) {
    return (
      <Text
        variant="bodySm"
        color={palette.inkDisabled}
        tabular
        numberOfLines={1}
        style={{ fontSize: small ? VALUE_SIZE_SMALL : VALUE_SIZE }}
      >
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
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      style={{ fontSize: small ? VALUE_SIZE_SMALL : VALUE_SIZE }}
    >
      {value}
      {suffix ? (
        <Text
          variant="caption"
          weight="semibold"
          color={palette.muted}
          style={{ fontSize: small ? UNIT_SIZE_SMALL : UNIT_SIZE }}
        >
          {suffix}
        </Text>
      ) : null}
      {approx ? (
        <Text variant="caption" color={palette.muted} style={{ fontSize: 10 }}>
          ~
        </Text>
      ) : null}
    </Text>
  );
}
