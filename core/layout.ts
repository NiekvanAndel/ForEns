/**
 * How a page's cards are shared between two columns when the phone is turned sideways.
 *
 * Here rather than beside the component that uses it, for the reason the fixtures are:
 * anything that imports React Native cannot be reached by the test runner, and this is
 * the part worth testing. `ui/layout` holds the component; this holds its arithmetic.
 */

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
