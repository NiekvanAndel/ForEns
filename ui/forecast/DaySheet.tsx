/**
 * The day detail sheet.
 *
 * The ExactCast design has no screen for this — it reduces the whole ensemble to one
 * "Spreiding tonen" toggle — so it is designed here in the system's language:
 * a `--radius-app-card` sheet on the cream ground, white cards, eyebrow labels, and
 * the reading colours from rule 2. Nothing new is invented visually; the layout is
 * the design's own card grammar applied to a surface it did not cover.
 *
 * It replaces the web app's six separate popups with one sheet whose sections match
 * the layer switcher, because six renderers that each re-derived the same day is
 * exactly why they drifted apart.
 *
 * The sheet opens on the section you came from, and shows what that section is about
 * — as the web app's six popups did, and as one sheet that always opened on
 * precipitation did not.
 *
 * Overview is the odd one out and deliberately so: the day's figures and its hours,
 * with no precipitation narrative and no chart. It is the "what is this day like"
 * answer, and a reader who wants the ensemble picks a measurand tab, where they get
 * the members' spread — p10–p90 wide, p25–p75 inside it, the median, and a dot at
 * the reported value — above the hour-by-hour list.
 *
 * The order is deliberate: the sentence a reader can act on comes first, the
 * meteogram second, and the per-measurand detail below that.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../theme';
import { Card, Rule } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { HourlyList } from './HourlyList';
import { DayBar } from './DayBar';
import { OverviewDayRow } from './OverviewDayRow';
import { SpreadChart } from '../charts/SpreadChart';
import { usePrefs } from '../../state/prefs';
import { buildDayDetail, precipNarrative, spreadLabel } from '../../core/model/dayDetail';
import { LAYERS, layerRow, resolveDayValues, type LayerKey } from '../../core/model/layers';
import { beamScale } from '../../core/model/beam';
import type { DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day, ForecastModel } from '../../core/model/types';
import {
  convTemp, convWind, dayNames, fmtMm, t, tempUnitLabel, windUnitLabel, wmoText,
} from '../../core/i18n';

export interface DaySheetProps {
  visible: boolean;
  day: Day | null;
  model: ForecastModel | null;
  ensemble?: DayEnsemble;
  ensembleLoading?: boolean;
  /** Section the sheet opens on — the tab the day was tapped under. */
  initialLayer?: LayerKey;
  onClose: () => void;
}

export function DaySheet({
  visible, day, model, ensemble, ensembleLoading, initialLayer = 'overview', onClose,
}: DaySheetProps) {
  const { palette } = useTheme();
  const [layer, setLayer] = useState<LayerKey>(initialLayer);

  // Open on the section the day was tapped under, rather than inheriting whichever
  // section the previous sheet was left on.
  useEffect(() => {
    if (visible) setLayer(initialLayer);
  }, [visible, day?.date, initialLayer]);

  // The day is re-read from the live model by its date. `day` is captured when the
  // row is tapped, and every stage that lands afterwards rebuilds the model with new
  // `Day` objects — so the captured one goes stale within seconds of the sheet
  // opening, and its ensemble percentiles never arrive at all.
  const liveDay = useMemo(
    () => (day && model ? model.days.find((d) => d.date === day.date) ?? day : day),
    [day, model]
  );

  const detail = useMemo(
    () => (model && liveDay ? buildDayDetail(model, liveDay, ensemble) : null),
    [model, liveDay, ensemble]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {liveDay && model && detail ? (
        <SheetBody
          day={liveDay}
          model={model}
          detail={detail}
          ensembleLoading={ensembleLoading}
          layer={layer}
          onLayer={setLayer}
          onClose={onClose}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: palette.appBg, justifyContent: 'center' }}>
          <ActivityIndicator color={palette.accent} />
        </View>
      )}
    </Modal>
  );
}

