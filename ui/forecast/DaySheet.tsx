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
 * The order is deliberate: the sentence a reader can act on comes first, the
 * meteogram second, and the per-measurand detail below that.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Card, CardHeader, Rule } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { WeatherIcon } from '../WeatherIcon';
import { Meteogram } from '../charts/Meteogram';
import { SpreadChart } from '../charts/SpreadChart';
import { usePrefs } from '../../state/prefs';
import { buildDayDetail, precipNarrative, spreadLabel } from '../../core/model/dayDetail';
import { LAYERS, layerRow, type LayerKey } from '../../core/model/layers';
import type { DayEnsemble } from '../../core/sources/ensembleHourly';
import type { Day, ForecastModel } from '../../core/model/types';
import {
  convTemp, convWind, dayNames, fmtMm, t, ta, tempUnitLabel, windUnitLabel, wmoText,
} from '../../core/i18n';

export interface DaySheetProps {
  visible: boolean;
  day: Day | null;
  model: ForecastModel | null;
  ensemble?: DayEnsemble;
  ensembleLoading?: boolean;
  onClose: () => void;
}

export function DaySheet({
  visible, day, model, ensemble, ensembleLoading, onClose,
}: DaySheetProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const [layer, setLayer] = useState<LayerKey>('precip');

  // Every sheet opens on the same section, rather than inheriting the last one.
  useEffect(() => {
    if (visible) setLayer('precip');
  }, [visible, day?.date]);

  const detail = useMemo(
    () => (model && day ? buildDayDetail(model, day, ensemble) : null),
    [model, day, ensemble]
  );

  if (!day || !model || !detail) return null;

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(prefs.lang);
  const title = `${names[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  const narrative = precipNarrative(day);
  const agreement = spreadLabel(day);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
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
            <Icon name="caret-right" size={16} color={palette.muted} weight="bold" />
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
          {/* The sentence first: what the ensemble actually says about the day. */}
          {narrative ? (
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
            <CardHeader icon="clock" label={t('perHour', prefs.lang)} />
            <Meteogram hours={detail.hours} />
            {ensembleLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2] }}>
                <ActivityIndicator size="small" color={palette.muted} />
                <Text variant="caption" color={palette.muted}>
                  Spreiding per uur laden…
                </Text>
              </View>
            ) : null}
          </Card>

          <Card>
            <SectionTabs active={layer} onChange={setLayer} />
            <Rule soft style={{ marginBottom: space[3] }} />
            <LayerSection layer={layer} day={day} detail={detail} />
          </Card>

          <SummaryGrid day={day} />
        </ScrollView>
      </View>
    </Modal>
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
  const row = layerRow(day, layer, prefs.showSpread);

  switch (layer) {
    case 'precip':
      return (
        <>
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
          <SpreadChart
            labels={labels}
            color={palette.valTemp}
            unit="°"
            series={{
              values: hours.map((h) => convTemp(h.temp, prefs.tempUnit)),
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
          <SpreadChart
            labels={labels}
            color={palette.inkHeading}
            unit=""
            showZero
            clampMin={0}
            series={{
              values: hours.map((h) => convWind(h.wind, prefs.windUnit)),
              secondary: hours.map((h) => convWind(h.gusts, prefs.windUnit)),
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

/** The whole day at a glance, for a reader who does not want the charts. */
function SummaryGrid({ day }: { day: Day }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  const cells: { label: string; value: string; color?: string }[] = [
    {
      label: t('maxTemp', prefs.lang),
      value: `${convTemp(day.hresTempMax ?? day.tempHi, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}`,
      color: palette.valHigh,
    },
    {
      label: t('minTemp', prefs.lang),
      value: `${convTemp(day.hresTempMin ?? day.tempLo, prefs.tempUnit) ?? '—'}${tempUnitLabel(prefs.tempUnit)}`,
      color: palette.valLow,
    },
    {
      label: t('tabPrecip', prefs.lang),
      value: `${fmtMm(day.precipMedian)} mm`,
      color: day.precipMedian > 0 ? palette.valPrecip : palette.valPrecipZero,
    },
    {
      label: t('tabWind', prefs.lang),
      value: `${convWind(day.windP50, prefs.windUnit) ?? '—'} ${windUnitLabel(prefs.windUnit)}`,
    },
    {
      label: t('sunHours', prefs.lang),
      value: day.sunHours != null ? `${day.sunHours.toFixed(1).replace('.', ',')} u` : '—',
      color: palette.valSun,
    },
    {
      label: t('evap', prefs.lang),
      value: day.et0 != null ? `${fmtMm(day.et0)} mm` : '—',
    },
  ];

  return (
    <Card>
      <CardHeader icon="info" label={t('tabOverview', prefs.lang)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((c, i) => (
          <View
            key={c.label}
            style={{
              width: '33.33%',
              paddingVertical: space[3],
              alignItems: 'center',
              borderTopWidth: i >= 3 ? 1 : 0,
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
    </Card>
  );
}
