import * as React from 'react';
/** Text field: 1.5px hairline border, 10px radius, green border + 3px green ring on focus. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { /** sm 10/12, md 11/13, lg 14/16 */ size?: 'sm' | 'md' | 'lg'; invalid?: boolean; }
export function Input(props: InputProps): JSX.Element;
