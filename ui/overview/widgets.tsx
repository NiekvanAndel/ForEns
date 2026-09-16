/**
 * The overview page's widgets.
 *
 * One component per entry in `OVERVIEW_WIDGETS`, all reading the same `OverviewRow[]`
 * the page builds once. None of them fetches anything: the page knows which sources
 * the arrangement justifies and loads those, and a widget draws whatever has landed.
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
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { LocationLine, Reading, WidgetCard, WidgetNote } from './parts';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { alertValueLabel } from '../settings/UserAlertList';
import {
  firstWorkRun, rankRows, summariseOverview, workWindow,
  type OverviewRow,
} from '../../core/overviewData';
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

  const lines: string[] = [];
  if (s.warmest && s.coldest) {
    lines.push(
      s.warmest.name === s.coldest.name
        ? `${deg(s.warmest.value)} · ${s.warmest.name}`
        : `${deg(s.coldest.value)} ${s.coldest.name} — ${deg(s.warmest.value)} ${s.warmest.name}`
    );
  }
  if (s.wettest) {
    lines.push(`${ta('ovWettest', prefs.lang)}: ${fmtMm(s.wettest.value)} mm · ${s.wettest.name}`);
  } else if (!s.loading) {
    lines.push(ta('ovAllDry', prefs.lang));
  }
  if (s.rainAhead.length) {
    lines.push(`${ta('ovRainAhead', prefs.lang)} ${s.rainAhead.join(', ')}.`);
  }

  return (
    <WidgetCard
      title={ta('ovSummary', prefs.lang)}
      hint={`${s.locations} ${s.locations === 1 ? 'locatie' : 'locaties'}`}
    >
      {lines.length ? (
        <View style={{ gap: 4 }}>
          {lines.map((line, i) => (
            <Text
              key={i}
              variant={i === 0 ? 'bodySm' : 'caption'}
              weight={i === 0 ? 'semibold' : 'regular'}
              color={i === 0 ? palette.inkHeading : palette.muted}
              style={{ lineHeight: 19 }}
            >
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <WidgetNote>{ta('ovQuiet', prefs.lang)}</WidgetNote>
      )}
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

  return (
    <WidgetCard title={ta('ovAlerts', prefs.lang)}>
      {hits.length ? (
        hits.map(({ row, alert }, i) => (
          <LocationLine
            key={row.index}
            name={row.name}
            measured={row.hasStation}
            divider={i > 0}
            onPress={() => onOpen(row.index, 'index')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
        ))
      ) : (
        <WidgetNote>{ta('ovQuiet', prefs.lang)}</WidgetNote>
      )}
    </WidgetCard>
  );
}

// ── Rankings ──────────────────────────────────────────────────────────────────

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
  return (
    <RankedWidget
      title={ta('ovRain24', prefs.lang)}
      hint={ta('last24h', prefs.lang)}
      rows={rows}
      pick={(r) => r.rain24}
      onPress={(r) => onOpen(r.index, 'grafiek')}
      render={(r) => (
        <Reading
          value={r.rain24 == null ? '–' : fmtMm(r.rain24)}
          unit={r.rain24 == null ? undefined : 'mm'}
          color={r.rain24 ? palette.valPrecip : palette.valPrecipZero}
          dim={r.rain24 == null}
        />
      )}
    />
  );
}

export function RainNextWidget({ rows, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  const { palette } = useTheme();
  return (
    <RankedWidget
      title={ta('ovRainNext', prefs.lang)}
      hint={ta('next24h', prefs.lang)}
      rows={rows}
      pick={(r) => r.rainNext24}
      onPress={(r) => onOpen(r.index, 'forecast')}
      render={(r) => (
        <Reading
          value={r.rainNext24 == null ? '–' : fmtMm(r.rainNext24)}
          unit={r.rainNext24 == null ? undefined : 'mm'}
          color={r.rainNext24 ? palette.valPrecip : palette.valPrecipZero}
          dim={r.rainNext24 == null}
        />
      )}
    />
  );
}

export function TempWidget({ rows, onOpen }: WidgetProps) {
  const { prefs } = usePrefs();
  return (
    <RankedWidget
      title={ta('ovTemp', prefs.lang)}
      hint={ta('ovSpread', prefs.lang)}
      rows={rows}
      pick={(r) => r.tempC}
      onPress={(r) => onOpen(r.index, 'actueel')}
      render={(r) => (
        <Reading
          value={r.tempC == null ? '–' : String(convTemp(r.tempC, prefs.tempUnit))}
          unit={r.tempC == null ? undefined : tempUnitLabel(prefs.tempUnit)}
          dim={r.tempC == null}
        />
      )}
    />
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
  return (
    <RankedWidget
      title={ta('ovFrost', prefs.lang)}
      hint={ta('ovTonight', prefs.lang)}
      rows={rows}
      // Coldest first: the point of this widget is the field that freezes, and a
      // ranking that put the mildest at the top would bury it.
      direction="asc"
      pick={(r) => r.tonightMinC}
      onPress={(r) => onOpen(r.index, 'forecast')}
      render={(r) => (
        <Reading
          value={r.tonightMinC == null ? '–' : String(convTemp(r.tonightMinC, prefs.tempUnit))}
          unit={r.tonightMinC == null ? undefined : tempUnitLabel(prefs.tempUnit)}
          color={r.tonightMinC != null && r.tonightMinC < 0 ? palette.valLow : undefined}
          dim={r.tonightMinC == null}
        />
      )}
    />
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
              gap: 6, paddingVertical: 9,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: palette.hairlineSoft,
            }}
          >
            <LocationLine name={row.name} measured={row.hasStation} onPress={() => onOpen(row.index, 'forecast')}>
              <Text variant="caption" weight="semibold" color={palette.muted} numberOfLines={1}>
                {label}
              </Text>
            </LocationLine>
            {/* One block an hour. Flexed rather than fixed so the strip is the width
                of the card whatever the forecast's length. */}
            <View style={{ flexDirection: 'row', gap: 2, height: 8 }}>
              {window.map((h) => (
                <View
                  key={h.time}
                  style={{ flex: 1, borderRadius: 2, backgroundColor: colour(h.verdict) }}
                />
              ))}
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
      {rows.map((row, i) => (
        <View
          key={row.index}
          style={{
            paddingVertical: 9,
            borderTopWidth: i > 0 ? 1 : 0,
            borderTopColor: palette.hairlineSoft,
            gap: 6,
          }}
        >
          <LocationLine name={row.name} measured={row.hasStation} onPress={() => onOpen(row.index, 'forecast')}>
            <Icon name="caret-right" size={12} color={palette.muted} weight="bold" />
          </LocationLine>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {row.days.slice(0, 3).map((day) => {
              const date = new Date(`${day.date}T12:00:00Z`);
              return (
                <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <Text variant="caption" color={palette.muted}>
                    {names[date.getUTCDay()]}
                  </Text>
                  <WeatherIcon wmo={day.wmo ?? 0} isDay={1} size={22} />
                  <Text variant="caption" weight="semibold" color={palette.inkHeading} tabular>
                    {day.tempMin == null || day.tempMax == null
                      ? '–'
                      : `${convTemp(day.tempMin, prefs.tempUnit)}/${convTemp(day.tempMax, prefs.tempUnit)}°`}
                  </Text>
                  <Text
                    variant="caption"
                    color={day.precip ? palette.valPrecip : palette.valPrecipZero}
                    tabular
                  >
                    {day.precip == null ? '–' : `${fmtMm(day.precip)} mm`}
                  </Text>
                </View>
              );
            })}
            {row.days.length ? null : <WidgetNote>–</WidgetNote>}
          </View>
        </View>
      ))}
    </WidgetCard>
  );
}

