/**
 * What the weather has been doing to the crop, as a card.
 *
 * One badge per model that applies to what is growing here — today that is Smith on a
 * potato field, and the card is built so the next one is a row rather than a rewrite.
 *
 * ## It signals, it does not prescribe
 *
 * The wording is "ga kijken", never "ga spuiten", and that is not a hedge. A Smith
 * period says the *weather* has been suitable for infection; whether to do anything
 * about it depends on the variety, the last spray, the interval and the grower's own
 * tolerance, and not one of those is in this app. The card names the model out loud
 * for the same reason: a grower who knows what Smith is can weigh it, and one who does
 * not can look it up — neither is served by an app that says "risico hoog".
 *
 * ## And it says which air it counted
 *
 * A Smith period found at 10 cm and one found at 1.50 m are different claims about the
 * same field. The height is on the card, next to how many days it saw, because honesty
 * rule 4 applies to a derived figure as much as to a reading.
 */
import { View } from 'react-native';
import { Card } from '../Card';
import { Text } from '../Text';
import { space, useTheme } from '../../theme';
import { IndicatorBadge } from '../indicator/IndicatorBadge';
import { soilStatusInk } from '../soilStatusInk';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import type { SmithVerdict } from '../../core/model/smith';
import type { SoilStatus } from '../../core/model/soil';

export interface DiseaseCardProps {
  smith: SmithVerdict | null;
}

/** The three states, in the scale's own inks: nothing, building, running. */
const TONE_LEVEL: Record<0 | 1 | 2, SoilStatus> = { 0: 0, 1: 1, 2: 2 };

const TITLE = { 0: 'smithNone', 1: 'smithBuilding', 2: 'smithActive' } as const;

export function DiseaseCard({ smith }: DiseaseCardProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  if (!smith) return null;

  const height = ta(
    smith.source === 'canopy10cm' ? 'soilCanopyLabel' : 'smithAt150', lang
  );
  const detail = smith.level > 0
    ? `${smith.days} ${ta(smith.days === 1 ? 'smithDay' : 'smithDays', lang)} · ${height}`
    : `${ta('smithWindow', lang)} · ${height}`;

  return (
    <Card>
      <View style={{ gap: space[3] }}>
        <Text variant="caption" weight="semibold" color={palette.muted}>
          {ta('smithTitle', lang)}
        </Text>
        <IndicatorBadge
          level={smith.level}
          tone={soilStatusInk(TONE_LEVEL[smith.level], palette, appearance)}
          title={ta(TITLE[smith.level], lang)}
          reason={detail}
        />
      </View>
    </Card>
  );
}
