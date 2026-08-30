import * as React from 'react';
/** Inline text link with a Lucide arrow-right that slides 4px right on hover. Used to close a section instead of a second button. */
export interface LinkArrowProps { href?: string; children?: React.ReactNode; onClick?: (e: React.MouseEvent) => void; tone?: 'dark' | 'light'; style?: React.CSSProperties; }
export function LinkArrow(props: LinkArrowProps): JSX.Element;
