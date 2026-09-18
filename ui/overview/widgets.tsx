/**
 * The overview page's widgets.
 *
 * One component per entry in `OVERVIEW_WIDGETS`, all reading the same `OverviewRow[]`
 * the page builds once. None of them fetches anything: the page knows which sources
 * the arrangement justifies and loads those, and a widget draws whatever has landed.
 *
 * ## Space is the constraint, not data
 *
 * A grower with eight fields scrolling past eight lines of "0,0 mm" learns that the
 * rainfall widget is mostly noise, and stops reading it on the morning it is not. So
 * a widget shows the locations that clear its own bar and closes with one line
 * counting the rest — shorter *and* more informative, because "and five others dry"
 * is a fact where five zeroes are a list. `notableRows` is the shared shape of that;
 * each widget picks its own bar, because worth mentioning means something different
 * for rainfall than for frost.
 *
 * Almost every reading carries a small mark beside it — a sparkline, a ring, a band —
 * because a figure says one thing and a figure with the shape of the day behind it
 * says three. See `./marks`.
 *
 * ## Every line is a way in
 *
 * A summary that cannot be acted on is a poster. So a location's line goes to that
 * location — selecting it and opening the page the widget is about, which for a
 * rainfall ranking is 'Grafiek' and for an outlook is 'Verwachting'. That is the
 * difference between a page you glance at and a page you start the day on.
 *
 * ## Units
 *
 * The rows are canonical — °C, km/h, mm — and every widget converts where it draws,
 * exactly as the rest of the app does. A grower reading m/s on the map and km/h here
 * would rightly wonder which one the app believes.
 */
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { ConditionsHero } from '../nowcast/ConditionsHero';
import { HourSlider } from '../nowcast/HourSlider';
import { ForecastPreview } from '../nowcast/ForecastPreview';
import { RadarPreview } from '../nowcast/RadarPreview';
import { NowcastPanel } from '../radar/NowcastPanel';
import { frameAtFraction, useRadarFrames } from '../radar/useRadarFrames';
import {
  LocationLine, Reading, Sentence, StackedLine, WidgetCard, WidgetNote,
  type SentenceValue,
} from './parts';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { useAgroAuth } from '../../state/auth';
import type { LocationSoil } from '../../state/soilStations';
import type { LocationDisease } from '../../state/disease';
import { worstPerLocation, type LocationAdvice } from '../../core/overviewFieldAdvice';
import { adviceReason, adviceTitle, FAMILY_LABEL } from '../advice/words';
import type { AreaConclusion } from '../../core/areaConclusions';
import type { RiskStatement, Rung } from '../../core/riskLadder';
import {
  certaintyOpacity, workableShare, type DayWindow,
} from '../../core/dayWindows';
import { rankFieldsByDryness, type SoilStatus } from '../../core/model/soil';
import { soilStatusBg, soilStatusInk } from '../soilStatusInk';
import { agroIntegration } from '../../core/prefs';
import { greetingFor, greetingName, type GreetingKind } from '../../core/greeting';
import { alertValueLabel } from '../settings/UserAlertList';
import { measurementTimeLabel } from '../../core/model/station';
import {
  firstWorkRun, notableRows, rankRows, spreadOf, workWindow, type OverviewRow,
} from '../../core/overviewData';
import { dayAgreement } from '../../core/sources/ensembleOutlook';
import { resolveWidgetLocation, type WidgetSettings } from '../../core/overview';
import {
  activeProvider, forecastBoundary, frameClock, radarAxis, type NowcastProfile,
} from '../../core/radar';
import type { ForecastModel } from '../../core/model/types';
import { adviceFor, isOpportunity } from '../../core/overviewAdvice';
import { briefFor, type Brief } from '../../core/overviewBrief';
import { BarSpark, LineSpark, RestLine, Ring, SpreadBand } from './marks';
import type { WeatherAlert } from '../../core/model/alert';
import {
  convTemp, convWind, dayNames, fmtDecimal, fmtMm, ta, tempUnitLabel, windUnitLabel,
  type AppStringKey,
} from '../../core/i18n';

export interface WidgetProps {
  rows: OverviewRow[];
  /** Every saved location that has a soil sensor, with its latest reading. Empty on an
   *  account with none, and while the source is switched off. */
  fields: LocationSoil[];
  /** The disease models that apply at each saved location. Empty where none do, and
   *  while the source is switched off. */
  disease: LocationDisease[];
  /** The four rule-based families per saved location, in row order. Empty while the
   *  sources they read are switched off. */
  advice: LocationAdvice[];
  /** AgroIntelligence. All three are empty with the tier off — nothing is computed
   *  and nothing is fetched for them. See `TierAccess` in `core/overview`. */
  area: AreaConclusion[];
  risk: RiskStatement[];
  windows: { index: number; name: string; days: DayWindow[] }[];
  /** One per row, in the same order; null where nothing is worth saying. */
  alerts: (WeatherAlert | null)[];
  /** The observation model per saved location, same order again. What a widget
   *  pinned to a location other than the selected one draws from. */
  models: (ForecastModel | null)[];
  /** And its rain profile, for the same reason. */
  nowcasts: (NowcastProfile | null)[];
  /** What this widget is set to, defaults already filled in. */
  settings: WidgetSettings;
  /** Selects a location and leaves the page. */
  onOpen: (index: number, page: 'index' | 'forecast' | 'grafiek' | 'actueel') => void;
}

/**
 * Which saved location a `scope: 'location'` widget is drawing, and whether that is
 * the one the rest of the app is on.
 *
 * The distinction is the whole of the difference between the two data paths. The
 * selected location has a full staged model behind it — a fortnight of forecast, the
 * ensemble, the nowcast — because the tabs behind this page loaded it. Any other has
 * only what this page fetches for every location: observations and a rain profile.
 * Enough for a hero, a radar square and a curve; not enough for a week, which is why
 * the week has no location control.
 */
function useWidgetLocation(settings: WidgetSettings) {
  const { prefs } = usePrefs();
  const index = resolveWidgetLocation(settings, prefs.activeLocation, prefs.locations.length);
  return {
    index,
    location: prefs.locations[index] ?? prefs.locations[0]!,
    selected: index === prefs.activeLocation,
  };
}

/** Which string greets which part of the day. Here rather than in `core/greeting`,
 *  because that module returns facts and this file words them. */
const GREETING_KEY: Record<GreetingKind, AppStringKey> = {
  night: 'greetNight',
  morning: 'greetMorning',
  afternoon: 'greetAfternoon',
  evening: 'greetEvening',
};

// ── The page in sentences ─────────────────────────────────────────────────────

/**
 * Agro Intelligence: two or three sentences that say what the fields are doing.
 *
 * It opened with a figure and a place — "7,2 mm · Almkerk" — over two clipped lines.
 * A figure is quick to draw and slow to read: it says *what* without saying *of
 * what*, so the eye has to fetch the heading back to use it. A sentence carries its
 * own subject, and the numbers in it can still be the bold thing the eye lands on.
 *
 * Which sentences apply is `core/overviewBrief`; this only words them, and converts
 * their figures into whatever the reader set. Most mornings two or three of the seven
 * are true, which is the point: a brief that always says six things says none.
 */
