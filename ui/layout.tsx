/**
 * What changes when the phone is turned on its side.
 *
 * The app was portrait-locked until now, so every page is a single column of cards
 * down a scroll view. Landscape gives roughly twice the width and half the height,
 * which makes that column both too wide to read and too long to scroll — so the pages
 * lay their cards out in two columns instead, and the map surfaces let their panel
 * float over the map rather than take a band of the little height that is left.
 *
 * Two things live here: the question every screen asks (`useLandscape`), and the layout
 * that answers it for a page of cards (`Columns`).
 */
import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../theme';
import { cardsOf, splitColumns } from '../core/layout';

/**
 * Whether the screen is wider than it is tall.
 *
 * From the window rather than from a device orientation API on purpose: what the layout
 * cares about is the shape of the space it has, and `useWindowDimensions` re-renders on
 * every change of it — a rotation, but also a split view or a software keyboard, which
 * an orientation constant would miss.
 */
export function useLandscape(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height;
}

/**
 * A page's own horizontal padding, plus whatever the hardware is taking.
 *
 * In portrait the safe area is top and bottom and the sides are free; turned sideways,
 * the notch and the rounded corner move to one edge and the home indicator's sliver to
 * the other. A page that keeps a constant side padding puts its first card under the
 * camera on one side and against the bezel on the other.
 */
export function useSidePadding(base = space[5]) {
  const insets = useSafeAreaInsets();
  return { paddingLeft: base + insets.left, paddingRight: base + insets.right };
}

export interface ColumnsProps {
  children: ReactNode;
  /**
   * How many of the leading cards run the full width before the columns start.
   *
   * The page's own heading, and anything that is a banner rather than a card — an
   * alert belongs across the top, not in a column where half the screen is a warning
   * and the other half is the weather.
   */
  spanning?: number;
  /**
   * How many of the trailing cards run the full width, after the columns.
   *
   * For a page that ends in something wide by nature — the chart on 'Grafiek' is a time
   * axis, and half a screen of it is half a day.
   */
  spanningEnd?: number;
  gap?: number;
}

/**
 * A page's cards in one column or two, depending on which way the phone is held.
 *
 * Portrait renders the children untouched, so nothing about the layout that has been
 * looked at for months moves. Landscape splits them left, right, left, right.
 *
 * ## Alternating rather than balancing
 *
 * The columns can end up ragged: a short card and a tall one on the same row leave one
 * side with white space below it. Balancing properly means knowing each card's height,
 * which means measuring, which means a layout pass that moves cards after they have
 * been drawn — and a card that jumps once on every rotation is worse than one that
 * leaves a gap. Alternating is at least predictable: a reader who knows the order of
 * the page in portrait can still find things in landscape.
 *
 * The whole thing scrolls as one, so a ragged bottom costs nothing but the space.
 */
export function Columns({
  children, spanning = 0, spanningEnd = 0, gap = space[4],
}: ColumnsProps) {
  const landscape = useLandscape();
  if (!landscape) return <>{children}</>;

  const { full, left, right, end } = splitColumns(cardsOf(children), spanning, spanningEnd);
  return (
    <>
      {full}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap }}>
        <View style={{ flex: 1, gap }}>{left}</View>
        <View style={{ flex: 1, gap }}>{right}</View>
      </View>
      {end}
    </>
  );
}
