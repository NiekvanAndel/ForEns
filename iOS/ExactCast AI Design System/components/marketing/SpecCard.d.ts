import * as React from 'react';
/** Two-up technical fact card: bold title, green-dark value line, muted explanation. */
export interface SpecCardProps { title?: React.ReactNode; value?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties; }
export function SpecCard(props: SpecCardProps): JSX.Element;
