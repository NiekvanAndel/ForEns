/**
 * What a field-condition reading is called, and how its reason reads.
 *
 * Four surfaces draw the same readings — the card on 'Nu', the blocks on 'Actueel',
 * the row per location on the overview, and the threshold line on 'Grafiek' — and the
 * lesson from the rainfall merge is that a second path answering the same question
 * drifts from the first. `fieldAdvice` decides *what is true*; this decides *what it
 * is called*, once, and everything that draws a reading reads it here.
 *
 * `core/model/fieldAdvice` holds no words at all, deliberately: a module that decides
 * a boundary and also writes the sentence about it is a module that cannot be
 * translated. So the factor is an id there and a key here.
 */
import {
  fmtMm, fmtTempValue, fmtWindValue, ta, windUnitLabel, type AppStringKey, type LangCode,
} from '../../core/i18n';
import type {
  AdviceFactor, AdviceFamily, AdviceReading, AdviceUnit,
} from '../../core/model/fieldAdvice';
import type { Prefs } from '../../core/prefs';

/** The reader's units, which is all any of this needs of the preferences. */
export type AdviceUnits = Pick<Prefs, 'lang' | 'tempUnit' | 'windUnit'>;

/** What each family is called — the settings rows, the block titles, the editor. */
export const FAMILY_LABEL: Record<AdviceFamily, AppStringKey> = {
  spray: 'adviceSpray',
  frost: 'adviceFrost',
  workability: 'adviceWork',
  fertilise: 'adviceFert',
};

/**
 * What each row is called, by factor and — where one factor has more than one state
 * to be in — by level.
 *
 * A table rather than a function, so adding a family later is a row here and a row in
 * `fieldAdvice`, and the two cannot drift into saying different things about the same
 * reading.
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

/** What the figure in a row is, so a reason reads as a sentence and not a number. */
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

/** `YYYY-MM-DDTHH:00` → "05:00". The windows are whole hours; the clock says so. */
export const clock = (stamp: string) => stamp.slice(11, 16);

/** The quantity a reading's figure is, on its own — a block's title, a chart's line. */
export function quantityLabel(reading: AdviceReading, lang: LangCode): string {
  const key = QUANTITIES[reading.factor];
  return key ? ta(key, lang) : ta(FAMILY_LABEL[reading.family], lang);
}

/**
 * What the row is called, with the open window in it where there is one.
 *
 * An open spray window without its hours is the least useful true sentence the app
 * could print, so the stretch goes in the title rather than into the reason.
 */
export function adviceTitle(reading: AdviceReading, lang: LangCode): string {
  const entry = TITLES[reading.factor];
  const title = ta(typeof entry === 'string' ? entry : entry[reading.level], lang);

  if (reading.factor === 'sprayOpen' && reading.window) {
    return `${title} ${ta('adviceUntil', lang)} ${clock(reading.window.to)}`;
  }
  // Shut now but open later: the reader's next question is when, so the title answers
  // it and the reason stays the boundary that is holding it shut.
  if (reading.level > 0 && reading.window && reading.family === 'spray') {
    return `${title} · ${ta('adviceFrom', lang)} ${clock(reading.window.from)}`;
  }
  return title;
}

/** One figure in the reader's own units. A boundary is a fact; its unit is a taste. */
export function adviceValue(
  value: number,
  unit: AdviceUnit | null,
  units: AdviceUnits
): string {
  switch (unit) {
    case 'kmh':
      return `${fmtWindValue(value, units.windUnit)} ${windUnitLabel(units.windUnit)}`;
    case 'C':
      return `${fmtTempValue(value, units.tempUnit)}°`;
    case 'mm':
      return `${fmtMm(value)} mm`;
    case 'pct':
      return `${Math.round(value)}%`;
    case 'days':
      return `${Math.round(value)} ${ta('adviceDryDays', units.lang).toLowerCase()}`;
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
export function adviceReason(reading: AdviceReading, units: AdviceUnits): string {
  const lang = units.lang;
  const parts: string[] = [];

  const quantityKey = reading.factor === 'sprayOpen' && reading.closes
    ? QUANTITIES[reading.closes]
    : QUANTITIES[reading.factor];

  if (reading.factor === 'sprayOpen' && reading.closes) parts.push(ta('adviceCloses', lang));
  if (quantityKey) parts.push(ta(quantityKey, lang));

  if (reading.value != null) parts.push(adviceValue(reading.value, reading.unit, units));
  if (reading.limit != null) {
    parts.push(`${ta('indicatorLimit', lang)} ${adviceValue(reading.limit, reading.unit, units)}`);
  }

  // Honesty rule 4, on the row it applies to rather than in a footnote: an inversion
  // and a water balance are inferred, and a reader is entitled to weigh them
  // differently from a measured wind.
  if (reading.provenance.kind === 'proxy') parts.push(ta('adviceProxy', lang));

  return parts.join(' · ');
}

/**
 * The window a block's figure covers, with the family it belongs to in front of it.
 *
 * The block's own title is the quantity — "Wind", "Natbol", "Tekort 14 dagen" — which
 * on its own would sit in a grid beside the plain wind block and be indistinguishable
 * from it. The family is what says which question this one is answering.
 */
export function adviceBlockWindow(reading: AdviceReading, lang: LangCode): string {
  const family = ta(FAMILY_LABEL[reading.family], lang);
  if (reading.factor === 'sprayOpen' && reading.window) {
    return `${family} · ${clock(reading.window.from)}–${clock(reading.window.to)}`;
  }
  // A frost is a moment, and which night it falls on is half of what a grower is
  // reading it for.
  if (reading.family === 'frost' && reading.at) return `${family} · ${clock(reading.at)}`;
  return family;
}

/**
 * The shortest true thing about a reading: what it is, and its figure.
 *
 * For the places with a row's width rather than a card's — the overview's line per
 * location — where the full reason would truncate and lose its boundary, which is the
 * half that makes it checkable.
 */
export function adviceShort(reading: AdviceReading, units: AdviceUnits): string {
  const title = adviceTitle(reading, units.lang);
  if (reading.value == null) return title;
  return `${title} · ${adviceValue(reading.value, reading.unit, units)}`;
}
