/**
 * Every disease model that applies here, run once.
 *
 * Three surfaces ask the same question — the card on 'Nu', the blocks on 'Actueel' and
 * the row per location on the overview — and the lesson from the rainfall merge is
 * that a second path answering it separately will drift from the first. So the models
 * run here and the surfaces read the result.
 *
 * ## One field, one crop; one pole, several
 *
 * A soil sensor sits in one field. A weather station stands over a yard where several
 * things grow, so this takes a *list* and returns a reading per applicable model —
 * potato and beet under one pole are two badges, not a choice.
 *
 * ## Nothing is scored twice
 *
 * The humid hours are folded once and both models read them. That is the whole reason
 * `humidHours` exists as its own kernel: Smith and DIV disagreeing about how many hours
 * were above 90% would be two answers to a question with one answer.
 */
import { cercospora, cercosporaAppliesTo, DIV_RECENT_THRESHOLD } from './cercospora';
import { smith, smithAppliesTo, smithVerdict } from './smith';
import { leafWetHours, type HumidHour, type HumidSource } from './humidHours';

/** Which model a reading came from. */
export type DiseaseModel = 'smith' | 'div';

export interface DiseaseReading {
  model: DiseaseModel;
  /** The crop it speaks for, so a page with two can say which is which. */
  crop: string;
  /** 0 nothing running, 1 building, 2 conditions have been suitable. The same three
   *  the badge draws, whichever model produced them. */
  level: 0 | 1 | 2;
  /**
   * The figure behind the level, in the model's own terms: days for Smith, the
   * two-day DIV total for Cercospora. Shown because a grower who knows the model
   * wants the number, and one who does not is no better served by a word.
   */
  value: number;
  /** What the figure is measured against, where the model has a fixed one. */
  limit: number | null;
  source: HumidSource;
}

export interface DiseasePressure {
  readings: DiseaseReading[];
  /** The worst level on the page, for anything that needs one figure per location. */
  level: 0 | 1 | 2;
  /** Hours the leaf was probably wet — a proxy, and it says so. Null where no model
   *  applies, since there is nothing for it to support. */
  leafWet: { hours: number; proxy: true } | null;
  source: HumidSource;
}

export interface DiseasePressureInput {
  hours: readonly HumidHour[];
  crops: readonly string[];
  source: HumidSource;
}

/**
 * The disease pressure at one location.
 *
 * Empty where nothing applies or nothing was measured — and those two are the same
 * answer on screen, deliberately: a page that distinguished "no model for your crop"
 * from "the probe said nothing" in its *layout* would be making the reader read an
 * absence. The card simply does not appear, and the reasons live here.
 */
export function diseasePressure({
  hours, crops, source,
}: DiseasePressureInput): DiseasePressure {
  const readings: DiseaseReading[] = [];

  if (hours.length) {
    for (const crop of crops) {
      if (smithAppliesTo(crop)) {
        const verdict = smithVerdict(smith({ hours, source }));
        readings.push({
          model: 'smith',
          crop,
          level: verdict.level,
          value: verdict.days,
          // Smith counts days toward a period; two make one.
          limit: 2,
          source,
        });
      }

      if (cercosporaAppliesTo(crop)) {
        const result = cercospora({ hours, source });
        readings.push({
          model: 'div',
          crop,
          // DIV has no "building" state: the two-day total is over the line or it is
          // not. Forcing a middle one would be inventing a stage the model has not got.
          level: result.recent >= DIV_RECENT_THRESHOLD ? 2 : 0,
          value: result.recent,
          limit: DIV_RECENT_THRESHOLD,
          source,
        });
      }
    }
  }

  const level = readings.reduce<0 | 1 | 2>(
    (worst, r) => (r.level > worst ? r.level : worst),
    0
  );

  return {
    readings,
    level,
    leafWet: readings.length ? leafWetHours(hours) : null,
    source,
  };
}
