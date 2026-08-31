/**
 * Card, card header, and the divider rules.
 *
 * Design rule 5: cards have no borders — they float on `--shadow-card`. The only
 * two coloured-border exceptions in the system are Callout and StatusCard, neither
 * of which is a Card.
 */
import { View, Pressable, type ViewProps, type ViewStyle } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import { radius, shadowCard, space, useTheme } from '../theme';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

export interface CardProps extends ViewProps {
  /** Padding in points. Pass 0 for a card whose children manage their own insets. */
  pad?: number;
  radiusOverride?: number;
}

export function Card({ pad = 16, radiusOverride, style, children, ...rest }: CardProps) {
  const { palette } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: palette.appCard,
          borderRadius: radiusOverride ?? radius.appCard,
          padding: pad,
          overflow: 'hidden',
        },
        shadowCard,
        style as ViewStyle,
      ]}
    >
      {children}
    </View>
  );
}

export interface CardHeaderProps {
  icon?: IconName;
  label: string;
  /** Right-hand action label, e.g. "Details". */
  action?: string;
  onAction?: () => void;
}

export function CardHeader({ icon, label, action, onAction }: CardHeaderProps) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[2],
        paddingBottom: space[3],
        paddingHorizontal: 2,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={palette.muted} /> : null}
      <Text variant="eyebrow" color={palette.muted}>
        {label}
      </Text>
      {action ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${action}`}
          hitSlop={8}
          style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3 }}
        >
          <Text variant="label" color={palette.accentDark}>
            {action}
          </Text>
          <CaretRight size={13} color={palette.accentDark} weight="bold" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A hairline rule, matching `--hairline`. */
export function Rule({ soft, style }: { soft?: boolean; style?: ViewStyle }) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        { height: 1, backgroundColor: soft ? palette.hairlineSoft : palette.hairline },
        style,
      ]}
    />
  );
}

/** A vertical hairline, for the conditions hero's three-cell divider row. */
export function VRule() {
  const { palette } = useTheme();
  return <View style={{ width: 1, backgroundColor: palette.hairline }} />;
}
