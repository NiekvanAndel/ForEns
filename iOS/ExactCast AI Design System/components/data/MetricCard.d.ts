import * as React from 'react';
/**
 * The iOS app's atom: white 24px-radius card, bold navy label on top, oversized value, muted period below.
 * @startingPoint section="App" subtitle="iOS measurement card grid" viewport="390x340"
 */
export interface MetricCardProps {
  label?: React.ReactNode;
  /** the reading, or "–" when the station has no value */
  value?: React.ReactNode;
  unit?: string;
  /** period qualifier: "Current", "Today", "24 hour" */
  footnote?: React.ReactNode;
  /** default navy, cool blue for minimums, warm amber for maximums */
  tone?: 'default' | 'cool' | 'warm' | 'empty';
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function MetricCard(props: MetricCardProps): JSX.Element;
