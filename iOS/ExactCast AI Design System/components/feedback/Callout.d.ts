import * as React from 'react';
/** White card with a 4px green left bar — used for the plain-language footnote or the honest caveat. */
export interface CalloutProps { title?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties; }
export function Callout(props: CalloutProps): JSX.Element;
