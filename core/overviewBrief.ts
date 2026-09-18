/**
 * The page in sentences — what an arable grower would say about their fields if you
 * asked them once, this morning.
 *
 * The widget above this one used to open with a figure and a place ("7,2 mm ·
 * Almkerk") and two clipped lines under it. A figure is quick to draw and slow to
 * read: it says *what* without saying *of what*, so the eye has to fetch the heading
 * back. A sentence carries its own subject, and the numbers inside it can still be
 * the bold thing the eye lands on. So this returns the facts and the widget writes
 * them out, with the values emboldened.
 *
 * ## Facts, not sentences
 *
 * Same rule as the advice and the alerts, learned the same way: a module outside
 * `core/i18n` that returns Dutch is a module whose output stays Dutch. Each entry
 * names a sentence and carries what fills its blanks, in canonical units — the
 * widget converts, because only it knows what the reader set.
 *
 * ## Relevance is the whole design
 *
 * Every sentence is optional and most mornings only two or three apply. A brief that
 * always says six things is a brief that says nothing: "de wind varieert tussen 11 en
 * 12 km/u" is a line spent reporting that the wind is the same everywhere. So each
 * rule has a bar under which it stays quiet, and they are gathered here to be argued
 * with; see DEFERRED.
 */
import { firstWorkRun, rankRows, workWindow, type OverviewRow } from './overviewData';
import { threshold } from './thresholds';

/** Which sentence, and therefore which blanks are filled. */
export type BriefKind =
  /** Significant weather the app itself is flagging, right now. */
  | 'warnings'
  /** Where most fell over the last 24 hours. */
  | 'wettest'
  /** Rain reaching one location within the hour, off the radar nowcast. */
  | 'rainSoon'
  /** Rain in the next 24 hours, at one or two named places. */
  | 'rainAhead'
  /** Rain nearly everywhere, which is shorter said than listed. */
  | 'rainWidespread'
  /** Rain everywhere, which is shorter still. */
  | 'rainEverywhere'
  /** How far apart the locations are on temperature, right now. */
  | 'tempRange'
  /** And on wind. */
  | 'windRange'
  /** Where the most of the coming day is workable. */
  | 'workable'
  /** How many thresholds the reader has set themselves. */
  | 'rules';

export interface Brief {
  kind: BriefKind;
  /** The place a sentence is about, or the colder of two. */
  place?: string;
  /** The warmer of two, where a sentence names both ends. */
  place2?: string;
  /** Millimetres, canonical. */
  mm?: number;
  /** Minutes from now, for rain the radar can already see. */
  minutes?: number;
  /** The two ends of a range, canonical (°C, km/h). */
  low?: number;
  high?: number;
  /** How many of something — warnings standing, thresholds set. */
  count?: number;
  /** What the first of them says, so the line is a fact and not a tally. */
  what?: string;
}

/**
 * What the brief knows that the rows do not.
 *
 * The warnings are worded by `deriveAlert` and the thresholds are the reader's own,
 * so both are handed in rather than recomputed — a brief that decided for itself what
 * counts as a warning would be a second opinion under the widget that holds the
 * first.
 */
export interface BriefContext {
  /** The label of every significant-weather warning standing, in the rows' order. */
  warnings?: readonly string[];
  /** How many of the reader's own thresholds are switched on. */
  rules?: number;
  nowcasts?: readonly (BriefNowcast | null)[];
  limits?: BriefLimits;
  /**
   * Whether the workability family is switched on.
   *
   * The brief's "where to go" line is that family's judgement in a sentence, so it
   * answers to the same switch as the widget and the field's own page. Omitted means
   * on, which keeps a caller with no preferences in hand working.
   */
  workability?: boolean;
}

/**
 * The bars under which each sentence stays quiet.
 *
 * First drafts, like every other threshold on this page, and gathered rather than
 * scattered for the same reason — see DEFERRED, where revisiting the whole set is
 * written down as work.
 */
export interface BriefLimits {
  /** Below this, "the most rain fell at" is reporting a damp morning. */
  wettestMm: number;
  /** Rain the radar sees no further ahead than this is "soon" rather than "today". */
  soonMin: number;
  /** Millimetres in the next 24 hours that count as rain being expected. */
  aheadMm: number;
  /** At or above this share of locations expecting rain, say so instead of listing. */
  widespreadShare: number;
  /** How many places a rain sentence will name before it gives up and counts. */
  namesMax: number;
  /** A temperature spread under this is not a spread. */
  tempSpanC: number;
  /** Nor is a wind spread under this. */
  windSpanKmh: number;
}

export const DEFAULT_BRIEF_LIMITS: BriefLimits = {
  wettestMm: threshold('brief.wettest'),
  soonMin: 60,
  aheadMm: threshold('brief.ahead'),
  widespreadShare: 0.75,
  namesMax: 2,
  tempSpanC: threshold('brief.tempSpan'),
  windSpanKmh: threshold('brief.windSpan'),
};

/** What the brief needs from the radar, per location and in the rows' own order. */
export interface BriefNowcast {
  wet?: boolean;
  startsInMin?: number | null;
}

