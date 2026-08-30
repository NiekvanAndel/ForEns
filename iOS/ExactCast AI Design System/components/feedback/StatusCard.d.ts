import * as React from 'react';
/** Card with a 5px top border from the precipitation ramp; explains what each step means. */
export interface StatusCardProps { status?: 'dry' | 'light' | 'heavy' | 'green' | 'amber' | 'red'; title?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties; }
export function StatusCard(props: StatusCardProps): JSX.Element;
