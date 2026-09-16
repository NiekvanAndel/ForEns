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
