/**
 * The rule-based advice for the location being viewed.
 *
 * A hook rather than a `useMemo` in each page, because three surfaces ask for it —
 * the card on 'Nu', the blocks on 'Actueel' and the threshold line on 'Grafiek' — and
 * two of them are on screen at once behind the pager. The same reasoning as
 * `useDisease`, minus the fetching: this needs nothing the forecast has not already
 * loaded, so it costs a derivation and no request.
 *
 * What it does own is the rule that a family the reader switched off is **never
 * computed**. `enabledAdviceFamilies` decides what runs, not what is drawn, and
 * keeping that decision in one place is what makes the setting mean something.
 */
import { useMemo } from 'react';
import { usePrefs } from './prefs';
import { useForecast } from './forecast';
import { enabledAdviceFamilies } from '../core/prefs';
import {
  ADVICE_FAMILIES, fieldAdvice, type AdviceReading,
} from '../core/model/fieldAdvice';

export function useLocationAdvice(): AdviceReading[] {
  const { prefs } = usePrefs();
  const { model } = useForecast();

  return useMemo(
    () => (model
      ? fieldAdvice({
        hours: model.futureHours,
        past: model.pastHours,
        days: model.days,
        nowKey: model.nowHour,
        families: enabledAdviceFamilies(ADVICE_FAMILIES, prefs.advice),
      })
      : []),
    [model, prefs.advice]
  );
}
