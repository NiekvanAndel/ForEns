/**
 * "This copy of the page is sliding past, not being read."
 *
 * The pager draws the neighbouring locations during a swipe, which means a whole
 * page is mounted the moment a finger starts moving. Most of a page is cheap to
 * build twice — text and numbers — but a `MapView` is not: a second one, allocated
 * on the UI thread at exactly the wrong moment, is paid for in the smoothness of the
 * gesture it was supposed to improve.
 *
 * So anything expensive asks whether it is being peeked at and draws a still
 * stand-in instead. Nothing else in the tree needs to know.
 */
import { createContext, useContext, type ReactNode } from 'react';

const PeekContext = createContext(false);

export function PeekProvider({ children }: { children: ReactNode }) {
  return <PeekContext.Provider value>{children}</PeekContext.Provider>;
}

/** True inside a page the reader is swiping past rather than looking at. */
export function usePeeking(): boolean {
  return useContext(PeekContext);
}
