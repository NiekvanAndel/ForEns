import * as React from 'react';
/**
 * Icon tinted with currentColor. Default set is Phosphor — the closest CDN stand-in for
 * standard iOS SF Symbols (rounded caps, regular/fill pairing). Use set="lucide" only on the
 * marketing site, whose source markup embeds Lucide paths verbatim.
 */
export interface IconProps {
  /** kebab-case icon name, e.g. "cloud-sun", "broadcast", "arrow-right" */
  name: string;
  /** px, default 20 */
  size?: number;
  /** phosphor (iOS-style, default) or lucide (web legacy) */
  set?: 'phosphor' | 'lucide';
  /** Phosphor weight; "fill" is the iOS selected-state twin */
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
