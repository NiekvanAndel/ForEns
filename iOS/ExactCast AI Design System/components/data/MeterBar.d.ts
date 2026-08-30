import * as React from 'react';
/** 14px track with a 7px-radius fill; green gradient for the good number, flat white for the cost. */
export interface MeterBarProps { leftLabel?: React.ReactNode; rightLabel?: React.ReactNode; pct?: number; tone?: 'save' | 'cost'; onNavy?: boolean; style?: React.CSSProperties; }
export function MeterBar(props: MeterBarProps): JSX.Element;
