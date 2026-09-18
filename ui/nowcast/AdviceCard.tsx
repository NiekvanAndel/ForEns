/**
 * What the weather means for the work, as a card.
 *
 * One badge per rule-based reading — the spray window, frost, workability,
 * fertilising — each with the **binding reason** underneath it: the figure, the
 * boundary it crossed, and where a window is open, when it closes and on what.
 *
 * "Nu niet spuitbaar · Wind 21 km/u, grens 18" is a sentence a grower can check
 * against the wind block two taps away, and disagree with. "Nu niet spuitbaar" on its
 * own is an instruction they have to take on trust.
 *
 * ## It signals, it does not prescribe
 *
 * Every boundary here is legal, physical or published practice; what to do about one
 * is the grower's, and the variety, the machine, the last pass and the contractor's
 * diary are none of them in this app. The line under the badges says so once, rather
 * than hedging in every row.
 *
 * The words are `ui/advice/words`, which the blocks on 'Actueel' and the row per
 * location on the overview read too — four surfaces, one vocabulary.
 *
 * ## Worst first
 *
 * What is shut is what changes a morning, so the rows are sorted by level rather than
 * by family. A grower opening the app before six wants the red one at the top.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { Card } from '../Card';
import { Text } from '../Text';
import { space, useTheme } from '../../theme';
import { IndicatorBadge } from '../indicator/IndicatorBadge';
import { soilStatusInk } from '../soilStatusInk';
import { adviceReason, adviceTitle } from '../advice/words';
import { usePrefs } from '../../state/prefs';
import { ta } from '../../core/i18n';
import { byUrgency, type AdviceReading } from '../../core/model/fieldAdvice';

export interface AdviceCardProps {
  readings: readonly AdviceReading[];
}

export function AdviceCard({ readings }: AdviceCardProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const rows = useMemo(() => byUrgency(readings), [readings]);

  // Nothing to say, or nothing switched on: no card. An empty card headed
  // "Veldomstandigheden" would be a promise the page is not keeping.
  if (!rows.length) return null;

  return (
    <Card>
      <View style={{ gap: space[3] }}>
        <Text variant="caption" weight="semibold" color={palette.muted}>
          {ta('adviceTitle', prefs.lang)}
        </Text>

        {rows.map((reading) => (
          <IndicatorBadge
            key={reading.id}
            level={reading.level}
            tone={soilStatusInk(reading.level, palette, appearance)}
            title={adviceTitle(reading, prefs.lang)}
            reason={adviceReason(reading, prefs)}
          />
        ))}

        <Text variant="caption" color={palette.inkDisabled}>
          {ta('adviceSignalOnly', prefs.lang)}
        </Text>
      </View>
    </Card>
  );
}
