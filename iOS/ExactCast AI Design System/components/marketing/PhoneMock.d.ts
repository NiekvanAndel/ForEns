import * as React from 'react';
/** Navy phone shell (30px outer / 23px inner radius) for showing app screens on marketing pages. */
export interface PhoneMockProps { children?: React.ReactNode; width?: number; /** 196px, 90% opacity, offset 22px down — the background phone in a pair */ small?: boolean; title?: React.ReactNode; time?: string; style?: React.CSSProperties; }
export function PhoneMock(props: PhoneMockProps): JSX.Element;
