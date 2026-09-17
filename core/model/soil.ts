/**
 * What a soil sensor measures, and the vocabulary the rest of the app reads it with.
 *
 * A weather station is a pole that stands in one place for years; in the app that is
 * one `SavedLocation` with a `stationId`. A soil sensor is something else:
 * **station × field × crop × soil type × depth × season**. Everything but the
 * station changes when it is moved, and the history belongs to the field, not to the
 * device. So the unit this module works in is the *placement*, not the station.
 *
 * Pure, and deliberately small: thresholds, the state they put a reading in, and the
 * two unit conversions that turn what the API sends into what a page may draw. No
 * fetching, no formatting, no translation — the source layer maps rows into these
 * shapes and the pages convert to the reader's units where they draw, as every other
 * quantity in the app does.
 *
 * ## Why the thresholds travel with the placement
 *
 * `/soilstations/` reports the three thresholds a sensor has *today*. Derived values
 * — pF, refill room, water percentage — are recomputed by the API on every call with
 * today's soil coefficients too. Move a sensor from clay to sand and last season's
 * refill room changes retroactively, and a chart drawn from the current thresholds
 * puts its critical line at the wrong height over the whole series. A threshold line
 * in the wrong place is worse than none, so a placement freezes the settings that
 * were in force while it ran, and everything derived is computed against the
 * placement that covers *that* moment (`placementAt`).
 *
 * Until the backend serves `/soilstations/{id}/placements/`, `placementFromStation`
 * makes the one open-ended placement the current settings describe. That is the
 * honest version of what is knowable today: one segment, running from whenever the
 * sensor started, with no claim about what came before.
 */

/**
 * The state a reading puts the field in, as the API computes and stores it.
 *
 * Frozen per measurement at ingest, so unlike the derived values these stay true
 * across a move. The four are the app's four-lamp shape exactly:
 *
 *  - 0 optimal      — enough water in the root zone
 *  - 1 suboptimal   — drying out, not yet a decision
 *  - 2 irrigate now — the decision moment
 *  - 3 critical     — the crop is being damaged
 */
export type SoilStatus = 0 | 1 | 2 | 3;

/**
 * The three suction thresholds, kPa, in the order a field dries out.
 *
 * `/soilstations/` names them `threshold_0_to_1`, `_1_to_2` and `_2_to_3`, after the
 * status transitions they mark. They are per field, derived from soil type and crop,
 * and they are the reason soil is the first indicator in the layer: no other
 * quantity in the app arrives with its own thresholds already attached.
 */
export interface SoilThresholds {
  /** 0 → 1: leaving the optimum. */
  scarce: number;
  /** 1 → 2: irrigate now. */
  irrigate: number;
  /** 2 → 3: critical. */
  critical: number;
}

/** One stretch of time during which a sensor sat in one field under one set of
 *  settings. `to` is null for the placement that is still running. */
export interface Placement {
  /** Stable across placements: the device is the same device. */
  stationId: string;
  placementId: string;
  lat: number;
  lon: number;
  /** Both UTC ISO; `to` null means "still here". */
  from: string;
  to: string | null;
  crop: string | null;
  /** Soil type. Not served by `/soilstations/` yet, hence nullable. */
  soil: string | null;
  /** Sensor depth, cm — also the depth the refill room is spread over. */
  depthCm: number;
  /** Frozen at creation: what was in force while this placement ran. */
  thresholds: SoilThresholds;
  /** True where the settings are today's rather than the ones that actually ran —
   *  everything before the first recorded move. Pages label such a segment rather
   *  than quietly presenting it as measured fact. */
  assumed?: boolean;
}

/**
 * Which state a suction reading falls in, against one placement's thresholds.
 *
 * Only for a reading that arrives without a stored `status_code` — a forecast point,
 * or a row from an endpoint that does not carry it. Where the API sent one, that one
 * wins: it was computed at ingest against the settings of the day, which is exactly
 * the guarantee this function cannot give for the past.
 *
 * The bands are half-open upwards — a reading *at* a threshold has crossed it —
 * because that is how the transition alerts in the web app already read them, and two
 * answers to "is it 45" would show up as an alert that fires without the app agreeing.
 *
 * Thresholds are required to be non-decreasing, not strictly increasing: 238 of the
 * 1181 sensors on the account today have `scarce == irrigate`, which is a real
 * configuration meaning "there is no suboptimal band here, it goes from fine to
 * irrigate". Collapsed bands are skipped rather than treated as an error.
 */
export function statusFromTension(kPa: number | null, t: SoilThresholds): SoilStatus | null {
  if (kPa == null || !Number.isFinite(kPa)) return null;
  if (kPa >= t.critical) return 3;
  if (kPa >= t.irrigate) return 2;
  if (kPa >= t.scarce) return 1;
  return 0;
}

/**
 * The refill room in millimetres — the first of the two unit traps.
 *
 * The API's `bijvulruimte` is **not** mm. It is a difference in volume percent, and
 * millimetres only appear once it is spread over the depth the sensor sits at:
 * 1 vol-% over 10 cm of soil is 1 mm of water, so mm = vol-% × depth / 10. The web
 * app does this in its template; an app that forgets it shows 11 where 33 belongs,
 * and nothing about the number looks wrong.
 *
 * Kept here, at the edge, with a test around it — the same treatment `global_radiation`
 * gets in the source layer for meaning J/cm² on one endpoint and W/m² on another.
 */
