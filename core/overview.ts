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

/**
 * Whether a widget speaks for every saved location or for one.
 *
 * Most of this page is `all` — that is what it is for. But the pieces that answer a
 * place closely, the ones the tabs are built from, are worth having here too: a
 * grower whose day is mostly about one field should be able to put its hero and its
 * forecast on the page they open, without giving up the comparison widgets around
 * them.
 *
 * A `location` widget draws for the selected location and names it in its heading —
 * a card with no place on a page about every place would be read as all of them. Some
 * of them can be pinned to a *particular* location instead, through the `location`
 * setting; which ones, and why not all, is at the entries themselves.
 */
export type OverviewScope = 'all' | 'location';

/**
 * What a widget lets a reader change about it, beyond order and visibility.
 *
 * Deliberately three keys shared by every widget rather than a bag of anything: a
 * settings sheet that can render three controls can render the settings of a widget
 * that does not exist yet, and a widget that wants a fourth kind of control has to
 * argue for it in this list where everybody can see the cost.
 */
export type WidgetOptionKey = keyof WidgetSettings;

export interface WidgetSettings {
  /**
   * Which saved location a `scope: 'location'` widget answers for, by its slot in
   * `prefs.locations`. Undefined, or out of range after a location is deleted, means
   * follow whichever location is selected — which is the right default and was the
   * only behaviour until now.
   */
  location?: number;
  /** How many lines a list may take before it stops and counts the rest. */
  limit?: number;
  /** How far ahead an hour-by-hour widget runs. */
  hours?: number;
  /** Which past window a rainfall widget totals. */
  window?: 'today' | '24h';
}

/** What a settings control offers, per key. Here rather than in the sheet so the
 *  choices and the defaults cannot drift apart. */
export const WIDGET_OPTION_CHOICES = {
  limit: [3, 5, 8] as const,
  hours: [12, 24, 48] as const,
  window: ['24h', 'today'] as const,
};

/** What a widget does when the reader has said nothing. */
export const WIDGET_OPTION_DEFAULTS:
  Required<Pick<WidgetSettings, 'limit' | 'hours' | 'window'>> = {
  limit: 5,
  hours: 24,
  window: '24h',
};

export interface OverviewWidget {
  id: string;
  size: OverviewSize;
  needs: readonly OverviewSource[];
  /** Defaults to `all`. */
  scope?: OverviewScope;
  /** Which controls this widget's settings sheet offers. Absent means it has none,
   *  and the editor draws no gear beside it — a sheet with nothing in it is worse
   *  than no sheet. */
  options?: readonly WidgetOptionKey[];
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
  // And what to do about it. Second, because a summary that cannot be acted on is a
  // poster — see `core/overviewAdvice`.
  { id: 'advice', size: 'full', needs: ['conditions', 'outlook'], options: ['limit'] },
  // Everything worth telling somebody about: the app's own judgement per location and
  // the thresholds the reader set themselves, in one list. Draws nothing at all when
  // there is nothing, which is most days and the point.
  // It needs the nowcast as well as the conditions: "rain in seven minutes" is the
  // sharpest thing the app says and the radar is where it comes from.
  { id: 'alerts', size: 'full', needs: ['conditions', 'nowcast'], options: ['limit'] },
  // What fell. The first number an arable grower wants in the morning.
  { id: 'rain24', size: 'half', needs: ['conditions'], options: ['limit', 'window'] },
  // And what is coming, over the same ranking, so the two read as one column.
  { id: 'rainNext', size: 'half', needs: ['outlook'], options: ['limit'] },
  { id: 'temp', size: 'half', needs: ['conditions'], options: ['limit'] },
  { id: 'wind', size: 'half', needs: ['conditions'], options: ['limit'] },
  // Tonight's minimum per location. Off by default: it matters intensely for a few
  // weeks a year and is noise for the rest.
  { id: 'frost', size: 'half', needs: ['outlook'], options: ['limit'], defaultHidden: true },
  // The one widget that answers "can I work" rather than "what is the weather".
  { id: 'workability', size: 'full', needs: ['conditions', 'outlook'] },
  // The coming days, a row per location, each a way into that location's own page.
  { id: 'outlook', size: 'full', needs: ['outlook'], options: ['limit'] },
  // How much the members disagree about tomorrow's rain. The one widget here that is
  // about confidence rather than weather, which is why it sits after the forecast it
  // qualifies rather than among the readings.
  { id: 'confidence', size: 'full', needs: ['ensemble'] },
  // Every location on one map, as a way in rather than as a map to read.
  { id: 'map', size: 'full', needs: [] },

