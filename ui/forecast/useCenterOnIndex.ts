/**
 * Open a horizontal strip centred on one cell.
 *
 * Both hourly strips run from the past into the future, so neither is useful parked
 * at its left edge — the current hour has to be the one you see first. The offset
 * depends on how wide the strip is on screen, so it is computed on layout rather
 * than on mount, and only once: after that the position is the reader's.
 */
import { useCallback, useRef } from 'react';
import type { ScrollView, LayoutChangeEvent } from 'react-native';

export interface CenterOnIndex {
  ref: React.RefObject<ScrollView | null>;
  onLayout: (e: LayoutChangeEvent) => void;
}

export function useCenterOnIndex(
  index: number,
  cellWidth: number,
  gap: number
): CenterOnIndex {
  const ref = useRef<ScrollView>(null);
  const done = useRef(false);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (done.current || index < 0) return;
      done.current = true;
      const viewport = e.nativeEvent.layout.width;
      // Clamped at zero: scrolling to a negative offset is a no-op on iOS, which
      // would leave a short strip parked wherever it started.
      const x = Math.max(0, index * (cellWidth + gap) - (viewport - cellWidth) / 2);
      ref.current?.scrollTo({ x, animated: false });
    },
    [index, cellWidth, gap]
  );

  return { ref, onLayout };
}
