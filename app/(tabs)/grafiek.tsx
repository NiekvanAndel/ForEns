/**
 * Grafiek — one quantity, over a period the reader chooses.
 *
 * The web app opens this by tapping a station on its overview; here it is a tab,
 * because in ExactCast the location is already chosen — the top row and the sideways
 * swipe pick it, exactly as on every other page — so there is nothing to tap through
 * to. What is left is the two choices the page is actually about: which period, and
 * which measurement.
 *
 * ## What it plots
 *
 * On a location an AgroExact station speaks for, the station's own hourly record.
 * Everywhere else the weather model's own observed hours, which reach about a day
 * back and no further — the model is a forecast, not an archive, so on a location
 * with no station a thirty-day window is mostly empty and the page says so rather
 * than drawing an empty grid and leaving the reader to work out why.
 *
 * `core/model/series` assembles it and marks every sample with where it came from;
 * the chart draws measurement solid and forecast dashed, and never joins the two
 * into one line. See `SeriesChart`.
 *
 * ## The forecast is always drawn
 *
 * The line carries past the current hour — dashed, and never joined to the measured
 * part — and the date fields reach as far ahead as the model does, so the coming
 * days are read the same way as the past ones.
 *
 * There was a switch for it, off by default. It was not earning its place: the dash
 * already says which half is which, far more precisely than a checkbox above the
 * chart could, and starting with it off meant the page's most-used window opened
 * showing half of what it had.
 *
 * ## One day is read at the grain a station reports on
 *
 * A station measures about every ten minutes, and over a single day that is what the
 * page asks for. An hourly bar cannot tell a quarter of an hour of heavy rain from a
 * wet hour, which on a one-day chart is the distinction the reader came for. Longer
 * windows stay on the hourly roll-up — a month of ten-minute records is thousands of
 * points nobody can read.
 *
 * ## The running total on rainfall
 *
 * Rainfall gets a cumulative line over its bars, on the same axis. That is what
 * turns "it rained a bit most hours" into "and that came to eleven millimetres",
 * which is the question a rainfall chart is opened for.
 *
 * Sharing the axis has a price — a month's total dwarfs any single hour, so the bars
 * flatten under it — and the legend item is where that is paid back: tapping it
 * switches the line off, and the axis goes back to fitting the bars alone. So the
 * legend is a control here, not a caption.
 *
 * ## The band's edges are lines of their own
 *
 * Temperature and humidity report a minimum and a maximum, and those are readings a
 * grower acts on rather than a shaded area to squint at. Each is drawn as its own
 * line and each has its own legend switch, alongside one for the central line; one
 * of the three always stays on, because a chart of nothing is an axis with nothing
 * against it.
 *
 * Whether they start up follows the grain. Per day the edges are the day's coldest
 * and warmest, which is what a week of temperatures is read for; per hour they are
 * the spread inside one hour, which over two days is three near-parallel lines
 * saying much the same thing.
 *
 * The two do not share a colour scheme. Warm is red and cold is blue, so
 * temperature's maximum is red — but humidity runs the other way, since it is the
 * *dry* end that is the hot, parched one. Following the number rather than the word
 * is what keeps a reader from checking the legend twice.
 *
 * The line is drawn in heading ink rather than in a second blue. Design rule 2 gives
 * every quantity its own colour, so a rainfall total cannot borrow the amber that
 * means temperature or the green that means a station — and a darker shade of the
 * bars' own blue is not a distinction at a glance. Ink is not a quantity's colour,
 * which is the honest thing for a line derived from the bars underneath it.
 *
 * A window longer than a few days is bucketed into days there too — the line becomes
 * each day's mean with its range behind it, and rainfall becomes each day's total.
 * The heading says which of the two is on screen, because "3,4 mm" means different
 * things per hour and per day.
 *
 * ## Where the two controls live
 *
 * The period above, the measurement with its chart below. One is about *when* and
 * the other about *what*, and a switcher belongs to the thing it changes; a heading
 * apiece is what keeps them apart, which is what headings are for.
 *
 * Neither is in a card. There were two, until the chart came out of its own to reach
 * the screen's edges — and a single card left floating over a page of bare content
 * is a box round one paragraph. Both rows are `PillSwitcher`, the same control
 * 'Verwachting' picks its layer with, so the whole page is one row of pills under a
 * heading, twice.
 *
 * ## The gesture
 *
 * Two horizontal drags live on this page: the pager's, which changes location, and
 * the chart's, which reads a value. The chart claims sideways movement at six points
 * and the pager waits for eighteen, so a drag that starts on the chart reads the
 * chart and a drag that starts anywhere else changes location.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { CardHeader } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { TAB_BAR_CLEARANCE } from '../../ui/GlassTabBar';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { usePeeking } from '../../ui/peek';
import { SeriesChart } from '../../ui/graph/SeriesChart';
import { PillSwitcher, type PillItem } from '../../ui/PillSwitcher';
import type { IconName } from '../../ui/Icon';
import {
  DEFAULT_PRESET, presetRange, RangeSelector,
  type DateRange, type PresetDays,
} from '../../ui/graph/RangeSelector';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useLocationStation, useStationRange } from '../../state/stations';
import {
  buildSeries, dayKey, daySpan, forecastHorizon, SERIES_META,
  type Sample, type SeriesKey,
} from '../../core/model/series';
import {
  degToCompass, fmtMm, fmtTempValue, fmtWindValue, tempUnitLabel, windUnitLabel, ta,
  type AppStringKey,
} from '../../core/i18n';

/**
 * The measurements the selector offers, in the order it shows them.
 *
 * The icons are 'Verwachting''s, for the quantities the two pages share: a reader
 * moving between them should meet the same picture for the same thing. The colour is
 * the *line's*, not the pill's — the pill carries the accent gradient like every
 * other switcher in the app, and the quantity's own colour belongs to the data.
 */
