import * as React from 'react';
/** Native select styled to match Input exactly. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { options?: Array<string | { value: string; label: string }>; }
export function Select(props: SelectProps): JSX.Element;
