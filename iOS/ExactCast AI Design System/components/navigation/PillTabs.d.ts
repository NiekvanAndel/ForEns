import * as React from 'react';
/** Horizontally scrolling location switcher: selected pill is solid navy, the rest cream-2. */
export interface PillTabsProps { items?: React.ReactNode[]; active?: number; onChange?: (i: number) => void; scroll?: boolean; style?: React.CSSProperties; }
export function PillTabs(props: PillTabsProps): JSX.Element;
