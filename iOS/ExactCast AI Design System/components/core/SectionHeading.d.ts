import * as React from 'react';
/** Eyebrow + h2 + lead paragraph, the standard opening of every web section. */
export interface SectionHeadingProps { eyebrow?: string; title?: React.ReactNode; lead?: React.ReactNode; center?: boolean; tone?: 'dark' | 'light'; maxWidth?: string; style?: React.CSSProperties; }
export function SectionHeading(props: SectionHeadingProps): JSX.Element;