const SERIES: {
  key: SeriesKey;
  labelKey: AppStringKey;
  icon: IconName;
  color: (p: PageColors) => string;
}[] = [
  { key: 'temp', labelKey: 'temperature', icon: 'thermometer-simple', color: (p) => p.temp },
  { key: 'precip', labelKey: 'rain', icon: 'drop', color: (p) => p.precip },
  { key: 'humidity', labelKey: 'humidity', icon: 'drop-half', color: (p) => p.humidity },
  { key: 'wind', labelKey: 'windNow', icon: 'wind', color: (p) => p.wind },
  { key: 'windDir', labelKey: 'windDirection', icon: 'compass', color: (p) => p.wind },
  { key: 'radiation', labelKey: 'radiation', icon: 'sun', color: (p) => p.radiation },
];

interface PageColors {
  temp: string; precip: string; humidity: string; wind: string; radiation: string;
}

/** What the card is headed, and what the summary calls its highest sample — both
 *  follow the grain the chart ended up at. */
const RESOLUTION_LABEL = {
  minute: 'perTenMinutes', hour: 'perHour', day: 'perDay',
} as const satisfies Record<string, AppStringKey>;
const PEAK_LABEL = {
  minute: 'peakStep', hour: 'peakHour', day: 'peakDay',
} as const satisfies Record<string, AppStringKey>;

