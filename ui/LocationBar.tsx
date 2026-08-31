/**
 * The location bar: saved-location pills, search, settings.
 *
 * Design rule 1 in practice — a station-backed location shows its name in AgroExact
 * green, a plain address stays navy. That is the only colour decision this component
 * makes, and it is driven by `stationId`, never by anything cosmetic.
 */
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, shadowCard, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon } from './Icon';
import { usePrefs } from '../state/prefs';
import { ta } from '../core/i18n';
import type { Place } from '../core/sources/geocoding';

export interface LocationBarProps {
  onSearch: (query: string) => void;
  results: Place[];
  searching: boolean;
  onPick: (place: Place) => void;
}

export function LocationBar({ onSearch, results, searching, onPick }: LocationBarProps) {
  const { palette } = useTheme();
  const { prefs, selectLocation } = usePrefs();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => {
    setOpen(false);
    setQuery('');
    onSearch('');
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
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={{
        paddingHorizontal: space[5], paddingTop: 6, paddingBottom: space[3],
        flexDirection: 'row', gap: space[2], alignItems: 'center',
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[2], paddingRight: space[2] }}
        style={{ flex: 1 }}
      >
        {prefs.locations.map((l, i) => {
          const on = i === prefs.activeLocation;
          // Green names a station, never a place. A plain address stays navy.
          const nameColor = on
            ? l.stationId ? palette.agroInk : palette.inkHeading
            : palette.muted;
          return (
            <Pressable
              key={`${l.name}-${i}`}
              onPress={() => selectLocation(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[
                {
                  borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 18,
                  flexDirection: 'row', alignItems: 'center', gap: 7,
                  backgroundColor: on ? palette.appCard : palette.glassCapsule,
                },
                on ? shadowCard : null,
              ]}
            >
              {l.stationId ? (
                <View
                  style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: palette.agroBright,
                  }}
                />
              ) : null}
              <Text variant="bodySm" weight="bold" color={nameColor} numberOfLines={1}>
                {l.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Locatie zoeken"
        style={[{ width: 42, height: 42, borderRadius: radius.pill, overflow: 'hidden' }, shadowCard]}
      >
        <LinearGradient
          colors={[palette.accent, palette.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="magnifying-glass" size={19} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
