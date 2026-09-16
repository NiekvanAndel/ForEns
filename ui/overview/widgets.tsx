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
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { ConditionsHero } from '../nowcast/ConditionsHero';
import { HourSlider } from '../nowcast/HourSlider';
import { ForecastPreview } from '../nowcast/ForecastPreview';
import { LocationLine, Reading, WidgetCard, WidgetNote } from './parts';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { alertValueLabel } from '../settings/UserAlertList';
import { measurementTimeLabel } from '../../core/model/station';
import {
  firstWorkRun, notableRows, rankRows, spreadOf, summariseOverview, workWindow,
  type OverviewRow,
} from '../../core/overviewData';
import { dayAgreement } from '../../core/sources/ensembleOutlook';
import { adviceFor, isOpportunity } from '../../core/overviewAdvice';
import { BarSpark, LineSpark, RestLine, Ring, SpreadBand } from './marks';
import type { WeatherAlert } from '../../core/model/alert';
import {
  convTemp, convWind, dayNames, fmtMm, ta, tempUnitLabel, windUnitLabel,
} from '../../core/i18n';

export interface WidgetProps {
  rows: OverviewRow[];
  /** One per row, in the same order; null where nothing is worth saying. */
  alerts: (WeatherAlert | null)[];
  /** Selects a location and leaves the page. */
  onOpen: (index: number, page: 'index' | 'forecast' | 'grafiek' | 'actueel') => void;
}

// ── The sentence at the top ───────────────────────────────────────────────────

export function SummaryWidget({ rows }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const s = summariseOverview(rows);

  const deg = (v: number) => `${convTemp(v, prefs.tempUnit)}${tempUnitLabel(prefs.tempUnit)}`;

  /**
   * Rain first, then temperature.
   *
   * Because that is the order an arable grower asks them in: whether the land is
   * workable is a rainfall question, and the temperature qualifies it. The page led
   * with the temperature spread at first, which reads as a weather app rather than as
   * a working one.
   */
  const headline = s.wettest
    ? `${fmtMm(s.wettest.value)} mm · ${s.wettest.name}`
    : s.loading
      ? ''
      : ta('ovAllDry', prefs.lang);

  const under: string[] = [];
  if (s.rainAhead.length) {
    under.push(`${ta('ovRainAhead', prefs.lang)} ${s.rainAhead.join(', ')}.`);
  } else if (!s.loading && rows.some((r) => r.rainNext24 != null)) {
    under.push(ta('ovNoRainAhead', prefs.lang));
  }
  if (s.warmest && s.coldest) {
    under.push(
      s.warmest.name === s.coldest.name
        ? deg(s.warmest.value)
        : `${deg(s.coldest.value)} ${s.coldest.name} — ${deg(s.warmest.value)} ${s.warmest.name}`
    );
  }

  return (
    <WidgetCard
      title={ta('ovSummary', prefs.lang)}
      hint={s.wettest ? ta('ovWettest', prefs.lang) : `${s.locations}`}
    >
      {headline ? (
        <Text variant="stat" color={palette.inkHeading} tabular style={{ fontSize: 22 }}>
          {headline}
        </Text>
      ) : null}
      {under.map((line, i) => (
        <Text key={i} variant="caption" color={palette.muted} style={{ lineHeight: 18 }}>
          {line}
        </Text>
      ))}
      {!headline && !under.length ? <WidgetNote>{ta('ovQuiet', prefs.lang)}</WidgetNote> : null}
    </WidgetCard>
  );
}

// ── Significant weather, per location ─────────────────────────────────────────

