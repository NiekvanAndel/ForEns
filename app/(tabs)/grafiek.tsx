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
 * On a location an AgroExact station speaks for, the station's own hourly record,
 * running on into the forecast past the current hour. Everywhere else the same
 * chart from the weather model alone. `core/model/series` assembles that and marks
 * every sample with where it came from; the chart draws measurement solid and
 * forecast dashed, and never joins the two into one line. See `SeriesChart`.
 *
 * A window longer than a few days is bucketed into days there too — the line becomes
 * each day's mean with its range behind it, and rainfall becomes each day's total.
 * The heading says which of the two is on screen, because "3,4 mm" means different
 * things per hour and per day.
 *
 * ## The gesture
 *
 * Two horizontal drags live on this page: the pager's, which changes location, and
 * the chart's, which reads a value. The chart claims sideways movement at six points
 * and the pager waits for eighteen, so a drag that starts on the chart reads the
 * chart and a drag that starts anywhere else changes location.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { radius, space, useTheme } from '../../theme';
import { Card, CardHeader } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { TAB_BAR_CLEARANCE } from '../../ui/GlassTabBar';
import { TOP_BAR_CLEARANCE } from '../../ui/TopBar';
import { LocationTitle } from '../../ui/LocationTitle';
import { ScreenFrame } from '../../ui/ScreenFrame';
import { useRefreshControl } from '../../ui/useRefreshControl';
import { usePeeking } from '../../ui/peek';
import { SeriesChart } from '../../ui/graph/SeriesChart';
import {
  DEFAULT_PRESET, presetRange, RangeSelector,
  type DateRange, type PresetDays,
} from '../../ui/graph/RangeSelector';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useLocationStation, useStationRange } from '../../state/stations';
import { buildSeries, SERIES_META, type Sample, type SeriesKey } from '../../core/model/series';
import {
  fmtMm, fmtTempValue, fmtWindValue, tempUnitLabel, windUnitLabel, ta,
  type AppStringKey,
} from '../../core/i18n';

/** The four measurements the selector offers, in the order it shows them. */
const SERIES: { key: SeriesKey; labelKey: AppStringKey; color: (p: PageColors) => string }[] = [
  { key: 'temp', labelKey: 'temperature', color: (p) => p.temp },
  { key: 'precip', labelKey: 'rainLastHour', color: (p) => p.precip },
  { key: 'humidity', labelKey: 'humidity', color: (p) => p.humidity },
  { key: 'wind', labelKey: 'windNow', color: (p) => p.wind },
];

interface PageColors { temp: string; precip: string; humidity: string; wind: string }

