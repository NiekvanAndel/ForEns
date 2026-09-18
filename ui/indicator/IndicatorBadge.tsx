/**
 * An indicator's verdict, in one line.
 *
 * The shape the whole layer was designed around: a lamp, what the state is, and the
 * **binding reason** — the boundary that is actually holding the field or the day
 * where it is. "Beregen nu · 48 kPa, grens 45" is a sentence a grower can check; "48
 * kPa" on its own is a number they have to place against a ladder they cannot see.
 *
 * Deliberately not soil-specific, though suction is its first caller. Wind will read
 * "Niet spuitbaar · 21 km/u, grens 18" through this same component, and Delta T and
 * the disease models after it — that was the argument for building the indicator as a
 * noun rather than as six features. So this takes a level, a tone and two strings, and
 * knows nothing about kilopascals.
 *
 * ## One badge, not six warnings
 *
 * The plan's own words: one badge with the binding reason instead of six separate
 * warnings, and the notification goes on the *change* rather than the state. This is
 * the first half of that. The second half is step 7, and it reads the same object.
 */
import { View } from 'react-native';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { space, useTheme } from '../../theme';

export interface IndicatorBadgeProps {
  /** 0 is "nothing to do here"; anything above it is worse. Decides the glyph. */
  level: number;
  /** The state's own colour — the scale's, not the palette's. */
  tone: string;
  /** What the state is: "Beregen nu", "Niet spuitbaar". */
  title: string;
  /**
   * Why, in the reader's own units: the reading, the boundary it crossed, and the
   * amount where the indicator can name one. Absent at level 0, where nothing binds.
   */
  reason?: string;
}

export function IndicatorBadge({ level, tone, title, reason }: IndicatorBadgeProps) {
  const { palette } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space[3],
        paddingVertical: space[3], paddingHorizontal: space[4],
        borderRadius: 10,
        // The state's colour, at the weight a background can carry. The lamp beside it
        // is the same colour at full strength, so the two cannot disagree.
        backgroundColor: `${tone}1F`,
      }}
    >
      <View
        style={{
          width: 26, height: 26, borderRadius: 13,
          backgroundColor: tone, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon
          // A tick where there is nothing to do, a warning where there is. Two glyphs
          // and not four: the colour already carries how bad it is, and a lamp that
          // changes shape at every step asks the reader to learn an alphabet.
          name={level === 0 ? 'check' : 'warning'}
          size={15}
          color={palette.appCard}
          weight="bold"
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySm" weight="semibold" color={palette.inkHeading}>
          {title}
        </Text>
        {reason ? (
          <Text variant="caption" color={palette.muted}>
            {reason}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
