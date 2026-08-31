/**
 * Placeholder for the forecast screen — built in a later phase.
 * Present now so the tab bar routes correctly and the shell can be run.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { Card } from '../../ui/Card';

export default function ForecastScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.appBg,
        paddingTop: insets.top + space[5],
        paddingHorizontal: space[5],
      }}
    >
      <Card>
        <Text variant="eyebrow" color={palette.muted}>forecast</Text>
        <Text variant="body" color={palette.muted} style={{ marginTop: space[2] }}>
          Nog niet gebouwd.
        </Text>
      </Card>
    </View>
  );
}