export function refillMm(volumePercent: number | null, depthCm: number): number | null {
  if (volumePercent == null || !Number.isFinite(volumePercent)) return null;
  if (!Number.isFinite(depthCm) || depthCm <= 0) return null;
  return Math.round(((volumePercent * depthCm) / 10) * 10) / 10;
}

/**
 * Water content as a volume percent — the second unit trap, and an unfinished one.
 *
 * The v2 schema documents `water_percentage` as 0–1 while the web app prints it as a
 * percent, and every soil sensor on the account answered these endpoints empty in the
 * session this was written, so it could not be pinned against live data the way the
 * radiation conversion was. Until it can be, the reading is taken for what it can
 * only be: soil never holds more water than it is, so a value at or below 1 is a
 * fraction and anything above it is already a percent.
 *
 * The guess is safe in the one direction that matters — no real volumetric water
 * content sits at 1 vol-% or below, and none reaches 100 — but it is still a guess,
 * and it is one function rather than a scatter of `* 100` so that pinning it later is
 * a single edit. See `docs/soil-crop-integratie.md` §9.
 */
export function waterPercent(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const pct = raw <= 1 ? raw * 100 : raw;
  return Math.round(pct * 10) / 10;
}

/** Fourteen days without a measurement: the same grace `SoilStation.last_reading`
 *  uses, and the line between a sensor that is *out* and one that is *broken*. */
export const DORMANT_AFTER_MS = 14 * 24 * 3600_000;

/**
 * Whether the sensor is out of the ground rather than faulty.
 *
 * For a weather pole, silence is a fault worth reporting. For a soil sensor it is
 * most of the winter, every winter: it is lifted at harvest and goes back in in
 * spring. The indicator layer has to hold those two apart, or the app tells every
 * grower each autumn that something has broken.
 *
 * Dormant means: drop the soil blocks, keep the location as an ordinary weather
 * location, and let the chart say "not active since «date»" with the history still
 * there to ask for.
 */
export function isDormant(lastReadingIso: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastReadingIso) return true;
  const ms = new Date(lastReadingIso).getTime();
  if (!Number.isFinite(ms)) return true;
  return now.getTime() - ms > DORMANT_AFTER_MS;
}

/**
 * The placement that covers an instant, or null if none does.
 *
 * `from` is inclusive and `to` exclusive, so the reading at the moment of a move
 * belongs to the placement that is starting — the sensor was lifted before it, and
 * the closing placement's last reading is the one before.
 */
export function placementAt(
  placements: readonly Placement[],
  iso: string
): Placement | null {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  for (const p of placements) {
    const from = new Date(p.from).getTime();
    if (!Number.isFinite(from) || ms < from) continue;
    if (p.to == null) return p;
    const to = new Date(p.to).getTime();
    if (Number.isFinite(to) && ms < to) return p;
  }
  return null;
}

/** The one that is still running — the only placement that is also a location. */
export function currentPlacement(placements: readonly Placement[]): Placement | null {
  return placements.find((p) => p.to == null) ?? null;
}

/**
 * Split a series at its placement boundaries.
 *
 * A chart drawing one line over a move draws a lie: the thresholds under the two
 * halves are different, and so is the field. Each segment carries the placement it
 * was measured under, so the page can step the threshold line and name the field
 * above that stretch.
 *
 * Samples that fall in no placement — before the first one on record — come back in a
 * segment with a null placement, which a page may draw without thresholds or drop.
 */
export function segmentByPlacement<T extends { measTime: string }>(
  samples: readonly T[],
  placements: readonly Placement[]
): { placement: Placement | null; samples: T[] }[] {
  const out: { placement: Placement | null; samples: T[] }[] = [];
  for (const s of samples) {
    const p = placementAt(placements, s.measTime);
    const last = out[out.length - 1];
    if (last && last.placement?.placementId === p?.placementId) last.samples.push(s);
    else out.push({ placement: p, samples: [s] });
  }
  return out;
}

/**
 * The single placement today's settings describe, for as long as there is no
 * `/placements/` endpoint to ask.
 *
 * Everything before `from` is the same segment as far as this app can tell, and it is
 * marked `assumed` so a page can say "settings unknown before «date»" instead of
 * presenting a frozen threshold it does not actually have. Structurally typed rather
 * than importing the source layer's `SoilStation`, so the model keeps no dependency
 * on where the row came from.
 */
export function placementFromStation(
  station: {
    id: string;
    name?: string | null;
    lat: number;
    lon: number;
    crop: string | null;
    depthCm: number | null;
    thresholds: SoilThresholds | null;
  },
  /** When this placement is taken to have started — the season's first reading
   *  where one is known. */
  from: string
): Placement | null {
  if (!station.thresholds || !station.depthCm) return null;
  return {
    stationId: station.id,
    placementId: `${station.id}:current`,
    lat: station.lat,
    lon: station.lon,
    from,
    to: null,
    crop: station.crop,
    // `/soilstations/` does not serve the soil type yet; the context line says so
    // rather than inventing one.
    soil: null,
    depthCm: station.depthCm,
    thresholds: station.thresholds,
    assumed: true,
  };
}
