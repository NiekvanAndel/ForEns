import * as React from 'react';
/**
 * FAQ list. One item open at a time; +/– affordance in green-dark, no chevron.
 * @startingPoint section="Web" subtitle="FAQ accordion on cream" viewport="700x260"
 */
export interface AccordionProps { items?: Array<{ q: React.ReactNode; a: React.ReactNode }>; style?: React.CSSProperties; }
export function Accordion(props: AccordionProps): JSX.Element;
