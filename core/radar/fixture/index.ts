/**
 * The bundled dummy cumulative layers, decoded.
 *
 * The real endpoints need an authenticated user and the branch that serves them is
 * not deployed, so the map is built against the output of
 * `manage.py build_cumulative_radar --dummy`, dumped into `generated.ts` by
 * `AgroExactWebApp/scripts/dump_cumulative_fixtures.py`. It is a faithful copy of a
 * real response — same crop, same legend, same nesting windows, and the coverage gaps
 * the pipeline can produce are baked in — with `source: "dummy"` so nothing can
 * mistake it for measured data.
 *
 * Nothing here imports React Native: the decoding is what the tests want to reach,
 * and the PNGs, which do need the bundler, are resolved in `ui/radar/fixtureSource`.
 *
 * All of this is scaffolding. When the live endpoints are reachable it goes, and
 * `httpSource` in ../cumulative takes its place behind the same interface.
 */
import { decodeBase64 } from '../../base64';
import type { CumulativeManifest } from '../cumulative';
import { FIXTURE_MANIFEST, FIXTURE_VALUES_B64 } from './generated';

/** The dummy manifest, shaped exactly as the endpoint's. */
export const fixtureManifest = FIXTURE_MANIFEST as unknown as CumulativeManifest;

/** Decoded rasters are kept: 209x160 uint16 is small, and the slider walks back over
 *  windows it has already shown. */
const decoded = new Map<number, Uint16Array>();

/**
 * One window's value raster, as little-endian uint16 tenths of a millimetre.
 *
 * Throws for a window the fixture does not carry, which can only be a wiring mistake
 * — the manifest and this table are generated together.
 */
export function fixtureValues(hours: number): Uint16Array {
  const cached = decoded.get(hours);
  if (cached) return cached;

  const b64 = FIXTURE_VALUES_B64[hours];
  if (!b64) throw new Error(`cumulative fixture: no values for a ${hours}h window`);

  const bytes = decodeBase64(b64);
  // `bytes` is a view into a buffer sized by the base64 length, so the raster is
  // built from the exact byte range rather than the whole allocation.
  const values = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
  decoded.set(hours, values);
  return values;
}
