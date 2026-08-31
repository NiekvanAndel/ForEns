/**
 * Phosphor icons, addressed by the kebab-case names the design system uses.
 *
 * Design rule 6: Phosphor for the iOS app — outline when idle, `weight="fill"` when
 * selected. Never emoji, never a hand-drawn SVG. The design's JSX passes names like
 * "cloud-rain" and "gear-six", so this maps those onto Phosphor's components rather
 * than renaming them at every call site.
 */
import {
  ArrowDown, ArrowUp, ArrowsClockwise, Broadcast, CalendarBlank, CaretRight,
  ChartLine, CircleHalf, Clock, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun,
  CloudSnow, Crosshair, DotsSixVertical, Drop, DropHalf, GearSix, Info, MagnifyingGlass, Minus,
  Moon, MoonStars, Pause, Play, PlugsConnected, Plus, Ruler, Sun, TextAa,
  ThermometerSimple, Translate, Trash, Wind, X,
  type IconProps as PhosphorProps,
  NavigationArrow,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';

const ICONS = {
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'arrows-clockwise': ArrowsClockwise,
  broadcast: Broadcast,
  'calendar-blank': CalendarBlank,
  'caret-right': CaretRight,
  'chart-line': ChartLine,
  'circle-half': CircleHalf,
  clock: Clock,
  cloud: Cloud,
  'cloud-fog': CloudFog,
  'cloud-lightning': CloudLightning,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-sun': CloudSun,
  crosshair: Crosshair,
  'dots-six-vertical': DotsSixVertical,
  drop: Drop,
  'drop-half': DropHalf,
  'gear-six': GearSix,
  info: Info,
  'magnifying-glass': MagnifyingGlass,
  minus: Minus,
  moon: Moon,
  'navigation-arrow': NavigationArrow,
  'moon-stars': MoonStars,
  pause: Pause,
  play: Play,
  'plugs-connected': PlugsConnected,
  plus: Plus,
  ruler: Ruler,
  sun: Sun,
  'text-aa': TextAa,
  'thermometer-simple': ThermometerSimple,
  translate: Translate,
  trash: Trash,
  wind: Wind,
  x: X,
} satisfies Record<string, ComponentType<PhosphorProps>>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  weight?: PhosphorProps['weight'];
}

export function Icon({ name, size = 20, color, weight = 'regular' }: IconProps) {
  const Component = ICONS[name as IconName] ?? Cloud;
  return <Component size={size} color={color} weight={weight} />;
}

export function hasIcon(name: string): name is IconName {
  return name in ICONS;
}
