/**
 * How a page's cards are found and shared between two columns when the phone is turned
 * sideways.
 *
 * Here rather than beside the component that uses it, for the reason the fixtures are:
 * anything that imports React Native cannot be reached by the test runner, and this is
 * the part worth testing. React itself is plain JavaScript and loads fine, so the
 * flattening lives here too. `ui/layout` holds the component; this holds its rules.
 */
import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from 'react';

/**
 * Flatten a page's children into the cards it is actually made of, with unique keys.
 *
 * A page is written as a fragment holding a conditional holding more fragments — the
 * loading branch, the error branch, the real one — so its "top-level children" as React
 * sees them are two or three nodes, not the eight cards a reader sees. Fragments are
 * expanded so the column split works on the cards.
 *
 * **The re-keying is the point, not a detail.** `Children.toArray` keys what it returns
 * `.0`, `.1`, `.2` — and it starts again from `.0` on every call. Recursing into a
 * fragment therefore produces a second `.0`, and dropping both into one column hands
 * React two children with the same key, which it warns about and which lets it confuse
 * one card for another across a re-render. So each card is re-keyed by its path through
 * the tree, which is unique by construction and stable as long as the page's shape is.
 */
export function cardsOf(node: ReactNode, prefix = ''): ReactNode[] {
  return Children.toArray(node).flatMap((child, index) => {
    if (isValidElement(child) && child.type === Fragment) {
      const children = (child.props as { children?: ReactNode }).children;
      return cardsOf(children, `${prefix}${index}.`);
    }
    return isValidElement(child)
      ? [cloneElement(child, { key: `${prefix}${child.key ?? index}` })]
      : [child];
  });
}

/**
 * Where each card goes: across the top, into the left column, the right, or the bottom.
 *
 * Pure, and separate from the component, because this is the part with an off-by-one in
 * it. A page that asks for more spanning cards than it has, or for a leading and a
 * trailing span that overlap, must still get every card exactly once — losing one would
 * be a card that silently stops being drawn on a screen nobody has rotated yet.
 */
export function splitColumns<T>(cards: readonly T[], spanning = 0, spanningEnd = 0) {
  const head = Math.min(Math.max(spanning, 0), cards.length);
  const tail = Math.min(Math.max(spanningEnd, 0), cards.length - head);
  const middle = cards.slice(head, cards.length - tail);
  return {
    full: cards.slice(0, head),
    left: middle.filter((_, i) => i % 2 === 0),
    right: middle.filter((_, i) => i % 2 === 1),
    end: tail > 0 ? cards.slice(cards.length - tail) : [],
  };
}

/**
 * The narrowest a block on 'Actueel' may get before its label starts wrapping.
 *
 * The grid takes as many columns as fit at this width rather than a fixed count, so it
 * holds at the sizes between: two across a portrait phone, four turned sideways.
 *
 * The figure comes from the reason the grid was two across to begin with — a third
 * column in portrait put a title like "Luchtvochtigheid" on three lines, at about 108
 * points a block. Four columns of a landscape screen are still around 165, comfortably
 * wider than the three that failed.
 */
export const MIN_TILE_WIDTH = 165;

/** Never fewer than two, never more than four: one block a row is a list, and five is a
 *  row of figures too small to read at arm's length. */
export const TILE_COLUMN_RANGE = [2, 4] as const;

/**
 * How many blocks fit in the width a page has left for them.
 *
 * `available` is measured rather than derived from the screen: the page's own padding
 * and, sideways, the tab bar standing against the edge both come off the width before
 * the blocks divide it, and only the grid itself knows what is left.
 */
export function gridColumns(available: number, gap: number): number {
  const fits = Math.floor((available + gap) / (MIN_TILE_WIDTH + gap));
  return Math.min(TILE_COLUMN_RANGE[1], Math.max(TILE_COLUMN_RANGE[0], fits));
}

/**
 * The width below which a day row on 'Verwachting' and 'Nu' prints its readings a
 * size down.
 *
 * The row has six columns, and at the full size a freezing day ("-12° 24°") is a few
 * points too wide for them on a 375-point screen. It used to solve that per reading,
 * with `adjustsFontSizeToFit` — which on iOS ignores `minimumFontScale` as soon as the
 * text node has a nested one inside it, and every reading here nests its unit. The
 * result was two or three rows in a list printed visibly smaller than the rest, picked
 * out by nothing a reader could see: whichever days happened to carry the longest
 * numbers.
 *
 * So the size is decided by the width the row actually got and nothing else. Every row
 * in a list has the same width, so they agree — which is the property that was missing.
 */
export const DAY_ROW_COMPACT_WIDTH = 360;

/** Whether a day row that wide has to print a size down. Zero means unmeasured, which
 *  is the first frame: assume there is room rather than flashing small text. */
export function dayRowCompact(width: number): boolean {
  return width > 0 && width < DAY_ROW_COMPACT_WIDTH;
}
