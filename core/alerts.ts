/**
 * Alerts a grower sets themselves, from a block on 'Actueel'.
 *
 * The significant-weather block on 'Nu' is the app's own judgement: six conditions
 * with thresholds somebody else chose. This is the other half of the same idea — a
 * threshold on one quantity at one set of stations, decided by the person whose crop
 * it is. "Tell me when it drops below two degrees at Hedikhuizen" is not a rule any
 * app can guess.
 *
 * The flow is the web app's, because people already know it: pick the block, pick
 * more-than or less-than, type a number, tick the stations, save. What comes out is
 * one of these.
 *
 * ## Keyed on the block, not enumerated
 *
 * A rule carries the block's `id` and nothing about which blocks exist. A thirteenth
 * block added later is immediately something you can set an alert on, with no list
 * here to remember to extend — and a block that goes away leaves a rule that still
 * reads correctly, because the title it was made under travels with it as a fallback.
 *
 * ## The threshold is stored in the app's own units
 *
 * °C, km/h, mm, %, degrees — the units every source speaks and every other module
 * stores. Someone working in Fahrenheit types 36 and this holds 2.2, which is what
 * makes the rule keep its meaning when they switch units, and what lets a server
 * evaluate it without knowing what the phone was set to. The conversion happens at
 * the edge, where the number is typed and where it is drawn, exactly as it does for
 * every reading in the app.
 */
import type { TileKind } from './model/tiles';

/** The two comparisons the menu offers. More is a union rather than a boolean so
 *  that adding "between" or "changes by" later does not rewrite what is stored. */
export type AlertOp = 'above' | 'below';

/**
 * The block kinds a rule can be made on.
 *
 * Narrower than `TileKind` on purpose. A rule names a set of **weather stations** and
 * is evaluated from their readings by `stationTiles`; a soil sensor is not one of
 * those, so suction, pF and soil status have nothing to be evaluated against yet.
 * Suction would in fact make the best rule in the app — it is the one quantity that
 * arrives with its own thresholds — but wiring it means teaching the rule engine about
 * soil sensors, and a kind accepted here before that happens is a rule that saves and
 * never fires.
 */
export type AlertKind = 'temp' | 'wind' | 'mm' | 'percent' | 'direction';

/** Whether a block can carry a rule at all. */
export function isAlertKind(kind: TileKind): kind is AlertKind {
  return kind === 'temp' || kind === 'wind' || kind === 'mm'
    || kind === 'percent' || kind === 'direction';
}

export interface UserAlert {
  /** Stable for the life of the rule. */
  id: string;
  /** The block it was made from — `Tile.id`. The only link to what it measures. */
  tileId: string;
  /**
   * What the block and its window were called when the rule was made.
   *
   * A fallback, not the truth: the list resolves the current block by `tileId` and
   * uses these only where it cannot. That keeps a renamed block's rules reading
   * correctly, and keeps a rule for a block that has gone from becoming a mystery.
   */
  title: string;
  timeLabel: string;
  /** Which unit family the threshold belongs to, so it can be shown converted. */
  kind: AlertKind;
  op: AlertOp;
  /** The threshold, in the app's canonical units. See the note above. */
  value: number;
  /** AgroExact station ids to watch. At least one; a rule with none can never fire. */
  stationIds: string[];
  /** Their names at the time, for a list that reads before the stations load. */
  stationNames: string[];
  /** Off keeps the rule without acting on it — the same distinction the rest of
   *  Meldingen makes, and better than deleting something to silence it for a week. */
  enabled: boolean;
  createdMs: number;
}

/** What a rule needs before it can be saved. The sheet asks for exactly this. */
export interface DraftAlert {
  tileId: string;
  title: string;
  timeLabel: string;
  kind: AlertKind;
  op: AlertOp;
  /** In canonical units, already converted from whatever was typed. */
  value: number | null;
  stationIds: string[];
  stationNames: string[];
}

/**
 * Whether a draft is complete enough to save.
 *
 * Three ways to be incomplete and each is a different missing answer, so the sheet
 * can say which — a disabled button with no reason is the commonest way a form
 * strands somebody.
 */
export type DraftProblem = 'value' | 'stations' | null;