/**
 * The sentences worth saying, in the order a grower asks them.
 *
 * Rain first — what fell, then what is coming — because whether the land is workable
 * is a rainfall question and everything else qualifies it. The page led with the
 * temperature at first, which reads as a weather app rather than as a working one.
 */
export function briefFor(
  rows: readonly OverviewRow[],
  nowcasts: readonly (BriefNowcast | null)[] = [],
  context: BriefContext = {}
): Brief[] {
  const limits = context.limits ?? DEFAULT_BRIEF_LIMITS;
  const out: Brief[] = [];
  const isNum = (v: number | null | undefined): v is number => typeof v === 'number';

  // ── What is being flagged ──────────────────────────────────────────────────
  // First, because a warning outranks every reading that qualifies it: a brief that
  // opens with the rainfall while a squall is on its way has buried the lead.
  const warnings = context.warnings ?? [];
  if (warnings.length) {
    out.push({ kind: 'warnings', count: warnings.length, what: warnings[0] });
  }

  // ── What fell ──────────────────────────────────────────────────────────────
  const wettest = rankRows(rows, (r) => r.rain24)[0];
  if (wettest && isNum(wettest.rain24) && wettest.rain24 >= limits.wettestMm) {
    out.push({ kind: 'wettest', place: wettest.name, mm: wettest.rain24 });
  }

  // ── What is coming ─────────────────────────────────────────────────────────
  // The radar first, where it has anything: "over twintig minuten" is a different
  // instruction from "vandaag", and only one of them changes what happens next.
  const soon = rows
    .map((row, i) => ({ row, nowcast: nowcasts[i] ?? null }))
    .filter((x) => x.nowcast?.wet && isNum(x.nowcast.startsInMin))
    .sort((a, b) => (a.nowcast!.startsInMin as number) - (b.nowcast!.startsInMin as number))[0];

  if (soon && (soon.nowcast!.startsInMin as number) <= limits.soonMin) {
    out.push({
      kind: 'rainSoon',
      place: soon.row.name,
      minutes: Math.max(0, Math.round(soon.nowcast!.startsInMin as number)),
    });
  } else {
    const known = rows.filter((r) => isNum(r.rainNext24));
    const ahead = known.filter((r) => (r.rainNext24 as number) >= limits.aheadMm);
    const share = known.length ? ahead.length / known.length : 0;
    if (ahead.length && share >= 1) {
      out.push({ kind: 'rainEverywhere' });
    } else if (ahead.length && share >= limits.widespreadShare) {
      out.push({ kind: 'rainWidespread' });
    } else if (ahead.length && ahead.length <= limits.namesMax) {
      // Ranked, so the one named first is the one with the most coming.
      const named = rankRows(ahead, (r) => r.rainNext24);
      out.push({
        kind: 'rainAhead',
        place: named[0]!.name,
        place2: named[1]?.name,
      });
    }
  }

  // ── How the fields differ ──────────────────────────────────────────────────
  const temps = rankRows(rows.filter((r) => isNum(r.tempC)), (r) => r.tempC);
  const warm = temps[0];
  const cold = temps[temps.length - 1];
  if (warm && cold && warm !== cold) {
    const low = cold.tempC as number;
    const high = warm.tempC as number;
    if (high - low >= limits.tempSpanC) {
      out.push({ kind: 'tempRange', low, high, place: cold.name, place2: warm.name });
    }
  }

  const winds = rankRows(rows.filter((r) => isNum(r.windKmh)), (r) => r.windKmh);
  const strong = winds[0];
  const calm = winds[winds.length - 1];
  if (strong && calm && strong !== calm) {
    const low = calm.windKmh as number;
    const high = strong.windKmh as number;
    if (high - low >= limits.windSpanKmh) {
      out.push({ kind: 'windRange', low, high, place: calm.name, place2: strong.name });
    }
  }

  // ── Where to go ────────────────────────────────────────────────────────────
  // The one line in the brief that is a judgement rather than a reading, so it is the
  // one line that can be switched off. See `core/basisLayer`.
  if (context.workability !== false) {
    const best = bestWorkable(rows);
    if (best) out.push({ kind: 'workable', place: best });
  }

  // ── And what the reader asked to be told ───────────────────────────────────
  // Last, because it is about the app rather than about the weather. It is here at
  // all so that somebody who set a threshold weeks ago and has heard nothing since
  // knows it is still watching, rather than wondering whether it ever saved.
  if (context.rules) out.push({ kind: 'rules', count: context.rules });

  return out;
}

/**
 * The location with the most workable hours ahead, where one stands out.
 *
 * Quiet when nothing is workable anywhere — there is no "most" of nothing — and quiet
 * when the leader ties, because "het meest werkbaar is het op Almkerk" is wrong when
 * Haarsteeg is exactly as good.
 */
function bestWorkable(rows: readonly OverviewRow[]): string | null {
  const scored = rows
    .filter((r) => r.hours.length)
    .map((r) => {
      const window = workWindow(r.hours);
      return {
        name: r.name,
        // The first unbroken run, not the total: eight scattered hours is not a day's
        // work, and a grower plans around the stretch they can finish something in.
        hours: firstWorkRun(window)?.hours ?? 0,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const top = scored[0];
  if (!top || top.hours === 0) return null;
  if (scored[1] && scored[1].hours === top.hours) return null;
  return top.name;
}
