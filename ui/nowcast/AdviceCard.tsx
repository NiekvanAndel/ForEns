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
 * ## The units are the reader's
 *
 * `fieldAdvice` answers in the app's own internal units — km/h, °C, mm — and every
 * figure is converted here, exactly as the blocks on 'Actueel' and the day rows do.
 * A boundary is a fact; the unit it is printed in is a preference.
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
import { usePrefs } from '../../state/prefs';
import { fmtMm, fmtTempValue, fmtWindValue, ta, windUnitLabel } from '../../core/i18n';
import type { AppStringKey, LangCode } from '../../core/i18n';
import {
  byUrgency, type AdviceFactor, type AdviceReading, type AdviceUnit,
} from '../../core/model/fieldAdvice';
import type { Prefs } from '../../core/prefs';

export interface AdviceCardProps {
  readings: readonly AdviceReading[];
}

/**
 * What each row is called, by factor and — where the same factor has more than one
 * state to be in — by level.
 *
 * A table rather than a function, so that adding a family later is a row here and a
 * row in `fieldAdvice`, and the two cannot drift into saying different things about
 * the same reading.
 */
const TITLES: Record<AdviceFactor, AppStringKey | Record<0 | 1 | 2, AppStringKey>> = {
  sprayOpen: 'adviceSprayOpen',
  sprayWind: 'adviceSprayShut',
  sprayCold: 'adviceSprayShut',
  sprayHeat: 'adviceSprayShut',
  sprayDeltaTLow: 'adviceSprayShut',
  sprayDeltaTHigh: 'adviceSprayShut',
  sprayRain: 'adviceSprayShut',
  sprayInversion: 'adviceSprayInversion',
  frostNone: 'adviceFrostNone',
  frostGround: 'adviceFrostGround',
  frostAir: 'adviceFrostAir',
  frostBlossom: 'adviceFrostBlossom',
  frostIrrigation: { 0: 'adviceIrrigateOk', 1: 'adviceIrrigateNo', 2: 'adviceIrrigateNo' },
  traffic: { 0: 'adviceTrafficOk', 1: 'adviceTrafficWet', 2: 'adviceTrafficShut' },
  mowing: { 0: 'adviceMowingOk', 1: 'adviceMowingNone', 2: 'adviceMowingNone' },
  drought: { 0: 'adviceDroughtNone', 1: 'adviceDroughtRising', 2: 'adviceDroughtHigh' },
  fertFrozen: 'adviceFertFrozen',
  fertFrostAhead: 'adviceFertFrostAhead',
  fertEmission: { 0: 'adviceEmissionOk', 1: 'adviceEmissionUp', 2: 'adviceEmissionHigh' },
  fertLeaching: { 0: 'adviceLeachingSoon', 1: 'adviceLeachingSoon', 2: 'adviceLeachingHigh' },
  fertTSum: { 0: 'adviceTSumOk', 1: 'adviceTSumShort', 2: 'adviceTSumShort' },
};

/** What the figure in a row is, so the reason reads as a sentence and not a number. */
const QUANTITIES: Record<AdviceFactor, AppStringKey | null> = {
  sprayOpen: null,
  sprayWind: 'adviceWind',
  sprayCold: 'adviceTemp',
  sprayHeat: 'adviceTemp',
  sprayDeltaTLow: 'adviceDeltaT',
  sprayDeltaTHigh: 'adviceDeltaT',
  sprayRain: 'adviceRain2h',
  sprayInversion: 'adviceCalm',
  frostNone: 'adviceMinTemp',
  frostGround: 'adviceMinTemp',
  frostAir: 'adviceMinTemp',
  frostBlossom: 'adviceMinTemp',
  frostIrrigation: 'adviceWetBulb',
  traffic: 'adviceSurplus',
  mowing: 'adviceDryDays',
  drought: 'adviceDeficit',
  fertFrozen: 'adviceTemp',
  fertFrostAhead: 'adviceTemp',
  fertEmission: 'adviceWarmest',
  fertLeaching: 'adviceRain48',
  fertTSum: 'adviceTSumLabel',
};

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
            title={titleFor(reading, prefs.lang)}
            reason={reasonFor(reading, prefs)}
          />
        ))}

        <Text variant="caption" color={palette.inkDisabled}>
          {ta('adviceSignalOnly', prefs.lang)}
        </Text>
      </View>
    </Card>
  );
}

/** `YYYY-MM-DDTHH:00` → "05:00". The window is whole hours; the clock says so. */
const clock = (stamp: string) => stamp.slice(11, 16);

/**
 * What the row is called, with the open window in it where there is one.
 *
 * An open spray window without its hours is the least useful true sentence the app
 * could print, so the stretch goes in the title rather than in the reason.
 */
function titleFor(reading: AdviceReading, lang: LangCode): string {
  const entry = TITLES[reading.factor];
  const key = typeof entry === 'string' ? entry : entry[reading.level];
  const title = ta(key, lang);

  if (reading.factor === 'sprayOpen' && reading.window) {
    return `${title} ${ta('adviceUntil', lang)} ${clock(reading.window.to)}`;
  }
  // Shut now, but open later: the reader's next question is when, so it is answered
  // in the title and the reason stays the one holding it shut.
  if (reading.level > 0 && reading.window && reading.family === 'spray') {
    return `${title} · ${ta('adviceFrom', lang)} ${clock(reading.window.from)}`;
  }
  return title;
}

/** The figure in the reader's own units, and the boundary beside it. */
function valueIn(
  value: number,
  unit: AdviceUnit | null,
  prefs: Pick<Prefs, 'tempUnit' | 'windUnit' | 'lang'>
): string {
  switch (unit) {
    case 'kmh':
      return `${fmtWindValue(value, prefs.windUnit)} ${windUnitLabel(prefs.windUnit)}`;
    case 'C':
      return `${fmtTempValue(value, prefs.tempUnit)}°`;
    case 'mm':
      return `${fmtMm(value)} mm`;
    case 'pct':
      return `${Math.round(value)}%`;
    case 'days':
      return `${Math.round(value)} ${ta('adviceDryDays', prefs.lang).toLowerCase()}`;
    default:
      return String(Math.round(value));
  }
}

/**
 * Why: the quantity, the reading, the boundary — and where the figure is inferred
 * rather than measured, that it is.
 *
 * An open window says what closes it instead, because there the boundary that matters
 * is the one ahead rather than the one behind.
 */
function reasonFor(reading: AdviceReading, prefs: Prefs): string {
  const lang = prefs.lang;
  const parts: string[] = [];

  const quantityKey = reading.factor === 'sprayOpen' && reading.closes
    ? QUANTITIES[reading.closes]
    : QUANTITIES[reading.factor];

  if (reading.factor === 'sprayOpen' && reading.closes) parts.push(ta('adviceCloses', lang));
  if (quantityKey) parts.push(ta(quantityKey, lang));

  if (reading.value != null) parts.push(valueIn(reading.value, reading.unit, prefs));
  if (reading.limit != null) {
    parts.push(`${ta('indicatorLimit', lang)} ${valueIn(reading.limit, reading.unit, prefs)}`);
  }

  // Honesty rule 4, on the row it applies to rather than in a footnote: an inversion
  // and a water balance are inferred, and the reader is entitled to weigh them
  // differently from a measured wind.
  if (reading.provenance.kind === 'proxy') parts.push(ta('adviceProxy', lang));

  return parts.join(' · ');
}
