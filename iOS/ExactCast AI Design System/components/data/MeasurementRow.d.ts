import * as React from 'react';
/** A per-location list row: status dot, name + meta, right-aligned verdict in the matching status colour. */
export interface MeasurementRowProps { status?: 'dry' | 'light' | 'heavy' | 'green' | 'amber' | 'red'; name?: React.ReactNode; meta?: React.ReactNode; advice?: React.ReactNode; /** 11px variant used inside phone mockups */ compact?: boolean; style?: React.CSSProperties; }
export function MeasurementRow(props: MeasurementRowProps): JSX.Element;
