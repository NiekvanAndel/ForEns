/**
 * A reader's own order for a set of things, and which of them are switched off.
 *
 * Its own module rather than a corner of `core/prefs`, because two things arrange
 * themselves this way — the blocks on 'Actueel' and the widgets on the overview — and
 * the second of them has a catalogue that preferences must not have to know about.
 * With this in `prefs`, `core/overview` imported `prefs` for the machinery while
 * `prefs` imported `overview` for its default, and the cycle left `DEFAULT_PREFS`
 * holding an undefined layout at module-evaluation time. A test caught it; a phone
 * would have too, a good deal later.
 *
 * So: the shape and the four operations live here, and both callers import them
 * without either knowing the other exists.
 */

export interface TileLayout {
  /** Block ids in the order they are shown. Anything not named here follows, in the
   *  order `modelTiles` produced it. */
  order: string[];
  /** Block ids switched off. */
  hidden: string[];
}

export const DEFAULT_TILE_LAYOUT: TileLayout = { order: [], hidden: [] };

/**
 * The blocks to draw, in the reader's order, with the hidden ones dropped.
 *
 * `all` is every block the app can draw, in its natural order. Ids in `order` come
 * first, in that order; anything the layout has never heard of keeps its natural
 * place behind them, which is what lets a new block appear for someone who arranged
 * their grid before it existed.
 */
export function arrangeTiles<T extends { id: string }>(
  all: readonly T[],
  layout: TileLayout
): T[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  const named = layout.order
    .map((id) => byId.get(id))
    .filter((t): t is T => t !== undefined);
  const seen = new Set(named.map((t) => t.id));
  const rest = all.filter((t) => !seen.has(t.id));
  const hidden = new Set(layout.hidden);
  return [...named, ...rest].filter((t) => !hidden.has(t.id));
}


/** The same, but keeping the hidden blocks — what the editor lists. */
export function arrangeAllTiles<T extends { id: string }>(
  all: readonly T[],
  layout: TileLayout
): T[] {
  return arrangeTiles(all, { order: layout.order, hidden: [] });
}


/**
 * Move a block, writing the whole arrangement back.
 *
 * `visibleIds` is what the editor is showing, hidden blocks included, so the stored
 * order is rewritten from the list the reader was actually looking at. Storing only
 * the moved pair instead would leave the rest of the order implicit, and the next
 * new block would land in the middle of somebody's carefully arranged grid.
 */
export function reorderTiles(layout: TileLayout, ids: string[], from: number, to: number): TileLayout {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return layout;
  const order = [...ids];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved as string);
  return { ...layout, order };
}


/** Switch one block on or off. */
export function toggleTile(layout: TileLayout, id: string): TileLayout {
  const hidden = layout.hidden.includes(id)
    ? layout.hidden.filter((h) => h !== id)
    : [...layout.hidden, id];
  return { ...layout, hidden };
}

