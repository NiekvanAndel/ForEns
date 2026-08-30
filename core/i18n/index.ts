/**
 * Translation accessors.
 *
 * Ported from index.html (`t`, `tDays`, `tWmo`). Dutch is the fallback for any key
 * or language that is missing, which is also the design system's primary language.
 */
import { LANG, LANG_CODES, type LangCode, type LangStrings } from './strings';

export { LANG, LANG_CODES };
export type { LangCode, LangStrings };
export * from './units';

function pack(lang: LangCode): LangStrings {
  return LANG[lang] ?? LANG.nl;
}

/** A UI string, falling back to Dutch and then to the key itself. */
export function t(key: string, lang: LangCode): string {
  const v = pack(lang)[key];
  if (typeof v === 'string') return v;
  const nl = LANG.nl[key];
  return typeof nl === 'string' ? nl : key;
}

/** Weekday names, Sunday first, matching JavaScript's `getDay()`. */
export function dayNames(lang: LangCode): string[] {
  return pack(lang).dayNames ?? LANG.nl.dayNames;
}

/** Human description of a WMO weather code. */
export function wmoText(code: number, lang: LangCode): string {
  const p = pack(lang);
  return p.wmo[code] ?? p.unknown;
}

/** Build a translator bound to one language, for components that render many strings. */
export function translator(lang: LangCode) {
  return {
    t: (key: string) => t(key, lang),
    days: () => dayNames(lang),
    wmo: (code: number) => wmoText(code, lang),
  };
}

/** Resolve a device locale (e.g. "nl-NL", "de") to a supported language. */
export function resolveLang(locale: string | null | undefined): LangCode {
  if (!locale) return 'nl';
  const base = locale.toLowerCase().split(/[-_]/)[0] as LangCode;
  return LANG_CODES.includes(base) ? base : 'nl';
}
