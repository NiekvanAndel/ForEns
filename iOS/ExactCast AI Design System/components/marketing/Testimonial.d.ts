import * as React from 'react';
/** Quote card: green-dark context line, italic quote, name, optional result footer. Unverified facts carry an amber to-do badge. */
export interface TestimonialProps { meta?: React.ReactNode; quote?: React.ReactNode; who?: React.ReactNode; result?: React.ReactNode; /** amber badge text for facts still to be confirmed */ todo?: string; style?: React.CSSProperties; }
export function Testimonial(props: TestimonialProps): JSX.Element;