/**
 * The sheet's contents, separate so the `Modal` above never unmounts while it is up.
 *
 * That separation is the whole point. The guard used to sit in front of the modal —
 * `if (!day || !model || !detail) return null` — and a presented modal that unmounts
 * is a dismissed one. `model` is null for a moment on every location change and
 * every refresh, because the sources are cleared before the new ones arrive, so a
 * sheet left open across one of those closed itself with no one having touched it.
 * Now the modal stays up and shows a spinner while the model is between runs.
 */
function SheetBody({
  day, model, detail, ensembleLoading, layer, onLayer, onClose,
}: {
  day: Day;
  model: ForecastModel;
  detail: ReturnType<typeof buildDayDetail>;
  ensembleLoading?: boolean;
  layer: LayerKey;
  onLayer: (k: LayerKey) => void;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);
  const title = `${names[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  const narrative = precipNarrative(day);
  const agreement = spreadLabel(day);

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[3],
          }}
        >
          <WeatherIcon wmo={day.dayIcon ?? day.wmo} isDay={1} size={28} />
          <View style={{ flex: 1 }}>
            <Text variant="locationName" color={palette.inkHeading}>
              {title}
            </Text>
            <Text variant="caption" color={palette.muted}>
              {wmoText(day.dayIcon ?? day.wmo, prefs.lang)} · {detail.sourceLabel}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('close', prefs.lang)}
            hitSlop={10}
            style={[
              {
                width: 32, height: 32, borderRadius: 16,
                backgroundColor: palette.cream2,
                alignItems: 'center', justifyContent: 'center',
              },
            ]}
          >
            <Icon name="x" size={15} color={palette.muted} weight="bold" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space[5],
            paddingBottom: insets.bottom + space[10],
            gap: space[4],
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Precipitation leads with what the ensemble actually says, in a
              sentence. Every other section — overview included — goes straight to
              its own figures. */}
          {layer === 'precip' && narrative ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] }}>
                <Text variant="eyebrow" color={palette.muted}>
                  {/* The translated string already names the model and a member
                      count, so prefixing nMembers produced "50 ECMWF ENS 51
                      members". The live count is the honest one: ECMWF publishes
                      50 perturbed members plus a control run. */}
                  {day.nMembers} modelleden
                </Text>
                {agreement ? (
                  <View
                    style={{
                      marginLeft: 'auto',
                      paddingVertical: 3, paddingHorizontal: 10,
                      borderRadius: radius.pill,
                      backgroundColor:
                        agreement === 'eens' ? palette.accentTint
                          : agreement === 'oneens' ? palette.warnBg
                            : palette.cream2,
                    }}
                  >
                    <Text
                      variant="caption"
                      weight="bold"
                      color={agreement === 'oneens' ? palette.valHigh : palette.accentDark}
                    >
                      Leden {agreement}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="bodySm" color={palette.ink}>
                {narrative}
              </Text>
            </Card>
          ) : null}

          <Card>
            <SectionTabs active={layer} onChange={onLayer} />
            <Rule soft style={{ marginBottom: space[3] }} />
            <LayerSection layer={layer} day={day} detail={detail} />
            {ensembleLoading && layer !== 'overview' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2] }}>
                <ActivityIndicator size="small" color={palette.muted} />
                <Text variant="caption" color={palette.muted}>
                  Spreiding per uur laden…
                </Text>
              </View>
            ) : null}
            <HourlyList layer={layer} hours={detail.hours} sourceLabel={detail.sourceLabel} />
          </Card>
        </ScrollView>
    </View>
  );
}

/** The same five sections as the layer switcher, so the sheet matches the list. */
function SectionTabs({
  active, onChange,
}: { active: LayerKey; onChange: (k: LayerKey) => void }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingBottom: space[3] }}
    >
      {LAYERS.map((l) => {
        const on = l.key === active;
        return (
          <Pressable
            key={l.key}
            onPress={() => onChange(l.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: 7, paddingHorizontal: 13,
              borderRadius: radius.pill,
              backgroundColor: on ? palette.accentTint : 'transparent',
            }}
          >
            <Icon name={l.icon} size={14} color={on ? palette.accentDark : palette.muted} />
            <Text
              variant="label"
              weight={on ? 'bold' : 'medium'}
              color={on ? palette.accentDark : palette.muted}
            >
              {t(l.labelKey, prefs.lang)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The chart and figures for the selected measurand. */
function LayerSection({
  layer, day, detail,
}: { layer: LayerKey; day: Day; detail: ReturnType<typeof buildDayDetail> }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const hours = detail.hours;
  const labels = hours.map((h) => h.time.slice(11, 13));
  const row = layerRow(day, layer, prefs.showSpread, detail.dayIndex);
  const v = resolveDayValues(day, { dayIndex: detail.dayIndex });
  const hasEns = day.ensLoaded ?? false;
  // One day, so the scale is that day's own — which is what the web app's popups do,
  // and why the bar there is wider than the sliver a shared weekly scale would give.
  const scale = beamScale([day], layer, 52);
  const mm = (x: number | null) => (x != null ? `${fmtMm(x)} mm` : '—');
  const deg = (x: number | null) =>
    x != null ? `${convTemp(x, prefs.tempUnit)}${tempUnitLabel(prefs.tempUnit)}` : '—';
  const kmh = (x: number | null) =>
    x != null ? `${convWind(x, prefs.windUnit)} ${windUnitLabel(prefs.windUnit)}` : '—';
  const pct = (x: number | null) => (x != null ? `${Math.round(x)}%` : '—');

  switch (layer) {
    // The overview repeats the list row, then everything the day is made of — the
    // same figures the per-measurand sections show one at a time.
    case 'overview':
      return (
        <>
          <OverviewDayRow day={day} dayIndex={detail.dayIndex} />
          <SummaryCells day={day} dayIndex={detail.dayIndex} />
        </>
      );

    case 'precip':
      return (
        <>
          <DayBar
            label={t('tabPrecip', prefs.lang)}
            scale={scale}
            p10={day.precipP10} p25={day.precipP25} p50={day.precipMedian}
            p75={day.precipP75} p90={day.precipP90}
            value={v.precip.value}
            direct={v.precip.direct}
            color={palette.valPrecip}
            format={mm}
            hasEns={hasEns}
          />
          <View style={{ height: space[4] }} />
          <SpreadChart
            labels={labels}
            color={palette.valPrecip}
            unit=" mm"
            showZero
            clampMin={0}
            series={{
              values: hours.map((h) => h.precip ?? null),
              band: prefs.showSpread
                ? hours.map((h) => (h.ens ? { lo: h.ens.precipP10, hi: h.ens.precipP90 } : null))
                : undefined,
            }}
          />
          <StatRow
            items={[
              { label: 'Mediaan', value: `${fmtMm(day.precipMedian)} mm` },
              { label: 'P90', value: `${fmtMm(day.precipP90)} mm` },
              { label: 'Kans', value: `${Math.round(day.pChance)}%` },
            ]}
          />
        </>
      );

    case 'temp':
      return (
        <>
          {/* Maximum and minimum are separate questions, so they get separate bars —
              the web app's temperature popup does the same. */}
          <DayBar
            label={t('maxTemp', prefs.lang)}
            scale={scale}
            p10={day.tempMaxP10} p25={day.tempMaxP25} p50={day.tempMaxP50}
            p75={day.tempMaxP75} p90={day.tempMaxP90}
            value={v.tempMax.value}
            direct={v.tempMax.direct}
            color={palette.valHigh}
            format={deg}
            hasEns={hasEns}
          />
          <View style={{ height: space[4] }} />
          <DayBar
            label={t('minTemp', prefs.lang)}
            scale={scale}
            p10={day.tempMinP10} p25={day.tempMinP25} p50={day.tempMinP50}
            p75={day.tempMinP75} p90={day.tempMinP90}
            value={v.tempMin.value}
            direct={v.tempMin.direct}
            color={palette.valLow}
            format={deg}
            hasEns={hasEns}
          />
          <View style={{ height: space[4] }} />
          <SpreadChart
            labels={labels}
            color={palette.valTemp}
            unit="°"
            series={{
              values: hours.map((h) => convTemp(h.temp, prefs.tempUnit)),
              band: prefs.showSpread
                ? hours.map((h) =>
                    h.ens?.temp
                      ? {
                          lo: convTemp(h.ens.temp.p10, prefs.tempUnit) ?? 0,
                          hi: convTemp(h.ens.temp.p90, prefs.tempUnit) ?? 0,
                        }
                      : null
                  )
                : undefined,
            }}
          />
          <StatRow
            items={[
              { label: t('maxTemp', prefs.lang), value: `${convTemp(row.primary, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}` },
              { label: t('minTemp', prefs.lang), value: `${convTemp(row.secondary, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}` },
              {
                label: t('spread', prefs.lang),
                value: row.spread
                  ? `${convTemp(row.spread.lo, prefs.tempUnit)}–${convTemp(row.spread.hi, prefs.tempUnit)}°`
                  : '—',
              },
            ]}
          />
        </>
      );

    case 'wind':
      return (
        <>
          <DayBar
            label={t('tabWind', prefs.lang)}
            scale={scale}
            p10={day.windP10} p25={day.windP25} p50={day.windP50}
            p75={day.windP75} p90={day.windP90}
            value={v.wind.value}
            direct={v.wind.direct}
            color={palette.valWind}
            format={kmh}
            hasEns={hasEns}
          />
          <View style={{ height: space[4] }} />
          <SpreadChart
            labels={labels}
            color={palette.inkHeading}
            unit=""
            showZero
            clampMin={0}
            series={{
              values: hours.map((h) => convWind(h.wind, prefs.windUnit)),
              secondary: hours.map((h) => convWind(h.gusts, prefs.windUnit)),
              band: prefs.showSpread
                ? hours.map((h) =>
                    h.ens?.wind
                      ? {
                          lo: convWind(h.ens.wind.p10, prefs.windUnit) ?? 0,
                          hi: convWind(h.ens.wind.p90, prefs.windUnit) ?? 0,
                        }
                      : null
                  )
                : undefined,
            }}
          />
          <StatRow
            items={[
              { label: t('windspeed', prefs.lang), value: `${convWind(day.windP50, prefs.windUnit) ?? '—'} ${windUnitLabel(prefs.windUnit)}` },
              { label: t('windGust', prefs.lang), value: `${convWind(day.hresWindMax ?? null, prefs.windUnit) ?? '—'} ${windUnitLabel(prefs.windUnit)}` },
              { label: 'P90', value: `${convWind(day.windP90, prefs.windUnit) ?? '—'} ${windUnitLabel(prefs.windUnit)}` },
            ]}
          />
        </>
      );

    case 'humidity':
      return (
        <>
          <DayBar
            label={t('relHumidity', prefs.lang)}
            scale={scale}
            p10={day.humidityP10} p25={day.humidityP25} p50={day.humidityMedian}
            p75={day.humidityP75} p90={day.humidityP90}
            value={v.humidityMax.value}
            direct={v.humidityMax.direct}
            color={palette.accentDark}
            format={pct}
            hasEns={hasEns}
          />
          <View style={{ height: space[4] }} />
          <SpreadChart
            labels={labels}
            color={palette.accent}
            unit="%"
            series={{ values: hours.map((h) => h.humidity) }}
          />
          <StatRow
            items={[
              { label: t('relHumidity', prefs.lang), value: row.primary != null ? `${Math.round(row.primary)}%` : '—' },
              { label: t('dewpoint', prefs.lang), value: dewpointLabel(hours, prefs.tempUnit) },
              { label: 'Bereik', value: row.note ?? '—' },
            ]}
          />
        </>
      );

    case 'sun':
      return (
        <>
          <SpreadChart
            labels={labels}
            color={palette.valSun}
            unit=" m"
            showZero
            clampMin={0}
            series={{ values: hours.map((h) => h.sunMin) }}
          />
          <StatRow
            items={[
              { label: t('sunHours', prefs.lang), value: day.sunHours != null ? `${day.sunHours.toFixed(1).replace('.', ',')} u` : '—' },
              { label: t('evap', prefs.lang), value: day.et0 != null ? `${fmtMm(day.et0)} mm` : '—' },
              { label: 'Model', value: sunModelLabel(day.sunModel) },
            ]}
          />
          {day.sunOpacity != null ? (
            <Text variant="caption" color={palette.muted} style={{ marginTop: space[2] }}>
              Hoge-bewolkingsopaciteit {day.sunOpacity.toFixed(2).replace('.', ',')}
              {day.sunOpacityDerived ? ' (afgeleid uit straling)' : ' (standaardwaarde)'}
            </Text>
          ) : null}
        </>
      );
  }
}

function dewpointLabel(hours: { dewpoint: number | null }[], unit: Parameters<typeof convTemp>[1]): string {
  const values = hours.map((h) => h.dewpoint).filter((v): v is number => v != null);
  if (!values.length) return '—';
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return `${convTemp(mean, unit)}${tempUnitLabel(unit)}`;
}

function sunModelLabel(m: Day['sunModel']): string {
  return m === 'harmonie' ? 'HARMONIE' : m === 'ecmwf' ? 'ECMWF' : m === 'daily' ? 'Dagwaarde' : '—';
}

function StatRow({ items }: { items: { label: string; value: string }[] }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginTop: space[3] }}>
      {items.map((it, i) => (
        <View
          key={it.label}
          style={{
            flex: 1, alignItems: 'center',
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: palette.hairlineSoft,
          }}
        >
          <Text variant="caption" color={palette.muted} align="center">
            {it.label}
          </Text>
          <Text variant="label" weight="bold" color={palette.inkHeading} tabular style={{ marginTop: 3 }}>
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The whole day at a glance, for a reader who does not want the charts.
 *  Values come from `resolveDayValues`, so the cells agree with the list row above
 *  them — including which model each figure came from. */
function SummaryCells({ day, dayIndex }: { day: Day; dayIndex: number }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const v = resolveDayValues(day, { dayIndex });

  const cells: { label: string; value: string; color?: string }[] = [
    {
      label: t('maxTemp', prefs.lang),
      value: `${convTemp(v.tempMax.value, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}`,
      color: palette.valHigh,
    },
    {
      label: t('minTemp', prefs.lang),
      value: `${convTemp(v.tempMin.value, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}`,
      color: palette.valLow,
    },
    {
      label: t('tabPrecip', prefs.lang),
      value: v.precip.value != null ? `${fmtMm(v.precip.value)} mm` : '—',
      color: v.precip.value ? palette.valPrecip : palette.valPrecipZero,
    },
    {
      label: t('tabWind', prefs.lang),
      value: `${convWind(v.wind.value, prefs.windUnit) ?? '—'} ${windUnitLabel(prefs.windUnit)}`,
    },
    {
      label: t('sunHours', prefs.lang),
      value: v.sunHours != null ? `${v.sunHours.toFixed(1).replace('.', ',')} u` : '—',
      color: palette.valSun,
    },
    {
      label: t('evap', prefs.lang),
      value: v.et0 != null ? `${fmtMm(v.et0)} mm` : '—',
    },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space[2] }}>
      {cells.map((c, i) => (
        <View
          key={c.label}
          style={{
            width: '33.33%',
            paddingVertical: space[3],
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: palette.hairlineSoft,
          }}
        >
          <Text variant="caption" color={palette.muted}>
            {c.label}
          </Text>
          <Text
            variant="stat"
            color={c.color ?? palette.inkHeading}
            tabular
            style={{ marginTop: 4, fontSize: 18 }}
          >
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
