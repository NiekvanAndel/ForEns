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
import { DIV_RECENT_THRESHOLD, type CercosporaResult } from '../../core/model/cercospora';
import type { HumidSource } from '../../core/model/humidHours';
import type { SoilStatus } from '../../core/model/soil';

export interface DiseaseCardProps {
  smith: SmithVerdict | null;
  div: CercosporaResult | null;
  /** Hours the leaf was probably wet, from the proxy. Shown as a supporting figure and
   *  labelled, never as a reading. */
  leafWet: { hours: number; proxy: true } | null;
}

/** The three states, in the scale's own inks: nothing, building, running. */
const TONE_LEVEL: Record<0 | 1 | 2, SoilStatus> = { 0: 0, 1: 1, 2: 2 };

const TITLE = { 0: 'smithNone', 1: 'smithBuilding', 2: 'smithActive' } as const;

export function DiseaseCard({ smith, div, leafWet }: DiseaseCardProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  // One card per field, a badge per model that applies to what is growing in it. A
  // field grows one crop, so in practice that is one badge — but the shape is a list,
  // because the next model is a row here rather than a rewrite.
  if (!smith && !div) return null;

  const heightOf = (source: HumidSource) =>
    ta(source === 'canopy10cm' ? 'soilCanopyLabel' : 'smithAt150', lang);

  return (
    <Card>
      <View style={{ gap: space[3] }}>
        <Text variant="caption" weight="semibold" color={palette.muted}>
          {ta('diseaseTitle', lang)}
        </Text>

        {smith ? (
          <IndicatorBadge
            level={smith.level}
            tone={soilStatusInk(TONE_LEVEL[smith.level], palette, appearance)}
            title={ta(TITLE[smith.level], lang)}
            reason={smith.level > 0
              ? `${ta('smithTitle', lang)} · ${smith.days} ${ta(smith.days === 1 ? 'smithDay' : 'smithDays', lang)} · ${heightOf(smith.source)}`
              : `${ta('smithTitle', lang)} · ${ta('smithWindow', lang)} · ${heightOf(smith.source)}`}
          />
        ) : null}

        {div ? <DivBadge div={div} height={heightOf(div.source)} /> : null}

        {/* A proxy, and it says so. It is not a reading and never carries the green
            dot — see `leafWetHours`. */}
        {leafWet ? (
          <Text variant="caption" color={palette.inkDisabled}>
            {`${ta('leafWetHours', lang)}: ${leafWet.hours} · ${ta('leafWetProxy', lang)}`}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Cercospora as a badge.
 *
 * The two-day total is what the guidance reads, so it is what the badge says — and the
 * number is on the card rather than hidden behind a word, because a grower who knows
 * the model wants the figure and one who does not is not helped by "hoog" either way.
 */
function DivBadge({ div, height }: { div: CercosporaResult; height: string }) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  const over = div.recent >= DIV_RECENT_THRESHOLD;
  const level: 0 | 2 = over ? 2 : 0;

  return (
    <IndicatorBadge
      level={level}
      tone={soilStatusInk(TONE_LEVEL[level], palette, appearance)}
      title={ta(over ? 'divActive' : 'divNone', lang)}
      reason={`${ta('divTitle', lang)} · ${div.recent} / ${DIV_RECENT_THRESHOLD} ${ta('divTwoDays', lang)} · ${height}`}
    />
  );
}