export function SummaryWidget({ rows, alerts, nowcasts }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const { account } = useAgroAuth();

  // The live account where the context has caught up, the stored name where it has
  // not — this widget is usually the first thing drawn after a cold start, and a
  // greeting that appears a second late is worse than one that was always there.
  const who = greetingName(account?.name ?? agroIntegration(prefs).accountName ?? null);
  const greeting = ta(GREETING_KEY[greetingFor()], prefs.lang);

  // The warnings and the thresholds are wherever they are already decided — the same
  // `deriveAlert` the block on 'Nu' runs, and the reader's own list — so the brief
  // repeats them rather than forming a second opinion under the widget holding the
  // first.
  const standing = rows
    .map((row, i) => ({ row, alert: alerts[i] ?? null }))
    .filter((x) => x.alert != null);
  const brief = briefFor(rows, nowcasts, {
    warnings: standing.map((x) => x.alert!.label),
    rules: prefs.userAlerts.filter((a) => a.enabled).length,
  });

  const deg = (v: number) => `${convTemp(v, prefs.tempUnit)}${tempUnitLabel(prefs.tempUnit)}`;
  const wind = (v: number) =>
    `${convWind(v, prefs.windUnit)} ${windUnitLabel(prefs.windUnit, prefs.lang)}`;

  // A quantity keeps the colour it has everywhere else in the app, so the sentence is
  // not the one place rain stops being blue.
  const mm = (v: number) => ({ text: `${fmtMm(v)} mm`, color: palette.valPrecip });
  const temp = (v: number) => ({ text: deg(v), color: palette.valTemp });
  const kmh = (v: number) => ({ text: wind(v), color: palette.valWind });

  /** Which template a fact uses, and what fills its blanks. */
  const wording = (b: Brief): { key: AppStringKey; values: Record<string, SentenceValue> } => {
    switch (b.kind) {
      case 'warnings':
        return {
          key: b.count === 1 ? 'briWarning' : 'briWarnings',
          values: {
            n: String(b.count ?? 0),
            what: { text: b.what ?? '', color: palette.valHigh },
            place: standing[0]?.row.name ?? '',
          },
        };
      case 'wettest':
        return { key: 'briWettest', values: { place: b.place ?? '', mm: mm(b.mm ?? 0) } };
      case 'rainSoon':
        return {
          key: 'briRainSoon',
          values: {
            place: b.place ?? '',
            when: ta('briMinutes', prefs.lang).replace('{n}', String(b.minutes ?? 0)),
          },
        };
      case 'rainAhead':
        return {
          key: b.place2 ? 'briRainAhead2' : 'briRainAhead',
          values: { place: b.place ?? '', place2: b.place2 ?? '' },
        };
      case 'rainWidespread':
        return { key: 'briRainWidespread', values: {} };
      case 'rainEverywhere':
        return { key: 'briRainEverywhere', values: {} };
      case 'tempRange':
        return {
          key: 'briTempRange',
          values: {
            low: temp(b.low ?? 0), high: temp(b.high ?? 0),
            place: b.place ?? '', place2: b.place2 ?? '',
          },
        };
      case 'windRange':
        return {
          key: 'briWindRange',
          values: {
            low: kmh(b.low ?? 0), high: kmh(b.high ?? 0),
            place: b.place ?? '', place2: b.place2 ?? '',
          },
        };
      case 'workable':
        return {
          key: 'briWorkable',
          values: { place: { text: b.place ?? '', color: palette.agroInk } },
        };
      case 'rules':
        return {
          key: b.count === 1 ? 'briRule' : 'briRules',
          values: { n: String(b.count ?? 0) },
        };
    }
  };

  const loading = rows.length > 0 && rows.every((r) => r.loading);

  return (
    <WidgetCard title={ta('ovSummary', prefs.lang)} titleColor={palette.agroInk}>
      {/* The one line here that is not about the weather. A name makes the page
          theirs rather than a dashboard, and it costs a line — so it is a line, not
          a header. Without a name it is still a greeting: the time of day is the
          half that was always true. */}
      <Text variant="body" weight="bold" color={palette.inkHeading}>
        {who ? `${greeting}, ${who}` : greeting}
      </Text>
      {brief.length ? (
        brief.map((b) => {
          const { key, values } = wording(b);
          return <Sentence key={b.kind} template={ta(key, prefs.lang)} values={values} />;
        })
      ) : loading ? null : (
        <WidgetNote>{ta('ovQuiet', prefs.lang)}</WidgetNote>
      )}
    </WidgetCard>
  );
}

// ── Significant weather, per location ─────────────────────────────────────────

