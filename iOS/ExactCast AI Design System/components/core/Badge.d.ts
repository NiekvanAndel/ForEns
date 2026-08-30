import * as React from 'react';
/** Small label: green pill for "Meest gekozen", amber square for open to-dos, navy square for change annotations. */
export interface BadgeProps { children?: React.ReactNode; tone?: 'green' | 'amber' | 'navy'; /** 6px-radius rectangle instead of a pill */ square?: boolean; style?: React.CSSProperties; }
export function Badge(props: BadgeProps): JSX.Element;
