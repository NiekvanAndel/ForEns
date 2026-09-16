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
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { radius, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, dayNames, fmtMm, windUnitLabel } from '../../core/i18n';
import { resolveDayValues } from '../../core/model/dayValues';
import { dayRowCompact } from '../../core/layout';
import type { Day } from '../../core/model/types';

/** Room for the longest weekday abbreviation and a two-digit date. */
const DAY_WIDTH = 40;
/** How far back a past day is drawn. Faded enough to read as behind the forecast,
 *  dark enough that the numbers on it are still numbers. */
const SUBDUED_OPACITY = 0.55;
/** Tight, because five columns share what is left after the day and the icon. */
const COL_GAP = 5;

/**
 * How big the numbers get.
 *
 * Six columns share the row, so "as big as it fits" depends on the phone: the sizes
 * here fit comfortably from an iPhone 15 up, and on a 375-point screen a freezing day
 * ("-12° 24°") is a few points too wide for them. The row therefore measures itself and
 * drops a size below `DAY_ROW_COMPACT_WIDTH` — the whole row at once, so a list of them
 * stays one table.
 *
 * It used to be `adjustsFontSizeToFit` on each reading instead, which is the obvious
 * answer and the wrong one here: on iOS that prop stops honouring `minimumFontScale` as
 * soon as the text node has a nested one inside it, and every reading nests its unit.
 * What a reader saw was two days in a fortnight printed noticeably smaller than the
 * other twelve — the two that happened to carry the longest numbers. A size that depends
 * on the width cannot do that, because every row in a list has the same width.
 *
 * Temperature and precipitation lead; wind and sunshine follow a size down, since
 * they carry the longer units.
 */
const VALUE_SIZE = 17;
const VALUE_SIZE_SMALL = 15;
/** The same pair on a narrow screen. */
const VALUE_SIZE_TIGHT = 15;
const VALUE_SIZE_TIGHT_SMALL = 13.5;
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
  /**
   * Drawn back, for a day that has already happened.
   *
   * One opacity over the whole row rather than a muted colour per reading: the row's
   * colours mean things — a red maximum, a blue minimum, a grey zero — and recolouring
   * them to say "this is the past" would spend the colour system on a second message.
   * Fading says it without touching what the colours are for, and it is the mark
   * `HourlyList` already uses on an hour that has gone.
   */
  subdued?: boolean;
  onPress?: () => void;
}

export function OverviewDayRow({
  day, dayIndex, divider, subdued, onPress,
}: OverviewDayRowProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });
  // Measured rather than taken from the window: this row sits inside a card on 'Nu'
  // and across the full page on 'Verwachting', and it is the room it has that decides
  // whether the numbers fit, not the size of the screen around it.
  const [width, setWidth] = useState(0);
  const tight = dayRowCompact(width);

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);

  const body = (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 11, paddingHorizontal: 4,
        gap: COL_GAP,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: palette.hairlineSoft,
        opacity: subdued ? SUBDUED_OPACITY : 1,
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
          tight={tight}
        />
        <Reading
          value={convTemp(v.tempMax.value, prefs.tempUnit)}
          suffix="°"
          color={palette.valHigh}
          approx={!v.tempMax.direct}
          tight={tight}
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
          tight={tight}
        />
      </View>

      <View style={{ flex: 3, minWidth: 54, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Reading
          value={v.precip.value != null ? fmtMm(v.precip.value) : null}
          suffix=" mm"
          color={v.precip.value ? palette.valPrecip : palette.valPrecipZero}
          approx={!v.precip.direct}
          tight={tight}
        />
      </View>

      <View style={{ flex: 2.2, minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Reading
          value={v.sunHours != null ? v.sunHours.toFixed(1).replace('.', ',') : null}
          suffix=" u"
          color={palette.valSun}
          small
          tight={tight}
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
  value, suffix, color, approx, small, tight,
}: {
  value: string | number | null;
  suffix?: string;
  color: string;
  approx?: boolean;
  small?: boolean;
  /** Set by the row when it is too narrow for the full size. */
  tight?: boolean;
}) {
  const { palette } = useTheme();
  const size = tight
    ? (small ? VALUE_SIZE_TIGHT_SMALL : VALUE_SIZE_TIGHT)
    : (small ? VALUE_SIZE_SMALL : VALUE_SIZE);
  if (value == null) {
    return (
      <Text
        variant="bodySm"
        color={palette.inkDisabled}
        tabular
        numberOfLines={1}
        style={{ fontSize: size }}
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
      style={{ fontSize: size }}
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