export function AlertsWidget({ rows, alerts, settings, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  const hits = rows
    .map((row, i) => ({ row, alert: alerts[i] ?? null }))
    .filter((x): x is { row: OverviewRow; alert: WeatherAlert } => x.alert != null)
    .slice(0, settings.limit);
  const rules = prefs.userAlerts.filter((a) => a.enabled).slice(0, settings.limit);

  // Nothing at all draws nothing at all — not an empty card. A widget that says
  // "niets bijzonders" every day is a widget that takes height to report silence,
  // and the summary above already covers a quiet morning.
  if (!hits.length && !rules.length) return null;

  return (
    <WidgetCard title={ta('notifications', prefs.lang)}>
      {hits.map(({ row, alert }, i) => (
        <LocationLine
          key={`alert-${row.index}`}
          name={row.name}
          // An alert is a statement about the hours ahead. Nothing measured it.
          measured={false}
          divider={i > 0}
          // The reading is a phrase, not a figure; see `LocationLine`.
          compact
          onPress={() => onOpen(row.index, 'index')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Icon
              name={alert.icon}
              size={14}
              color={alert.severity === 'heavy' ? palette.valHigh : palette.accentDark}
              weight="fill"
            />
            <Text variant="label" weight="semibold" color={palette.inkHeading} numberOfLines={1}>
              {alert.label}
            </Text>
          </View>
        </LocationLine>
      ))}

      {/* The reader's own thresholds, under the app's own judgement rather than in a
          widget of their own: both answer "what am I being told about", and two cards
          asking that split the answer in half. */}
      {rules.map((rule, i) => (
        <LocationLine
          key={rule.id}
          name={rule.stationNames.join(' · ') || rule.stationIds.join(' · ')}
          divider={i > 0 || hits.length > 0}
          compact
        >
          <Text variant="label" weight="semibold" color={palette.muted} numberOfLines={1}>
            {`${rule.title} ${ta(rule.op === 'above' ? 'alertFiredAbove' : 'alertFiredBelow', prefs.lang)} `}
            <Text variant="label" weight="bold" color={palette.accentDark} tabular>
              {alertValueLabel(rule, prefs)}
            </Text>
          </Text>
        </LocationLine>
      ))}
    </WidgetCard>
  );
}

// ── What to do about it ───────────────────────────────────────────────────────

/**
 * Which fields need attention, and which have an opening.
 *
 * The rules are in `core/overviewAdvice`; this only words them. Attention is inked in
 * the reading's own colour and an opening in the station green, because a grower
 * scanning this wants to know in one look whether it is a list of problems or a list
 * of chances.
 */
export function AdviceWidget({ rows, settings, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const advice = adviceFor(rows, undefined, settings.limit);

  if (!advice.length) return null;

  const sentence = (a: (typeof advice)[number]): string => {
    const mm = a.mm != null ? `${fmtMm(a.mm)} mm` : '';
    const hours = a.hours != null ? `${a.hours} ${ta('ovHours', prefs.lang)}` : '';
    const deg = a.tempC != null
      ? `${convTemp(a.tempC, prefs.tempUnit)} ${tempUnitLabel(prefs.tempUnit)}`
      : '';
    switch (a.kind) {
      case 'soaked': return ta('advSoaked', prefs.lang).replace('{mm}', mm);
      case 'noWindow': return ta('advNoWindow', prefs.lang);
      case 'raceTheRain':
        return ta('advRace', prefs.lang).replace('{mm}', mm).replace('{h}', hours);
      case 'frost': return ta('advFrost', prefs.lang).replace('{t}', deg);
      case 'windowNow': return ta('advNow', prefs.lang).replace('{h}', hours);
      case 'windowLater':
        return ta('advLater', prefs.lang).replace('{at}', a.at ?? '').replace('{h}', hours);
    }
  };

  return (
    <WidgetCard title={ta('ovAdvice', prefs.lang)}>
      {advice.map((a, i) => {
        const good = isOpportunity(a.kind);
        return (
          <LocationLine
            key={`${a.index}-${a.kind}`}
            name={a.name}
            divider={i > 0}
            // The reading here is a sentence, not a figure, so the name matches it and
            // the rows close up. See `LocationLine`.
            compact
            onPress={() => onOpen(a.index, 'forecast')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <View
                style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: good ? palette.agroBright : palette.valHigh,
                }}
              />
              <Text
                variant="label"
                weight="semibold"
                color={good ? palette.agroInk : palette.inkHeading}
                numberOfLines={1}
              >
                {sentence(a)}
              </Text>
            </View>
          </LocationLine>
        );
      })}
    </WidgetCard>
  );
}

// ── Rankings ─────────────────────────────────────────────────────────────────

/** The shared shape of the four ranked widgets: sort, then a line each. Extracted
 *  because four near-copies is how two of them end up sorting differently. */
function RankedWidget({
  title, hint, rows, pick, render, onPress, direction = 'desc', measured, limit,
}: {
  title: string;
  hint?: string;
  rows: OverviewRow[];
  pick: (row: OverviewRow) => number | null;
  render: (row: OverviewRow) => React.ReactNode;
  onPress: (row: OverviewRow) => void;
  direction?: 'desc' | 'asc';
  /**
   * Whether this row's figure was measured — per quantity, because the widget decides
   * which quantity it is showing and this component cannot know.
   *
   * The default is no dot, which is the right answer for every widget built on the
   * outlook or the ensemble: no instrument reports tomorrow.
   */
  measured?: (row: OverviewRow) => boolean;
  /** How many lines the reader allows it. The rest are counted, not dropped. */
  limit?: number;
}) {
  const { prefs } = usePrefs();
  const all = rankRows(rows, pick, direction);
  const ranked = limit ? all.slice(0, limit) : all;
  const rest = all.length - ranked.length;
  return (
    <WidgetCard title={title} hint={hint}>
      {ranked.map((row, i) => (
        <LocationLine
          key={row.index}
          name={row.name}
          measured={measured?.(row) ?? false}
          divider={i > 0}
          onPress={() => onPress(row)}
        >
          {render(row)}
        </LocationLine>
      ))}
      {rest > 0 ? (
        <RestLine>{ta('ovRest', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

export function Rain24Widget({ rows, settings, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  // Since midnight or over the last 24 hours — both are on the row already, and which
  // one a grower means by "how much fell" depends on whether they are looking back at
  // a night or at a day.
  const today = settings.window === 'today';
  const fell = (r: OverviewRow) => (today ? r.rainToday : r.rain24);
  // A tenth of a millimetre is the point below which "it rained" is not worth a line.
  const { shown, rest, empty } = notableRows(rows, fell, 0.1, 'desc', settings.limit);

  return (
    <WidgetCard
      title={ta('ovRain24', prefs.lang)}
      hint={ta(today ? 'today' : 'last24h', prefs.lang)}
    >
      {empty ? (
        <WidgetNote>{ta('ovAllDry', prefs.lang)}</WidgetNote>
      ) : (
        shown.map((row, i) => (
          <StackedLine
            key={row.index}
            name={row.name}
            // Rain that has fallen: a gauge measured it, or a PLUS/PRO soil sensor did.
            measured={row.measured.precip}
            divider={i > 0}
            onPress={() => onOpen(row.index, 'grafiek')}
          >
            {/* When it fell, beside how much — the shape is the half a total cannot
                say, and it is the half that decides whether the land has drained.
                The name is on the line above: at half a row, a name, a chart and a
                figure do not fit across, and the name is what was losing. */}
            <BarSpark values={row.rainTrail} color={palette.valPrecip} grow />
            <Reading value={fmtMm(fell(row) ?? 0)} unit="mm" color={palette.valPrecip} />
          </StackedLine>
        ))
      )}
      {rest > 0 && !empty ? (
        <RestLine>{ta('ovRestDry', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

export function RainNextWidget({ rows, settings, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  // Half a millimetre: below that nobody changes a plan, and a line that says they
  // might is a line that trains people to skip the widget.
  const { shown, rest, empty } = notableRows(
    rows, (r) => r.rainNext24, 0.5, 'desc', settings.limit
  );

  return (
    <WidgetCard title={ta('ovRainNext', prefs.lang)} hint={ta('next24h', prefs.lang)}>
      {empty ? (
        <WidgetNote>{ta('ovNoRainAhead', prefs.lang)}</WidgetNote>
      ) : (
        shown.map((row, i) => (
          <StackedLine
            key={row.index}
            name={row.name}
            // Rain still to come. No instrument reports tomorrow.
            measured={false}
            divider={i > 0}
            onPress={() => onOpen(row.index, 'forecast')}
          >
            <BarSpark
              values={row.hours.slice(0, 24).map((h) => h.precip)}
              color={palette.valPrecip}
              grow
            />
            <Reading value={fmtMm(row.rainNext24 ?? 0)} unit="mm" color={palette.valPrecip} />
          </StackedLine>
        ))
      )}
      {rest > 0 && !empty ? (
        <RestLine>{ta('ovRestDry', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

export function TempWidget({ rows, settings, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  const spread = spreadOf(rows, (r) => r.tempC);
  const deg = (v: number) => `${convTemp(v, prefs.tempUnit)}${tempUnitLabel(prefs.tempUnit)}`;

  // Within two degrees of each other there is no comparison to draw, and a column of
  // near-identical numbers is height spent saying "the same". One line says it.
  if (spread && spread.span < 2) {
    return (
      <WidgetCard title={ta('ovTemp', prefs.lang)} hint={ta('ovSpread', prefs.lang)}>
        <Text variant="stat" color={palette.inkHeading} tabular style={{ fontSize: 24 }}>
          {deg(spread.max)}
        </Text>
        <Text variant="label" color={palette.muted}>
          {`${ta('ovEverywhere', prefs.lang)} ${deg(spread.min)}–${deg(spread.max)}`}
        </Text>
      </WidgetCard>
    );
  }

  const all = rankRows(rows, (r) => r.tempC);
  const ranked = settings.limit ? all.slice(0, settings.limit) : all;
  const rest = all.length - ranked.length;
  return (
    <WidgetCard title={ta('ovTemp', prefs.lang)} hint={ta('ovSpread', prefs.lang)}>
      {ranked.map((row, i) => (
        <LocationLine
          key={row.index}
          name={row.name}
          measured={row.measured.temp}
          divider={i > 0}
          onPress={() => onOpen(row.index, 'actueel')}
        >
          {/* The last 24 hours behind the reading: a field at 4° that has been falling
              all evening is a different night from one that has been climbing. */}
          <LineSpark values={row.tempTrail} color={palette.valTemp} />
          <Reading
            value={row.tempC == null ? '–' : String(convTemp(row.tempC, prefs.tempUnit))}
            unit={row.tempC == null ? undefined : tempUnitLabel(prefs.tempUnit)}
            dim={row.tempC == null}
          />
        </LocationLine>
      ))}
      {rest > 0 ? (
        <RestLine>{ta('ovRest', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

export function WindWidget({ rows, settings, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  return (
    <RankedWidget
      title={ta('ovWind', prefs.lang)}
      measured={(r) => r.measured.wind}
      hint={ta('ovSpread', prefs.lang)}
      rows={rows}
      limit={settings.limit}
      pick={(r) => r.windKmh}
      onPress={(r) => onOpen(r.index, 'actueel')}
      render={(r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <WindArrow deg={r.windDir} size={11} color={palette.muted} />
          <Reading
            value={r.windKmh == null ? '–' : String(convWind(r.windKmh, prefs.windUnit))}
            unit={r.windKmh == null ? undefined : windUnitLabel(prefs.windUnit, prefs.lang)}
            dim={r.windKmh == null}
          />
        </View>
      )}
    />
  );
}

export function FrostWidget({ rows, settings, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  // Three degrees, not zero: a field forecast for 2° is the one somebody wants to
  // know about, because that is where a forecast being wrong costs a crop.
  const { shown, rest, empty } = notableRows(
    rows, (r) => r.tonightMinC, 3, 'asc', settings.limit
  );

  return (
    <WidgetCard title={ta('ovFrost', prefs.lang)} hint={ta('ovTonight', prefs.lang)}>
      {empty ? (
        <WidgetNote>{ta('ovNothingNotable', prefs.lang)}</WidgetNote>
      ) : (
        shown.map((row, i) => (
          <LocationLine
            key={row.index}
            name={row.name}
            // Tonight's minimum is a forecast, however good the thermometer is.
            measured={false}
            divider={i > 0}
            onPress={() => onOpen(row.index, 'forecast')}
          >
            <Reading
              value={String(convTemp(row.tonightMinC as number, prefs.tempUnit))}
              unit={tempUnitLabel(prefs.tempUnit)}
              color={(row.tonightMinC as number) < 0 ? palette.valLow : palette.inkHeading}
            />
          </LocationLine>
        ))
      )}
      {rest > 0 && !empty ? (
        <RestLine>
          {ta('ovRestMild', prefs.lang)
            .replace('{n}', String(rest))
            .replace('{v}', `${convTemp(3, prefs.tempUnit)}${tempUnitLabel(prefs.tempUnit)}`)}
        </RestLine>
      ) : null}
    </WidgetCard>
  );
}

// ── Can I work? ───────────────────────────────────────────────────────────────

/**
 * The next 24 hours as a strip per location: green where the field can be worked,
 * and the reason where it cannot.
 *
 * A strip rather than a sentence because the shape of the day is the answer. "Dry
 * from two until seven" is a plan; "workable later" is not.
 */
export function WorkWidget({ rows, settings, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  const colour = (verdict: string) =>
    verdict === 'yes' ? palette.agroBright
      : verdict === 'wet' ? palette.valPrecip
        : verdict === 'windy' ? palette.valWind
          : verdict === 'cold' ? palette.valLow
            : palette.hairline;

  const shown = rows.slice(0, settings.limit);
  const rest = rows.length - shown.length;

  return (
    <WidgetCard title={ta('ovWork', prefs.lang)} hint={ta('next24h', prefs.lang)}>
      {shown.map((row, i) => {
        const window = workWindow(row.hours);
        const run = firstWorkRun(window);
        const workable = window.filter((h) => h.verdict === 'yes').length;
        const share = window.length ? workable / window.length : 0;
        const label = !window.length
          ? '–'
          : run == null
            ? ta('ovWorkNone', prefs.lang)
            : run.from === window[0]?.time
              ? `${ta('ovWorkNow', prefs.lang)} · ${run.hours} ${ta('ovHours', prefs.lang)}`
              : `${ta('ovWorkFrom', prefs.lang)} ${run.from.slice(11, 16)} · ${run.hours} ${ta('ovHours', prefs.lang)}`;

        return (
          <Pressable
            key={row.index}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(row.index, 'forecast'); }}
            accessibilityRole="button"
            accessibilityLabel={`${row.name}, ${label}`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space[3],
              paddingVertical: 7,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: palette.hairlineSoft,
            }}
          >
            {/* How much of the day is workable at all, as a proportion — the one
                figure on this page that genuinely is one. The strip beside it says
                *when*; the ring says *how much*, which is what decides whether the
                day is worth planning around at all. */}
            <Ring fraction={share} color={palette.agroBright} size={34}>
              <Text variant="label" weight="bold" color={palette.inkHeading} tabular>
                {window.length ? `${workable}` : '–'}
              </Text>
            </Ring>

            <View style={{ flex: 1, gap: 4 }}>
              {/* Name and verdict on one line, at one size, written out rather than
                  built from `LocationLine` — the line inside this block carries its
                  own padding, and a row with two lots of padding in it is a row that
                  cannot be made compact. */}
              {/* No dot: a workability verdict is about the hours ahead, and the
                  green dot means an instrument reported the figure it sits beside. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <Text variant="label" color={palette.ink} numberOfLines={1} style={{ flex: 1 }}>
                  {row.name}
                </Text>
                <Text variant="label" weight="semibold" color={palette.muted} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              {/* One block an hour, flexed so the strip is the width of the card
                  whatever the forecast's length. */}
              <View style={{ flexDirection: 'row', gap: 2, height: 6 }}>
                {window.map((h) => (
                  <View
                    key={h.time}
                    style={{ flex: 1, borderRadius: 2, backgroundColor: colour(h.verdict) }}
                  />
                ))}
              </View>
            </View>
          </Pressable>
        );
      })}
      {rest > 0 ? (
        <RestLine>{ta('ovRest', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
      {rows.every((r) => !r.hours.length) ? <WidgetNote>–</WidgetNote> : null}
    </WidgetCard>
  );
}

/**
 * What the weather means for the work, across every saved location.
 *
 * The disease widget answers which field to walk; this answers which field can be
 * worked, and why not. One line per location and not one per reading: a grower with
 * eight fields and four families would otherwise get thirty-two rows on a page whose
 * whole argument is that it fits on a screen. The worst thing about each field is on
 * its line, with the boundary that decided it, and the field's own card has the rest.
 *
 * Fields with nothing wrong are left out entirely — a list of "fine, fine, fine" is a
 * list nobody reads the top of. When every field is fine the widget draws nothing,
 * which is the same rule the alerts widget follows and is most days in winter.
 *
 * Nothing here is measured: a spray window is a conclusion drawn from a forecast, so
 * no green dot, whatever instrument stands in the field. The state's colour carries
 * it, exactly as on the disease rows above.
 */
export function FieldAdviceWidget({ advice, settings, onOpen }: WidgetProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();

  const ranked = worstPerLocation(advice);
  const rows = ranked.slice(0, settings.limit);
  const rest = ranked.length - rows.length;

  if (!rows.length) return null;

  return (
    <WidgetCard title={ta('adviceTitle', prefs.lang)}>
      {rows.map(({ advice: a, reading, others }, i) => (
        <Pressable
          key={a.index}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(a.index, 'index'); }}
          accessibilityRole="button"
          accessibilityLabel={`${a.name}, ${adviceTitle(reading, prefs.lang)}`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingVertical: 9,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          {/* The same bar the disease rows carry, in the same three inks: one ladder
              across the page, whatever kind of thing is on the row. */}
          <View
            style={{
              width: 3, height: 20, borderRadius: 2,
              backgroundColor: soilStatusBg(reading.level as SoilStatus, palette, appearance),
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" color={palette.inkHeading} numberOfLines={1}>
              {a.name}
            </Text>
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {adviceReason(reading, prefs)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              variant="label"
              weight="semibold"
              color={soilStatusInk(reading.level as SoilStatus, palette, appearance)}
              numberOfLines={1}
            >
              {adviceTitle(reading, prefs.lang)}
            </Text>
            {/* Not a list of the others, only that they exist: the field's own card
                is one tap away and says all of them properly. */}
            {others > 0 ? (
              <Text variant="caption" color={palette.inkDisabled} tabular>
                {`+${others}`}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
      {rest > 0 ? (
        <RestLine>{ta('ovRest', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

/**
 * AgroIntelligence · what the farm says, rather than what a field says.
 *
 * Four kinds of line, and every one of them is a sentence no single location's page
 * could produce: the same boundary shutting several fields said once, the stretch
 * they can all be worked in, which one to start on, and how unevenly it rained.
 *
 * Facts in, sentences here — `core/areaConclusions` carries the numbers and this
 * turns them into language, the same division the brief above it follows.
 */
export function AreaWidget({ area, settings, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();

  const shown = area.slice(0, settings.limit);
  if (!shown.length) return null;

  const clock = (stamp?: string) => (stamp ? stamp.slice(11, 16) : '');

  const wording = (c: AreaConclusion): { key: AppStringKey; values: Record<string, string> } => {
    switch (c.kind) {
      case 'shared':
        return {
          key: 'areaShared',
          values: {
            n: String(c.count ?? 0),
            total: String(c.total ?? 0),
            // The family, not the factor: "spuitvenster" is what five shut fields
            // have in common, and which boundary shut each of them is on its own page.
            what: c.factor ? ta(FAMILY_LABEL[familyOf(c.factor)], prefs.lang) : '',
          },
        };
      case 'commonWindow':
        return {
          key: 'areaCommonWindow',
          values: { from: clock(c.from), to: clock(c.to), n: String(c.count ?? 0) },
        };
      case 'noCommonWindow':
        return {
          key: 'areaNoCommonWindow',
          values: { n: String(c.count ?? 0), total: String(c.total ?? 0) },
        };
      case 'order':
        return {
          key: 'areaOrder',
          values: { place: c.place ?? '', place2: c.place2 ?? '', to: clock(c.to) },
        };
      case 'spread':
        return {
          key: 'areaSpread',
          values: {
            place: c.place ?? '', mm: fmtMm(c.mm ?? 0),
            place2: c.place2 ?? '', mm2: fmtMm(c.mm2 ?? 0),
          },
        };
    }
  };

  return (
    <WidgetCard title={ta('areaTitle', prefs.lang)} hint={ta('agroIntelTier', prefs.lang)}>
      {shown.map((c) => {
        const { key, values } = wording(c);
        const line = <Sentence template={ta(key, prefs.lang)} values={values} />;
        // A conclusion about one named field opens it; one about the farm has
        // nowhere to go, and a row that looks pressable and is not is worse than a
        // row that does not.
        return c.index != null ? (
          <Pressable
            key={c.kind + (c.factor ?? '')}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(c.index!, 'index'); }}
            accessibilityRole="button"
          >
            {line}
          </Pressable>
        ) : (
          <View key={c.kind}>{line}</View>
        );
      })}
      <WidgetNote>{ta('areaNote', prefs.lang)}</WidgetNote>
    </WidgetCard>
  );
}

/** Which family a boundary belongs to, for the de-duplicated line's wording. */
function familyOf(factor: string): 'spray' | 'frost' | 'workability' | 'fertilise' {
  if (factor.startsWith('spray')) return 'spray';
  if (factor.startsWith('frost')) return 'frost';
  if (factor.startsWith('fert')) return 'fertilise';
  return 'workability';
}

/**
 * AgroIntelligence · a chance instead of a value, on a ladder of actions.
 *
 * "65% kans op nachtvorst" beats "−1 °C" for the decision it is actually supporting,
 * because the question is not how cold it will be but whether to go out. The rung
 * says what to do about it and moves with the reader's own appetite for risk; the
 * line beside it says whether waiting would improve the answer.
 *
 * The count of members rides along. A chance over eight members and one over
 * fifty-one are not the same claim, and honesty rule 4 applies to a probability as
 * much as to a reading.
 */
export function RiskWidget({ risk, settings, onOpen }: WidgetProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const names = dayNames(prefs.lang);

  const shown = risk.slice(0, settings.limit);
  if (!shown.length) return null;

  // The rungs in the scale's own inks: watching is the quiet one, acting is the loud
  // one, and they are the same three colours every other verdict on this page uses.
  const tone = (rung: Rung) =>
    soilStatusInk(rung === 'act' ? 2 : rung === 'prepare' ? 1 : 0, palette, appearance);

  const RUNG_KEY: Record<Rung, AppStringKey> = {
    watch: 'riskWatch', prepare: 'riskPrepare', act: 'riskAct',
  };

  return (
    <WidgetCard
      title={ta('riskTitle', prefs.lang)}
      hint={ta(`riskAppetite_${prefs.agroIntel.risk}` as AppStringKey, prefs.lang)}
    >
      {shown.map((r, i) => (
        <Pressable
          key={`${r.index}-${r.kind}-${r.date}`}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(r.index, 'forecast'); }}
          accessibilityRole="button"
          accessibilityLabel={`${r.name}, ${r.percent}%`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingVertical: 9,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          {/* The chance, as the figure the row is about. Not a bar: a probability
              drawn as a bar invites reading two rows as a comparison of severity,
              and a 40% frost is not "less bad" than a 90% shower. */}
          <Text variant="stat" color={tone(r.rung)} tabular style={{ fontSize: 19, minWidth: 46 }}>
            {`${r.percent}%`}
          </Text>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" color={palette.inkHeading} numberOfLines={1}>
              {`${ta(r.kind === 'frost' ? 'riskFrost' : 'riskRain', prefs.lang)} · ${r.name}`}
            </Text>
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {[
                names[new Date(`${r.date}T12:00:00Z`).getUTCDay()],
                r.median != null
                  ? r.kind === 'frost'
                    ? `${ta('riskMedian', prefs.lang)} ${convTemp(r.median, prefs.tempUnit)}${tempUnitLabel(prefs.tempUnit)}`
                    : `${ta('riskMedian', prefs.lang)} ${fmtMm(r.median)} mm`
                  : '',
                ta('riskMembers', prefs.lang).replace('{n}', String(r.members)),
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="label" weight="semibold" color={tone(r.rung)} numberOfLines={1}>
              {ta(RUNG_KEY[r.rung], prefs.lang)}
            </Text>
            {/* Whether waiting would improve the answer — the half of a probability
                that a number on its own never carries. */}
            <Text variant="caption" color={palette.inkDisabled} numberOfLines={1}>
              {ta(
                r.decision === 'open' ? 'riskOpen'
                  : r.decision === 'settled-yes' ? 'riskSettledYes' : 'riskSettledNo',
                prefs.lang
              )}
            </Text>
          </View>
        </Pressable>
      ))}
    </WidgetCard>
  );
}

/**
 * AgroIntelligence · the coming days as windows, one row per location.
 *
 * Three bars a row, each the share of that day that can be worked, drawn **paler
 * where the members disagree**. Saturation is certainty — honesty rule 2 given a
 * shape — so a solid Thursday and a ghost of a Saturday are two different promises
 * and look like it.
 *
 * Comparing the rows is the whole product: one location's bar belongs to the basis
 * version, and "Thursday works everywhere and Friday only in the north" is a sentence
 * that needs all of them at once.
 */
export function WindowsWidget({ windows, settings, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const names = dayNames(prefs.lang);

  const shown = windows.filter((w) => w.days.length).slice(0, settings.limit);
  if (!shown.length) return null;

  const first = shown[0]!.days;

  return (
    <WidgetCard title={ta('windowsTitle', prefs.lang)} hint={ta('windowsHint', prefs.lang)}>
      {/* The day names once, over the columns, rather than on every row. */}
      <View style={{ flexDirection: 'row', gap: space[2], paddingLeft: 92 }}>
        {first.map((d) => (
          <Text
            key={d.date}
            variant="caption"
            color={palette.muted}
            style={{ flex: 1 }}
            numberOfLines={1}
          >
            {names[new Date(`${d.date}T12:00:00Z`).getUTCDay()]}
          </Text>
        ))}
      </View>

      {shown.map((w, i) => (
        <Pressable
          key={w.index}
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(w.index, 'forecast'); }}
          accessibilityRole="button"
          accessibilityLabel={w.name}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[2],
            paddingVertical: 7,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          <Text
            variant="label"
            color={palette.ink}
            numberOfLines={1}
            style={{ width: 88 }}
          >
            {w.name}
          </Text>
          {w.days.map((d) => (
            <View
              key={d.date}
              style={{
                flex: 1, height: 18, borderRadius: 4,
                backgroundColor: palette.hairlineSoft,
                overflow: 'hidden',
                justifyContent: 'flex-end',
              }}
            >
              <View
                style={{
                  // The share of the day that works, as the filled part — and the
                  // agreement as how solidly it is filled.
                  height: `${Math.round(workableShare(d) * 100)}%`,
                  backgroundColor: palette.agroBright,
                  opacity: certaintyOpacity(d.agreement),
                }}
              />
            </View>
          ))}
        </Pressable>
      ))}
      <WidgetNote>{ta('windowsNote', prefs.lang)}</WidgetNote>
    </WidgetCard>
  );
}

// ── The coming days ───────────────────────────────────────────────────────────

export function OutlookWidget({ rows, settings, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const names = dayNames(prefs.lang);

  return (
    <WidgetCard title={ta('ovOutlook', prefs.lang)} hint={ta('ovNextTwoDays', prefs.lang)}>
      {rows.slice(0, settings.limit).map((row, i) => {
        // Tomorrow and the day after. Today is half over and every other widget on
        // this page is already about it; a column repeating it is a column spent.
        const days = row.days.slice(1, 3);
        return (
          <Pressable
            key={row.index}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(row.index, 'forecast'); }}
            accessibilityRole="button"
            accessibilityLabel={row.name}
            style={{
              gap: 5,
              paddingVertical: 9,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: palette.hairlineSoft,
            }}
          >
            {/* The name keeps its own line. Squeezed into a column beside two days it
                had seventy-eight points, which is a truncated place name, and a
                location a grower cannot identify is a row they cannot use. */}
            {/* Days ahead, so no dot — see the note in the workability ring. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <Text
                variant="bodySm"
                weight="semibold"
                color={palette.ink}
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {row.name}
              </Text>
            </View>

            {/* The two days beside each other, not under each other: they are the same
                kind of thing at two moments, and a pair read left to right is one
                comparison where a pair read downward is two readings. Each is a small
                stack — what it will be, then how much rain and how likely — which is
                what fits a half-width column at this size. */}
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              {days.length ? days.map((day, d) => {
                const date = new Date(`${day.date}T12:00:00Z`);
                // The ensemble's own day, where it has one — `days[0]` is today, so
                // the offsets line up.
                const ens = row.ensemble?.[d + 1] ?? null;
                return (
                  <View
                    key={day.date}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Text variant="label" color={palette.muted} style={{ width: 30 }}>
                      {names[date.getUTCDay()]}
                    </Text>
                    <WeatherIcon wmo={day.wmo ?? 0} isDay={1} size={20} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        variant="label"
                        weight="semibold"
                        color={palette.inkHeading}
                        tabular
                        numberOfLines={1}
                      >
                        {day.tempMin == null || day.tempMax == null
                          ? '–'
                          : `${convTemp(day.tempMin, prefs.tempUnit)}/${convTemp(day.tempMax, prefs.tempUnit)}°`}
                      </Text>
                      {/* How much, and how likely. The dot beside them answers a
                          third question — how much the members agree — which is not
                          the same as how often they are wet. */}
                      <Text
                        variant="label"
                        color={day.precip ? palette.valPrecip : palette.valPrecipZero}
                        tabular
                        numberOfLines={1}
                      >
                        {day.precip == null ? '–' : fmtMm(day.precip)}
                        {ens ? ` · ${Math.round(ens.wetShare)}%` : ''}
                      </Text>
                    </View>
                    {ens ? <AgreementDot agreement={dayAgreement(ens)} /> : null}
                  </View>
                );
              }) : <WidgetNote>–</WidgetNote>}
            </View>
          </Pressable>
        );
      })}
    </WidgetCard>
  );
}

/** How sure the members are, as a dot. A word per day would not fit on the line the
 *  whole point of this widget is fitting onto. */
function AgreementDot({ agreement }: { agreement: ReturnType<typeof dayAgreement> }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const color =
    agreement === 'agree' ? palette.agroBright
      : agreement === 'mixed' ? palette.valSun
        : palette.valHigh;
  return (
    <View
      accessibilityLabel={ta(
        agreement === 'agree' ? 'ovAgree' : agreement === 'mixed' ? 'ovMixed' : 'ovDisagree',
        prefs.lang
      )}
      style={{
        width: 7, height: 7, borderRadius: 3.5, backgroundColor: color,
        // Hollow where they disagree: a filled dot reads as a fact and this is the
        // mark that says the fact is soft.
        opacity: agreement === 'disagree' ? 0.5 : 1,
      }}
    />
  );
}

// ── How much the members agree ────────────────────────────────────────────────

/**
 * Where the 51 members put tomorrow's rain, per location.
 *
 * The only widget here about confidence rather than weather, and the reason it earns
 * a place: "4 mm tomorrow" from a run the members are split down the middle on is a
 * different sentence from the same figure they all agree with, and a grower deciding
 * whether to travel deserves to be told which. The band shows how unevenly; the word
 * beside it says which of the three it is.
 *
 * Tomorrow rather than today, because today is largely settled and tomorrow is the
 * day a decision is still open on.
 */
export function ConfidenceWidget({ rows, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  const tomorrow = rows
    .map((row) => ({ row, day: row.ensemble?.[1] ?? row.ensemble?.[0] ?? null }))
    .filter((x): x is { row: OverviewRow; day: NonNullable<typeof x.day> } => x.day != null);

  // One scale down the column, so two bands of the same width mean the same
  // disagreement — a track scaled per row would make every location look equally
  // uncertain.
  const widest = Math.max(1, ...tomorrow.map(({ day }) => day.p90));

  const word = (a: ReturnType<typeof dayAgreement>) =>
    ta(a === 'agree' ? 'ovAgree' : a === 'mixed' ? 'ovMixed' : 'ovDisagree', prefs.lang);
  const ink = (a: ReturnType<typeof dayAgreement>) =>
    a === 'agree' ? palette.agroInk : a === 'mixed' ? palette.muted : palette.valHigh;

  return (
    <WidgetCard
      title={ta('ovConfidence', prefs.lang)}
      hint={tomorrow[0] ? `${ta('ovRainNext', prefs.lang)} · ${tomorrow[0].day.members} ${ta('ovMembers', prefs.lang)}` : undefined}
    >
      {tomorrow.length ? (
        tomorrow.map(({ row, day }, i) => {
          const agreement = dayAgreement(day);
          return (
            <LocationLine
              key={row.index}
              name={row.name}
              // The members' spread about tomorrow — a forecast about a forecast.
              measured={false}
              divider={i > 0}
              onPress={() => onOpen(row.index, 'forecast')}
            >
              <SpreadBand
                lo={day.p10}
                hi={day.p90}
                mid={day.p50}
                max={widest}
                color={palette.valPrecip}
              />
              <Text variant="label" weight="semibold" color={ink(agreement)}>
                {word(agreement)}
              </Text>
              <Reading
                value={`${Math.round(day.wetShare)}`}
                unit="%"
                color={day.wetShare >= 50 ? palette.valPrecip : palette.muted}
              />
            </LocationLine>
          );
        })
      ) : (
        <WidgetNote>–</WidgetNote>
      )}
    </WidgetCard>
  );
}

// ── A way to the map ──────────────────────────────────────────────────────────

export function MapWidget() {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const router = useRouter();
  return (
    <WidgetCard
      title={ta('ovMap', prefs.lang)}
      hint={ta('fullScreen', prefs.lang)}
      onPress={() => router.push('/map')}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Icon name="map-trifold" size={22} color={palette.accentDark} />
        <Text variant="bodySm" color={palette.muted} style={{ flexShrink: 1 }}>
          {prefs.locations.map((l) => l.name).join(' · ')}
        </Text>
      </View>
    </WidgetCard>
  );
}

// ── One location's own widgets ────────────────────────────────────────────────

/**
 * The pieces the tabs are built from, for the location that is selected.
 *
 * Everything above answers for every saved location at once, which is what this page
 * is for. But a grower whose day is mostly about one field still wants that field's
 * hero and its week here, on the page they open — and the app already draws both,
 * well, on 'Nu'. So these widgets are the same components, not copies of them: one
 * `ConditionsHero` in the app means a reading cannot be worded one way here and
 * another way there.
 *
 * Each names its location, because a card with no place on a page about every place
 * would be read as all of them — and three of them can be pinned to a location other
 * than the selected one, through the `location` setting.
 *
 * That split is where the honesty is, and `useWidgetLocation` is where it is decided.
 * The selected location has a full staged model behind it, loaded by the tabs, so the
 * widgets that follow it cost this page nothing. A pinned location has only what this
 * page fetches for every location: an observation model and a rain profile. Enough
 * for a hero, a curve and a radar square; not enough for a week, which is why the
 * hour strip and the week offer no location control rather than offering one and
 * quietly drawing three days where a fortnight was asked for.
 */

/**
 * The hero's two subtitles: where the reading came from, and when.
 *
 * Lifted from 'Nu' so the same card carries the same provenance on both pages, and
 * taking the model rather than reading the context so it can word a pinned
 * location's card too.
 */
function useHeroLabels(model: ForecastModel | null, stationName: string | null) {
  const { harmonie, offsetSec } = useForecast();

  const name = model?.station?.name ?? stationName ?? null;
  const sourceLabel = model?.station
    ? `AgroExact - ${name ?? 'station'}`
    : harmonie.model
      ? 'HARMONIE-AROME'
      : 'ECMWF IFS';

  const measured = model?.station?.current;
  const timeLabel = measured
    ? measurementTimeLabel(measured.measTime, offsetSec)
    : model
      ? model.nowHour.slice(11, 16)
      : '';

  return { sourceLabel, timeLabel };
}

export function HeroWidget({ models, settings, onOpen }: WidgetProps) {
  const { index, location, selected } = useWidgetLocation(settings);
  const { model: own } = useForecast();
  // The selected location's full staged model where there is one; the page's own
  // observation model for any other. Both draw this card; only one holds a fortnight.
  const model = selected ? own : models[index] ?? null;
  const { sourceLabel, timeLabel } = useHeroLabels(model, location.stationName ?? null);

  if (!model) return null;
  return (
    <ConditionsHero
      model={model}
      location={location}
      sourceLabel={sourceLabel}
      timeLabel={timeLabel}
      onPress={() => onOpen(index, 'actueel')}
    />
  );
}

/**
 * Rain in the next two hours, as the curve under the full-screen radar draws it.
 *
 * It was a figure and a word — "0,0 mm, droog" — which is the one thing a rain
 * nowcast is bad at saying. Two hours of rain is a *shape*: a shower that starts in
 * twenty minutes and is gone by the hour reads as a bump, and no wording of its total
 * gets that across. So the widget draws `NowcastPanel`, the same chart the radar page
 * and the full-screen map carry, with the same axis, the same boundary rule between
 * observation and forecast, and the same drag to scrub the loop.
 *
 * The radar frames come from `useRadarFrames`, this page's own copy — the hook's
 * whole argument is that the play head belongs to whoever owns the index, and a
 * widget on a page the reader may scroll past is exactly such an owner.
 *
 * The nowcast is one point, so it answers for one location: the selected one, or
 * whichever the reader pinned in its settings.
 */
export function NowcastWidget({ nowcasts, settings }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const { index: at, location, selected } = useWidgetLocation(settings);
  const { nowcast: own } = useForecast();
  const { frames, index, setIndex, playing, togglePlay, fetch } = useRadarFrames();
  const [width, setWidth] = useState(0);

  const profile = selected ? own : nowcasts[at] ?? null;
  const covered = activeProvider().coversPoint(location.lat, location.lon);

  // Outside the radar's coverage there is no loop to fetch, and no axis to draw the
  // curve against — the panel would be a chart with nothing under it.
  useEffect(() => {
    if (!covered) return;
    const control = new AbortController();
    fetch(control.signal);
    return () => control.abort();
  }, [fetch, covered]);

  const axis = radarAxis(frames);
  const offsetMin = frames[index]
    ? Math.round((frames[index]!.timeMs - Date.now()) / 60_000)
    : 0;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ backgroundColor: palette.appCard, borderRadius: radius.appCard, overflow: 'hidden' }}
    >
      {!covered ? (
        <View style={{ padding: space[5] }}>
          <WidgetNote>{ta('radarOutside', prefs.lang)}</WidgetNote>
        </View>
      ) : width > 0 ? (
        <NowcastPanel
          profile={profile}
          offsetMin={offsetMin}
          timeLabel={frameClock(frames[index])}
          width={width}
          domain={axis ? { from: axis.from, to: axis.to } : undefined}
          locationName={location.name}
          onScrubFraction={(fraction) => {
            const to = frameAtFraction(axis?.positions, fraction);
            if (to != null) setIndex(to);
          }}
          boundaryFraction={forecastBoundary(frames, axis?.positions)}
          playing={playing}
          onTogglePlay={togglePlay}
          playDisabled={frames.length < 2}
          compact
        />
      ) : null}
    </View>
  );
}

/**
 * The radar, at the size of a block on 'Actueel'.
 *
 * Half a row rather than the full one the card takes on 'Nu'. A radar square is read
 * for one thing here — is there anything coming, and from where — and that survives
 * being small in a way a chart does not. It is the same `RadarPreview` component, so
 * the loop, the pin and the clock badge are the ones the reader already knows.
 */
/** `Card`'s own padding, which stands between the widget's width and its map's. */
const CARD_PAD = 16;

export function RadarWidget({ settings, onOpen }: WidgetProps) {
  const { index, location } = useWidgetLocation(settings);
  const router = useRouter();
  const [width, setWidth] = useState(0);

  // The height it had as a half-width block, kept now that it runs the full width.
  // Half the page less the gap a pair of halves leaves between them is what the card
  // would have been; the map inside it is that less the card's own padding on both
  // sides. Measured rather than assumed, because the page's padding and the phone
  // both have a say in the first term.
  const height =
    width > 0 ? Math.round((width - space[4]) / 2) - 2 * CARD_PAD : undefined;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {height == null ? null : (
        <RadarPreview
          lat={location.lat}
          lon={location.lon}
          stationName={location.stationName}
          height={height}
          onOpen={() => { onOpen(index, 'index'); router.push('/radar'); }}
        />
      )}
    </View>
  );
}

/** The hour strip from 'Nu'. An hour opens that day on 'Verwachting', exactly as it
 *  does there — the per-hour detail lives on the page that owns it. */
export function NearTermWidget({ settings }: WidgetProps) {
  const { prefs, location } = usePrefs();
  const { model } = useForecast();
  const router = useRouter();

  if (!model) return null;
  return (
    <WidgetCard title={ta('ovNearTerm', prefs.lang)} hint={location.name}>
      <View style={{ marginHorizontal: -space[5], marginBottom: -space[2] }}>
        <HourSlider
          model={model}
          ahead={settings.hours}
          onPressHour={(hour) => {
            Haptics.selectionAsync().catch(() => {});
            router.push({ pathname: '/forecast', params: { day: hour.time.slice(0, 10) } });
          }}
        />
      </View>
    </WidgetCard>
  );
}

/**
 * The week, as 'Nu' draws it.
 *
 * The second week is behind the same toggle, and asking for it loads it — the
 * fourteen-day fetch is not made until a reader opens the fold, here as there. A day
 * goes to 'Verwachting' on that date rather than opening a sheet: this page is a way
 * in, and a sheet over a summary is a dead end with a card behind it.
 */
export function LongTermWidget() {
  const { model, extendedLoaded, loadExtendedDays } = useForecast();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  if (!model) return null;
  return (
    <ForecastPreview
      model={model}
      onOpen={() => router.push('/forecast')}
      expanded={expanded}
      onToggleExpanded={() => {
        const next = !expanded;
        setExpanded(next);
        if (next) loadExtendedDays();
      }}
      extendedLoading={!extendedLoaded}
      onOpenDay={(day) =>
        router.push({ pathname: '/forecast', params: { day: day.date } })
      }
    />
  );
}

/**
 * Every field on the account, driest first.
 *
 * The question none of the other widgets can answer: not what the weather is doing but
 * which field needs water, and how badly. A grower with eight fields reads this row
 * before anything else on the page, and the order *is* the answer — the top line is
 * where to send the reel.
 *
 * ## The colour is the field's own threshold, not a scale
 *
 * Each row's colour comes from the state the API froze for that reading, against that
 * field's own boundaries. So 34 kPa can be amber on a light soil under onions and
 * green on heavy clay under potatoes, and both are right. That is the whole argument
 * for soil being the first indicator: the colours mean the same thing on every row
 * while the numbers behind them properly differ.
 *
 * ## Why a bar and not a dot
 *
 * The green dot in this app means one thing — an instrument reported this — and every
 * row here has one by construction. A green *status* dot beside it would be two round
 * green marks saying different things, which is how a vocabulary stops being one. So
 * the state is a short upright bar, and the dot is left to mean what it means.
 */
export function SoilWidget({ fields, settings, onOpen }: WidgetProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();

  const word = (level: SoilStatus) =>
    ta((['soilStatus0', 'soilStatus1', 'soilStatus2', 'soilStatus3'] as const)[level], prefs.lang);

  // Nothing at all draws nothing at all, the same rule the alerts widget follows: a
  // card that takes height to report that this account has no soil sensors is a card
  // every reader without one would have to switch off by hand.
  if (!fields.length) return null;

  const ranked = rankFieldsByDryness(
    fields.map((f) => ({ ...f, thresholds: f.station.thresholds }))
  ).slice(0, settings.limit);

  return (
    <WidgetCard title={ta('ovSoil', prefs.lang)}>
      {ranked.map(({ field: f, tension, level, dormant }, i) => (
        <Pressable
          key={f.station.id}
          onPress={() => onOpen(f.index, 'index')}
          accessibilityRole="button"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingVertical: 9,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          <View
            style={{
              width: 3, height: 20, borderRadius: 2,
              backgroundColor: soilStatusBg(level, palette, appearance),
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" color={palette.inkHeading} numberOfLines={1}>
              {f.location.name}
            </Text>
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {dormant
                ? ta('agroSoilDormant', prefs.lang)
                : [level == null ? null : word(level), f.station.crop]
                    .filter(Boolean).join(' · ')}
            </Text>
          </View>
          {tension != null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                {/* The figure in the state's own ink, as on 'Actueel': the number and
                    its colour then say the same thing. */}
                <Text
                  variant="stat"
                  color={soilStatusInk(level, palette, appearance)}
                  tabular
                  style={{ fontSize: 17 }}
                >
                  {fmtDecimal(tension)}
                </Text>
                <Text variant="caption" color={palette.muted}>
                  kPa
                </Text>
              </View>
              {/* How much it would take. The one thing no other indicator can say, and
                  the difference between "this field is dry" and a decision you can act
                  on with a reel. */}
              {f.latest?.refillMm != null ? (
                <Text variant="caption" color={palette.muted} tabular>
                  {`${fmtDecimal(f.latest.refillMm)} mm ${ta('soilRefillShort', prefs.lang)}`}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text variant="label" color={palette.muted}>
              —
            </Text>
          )}
        </Pressable>
      ))}
    </WidgetCard>
  );
}

/**
 * Disease pressure across every field, worst first.
 *
 * The overview's question applied to the models: not "what is the weather doing" but
 * "which of my fields needs walking". A grower with eight places reads the top line and
 * knows where to start.
 *
 * Every figure here is **derived, not measured** — a Smith period is a conclusion drawn
 * from readings — so nothing on this widget carries the green dot, whatever instrument
 * produced the hours behind it. The state's colour does the work instead, and the
 * height the humidity was read at is on the line, because a period found at 10 cm is a
 * different claim from one found at 1.50 m.
 */
export function DiseaseWidget({ disease, settings, onOpen }: WidgetProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();

  const rows = disease
    .flatMap((d) => d.readings.map((reading) => ({ ...d, reading })))
    .sort((a, b) => b.reading.level - a.reading.level || b.reading.value - a.reading.value)
    .slice(0, settings.limit);

  // Nothing applies anywhere: no card, the same rule the alerts widget follows.
  if (!rows.length) return null;

  return (
    <WidgetCard title={ta('diseaseTitle', prefs.lang)}>
      {rows.map(({ name, index, reading }, i) => (
        <Pressable
          key={`${index}-${reading.model}-${reading.crop}`}
          onPress={() => onOpen(index, 'index')}
          accessibilityRole="button"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingVertical: 9,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          <View
            style={{
              width: 3, height: 20, borderRadius: 2,
              backgroundColor: soilStatusBg(reading.level as SoilStatus, palette, appearance),
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" color={palette.inkHeading} numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {[
                ta(reading.model === 'smith' ? 'smithTitle' : 'divTitle', prefs.lang),
                reading.crop,
                ta(reading.source === 'canopy10cm' ? 'soilCanopyLabel' : 'smithAt150', prefs.lang),
              ].join(' · ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Text
              variant="stat"
              color={soilStatusInk(reading.level as SoilStatus, palette, appearance)}
              tabular
              style={{ fontSize: 17 }}
            >
              {reading.value}
            </Text>
            {reading.limit != null ? (
              <Text variant="caption" color={palette.muted} tabular>
                {`/ ${reading.limit}`}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </WidgetCard>
  );
}
