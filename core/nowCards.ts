/**
 * The cards on 'Nu', and the order a reader puts them in.
 *
 * The page was a fixed stack: an alert, the field, what the weather is doing to the
 * crop, what it means for the work, the conditions, the hours, the radar, the week.
 * That order is one opinion about whose morning this is — and a page that opens on
 * four conclusions before it says what the temperature is serves a grower in April
 * and nobody in November.
 *
 * So the same `TileLayout` machinery the blocks on 'Actueel' and the widgets on the
 * overview already use, over a third kind of thing: drag to reorder, tap to switch
 * off. One implementation of "your order, minus what you hid", reused rather than
 * written a third time.
 *
 * ## Why the conclusions sit at the bottom by default
 *
 * The natural order below *is* the default, and disease pressure and the field
 * conditions come last in it. They are the newest thing on the page and the most
 * opinionated: a reader who opens 'Nu' to see the weather should find the weather,
 * and a reader who opens it for the spray window can drag that to the top in two
 * gestures and have it there for good. Defaulting the other way would have put a
 * wall of verdicts above the readings they are drawn from, for everybody, including
 * the people who never asked for them.
 *
 * ## Nothing here is a component
 *
 * This is a catalogue, exactly like `core/overview`: an id and whether it can be
 * switched off. The page maps ids onto elements, and a card the layout has never
 * heard of keeps its natural place — which is what lets a card added later appear
 * for somebody who arranged this page last month.
 */
import { arrangeTiles, type TileLayout } from './arrangement';

export interface NowCard {
  id: string;
  /**
   * Whether the reader may switch it off.
   *
   * One card cannot be: the conditions. It is the page's subject, it is what the tab
   * is named after, and a 'Nu' with no reading on it is a screen that has lost the
   * argument for existing. Everything else is a matter of taste.
   */
  fixed?: boolean;
}

/**
 * Every card the page can draw, in its natural order.
 *
 * What is happening, then what is coming, then what it means. The two conclusion
 * cards are last — see the note above.
 */
export const NOW_CARDS: readonly NowCard[] = [
  { id: 'alert' },
  { id: 'soil' },
  { id: 'conditions', fixed: true },
  { id: 'hours' },
  { id: 'radar' },
  { id: 'forecast' },
  { id: 'disease' },
  { id: 'advice' },
];

export const DEFAULT_NOW_LAYOUT: TileLayout = { order: [], hidden: [] };

/** The cards to draw, in the reader's order, with the hidden ones dropped. */
export function arrangeNowCards(layout: TileLayout): NowCard[] {
  const out = arrangeTiles(NOW_CARDS, layout);
  // A layout that hid the fixed card — written by hand, or by a version that let it
  // be hidden — must not leave the page blank. The setting is refused here rather
  // than sanitised on the way in, so an old store keeps the rest of its arrangement.
  const conditions = NOW_CARDS.find((c) => c.fixed);
  if (conditions && !out.some((c) => c.id === conditions.id)) {
    const at = NOW_CARDS.indexOf(conditions);
    out.splice(Math.min(at, out.length), 0, conditions);
  }
  return out;
}