function GraphPage() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { model, offsetSec, phase } = useForecast();
  const insets = useSafeAreaInsets();
  const peeking = usePeeking();

  const [preset, setPreset] = useState<PresetDays | null>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET));
  const [key, setKey] = useState<SeriesKey>('temp');
  /** The running total over the rainfall bars. On by default — it is the reason the
   *  page can answer "how much fell in this period" at a glance. */
  const [showCumulative, setShowCumulative] = useState(true);
  /**
   * Which of a banded series' three lines are drawn.
   *
   * The default follows the grain, because the edges mean different things at each.
   * Per day they are the day's coldest and warmest — the two numbers a grower reads
   * a week of temperatures for — so they are up. Per hour they are the spread inside
   * one hour, which over two days is three near-parallel lines saying much the same
   * thing, so only the central one is. Either way the legend switches decide from
   * there, until the period changes and the grain with it.
   */
  const [lines, setLines] = useState({ value: true, lo: true, hi: true });

  const station = useLocationStation(location);
  // A single day gets the station's raw readings; anything longer, the hourly
  // roll-up. See the note at the top.
  const fine = daySpan(range.from, range.to) === 1;
  // A page sliding past does not fetch a month of measurements for a location the
  // reader may not stop on; it draws the modelled series instead, which is already
  // in hand.
  const measurements = useStationRange(station?.id ?? null, offsetSec, range, !peeking, fine);

  const series = useMemo(
    () =>
      buildSeries({
        key, from: range.from, to: range.to,
        measured: measurements.data ?? [], model, includeForecast: true,
        // Only where a station actually answered at that grain: the ten-minute grid
        // is worth its extra samples when they are filled, and is a row of gaps with
        // an hourly model behind it when they are not.
        stepMinutes: fine && (measurements.data?.length ?? 0) > 0 ? 10 : 60,
      }),
    [key, range.from, range.to, measurements.data, model, fine]
  );

  // As far ahead as the model can be asked about.
  const maxDay = forecastHorizon(model) ?? dayKey(new Date());

  const meta = SERIES_META[key];
  const byDay = series.resolution === 'day';

  // Changing the period is a deliberate act, and the grain it lands on is what the
  // edges should follow; a choice made at one grain has no claim on another.
  useEffect(() => {
    setLines({ value: true, lo: byDay, hi: byDay });
  }, [byDay]);

  const colors: PageColors = {
    temp: palette.valTemp, precip: palette.valPrecip,
    humidity: palette.accentDark, wind: palette.valWind,
    radiation: palette.valSun,
  };
  const color = SERIES.find((s) => s.key === key)?.color(colors) ?? palette.accent;

  /**
   * The colours the band's edges take, which are not the same pair for both.
   *
   * Warm is red and cold is blue, so temperature's maximum is red. Humidity runs the
   * other way: it is the *dry* end that is the hot, parched one, so its minimum
   * takes the red. Following the number rather than the word is what keeps a reader
   * from having to check the legend twice.
   */
  const edgeInk =
    key === 'humidity'
      ? { lo: palette.valHigh, hi: palette.valLow }
      : { lo: palette.valLow, hi: palette.valHigh };

  /** Only where the series has edges worth naming and something to draw them from. */
  const hasEdges = !!meta.edges && series.samples.some((s) => s.band != null);

  // One line has to stay: a chart of nothing is a card with an axis in it.
  const toggleLine = (which: 'value' | 'lo' | 'hi') => {
    setLines((l) => {
      const next = { ...l, [which]: !l[which] };
      if (!next.value && !next.lo && !next.hi) return l;
      Haptics.selectionAsync().catch(() => {});
      return next;
    });
  };

  const pills: PillItem<SeriesKey>[] = SERIES.map((entry) => ({
    key: entry.key,
    icon: entry.icon,
    label: ta(entry.labelKey, prefs.lang),
  }));

  const refreshControl = useRefreshControl(measurements.refetch);

  /** The reader's own units, for the axis and the cursor alike. */
  const format = (v: number): string => {
    switch (key) {
      case 'temp': return `${fmtTempValue(v, prefs.tempUnit)}°`;
      case 'precip': return `${fmtMm(v)} mm`;
      case 'humidity': return `${Math.round(v)}%`;
      case 'wind': return `${fmtWindValue(v, prefs.windUnit)} ${windUnitLabel(prefs.windUnit)}`;
      // A bearing reads as the compass point it is, not as a number of degrees.
      case 'windDir': return degToCompass(v);
      case 'radiation': return `${Math.round(v)} W/m²`;
    }
  };

  const unit =
    key === 'temp' ? tempUnitLabel(prefs.tempUnit)
    : key === 'precip' ? 'mm'
    : key === 'humidity' ? '%'
    : key === 'windDir' ? ''
    : key === 'radiation' ? 'W'
    : '';

  // Clock times where a sample is a moment, dates where it is a day: a thirty-day
  // chart labelled 00:00 six times says nothing at all.
  const axisLabel = (s: Sample) =>
    byDay ? shortDay(s.key, prefs.lang) : s.key.slice(11, 16);
  const readLabel = (s: Sample) =>
    byDay
      ? shortDay(s.key, prefs.lang)
      : `${shortDay(s.key.slice(0, 10), prefs.lang)} ${s.key.slice(11, 16)}`;

  const loading = !model || (measurements.isLoading && !!station);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: space[5],
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
        gap: space[4],
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <LocationTitle />

      {/* On the page, like everything under it. Two cards held the page's two
          questions apart, and then the second one came out to give the chart its
          width — which left one card floating over a page of bare content. The
          headings do the separating now, which is what headings are for. */}
      <View style={{ gap: space[3] }}>
        <CardHeader label={ta('period', prefs.lang)} />
        <RangeSelector
          range={range}
          preset={preset}
          maxDay={maxDay}
          onPreset={(days) => {
            setPreset(days);
            setRange(presetRange(days));
          }}
          onRange={(next) => {
            // Dates of the reader's own choosing: the preset row lets go of its
            // highlight rather than claiming to describe a window it did not set.
            setPreset(null);
            setRange(next);
          }}
        />
      </View>

      {/* Not a card. A chart inside one is inset three times over — the page's own
          margin, the card's, and the room the chart keeps for its axis labels — and
          on a phone that is a fifth of the width spent on nothing. Out here it uses
          the page, and the plot itself reaches the screen's edges. */}
      <View>
        {/* The measurement lives with its chart, not in the card above: that one is
            about *when*, this one about *what*, and the switcher belongs to the thing
            it changes. No heading over it — six labelled pills are not a list that
            needs to be told what it is. */}
        <PillSwitcher items={pills} active={key} onChange={setKey} />

        <View style={{ paddingTop: space[4] }}>
          <CardHeader label={ta(RESOLUTION_LABEL[series.resolution], prefs.lang)} />
        </View>

        {phase === 'loading' && loading ? (
          <View style={{ paddingVertical: space[8], alignItems: 'center' }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <>
            {series.stats && meta.summary !== 'none' ? (
              <View style={{ flexDirection: 'row', gap: space[5], paddingBottom: space[3] }}>
                {meta.summary === 'total' ? (
                  <>
                    <Stat label={ta('total', prefs.lang)} value={format(series.stats.total)} />
                    <Stat
                      // "Piekuur" is wrong of a ten-minute sample and of a day, and
                      // the peak is the same idea at all three grains.
                      label={ta(PEAK_LABEL[series.resolution], prefs.lang)}
                      value={format(series.stats.max)}
                    />
                  </>
                ) : meta.summary === 'wind' ? (
                  <>
                    {/* A minimum wind speed is a number nobody acts on; the strongest
                        gust is the one a grower spraying tomorrow reads for. */}
                    <Stat label={ta('average', prefs.lang)} value={format(series.stats.avg)} />
                    <Stat label={ta('maxWind', prefs.lang)} value={format(series.stats.max)} />
                    {series.stats.secondaryMax != null ? (
                      <Stat
                        label={ta('maxGust', prefs.lang)}
                        value={format(series.stats.secondaryMax)}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    {/* Just "Min" and "Max": the quantity is named on the pill above
                        and again on the axis, and "Min temperatuur" over a chart of
                        temperatures says it a third time. */}
                    <Stat label={ta('statMin', prefs.lang)} value={format(series.stats.min)} />
                    <Stat label={ta('average', prefs.lang)} value={format(series.stats.avg)} />
                    <Stat label={ta('statMax', prefs.lang)} value={format(series.stats.max)} />
                  </>
                )}
              </View>
            ) : null}

            {/* Out past the page's own margin, to the screen's edges. The chart
                keeps its own room for the axis labels and needs no second margin
                inside a third; every point given back here is a point of plot. */}
            <View style={{ marginHorizontal: -space[5], paddingBottom: space[3] }}>
              <SeriesChart
                samples={series.samples}
                shape={meta.shape}
                color={color}
                unit={unit}
                axisLabel={axisLabel}
                readLabel={readLabel}
                format={format}
                // Gusts belong above the wind line and nowhere else: on temperature
                // the secondary would be an unlabelled second reading.
                secondaryLabel={key === 'wind' ? '⤴' : undefined}
                axisMin={meta.axisMin}
                axisMax={meta.axisMax}
                axisFixed={meta.axisFixed}
                showValue={!hasEdges || lines.value}
                showBandLo={hasEdges && lines.lo}
                showBandHi={hasEdges && lines.hi}
                bandLoColor={edgeInk.lo}
                bandHiColor={edgeInk.hi}
                // A bearing's axis reads N · O · Z · W · N, which needs four gaps to
                // land on the cardinal points rather than between them.
                formatAxis={key === 'windDir' ? degToCompass : undefined}
                gridLines={key === 'windDir' ? 4 : undefined}
                showCumulative={meta.shape === 'bar' && showCumulative}
                cumulativeLabel={ta('cumulative', prefs.lang)}
                cumulativeColor={palette.inkHeading}
                background={palette.appBg}
                emptyLabel={ta('noSeries', prefs.lang)}
              />
            </View>

            {/* What the chart is made of, and mostly the switches for it: the
                running total on rainfall, and on a banded series each of its three
                lines. What is not a switch is the dashed style note, and the sentence
                for a location with no instrument — which needs the room to wrap under
                the entries beside it. */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                flexWrap: 'wrap', columnGap: space[3], rowGap: space[2],
              }}
            >
              {meta.shape === 'bar' ? (
                <Legend
                  color={palette.inkHeading}
                  label={ta('cumulative', prefs.lang)}
                  on={showCumulative}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setShowCumulative((v) => !v);
                  }}
                />
              ) : null}

              {/* The central line. Named for what it is on this location: an
                  instrument's reading where one exists, and the model's own figure
                  where it does not. */}
              {hasEdges ? (
                <Legend
                  color={color}
                  label={ta(series.anyMeasured ? 'measured' : 'computed', prefs.lang)}
                  on={lines.value}
                  onPress={() => toggleLine('value')}
                />
              ) : series.anyMeasured ? (
                <Legend color={color} label={ta('measured', prefs.lang)} />
              ) : null}

              {hasEdges ? (
                <>
                  <Legend
                    color={edgeInk.lo}
                    label={ta('statMin', prefs.lang)}
                    on={lines.lo}
                    onPress={() => toggleLine('lo')}
                  />
                  <Legend
                    color={edgeInk.hi}
                    label={ta('statMax', prefs.lang)}
                    on={lines.hi}
                    onPress={() => toggleLine('hi')}
                  />
                </>
              ) : null}

              {/* A style note, not a switch: it says which half of a line is which,
                  and there is no half to turn off. */}
              {series.forecastFrom >= 0 ? (
                <Legend color={color} label={ta('forecastPart', prefs.lang)} dashed />
              ) : null}

              {series.anyMeasured ? null : (
                <Text variant="caption" color={palette.muted} style={{ flexShrink: 1 }}>
                  {/* One sentence, whatever window is on screen. The reader's problem
                      is the same either way — this location has no instrument, so a
                      day is as far back as the chart can go — and saying it two
                      different ways made it read as two different limitations. */}
                  {ta('graphNoStation', prefs.lang)}
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

/** "14 jun" — the month name in the app's language, from a `YYYY-MM-DD` key. */
function shortDay(day: string, lang: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return day;
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** One figure summarising the window on screen. */
function Stat({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text
        variant="caption"
        weight="bold"
        color={palette.muted}
        style={{ letterSpacing: 0.5, textTransform: 'uppercase', fontSize: 10 }}
      >
        {label}
      </Text>
      <Text variant="label" color={palette.appValue} tabular>
        {value}
      </Text>
    </View>
  );
}

/**
 * A line style, named — and, where it is given an `onPress`, the switch for it.
 *
 * Switched off it keeps its place and dims, both the rule and the word, so the way
 * back is exactly where the way out was. A legend entry that vanished when you used
 * it would be a control you could turn off once.
 */
function Legend({
  color, label, dashed, on = true, onPress,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  on?: boolean;
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16, height: 0,
          borderTopWidth: 2,
          borderTopColor: on ? color : palette.inkDisabled,
          borderStyle: dashed ? 'dashed' : 'solid',
          opacity: dashed ? 0.7 : 1,
        }}
      />
      <Text variant="caption" color={on ? palette.muted : palette.inkDisabled}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
    >
      {row}
    </Pressable>
  );
}

/**
 * The route: the shared chrome, wrapped around the page above.
 *
 * `ScreenFrame` takes the component rather than its output, because the pager behind
 * it invokes one copy per location — see `LocationPager`.
 */
export default function GraphScreen() {
  return <ScreenFrame page={GraphPage} />;
}
