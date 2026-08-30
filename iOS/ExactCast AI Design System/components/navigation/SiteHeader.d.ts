import * as React from 'react';
/** Fixed 80px header: navy 71%-opacity scrim + 10px blur, white wordmark pill left, nav right, phone number, small primary CTA. */
export interface SiteHeaderProps { links?: string[]; active?: string; /** displayed and dialled */ phone?: string; cta?: React.ReactNode; onNav?: (key: string) => void; style?: React.CSSProperties; }
export function SiteHeader(props: SiteHeaderProps): JSX.Element;
