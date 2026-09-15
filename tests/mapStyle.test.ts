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
  bandOf, COASTLINE_LAYER_ID, coastlineLayer, isBoundaryLayer, isBuiltLayer, isLabelLayer,
  isWaterLayer, LAYER_DEPTH, localiseStyle, orderForWeather, weatherBeforeLayerId,
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

// ── Where the weather sits among the basemap's layers ───────────────────────────

/** An OpenMapTiles style in the order OpenFreeMap's Bright draws it. */
const bright = () =>
  style([
    { id: 'background', type: 'background' },
    { id: 'landcover-grass', type: 'fill', 'source-layer': 'landcover' },
    { id: 'park', type: 'fill', 'source-layer': 'park' },
    { id: 'waterway', type: 'line', 'source-layer': 'waterway' },
    { id: 'water', type: 'fill', 'source-layer': 'water', source: 'openmaptiles',
      paint: { 'fill-color': '#a0c8f0' } },
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

const ids = (s: StyleSpecification) => s.layers.map((l) => l.id);

describe('classifying a basemap layer', () => {
  const find = (id: string) => bright().layers.find((l) => l.id === id)!;

  it('tells the built world from the geography', () => {
    for (const id of ['building', 'road-primary', 'bridge-motorway', 'highway-name']) {
      expect(isBuiltLayer(find(id)), id).toBe(true);
    }
    // These are what the map keeps over the weather; mistaking any of them for a road is
    // what would quietly sink the country's outline.
    for (const id of ['water', 'waterway', 'boundary-land', 'place-city']) {
      expect(isBuiltLayer(find(id)), id).toBe(false);
    }
  });

  it('knows water, boundaries and names apart', () => {
    expect(isWaterLayer(find('water'))).toBe(true);
    expect(isWaterLayer(find('waterway'))).toBe(true);
    // A lake's name is a label, not water: it belongs with the other names.
    expect(isWaterLayer(find('water-name'))).toBe(false);
    expect(isBoundaryLayer(find('boundary-land'))).toBe(true);
    expect(isBoundaryLayer(find('road-primary'))).toBe(false);
    expect(isLabelLayer(find('place-city'))).toBe(true);
    expect(isLabelLayer(find('water'))).toBe(false);
  });

  it('consults the layer id as well as the source, not instead of it', () => {
    // A style that files its roads under a source this app has never heard of still
    // names them something road-shaped. Trusting only the source is what leaves the
    // motorways painted over the weather.
    const odd = { id: 'road-primary', type: 'line', 'source-layer': 'mystery' };
    expect(isBuiltLayer(odd as unknown as Parameters<typeof isBuiltLayer>[0])).toBe(true);
  });

  it('bands the ground and the built world together, at the bottom', () => {
    expect(bandOf(find('background'))).toBe(0);
    expect(bandOf(find('landcover-grass'))).toBe(0);
    expect(bandOf(find('road-primary'))).toBe(0);
    expect(bandOf(find('highway-name'))).toBe(0);
    expect(bandOf(find('water'))).toBe(1);
    expect(bandOf(find('boundary-land'))).toBe(2);
    expect(bandOf(find('place-city'))).toBe(2);
  });
});

describe('orderForWeather', () => {
  const bandsOf = (s: StyleSpecification) =>
    s.layers.filter((l) => l.id !== COASTLINE_LAYER_ID).map((l) => bandOf(l));

  it('sorts the style into three bands, each keeping its own order', () => {
    const out = orderForWeather(bright());
    expect(bandsOf(out)).toEqual([...bandsOf(out)].sort());
    // Casings under fills, bridges over tunnels: each band still stacks the way its
    // author drew it, or the map is subtly wrong wherever two roads cross.
    const order = ids(out);
    expect(order.filter((id) => id.includes('motorway') || id === 'road-primary')).toEqual([
      'tunnel-motorway', 'road-primary', 'bridge-motorway',
    ]);
    expect(order.indexOf('boundary-land')).toBeLessThan(order.indexOf('place-city'));
  });

  it('draws the coastline back on, in the water’s own colour', () => {
    const coast = orderForWeather(bright()).layers.find((l) => l.id === COASTLINE_LAYER_ID) as
      | { type: string; paint?: Record<string, unknown>; 'source-layer'?: string }
      | undefined;
    expect(coast?.type).toBe('line');
    expect(coast?.['source-layer']).toBe('water');
    // Lifted from the fill it traces, so the line belongs to the basemap it came from.
    expect(coast?.paint?.['line-color']).toBe('#a0c8f0');
  });

  it('loses no layer and invents only the coastline', () => {
    const before = ids(bright());
    const after = ids(orderForWeather(bright()));
    expect(after.filter((id) => id !== COASTLINE_LAYER_ID).sort()).toEqual([...before].sort());
  });

  it('is idempotent, which is the bug that shipped once', () => {
    // An earlier version found its insertion point by position — the first line layer —
    // and its own reordering changed what that was: the roads slid below the water,
    // became the first line layer themselves, and the weather went in beneath them.
    // Roads over the weather, which is what the mode existed to prevent.
    const once = orderForWeather(bright());
    const twice = orderForWeather(once);
    expect(ids(twice)).toEqual(ids(once));
    for (const depth of ['geography', 'coast'] as const) {
      expect(weatherBeforeLayerId(twice, depth)).toBe(weatherBeforeLayerId(once, depth));
    }
  });
});

describe('weatherBeforeLayerId', () => {
  const seamFor = (depth: 'geography' | 'coast') => {
    const out = orderForWeather(bright());
    const order = ids(out);
    return { order, seam: order.indexOf(weatherBeforeLayerId(out, depth)!) };
  };

  it('puts a field under the water and over the roads', () => {
    const { order, seam } = seamFor('geography');
    const at = (id: string) => order.indexOf(id);
    for (const over of ['water', 'waterway', COASTLINE_LAYER_ID, 'boundary-land', 'place-city']) {
      expect(at(over), over).toBeGreaterThanOrEqual(seam);
    }
    for (const under of ['road-primary', 'building', 'highway-name', 'landcover-grass']) {
      expect(at(under), under).toBeLessThan(seam);
    }
  });

  it('puts the nowcast over the water, under the coastline and the names', () => {
    const { order, seam } = seamFor('coast');
    const at = (id: string) => order.indexOf(id);
    for (const over of [COASTLINE_LAYER_ID, 'boundary-land', 'water-name', 'place-city']) {
      expect(at(over), over).toBeGreaterThanOrEqual(seam);
    }
    for (const under of ['water', 'waterway', 'road-primary', 'landcover-grass']) {
      expect(at(under), under).toBeLessThan(seam);
    }
  });

  it('is the shipped arrangement: rain over the water, fields under it', () => {
    expect(LAYER_DEPTH.nowcast).toBe('coast');
    expect(LAYER_DEPTH.field).toBe('geography');
    expect(LAYER_DEPTH.cumulative).toBe('geography');
  });

  it('never leaves the weather over the names, whatever the style is missing', () => {
    // No water at all: a field has nothing to slide under, and must still land below the
    // labels rather than on top of them.
    const dry = orderForWeather(
      style([
        { id: 'landcover', type: 'fill', 'source-layer': 'landcover' },
        { id: 'place', type: 'symbol', 'source-layer': 'place',
          layout: { 'text-field': ['get', 'name'] } },
      ])
    );
    expect(weatherBeforeLayerId(dry, 'geography')).toBe('place');
    expect(weatherBeforeLayerId(dry, 'coast')).toBe('place');
  });

  it('has no answer for a style it was not given', () => {
    expect(weatherBeforeLayerId(undefined, 'coast')).toBeUndefined();
    expect(weatherBeforeLayerId('https://tiles.openfreemap.org/styles/bright', 'geography'))
      .toBeUndefined();
  });

  it('has no coastline to draw where the style has no water fill', () => {
    expect(coastlineLayer(style([{ id: 'roads', type: 'line' }]))).toBeNull();
  });
});
