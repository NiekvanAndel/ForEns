/**
 * Overzicht — every saved location in one screen.
 *
 * The rest of the app is one location at a time: the pager picks it, and each tab
 * answers for it. That is right for reading a place closely and wrong for the
 * question an arable grower opens the app with, which is about all of them at once —
 * what was it, what is it, what is coming, and can I get on the land. Answering that
 * meant swiping through five locations on four tabs.
 *
 * It is a page rather than a tab, reached from the top-left of the row, because the
 * tabs are the places you *work* and this is where you *start*. The map, which is the
 * other thing that leaves the page, moved to the right-hand slot opposite it.
 *
 * ## It fetches only what it draws
 *
 * Every source here costs a request per saved location. `neededSources` reads the
 * reader's arrangement and answers which to switch on, so hiding a widget makes the
 * page cheaper and not merely shorter — a grower with eight fields who wants the
 * rainfall ranking pays eight requests, not twenty-four.
 *
 * ## Every widget is a way in
 *
 * A summary that cannot be acted on is a poster. Tapping a location in any widget
 * selects it and opens the tab that widget is about — rainfall goes to 'Grafiek', an
 * outlook to 'Verwachting'. That is the difference between a page you glance at and
 * one you start the day on.
 *
 * ## Arranging it
 *
 * The pencil opens the same editor the blocks on 'Actueel' use, over the same
 * `TileLayout` machinery: drag to reorder, tap to switch off. Which is also the
 * groundwork for a set-up wizard — a wizard is a first-run path that writes this
 * arrangement, and everything it would need to write already exists.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { radius, space, useTheme } from '../theme';
import { useWideLayout } from '../ui/layout';
import { Text } from '../ui/Text';
import { Icon } from '../ui/Icon';
import { TileEditor } from '../ui/current/TileEditor';
import {
  AdviceWidget, AlertsWidget, ConfidenceWidget, DiseaseWidget, FrostWidget, HeroWidget,
  LongTermWidget,
  MapWidget, NearTermWidget, NowcastWidget, OutlookWidget, RadarWidget, Rain24Widget,
  RainNextWidget, SoilWidget, SummaryWidget, TempWidget, WindWidget, WorkWidget,
  type WidgetProps,
} from '../ui/overview/widgets';
import { WidgetSettingsForm } from '../ui/overview/WidgetSettingsForm';
import { usePrefs } from '../state/prefs';
import {
  useAllLocationConditions, useAllLocationEnsembles, useAllLocationNowcasts,
  useAllLocationOutlooks,
} from '../state/allLocations';
import { useAllLocationSoil } from '../state/soilStations';
import { useAllLocationDisease } from '../state/disease';
import {
  arrangeWidgets, neededSources, OVERVIEW_WIDGETS, widgetRows, widgetSettings,
} from '../core/overview';
import { buildOverviewRow } from '../core/overviewData';
import { deriveAlert } from '../core/model/alert';
import { ta, type AppStringKey } from '../core/i18n';

/** Which component draws which entry. The catalogue says what a widget is; this says
 *  what it looks like, and nothing else in the app has to know either. */
const WIDGET_VIEWS: Record<string, (props: WidgetProps) => React.ReactElement | null> = {
  summary: SummaryWidget,
  advice: AdviceWidget,
  alerts: AlertsWidget,
  rain24: Rain24Widget,
  rainNext: RainNextWidget,
  temp: TempWidget,
  wind: WindWidget,
  frost: FrostWidget,
  workability: WorkWidget,
  outlook: OutlookWidget,
  confidence: ConfidenceWidget,
  soil: SoilWidget,
  disease: DiseaseWidget,
  map: MapWidget,
  // The selected location's own cards. They take the same props and ignore them:
  // their subject is `usePrefs().location`, not the rows.
  hero: HeroWidget,
  nowcast: NowcastWidget,
  radar: RadarWidget,
  nearTerm: NearTermWidget,
  longTerm: LongTermWidget,
};

/** What each widget is called, for its own heading and for the editor's list. */
const WIDGET_LABEL: Record<string, AppStringKey> = {
  summary: 'ovSummary', advice: 'ovAdvice', alerts: 'ovAlerts',
  rain24: 'ovRain24', rainNext: 'ovRainNext', temp: 'ovTemp', wind: 'ovWind',
  frost: 'ovFrost', workability: 'ovWork', outlook: 'ovOutlook',
  confidence: 'ovConfidence', map: 'ovMap', soil: 'ovSoil', disease: 'diseaseTitle',
  hero: 'ovHero', nowcast: 'ovNowcast', radar: 'ovRadar',
  nearTerm: 'ovNearTerm', longTerm: 'ovLongTerm',
};