  // ── One location's own widgets ──────────────────────────────────────────────
  // The pieces the tabs are built from, for the location that is selected. They come
  // after the comparisons because this page's argument is that the comparison is what
  // you cannot get elsewhere — but a grower with one main field wants these, and the
  // pencil is how they move up.
  //
  // Their `needs` are mostly empty: they read the selected location's own forecast,
  // which the tabs behind this page have already loaded, so they cost nothing.
  //
  // Only three of them take a `location`, and the line is where the honesty is. A
  // pinned location is served by what this page already fetches for every location —
  // the observation model and the nowcast profile — which is enough for a hero, a
  // radar square and a rain curve, and is not a fortnight of forecast. So the hour
  // strip and the week follow the selection and offer no location control, rather
  // than offering one and quietly drawing three days where a week was asked for.
  { id: 'hero', size: 'full', needs: ['conditions'], scope: 'location', options: ['location'] },
  // Rain in the next two hours, as the curve under the full-screen radar draws it.
  { id: 'nowcast', size: 'full', needs: ['nowcast'], scope: 'location', options: ['location'] },
  // The radar itself. Full width, at the height it had as a block — a square that
  // wide would be half a screen, and the strip shows more of the weather coming in
  // from the west for the same room.
  { id: 'radar', size: 'full', needs: [], scope: 'location', options: ['location'] },
  { id: 'nearTerm', size: 'full', needs: [], scope: 'location', options: ['hours'] },
  { id: 'longTerm', size: 'full', needs: [], scope: 'location', defaultHidden: true },
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


// ── A widget's own settings ───────────────────────────────────────────────────

/**
 * What a widget is set to, with its defaults filled in.
 *
 * Stored settings are sparse — only what a reader actually changed — so that a
 * default the app later thinks better of moves for everybody who never touched it,
 * rather than being frozen into storage the first time a sheet was opened.
 */
export function widgetSettings(
  all: Record<string, WidgetSettings> | undefined,
  id: string
): WidgetSettings {
  return { ...WIDGET_OPTION_DEFAULTS, ...(all?.[id] ?? {}) };
}

/**
 * Write one setting, and forget it again when it is set back to the default.
 *
 * Forgetting matters for the same reason the defaults are not stored: a reader who
 * tries a setting and puts it back should end up where somebody who never opened the
 * sheet is, including when the default later changes.
 */
export function setWidgetSetting<K extends WidgetOptionKey>(
  all: Record<string, WidgetSettings> | undefined,
  id: string,
  key: K,
  value: WidgetSettings[K]
): Record<string, WidgetSettings> {
  const out = { ...(all ?? {}) };
  const next: WidgetSettings = { ...(out[id] ?? {}) };
  const fallback = (WIDGET_OPTION_DEFAULTS as Partial<WidgetSettings>)[key];
  if (value === undefined || value === fallback) delete next[key];
  else next[key] = value;
  if (Object.keys(next).length) out[id] = next;
  else delete out[id];
  return out;
}

/**
 * Which saved location a widget answers for.
 *
 * A pinned index that no longer exists — the location was deleted, or the list is
 * shorter than it was — falls back to the selection rather than to slot zero. A
 * widget quietly answering for somebody else's field is worse than one that follows
 * the reader, and this is the only place that decides it.
 */
export function resolveWidgetLocation(
  settings: WidgetSettings,
  selected: number,
  count: number
): number {
  const pinned = settings.location;
  if (pinned == null || !Number.isInteger(pinned) || pinned < 0 || pinned >= count) {
    return selected;
  }
  return pinned;
}
