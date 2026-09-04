/**
 * Pull to refresh, once, for every page that has one.
 *
 * Every page draws from the same forecast context, so "pull down here" means the
 * same thing everywhere: re-run the staged load, and keep the spinner up until it
 * has landed. That is three pieces — the haptic tick on the pull, a `refreshing`
 * flag driven by the load phase rather than by a timer, and the control itself —
 * and copying them per page is how they drift apart.
 *
 * A page with data of its own (the radar's frames) passes it as `task`; the spinner
 * then waits for both that and the forecast.
 *
 * ## Where the spinner is drawn
 *
 * iOS draws a refresh control at the top edge of the scroll view, and on these pages
 * that edge is underneath the floating top row — so the spinner appeared behind the
 * glass and the notch, which is to say it did not appear at all. `progressViewOffset`
 * pushes it down by exactly the clearance every page already leaves for that row, so
 * it turns in the gap between the row and the location title, where the reader is
 * looking. It is drawn in the accent colour for the same reason every other spinner
 * in the app is: `muted` on a dark background is barely there.
 *
 * The flag is cleared by watching `phase`, not by awaiting `refresh()`, because the
 * load is staged: it reports itself finished when the last stage lands. The effect
 * depends on `phase` alone, so the render that sets `refreshing` — where the phase
 * is still whatever it was — cannot immediately clear it again. The timeout is the
 * backstop for a phase that never moves at all, so a failed pull cannot leave the
 * spinner turning for ever.
 */
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TOP_BAR_CLEARANCE } from './TopBar';
import { useForecast } from '../state/forecast';

/** Longest the spinner may stay up when nothing tells it the load has ended. */
const SPINNER_MAX_MS = 15_000;

export function useRefreshControl(task?: () => Promise<unknown> | void) {
  const { palette } = useTheme();
  const { phase, refresh } = useForecast();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    refresh();
    const running = task?.();
    if (running && typeof (running as Promise<unknown>).then === 'function') {
      setTaskBusy(true);
      (running as Promise<unknown>)
        .catch(() => { /* the page shows its own empty state */ })
        .finally(() => setTaskBusy(false));
    }
  }, [refresh, task]);

  useEffect(() => {
    if (phase !== 'loading' && !taskBusy) setRefreshing(false);
  }, [phase, taskBusy]);

  useEffect(() => {
    if (!refreshing) return;
    const id = setTimeout(() => setRefreshing(false), SPINNER_MAX_MS);
    return () => clearTimeout(id);
  }, [refreshing]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={palette.accent}
      colors={[palette.accent]}
      progressViewOffset={insets.top + TOP_BAR_CLEARANCE}
    />
  );
}
