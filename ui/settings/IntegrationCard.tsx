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
import { agroIntegration, unlinkStationLocations, DEFAULT_AGRO_INTEGRATION } from '../../core/prefs';
import { ta } from '../../core/i18n';

export function IntegrationCard() {
  const { palette } = useTheme();
  const { prefs, mutate } = usePrefs();
  const { status, account, error, signIn, signOut } = useAgroAuth();
  const { data: stations, isFetching } = useAgroStations();
  const refreshStations = useRefreshStations();
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
            onPress={() => { tap(); refreshStations(); }}
          >
            {isFetching ? <ActivityIndicator color={palette.accent} /> : null}
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
        </Text>
      </View>
    </Group>
  );
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