export default function OverviewScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWideLayout();
  const router = useRouter();
  const { prefs, setPrefs, selectLocation } = usePrefs();
  const [editing, setEditing] = useState(false);

  const layout = prefs.overview;
  const widgets = useMemo(() => arrangeWidgets(layout), [layout]);
  const sources = useMemo(() => neededSources(layout), [layout]);

  const conditions = useAllLocationConditions(sources.has('conditions'));
  const nowcasts = useAllLocationNowcasts(sources.has('nowcast'));
  const outlooks = useAllLocationOutlooks(sources.has('outlook'));
  const ensembles = useAllLocationEnsembles(sources.has('ensemble'));
  // Every field on the account, for the soil widget. One request per sensor, and only
  // once that widget is actually on the page.
  const fields = useAllLocationSoil(sources.has('soil'));
  // The models per location. One offset for all of them — see `useAllLocationDisease`.
  //
  // The device's own offset, which is the one place in this app that uses it. This
  // page has no forecast context and so no location offset, and the alternative is a
  // request per place to learn one. It is exact while the grower is in the country
  // they farm in, which is nearly always; while travelling a day boundary sits off by
  // the difference, which can move an hour between days. 'Nu' and 'Actueel' use the
  // location's real offset, so the surfaces a decision is made on are not affected.
  const deviceOffsetSec = -new Date().getTimezoneOffset() * 60;
  const disease = useAllLocationDisease(deviceOffsetSec, sources.has('disease'));

  const rows = useMemo(
    () =>
      conditions.map((c, i) =>
        buildOverviewRow({
          index: i,
          name: c.location.name,
          hasStation: c.hasStation,
          // A field's rain is measured too, and the dot has to know it — the same
          // flag the page's own blocks read. See `applySoilPrecip`.
          precipMeasured: c.precipMeasured,
          loading: c.loading,
          model: c.model,
          outlook: outlooks[i] ?? null,
          ensemble: ensembles[i] ?? null,
        })
      ),
    [conditions, outlooks, ensembles]
  );

  // The same judgement the block on 'Nu' makes, per location — so a warning here and
  // a warning there cannot be different warnings about the same field.
  const alerts = useMemo(
    () =>
      conditions.map((c, i) =>
        prefs.alertsEnabled
          ? deriveAlert(c.model, nowcasts[i] ?? null, {
              lang: prefs.lang, tempUnit: prefs.tempUnit, windUnit: prefs.windUnit,
            })
          : null
      ),
    [conditions, nowcasts, prefs.alertsEnabled, prefs.lang, prefs.tempUnit, prefs.windUnit]
  );

  /** Select a location and go to the tab that answers for what was tapped. */
  const open = (index: number, page: 'index' | 'forecast' | 'grafiek' | 'actueel') => {
    selectLocation(index);
    router.push(page === 'index' ? '/' : `/${page}`);
  };

  const models = useMemo(() => conditions.map((c) => c.model), [conditions]);
  // Two columns wherever there is room for them — sideways on a phone, and on an iPad
  // in either orientation. A widget that asks for a full width is asking for a
  // portrait phone's, which is what half of this is. See `widgetRows`.
  const rowsOfWidgets = widgetRows(widgets, wide);

  /** Everything a widget gets except its own settings, which differ per widget. */
  const shared = { rows, alerts, models, nowcasts, fields, disease, onOpen: open };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_left' }} />
      <View style={{ flex: 1, backgroundColor: palette.appBg }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingLeft: space[5] + insets.left,
            paddingRight: space[5] + insets.right,
            paddingTop: insets.top + space[3],
            paddingBottom: space[3],
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={ta('back', prefs.lang)}
            hitSlop={10}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: palette.cream2,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="caret-left" size={16} color={palette.muted} weight="bold" />
          </Pressable>

          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="screenTitle" color={palette.inkHeading}>
              {ta('ovTitle', prefs.lang)}
            </Text>
            <Text variant="caption" color={palette.muted}>
              {ta('ovSubtitle', prefs.lang)}
            </Text>
          </View>

          {/* The pencil, exactly as on 'Actueel': arranging a page is something you do
              to the page, not a destination. */}
          <Pressable
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setEditing(true); }}
            accessibilityRole="button"
            accessibilityLabel={ta('ovEdit', prefs.lang)}
            hitSlop={10}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: palette.cream2,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="pencil-simple" size={15} color={palette.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingLeft: space[5] + insets.left,
            paddingRight: space[5] + insets.right,
            paddingBottom: insets.bottom + space[10],
            gap: space[4],
          }}
          showsVerticalScrollIndicator={false}
        >
          {!prefs.locations.length ? (
            <View
              style={{
                backgroundColor: palette.appCard, borderRadius: radius.appCard,
                padding: space[6],
              }}
            >
              <Text variant="bodySm" color={palette.muted}>
                {ta('ovNoLocations', prefs.lang)}
              </Text>
            </View>
          ) : (
            rowsOfWidgets.map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space[4] }}>
                {row.map((w) => {
                  const View_ = WIDGET_VIEWS[w.id];
                  if (!View_) return null;
                  const props: WidgetProps = {
                    ...shared,
                    settings: widgetSettings(prefs.overviewSettings, w.id),
                  };
                  return (
                    // A half in a row of one still takes half the width: stretching it
                    // would give it a prominence its author did not ask for.
                    <View key={w.id} style={{ flex: w.size === 'half' ? 1 : 1 }}>
                      <View_ {...props} />
                    </View>
                  );
                })}
                {row.length === 1 && (wide || row[0]?.size === 'half')
                  ? <View style={{ flex: 1 }} />
                  : null}
              </View>
            ))
          )}
        </ScrollView>

        <TileEditor
          visible={editing}
          onClose={() => setEditing(false)}
          title={ta('ovEdit', prefs.lang)}
          hint={ta('ovEditHint', prefs.lang)}
          all={OVERVIEW_WIDGETS.map((w) => ({
            id: w.id,
            title: ta(WIDGET_LABEL[w.id] ?? 'ovSummary', prefs.lang),
            settings: !!w.options?.length,
          }))}
          layout={layout}
          onChange={(next) => setPrefs({ overview: next(prefs.overview) })}
          // The settings of one widget, as a face of this same sheet. See
          // `WidgetSettingsForm` for why it is not a modal of its own.
          renderSettings={(id) => (
            <WidgetSettingsForm
              id={id}
              title={ta(WIDGET_LABEL[id] ?? 'ovSummary', prefs.lang)}
            />
          )}
        />
      </View>
    </>
  );
}
