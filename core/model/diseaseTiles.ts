/**
 * The disease blocks on 'Actueel'.
 *
 * The same `Tile` shape as everything else on that page, so `arrangeTiles` and the
 * editor carry them without knowing they exist — the reason soil went into the three
 * existing screens rather than onto a page of its own, applied again.
 *
 * ## They are derived, so they get no green dot
 *
 * A Smith period is not a measurement. It is a conclusion drawn from measurements, and
 * the app already distinguishes measured from modelled — this is the third kind the
 * plan warned about. The dot means an instrument reported the figure beside it, and no
 * instrument reports a Smith period, so `measured` is false on every block here even
 * where the humidity behind them was measured at 10 cm on this very field.
 *
 * The state's colour carries what matters instead, exactly as it does for suction.
 */
import type { Tile } from './tiles';
import type { DiseaseReading } from './diseasePressure';
import type { SoilStatus } from './soil';

/** The words the blocks need, handed in so this stays pure. */
export interface DiseaseTileLabels {
  /** The model's own name — "Phytophthora · Smith", "Cercospora · DIV". */
  smith: string;
  div: string;
  /** The window each figure covers. */
  smithWindow: string;
  divWindow: string;
}

/**
 * A block per model that applies here.
 *
 * The value is the model's own figure — days toward a Smith period, the two-day DIV
 * total — because that is what a grower who knows the model reads, and a grower who
 * does not is no better served by a word. The crop is the block's time label where
 * there is more than one, since two badges under one weather pole must be tellable
 * apart at a glance.
 */
export function diseaseTiles(
  readings: readonly DiseaseReading[],
  labels: DiseaseTileLabels
): Tile[] {
  const manyCrops = new Set(readings.map((r) => r.crop)).size > 1;

  return readings.map((r) => {
    const window = r.model === 'smith' ? labels.smithWindow : labels.divWindow;
    return {
      id: `disease-${r.model}-${r.crop.toLowerCase()}`,
      title: r.model === 'smith' ? labels.smith : labels.div,
      timeLabel: manyCrops ? `${r.crop} · ${window}` : window,
      value: r.value,
      // A bare number in the model's own terms — never `status`, which would print
      // "2 days" as the word for a soil state.
      kind: 'count' as const,
      // Derived, not measured. See the note at the top.
      measured: false,
      // The state's colour, so the figure and its ink say the same thing.
      ...(r.level > 0 ? { status: r.level as SoilStatus } : {}),
    };
  });
}
