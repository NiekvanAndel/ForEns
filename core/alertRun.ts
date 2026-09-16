/**
 * Deciding which of the reader's own rules have tripped, and which are worth saying.
 *
 * Split from the background task so the part with the judgement in it can be tested
 * without a network, a keychain or a phone. The task fetches; this decides.
 *
 * ## Firing once, not every half hour
 *
 * A rule is a standing condition, not an event. "Below two degrees" stays true all
 * night, and a background run every thirty minutes would say so every thirty minutes
 * — which is how an app's notifications get switched off wholesale.
 *
 * So a rule notifies on the *edge*: the run where it first becomes true. It goes
 * quiet while it stays true, and arms again once the reading comes back to the safe
 * side. A rule that trips, clears and trips again is two genuine events and gets two
 * notifications.
 *
 * The one exception is time. A frost that has held since midnight is worth repeating
 * in the morning, and a rule that tripped while the phone was off should not stay
 * silent for a week because the state file says it already fired. `REARM_AFTER_MS`
 * is the ceiling: after it, a still-true rule is allowed to speak again.
 *
 * ## The state is not in preferences
 *
 * Preferences are the reader's, they sync into the push registration, and they are
 * rewritten on every change. "When did rule r3 last fire" is none of those things —
 * it is bookkeeping, it changes on its own, and putting it in preferences would
 * re-register the device with a push server every time a shower crossed a threshold.
 */
import { evaluateAlert, type UserAlert } from './alerts';

/** How long a rule that is still true stays quiet before it may repeat. Twelve
 *  hours: long enough that one shower is one notification, short enough that a frost
 *  overnight is mentioned again by the working day. */
export const REARM_AFTER_MS = 12 * 60 * 60 * 1000;

/** What a run remembers about one rule, between runs. */
export interface AlertState {
  /** True while the rule was tripped at the last run that could see it. */
  tripped: boolean;
  /** When it last produced a notification. */
  firedMs: number;
}

export type AlertStates = Record<string, AlertState>;

/** One station's answer for a rule's block, as the task fetched it. */
export interface StationValue {
  stationId: string;
  stationName: string | null;
  value: number | null;
}

export interface TrippedAlert {
  alert: UserAlert;
  /** The station that tripped it, and by how much. Where several trip at once it is
   *  the one furthest past the threshold — the worst of them is the one worth
   *  naming, and naming all of them is a notification nobody reads. */
  stationId: string;
  stationName: string | null;
  value: number;
}

export interface RunResult {
  fired: TrippedAlert[];
  /** The state to persist. Always returned whole, so a rule deleted in between
   *  simply stops appearing rather than leaving a row behind for ever. */
  states: AlertStates;
}

/**
 * Which rules tripped, and which of those should notify.
 *
 * `readings` is keyed by alert id and holds one entry per station that rule watches.
 * A rule with no readings at all — the fetch failed, or the block is one a station
 * cannot answer — keeps whatever state it had rather than being treated as cleared:
 * a run that could not see is not a run that saw nothing wrong.
 */
export function runUserAlerts(
  alerts: readonly UserAlert[],
  readings: Record<string, StationValue[]>,
  previous: AlertStates,
  nowMs = Date.now()
): RunResult {
  const states: AlertStates = {};
  const fired: TrippedAlert[] = [];

  for (const alert of alerts) {
    const prior = previous[alert.id] ?? { tripped: false, firedMs: 0 };
    const seen = readings[alert.id];

    if (!alert.enabled) {
      // Switched off clears its memory, so switching it back on is a fresh start
      // rather than a rule that stays quiet because of something last week.
      continue;
    }

    if (!seen || !seen.length) {
      states[alert.id] = prior;
      continue;
    }

    const hits = seen
      .filter((s) => evaluateAlert(alert, s.value))
      .sort((a, b) =>
        alert.op === 'above'
          ? (b.value as number) - (a.value as number)
          : (a.value as number) - (b.value as number)
      );

    if (!hits.length) {
      // Back on the safe side: armed again, and the fired time is kept so a rule
      // that trips twice in an hour is still two notifications rather than none.
      states[alert.id] = { tripped: false, firedMs: prior.firedMs };
      continue;
    }

    const worst = hits[0] as StationValue;
    const isEdge = !prior.tripped;
    const stale = nowMs - prior.firedMs >= REARM_AFTER_MS;

    if (isEdge || stale) {
      fired.push({
        alert,
        stationId: worst.stationId,
        stationName: worst.stationName,
        value: worst.value as number,
      });
      states[alert.id] = { tripped: true, firedMs: nowMs };
    } else {
      states[alert.id] = { tripped: true, firedMs: prior.firedMs };
    }
  }

  return { fired, states };
}

/** Drop bookkeeping for rules that no longer exist, and anything malformed. Stored
 *  state outlives the rules it is about. */
export function sanitiseStates(stored: unknown, alerts: readonly UserAlert[]): AlertStates {
  if (!stored || typeof stored !== 'object') return {};
  const live = new Set(alerts.map((a) => a.id));
  const out: AlertStates = {};
  for (const [id, raw] of Object.entries(stored as Record<string, unknown>)) {
    if (!live.has(id) || !raw || typeof raw !== 'object') continue;
    const v = raw as Partial<AlertState>;
    out[id] = {
      tripped: v.tripped === true,
      firedMs: typeof v.firedMs === 'number' && Number.isFinite(v.firedMs) ? v.firedMs : 0,
    };
  }
  return out;
}
