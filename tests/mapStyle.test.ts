/**
 * Rewriting a basemap's labels into the app's language.
 *
 * The style itself belongs to OpenFreeMap and cannot be fetched from here, so what
 * is pinned is the rewrite: which layers it touches, which it must leave alone, and
 * the order it asks for names in. The last of those is the whole point — a chain
 * that forgot to fall back to `name` would replace English labels with blank ones.
 */
import { describe, it, expect } from 'vitest';
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import {
  firstFeatureLayerId, firstLabelLayerId, isBuiltLayer, localiseStyle, sinkBuiltLayers,
  weatherBeforeLayerId,
} from '../ui/radar/mapStyle';

const style = (layers: unknown[]): StyleSpecification =>
  ({ version: 8, sources: {}, layers } as unknown as StyleSpecification);

const textField = (s: StyleSpecification, id: string): unknown =>
  (s.layers.find((l) => l.id === id) as { layout?: Record<string, unknown> } | undefined)
    ?.layout?.['text-field'];

describe('localiseStyle', () => {
  it('asks for the reader\'s language, then the local name', () => {
    const out = localiseStyle(
      style([
        { id: 'place', type: 'symbol', layout: { 'text-field': ['get', 'name:latin'] } },
      ]),
      'nl'
    );
    expect(textField(out, 'place')).toEqual([
      'coalesce',
      ['get', 'name:nl'],
      ['get', 'name_nl'],
      ['get', 'name'],
      ['get', 'name:latin'],
      ['get', 'name_int'],
      '',
    ]);
  });

  it('falls back to the local name, which is the reason to do this at all', () => {
    // Brussel, Köln, Liège: where nothing is translated the road-sign name is the
    // right answer, and it is what `name` carries.
    const chain = localiseStyle(
      style([{ id: 'p', type: 'symbol', layout: { 'text-field': ['get', 'name_int'] } }]),
      'nl'
    );
    expect(JSON.stringify(textField(chain, 'p'))).toContain('"name"');
  });

  it('leaves labels that are not names alone', () => {
    const out = localiseStyle(
      style([
        // A motorway shield, a contour line and a house number: rewriting any of
        // these to a place name would blank them.
        { id: 'shield', type: 'symbol', layout: { 'text-field': ['get', 'ref'] } },
        { id: 'contour', type: 'symbol', layout: { 'text-field': '{ele}' } },
        { id: 'housenumber', type: 'symbol', layout: { 'text-field': ['get', 'housenumber'] } },
      ]),
      'de'
    );
    expect(textField(out, 'shield')).toEqual(['get', 'ref']);
    expect(textField(out, 'contour')).toBe('{ele}');
    expect(textField(out, 'housenumber')).toEqual(['get', 'housenumber']);
  });

  it('rewrites the legacy token spelling too', () => {
    const out = localiseStyle(
      style([{ id: 'p', type: 'symbol', layout: { 'text-field': '{name:latin}\\n{name:nonlatin}' } }]),
      'fr'
    );
    expect(Array.isArray(textField(out, 'p'))).toBe(true);
  });

  it('touches nothing that is not a symbol layer', () => {
    const layers = [
      { id: 'water', type: 'fill', paint: { 'fill-color': '#000' } },
      { id: 'road', type: 'line', paint: { 'line-color': '#fff' } },
    ];
    expect(localiseStyle(style(layers), 'nl').layers).toEqual(layers);
  });

  it('leaves a symbol layer with no text at all where it is', () => {
    const layers = [{ id: 'icons', type: 'symbol', layout: { 'icon-image': 'dot' } }];
    expect(localiseStyle(style(layers), 'nl').layers).toEqual(layers);
  });

  it('survives a style that is not shaped like a style', () => {
    const broken = { version: 8 } as unknown as StyleSpecification;
    expect(localiseStyle(broken, 'nl')).toBe(broken);
  });
});

