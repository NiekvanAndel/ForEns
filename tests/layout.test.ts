/**
 * How a page's cards land in two columns when the phone is turned sideways.
 *
 * The component around this is React and needs a renderer to test; the arithmetic does
 * not, and the arithmetic is where the mistakes are. What is pinned here is that every
 * card is placed exactly once, whatever a page asks for — a card dropped by a bad slice
 * would simply stop being drawn, on a screen most readers never rotate.
 */
import { describe, expect, it } from 'vitest';
import { createElement, Fragment, isValidElement, type ReactElement } from 'react';
import { cardsOf, gridColumns, MIN_TILE_WIDTH, splitColumns } from '../core/layout';

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

describe('cardsOf', () => {
  /** A card, as a page writes one. */
  const card = (id: string) => createElement('view', { id });
  /** How the pages are actually shaped: a heading, then a branch that is a fragment. */
  const page = () =>
    createElement(
      Fragment,
      null,
      card('title'),
      createElement(Fragment, null, card('hero'), card('hours'), card('radar'))
    );

  const ids = (nodes: unknown[]) =>
    nodes.map((n) => (isValidElement(n) ? (n.props as { id: string }).id : String(n)));
  const keys = (nodes: unknown[]) =>
    nodes.map((n) => (isValidElement(n) ? (n as ReactElement).key : null));

  it('finds the cards inside the fragments a page is written with', () => {
    expect(ids(cardsOf(page()))).toEqual(['title', 'hero', 'hours', 'radar']);
  });

  it('gives every card a key of its own', () => {
    // The bug this exists for: Children.toArray keys `.0`, `.1` and starts again at `.0`
    // on every call, so a card from inside a fragment collided with the one beside it.
    // React warns, and may then confuse one card for the other across a re-render.
    const found = keys(cardsOf(page()));
    expect(new Set(found).size, `keys: ${found.join(', ')}`).toBe(found.length);
    expect(found.every((k) => k != null)).toBe(true);
  });

  it('keeps those keys stable across renders of the same page', () => {
    // A key that changed every render would remount every card on every state change.
    expect(keys(cardsOf(page()))).toEqual(keys(cardsOf(page())));
  });

  it('drops what React drops, and keeps what it keeps', () => {
    const withGaps = createElement(Fragment, null, card('a'), null, false, card('b'));
    expect(ids(cardsOf(withGaps))).toEqual(['a', 'b']);
  });

  it('reaches cards nested several fragments deep', () => {
    const deep = createElement(
      Fragment, null,
      createElement(Fragment, null, createElement(Fragment, null, card('buried')))
    );
    expect(ids(cardsOf(deep))).toEqual(['buried']);
    expect(keys(cardsOf(deep))[0]).not.toBeNull();
  });
});

describe('gridColumns', () => {
  const gap = 12;

  it('keeps a portrait phone at two across', () => {
    // A 390pt screen less the page's 20pt either side. Two is what the design settled on
    // and what a third column broke: "Luchtvochtigheid" on three lines.
    expect(gridColumns(390 - 40, gap)).toBe(2);
    // The smallest phone still in service, and the largest.
    expect(gridColumns(320 - 40, gap)).toBe(2);
    expect(gridColumns(440 - 40, gap)).toBe(2);
  });

  it('opens up to four when the phone is turned', () => {
    // 844pt across, less the page's padding and the tab bar standing on the right edge.
    expect(gridColumns(844 - 40 - 64, gap)).toBe(4);
    expect(gridColumns(932 - 40 - 64, gap)).toBe(4);
  });

  it('passes through three on the widths between', () => {
    // There is no orientation switch in here: the count follows the width, so the sizes
    // between — a smaller landscape phone, a split view — get what fits.
    expect(gridColumns(3 * MIN_TILE_WIDTH + 2 * gap, gap)).toBe(3);
    expect(gridColumns(3 * MIN_TILE_WIDTH + 2 * gap + 40, gap)).toBe(3);
  });

  it('never goes below two or above four', () => {
    // Zero is what the first render reports, before anything has been measured.
    expect(gridColumns(0, gap)).toBe(2);
    expect(gridColumns(120, gap)).toBe(2);
    expect(gridColumns(4000, gap)).toBe(4);
  });

  it('gives each block at least its minimum, at every count it chooses', () => {
    // The property the constant is for: whatever it answers, the blocks it implies are
    // never narrower than the width a label needs.
    for (let available = 200; available <= 1200; available += 7) {
      const columns = gridColumns(available, gap);
      const each = (available - (columns - 1) * gap) / columns;
      if (columns > 2) expect(each, `${available}pt / ${columns}`).toBeGreaterThanOrEqual(MIN_TILE_WIDTH);
    }
  });
});
