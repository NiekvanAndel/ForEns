/**
 * The overview page: which widgets there are, what each one needs, and how a grower
 * arranges them.
 *
 * The rest of the app is one location at a time — the pager picks it, every tab
 * answers for it. This page is the other question, and for an arable grower it is the
 * first one of the day: across every field I have set up, what was it, what is it, and
 * what is coming? A page that answers that is a page you open instead of swiping
 * through five locations on four tabs.
 *
 * ## A catalogue, not a layout
 *
 * Nothing here decides what the page looks like. Each entry says what a widget *is* —
 * how wide it wants to be, and what data it cannot draw without — and the reader's own
 * arrangement decides the rest, through the same `TileLayout` machinery the blocks on
 * 'Actueel' use. One implementation of "your order, minus the ones you switched off",
 * reused rather than written twice.
 *
 * ## `needs` is not documentation
 *
 * It is what stops the page fetching everything. Every source here costs a request per
 * saved location — conditions, the nowcast, the outlook — and a grower with eight
 * fields who only wants the rainfall ranking should pay for one of them, not three.
 * `neededSources` reads the arrangement and answers which to switch on, so hiding a
 * widget makes the page cheaper and not merely shorter.
 *
 * ## Adding one
 *
 * Put it in `OVERVIEW_WIDGETS` and write the component. It appears for everybody,
 * including readers who arranged their page before it existed, because an id the
 * layout has never heard of keeps its natural place — see `arrangeTiles`. Nothing
 * else has a list of widgets in it.
 */
// From `core/arrangement`, never from `core/prefs`: preferences hold this page's
// default layout, so importing them back would be a cycle — and was.
import { arrangeTiles, type TileLayout } from './arrangement';

/** What a widget needs fetched before it can say anything. */
export type OverviewSource =
  /** Current conditions per saved location — `useAllLocationConditions`. */
  | 'conditions'
  /** The radar nowcast per saved location. The heaviest of the three. */
  | 'nowcast'
  /** A short forecast per saved location: the coming days, and tonight. */
  | 'outlook'
  /** The 51 members' daily rainfall per location — how much they disagree. */
  | 'ensemble';

/** How much of a row a widget wants. Two halves sit side by side; a full one does
 *  not, whatever is next to it. */
export type OverviewSize = 'full' | 'half';

export interface OverviewWidget {
  id: string;
  size: OverviewSize;
  needs: readonly OverviewSource[];
  /** Off for everybody until they ask for it. The page opens with a set that is worth
   *  reading rather than everything at once — twelve widgets is a scroll, not a
   *  summary — and the pencil is how the rest arrive. */
  defaultHidden?: boolean;
}

/**
 * Every widget the page can draw, in its natural order.
 *
 * The order is the argument the page makes when nobody has rearranged it: what
 * happened, then what is happening, then what is coming, then the things you go
 * somewhere else for.
 */
export const OVERVIEW_WIDGETS: readonly OverviewWidget[] = [
  // The page in a sentence. First, because it is the only thing here that can be read
  // without looking at anything.
  { id: 'summary', size: 'full', needs: ['conditions'] },
  // Anything the app thinks is worth knowing, per location. Draws nothing when every
  // location is quiet, which is most days and the point.
  { id: 'alerts', size: 'full', needs: ['conditions'] },
  // The reader's own thresholds, with what each station reads now.
  { id: 'rules', size: 'full', needs: [] },
  // What fell. The first number an arable grower wants in the morning.
  { id: 'rain24', size: 'half', needs: ['conditions'] },
  // And what is coming, over the same ranking, so the two read as one column.
  { id: 'rainNext', size: 'half', needs: ['outlook'] },
  { id: 'temp', size: 'half', needs: ['conditions'] },
  { id: 'wind', size: 'half', needs: ['conditions'] },
  // Tonight's minimum per location. Off by default: it matters intensely for a few
  // weeks a year and is noise for the rest.
  { id: 'frost', size: 'half', needs: ['outlook'], defaultHidden: true },
  // The one widget that answers "can I work" rather than "what is the weather".
  { id: 'workability', size: 'full', needs: ['conditions', 'outlook'] },
  // The coming days, a row per location, each a way into that location's own page.
  { id: 'outlook', size: 'full', needs: ['outlook'] },
  // How much the members disagree about tomorrow's rain. The one widget here that is
  // about confidence rather than weather, which is why it sits after the forecast it
  // qualifies rather than among the readings.
  { id: 'confidence', size: 'full', needs: ['ensemble'] },
  // Rain in the next two hours, for the location in front. The sharpest thing the app
  // has, and the only widget here that is about one place.
  { id: 'nowcast', size: 'full', needs: ['nowcast'], defaultHidden: true },
  // Every location on one map, as a way in rather than as a map to read.
  { id: 'map', size: 'full', needs: [] },
];

/** The arrangement a reader starts with: the catalogue's order, minus the ones that
 *  are off until asked for. */
export const DEFAULT_OVERVIEW_LAYOUT: TileLayout = {
  order: [],
  hidden: OVERVIEW_WIDGETS.filter((w) => w.defaultHidden).map((w) => w.id),
};

/** The widgets to draw, in the reader's order. */
export function arrangeWidgets(layout: TileLayout): OverviewWidget[] {
  return arrangeTiles(OVERVIEW_WIDGETS, layout);
}

/**
 * Which fetches the arrangement actually justifies.
 *
 * The saving is per saved location and per source, so on a page with four locations
 * and the nowcast widget hidden this is four requests not eight.
 */
export function neededSources(layout: TileLayout): Set<OverviewSource> {
  const out = new Set<OverviewSource>();
  for (const w of arrangeWidgets(layout)) for (const n of w.needs) out.add(n);
  return out;
}

/**
 * Pair the widgets into rows: halves two at a time, fulls on their own.
 *
 * Here rather than in the page because it is the one bit of layout with an edge case
 * in it — a half with a full after it, or a half at the end, has to stand alone
 * rather than stretch, and a half stretched to a full width is a widget claiming a
 * prominence its author did not ask for.
 */
export function widgetRows(widgets: readonly OverviewWidget[]): OverviewWidget[][] {
  const rows: OverviewWidget[][] = [];
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i] as OverviewWidget;
    const next = widgets[i + 1];
    if (w.size === 'half' && next?.size === 'half') {
      rows.push([w, next]);
      i++;
    } else {
      rows.push([w]);
    }
  }
  return rows;
}
