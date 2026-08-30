import * as React from 'react';
/**
 * Pricing tier. The recommended tier gets a 2px green outline and an overhanging gradient tag.
 * @startingPoint section="Web" subtitle="Three-up pricing tiers" viewport="700x320"
 */
export interface PlanCardProps { name?: React.ReactNode; amount?: React.ReactNode; per?: React.ReactNode; features?: string[]; best?: boolean; tag?: string; cta?: React.ReactNode; style?: React.CSSProperties; }
export function PlanCard(props: PlanCardProps): JSX.Element;
