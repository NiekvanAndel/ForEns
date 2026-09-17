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
import { cardsOf, splitColumns, TWO_COLUMN_WIDTH } from '../core/layout';
import { TAB_BAR_CLEARANCE, TAB_BAR_CLEARANCE_SIDE } from './GlassTabBar';

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
 * Whether there is room for two columns of cards.
 *
 * What pages should ask instead of `useLandscape` when the question is "how many
 * columns", because the honest answer depends on how wide the window is and nothing
 * else. `useLandscape` stays for the questions that really are about shape — where a
 * floating panel goes, how much height a map may take.
 */
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return width >= TWO_COLUMN_WIDTH;
}

/**
 * The room a scrolling page leaves around its content: the hardware's, and the tab bar's.
 *
 * In portrait the safe area is top and bottom, the sides are free, and the floating tab
 * bar is a band across the bottom. Turned sideways all three move: the notch and the
 * rounded corner take the edges, and the bar stands up against the right one. A page
 * that kept its portrait padding would put its first card under the camera and its last
 * one behind the tabs.
 *
 * One hook rather than two, because the right-hand padding has two claims on it and
 * something has to add them up.
 */
export function usePagePadding(base = space[5]) {
  const insets = useSafeAreaInsets();
  const landscape = useLandscape();
  return {
    paddingLeft: base + insets.left,
    paddingRight: base + insets.right + (landscape ? TAB_BAR_CLEARANCE_SIDE : 0),
    paddingBottom: insets.bottom + (landscape ? space[4] : TAB_BAR_CLEARANCE),
  };
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
