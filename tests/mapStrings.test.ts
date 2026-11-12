import { describe, expect, it } from 'vitest';
import { MAP_STRINGS } from '../core/i18n/mapStrings';
import { APP_STRINGS } from '../core/i18n/appStrings';
import { LANG_CODES } from '../core/i18n/strings';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('map strings', () => {
  const nl = MAP_STRINGS.nl as Record<string, string>;

  it.each(LANG_CODES)('%s has every key Dutch has, and no others', (lang) => {
    const pack = MAP_STRINGS[lang] as Record<string, string>;
    expect(Object.keys(pack).sort()).toEqual(Object.keys(nl).sort());
    for (const v of Object.values(pack)) expect(v.trim()).not.toBe('');
  });

  it.each(LANG_CODES)('%s keeps the placeholders the caller fills in', (lang) => {
    const pack = MAP_STRINGS[lang] as Record<string, string>;
    for (const key of Object.keys(nl)) {
      expect(placeholders(pack[key]!), key).toEqual(placeholders(nl[key]!));
    }
  });

  it.each(LANG_CODES)('%s reaches the app through ta()', (lang) => {
    const pack = APP_STRINGS[lang] as Record<string, string>;
    expect(pack.mapZoomIn).toBe(MAP_STRINGS[lang].mapZoomIn);
  });
});
