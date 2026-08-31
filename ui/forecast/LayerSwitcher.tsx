/**
 * The layer switcher pills.
 *
 * Design: a horizontal pill row, the selected one carrying the primary gradient with
 * white text, the rest on `--cream-2`. Buttons are full pills (design rule 5).
 */
import { ScrollView, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { t } from '../../core/i18n';
import { LAYERS, type LayerKey } from '../../core/model/layers';

export function LayerSwitcher({
  active, onChange,
}: { active: LayerKey; onChange: (k: LayerKey) => void }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space[2], paddingBottom: 10 }}
    >
      {LAYERS.map((layer) => {
        const on = layer.key === active;
        const label = t(layer.labelKey, prefs.lang);
        const content = (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={layer.icon} size={15} color={on ? '#fff' : palette.inkHeading} />
            <Text variant="label" weight="semibold" color={on ? '#fff' : palette.inkHeading}>
              {label}
            </Text>
          </View>
        );

        return (
          <Pressable
            key={layer.key}
            onPress={() => onChange(layer.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={{ borderRadius: radius.pill, overflow: 'hidden' }}
          >
            {on ? (
              <LinearGradient
                colors={[palette.accent, palette.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 9, paddingHorizontal: 15 }}
              >
                {content}
              </LinearGradient>
            ) : (
              <View
                style={{
                  paddingVertical: 9, paddingHorizontal: 15,
                  backgroundColor: palette.cream2,
                }}
              >
                {content}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