export function draftProblem(draft: DraftAlert): DraftProblem {
  if (draft.value == null || !Number.isFinite(draft.value)) return 'value';
  if (!draft.stationIds.length) return 'stations';
  return null;
}

/** A rule from a complete draft. Returns null rather than a half-built rule. */
export function makeAlert(draft: DraftAlert, nowMs = Date.now()): UserAlert | null {
  if (draftProblem(draft) !== null) return null;
  return {
    // Time plus a short random tail: two rules made in the same millisecond on one
    // device is not something to leave to chance when the id is what deletes one.
    id: `${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    tileId: draft.tileId,
    title: draft.title,
    timeLabel: draft.timeLabel,
    kind: draft.kind,
    op: draft.op,
    value: draft.value as number,
    stationIds: [...draft.stationIds],
    stationNames: [...draft.stationNames],
    enabled: true,
    createdMs: nowMs,
  };
}

/**
 * Whether a reading trips the rule.
 *
 * Strictly more or strictly less, which is what "meer dan 2" means to a reader: a
 * rule set at exactly the current value should not fire the moment it is saved.
 *
 * A missing reading is not a trip. A station that stopped reporting is not a station
 * reporting a safe number, and firing on the gap would be the app inventing weather;
 * staying quiet at least fails the way the rest of the app does.
 */
export function evaluateAlert(alert: UserAlert, value: number | null | undefined): boolean {
  if (!alert.enabled) return false;
  if (value == null || !Number.isFinite(value)) return false;
  return alert.op === 'above' ? value > alert.value : value < alert.value;
}

/** The ids of every station any enabled rule watches, deduplicated — what a poller
 *  has to fetch, and no more. */
export function watchedStationIds(alerts: readonly UserAlert[]): string[] {
  const out = new Set<string>();
  for (const a of alerts) {
    if (!a.enabled) continue;
    for (const id of a.stationIds) out.add(id);
  }
  return [...out].sort();
}

/** Drop anything malformed. Stored state outlives the code that wrote it, and one
 *  bad rule must not cost the reader the others. */
export function sanitiseAlerts(stored: unknown): UserAlert[] {
  if (!Array.isArray(stored)) return [];
  const out: UserAlert[] = [];
  for (const raw of stored) {
    // A null or a stray string in the list is exactly the sort of thing storage
    // hands back after a bad write, and reading a field off one throws.
    if (!raw || typeof raw !== 'object') continue;
    const a = raw as Partial<UserAlert>;
    const strings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    const ids = strings(a.stationIds);
    if (
      typeof a.id !== 'string' || !a.id ||
      typeof a.tileId !== 'string' || !a.tileId ||
      (a.op !== 'above' && a.op !== 'below') ||
      typeof a.value !== 'number' || !Number.isFinite(a.value) ||
      !ids.length
    ) {
      continue;
    }
    out.push({
      id: a.id,
      tileId: a.tileId,
      title: typeof a.title === 'string' ? a.title : a.tileId,
      timeLabel: typeof a.timeLabel === 'string' ? a.timeLabel : '',
      // A stored rule whose kind this build no longer accepts falls back rather than
      // being dropped: the threshold and the stations are still what someone meant.
      kind: isAlertKind(a.kind as TileKind) ? (a.kind as AlertKind) : 'temp',
      op: a.op,
      value: a.value,
      stationIds: ids,
      stationNames: strings(a.stationNames),
      enabled: a.enabled !== false,
      createdMs: typeof a.createdMs === 'number' ? a.createdMs : 0,
    });
  }
  return out;
}

/** Replace a rule by id, or append it. What saving an edit and saving a new one
 *  both do, so the sheet has one path out. */
export function upsertAlert(alerts: readonly UserAlert[], next: UserAlert): UserAlert[] {
  const at = alerts.findIndex((a) => a.id === next.id);
  if (at < 0) return [...alerts, next];
  return alerts.map((a) => (a.id === next.id ? next : a));
}

export function removeAlert(alerts: readonly UserAlert[], id: string): UserAlert[] {
  return alerts.filter((a) => a.id !== id);
}

export function setAlertEnabled(
  alerts: readonly UserAlert[],
  id: string,
  enabled: boolean
): UserAlert[] {
  return alerts.map((a) => (a.id === id ? { ...a, enabled } : a));
}
