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
 * ## The band around the forecast
 *
 * Temperature, rainfall and wind carry the ensemble's p10–p90 over the forecast half.
 * A forecast line on its own claims a precision the model does not have, and the 51
 * members are what the app already carries to say where that claim is weak; the day
 * sheets show them a day at a time, and this is the same spread over whatever window
 * the reader picked.
 *
 * Where it goes is a different answer per quantity and per grain, and the reasoning
 * sits beside the code that decides it (`spread`). In short: temperature and wind per
 * hour behind the line, and per day behind the minimum and the maximum rather than the
 * mean; rainfall per hour on the running total alone, because an hour's band is too
 * small to read against an axis scaled to the wettest hour; rainfall per day on both
 * the bars and the total.
 *
 * Only the forecast half. A band around a measurement would say the thermometer might
 * have read something else. And the running total's band only over the part of the
 * line the members are the siblings of: the first 48 hours are the near-term run, and
 * accumulating ECMWF members over a HARMONIE total is an error that every later point
 * inherits. See `cumulativeBands`.
 *
 * It arrives separately from the line and may not arrive at all, so it is handed to
 * the chart as a parallel array rather than carried on the samples: the chart draws
 * as soon as the series is ready and takes the band when it lands. The legend switch
 * appears with it, for the same reason the others are switches — three claims over
 * one line is a lot of ink for a reader who came to look at one of them.
 *
 * The percentiles are taken at the grain the chart draws, never aggregated after the
 * fact. That is the one subtle thing in the whole feature; `core/model/ensembleBand`
 * has the reasoning.
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
 * heading, twice, and then the chart under a third.
 *
 * What separates the three is space, and there is plenty of it here: see
 * `SECTION_GAP`.
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
import { Columns, usePagePadding } from '../../ui/layout';
import { CardHeader } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { usePeeking } from '../../ui/peek';
import { SeriesChart, type ChartSpread } from '../../ui/graph/SeriesChart';
import { useEnsembleMembers } from '../../ui/graph/useEnsembleBand';
import { PillSwitcher, type PillItem } from '../../ui/PillSwitcher';
import {
  SOIL_SERIES_META, buildSoilSeries, soilSeriesKeys, type SoilSeriesKey,
} from '../../core/model/soilSeries';
import { soilThresholdSteps } from '../../core/model/indicators';
import { SOIL_STEP_MIN } from '../../core/sources/agroexact';
import type { IconName } from '../../ui/Icon';
import {
  DEFAULT_PRESET, presetRange, RangeSelector,
  type DateRange, type PresetDays,
} from '../../ui/graph/RangeSelector';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useLocationStation, useStationRange } from '../../state/stations';
import { useLocationSoil, useSoilRange } from '../../state/soilStations';
import {
  buildSeries, dayKey, daySpan, forecastHorizon, SERIES_META,
  type Sample, type SeriesKey,
} from '../../core/model/series';
import {
  bandsFrom, bandsForSamples, cumulativeBands, memberBuckets, type BandField,
} from '../../core/model/ensembleBand';
import {
  degToCompass, fmtDecimal, fmtMm, fmtTempValue, fmtWindValue, tempUnitLabel, windUnitLabel, ta,
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
/**
 * What the pill row can be showing.
 *
 * Weather and soil are two builders behind one row, because to the reader they are
 * one question — what has this place been doing — and two switchers would be two
 * places to look. `isSoilKey` is the only branch; everything downstream reads the
 * `Series` that both builders produce.
 */
export type ChartKey = SeriesKey | SoilSeriesKey;

const isSoilKey = (k: ChartKey): k is SoilSeriesKey => k in SOIL_SERIES_META;

/** The soil pills, in the order the plan lists their blocks. */
const SOIL_PILLS: Record<SoilSeriesKey, { labelKey: AppStringKey; icon: IconName }> = {
  waterTension: { labelKey: 'soilTension', icon: 'drop-half' },
  pF: { labelKey: 'soilPf', icon: 'chart-line' },
  waterPercent: { labelKey: 'soilWaterPercent', icon: 'drop' },
  refillMm: { labelKey: 'soilRefillRoom', icon: 'drop' },
  soilTemp: { labelKey: 'soilTemp', icon: 'thermometer-simple' },
  temp10: { labelKey: 'soilTemp10', icon: 'thermometer-simple' },
  humidity10: { labelKey: 'soilHumidity10', icon: 'drop-half' },
};

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

/**
 * The quantities that carry an ensemble band, and what the legend calls it.
 *
 * Temperature, rainfall and wind: the three a grower plans around, and the three whose
 * spread changes a decision rather than decorating a line. They travel in one request,
 * so the set costs no more than any one of them. Humidity has members too — the day
 * sheets plot them — but nobody schedules work around the spread of a humidity
 * forecast, and gusts have no ensemble at all.
 *
 * Which of the chart's lines carries the band is decided per quantity and per grain,
 * in `chartSpread` below, because the answer is different in all four cases.
 */
const BAND_FIELD: Partial<Record<SeriesKey, BandField>> = {
  temp: 'temp', precip: 'precip', wind: 'wind',
};

/**
 * The page's vertical rhythm.
 *
 * A heading belongs to what is under it, so it sits close; the parts belong to each
 * other only in that they are on one page, so they sit far. Two numbers, used
 * everywhere, rather than a padding invented per element.
 *
 * `CardHeader` brings its own twelve points of room underneath, which is where the
 * inner figure comes from — a section is the heading and then its content, with no
 * gap of its own, or the two paddings stack into a step as big as the one that is
 * meant to separate whole sections.
 */
const SECTION_GAP = space[9];
const CONTENT_GAP = space[3];

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
  const pagePadding = usePagePadding();
  const peeking = usePeeking();

  const [preset, setPreset] = useState<PresetDays | null>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET));
  const [key, setKey] = useState<ChartKey>('temp');
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
  /** Whether the ensemble band is drawn. On by default: a forecast line without one
   *  claims a precision the model does not have, which is the reason it is here. */
  const [showSpread, setShowSpread] = useState(true);

  const station = useLocationStation(location);
  // A single day gets the station's raw readings; anything longer, the hourly
  // roll-up. See the note at the top.
  const fine = daySpan(range.from, range.to) === 1;
  // A page sliding past does not fetch a month of measurements for a location the
  // reader may not stop on; it draws the modelled series instead, which is already
  // in hand.
  const measurements = useStationRange(station?.id ?? null, offsetSec, range, !peeking, fine);

  // The soil sensor bound to this place, and its window. Same `fine` rule: a single
  // day gets the raw half-hourly records, anything longer the hourly roll-ups — which
  // withhold the last half hour, a second reason the day view wants the raw ones.
  const soil = useLocationSoil(location);
  const soilMeasurements = useSoilRange(
    soil.station?.id ?? null,
    soil.station?.depthCm ?? 0,
    offsetSec,
    range,
    !peeking && !!soil.station,
    fine
  );
  const soilRows = useMemo(() => soilMeasurements.data ?? [], [soilMeasurements.data]);

  const series = useMemo(
    () => {
      // Soil has no model behind it and nothing ahead of now, so it is its own
      // builder — see `core/model/soilSeries`. Both produce the same `Series`, which
      // is what lets everything below this line stay one path.
      if (isSoilKey(key)) {
        return buildSoilSeries({
          key, from: range.from, to: range.to, samples: soilRows,
          stepMinutes: fine && soilRows.length > 0 ? SOIL_STEP_MIN : 60,
        });
      }
      return buildSeries({
        key, from: range.from, to: range.to,
        measured: measurements.data ?? [], model, includeForecast: true,
        // Only where a station actually answered at that grain: the ten-minute grid
        // is worth its extra samples when they are filled, and is a row of gaps with
        // an hourly model behind it when they are not.
        stepMinutes: fine && (measurements.data?.length ?? 0) > 0 ? 10 : 60,
      });
    },
    [key, range.from, range.to, measurements.data, soilRows, model, fine]
  );

  // As far ahead as the model can be asked about.
  const today = dayKey(new Date());
  const maxDay = forecastHorizon(model) ?? today;

  /**
   * The members behind the band, for the forecast part of the window only.
   *
   * Clamped to today at the near end: a band around a measurement would say the
   * thermometer might have read something else. A window entirely in the past asks
   * for nothing at all, and so does a quantity that carries no band.
   */
  // A soil series has no ensemble behind it: nobody runs fifty members of a suction
  // measurement. So no band, and no request for one.
  const bandField = isSoilKey(key) ? undefined : BAND_FIELD[key];
  const ensemble = useEnsembleMembers({
    lat: location.lat,
    lon: location.lon,
    from: range.from > today ? range.from : today,
    to: range.to,
    enabled: !!bandField && !peeking && range.to >= today,
  });

  /**
   * The axis and the shape, from whichever table owns this quantity.
   *
   * Soil has no named edges — "the day's coldest and warmest" is a temperature idea,
   * and a day's driest hour of suction is not a number anyone plans around — so its
   * spread stays an area under the line rather than two lines with words under them.
   */
  const meta = isSoilKey(key)
    ? { ...SOIL_SERIES_META[key], summary: 'range' as const, edges: false }
    : SERIES_META[key];

  /** Only where the series has edges worth naming and something to draw them from. */
  const hasEdges = !!meta.edges && series.samples.some((s) => s.band != null);

  /**
   * Which of the chart's lines the band goes on — a different answer per quantity and
   * per grain.
   *
   * Percentiles are taken at the grain the chart draws, never aggregated after the
   * fact; `core/model/ensembleBand` has that argument.
   *
   * - **Temperature and wind per hour** — behind the line. The line *is* the forecast,
   *   and the band is how much the members disagree about it.
   * - **Temperature and wind per day** — behind the minimum and the maximum, not the
   *   mean. The spread of a daily average is narrow by construction and nobody plans
   *   around it; the spread of the coldest hour answers "could it freeze tonight", and
   *   of the windiest "can I spray", which is what a week of either is read for.
   *   Temperature draws those two as named lines in their own colours and wind as the
   *   top and bottom of one band, which changes how they are drawn and not what they
   *   are — so both take the same pair.
   * - **Rainfall per hour** — on the running total only. An hour's band is a few
   *   millimetres tall on an axis scaled to the wettest hour of the window, which is
   *   a whisker too small to read; the total is where an hourly disagreement becomes
   *   a difference a reader can see.
   * - **Rainfall per day** — both. A day's bars are tall enough to carry a whisker,
   *   and the total still answers the question the bars cannot.
   */
  const spread: ChartSpread | null = useMemo(() => {
    if (!bandField || !ensemble.data) return null;
    const res = series.resolution;
    const perDay = res === 'day';

    if (bandField === 'precip') {
      const buckets = memberBuckets(ensemble.data, 'precip', res);
      return {
        bars: perDay
          ? bandsForSamples(bandsFrom(buckets, 0), series.samples, res)
          : null,
        // Only across the part of the line the members are actually the siblings of.
        // See `cumulativeBands`.
        cumulative: cumulativeBands(buckets, series.samples, res, (s) => s.source === 'ifs'),
      };
    }

    // Temperature and wind are the same picture: one line per bucket, with the day's
    // own extremes as its edges. The floor is the field's, so a wind band cannot run
    // below zero.
    const floor = bandField === 'wind' ? 0 : undefined;
    const edge = (stat: 'min' | 'max') =>
      bandsForSamples(
        bandsFrom(memberBuckets(ensemble.data!, bandField, res, stat), floor),
        series.samples, res
      );

    if (perDay) {
      // Following the lines that are actually drawn: temperature's two edges are
      // switchable and wind's are simply the top and bottom of its band.
      return {
        lo: !hasEdges || lines.lo ? edge('min') : null,
        hi: !hasEdges || lines.hi ? edge('max') : null,
      };
    }

    return {
      value: bandsForSamples(
        bandsFrom(memberBuckets(ensemble.data, bandField, res), floor),
        series.samples, res
      ),
    };
  }, [bandField, ensemble.data, hasEdges, lines.lo, lines.hi, series.resolution, series.samples]);

  // The switch appears only where something would actually be drawn. On rainfall per
  // hour the band lives on the running total alone, so with the total switched off
  // there is nothing for a spread switch to do.
  const drawnSlots = spread
    ? [spread.value, spread.lo, spread.hi, spread.bars, showCumulative ? spread.cumulative : null]
    : [];
  const hasSpread = drawnSlots.some((slot) => slot?.some(Boolean));

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
  // Soil takes the station green: it is the app's mark for an instrument, and every
  // soil sample is one. Within soil the quantities are told apart by the pill and the
  // axis, not by six more hues.
  const color = isSoilKey(key)
    ? palette.agroInk
    : SERIES.find((s) => s.key === key)?.color(colors) ?? palette.accent;

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


  // One line has to stay: a chart of nothing is a card with an axis in it.
  const toggleLine = (which: 'value' | 'lo' | 'hi') => {
    setLines((l) => {
      const next = { ...l, [which]: !l[which] };
      if (!next.value && !next.lo && !next.hi) return l;
      Haptics.selectionAsync().catch(() => {});
      return next;
    });
  };

  /**
   * Which soil quantities this sensor can draw, from what it actually reported.
   *
   * The sensor's model decides which probes exist and the window decides whether they
   * said anything — see `soilSeriesKeys`. On a location with no sensor there are none
   * and the row is the six it has always been.
   */
  const soilKeys = useMemo(
    () => soilSeriesKeys(soil.station?.type, soilRows),
    [soil.station?.type, soilRows]
  );

  const pills: PillItem<ChartKey>[] = [
    ...SERIES.map((entry) => ({
      key: entry.key as ChartKey,
      icon: entry.icon,
      label: ta(entry.labelKey, prefs.lang),
    })),
    ...soilKeys.map((k) => ({
      key: k as ChartKey,
      icon: SOIL_PILLS[k].icon,
      label: ta(SOIL_PILLS[k].labelKey, prefs.lang),
    })),
  ];

  // Swiping to a location without that sensor must not leave the page on a pill that
  // is no longer there — an empty chart with a selected pill reads as a failure.
  useEffect(() => {
    if (isSoilKey(key) && !soilKeys.includes(key)) setKey('temp');
  }, [key, soilKeys]);

  /**
   * The field's own thresholds, as lines across the plot.
   *
   * Step 2's prop, and suction is its first caller: the indicator already knows these
   * boundaries, so nothing here computes a band. They are the placement's frozen set,
   * which is why a chart drawn over a move will step them rather than run one line
   * across both halves.
   */
  const thresholds = useMemo(() => {
    if (key !== 'waterTension' || !soil.placement) return null;
    const ink: Record<number, string> = {
      1: palette.valSun, 2: palette.valTemp, 3: palette.valHigh,
    };
    return soilThresholdSteps(soil.placement.thresholds).map((t) => ({
      at: t.at,
      color: ink[t.level] ?? palette.valHigh,
      label: `${fmtDecimal(t.at)}`,
      shade: true,
    }));
  }, [key, soil.placement, palette]);

  // Both windows, because the pill row is one row: pulling down on a suction chart
  // that only refetched the weather would look like a refresh that did nothing.
  const refreshControl = useRefreshControl(async () => {
    await Promise.all([measurements.refetch(), soilMeasurements.refetch()]);
  });

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
      // Suction is kPa on every side of this: the thresholds, the web app and the
      // sensor are all in it, and there is no reader unit to convert to.
      case 'waterTension': return `${fmtDecimal(v)} kPa`;
      // A logarithm with no unit, to two decimals — its whole range is 0 to 4,2.
      case 'pF': return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
      case 'waterPercent': return `${fmtDecimal(v)} vol-%`;
      case 'refillMm': return `${fmtMm(v)} mm`;
      // A soil temperature is a temperature: it converts like any other.
      case 'soilTemp':
      case 'temp10': return `${fmtTempValue(v, prefs.tempUnit)}°`;
      case 'humidity10': return `${Math.round(v)}%`;
    }
  };

  const unit =
    key === 'temp' ? tempUnitLabel(prefs.tempUnit)
    : key === 'precip' ? 'mm'
    : key === 'humidity' ? '%'
    : key === 'windDir' ? ''
    : key === 'radiation' ? 'W'
    : key === 'waterTension' ? 'kPa'
    : key === 'waterPercent' ? '%'
    : key === 'refillMm' ? 'mm'
    : key === 'soilTemp' || key === 'temp10' ? tempUnitLabel(prefs.tempUnit)
    : key === 'humidity10' ? '%'
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
        ...pagePadding,
        paddingTop: TOP_BAR_CLEARANCE + insets.top,
        // The step between the page's three parts. It was 14 against an internal 12,
        // which is not a step at all: a heading sat as far from the section above it
        // as from its own content, and the three read as one long column. Twice the
        // internal gap is what makes them three.
        gap: SECTION_GAP,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <Columns spanning={1} spanningEnd={1}>
        <LocationTitle />

        {/* On the page, like everything under it. Two cards held the page's questions
            apart, and then the second came out to give the chart its width — which left
            one card floating over a page of bare content. The headings and the space
            between them do the separating now, which is what both are for. */}
        <View>
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

        {/* Its own part of the page, not an appendage of the chart: what to plot is a
            question of the same weight as over what period. */}
        <View>
          <CardHeader label={ta('measurement', prefs.lang)} />
          <PillSwitcher items={pills} active={key} onChange={setKey} />
        </View>

        {/* Not a card. A chart inside one is inset three times over — the page's own
            margin, the card's, and the room the chart keeps for its axis labels — and
            on a phone that is a fifth of the width spent on nothing. Out here it uses
            the page, and the plot itself reaches the screen's edges. */}
        <View>
          <CardHeader label={ta(RESOLUTION_LABEL[series.resolution], prefs.lang)} />

          {phase === 'loading' && loading ? (
            <View style={{ paddingVertical: space[8], alignItems: 'center' }}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : (
            <View style={{ gap: CONTENT_GAP }}>
              {series.stats && meta.summary !== 'none' ? (
                <View style={{ flexDirection: 'row', gap: space[5] }}>
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
              <View style={{ marginHorizontal: -space[5] }}>
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
                  spread={showSpread ? spread : null}
                  spreadLabel={ta('spread', prefs.lang)}
                  thresholds={thresholds}
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

                {/* Only once there is a band to talk about. A switch for something
                    that has not loaded is a switch that does nothing, and one for a
                    quantity that never bands is a promise the page cannot keep. */}
                {hasSpread ? (
                  <Legend
                    color={color}
                    label={ta('spread', prefs.lang)}
                    on={showSpread}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setShowSpread((v) => !v);
                    }}
                  />
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
            </View>
          )}
        </View>
      </Columns>
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
