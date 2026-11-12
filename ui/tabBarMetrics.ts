/**
 * The floating tab bar's footprint, kept apart from `GlassTabBar` so the layout
 * helpers can use it without a require cycle (`GlassTabBar` imports `ui/layout`).
 */

/**
 * How much room a scrolling page must leave under its content so the last card
 * clears the floating bar. The bar is `position: absolute`, so nothing reserves
 * space for it: every tab page adds this to its own bottom inset.
 *
 * It is the bar's own height plus a little air — icons only, no labels, which is
 * what makes it short enough for a chart and its play button to sit above it.
 */
export const TAB_BAR_CLEARANCE = 84;

/**
 * The same, for the bar stood on its end against the right edge in landscape.
 *
 * Narrower than it is tall, because a column of icons is one icon wide where a row of
 * them is the screen: the capsule's width plus its padding and the air beside it.
 */
export const TAB_BAR_CLEARANCE_SIDE = 64;