// ── The reader's own thresholds ───────────────────────────────────────────────

/**
 * The rules a grower set themselves, as a reminder that they exist.
 *
 * Deliberately not their current state: evaluating them means reading the stations
 * they name, which is the background task's job and costs a request apiece. This says
 * what is being watched; the notification says when it trips. A widget that showed a
 * live figure would be the third place in the app computing the same comparison.
 */
export function RulesWidget() {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const rules = prefs.userAlerts.filter((a) => a.enabled);

  return (
    <WidgetCard title={ta('ovRules', prefs.lang)}>
      {rules.length ? (
        rules.map((rule, i) => (
          <LocationLine
            key={rule.id}
            name={rule.stationNames.join(' · ') || rule.stationIds.join(' · ')}
            divider={i > 0}
          >
            <Text variant="caption" weight="semibold" color={palette.inkHeading} numberOfLines={1}>
              {`${rule.title} ${ta(rule.op === 'above' ? 'alertFiredAbove' : 'alertFiredBelow', prefs.lang)} `}
              <Text variant="caption" weight="bold" color={palette.accentDark} tabular>
                {alertValueLabel(rule, prefs)}
              </Text>
            </Text>
          </LocationLine>
        ))
      ) : (
        <WidgetNote>{ta('alertNone', prefs.lang)}</WidgetNote>
      )}
    </WidgetCard>
  );
}

// ── Rain in the next two hours, where the reader is ───────────────────────────

/**
 * The one widget here about a single location, and it says so.
 *
 * The nowcast is five-minutely over one point; there is no honest way to show eight
 * fields' worth of it in a card. So it answers for the location that is selected, and
 * the heading names it — a chart with no place attached on a page about every place
 * would be read as all of them.
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
