/**
 * The pieces every overview widget is built from.
 *
 * A widget on this page is almost always the same figure: a card with a heading, and
 * under it one line per saved location with a name on the left and a reading on the
 * right. Writing that out twelve times is twelve chances for two widgets to disagree
 * about how a location is named, marked or spaced — on the one page whose whole job
 * is that they do not.
 *
 * So the shape is here and the widgets supply the readings. What each one still owns
 * is the judgement: which locations to show, in what order, and what the number means.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';

export interface WidgetCardProps {
  title: string;
  /** A word or two under the title: the window, the unit, the source. */
  hint?: string;
  /** Draws a chevron and makes the whole card a way in. */
  onPress?: () => void;
  children: ReactNode;
}

export function WidgetCard({ title, hint, onPress, children }: WidgetCardProps) {
  const { palette } = useTheme();

  const body = (
    <View
      style={[
        {
          backgroundColor: palette.appCard,
          borderRadius: radius.appCard,
          padding: space[5],
          gap: space[3],
          flex: 1,
        },
        shadowCard,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="label" weight="bold" color={palette.inkHeading} numberOfLines={1}>
            {title}
          </Text>
          {hint ? (
            <Text variant="caption" color={palette.muted} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {onPress ? <Icon name="caret-right" size={14} color={palette.muted} weight="bold" /> : null}
      </View>
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="button"
      style={{ flex: 1 }}
    >
      {body}
    </Pressable>
  );
}

export interface LocationLineProps {
  name: string;
  /** The green dot, where an instrument speaks for this place. */
  measured?: boolean;
  /** A hairline above, so a run of them reads as one table. */
  divider?: boolean;
  /**
   * The name at the size of what it introduces, and less air around the line.
   *
   * Where a widget's reading is a caption — a sentence of advice rather than a figure
   * — a body-sized name beside it is the largest thing on the line and the least
   * interesting, and the mismatch costs height on every row. Matching them lets the
   * row close up.
   */
  compact?: boolean;
  /** Opens that location's own page. Every line that can, does — this page is a way
   *  in as much as it is a summary. */
  onPress?: () => void;
  children: ReactNode;
}

export function LocationLine({
  name, measured, divider, compact, onPress, children,
}: LocationLineProps) {
  const { palette } = useTheme();

  const body = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space[2],
        paddingVertical: compact ? 5 : 9,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: palette.hairlineSoft,
      }}
    >
      {measured ? (
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.agroBright }}
        />
      ) : null}
      <Text
        variant={compact ? 'caption' : 'bodySm'}
        color={palette.ink}
        numberOfLines={1}
        style={{ flexShrink: 1, flexGrow: 1 }}
      >
        {name}
      </Text>
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      {body}
    </Pressable>
  );
}

/**
 * A location with its reading *under* its name rather than beside it.
 *
 * Half a row is not enough for a name, a chart and a figure on one line: the name is
 * what gives way, and "A.." beside a sparkline is a row that has lost the only part
 * telling you which field it is about. So the name gets the width to itself, and the
 * chart and the figure get the line below — two short lines instead of one that does
 * not fit.
 *
 * Worth the extra line only where there is a chart to fit; a plain ranking still uses
 * `LocationLine`, which is one line and stays one line.
 */
export function StackedLine({ name, measured, divider, onPress, children }: LocationLineProps) {
  const { palette } = useTheme();

  const body = (
    <View
      style={{
        paddingVertical: 7, gap: 3,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: palette.hairlineSoft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {measured ? (
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.agroBright }}
          />
        ) : null}
        <Text variant="caption" color={palette.muted} numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {children}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      {body}
    </Pressable>
  );
}

/** A reading at the end of a line: the figure bold, the unit quiet beside it. */
export function Reading({
  value, unit, color, dim,
}: { value: string; unit?: string; color?: string; dim?: boolean }) {
  const { palette } = useTheme();
  return (
    <Text
      variant="bodySm"
      weight="bold"
      color={dim ? palette.inkDisabled : color ?? palette.inkHeading}
      tabular
    >
      {value}
      {unit ? (
        <Text variant="caption" weight="semibold" color={palette.muted}>
          {` ${unit}`}
        </Text>
      ) : null}
    </Text>
  );
}

/** What a widget says when it has nothing to say. A sentence, not a blank card: an
 *  empty widget reads as a failure and a sentence reads as an answer. */
export function WidgetNote({ children }: { children: ReactNode }) {
  const { palette } = useTheme();
  return (
    <Text variant="bodySm" color={palette.muted} style={{ lineHeight: 19 }}>
      {children}
    </Text>
  );
}
