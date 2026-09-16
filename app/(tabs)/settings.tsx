/**
 * Instellingen.
 *
 * Three levels, as iOS does it: an index of subjects, a page per subject, and — for
 * a setting with more than a couple of values — a page of choices with a tick
 * against the current one. Every row carries its current value, so the answer to
 * "what is this set to?" is on the level above rather than inside.
 *
 * A leaf page is rendered *inside* its subject page rather than beside it, so the
 * two genuinely stack. Presented as siblings, moving between them would dismiss one
 * modal and present another in the same frame, which iOS does not reliably survive.
 *
 * Pages arrive from the right and leave to the right, as a navigation stack moves —
 * see `SubjectPage`. Locations are reordered by dragging one where it belongs rather
 * than by tapping an arrow per slot — see `LocationList`.
 *
 * The alternative, and what this replaces, was every control on one screen: five
 * languages, four wind units and three temperature scales as rows of pills, none of
 * which could be read at a glance.
 *
 * ## Meldingen, and its two layers
 *
 * The subject was hidden for a while at the client's direction; it is back, and with
 * a distinction it did not have before. The outer layer is whether the app shows a
 * significant-weather block at all — a thing you read when you open it. The inner one
 * is whether the same alerts are also pushed, which is a different promise: it
 * arrives whether the app is open or not, so it costs attention rather than screen.
 *
 * Push off is the default and turning it on is what asks for permission, rather than
 * a prompt at launch. A refusal puts the toggle back: a switch left on over a
 * permission that was never granted is a person waiting for notifications that
 * cannot arrive.
 */
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Columns, usePagePadding } from '../../ui/layout';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { ChoiceList, Group, NavRow, Row, Toggle } from '../../ui/settings/Controls';
import { SubjectPage } from '../../ui/settings/SubjectPage';
import { LocationList } from '../../ui/settings/LocationList';
import { LocationSearch } from '../../ui/settings/LocationSearch';
import { IntegrationCard } from '../../ui/settings/IntegrationCard';
import { SourceCard } from '../../ui/settings/SourceCard';
import { UserAlertList } from '../../ui/settings/UserAlertList';
import { usePrefs } from '../../state/prefs';
import { enablePush, pushEndpoint } from '../../state/push';
import { useForecast } from '../../state/forecast';
import { t, ta, LANG_CODES, tempUnitLabel, windUnitLabel } from '../../core/i18n';
import type { LangCode } from '../../core/i18n';
import { agroIntegration, type ThemeMode } from '../../core/prefs';
import type { FontSizePref, PresUnit, TempUnit, WindUnit } from '../../core/i18n/units';

const APP_VERSION = '0.1';

/** Every page below the index. Subjects and the leaves inside them. */
type Page =
  | 'display' | 'lang' | 'fontSize' | 'theme'
  | 'units' | 'windUnit' | 'tempUnit' | 'presUnit'
  | 'model' | 'source'
  | 'notifications'
  | 'locations' | 'integrations';

/** Which subject a page belongs to, so a subject stays presented while one of its
 *  leaves is open. */
const PARENT: Partial<Record<Page, Page>> = {
  lang: 'display', fontSize: 'display', theme: 'display',
  windUnit: 'units', tempUnit: 'units', presUnit: 'units',
};

const LANG_NAMES: Record<LangCode, string> = {
  nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español',
};

