/**
 * The slice of hours an hourly strip shows.
 *
 * `processAll` keeps the last twelve observed hours and the next forty-eight
 * forecast ones. A strip wants a window around *now* — some of what has happened,
 * more of what is coming — and it wants to know where in that window the current
 * hour sits so it can be centred and everything before it dimmed.
 *
 * Kept out of the components because two screens show a strip and they must not
 * disagree about which hour is "now".
 */
import type { ForecastModel, Hour } from './types';

export interface HourWindow {
  hours: Hour[];
  /** Index of the current hour within `hours`; -1 only when there are no hours. */
  nowIndex: number;
}

export interface WindowOptions {
  /** Forecast hours to include, the current hour first. */
  ahead: number;
  /** Observed hours to include before it. More than exist is not an error. */
  behind?: number;
}

const DEFAULT_BEHIND = 12;

export function hourWindow(
  model: Pick<ForecastModel, 'pastHours' | 'futureHours'>,
  { ahead, behind = DEFAULT_BEHIND }: WindowOptions
): HourWindow {
  const past: Hour[] = behind > 0 ? model.pastHours.slice(-behind) : [];
  const future: Hour[] = model.futureHours.slice(0, Math.max(0, ahead));
  const hours = [...past, ...future];

  // The current hour is the first forecast hour — processAll splits on `>= nowHour`.
  // With no forecast hours at all there is no "now" to centre on, so fall back to
  // the last observation rather than pointing past the end of the list.
  const nowIndex = hours.length === 0 ? -1 : future.length > 0 ? past.length : hours.length - 1;

  return { hours, nowIndex };
}