describe('firstLabelLayerId', () => {
  // Weather covers the whole country, so without this the map loses every place name
  // the moment a field layer comes up. The id it finds is what `beforeId` is given.
  it('names the first layer that draws place names', () => {
    const id = firstLabelLayerId(
      style([
        { id: 'water', type: 'fill' },
        { id: 'roads', type: 'line' },
        { id: 'place-town', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
        { id: 'place-city', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
      ])
    );
    expect(id).toBe('place-town');
  });

  it('ignores symbol layers that label something other than a name', () => {
    // Motorway shields carry `ref`, contours carry `ele`. Sliding the weather under a
    // shield layer would leave every town buried and only the road numbers on top.
    const id = firstLabelLayerId(
      style([
        { id: 'shields', type: 'symbol', layout: { 'text-field': ['get', 'ref'] } },
        { id: 'contours', type: 'symbol', layout: { 'text-field': '{ele}' } },
        { id: 'place', type: 'symbol', layout: { 'text-field': '{name:latin}' } },
      ])
    );
    expect(id).toBe('place');
  });

  it('has no answer for a style it was not given', () => {
    // A URL rather than an object, or a style that failed to load: `beforeId` then gets
    // undefined, which draws on top — the behaviour before any of this existed.
    expect(firstLabelLayerId(undefined)).toBeUndefined();
    expect(firstLabelLayerId('https://tiles.openfreemap.org/styles/bright')).toBeUndefined();
    expect(firstLabelLayerId(style([{ id: 'water', type: 'fill' }]))).toBeUndefined();
  });
});

describe('firstFeatureLayerId', () => {
  // With WEATHER_UNDER at 'features' the weather covers the landcover and nothing else:
  // water, roads and boundaries are drawn over it.
  it('names the first line or water layer, past the ground', () => {
    const id = firstFeatureLayerId(
      style([
        { id: 'background', type: 'background' },
        { id: 'landcover-grass', type: 'fill' },
        { id: 'landuse-residential', type: 'fill' },
        { id: 'waterway', type: 'line' },
        { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
        { id: 'road-motorway', type: 'line' },
      ])
    );
    expect(id).toBe('waterway');
  });

  it('finds a water fill where the style has no waterways above it', () => {
    const id = firstFeatureLayerId(
      style([
        { id: 'background', type: 'background' },
        { id: 'landcover', type: 'fill' },
        { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
        { id: 'roads', type: 'line' },
      ])
    );
    expect(id).toBe('water');
  });

  it('is not fooled into burying the weather under the landcover', () => {
    // A fill that is only ground has to be passed over, or the field ends up beneath the
    // grass and the map shows no weather at all.
    const id = firstFeatureLayerId(
      style([
        { id: 'park', type: 'fill' },
        { id: 'wood', type: 'fill' },
        { id: 'boundary', type: 'line' },
      ])
    );
    expect(id).toBe('boundary');
  });

  it('has no answer for a style it was not given', () => {
    expect(firstFeatureLayerId(undefined)).toBeUndefined();
    expect(firstFeatureLayerId('https://tiles.openfreemap.org/styles/fiord')).toBeUndefined();
  });
});

describe('sinkBuiltLayers', () => {
  /** An OpenMapTiles style in the order OpenFreeMap's Bright draws it. */
  const bright = () =>
    style([
      { id: 'background', type: 'background' },
      { id: 'landcover-grass', type: 'fill', 'source-layer': 'landcover' },
      { id: 'waterway', type: 'line', 'source-layer': 'waterway' },
      { id: 'water', type: 'fill', 'source-layer': 'water' },
      { id: 'building', type: 'fill', 'source-layer': 'building' },
      { id: 'tunnel-motorway', type: 'line', 'source-layer': 'transportation' },
      { id: 'road-primary', type: 'line', 'source-layer': 'transportation' },
      { id: 'bridge-motorway', type: 'line', 'source-layer': 'transportation' },
      { id: 'highway-name', type: 'symbol', 'source-layer': 'transportation_name',
        layout: { 'text-field': ['get', 'name'] } },
      { id: 'boundary-land', type: 'line', 'source-layer': 'boundary' },
      { id: 'water-name', type: 'symbol', 'source-layer': 'water_name',
        layout: { 'text-field': ['get', 'name'] } },
      { id: 'place-city', type: 'symbol', 'source-layer': 'place',
        layout: { 'text-field': ['get', 'name'] } },
    ]);

  const order = (s: ReturnType<typeof sinkBuiltLayers>) => s.layers.map((l) => l.id);

  it('puts the roads below the anchor and leaves the geography above it', () => {
    // The whole point of the 'geography' mode: no single insertion point can do this,
    // because the roads sit between the water and the boundaries in the draw order.
    const anchor = weatherBeforeLayerId(bright())!;
    expect(anchor).toBe('waterway');

    const out = order(sinkBuiltLayers(bright(), anchor));
    const at = (id: string) => out.indexOf(id);

    for (const road of ['building', 'tunnel-motorway', 'road-primary', 'bridge-motorway',
                        'highway-name']) {
      expect(at(road), road).toBeLessThan(at('waterway'));
    }
    for (const geography of ['water', 'boundary-land', 'water-name', 'place-city']) {
      expect(at(geography), geography).toBeGreaterThan(at('waterway'));
    }
  });

  it('keeps the roads stacked the way their author drew them', () => {
    // Casings under fills, bridges over tunnels: the road network's own order still has
    // to hold, or the map is subtly wrong wherever two roads cross.
    const out = order(sinkBuiltLayers(bright(), 'waterway'));
    const roads = out.filter((id) =>
      ['tunnel-motorway', 'road-primary', 'bridge-motorway'].includes(id));
    expect(roads).toEqual(['tunnel-motorway', 'road-primary', 'bridge-motorway']);
  });

  it('moves nothing that is already below the anchor', () => {
    const before = style([
      { id: 'road-early', type: 'line', 'source-layer': 'transportation' },
      { id: 'water', type: 'fill', 'source-layer': 'water' },
    ]);
    expect(order(sinkBuiltLayers(before, 'water'))).toEqual(['road-early', 'water']);
  });

  it('leaves a style alone when there is nothing to sink or nowhere to put it', () => {
    const plain = style([
      { id: 'water', type: 'fill', 'source-layer': 'water' },
      { id: 'place', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
    ]);
    expect(order(sinkBuiltLayers(plain, 'water'))).toEqual(['water', 'place']);
    expect(order(sinkBuiltLayers(bright(), undefined))).toEqual(order(bright()));
    expect(order(sinkBuiltLayers(bright(), 'no-such-layer'))).toEqual(order(bright()));
  });
});

describe('isBuiltLayer', () => {
  const layer = (l: Record<string, unknown>) =>
    isBuiltLayer(l as unknown as Parameters<typeof isBuiltLayer>[0]);

  it('knows the built world by its source layer first', () => {
    expect(layer({ id: 'anything', type: 'line', 'source-layer': 'transportation' })).toBe(true);
    expect(layer({ id: 'anything', type: 'fill', 'source-layer': 'building' })).toBe(true);
  });

  it('falls back to the layer id where a style names nothing', () => {
    expect(layer({ id: 'road-primary', type: 'line' })).toBe(true);
    expect(layer({ id: 'bridge-casing', type: 'line' })).toBe(true);
  });

  it('does not mistake the geography for the built world', () => {
    // These four are the ones the map keeps over the weather; sinking any of them by
    // accident is what this guards.
    for (const id of ['water', 'waterway', 'boundary-land', 'place-city', 'water-name',
                      'landcover-grass', 'park']) {
      expect(layer({ id, type: 'fill' }), id).toBe(false);
    }
  });
});
