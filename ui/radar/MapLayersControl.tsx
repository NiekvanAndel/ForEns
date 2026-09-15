/**
 * The layer picker on the full-screen map.
 *
 * One button in the map's chrome, carrying the stacked-layers glyph the platform's
 * own weather map uses for the same job, that opens a small card of what the map can
 * draw. Two entries today: the nowcast loop the map has always shown, and the
 * cumulative rainfall totals.
 *
 * It is a radio, not a set of switches. Every layer paints the whole country in its own
 * colour ramp, and a reader who could turn two on would get a picture in which neither
 * ramp means anything. Which one is showing is therefore a choice between them, and the
 * button fills in while anything but the default is on — so a reader who left another
 * layer up and came back knows why the map looks different.
 *
 * The list is in two groups, split by the hairline: what is falling now, and what the
 * station network measures. They answer different questions and a reader looking for
 * one is not browsing the other.
 *
 * The card closes on a tap anywhere else on the map. A picker that stays open over
 * the thing it is picking for is a picker that has to be dismissed before the choice
 * can be seen.
 */
import { Pressable, View } from 'react-native';
import { radius, shadowFloat, space, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { MAP_CHROME_SIZE } from './RadarMap';
import { mapChrome } from './mapStyle';
import type { FieldVariable } from '../../core/fields';

export type MapLayer = 'nowcast' | 'cumulative' | 'temperature' | 'humidity' | 'wind';

/** The layers backed by the Detailcharts regression, which the map drives as one kind
 *  of thing: a scalar field on a ten-minute loop. */
export const FIELD_LAYERS: MapLayer[] = ['temperature', 'humidity', 'wind'];

export function fieldVariableOf(layer: MapLayer): FieldVariable | null {
  return FIELD_LAYERS.includes(layer) ? (layer as FieldVariable) : null;
}

interface LayerOption {
  id: MapLayer;
  icon: string;
  label: string;
  detail: string;
  /** Drawn with a hairline above it, opening the second group. */
  startsGroup?: boolean;
}

const OPTIONS: LayerOption[] = [
  {
    id: 'nowcast',
    icon: 'broadcast',
    label: 'Neerslag nu',
    detail: 'Radarloop, −15 tot +90 min',
  },
  {
    id: 'cumulative',
    icon: 'drop',
    label: 'Neerslagsom',
    detail: 'Gekalibreerd, tot 48 uur terug',
  },
  {
    id: 'temperature',
    icon: 'thermometer-simple',
    label: 'Temperatuur',
    detail: 'Meetnetten, per 10 minuten',
    startsGroup: true,
  },
  {
    id: 'humidity',
    icon: 'drop-half',
    label: 'Luchtvochtigheid',
    detail: 'Meetnetten, per 10 minuten',
  },
  {
    id: 'wind',
    icon: 'wind',
    label: 'Wind',
    detail: 'Op 2 meter, per 10 minuten',
  },
];

export interface MapLayersControlProps {
  active: MapLayer;
  onSelect: (layer: MapLayer) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the button's row starts, matching the rest of the map's chrome. */
  top: number;
  /** How far in from the right, so it clears the notch when the phone is on its side. */
  right: number;
}

export function MapLayersControl({
  active, onSelect, open, onOpenChange, top, right,
}: MapLayersControlProps) {
  const { palette, appearance } = useTheme();
  const chrome = mapChrome(palette, appearance);
  // The card's own ink, dimmed. Taken from the chrome rather than the page palette:
  // this floats on the map, whose appearance is its own.
  const detailInk = chrome.dark ? 'rgba(242,247,252,.62)' : 'rgba(12,37,71,.58)';

  return (
    <>
      {/* Catches the tap that dismisses the card. Only mounted while it is open, or
          it would swallow every pan the map is there for. */}
      {open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lagenmenu sluiten"
          onPress={() => onOpenChange(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      <View style={{ position: 'absolute', right, top, alignItems: 'flex-end' }}>
        <Pressable
          onPress={() => onOpenChange(!open)}
          accessibilityRole="button"
          accessibilityLabel="Kaartlagen"
          accessibilityState={{ expanded: open }}
          hitSlop={8}
          style={[
            {
              width: MAP_CHROME_SIZE, height: MAP_CHROME_SIZE, borderRadius: radius.tile,
              backgroundColor: active === 'nowcast' ? chrome.bg : palette.accent,
              alignItems: 'center', justifyContent: 'center',
            },
            shadowFloat,
          ]}
        >
          <Icon
            name="stack"
            size={18}
            color={active === 'nowcast' ? chrome.ink : '#fff'}
            weight={active === 'nowcast' ? 'bold' : 'fill'}
          />
        </Pressable>

        {open ? (
          <View
            style={[
              {
                marginTop: space[2],
                minWidth: 226,
                backgroundColor: chrome.bg,
                borderRadius: radius.tile,
                paddingVertical: space[2],
              },
              shadowFloat,
            ]}
          >
            {OPTIONS.map((option) => {
              const selected = option.id === active;
              return (
                <View key={option.id}>
                {option.startsGroup ? (
                  <View
                    style={{
                      height: 1, backgroundColor: palette.hairline,
                      marginVertical: space[2], marginHorizontal: space[4],
                    }}
                  />
                ) : null}
                <Pressable
                  onPress={() => {
                    onSelect(option.id);
                    onOpenChange(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: space[3],
                    paddingVertical: space[2], paddingHorizontal: space[4],
                    backgroundColor: pressed ? palette.pressedRow : 'transparent',
                  })}
                >
                  <Icon
                    name={option.icon}
                    size={18}
                    color={selected ? palette.accent : chrome.ink}
                    weight={selected ? 'fill' : 'regular'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="label"
                      weight={selected ? 'bold' : 'semibold'}
                      color={chrome.ink}
                    >
                      {option.label}
                    </Text>
                    <Text variant="caption" color={detailInk}>
                      {option.detail}
                    </Text>
                  </View>
                  {/* The tick rather than a highlighted row: the card is translucent
                      over moving weather, and a background tint reads as the map. */}
                  {selected ? (
                    <Icon name="check" size={15} color={palette.accent} weight="bold" />
                  ) : null}
                </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </>
  );
}