export function AlertsWidget({ rows, alerts, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  const hits = rows
    .map((row, i) => ({ row, alert: alerts[i] ?? null }))
    .filter((x): x is { row: OverviewRow; alert: WeatherAlert } => x.alert != null);
  const rules = prefs.userAlerts.filter((a) => a.enabled);

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
          measured={row.hasStation}
          divider={i > 0}
          onPress={() => onOpen(row.index, 'index')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Icon
              name={alert.icon}
              size={14}
              color={alert.severity === 'heavy' ? palette.valHigh : palette.accentDark}
              weight="fill"
            />
            <Text variant="caption" weight="semibold" color={palette.inkHeading} numberOfLines={1}>
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
        >
          <Text variant="caption" weight="semibold" color={palette.muted} numberOfLines={1}>
            {`${rule.title} ${ta(rule.op === 'above' ? 'alertFiredAbove' : 'alertFiredBelow', prefs.lang)} `}
            <Text variant="caption" weight="bold" color={palette.accentDark} tabular>
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
export function AdviceWidget({ rows, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const advice = adviceFor(rows);

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
                variant="caption"
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
  title, hint, rows, pick, render, onPress, direction = 'desc',
}: {
  title: string;
  hint?: string;
  rows: OverviewRow[];
  pick: (row: OverviewRow) => number | null;
  render: (row: OverviewRow) => React.ReactNode;
  onPress: (row: OverviewRow) => void;
  direction?: 'desc' | 'asc';
}) {
  const ranked = rankRows(rows, pick, direction);
  return (
    <WidgetCard title={title} hint={hint}>
      {ranked.map((row, i) => (
        <LocationLine
          key={row.index}
          name={row.name}
          measured={row.hasStation}
          divider={i > 0}
          onPress={() => onPress(row)}
        >
          {render(row)}
        </LocationLine>
      ))}
    </WidgetCard>
  );
}

export function Rain24Widget({ rows, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  // A tenth of a millimetre is the point below which "it rained" is not worth a line.
  const { shown, rest, empty } = notableRows(rows, (r) => r.rain24, 0.1);

  return (
    <WidgetCard title={ta('ovRain24', prefs.lang)} hint={ta('last24h', prefs.lang)}>
      {empty ? (
        <WidgetNote>{ta('ovAllDry', prefs.lang)}</WidgetNote>
      ) : (
        shown.map((row, i) => (
          <LocationLine
            key={row.index}
            name={row.name}
            measured={row.hasStation}
            divider={i > 0}
            onPress={() => onOpen(row.index, 'grafiek')}
          >
            {/* When it fell, beside how much — the shape is the half a total cannot
                say, and it is the half that decides whether the land has drained. */}
            {/* No trend arrow. It cost the width a place name needs, and "wetter
                than yesterday" is a question the widget beside this one answers
                properly — this one is about what fell and when. */}
            <BarSpark values={row.rainTrail} color={palette.valPrecip} width={52} />
            <Reading value={fmtMm(row.rain24 ?? 0)} unit="mm" color={palette.valPrecip} />
          </LocationLine>
        ))
      )}
      {rest > 0 && !empty ? (
        <RestLine>{ta('ovRestDry', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

export function RainNextWidget({ rows, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  // Half a millimetre: below that nobody changes a plan, and a line that says they
  // might is a line that trains people to skip the widget.
  const { shown, rest, empty } = notableRows(rows, (r) => r.rainNext24, 0.5);

  return (
    <WidgetCard title={ta('ovRainNext', prefs.lang)} hint={ta('next24h', prefs.lang)}>
      {empty ? (
        <WidgetNote>{ta('ovNoRainAhead', prefs.lang)}</WidgetNote>
      ) : (
        shown.map((row, i) => (
          <LocationLine
            key={row.index}
            name={row.name}
            measured={row.hasStation}
            divider={i > 0}
            onPress={() => onOpen(row.index, 'forecast')}
          >
            <BarSpark
              values={row.hours.slice(0, 24).map((h) => h.precip)}
              color={palette.valPrecip}
            />
            <Reading value={fmtMm(row.rainNext24 ?? 0)} unit="mm" color={palette.valPrecip} />
          </LocationLine>
        ))
      )}
      {rest > 0 && !empty ? (
        <RestLine>{ta('ovRestDry', prefs.lang).replace('{n}', String(rest))}</RestLine>
      ) : null}
    </WidgetCard>
  );
}

export function TempWidget({ rows, onOpen }: WidgetProps) {
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
        <Text variant="caption" color={palette.muted}>
          {`${ta('ovEverywhere', prefs.lang)} ${deg(spread.min)}–${deg(spread.max)}`}
        </Text>
      </WidgetCard>
    );
  }

  const ranked = rankRows(rows, (r) => r.tempC);
  return (
    <WidgetCard title={ta('ovTemp', prefs.lang)} hint={ta('ovSpread', prefs.lang)}>
      {ranked.map((row, i) => (
        <LocationLine
          key={row.index}
          name={row.name}
          measured={row.hasStation}
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
    </WidgetCard>
  );
}

export function WindWidget({ rows, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  return (
    <RankedWidget
      title={ta('ovWind', prefs.lang)}
      hint={ta('ovSpread', prefs.lang)}
      rows={rows}
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

export function FrostWidget({ rows, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  // Three degrees, not zero: a field forecast for 2° is the one somebody wants to
  // know about, because that is where a forecast being wrong costs a crop.
  const { shown, rest, empty } = notableRows(rows, (r) => r.tonightMinC, 3, 'asc');

  return (
    <WidgetCard title={ta('ovFrost', prefs.lang)} hint={ta('ovTonight', prefs.lang)}>
      {empty ? (
        <WidgetNote>{ta('ovNothingNotable', prefs.lang)}</WidgetNote>
      ) : (
        shown.map((row, i) => (
          <LocationLine
            key={row.index}
            name={row.name}
            measured={row.hasStation}
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
export function WorkWidget({ rows, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  const colour = (verdict: string) =>
    verdict === 'yes' ? palette.agroBright
      : verdict === 'wet' ? palette.valPrecip
        : verdict === 'windy' ? palette.valWind
          : verdict === 'cold' ? palette.valLow
            : palette.hairline;

  return (
    <WidgetCard title={ta('ovWork', prefs.lang)} hint={ta('next24h', prefs.lang)}>
      {rows.map((row, i) => {
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
          <View
            key={row.index}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: space[3],
              paddingVertical: 10,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: palette.hairlineSoft,
            }}
          >
            {/* How much of the day is workable at all, as a proportion — the one
                figure on this page that genuinely is one. The strip beside it says
                *when*; the ring says *how much*, which is what decides whether the
                day is worth planning around at all. */}
            <Ring fraction={share} color={palette.agroBright} size={42}>
              <Text variant="caption" weight="bold" color={palette.inkHeading} tabular>
                {window.length ? `${workable}` : '–'}
              </Text>
            </Ring>

            <View style={{ flex: 1, gap: 6 }}>
              <LocationLine
                name={row.name}
                measured={row.hasStation}
                onPress={() => onOpen(row.index, 'forecast')}
              >
                <Text variant="caption" weight="semibold" color={palette.muted} numberOfLines={1}>
                  {label}
                </Text>
              </LocationLine>
              {/* One block an hour, flexed so the strip is the width of the card
                  whatever the forecast's length. */}
              <View style={{ flexDirection: 'row', gap: 2, height: 8 }}>
                {window.map((h) => (
                  <View
                    key={h.time}
                    style={{ flex: 1, borderRadius: 2, backgroundColor: colour(h.verdict) }}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      })}
      {rows.every((r) => !r.hours.length) ? <WidgetNote>–</WidgetNote> : null}
    </WidgetCard>
  );
}

// ── The coming days ───────────────────────────────────────────────────────────

export function OutlookWidget({ rows, onOpen }: WidgetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const names = dayNames(prefs.lang);

  return (
    <WidgetCard title={ta('ovOutlook', prefs.lang)}>
      {rows.map((row, i) => {
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
              flexDirection: 'row', alignItems: 'center', gap: space[2],
              paddingVertical: 10,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: palette.hairlineSoft,
            }}
          >
            {/* Name and both days on one line. It was a name above a row of three
                columns, which is three lines of height per location — on a page with
                eight of them, a screen and a half for two days of weather. */}
            <View style={{ width: 84, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {row.hasStation ? (
                <View
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.agroBright }}
                />
              ) : null}
              <Text variant="caption" weight="semibold" color={palette.ink} numberOfLines={1}>
                {row.name}
              </Text>
            </View>

            {days.map((day, d) => {
              const date = new Date(`${day.date}T12:00:00Z`);
              // The ensemble's own day, where it has one — `days[0]` is today, so the
              // offsets line up.
              const ens = row.ensemble?.[d + 1] ?? null;
              return (
                <View
                  key={day.date}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Text variant="caption" color={palette.muted} style={{ width: 20 }}>
                    {names[date.getUTCDay()]}
                  </Text>
                  <WeatherIcon wmo={day.wmo ?? 0} isDay={1} size={18} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="caption" weight="semibold" color={palette.inkHeading} tabular numberOfLines={1}>
                      {day.tempMin == null || day.tempMax == null
                        ? '–'
                        : `${convTemp(day.tempMin, prefs.tempUnit)}/${convTemp(day.tempMax, prefs.tempUnit)}°`}
                    </Text>
                    {/* How much, how likely, and how sure — the three the forecast
                        row upstairs leaves out, and the three a travel decision is
                        actually made on. */}
                    <Text
                      variant="caption"
                      color={day.precip ? palette.valPrecip : palette.valPrecipZero}
                      tabular
                      numberOfLines={1}
                      style={{ fontSize: 10 }}
                    >
                      {day.precip == null ? '–' : fmtMm(day.precip)}
                      {ens ? ` · ${Math.round(ens.wetShare)}%` : ''}
                    </Text>
                  </View>
                  {ens ? <AgreementDot agreement={dayAgreement(ens)} /> : null}
                </View>
              );
            })}

            {days.length ? null : <WidgetNote>–</WidgetNote>}
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
              measured={row.hasStation}
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
              <Text variant="caption" weight="semibold" color={ink(agreement)}>
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
 * They all read `useForecast()`, which is the selected location's own data — already
 * loaded, because it is what the tabs behind this page are showing. So they cost the
 * overview nothing, which is why their `needs` are empty.
 *
 * Each names its location, because a card with no place on a page about every place
 * would be read as all of them. Pinning one to a *particular* location, rather than
 * to whichever is selected, is per-widget settings — written down, not built; see
 * DEFERRED.
 */

/** The hero's two subtitles: where the reading came from, and when. Lifted from 'Nu'
 *  so the same card carries the same provenance on both pages. */
function useHeroLabels() {
  const { location } = usePrefs();
  const { model, harmonie, offsetSec } = useForecast();

  const stationName = model?.station?.name ?? location.stationName ?? null;
  const sourceLabel = model?.station
    ? `AgroExact - ${stationName ?? 'station'}`
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

export function HeroWidget() {
  const { location } = usePrefs();
  const { model } = useForecast();
  const { sourceLabel, timeLabel } = useHeroLabels();
  const router = useRouter();

  if (!model) return null;
  return (
    <ConditionsHero
      model={model}
      location={location}
      sourceLabel={sourceLabel}
      timeLabel={timeLabel}
      onPress={() => router.push('/actueel')}
    />
  );
}

/**
 * Rain in the next two hours, where the reader is.
 *
 * The nowcast is five-minutely over one point; there is no honest way to show eight
 * fields' worth of it in a card. So it answers for the location that is selected, and
 * the heading names it.
 */
export function NowcastWidget() {
  const { palette } = useTheme();
  const { prefs, location } = usePrefs();
  const { nowcast } = useForecast();
  const router = useRouter();

  const mm = nowcast?.totalMm ?? null;
  const starts = nowcast?.startsInMin ?? null;

  return (
    <WidgetCard
      title={ta('ovNowcast', prefs.lang)}
      hint={location.name}
      onPress={() => router.push('/map')}
    >
      {nowcast?.wet ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[2] }}>
          <Text variant="stat" color={palette.valPrecip} tabular style={{ fontSize: 22 }}>
            {fmtMm(mm ?? 0)}
            <Text variant="caption" weight="semibold" color={palette.muted}>
              {' mm'}
            </Text>
          </Text>
          <Text variant="caption" color={palette.muted}>
            {starts == null || starts === 0
              ? ta('now', prefs.lang)
              : `${ta('expected', prefs.lang)} +${starts} min`}
          </Text>
        </View>
      ) : (
        <WidgetNote>{ta('dryAt', prefs.lang)}</WidgetNote>
      )}
    </WidgetCard>
  );
}

/** The hour strip from 'Nu'. An hour opens that day on 'Verwachting', exactly as it
 *  does there — the per-hour detail lives on the page that owns it. */
export function NearTermWidget() {
  const { prefs, location } = usePrefs();
  const { model } = useForecast();
  const router = useRouter();

  if (!model) return null;
  return (
    <WidgetCard title={ta('ovNearTerm', prefs.lang)} hint={location.name}>
      <View style={{ marginHorizontal: -space[5], marginBottom: -space[2] }}>
        <HourSlider
          model={model}
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
