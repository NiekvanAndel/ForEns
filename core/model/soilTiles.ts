/**
 * The soil blocks on 'Actueel'.
 *
 * Deliberately the same `Tile` shape as `modelTiles`, so `arrangeTiles` and the tile
 * editor carry them without knowing they exist: a grower who arranged their grid last
 * month gets the new blocks in their natural place, and can drag or switch them off
 * like any other. That was the whole reason the plan put soil *into* the three
 * existing screens rather than on a page of its own.
 *
 * ## What a soil sensor may and may not speak for
 *
 * Every block here is an instrument reporting, so they carry the green dot.
 *
 * **Leaf wetness has no block**, though the source layer reads it. Two reasons, and
 * either would be enough: `leaf_wet` is in the web app's model but not yet in API v2,
 * so it cannot arrive; and it is not measured but derived — rain in the last hour, or
 * humidity at 10 cm above 95% — so it needs a yes/no block that says "proxy" on it
 * rather than a number in a grid of measurements. Both are settled before it appears,
 * not after.
 *
 * The canopy blocks — temperature, humidity and dew point at 10 cm — appear only on a
 * PRO, which is the model that has that probe. Asking the readings instead, as this
 * did first, cannot tell a sensor without the probe from one whose probe is silent.
 * They are a different quantity from the same readings at 1.50 m, not a better version
 * of them, so they are their own blocks and must never quietly overwrite the weather
 * station's.
 *
 * ## Rainfall is not here
 *
 * By decision: rain and irrigation are one number, so a sensor's rainfall belongs in
 * the existing rainfall block with its dot turned on, not in a second block beside it.
 * That is a merge into `modelTiles` rather than a tile of its own, and it is not done
 * yet — see `docs/soil-crop-integratie.md` §5.
 *
 * Pure: no formatting, no unit conversion, no words beyond the labels handed in.
 */
import { isDormant, soilCapabilities, type Placement } from './soil';
import type { Tile, TileKind } from './tiles';
import type { SoilSample } from '../sources/agroexact';

/** The words the soil grid needs, handed in so this module stays pure. */
export interface SoilTileLabels {
  tension: string;
  status: string;
  refillRoom: string;
  refillNeeded: string;
  waterPercent: string;
  pF: string;
  soilTemp: string;
  temp10: string;
  humidity10: string;
  dewpoint10: string;
  /** Window labels — every one of these is a reading at an instant. */
  now: string;
  /** The depth a reading was taken at, e.g. "30 cm". Built by the caller, because
   *  the unit belongs to the reader's settings and not to this module. */
  atDepth: string;
}

/**
 * The blocks a placement's latest reading fills.
 *
 * Empty when the sensor is out of the ground — fourteen days without a measurement.
 * The blocks come off the page, the location stays as an ordinary weather location,
 * and nothing anywhere calls it a fault. A sensor lifted at harvest is a state.
 *
 * Empty is also the answer with no reading at all, for the same reason: a grid of
 * dashes claims a sensor is there and silent, which is a different and more alarming
 * statement than not showing soil blocks.
 */
export function soilTiles(
  placement: Placement,
  latest: SoilSample | null,
  labels: SoilTileLabels,
  now: Date = new Date()
): Tile[] {
  if (!latest || isDormant(latest.measTime, now)) return [];

  const tile = (
    id: string,
    title: string,
    timeLabel: string,
    value: number | null,
    kind: TileKind,
    measured = true
  ): Tile | null => {
    if (value == null || !Number.isFinite(value)) return null;
    return { id: `soil-${id}`, title, timeLabel, value, kind, measured };
  };

  const depth = labels.atDepth;
  const { canopy } = soilCapabilities(placement.sensorType);

  return [
    // The indicator itself, and the reason soil comes first in the layer.
    tile('tension', labels.tension, depth, latest.tension, 'kpa'),
    tile('status', labels.status, labels.now, latest.status, 'status'),
    tile('refill-room', labels.refillRoom, depth, latest.refillMm, 'mm'),
    // The figure, not the recommendation. The badge only names an amount once the
    // field is at "irrigate now"; a block on a grid of figures is a figure, and
    // withholding it below that would be withholding a measurement rather than
    // withholding advice.
    latest.status != null && latest.status >= 1
      ? tile('refill-needed', labels.refillNeeded, depth, latest.refillToScarceMm, 'mm')
      : null,
    tile('water-percent', labels.waterPercent, depth, latest.waterPercent, 'percent'),
    tile('pf', labels.pF, depth, latest.pF, 'pf'),
    tile('soil-temp', labels.soilTemp, depth, latest.soilTemp, 'temp'),
    // Canopy: PRO only, decided by the sensor's model rather than by whether a value
    // happens to be there. Never a stand-in for the readings at 1.50 m.
    ...(canopy ? [
      tile('temp-10', labels.temp10, labels.now, latest.temp10, 'temp'),
      tile('humidity-10', labels.humidity10, labels.now, latest.humidity10, 'percent'),
      tile('dewpoint-10', labels.dewpoint10, labels.now, latest.dewpoint10, 'temp'),
    ] : []),
  ].filter((t): t is Tile => t != null);
}

/**
 * The line that makes a suction reading readable.
 *
 * "Aardappel · matig zware klei · sensor op 30 cm". Not decoration: 48 kPa means one
 * thing on sand under onions and another on heavy clay under potatoes, so without
 * crop, soil and depth the number on the page cannot be interpreted at all. It sits
 * on the page whenever soil blocks do, and per row in the comparison sheet.
 *
 * Whatever is unknown is left out rather than guessed — the soil type is not served by
 * `/soilstations/` yet, and an invented one would be the worst of the three to be
 * wrong about.
 */
export function placementContext(placement: Placement, depthLabel: string): string {
  return [placement.crop, placement.soil, depthLabel].filter(Boolean).join(' · ');
}
