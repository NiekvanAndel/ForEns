/**
 * How a page's cards land in two columns when the phone is turned sideways.
 *
 * The component around this is React and needs a renderer to test; the arithmetic does
 * not, and the arithmetic is where the mistakes are. What is pinned here is that every
 * card is placed exactly once, whatever a page asks for — a card dropped by a bad slice
 * would simply stop being drawn, on a screen most readers never rotate.
 */
import { describe, expect, it } from 'vitest';
import { splitColumns } from '../core/layout';

const page = ['title', 'alert', 'hero', 'hours', 'radar', 'forecast', 'footer'];

/** Every card, once, in the order the layout draws them. */
const drawn = (s: ReturnType<typeof splitColumns<string>>) => [
  ...s.full, ...s.left, ...s.right, ...s.end,
];

describe('splitColumns', () => {
  it('spans the leading cards and alternates the rest', () => {
    const s = splitColumns(page, 2);
    expect(s.full).toEqual(['title', 'alert']);
    expect(s.left).toEqual(['hero', 'radar', 'footer']);
    expect(s.right).toEqual(['hours', 'forecast']);
    expect(s.end).toEqual([]);
  });

  it('spans the trailing cards too, where a page ends in something wide', () => {
    const s = splitColumns(page, 1, 1);
    expect(s.full).toEqual(['title']);
    expect(s.end).toEqual(['footer']);
    expect(s.left).toEqual(['alert', 'hours', 'forecast']);
    expect(s.right).toEqual(['hero', 'radar']);
  });

  it('places every card exactly once, whatever it is asked for', () => {
    for (const spanning of [0, 1, 2, 7, 99, -3]) {
      for (const end of [0, 1, 3, 99, -1]) {
        const s = splitColumns(page, spanning, end);
        expect(drawn(s).slice().sort(), `${spanning}/${end}`).toEqual([...page].sort());
      }
    }
  });

  it('does not let a leading and a trailing span claim the same card', () => {
    // Both counts cover the whole page: the leading one wins and the trailing one gets
    // what is left, which is nothing. The alternative is a card drawn twice.
    const s = splitColumns(page, 7, 7);
    expect(s.full).toEqual(page);
    expect(s.end).toEqual([]);
    expect(drawn(s)).toEqual(page);
  });

  it('handles a page that has not loaded yet', () => {
    const s = splitColumns([], 2, 1);
    expect(drawn(s)).toEqual([]);
  });

  it('keeps the reading order down each column', () => {
    // A reader who knows the page in portrait should still find things: left column is
    // the odd-numbered cards in order, right column the even ones.
    const s = splitColumns(['a', 'b', 'c', 'd', 'e']);
    expect(s.left).toEqual(['a', 'c', 'e']);
    expect(s.right).toEqual(['b', 'd']);
  });
});
