import * as React from 'react';
/** Label/value row for dark navy result panels; the highlighted row goes 22px green. */
export interface ResultRowProps { label?: React.ReactNode; value?: React.ReactNode; highlight?: boolean; last?: boolean; style?: React.CSSProperties; }
export function ResultRow(props: ResultRowProps): JSX.Element;
