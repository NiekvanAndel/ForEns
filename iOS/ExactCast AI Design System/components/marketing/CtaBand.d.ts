import * as React from 'react';
/** Full-width green gradient band with 28px radius that closes a marketing page. Buttons inside use variant="white". */
export interface CtaBandProps { title?: React.ReactNode; body?: React.ReactNode; children?: React.ReactNode; bullets?: string[]; style?: React.CSSProperties; }
export function CtaBand(props: CtaBandProps): JSX.Element;
