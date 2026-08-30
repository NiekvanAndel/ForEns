import * as React from 'react';
/** White card that overlaps the hero by 44px, dividing 3–4 proof points with hairline rules. */
export interface TrustBarProps { items?: Array<{ value: React.ReactNode; label: React.ReactNode }>; style?: React.CSSProperties; }
export function TrustBar(props: TrustBarProps): JSX.Element;
