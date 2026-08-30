import * as React from 'react';
/** Label + optional muted hint wrapper around an Input or Select. */
export interface FieldProps { label?: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode; style?: React.CSSProperties; }
export function Field(props: FieldProps): JSX.Element;
