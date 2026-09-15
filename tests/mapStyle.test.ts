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
  COASTLINE_LAYER_ID, coastlineLayer, isBoundaryLayer, isBuiltLayer, isGroundLayer,
  isLabelLayer, isWaterLayer, localiseStyle, orderForWeather, WEATHER_UNDER,
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
    // These four are what the map keeps over the weather; mistaking any of them for a
    // road is what would quietly sink the country's outline.
    for (const id of ['water', 'waterway', 'boundary-land', 'place-city']) {
      expect(isBuiltLayer(find(id)), id).toBe(false);
    }
  });

  it('knows water, boundaries, names and ground apart', () => {
    expect(isWaterLayer(find('water'))).toBe(true);
    expect(isWaterLayer(find('waterway'))).toBe(true);
    // A lake's name is a label, not water: it belongs with the other names.
    expect(isWaterLayer(find('water-name'))).toBe(false);

    expect(isBoundaryLayer(find('boundary-land'))).toBe(true);
    expect(isBoundaryLayer(find('road-primary'))).toBe(false);

    expect(isLabelLayer(find('place-city'))).toBe(true);
    expect(isLabelLayer(find('water'))).toBe(false);

    expect(isGroundLayer(find('background'))).toBe(true);
    expect(isGroundLayer(find('landcover-grass'))).toBe(true);
    expect(isGroundLayer(find('park'))).toBe(true);
    expect(isGroundLayer(find('water'))).toBe(false);
  });

  it('falls back to the layer id where a style names no source', () => {
    const plain = (id: string, type = 'line') =>
      ({ id, type } as unknown as Parameters<typeof isBuiltLayer>[0]);
    expect(isBuiltLayer(plain('road-primary'))).toBe(true);
    expect(isWaterLayer(plain('river-outline'))).toBe(true);
    expect(isBoundaryLayer(plain('admin-0'))).toBe(true);
  });
});

describe('orderForWeather', () => {
  // The suite pins the mode the app actually ships, so a flip of the constant is a
  // deliberate act that shows up here rather than a silent change of the map.
  it('is set to the mode this build draws', () => {
    expect(WEATHER_UNDER).toBe('coast');
  });

  it('keeps only the coastline, the boundaries and the names over the weather', () => {
    const out = orderForWeather(bright());
    const seam = ids(out).indexOf(weatherBeforeLayerId(out)!);
    const at = (id: string) => ids(out).indexOf(id);

    for (const over of [COASTLINE_LAYER_ID, 'boundary-land', 'water-name', 'place-city']) {
      expect(at(over), over).toBeGreaterThanOrEqual(seam);
    }
    // The water areas go under with the roads, which is the whole point of this mode:
    // the field runs across the IJsselmeer as one surface.
    for (const under of ['water', 'waterway', 'road-primary', 'building', 'highway-name',
                         'landcover-grass']) {
      expect(at(under), under).toBeLessThan(seam);
    }
  });

  it('draws the coastline back on, in the water’s own colour', () => {
    const out = orderForWeather(bright());
    const coast = out.layers.find((l) => l.id === COASTLINE_LAYER_ID) as
      | { type: string; paint?: Record<string, unknown>; 'source-layer'?: string }
      | undefined;
    expect(coast?.type).toBe('line');
    expect(coast?.['source-layer']).toBe('water');
    // Lifted from the fill it traces, so the line belongs to the basemap it came from
    // and follows the appearance without being told which one is on.
    expect(coast?.paint?.['line-color']).toBe('#a0c8f0');
  });

  it('keeps each group stacked the way its author drew it', () => {
    // Casings under fills, bridges over tunnels: the road network's own order still has
    // to hold, or the map is subtly wrong wherever two roads cross.
    const out = ids(orderForWeather(bright()));
    expect(out.filter((id) => id.includes('motorway') || id === 'road-primary')).toEqual([
      'tunnel-motorway', 'road-primary', 'bridge-motorway',
    ]);
    expect(out.indexOf('boundary-land')).toBeLessThan(out.indexOf('place-city'));
  });

  it('loses no layer and invents only the coastline', () => {
    const before = ids(bright());
    const after = ids(orderForWeather(bright()));
    expect(after.filter((id) => id !== COASTLINE_LAYER_ID).sort()).toEqual([...before].sort());
  });

  it('leaves a style it cannot place alone', () => {
    const ground = style([{ id: 'background', type: 'background' }]);
    expect(ids(orderForWeather(ground))).toEqual(['background']);
    expect(weatherBeforeLayerId(undefined)).toBeUndefined();
    expect(weatherBeforeLayerId('https://tiles.openfreemap.org/styles/bright')).toBeUndefined();
  });

  it('has no coastline to draw where the style has no water fill', () => {
    expect(coastlineLayer(style([{ id: 'roads', type: 'line' }]))).toBeNull();
  });
});
