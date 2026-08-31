/**
 * Instellingen.
 *
 * Follows the design's SettingsScreen, with two additions the web app has and the
 * design's settings omits: temperature and pressure units. Dropping working
 * preferences during a port would be a regression, so they live in Weermodel
 * beside the wind unit.
 *
 * Three of the design's groups are deliberately not shown yet, at the client's
 * direction: Meldingen, the Nowcast/Radar short-term choice, and the AgroExact
 * integration. Each is hidden rather than deleted — the preferences, the plumbing
 * and the tests all remain, so re-exposing one is a matter of restoring its rows.
 * See DEFERRED.md.
 */
import { useCallback } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/Icon';
import { Group, Row, Segmented, Toggle } from '../../ui/settings/Controls';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { t, ta, LANG_CODES } from '../../core/i18n';
import type { LangCode } from '../../core/i18n';
import type { ThemeMode } from '../../core/prefs';
import type { FontSizePref, PresUnit, TempUnit, WindUnit } from '../../core/i18n/units';

const TAB_BAR_CLEARANCE = 110;
const APP_VERSION = '0.1';

export default function SettingsScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    prefs, setPref,
    removeLocation, moveLocation, selectLocation,
  } = usePrefs();
  const { refresh } = useForecast();

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

        <Group label={ta('display', prefs.lang)}>
          <Row icon="translate" label={t('lang', prefs.lang)} hint={ta('langHint', prefs.lang)} stacked>
            <Segmented<LangCode>
              fill
              compact
              value={prefs.lang}
              onChange={(v) => { tap(); setPref('lang', v); }}
              options={LANG_CODES.map((c) => ({ value: c, label: c.toUpperCase() }))}
            />
          </Row>
          <Row icon="text-aa" label={t('fontSize', prefs.lang)} hint={ta('textSizeHint', prefs.lang)}>
            <Segmented<FontSizePref>
              compact
              value={prefs.fontSize}
              onChange={(v) => { tap(); setPref('fontSize', v); }}
              options={[
                { value: 'sm', label: 'A' },
                { value: 'md', label: 'A+' },
                { value: 'lg', label: 'A++' },
              ]}
            />
          </Row>
          <Row icon="circle-half" label={t('theme', prefs.lang)} hint={ta('themeHint', prefs.lang)} last>
            <Segmented<ThemeMode>
              compact
              value={prefs.theme}
              onChange={(v) => { tap(); setPref('theme', v); }}
              options={[
                { value: 'light', label: t('light', prefs.lang) },
                { value: 'dark', label: t('dark', prefs.lang) },
                { value: 'auto', label: ta('auto', prefs.lang) },
              ]}
            />
          </Row>
        </Group>

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

        <Group label={ta('weatherModel', prefs.lang)}>
          <Row
            icon="cloud-sun"
            label="HARMONIE-AROME"
            hint={t('harmonieHint', prefs.lang)}
          >
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
          >
            <Toggle
              on={prefs.showSpread}
              onChange={(v) => { tap(); setPref('showSpread', v); }}
              label={ta('showSpread', prefs.lang)}
            />
          </Row>
          <Row icon="ruler" label={t('wind', prefs.lang)}>
            <Segmented<WindUnit>
              compact
              value={prefs.windUnit}
              onChange={(v) => { tap(); setPref('windUnit', v); }}
              options={[
                { value: 'kmh', label: 'km/u' },
                { value: 'ms', label: 'm/s' },
                { value: 'kn', label: 'kn' },
                { value: 'bft', label: 'Bft' },
              ]}
            />
          </Row>
          <Row icon="thermometer-simple" label={t('temp', prefs.lang)}>
            <Segmented<TempUnit>
              compact
              value={prefs.tempUnit}
              onChange={(v) => { tap(); setPref('tempUnit', v); }}
              options={[
                { value: 'C', label: '°C' },
                { value: 'F', label: '°F' },
                { value: 'K', label: 'K' },
              ]}
            />
          </Row>
          <Row icon="drop-half" label={t('pres', prefs.lang)} last>
            <Segmented<PresUnit>
              compact
              value={prefs.presUnit}
              onChange={(v) => { tap(); setPref('presUnit', v); }}
              options={[
                { value: 'hPa', label: 'hPa' },
                { value: 'mbar', label: 'mbar' },
                { value: 'inHg', label: 'inHg' },
              ]}
            />
          </Row>
        </Group>

        <Text variant="caption" color={palette.muted} align="center" style={{ lineHeight: 18 }}>
          ExactCast AI · versie {APP_VERSION} (iOS){'\n'}
          Weerdata: Open-Meteo · ECMWF · KNMI HARMONIE-AROME{'\n'}
          Radar: RainViewer
        </Text>
      </ScrollView>
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
