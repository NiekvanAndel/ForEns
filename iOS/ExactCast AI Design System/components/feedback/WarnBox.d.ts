import * as React from 'react';
/** Amber-tinted advisory that lives on navy panels only (amber title, soft body). */
export interface WarnBoxProps { title?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties; }
export function WarnBox(props: WarnBoxProps): JSX.Element;
