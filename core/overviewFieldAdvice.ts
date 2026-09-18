/**
 * The field conditions of every saved location, for the overview page.
 *
 * The same four families the location's own pages draw, run against what this page
 * already fetches: the short outlook per location, and the observation model behind
 * the rainfall ranking. No request of its own — that is the whole reason it is
 * shaped this way, because a page with eight fields on it pays per location for
 * everything it asks for.
 *
 * ## What it can and cannot see from here
 *
 * The outlook is three days of temperature, humidity, rain, wind and day/night, so
 * spraying, frost and fertilising all answer in full. Trafficability and the drought
 * build-up read a week and a fortnight of rain against evaporation, which this page
 * does not hold for every location — so on most accounts they produce nothing here
 * and say nothing, which is the honest outcome and needs no special case:
 * `fieldAdvice` already refuses to speak without its inputs.
 *
 * Pure, and word-free like the kernel under it. The widget names the readings.
 */
import {
  ADVICE_FAMILIES, fieldAdvice, adviceLevel, type AdviceFamily, type AdviceReading,
} from './model/fieldAdvice';
import type { LocationOutlook } from './overviewData';
import type { ForecastModel } from './model/types';

export interface LocationAdvice {
  /** The saved location's slot, for opening it. */
  index: number;
  name: string;
  readings: AdviceReading[];
  /** The worst level among them — one figure per location, as the disease page has. */
  level: 0 | 1 | 2;
}

export interface LocationAdviceInput {
  index: number;
  name: string;
  /** The short forecast for this location, where it has landed. */
  outlook: LocationOutlook | null;
  /** Its observation model, for the hours behind now. Null while loading. */
  model: ForecastModel | null;
  /** Which families the reader left on. Omitted means all of them. */
  families?: readonly AdviceFamily[];
}

/**
 * One location's readings.
 *
 * `now` comes from the outlook, which is already trimmed to the hour the reader is
 * in *at that location* — not the device's hour. A page listing eight fields in two
 * time zones would otherwise date them all by where the phone happens to be.
 */
export function locationAdvice({
  index, name, outlook, model, families,
}: LocationAdviceInput): LocationAdvice {
  const nowKey = outlook?.hours[0]?.time ?? model?.nowHour ?? null;
  if (!nowKey) return { index, name, readings: [], level: 0 };

  const readings = fieldAdvice({
    hours: outlook?.hours ?? [],
    past: model?.pastHours ?? [],
    days: outlook?.days ?? [],
    nowKey,
    families: families ?? ADVICE_FAMILIES,
  });

  return { index, name, readings, level: adviceLevel(readings) };
}

/**
 * Every location's worst reading, worst first — what the widget draws.
 *
 * One line per location rather than one per reading: a grower with eight fields and
 * four families would otherwise get thirty-two rows on a page whose whole argument is
 * that it fits on a screen. The binding reason is on the line, and the location's own
 * card has the rest.
 *
 * Locations with nothing to report are left out. Not hidden — there is genuinely
 * nothing to say about them, and a list of "fine, fine, fine" is a list nobody reads
 * the top of.
 */
export function worstPerLocation(
  all: readonly LocationAdvice[]
): { advice: LocationAdvice; reading: AdviceReading; others: number }[] {
  return all
    .map((advice) => {
      const ranked = [...advice.readings].sort((a, b) => b.level - a.level);
      const reading = ranked[0];
      if (!reading || reading.level === 0) return null;
      // How many *other* readings are also worth knowing, so the line can say that
      // this field has more than one thing wrong with it without listing them.
      const others = ranked.filter((r) => r !== reading && r.level > 0).length;
      return { advice, reading, others };
    })
    .filter((r): r is { advice: LocationAdvice; reading: AdviceReading; others: number } => r != null)
    .sort((a, b) => b.reading.level - a.reading.level || a.advice.index - b.advice.index);
}
