import * as React from 'react';
/**
 * The universal container: pure white, 16px radius, soft 50px shadow, no border.
 * @startingPoint section="Core" subtitle="White floating card on cream" viewport="700x200"
 */
export interface CardProps { children?: React.ReactNode; /** CSS padding, default 24px */ pad?: string; /** default var(--radius-card); use var(--radius-app-card) in the iOS app */ radius?: string; /** cream-2 inset tile instead of a floating white card */ alt?: boolean; style?: React.CSSProperties; }
export function Card(props: CardProps): JSX.Element;
