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
  firstFeatureLayerId, firstLabelLayerId, LABEL_STYLE, localiseStyle, restyleLabels,
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

describe('restyleLabels', () => {
  const paint = (s: ReturnType<typeof restyleLabels>, id: string): Record<string, unknown> =>
    ((s.layers.find((l) => l.id === id) as { paint?: Record<string, unknown> })?.paint ?? {});

  it('gives every name the same ink and halo', () => {
    const out = restyleLabels(
      style([
        { id: 'place', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
        { id: 'water-name', type: 'symbol', layout: { 'text-field': '{name:latin}' } },
      ]),
      'dark'
    );
    for (const id of ['place', 'water-name']) {
      expect(paint(out, id)['text-color']).toBe(LABEL_STYLE.dark.ink);
      expect(paint(out, id)['text-halo-color']).toBe(LABEL_STYLE.dark.halo);
    }
  });

  it('overwrites an expression the basemap author wrote', () => {
    // A colour that shifts with zoom is exactly what has to go: one ink for every name,
    // whatever the weather underneath is doing.
    const out = restyleLabels(
      style([
        {
          id: 'place',
          type: 'symbol',
          layout: { 'text-field': ['get', 'name'] },
          paint: { 'text-color': ['interpolate', ['linear'], ['zoom'], 5, '#fff', 10, '#000'] },
        },
      ]),
      'light'
    );
    expect(paint(out, 'place')['text-color']).toBe(LABEL_STYLE.light.ink);
  });

  it('leaves alone what is not a name', () => {
    // Motorway shields have their own colours and are legible as they are; repainting
    // them navy on white would make every road number look like a town.
    const out = restyleLabels(
      style([
        { id: 'shields', type: 'symbol', layout: { 'text-field': ['get', 'ref'] },
          paint: { 'text-color': '#ffffff' } },
        { id: 'roads', type: 'line', paint: { 'line-color': '#cccccc' } },
      ]),
      'dark'
    );
    expect(paint(out, 'shields')['text-color']).toBe('#ffffff');
    expect(paint(out, 'roads')['line-color']).toBe('#cccccc');
  });

  it('keeps the text itself untouched', () => {
    const layers = [{ id: 'place', type: 'symbol', layout: { 'text-field': ['get', 'name:nl'] } }];
    const out = restyleLabels(style(layers), 'dark');
    expect((out.layers[0] as { layout?: Record<string, unknown> }).layout?.['text-field'])
      .toEqual(['get', 'name:nl']);
  });
});