export default function SettingsScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const pagePadding = usePagePadding();
  const { prefs, setPref } = usePrefs();
  const { refresh } = useForecast();
  const [page, setPage] = useState<Page | null>(null);

  const tap = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  /** Preferences that change what is fetched need the forecast reloading. */
  const setAndReload = useCallback(
    <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
      tap();
      setPref(key, value);
      refresh();
    },
    [setPref, refresh, tap]
  );

  /** A leaf choice: set it, then step back to the page that opened it, which is
   *  what iOS does and what makes a tick feel like an answer rather than a toggle. */
  const choose = useCallback(
    <K extends keyof typeof prefs>(key: K, back: Page) =>
      (value: (typeof prefs)[K]) => {
        tap();
        setPref(key, value);
        setPage(back);
      },
    [setPref, tap]
  );

  /** True while this page is open, or while one of its leaves is. */
  const showing = (subject: Page) => page === subject || PARENT[page as Page] === subject;

  const themeLabel =
    prefs.theme === 'light' ? t('light', prefs.lang)
      : prefs.theme === 'dark' ? t('dark', prefs.lang)
        : ta('auto', prefs.lang);
  const fontLabel = prefs.fontSize === 'sm' ? 'A' : prefs.fontSize === 'md' ? 'A+' : 'A++';
  const windLabel = windUnitLabel(prefs.windUnit);
  const modelLabel = prefs.useHarmonie ? 'HARMONIE-AROME' : 'ECMWF IFS';
  const agro = agroIntegration(prefs);

  /**
   * Turning push on asks iOS for permission, and there are three answers, not two.
   *
   * Granted flips the switch. Refused leaves it off with a line saying where to
   * change one's mind — a switch that silently springs back reads as a bug. And
   * *unavailable* — Expo Go, a simulator, anything without the native side — flips it
   * anyway and says why nothing will arrive: the preference is what the reader wants,
   * and what they want does not depend on which build they happen to be running.
   *
   * That third case is not hypothetical. It was collapsed into "refused", so a
   * developer who granted permission in Expo Go was told they had denied it, and the
   * switch would not move however often they tapped it.
   */
  const [pushProblem, setPushProblem] = useState<'denied' | 'unavailable' | null>(null);
  const togglePush = useCallback(
    async (on: boolean) => {
      tap();
      if (!on) {
        setPushProblem(null);
        setPref('pushEnabled', false);
        return;
      }
      const result = await enablePush();
      setPushProblem(result === 'granted' ? null : result);
      if (result !== 'denied') setPref('pushEnabled', true);
    },
    [setPref, tap]
  );

  const notifyLabel = !prefs.alertsEnabled
    ? ta('settingsOff', prefs.lang)
    : prefs.pushEnabled
      ? ta('pushNotifications', prefs.lang)
      : ta('settingsInApp', prefs.lang);

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <ScrollView
        contentContainerStyle={{
          ...pagePadding,
          paddingTop: insets.top + space[4],
          gap: space[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Columns spanning={1}>
          <Text variant="screenTitle" color={palette.inkHeading}>
            {t('settings', prefs.lang)}
          </Text>

          <Card pad={0}>
            <NavRow
              icon="circle-half"
              label={ta('display', prefs.lang)}
              value={`${LANG_NAMES[prefs.lang]} · ${themeLabel}`}
              onPress={() => { tap(); setPage('display'); }}
            />
            <NavRow
              icon="ruler"
              label={ta('units', prefs.lang)}
              value={`${windLabel} · ${tempUnitLabel(prefs.tempUnit)}`}
              onPress={() => { tap(); setPage('units'); }}
            />
            <NavRow
              icon="cloud-sun"
              label={ta('weatherModel', prefs.lang)}
              value={modelLabel}
              onPress={() => { tap(); setPage('model'); }}
            />
            <NavRow
              icon="bell"
              label={ta('notifications', prefs.lang)}
              value={notifyLabel}
              onPress={() => { tap(); setPage('notifications'); }}
            />
            <NavRow
              icon="dots-six-vertical"
              label={ta('myLocations', prefs.lang)}
              value={String(prefs.locations.length)}
              onPress={() => { tap(); setPage('locations'); }}
            />
            <NavRow
              icon="plugs-connected"
              label={ta('integrations', prefs.lang)}
              value={agro.connected ? (agro.account ?? ta('agroConnected', prefs.lang)) : ''}
              onPress={() => { tap(); setPage('integrations'); }}
            />
            <NavRow
              icon="info"
              label={ta('source', prefs.lang)}
              last
              onPress={() => { tap(); setPage('source'); }}
            />
          </Card>

          <Text variant="caption" color={palette.muted} align="center" style={{ lineHeight: 18 }}>
            ExactCast AI · versie {APP_VERSION} (iOS){'\n'}
            Weerdata: Open-Meteo · ECMWF · KNMI HARMONIE-AROME{'\n'}
            Radar: ExactCast AI nowcast (DGMR) · KNMI-radar
          </Text>
        </Columns>
      </ScrollView>

      {/* ── Weergave ─────────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={showing('display')}
        title={ta('display', prefs.lang)}
        onClose={() => setPage(null)}
      >
        <Card pad={0}>
          <NavRow
            icon="translate"
            label={t('lang', prefs.lang)}
            value={LANG_NAMES[prefs.lang]}
            onPress={() => { tap(); setPage('lang'); }}
          />
          <NavRow
            icon="text-aa"
            label={t('fontSize', prefs.lang)}
            value={fontLabel}
            onPress={() => { tap(); setPage('fontSize'); }}
          />
          <NavRow
            icon="circle-half"
            label={t('theme', prefs.lang)}
            value={themeLabel}
            last
            onPress={() => { tap(); setPage('theme'); }}
          />
        </Card>

        <SubjectPage
          visible={page === 'lang'}
          title={t('lang', prefs.lang)}
          onClose={() => setPage('display')}
        >
          <ChoiceList<LangCode>
            value={prefs.lang}
            onChange={choose('lang', 'display')}
            options={LANG_CODES.map((c) => ({ value: c, label: LANG_NAMES[c] }))}
          />
          <Text variant="caption" color={palette.muted} align="center">
            {ta('langHint', prefs.lang)}
          </Text>
        </SubjectPage>

        <SubjectPage
          visible={page === 'fontSize'}
          title={t('fontSize', prefs.lang)}
          onClose={() => setPage('display')}
        >
          <ChoiceList<FontSizePref>
            value={prefs.fontSize}
            onChange={choose('fontSize', 'display')}
            options={[
              { value: 'sm', label: 'A' },
              { value: 'md', label: 'A+' },
              { value: 'lg', label: 'A++' },
            ]}
          />
          <Text variant="caption" color={palette.muted} align="center">
            {ta('textSizeHint', prefs.lang)}
          </Text>
        </SubjectPage>

        <SubjectPage
          visible={page === 'theme'}
          title={t('theme', prefs.lang)}
          onClose={() => setPage('display')}
        >
          <ChoiceList<ThemeMode>
            value={prefs.theme}
            onChange={choose('theme', 'display')}
            options={[
              { value: 'light', label: t('light', prefs.lang) },
              { value: 'dark', label: t('dark', prefs.lang) },
              { value: 'auto', label: ta('auto', prefs.lang), hint: ta('themeHint', prefs.lang) },
            ]}
          />
        </SubjectPage>
      </SubjectPage>




      {/* ── Eenheden ─────────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={showing('units')}
        title={ta('units', prefs.lang)}
        onClose={() => setPage(null)}
      >
        <Card pad={0}>
          <NavRow
            icon="wind"
            label={t('wind', prefs.lang)}
            value={windLabel}
            onPress={() => { tap(); setPage('windUnit'); }}
          />
          <NavRow
            icon="thermometer-simple"
            label={t('temp', prefs.lang)}
            value={tempUnitLabel(prefs.tempUnit)}
            onPress={() => { tap(); setPage('tempUnit'); }}
          />
          <NavRow
            icon="drop-half"
            label={t('pres', prefs.lang)}
            value={prefs.presUnit}
            last
            onPress={() => { tap(); setPage('presUnit'); }}
          />
        </Card>

        <SubjectPage
          visible={page === 'windUnit'}
          title={t('wind', prefs.lang)}
          onClose={() => setPage('units')}
        >
          <ChoiceList<WindUnit>
            value={prefs.windUnit}
            onChange={choose('windUnit', 'units')}
            options={[
              { value: 'kmh', label: 'km/u', hint: 'Kilometer per uur' },
              { value: 'ms', label: 'm/s', hint: 'Meter per seconde' },
              { value: 'kn', label: 'kn', hint: 'Knopen' },
              { value: 'bft', label: 'Bft', hint: 'Beaufort' },
            ]}
          />
        </SubjectPage>

        <SubjectPage
          visible={page === 'tempUnit'}
          title={t('temp', prefs.lang)}
          onClose={() => setPage('units')}
        >
          <ChoiceList<TempUnit>
            value={prefs.tempUnit}
            onChange={choose('tempUnit', 'units')}
            options={[
              { value: 'C', label: '°C', hint: 'Celsius' },
              { value: 'F', label: '°F', hint: 'Fahrenheit' },
              { value: 'K', label: 'K', hint: 'Kelvin' },
            ]}
          />
        </SubjectPage>

        <SubjectPage
          visible={page === 'presUnit'}
          title={t('pres', prefs.lang)}
          onClose={() => setPage('units')}
        >
          <ChoiceList<PresUnit>
            value={prefs.presUnit}
            onChange={choose('presUnit', 'units')}
            options={[
              { value: 'hPa', label: 'hPa', hint: 'Hectopascal' },
              { value: 'mbar', label: 'mbar', hint: 'Millibar' },
              { value: 'inHg', label: 'inHg', hint: 'Inch kwik' },
            ]}
          />
        </SubjectPage>
      </SubjectPage>




      {/* ── Weermodel ────────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={page === 'model'}
        title={ta('weatherModel', prefs.lang)}
        onClose={() => setPage(null)}
      >
        <Group label={ta('weatherModel', prefs.lang)}>
          <Row icon="cloud-sun" label="HARMONIE-AROME" hint={t('harmonieHint', prefs.lang)}>
            <Toggle
              on={prefs.useHarmonie}
              onChange={(v) => setAndReload('useHarmonie', v)}
              label="HARMONIE-AROME"
            />
          </Row>
          <Row
            icon="chart-line"
            label={ta('showSpread', prefs.lang)}
            hint={ta('showSpreadHint', prefs.lang)}
            last
          >
            <Toggle
              on={prefs.showSpread}
              onChange={(v) => { tap(); setPref('showSpread', v); }}
              label={ta('showSpread', prefs.lang)}
            />
          </Row>
        </Group>
      </SubjectPage>

      <SubjectPage
        visible={page === 'source'}
        title={ta('source', prefs.lang)}
        onClose={() => setPage(null)}
      >
        <SourceCard />
      </SubjectPage>

      {/* ── Meldingen ────────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={page === 'notifications'}
        title={ta('notifications', prefs.lang)}
        onClose={() => setPage(null)}
      >
        {/* The outer layer: whether there is anything to notify about at all. With
            this off the block goes and so does every notification, which is why it
            is a group of its own above the rest rather than a fourth toggle in
            among them. */}
        <Group label={ta('settingsInApp', prefs.lang)}>
          <Row
            icon="warning"
            label={ta('alertBlocks', prefs.lang)}
            hint={ta('alertBlocksHint', prefs.lang)}
            last
          >
            <Toggle
              on={prefs.alertsEnabled}
              onChange={(v) => { tap(); setPref('alertsEnabled', v); }}
              label={ta('alertBlocks', prefs.lang)}
            />
          </Row>
        </Group>

        {/* The inner one, and everything it governs. Hidden rather than disabled
            while the block is off: a row of greyed switches invites tapping at
            something that cannot move, and the group above says why it is gone. */}
        {prefs.alertsEnabled ? (
          <>
            <Group label={ta('pushNotifications', prefs.lang)}>
              <Row
                icon="bell-ringing"
                label={ta('pushNotifications', prefs.lang)}
                hint={ta('pushNotificationsHint', prefs.lang)}
                last
              >
                <Toggle
                  on={prefs.pushEnabled}
                  onChange={(v) => { togglePush(v); }}
                  label={ta('pushNotifications', prefs.lang)}
                />
              </Row>
            </Group>

            {pushProblem ? (
              <Text
                variant="caption"
                color={pushProblem === 'denied' ? palette.warnTitle : palette.muted}
                style={{ paddingHorizontal: 6, lineHeight: 18 }}
              >
                {ta(pushProblem === 'denied' ? 'pushDenied' : 'pushUnsupported', prefs.lang)}
              </Text>
            ) : null}

            <Group label={ta('notifyAbout', prefs.lang)}>
              <Row icon="cloud-rain" label={ta('notifyRain', prefs.lang)} hint={ta('notifyRainHint', prefs.lang)}>
                <Toggle
                  on={prefs.notifyRain}
                  onChange={(v) => { tap(); setPref('notifyRain', v); }}
                  label={ta('notifyRain', prefs.lang)}
                />
              </Row>
              <Row icon="wind" label={ta('notifyWind', prefs.lang)} hint={ta('notifyWindHint', prefs.lang)}>
                <Toggle
                  on={prefs.notifyWind}
                  onChange={(v) => { tap(); setPref('notifyWind', v); }}
                  label={ta('notifyWind', prefs.lang)}
                />
              </Row>
              <Row icon="thermometer-simple" label={ta('notifyFrost', prefs.lang)} hint={ta('notifyFrostHint', prefs.lang)}>
                <Toggle
                  on={prefs.notifyFrost}
                  onChange={(v) => { tap(); setPref('notifyFrost', v); }}
                  label={ta('notifyFrost', prefs.lang)}
                />
              </Row>
              <Row icon="moon" label={ta('quietHours', prefs.lang)} hint={ta('quietHoursHint', prefs.lang)} last>
                <Toggle
                  on={prefs.quietHours}
                  onChange={(v) => { tap(); setPref('quietHours', v); }}
                  label={ta('quietHours', prefs.lang)}
                />
              </Row>
            </Group>

            {/* The reader's own thresholds, made from a block on 'Actueel'. Listed
                here and not there: a list of rules belongs with the other
                notification settings, and the page the weather is on is no place to
                keep one. */}
            <Group label={ta('alertMine', prefs.lang)}>
              <UserAlertList />
            </Group>

            {/* Said plainly rather than left for someone to discover: until the
                server exists these are scheduled by the phone, and iOS decides when
                it gets to run. See `core/push`. */}
            {pushEndpoint() ? null : (
              <Text variant="caption" color={palette.muted} style={{ paddingHorizontal: 6, lineHeight: 18 }}>
                {ta('pushUnavailable', prefs.lang)}
              </Text>
            )}
          </>
        ) : null}
      </SubjectPage>

      {/* ── Integraties ──────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={page === 'integrations'}
        title={ta('integrations', prefs.lang)}
        onClose={() => setPage(null)}
      >
        <IntegrationCard />
      </SubjectPage>

      {/* ── Locaties ─────────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={page === 'locations'}
        title={ta('myLocations', prefs.lang)}
        onClose={() => setPage(null)}
      >
        {/* Adding a place belongs on the page that lists them, not only on the top
            row over the weather pages. */}
        <LocationSearch />

        <Group label={ta('myLocations', prefs.lang)}>
          <LocationList />
        </Group>
      </SubjectPage>
    </View>
  );
}
