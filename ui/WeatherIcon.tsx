/**
 * Weather condition glyph.
 *
 * The design's AppChrome maps a small condition vocabulary onto Phosphor and tints
 * "by daylight not by severity" — sun is warm, night is accent blue, everything else
 * is muted. index.html carries 21 WMO codes, so the mapping from code to condition
 * lives here.
 *
 * This is where the Yr icon set was dropped: Phosphor is design rule 6, and Yr's
 * richer vocabulary has no equivalent in it. Distinctions Phosphor cannot draw
 * (light vs heavy drizzle) collapse onto the same glyph; the numbers beside it carry
 * the intensity instead.
 */
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type Condition =
  | 'clear' | 'night' | 'partly-cloudy' | 'partly-cloudy-night'
  | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'snow' | 'storm' | 'wind';

const CONDITION_ICON: Record<Condition, string> = {
  clear: 'sun',
  night: 'moon-stars',
  'partly-cloudy': 'cloud-sun',
  'partly-cloudy-night': 'cloud',
  cloudy: 'cloud',
  fog: 'cloud-fog',
  drizzle: 'cloud-rain',
  rain: 'cloud-rain',
  showers: 'cloud-rain',
  snow: 'cloud-snow',
  storm: 'cloud-lightning',
  wind: 'wind',
};

/**
 * WMO code to condition, honouring day/night.
 * Codes follow the set index.html renders.
 */
export function wmoToCondition(code: number, isDay: 0 | 1 | boolean = 1): Condition {
  const day = isDay === 1 || isDay === true;
  if (code === 0) return day ? 'clear' : 'night';
  if (code === 1 || code === 2) return day ? 'partly-cloudy' : 'partly-cloudy-night';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export interface WeatherIconProps {
  /** Either a condition, or a raw WMO code with `isDay`. */
  condition?: Condition;
  wmo?: number;
  isDay?: 0 | 1 | boolean;
  size?: number;
}

export function WeatherIcon({ condition, wmo, isDay = 1, size = 34 }: WeatherIconProps) {
  const { palette } = useTheme();
  const cond = condition ?? wmoToCondition(wmo ?? 3, isDay);
  // Tinted by daylight, not severity — a heavy shower is not a red icon.
  const color =
    cond === 'clear' ? palette.valSun
      : cond === 'night' || cond === 'partly-cloudy-night' ? palette.accent
        : palette.muted;
  return <Icon name={CONDITION_ICON[cond]} size={size} color={color} weight="fill" />;
}
