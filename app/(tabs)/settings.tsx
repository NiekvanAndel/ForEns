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
 * The alternative, and what this replaces, was every control on one screen: five
 * languages, four wind units and three temperature scales as rows of pills, none of
 * which could be read at a glance.
 *
 * Two of the design's groups are still not shown, at the client's direction:
 * Meldingen and the AgroExact integration. Each is hidden rather than deleted — the
 * preferences, the plumbing and the tests all remain. See DEFERRED.md.
 */
import { useCallback, useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { ChoiceList, Group, NavRow, Row, Toggle } from '../../ui/settings/Controls';
import { SubjectPage } from '../../ui/settings/SubjectPage';
import { SourceCard } from '../../ui/settings/SourceCard';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { t, ta, LANG_CODES, tempUnitLabel, windUnitLabel } from '../../core/i18n';
import type { LangCode } from '../../core/i18n';
import type { ThemeMode } from '../../core/prefs';
import type { FontSizePref, PresUnit, TempUnit, WindUnit } from '../../core/i18n/units';

const APP_VERSION = '0.1';

/** Space the floating glass tab bar occupies, so content can scroll clear of it. */
const TAB_BAR_CLEARANCE = 110;

/** Every page below the index. Subjects and the leaves inside them. */
type Page =
  | 'display' | 'lang' | 'fontSize' | 'theme'
  | 'units' | 'windUnit' | 'tempUnit' | 'presUnit'
  | 'model' | 'source'
  | 'locations';

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
  const {
    prefs, setPref,
    removeLocation, moveLocation, selectLocation,
  } = usePrefs();
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

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[5],
          paddingTop: insets.top + space[4],
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: space[6],
        }}
        showsVerticalScrollIndicator={false}
      >
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
            icon="dots-six-vertical"
            label={ta('myLocations', prefs.lang)}
            value={String(prefs.locations.length)}
            onPress={() => { tap(); setPage('locations'); }}
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
          Radar: RainViewer
        </Text>
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

      {/* ── Locaties ─────────────────────────────────────────────────────────── */}
      <SubjectPage
        visible={page === 'locations'}
        title={ta('myLocations', prefs.lang)}
        onClose={() => setPage(null)}
      >
        <Group label={ta('myLocations', prefs.lang)}>
          {prefs.locations.map((l, i) => (
            <Row
              key={`${l.name}-${i}`}
              icon="dots-six-vertical"
              label={
                <Text
                  variant="bodySm"
                  weight="semibold"
                  color={l.stationId ? palette.agroInk : palette.inkHeading}
                >
                  {l.name}
                </Text>
              }
              hint={l.stationName ?? l.sub}
              last={i === prefs.locations.length - 1}
              onPress={() => { tap(); selectLocation(i); }}
            >
              <IconButton
                icon="arrow-up"
                label="Omhoog"
                disabled={i === 0}
                onPress={() => { tap(); moveLocation(i, -1); }}
              />
              <IconButton
                icon="arrow-down"
                label="Omlaag"
                disabled={i === prefs.locations.length - 1}
                onPress={() => { tap(); moveLocation(i, 1); }}
              />
              <IconButton
                icon="trash"
                label="Verwijderen"
                tone={palette.valHigh}
                disabled={prefs.locations.length <= 1}
                onPress={() => { tap(); removeLocation(i); }}
              />
            </Row>
          ))}
        </Group>
      </SubjectPage>
    </View>
  );
}

function IconButton({
  icon, label, onPress, disabled, tone,
}: { icon: string; label: string; onPress: () => void; disabled?: boolean; tone?: string }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={{ padding: 2 }}
    >
      <Icon
        name={icon}
        size={17}
        color={disabled ? palette.inkDisabled : tone ?? palette.muted}
      />
    </Pressable>
  );
}
