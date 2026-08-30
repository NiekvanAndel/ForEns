import * as React from 'react';
/**
 * Floating iOS tab bar in liquid glass: a translucent tint over a 24px blur + 180% saturation,
 * so the page reads through it. Selected item gets a near-opaque capsule and the filled glyph.
 * @startingPoint section="App" subtitle="Floating liquid-glass iOS tab bar" viewport="390x120"
 */
export interface TabBarProps {
  items?: Array<{ icon: string; label: string }>;
  active?: number;
  onChange?: (i: number) => void;
  /** system (default — follows the iOS appearance setting) · light · dark · opaque for Reduce Transparency */
  appearance?: 'system' | 'light' | 'dark' | 'opaque';
  style?: React.CSSProperties;
}
export function TabBar(props: TabBarProps): JSX.Element;
