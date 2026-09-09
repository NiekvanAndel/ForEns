/**
 * Add a place from inside 'Mijn locaties'.
 *
 * The same search the top row runs, on the page that owns the list it adds to. It
 * was only reachable from the row over the weather pages, so the one screen headed
 * "my locations" was the one screen you could not add a location on.
 *
 * It shares `usePlaceSearch`, so the debounce and the Nominatim policy behind it are
 * the same here as there, and `addLocation`, so a place added here arrives in the
 * list underneath the moment it is picked. The field then clears itself: the answer
 * to "did that work" is the new row, not a query still sitting in the box.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Card } from '../Card';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePlaceSearch } from '../usePlaceSearch';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

export function LocationSearch() {
  const { palette } = useTheme();
  const { prefs, addLocation } = usePrefs();
  const { results, searching, onSearch } = usePlaceSearch(prefs.lang);
  const [query, setQuery] = useState('');

  const change = (v: string) => {
    setQuery(v);
    onSearch(v);
  };

  return (
    <View style={{ gap: space[3] }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: space[2],
          backgroundColor: palette.cream2,
          borderRadius: radius.pill,
          paddingVertical: 11, paddingHorizontal: space[4],
        }}
      >
        <Icon name="magnifying-glass" size={17} color={palette.muted} />
        <TextInput
          value={query}
          onChangeText={change}
          placeholder={ta('searchPlaceholderNl', prefs.lang)}
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          autoCorrect={false}
          style={{
            flex: 1,
            fontFamily: 'Figtree_400Regular',
            fontSize: 15,
            color: palette.inkHeading,
            padding: 0,
          }}
        />
        {searching ? <ActivityIndicator size="small" color={palette.muted} /> : null}
        {query && !searching ? (
          <Pressable
            onPress={() => change('')}
            accessibilityRole="button"
            accessibilityLabel={ta('done', prefs.lang)}
            hitSlop={8}
          >
            <Icon name="x" size={15} color={palette.muted} />
          </Pressable>
        ) : null}
      </View>

      {results.length ? (
        <Card pad={0}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.lat},${r.lon},${i}`}
              onPress={() => {
                addLocation({ name: r.name, lat: r.lat, lon: r.lon, sub: r.sub });
                change('');
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                paddingVertical: 12, paddingHorizontal: space[5],
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: palette.hairlineSoft,
                backgroundColor: pressed ? palette.pressedRow : 'transparent',
              })}
            >
              <Text variant="label" color={palette.inkHeading}>{r.name}</Text>
              {r.sub ? (
                <Text variant="caption" color={palette.muted} style={{ marginTop: 2 }}>
                  {r.sub}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
