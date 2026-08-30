import * as React from 'react';
/**
 * Typographic brand lockup. NOTE: no logo asset was provided; this stands in for a mark.
 * The "AI" accent is the cool precipitation blue — green is reserved for product UI
 * (buttons, ticks) and is kept out of the brand mark, which is not agricultural.
 */
export interface WordmarkProps { tone?: 'navy' | 'light'; /** cap height in px, default 20 */ size?: number; /** white pill container, as used in the fixed navy header */ pill?: boolean; style?: React.CSSProperties; }
export function Wordmark(props: WordmarkProps): JSX.Element;
