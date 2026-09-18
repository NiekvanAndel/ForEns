/**
 * The field-condition blocks on 'Actueel'.
 *
 * The same `Tile` shape as everything else on that page, so `arrangeTiles` and the
 * editor carry them without knowing they exist — the reasoning that put soil and the
 * disease models into the three existing screens rather than onto pages of their own,
 * applied again. A grower who wants the spray window at the top of their grid drags it
 * there, and one who never wants to see it switches it off.
 *
 * ## They are derived, so they get no green dot
 *
 * A spray window is not a measurement. It is a conclusion drawn from measurements and
 * a forecast, and the page's green dot promises that an instrument reported the figure
 * beside it. No instrument reports a spray window, so `measured` is false on every
 * block here even where the wind behind it was measured on this very field. The
 * state's colour carries what matters instead, exactly as it does for suction and for
 * the disease models.
 *
 * ## One block per reading, in the reading's own quantity
 *
 * The block prints the figure the boundary is about — the wind that is holding the
 * sprayer, the wet bulb the irrigation decision turns on, the surplus under the tyres
 * — rather than a level between 0 and 2. A number a grower can check against the block
 * beside it is worth more than a word this app invented.
 */
import type { Tile, TileKind } from './tiles';
import type { AdviceReading, AdviceUnit } from './fieldAdvice';
import type { SoilStatus } from './soil';

/** The words the blocks need, handed in so this module stays pure. */
export interface AdviceTileLabels {
  /** What each block is called — the quantity, from `ui/advice/words`. */
  title: (reading: AdviceReading) => string;
  /** The window it covers: "nu", "komende 48 uur", the open stretch. */
  timeLabel: (reading: AdviceReading) => string;
}

/** Which unit family a reading's figure belongs to, so the grid can convert it. */
function kindOf(unit: AdviceUnit | null): TileKind {
  switch (unit) {
    case 'kmh': return 'wind';
    case 'C': return 'temp';
    case 'mm': return 'mm';
    case 'pct': return 'percent';
    // Days toward a mowing window, and a temperature sum: numbers in their own terms.
    default: return 'count';
  }
}

/**
 * A block per reading that has a figure behind it.
 *
 * A reading with no number — an open spray window with nothing in the forecast to
 * close it — is left out rather than drawn as a dash. On the card it still says
 * something, because there it has a sentence; in a grid of figures a block whose
 * figure is a dash is a block that holds a slot and answers nothing.
 */
export function adviceTiles(
  readings: readonly AdviceReading[],
  labels: AdviceTileLabels
): Tile[] {
  return readings
    .filter((r) => r.value != null)
    .map((r) => ({
      // The *reading's* id, not the factor's: a spray window that was held by the
      // wind this morning and by Delta T this afternoon is one block in the grid, and
      // an id that changed with the reason would lose the reader's arrangement of it
      // every time the weather changed its mind.
      id: r.id.replace(':', '-'),
      title: labels.title(r),
      timeLabel: labels.timeLabel(r),
      value: r.value,
      kind: kindOf(r.unit),
      // Derived, never measured. See the note at the top.
      measured: false,
      // The state's colour, so the figure and its ink say the same thing. Level 0 is
      // "nothing in the way", which the grid draws in ordinary ink like any reading.
      ...(r.level > 0 ? { status: r.level as SoilStatus } : {}),
    }));
}
