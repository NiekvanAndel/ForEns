/**
 * Which crops a location speaks for.
 *
 * Two kinds of answer, and they differ in a way that decides how everything above
 * them is shaped.
 *
 * A **soil sensor sits in one field**, so it has exactly one crop, and the grower
 * already told the web app what it is — `/soilstations/` hands it over. Nothing to
 * ask, nothing to configure, and no way for the app's idea of the field to drift from
 * the grower's.
 *
 * A **weather station speaks for a region**, and a grower with a pole in the yard
 * grows several things under it. So that side is a *list*, set by the reader in the
 * profile wizard — which is step 3 and not built. Until it is, a station-backed
 * location gets `DEFAULT_STATION_CROPS`, which is a stated assumption and marked as
 * one rather than a preference anybody chose.
 *
 * The plural is here from the start on purpose. Retrofitting "one crop" into "several"
 * touches every model, every card and every stored preference; carrying a list of one
 * costs nothing today and makes the wizard a matter of filling it.
 */

/**
 * What a station-backed location grows until somebody says otherwise.
 *
 * The three the app has models for, which is also the honest reason for the choice:
 * offering a Cercospora badge to a grower who has no beet is noise, but the
 * alternative until the wizard exists is offering nothing at all, and a potato grower
 * with a weather pole is exactly who the blight model is for.
 *
 * Set by the grower on 18 September 2026 as the interim default.
 */
export const DEFAULT_STATION_CROPS = ['Aardappel', 'Ui', 'Suikerbiet'] as const;

/** Where a location's crops came from — an assumption is not a statement. */
export type CropSource =
  /** The sensor's own field, from `/soilstations/`. */
  | 'sensor'
  /** The reader's own answer in the profile wizard. */
  | 'profile'
  /** `DEFAULT_STATION_CROPS`, because nobody has been asked yet. */
  | 'assumed';

export interface LocationCrops {
  crops: string[];
  source: CropSource;
}

export interface CropsForInput {
  /** The crop of the soil sensor bound to this location, where there is one. */
  sensorCrop?: string | null;
  /** Whether a weather station speaks for this location. */
  hasStation?: boolean;
  /** What the reader set in the profile wizard, once that exists. */
  profileCrops?: readonly string[] | null;
}

/**
 * The crops to run the models for.
 *
 * In order of how much the app actually knows: the sensor's own field first, because
 * that is a fact about this ground; then the reader's own answer; then the assumption.
 * A place that is none of the three grows nothing as far as this app is concerned, and
 * a page with no crops draws no disease cards — which is right, because a model over an
 * unknown crop is a guess wearing a name.
 */
export function cropsFor({
  sensorCrop, hasStation, profileCrops,
}: CropsForInput): LocationCrops {
  const sensor = (sensorCrop ?? '').trim();
  if (sensor) return { crops: [sensor], source: 'sensor' };

  const profile = (profileCrops ?? []).map((c) => c.trim()).filter(Boolean);
  if (profile.length) return { crops: profile, source: 'profile' };

  if (hasStation) return { crops: [...DEFAULT_STATION_CROPS], source: 'assumed' };

  return { crops: [], source: 'assumed' };
}
