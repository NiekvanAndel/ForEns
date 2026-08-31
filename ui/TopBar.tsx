/**
 * The top bar: where you are, which location of yours this is, and settings.
 *
 * Replaces the row of location pills. With more than two or three saved places the
 * pills crowded the bar and the name — the one thing worth reading — was the part
 * that got truncated. So the name takes the width, the saved locations become dots,
 * and switching between them is a swipe across the page (see `LocationPager`); the
 * dots are the position indicator that swipe needs, and remain tappable.
 *
 * Beside them sits the GPS arrow, which adds wherever the device actually is, and
 * settings, which moved up here out of the bottom bar so that bar carries only the
 * three pages.
 *
 * Design rule 1 holds: the name is AgroExact green only where a station backs the
 * location, never as decoration.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { radius, shadowCard, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon } from './Icon';
import { usePrefs } from '../state/prefs';
import { reverseGeocode, type Place } from '../core/sources/geocoding';
import { t, ta } from '../core/i18n';

export interface TopBarProps {
  onSearch: (query: string) => void;
  results: Place[];
  searching: boolean;
  onPick: (place: Place) => void;
  onOpenSettings: () => void;
}

export function TopBar({ onSearch, results, searching, onPick, onOpenSettings }: TopBarProps) {
  const { palette } = useTheme();
  const { prefs, selectLocation, addLocation } = usePrefs();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);

  const active = prefs.locations[prefs.activeLocation] ?? prefs.locations[0];

  const close = () => {
    setOpen(false);
    setQuery('');
    onSearch('');
  };

  /** Add wherever the device is. A refused permission is not an error worth a
   *  dialog — the arrow simply does nothing and the saved locations still work. */
  const useMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, prefs.lang);
      addLocation({ name: place.name, lat: place.lat, lon: place.lon, sub: place.sub });
    } catch {
      // Nothing to say: the bar keeps whatever location it already had.
    } finally {
      setLocating(false);
    }
  };

  if (open) {
    return (
      <View style={{ paddingHorizontal: space[5], paddingTop: 6, paddingBottom: space[3] }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View
            style={[
              {
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2],
                backgroundColor: palette.appCard, borderRadius: radius.pill,
                paddingVertical: 12, paddingHorizontal: space[5],
              },
              shadowCard,
            ]}
          >
            <Icon name="magnifying-glass" size={18} color={palette.muted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                onSearch(v);
              }}
              placeholder={ta('searchPlaceholderNl', prefs.lang)}
              placeholderTextColor={palette.muted}
              returnKeyType="search"
              autoCorrect={false}
              style={{
                flex: 1,
                fontFamily: 'Figtree_400Regular',
                fontSize: 16,
                color: palette.inkHeading,
                padding: 0,
              }}
            />
            {searching ? <ActivityIndicator size="small" color={palette.muted} /> : null}
          </View>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={8}>
            <Text variant="body" weight="semibold" color={palette.accentDark}>
              {ta('done', prefs.lang)}
            </Text>
          </Pressable>
        </View>

        {results.length ? (
          <View
            style={[
              {
                marginTop: space[3], backgroundColor: palette.appCard,
                borderRadius: radius.tile + 4, overflow: 'hidden',
              },
              shadowCard,
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              {results.map((r, i) => (
                <Pressable
                  key={`${r.lat},${r.lon},${i}`}
                  onPress={() => {
                    onPick(r);
                    close();
                  }}
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 12, paddingHorizontal: space[5],
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: palette.hairlineSoft,
                  }}
                >
                  <Text variant="label" color={palette.inkHeading}>{r.name}</Text>
                  {r.sub ? (
                    <Text variant="caption" color={palette.muted} style={{ marginTop: 2 }}>
                      {r.sub}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: space[5], paddingTop: 6, paddingBottom: space[3],
        flexDirection: 'row', gap: space[3], alignItems: 'center',
      }}
    >
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={ta('searchPlaceholderNl', prefs.lang)}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}
      >
        {active?.stationId ? (
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.agroBright }}
          />
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Text
            variant="locationName"
            color={active?.stationId ? palette.agroInk : palette.inkHeading}
            numberOfLines={1}
          >
            {active?.name ?? '—'}
          </Text>
          {active?.stationName ?? active?.sub ? (
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {active?.stationName ?? active?.sub}
            </Text>
          ) : null}
        </View>
        <Icon name="magnifying-glass" size={15} color={palette.muted} />
      </Pressable>

      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[3],
          backgroundColor: palette.glassCapsule,
          borderRadius: radius.pill,
          paddingVertical: 9, paddingHorizontal: 13,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {prefs.locations.map((l, i) => {
            const on = i === prefs.activeLocation;
            return (
              <Pressable
                key={`${l.name}-${i}`}
                onPress={() => selectLocation(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={l.name}
                hitSlop={8}
              >
                <View
                  style={{
                    width: on ? 8 : 6,
                    height: on ? 8 : 6,
                    borderRadius: 4,
                    backgroundColor: on
                      ? l.stationId ? palette.agroBright : palette.accentDark
                      : palette.inkDisabled,
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={useMyLocation}
          accessibilityRole="button"
          accessibilityLabel={ta('useMyLocation', prefs.lang)}
          hitSlop={8}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={palette.accentDark} />
          ) : (
            <Icon name="navigation-arrow" size={16} color={palette.accentDark} weight="fill" />
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel={t('settings', prefs.lang)}
        hitSlop={8}
      >
        <Icon name="gear-six" size={21} color={palette.muted} />
      </Pressable>
    </View>
  );
}
