/**
 * What the basis version says, as a list a reader can switch on and off.
 *
 * The four rule-based families arrived with their own switches; the disease models and
 * the significant-weather warnings did not, because each was built before there was a
 * list to put it in. They belong in the same one: all six are the basis version making
 * a statement about one location, and a grower with no sprayer, no potatoes or no
 * interest in being told it will be windy should be able to say so once, in one place.
 *
 * ## One door per setting
 *
 * The switches are not all stored in the same field, and deliberately so. The warnings
 * have governed the block on 'Nu' *and* every notification since before this list
 * existed, through `alertsEnabled`; moving them into the advice layer would migrate a
 * stored preference for cosmetic tidiness and break every device that had set it. So
 * this module is the list and the mapping, and each component keeps writing the field
 * it always wrote.
 *
 * ## Switched off means not computed
 *
 * Not "computed and hidden". The disease models cost a week of measurements per
 * location, so a reader who switches them off stops paying for them — see
 * `state/disease`. That is the same promise the advice families make, and it is what
 * makes these switches worth having rather than decoration.
 */
import { adviceFamilyOn, toggleAdviceFamily, type Prefs } from './prefs';
import { ADVICE_FAMILIES, type AdviceFamily } from './model/fieldAdvice';

/** One thing the basis version can be asked to stop saying. */
export type BasisComponent = 'alerts' | 'disease' | AdviceFamily;

/**
 * Every component, in the order the settings page lists them.
 *
 * Warnings first: they are the oldest thing here and the one every reader has, farmer
 * or not. Then the crop, then the work.
 */
export const BASIS_COMPONENTS: readonly BasisComponent[] = [
  'alerts', 'disease', ...ADVICE_FAMILIES,
];

/** Which components are conclusions the advice layer's master switch governs. */
export function isAdviceComponent(id: BasisComponent): boolean {
  return id !== 'alerts';
}

/** Whether one component speaks at all. */
export function basisComponentOn(
  prefs: Pick<Prefs, 'alertsEnabled' | 'advice'>,
  id: BasisComponent
): boolean {
  if (id === 'alerts') return prefs.alertsEnabled;
  return adviceFamilyOn(prefs.advice, id);
}

/**
 * The preference patch that switches one component on or off.
 *
 * A patch rather than a whole `Prefs`, because the caller is a settings row with
 * `setPref` in hand and the alternative is this module knowing how preferences are
 * written.
 */
export function toggleBasisComponent(
  prefs: Pick<Prefs, 'alertsEnabled' | 'advice'>,
  id: BasisComponent
): Partial<Prefs> {
  if (id === 'alerts') return { alertsEnabled: !prefs.alertsEnabled };
  return { advice: toggleAdviceFamily(prefs.advice, id) };
}

/** The components that are on, which is what anything downstream should read. */
export function enabledBasisComponents(
  prefs: Pick<Prefs, 'alertsEnabled' | 'advice'>
): BasisComponent[] {
  return BASIS_COMPONENTS.filter((id) => basisComponentOn(prefs, id));
}