function GraphPage() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { model, offsetSec, phase } = useForecast();
  const insets = useSafeAreaInsets();
  const peeking = usePeeking();

  const [preset, setPreset] = useState<PresetDays | null>(DEFAULT_PRESET);
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET));
  const [key, setKey] = useState<SeriesKey>('temp');

  const station = useLocationStation(location);
  // A page sliding past does not fetch a month of measurements for a location the
  // reader may not stop on; it draws the modelled series instead, which is already
  // in hand.
  const measurements = useStationRange(station?.id ?? null, offsetSec, range, !peeking);

  const series = useMemo(
    () => buildSeries({ key, from: range.from, to: range.to, measured: measurements.data ?? [], model }),
    [key, range.from, range.to, measurements.data, model]
  );

  const meta = SERIES_META[key];
  const colors: PageColors = {
    temp: palette.valTemp, precip: palette.valPrecip,
    humidity: palette.accentDark, wind: palette.valWind,
  };
  const color = SERIES.find((s) => s.key === key)?.color(colors) ?? palette.accent;

  const refreshControl = useRefreshControl(measurements.refetch);

  /** The reader's own units, for the axis and the cursor alike. */
  const format = (v: number): string => {
    switch (key) {
      case 'temp': return `${fmtTempValue(v, prefs.tempUnit)}°`;
      case 'precip': return `${fmtMm(v)} mm`;
      case 'humidity': return `${Math.round(v)}%`;
      case 'wind': return `${fmtWindValue(v, prefs.windUnit)} ${windUnitLabel(prefs.windUnit)}`;
    }
  };

  const unit =
    key === 'temp' ? tempUnitLabel(prefs.tempUnit)
    : key === 'precip' ? 'mm'
    : key === 'humidity' ? '%'
    : '';

  // Hours read as clock times, days as dates: a thirty-day chart labelled 00:00 six
  // times says nothing at all.
  const axisLabel = (s: Sample) =>
    series.resolution === 'hour' ? s.key.slice(11, 16) : shortDay(s.key, prefs.lang);
  const readLabel = (s: Sample) =>
    series.resolution === 'hour'
      ? `${shortDay(s.key.slice(0, 10), prefs.lang)} ${s.key.slice(11, 16)}`
      : shortDay(s.key, prefs.lang);

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

      <Card style={{ gap: space[4] }}>
        <View style={{ gap: space[3] }}>
          <CardHeader label={ta('period', prefs.lang)} />
          <RangeSelector
            range={range}
            preset={preset}
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

        <View style={{ gap: space[3] }}>
          <CardHeader label={ta('measurement', prefs.lang)} />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {SERIES.map((s) => {
              const on = s.key === key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setKey(s.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: radius.pill,
                    alignItems: 'center',
                    backgroundColor: on ? s.color(colors) : palette.surfaceAlt,
                  }}
                >
                  <Text
                    variant="caption"
                    weight="bold"
                    color={on ? palette.appCard : palette.inkHeading}
                    numberOfLines={1}
                  >
                    {ta(s.labelKey, prefs.lang)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card pad={0}>
        <View style={{ padding: space[4], paddingBottom: 0 }}>
          <CardHeader
            label={
              series.resolution === 'day' ? ta('perDay', prefs.lang) : ta('perHour', prefs.lang)
            }
          />
        </View>

        {phase === 'loading' && loading ? (
          <View style={{ paddingVertical: space[8], alignItems: 'center' }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <>
            {series.stats ? (
              <View
                style={{
                  flexDirection: 'row', gap: space[5],
                  paddingHorizontal: space[4], paddingBottom: space[3],
                }}
              >
                {meta.summary === 'total' ? (
                  <>
                    <Stat label={ta('total', prefs.lang)} value={format(series.stats.total)} />
                    <Stat
                      label={ta(series.resolution === 'day' ? 'peakDay' : 'peakHour', prefs.lang)}
                      value={format(series.stats.max)}
                    />
                  </>
                ) : (
                  <>
                    <Stat label={ta('tempMin', prefs.lang)} value={format(series.stats.min)} />
                    <Stat label={ta('average', prefs.lang)} value={format(series.stats.avg)} />
                    <Stat label={ta('tempMax', prefs.lang)} value={format(series.stats.max)} />
                  </>
                )}
              </View>
            ) : null}

            <View style={{ paddingHorizontal: space[3], paddingBottom: space[3] }}>
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
                emptyLabel={ta('noSeries', prefs.lang)}
              />
            </View>

            {/* What the chart is made of. On a station-backed location this is a
                legend for the two line styles; everywhere else it is the whole
                answer to "where do these numbers come from". */}
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space[3],
                paddingHorizontal: space[4], paddingBottom: space[4],
              }}
            >
              {series.anyMeasured ? (
                <>
                  <Legend color={color} label={ta('measured', prefs.lang)} />
                  <Legend color={color} label={ta('forecastPart', prefs.lang)} dashed />
                </>
              ) : (
                <Text variant="caption" color={palette.muted} style={{ flexShrink: 1 }}>
                  {ta('graphModelled', prefs.lang)}
                </Text>
              )}
            </View>
          </>
        )}
      </Card>
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

/** A line style, named. */
function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 16, height: 0,
          borderTopWidth: 2,
          borderTopColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
          opacity: dashed ? 0.7 : 1,
        }}
      />
      <Text variant="caption" color={palette.muted}>
        {label}
      </Text>
    </View>
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
