/**
 * The bundled dummy layers as a `CumulativeSource`.
 *
 * The overlay PNGs are ordinary bundled assets, so the bundler owns them and this
 * only has to turn each one into something the map can load. `resolveAssetSource`
 * gives the dev server's URL while Metro is serving and a `file://` path in a
 * release build; MapLibre's `ImageSource` takes either.
 *
 * Split from `core/radar/fixture` because of that one import: the decoding belongs
 * where the tests can reach it without React Native, and the bundler's asset registry
 * does not exist outside the app.
 */
import { Image } from 'react-native';
import { fixtureManifest, fixtureValues } from '../../core/radar/fixture';
import type { CumulativeSource, CumulativeWindow } from '../../core/radar/cumulative';

/**
 * Metro resolves `require` at build time, so every path has to be written out. Six
 * literals is the price of the bundler knowing which files to ship.
 */
const PNGS: Record<number, number> = {
  1: require('../../assets/cumulative/1.png'),
  3: require('../../assets/cumulative/3.png'),
  6: require('../../assets/cumulative/6.png'),
  12: require('../../assets/cumulative/12.png'),
  24: require('../../assets/cumulative/24.png'),
  48: require('../../assets/cumulative/48.png'),
};

/** The dummy layers, behind the interface the live endpoints will use. */
export const fixtureSource: CumulativeSource = {
  async manifest() {
    return fixtureManifest;
  },

  overlayUrl(window: CumulativeWindow): string {
    const asset = PNGS[window.hours];
    // A missing asset would otherwise reach the map as `undefined` and simply draw
    // nothing, which looks exactly like a window with no rain in it.
    if (!asset) throw new Error(`cumulative fixture: no overlay for ${window.hours}h`);
    return Image.resolveAssetSource(asset).uri;
  },

  async values(window: CumulativeWindow): Promise<Uint16Array> {
    return fixtureValues(window.hours);
  },
};
