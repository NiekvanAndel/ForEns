/**
 * The bundled field layers as a `FieldSource`.
 *
 * The overlays are ordinary bundled assets, so the bundler owns them and this only has
 * to turn each one into something the map can load. `resolveAssetSource` gives the dev
 * server's URL while Metro is serving and a `file://` path in a release build;
 * MapLibre's `ImageSource` takes either.
 *
 * Split from `core/fields/fixture` because of that one import: the decoding belongs
 * where the tests can reach it without React Native, and the bundler's asset registry
 * does not exist outside the app.
 */
import { Image } from 'react-native';
import { fixtureKey, fixtureManifest, fixtureValues } from '../../core/fields/fixture';
import type { FieldSource } from '../../core/fields';
import { FIELD_FIXTURE_PNGS } from './fixtureAssets';

export const fixtureFieldSource: FieldSource = {
  async manifest(variable) {
    return fixtureManifest(variable);
  },

  overlayUrl(manifest, frame) {
    const asset = FIELD_FIXTURE_PNGS[fixtureKey(manifest.variable, frame)];
    // A missing asset would otherwise reach the map as `undefined` and simply draw
    // nothing, which on a faded layer looks exactly like a frame with no data in it.
    if (!asset) throw new Error(`fields fixture: no overlay for ${manifest.variable} ${frame.time}`);
    return Image.resolveAssetSource(asset).uri;
  },

  async values(manifest, frame) {
    return fixtureValues(manifest.variable, frame);
  },
};
