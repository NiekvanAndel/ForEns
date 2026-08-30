import * as React from 'react';
/** Four-column navy footer; column headings in green, links at 80% white, legal row on a 12% rule. */
export interface SiteFooterProps { columns?: Array<{ title: React.ReactNode; body?: React.ReactNode; links?: string[] }>; legal?: string[]; copyright?: string; style?: React.CSSProperties; }
export function SiteFooter(props: SiteFooterProps): JSX.Element;
