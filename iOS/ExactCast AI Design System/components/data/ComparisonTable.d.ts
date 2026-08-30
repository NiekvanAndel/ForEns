import * as React from 'react';
/** "Them vs us" table: navy header row, own column headed with the green gradient and tinted green below. */
export interface ComparisonTableProps { /** last column is always the brand's own; it gets the gradient header */ columns?: React.ReactNode[]; rows?: Array<{ label: React.ReactNode; cells: React.ReactNode[] }>; style?: React.CSSProperties; }
export function ComparisonTable(props: ComparisonTableProps): JSX.Element;
