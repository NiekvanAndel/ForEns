/**
 * The top row: search, where you are, and room for what comes next.
 *
 * Three slots of equal weight — search on the left, the location control in the
 * middle, an empty slot on the right held open for a future button. Only the two
 * buttons carry a background; the row itself does not, so the bar reads as part of
 * the page rather than as a panel sitting on it.
 *
 * The middle control is the position indicator for the page swipe: the GPS arrow
 * stands for the device's own page, one dot for each saved place after it, and
 * whichever you are on is filled. Tapping any of them goes to that page.
 *
 * The arrow is an indicator, not an action. It used to be a button that appended
 * wherever you happened to be as another pin — pressing it twice gave you two of
 * yourself, and nothing on the row said which page was you. The fix is asked for
 * automatically at first launch instead (see `DeviceLocationProvider`), so by the
 * time the row is read the arrow already has a page to point at. It falls back to
 * taking a fix when there is none: a refused permission, or a first launch that has
 * not answered yet.
 *
 * The location's *name* is not here. It belongs to the page, directly below the row,
 * where there is width for it — see `LocationTitle`.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, shadowCard, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon } from './Icon';
import { usePrefs } from '../state/prefs';
import { useDeviceLocation } from '../state/deviceLocation';
import type { Place } from '../core/sources/geocoding';
import { ta } from '../core/i18n';

export interface TopBarProps {
  onSearch: (query: string) => void;
  results: Place[];
  searching: boolean;
  onPick: (place: Place) => void;
}

export function TopBar({ onSearch, results, searching, onPick }: TopBarProps) {
  const { palette } = useTheme();
  const { prefs, selectLocation } = usePrefs();
  const { index: hereIndex, locating, locate } = useDeviceLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => {
    setOpen(false);
    setQuery('');
    onSearch('');
  };

  /** Go to the device's page, or take a fix if there is not one yet. */
  const goHere = () => {
    Haptics.selectionAsync().catch(() => {});
    if (hereIndex >= 0) selectLocation(hereIndex);
    else locate();
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
        paddingHorizontal: space[5], paddingTop: 6, paddingBottom: space[2],
        flexDirection: 'row', alignItems: 'center',
      }}
    >
      {/* Left: search. */}
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <RoundButton
          icon="magnifying-glass"
          label={ta('searchPlaceholderNl', prefs.lang)}
          onPress={() => setOpen(true)}
        />
      </View>

      {/* Middle: where you are, and which of your places. */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[3],
          backgroundColor: palette.cream2,
          borderRadius: radius.pill,
          paddingVertical: 10, paddingHorizontal: 15,
        }}
      >
        <Pressable
          onPress={goHere}
          accessibilityRole="tab"
          accessibilityState={{ selected: hereIndex >= 0 && hereIndex === prefs.activeLocation }}
          accessibilityLabel={ta('useMyLocation', prefs.lang)}
          hitSlop={8}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color={palette.accentDark} />
          ) : (
            <Icon
              name="navigation-arrow"
              size={17}
              // Filled and inked when you are on your own page; hollow and faint when
              // you are on one of the saved ones, exactly as the dots behave.
              color={
                hereIndex >= 0 && hereIndex === prefs.activeLocation
                  ? palette.inkHeading
                  : palette.inkDisabled
              }
              weight={hereIndex >= 0 && hereIndex === prefs.activeLocation ? 'fill' : 'regular'}
            />
          )}
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {prefs.locations.map((l, i) => {
            // The device's page is the arrow, not a dot: two indicators for one page
            // would be a dot that never lights on its own.
            if (l.current) return null;
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
                    // Green names a station, never a place — design rule 1.
                    backgroundColor: on
                      ? l.stationId ? palette.agroBright : palette.inkHeading
                      : palette.inkDisabled,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Right: held open, so adding a button later does not move the middle. */}
      <View style={{ flex: 1, alignItems: 'flex-end' }} />
    </View>
  );
}

function RoundButton({
  icon, label, onPress,
}: { icon: string; label: string; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 42, height: 42, borderRadius: radius.pill,
        backgroundColor: palette.cream2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={19} color={palette.inkHeading} />
    </Pressable>
  );
}
