import * as React from 'react';
/** Continuous cream→light-blue→dark-blue rain band with a numeric scale underneath and an optional 3-up legend. */
export interface ScaleBarProps { segments?: Array<{ tone: 'dry' | 'light' | 'heavy' | 'green' | 'amber' | 'red'; flex?: number }>; scale?: React.ReactNode[]; legend?: Array<{ title: React.ReactNode; body: React.ReactNode }>; style?: React.CSSProperties; }
export function ScaleBar(props: ScaleBarProps): JSX.Element;
