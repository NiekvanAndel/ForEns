/**
 * Integraties → AgroExact.
 *
 * One card, four states, and the card has to make which one it is in obvious without
 * being read: not connected, signing in, connected, or expired. The expired state is
 * the one that matters — the locations are still there and still show weather, so
 * nothing on the rest of the app looks broken, and without a warning here nobody
 * would ever find out their measurements had quietly gone back to being a model.
 *
 * Signing in opens AgroExact's own page in a browser sheet. Nothing in this app ever
 * sees the password, which is the point of doing it this way rather than with a
 * field for an API key.
 *
 * The card is written per integration rather than as a generic list row, because
 * there is one integration and pretending otherwise would cost a layer of
 * abstraction for a list of length one. A second provider gets a second card.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Group, Row, Toggle } from './Controls';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { useAgroAuth } from '../../state/auth';
import { useAgroStations, useRefreshStations } from '../../state/stations';
import {
  useAgroSoilStations, useNearestSoilSensor, useRefreshSoilStations,
} from '../../state/soilStations';
import { agroIntegration, unlinkStationLocations, DEFAULT_AGRO_INTEGRATION } from '../../core/prefs';
import { ta } from '../../core/i18n';
import type { LangCode } from '../../core/i18n/strings';
import { fmtDecimal } from '../../core/i18n/units';

export function IntegrationCard() {
  const { palette } = useTheme();
  const { prefs, mutate } = usePrefs();
  const { status, account, error, signIn, signOut } = useAgroAuth();
  const { data: stations, isFetching } = useAgroStations();
  const { data: soilStations } = useAgroSoilStations();
  const refreshStations = useRefreshStations();
  const refreshSoil = useRefreshSoilStations();
  // Measured against the first saved place, which is the one the app opens on. The
  // question this row answers — is there a sensor of mine, and is it reporting — is
  // about somewhere the reader actually is, not about the account's centre of mass.
  const home = prefs.locations[0] ?? null;
  const nearestSoil = useNearestSoilSensor(home?.lat ?? null, home?.lon ?? null);
  const [busy, setBusy] = useState(false);
  const lang = prefs.lang;
  const integration = agroIntegration(prefs);

  const tap = useCallback(() => { Haptics.selectionAsync().catch(() => {}); }, []);

  const connect = useCallback(async () => {
    tap();
    setBusy(true);
    const who = await signIn();
    if (who) {
      // The sync itself runs above every screen and fills in the stations; this only
      // records that an account is attached, so the card stops offering to connect.
      mutate((p) => ({
        ...p,
        integrations: {
          ...p.integrations,
          agroexact: {
            ...(p.integrations.agroexact ?? DEFAULT_AGRO_INTEGRATION),
            connected: true,
            account: who.email ?? null,
            accountName: who.name ?? null,
          },
        },
      }));
    }
    setBusy(false);
  }, [signIn, mutate, tap]);

  const disconnect = useCallback(async () => {
    tap();
    setBusy(true);
    await signOut();
    // The places stay; only the station binding goes. A town does not stop existing
    // because someone signed out.
    mutate(unlinkStationLocations);
    setBusy(false);
  }, [signOut, mutate, tap]);

  const connected = status === 'connected';
  const expired = status === 'expired' || (integration.connected && status === 'disconnected' && !!integration.account);

  const subtitle = connected
    ? account?.email ?? integration.account ?? ta('agroConnected', lang)
    : expired
      ? ta('agroExpired', lang)
      : ta('agroNotConnected', lang);

  const lastSync = integration.lastSyncMs
    ? new Date(integration.lastSyncMs).toLocaleString(lang === 'nl' ? 'nl-NL' : lang, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : ta('agroNever', lang);

  return (
    <Group label={ta('integrations', lang)}>
      <Row
        icon="plugs-connected"
        label="AgroExact"
        hint={subtitle}
        last={!connected}
      >
        {expired ? (
          <Icon name="warning" size={18} color={palette.valHigh} />
        ) : connected ? (
          <View
            style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: palette.agroBright }}
          />
        ) : null}
      </Row>

      {connected ? (
        <>
          <Row
            icon="map-pin"
            label={ta('agroStationsCount', lang)}
            hint={`${ta('agroLastSync', lang)}: ${lastSync}`}
            last={false}
          >
            <Text variant="bodySm" weight="semibold" color={palette.inkHeading} tabular>
              {stations?.length ?? 0}
            </Text>
          </Row>

          <Row
            icon="arrows-clockwise"
            label={ta('agroRefreshStations', lang)}
            // One button for both lists: they come from the same account and nobody
            // refreshing their stations means "but leave the soil sensors stale".
            onPress={() => { tap(); refreshStations(); refreshSoil(); }}
          >
            {isFetching ? <ActivityIndicator color={palette.accent} /> : null}
          </Row>

          <Row
            icon="drop-half"
            label={ta('agroSoilCount', lang)}
            hint={home ? soilHint(nearestSoil, lang) : undefined}
            last={false}
          >
            {nearestSoil?.loading ? (
              <ActivityIndicator color={palette.accent} />
            ) : (
              <Text variant="bodySm" weight="semibold" color={palette.inkHeading} tabular>
                {soilStations?.length ?? 0}
              </Text>
            )}
          </Row>

          <Row
            icon="crosshair"
            label={ta('agroUseForCurrent', lang)}
            hint={ta('agroUseForCurrentHint', lang)}
            last
          >
            <Toggle
              on={integration.useForCurrentLocation}
              onChange={(v) => {
                tap();
                mutate((p) => ({
                  ...p,
                  integrations: {
                    ...p.integrations,
                    agroexact: {
                      ...(p.integrations.agroexact ?? DEFAULT_AGRO_INTEGRATION),
                      useForCurrentLocation: v,
                    },
                  },
                }));
              }}
              label={ta('agroUseForCurrent', lang)}
            />
          </Row>
        </>
      ) : null}

      <ActionRow
        busy={busy || status === 'connecting'}
        label={connected ? ta('agroSignOut', lang) : ta('agroSignIn', lang)}
        tone={connected ? palette.valHigh : palette.accentDark}
        onPress={connected ? disconnect : connect}
      />

      {error ? (
        <View style={{ paddingHorizontal: space[5], paddingBottom: space[4] }}>
          <Text variant="caption" color={palette.valHigh}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: space[5], paddingBottom: space[4] }}>
        <Text variant="caption" color={palette.muted} style={{ lineHeight: 17 }}>
          {ta('agroLocationsNote', lang)}
          {connected && soilStations?.length ? `\n\n${ta('agroSoilNote', lang)}` : ''}
        </Text>
      </View>
    </Group>
  );
}

/**
 * What the soil row says under its count.
 *
 * Three answers, and the difference between the last two is the whole point of the
 * row: a sensor reporting suction, a sensor that is out of the ground, and no sensor
 * near this place at all. "Not active" is a state and is worded as one — a soil
 * sensor is lifted at harvest and goes back in in spring, and an app that called that
 * a fault would report a breakdown to every grower each autumn.
 *
 * The distance is always there. It is what answers "is this one mine", and a reader
 * does that better than any radius this app could have picked.
 *
 * Only called once there is a place to measure from. Without one there is no nearest
 * anything, and saying "no soil sensor found" would blame the account for what is
 * really a sync that has not finished.
 */
function soilHint(soil: ReturnType<typeof useNearestSoilSensor>, lang: LangCode): string {
  if (!soil) return ta('agroSoilNone', lang);

  const where = [
    soil.station.name,
    `${fmtDecimal(soil.dist)} km`,
    soil.station.crop,
    soil.station.depthCm ? `${soil.station.depthCm} cm` : null,
  ].filter(Boolean).join(' · ');

  if (soil.loading) return where;
  if (soil.dormant || soil.latest?.tension == null) {
    return `${where} — ${ta('agroSoilDormant', lang)}`;
  }
  return `${where} — ${fmtDecimal(soil.latest.tension)} kPa`;
}

/** The card's one button. A row rather than a pill, so it lines up with the rows
 *  above it and cannot be mistaken for a value. */
function ActionRow({
  label, tone, busy, onPress,
}: { label: string; tone: string; busy: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={busy ? undefined : onPress} accessibilityRole="button" disabled={busy}>
      <View
        style={{
          paddingVertical: space[4],
          paddingHorizontal: space[5],
          borderTopWidth: 1,
          borderTopColor: palette.hairlineSoft,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[3],
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? <ActivityIndicator color={tone} /> : null}
        <Text variant="bodySm" weight="semibold" color={tone}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
