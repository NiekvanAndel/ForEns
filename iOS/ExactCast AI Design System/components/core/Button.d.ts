import * as React from 'react';
/**
 * Pill-shaped action. Primary is the 135° green gradient; ghost sits on navy, ghost-dark on cream.
 * @startingPoint section="Core" subtitle="Pill buttons in every variant and size" viewport="700x180"
 */
export interface ButtonProps {
  /** primary = green gradient, ghost = outlined on navy, ghost-dark = outlined on cream, white = solid white on green */
  variant?: 'primary' | 'ghost' | 'ghost-dark' | 'white';
  /** md = 16px/28px, sm = 12px/24px */
  size?: 'md' | 'sm';
  /** renders an <a> instead of a <button> */
  href?: string;
  children?: React.ReactNode;
  /** trailing glyph, usually a Lucide arrow-right at 20px */
  icon?: React.ReactNode;
  disabled?: boolean;
  full?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export function Button(props: ButtonProps): JSX.Element;
