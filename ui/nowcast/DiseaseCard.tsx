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
import type { DiseasePressure, DiseaseReading } from '../../core/model/diseasePressure';
import type { SoilStatus } from '../../core/model/soil';

export interface DiseaseCardProps {
  pressure: DiseasePressure;
}

/** The three states, in the scale's own inks: nothing, building, running. */
const TONE_LEVEL: Record<0 | 1 | 2, SoilStatus> = { 0: 0, 1: 1, 2: 2 };

/** What each model calls itself, and what its three states are called. */
const WORDS = {
  smith: { name: 'smithTitle', 0: 'smithNone', 1: 'smithBuilding', 2: 'smithActive' },
  div: { name: 'divTitle', 0: 'divNone', 1: 'divNone', 2: 'divActive' },
} as const;

export function DiseaseCard({ pressure }: DiseaseCardProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  // A badge per model that applies to something growing here. A field carries one crop
  // and a weather pole several, so this is a list by construction rather than by
  // ambition — see `core/model/crops`.
  if (!pressure.readings.length) return null;

  return (
    <Card>
      <View style={{ gap: space[3] }}>
        <Text variant="caption" weight="semibold" color={palette.muted}>
          {ta('diseaseTitle', lang)}
        </Text>

        {pressure.readings.map((reading) => (
          <IndicatorBadge
            key={`${reading.model}-${reading.crop}`}
            level={reading.level}
            tone={soilStatusInk(TONE_LEVEL[reading.level], palette, appearance)}
            title={ta(WORDS[reading.model][reading.level], lang)}
            reason={reasonFor(reading, lang)}
          />
        ))}

        {/* A proxy, and it says so. It is not a reading and never carries the green
            dot — see `leafWetHours`. */}
        {pressure.leafWet ? (
          <Text variant="caption" color={palette.inkDisabled}>
            {`${ta('leafWetHours', lang)}: ${pressure.leafWet.hours} · ${ta('leafWetProxy', lang)}`}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Why, in the model's own terms.
 *
 * The crop is named because a weather pole can carry two badges and the reader has to
 * know which field each is about. The height is named because a period found at 10 cm
 * is a different claim from one found at 1.50 m. Neither is decoration.
 */
function reasonFor(reading: DiseaseReading, lang: Parameters<typeof ta>[1]): string {
  const height = ta(
    reading.source === 'canopy10cm' ? 'soilCanopyLabel' : 'smithAt150', lang
  );
  const figure = reading.model === 'smith'
    ? `${reading.value} ${ta(reading.value === 1 ? 'smithDay' : 'smithDays', lang)}`
    : `${reading.value} / ${reading.limit} ${ta('divTwoDays', lang)}`;

  return [ta(WORDS[reading.model].name, lang), reading.crop, figure, height].join(' · ');
}
