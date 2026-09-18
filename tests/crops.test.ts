/**
 * Which crops a location speaks for.
 *
 * The shape matters more than the values here: a soil sensor sits in one field and a
 * weather pole stands over several, so the answer is a list from the start. Retrofitting
 * that later touches every model, card and stored preference.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_STATION_CROPS, cropsFor } from '../core/model/crops';

describe('crops per location', () => {
  it('takes a soil sensor at its word, and asks nothing further', () => {
    // The grower already told the web app what is in this field. There is nothing to
    // configure and no way for the app's idea of it to drift from theirs.
    expect(cropsFor({ sensorCrop: 'Aardappel', hasStation: true }))
      .toEqual({ crops: ['Aardappel'], source: 'sensor' });
  });

  it('gives a weather station the three the app has models for, and marks it assumed', () => {
    const out = cropsFor({ hasStation: true });
    expect(out.crops).toEqual([...DEFAULT_STATION_CROPS]);
    // An assumption is not a statement, and the page has to be able to say which it is.
    expect(out.source).toBe('assumed');
  });

  it('prefers what the reader set over what the app assumed', () => {
    expect(cropsFor({ hasStation: true, profileCrops: ['Ui'] }))
      .toEqual({ crops: ['Ui'], source: 'profile' });
  });

  it('lets a sensor overrule even the reader, on its own field', () => {
    // The wizard answers for a region; the sensor answers for this ground.
    expect(cropsFor({ sensorCrop: 'Suikerbiet', profileCrops: ['Ui'] }).crops)
      .toEqual(['Suikerbiet']);
  });

  it('grows nothing where nothing is known', () => {
    // A model over an unknown crop is a guess wearing a name, so a plain place draws
    // no disease cards at all.
    expect(cropsFor({}).crops).toEqual([]);
  });

  it('ignores blanks rather than treating them as a crop', () => {
    expect(cropsFor({ sensorCrop: '   ', hasStation: true }).source).toBe('assumed');
    expect(cropsFor({ profileCrops: ['', '  '], hasStation: true }).source).toBe('assumed');
  });
});
