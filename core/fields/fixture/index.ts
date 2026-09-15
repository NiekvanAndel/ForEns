/**
 * The bundled Detailcharts field layers, decoded.
 *
 * The pipeline runs on a laptop and nothing is hosted yet, so the map is built against
 * the output of `scripts/export_web.py` dumped into this repo by
 * `Detailcharts/scripts/dump_app_fixture.py`. It is a faithful copy of what the endpoint
 * will serve — same manifests, same bounds, same legend, same rasters — at half the
 * overlay resolution, which is a bundle-size choice and nothing the UI can see.
 *
 * **The frames before the anchor are synthetic**, derived from the one real snapshot by
 * advecting it. The manifests say so (`source: "synthetic"`) and the UI shows it, so a
 * loop of scaffolding cannot be read as two hours of weather.
 *
 * Nothing here imports React Native: the decoding is what the tests want to reach, and
 * the PNGs, which do need the bundler, are resolved in `ui/fields/fixtureAssets`.
 *
 * All of this is scaffolding. When the live endpoints are reachable it goes, and
 * `httpSource` in ../index takes its place behind the same interface.
 */
import { decodeBase64 } from '../../base64';
import type { FieldFrame, FieldManifest, FieldVariable } from '../index';
import { FIXTURE_MANIFESTS, FIXTURE_VALUES_B64 } from './generated';

/** The key a frame's assets are filed under, in both tables. */
export function fixtureKey(variable: FieldVariable, frame: FieldFrame): string {
  return `${variable}/${frame.png_url.replace(/\.png$/, '')}`;
}

export function fixtureManifest(variable: FieldVariable): FieldManifest {
  const manifest = FIXTURE_MANIFESTS[variable];
  if (!manifest) throw new Error(`fields fixture: no manifest for "${variable}"`);
  return manifest;
}

/** Decoded rasters are kept: each is a few kilobytes, and the play head walks back over
 *  frames it has already shown. */
const decoded = new Map<string, Uint16Array>();

/**
 * One frame's value raster, as the little-endian uint16 its manifest describes.
 *
 * Throws for a frame the fixture does not carry, which can only be a wiring mistake —
 * the manifests and this table are generated in the same pass.
 */
export function fixtureValues(variable: FieldVariable, frame: FieldFrame): Uint16Array {
  const key = fixtureKey(variable, frame);
  const cached = decoded.get(key);
  if (cached) return cached;

  const b64 = FIXTURE_VALUES_B64[key];
  if (!b64) throw new Error(`fields fixture: no values for ${key}`);

  const bytes = decodeBase64(b64);
  // `bytes` is a view into a buffer sized by the base64 length, so the raster is built
  // from the exact byte range rather than the whole allocation.
  const values = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
  decoded.set(key, values);
  return values;
}
