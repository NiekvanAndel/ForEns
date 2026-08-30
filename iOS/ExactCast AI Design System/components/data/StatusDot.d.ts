import * as React from 'react';
/** The precipitation ramp as a dot: dry (cream, hairlined), light (light blue), heavy (dark blue). Legacy green/amber/red map onto it. */
export interface StatusDotProps { status?: 'dry' | 'light' | 'heavy' | 'green' | 'amber' | 'red'; size?: number; style?: React.CSSProperties; }
export function StatusDot(props: StatusDotProps): JSX.Element;
