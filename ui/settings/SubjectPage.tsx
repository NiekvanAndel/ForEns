/**
 * One subject's settings, over the index.
 *
 * Presented as a sheet rather than a route so the tab keeps its place: settings is a
 * tab, and pushing a stack inside a tab would put a second back-affordance beside
 * the tab bar. A sheet dismisses to exactly where it came from, which is what the
 * chevron on the index row promises.
 */
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';

export function SubjectPage({
  visible, title, onClose, children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: palette.appBg }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingHorizontal: space[5], paddingTop: space[5], paddingBottom: space[3],
          }}
        >
          <Text variant="screenTitle" color={palette.inkHeading} style={{ flex: 1 }}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={ta('done', prefs.lang)}
            hitSlop={10}
            style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: palette.cream2,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="x" size={14} color={palette.muted} weight="bold" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: space[5],
            paddingBottom: insets.bottom + space[10],
            gap: space[6],
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
