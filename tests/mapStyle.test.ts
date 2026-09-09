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
import { localiseStyle } from '../ui/radar/mapStyle';

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
