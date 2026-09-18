/**
 * The threshold register, and the message packs that go with it.
 *
 * These are documentation tests in the literal sense: they fail when the app starts
 * claiming something it cannot show the provenance of. A boundary with no source, a
 * module that quietly holds its own copy of a number, a sentence that exists in Dutch
 * and nowhere else — each of those is a small lie, and each of them is cheap to catch
 * here and expensive to find in a field in April.
 */
import { describe, it, expect } from 'vitest';
import { SOURCES, THRESHOLDS, threshold, thresholdsOf, type ThresholdId } from '../core/thresholds';
import {
  SPRAY_WIND_MAX, SPRAY_DELTA_T_MIN, SPRAY_DELTA_T_MAX, FROST_BLOSSOM, TSUM_TARGET,
} from '../core/model/fieldAdvice';
import { SMITH } from '../core/model/smith';
import { deriveAlert } from '../core/model/alert';
import { DIV_HUMIDITY, DIV_RECENT_THRESHOLD } from '../core/model/cercospora';
import { LEAF_WET_HUMIDITY } from '../core/model/humidHours';
import { LADDER, SETTLED_HIGH, APPETITE_SHIFT } from '../core/riskLadder';
import { DEFAULT_WORK_LIMITS } from '../core/overviewData';
import { DEFAULT_ADVICE_LIMITS } from '../core/overviewAdvice';
import { ADVICE_STRINGS } from '../core/i18n/adviceStrings';
import { AGRO_INTEL_STRINGS } from '../core/i18n/agroIntelStrings';
import { DISEASE_STRINGS } from '../core/i18n/diseaseStrings';
import { LAYER_STRINGS } from '../core/i18n/layerStrings';
import { LANG_CODES, ta, type AppStringKey } from '../core/i18n';

const ids = Object.keys(THRESHOLDS) as ThresholdId[];

describe('every boundary says where it came from', () => {
  it('names a source that exists', () => {
    for (const id of ids) {
      expect(SOURCES[THRESHOLDS[id].source], `${id} cites an unknown source`).toBeDefined();
    }
  });

  it('carries a unit unless the figure is a count or a ratio', () => {
    for (const id of ids) {
      const spec = THRESHOLDS[id];
      // Only two figures are dimensionless on purpose: how many fields make a
      // pattern, and by what factor a rainfall spread is a spread.
      const dimensionless = id === 'area.sharedMin' || id === 'area.spreadRatio';
      expect(spec.unit === '', `${id}`).toBe(dimensionless);
      expect(Number.isFinite(spec.value), `${id} has no number`).toBe(true);
    }
  });

  it('says in one line what crossing it means', () => {
    for (const id of ids) {
      expect(THRESHOLDS[id].means.length, `${id} has no explanation`).toBeGreaterThan(10);
    }
  });

  it('keeps the legal ones apart from the ones this app chose', () => {
    // The two boundaries that are not ours to move, and the register knows it.
    expect(THRESHOLDS['spray.wind'].basis).toBe('legal');
    expect(THRESHOLDS['fertilise.frozen'].basis).toBe('legal');
    // And Smith is published, not practice: implementing it faithfully is the job.
    for (const t of thresholdsOf('smith')) expect(t.basis).toBe('published');
  });

  it('can be looked up: a legal or published boundary links to its text', () => {
    // The point of the distinction is that the reader can go and check. A boundary
    // that claims a law or a paper and then cannot say where it is has claimed
    // nothing. Practice and this app's own choices have no document to link to,
    // which is exactly what those two words mean.
    for (const id of ids) {
      const spec = THRESHOLDS[id];
      if (spec.basis !== 'legal' && spec.basis !== 'published') continue;
      const source = SOURCES[spec.source];
      expect(source.url, `${id} claims ${spec.basis} but cites no document`).toBeTruthy();
      expect(source.url?.startsWith('https://'), `${id} source is not a link`).toBe(true);
    }
  });

  it('says out loud where a published source and this app disagree', () => {
    // Two figures deviate from the publication they cite, both deliberately, both
    // towards caution. Each keeps `app` as its basis and says so in the source's
    // caveat, so nobody reads them as the published number.
    expect(THRESHOLDS['leafWet.humidity'].basis).toBe('app');
    expect(SOURCES['sentelhas-2008'].caveat).toContain('95');
    expect(SOURCES['bal-gewasbescherming'].caveat).toContain('tien meter');
  });

  it('marks the app own choices, so they can be found and argued with', () => {
    const app = ids.filter((id) => THRESHOLDS[id].basis === 'app');
    expect(app.length).toBeGreaterThan(10);
    // The overview page's work window is this app's own judgement, and the widget
    // that draws it is in a layer precisely because of that.
    expect(THRESHOLDS['workWindow.wind'].basis).toBe('app');
  });
});

describe('the modules read the register, not their own copy', () => {
  it('feeds the field families', () => {
    expect(SPRAY_WIND_MAX).toBe(threshold('spray.wind'));
    expect(SPRAY_DELTA_T_MIN).toBe(2);
    expect(SPRAY_DELTA_T_MAX).toBe(8);
    expect(FROST_BLOSSOM).toBe(-2);
    expect(TSUM_TARGET).toBe(180);
  });

  it('feeds the oldest model in the app, which kept its own numbers longest', () => {
    // `alert.ts` held literal 60s and 75s until the register existed. It reads them
    // now, so the figures the significant-weather block fires on are the same ones
    // the documentation prints.
    expect(threshold('alert.gust')).toBe(60);
    expect(threshold('alert.gustHeavy')).toBe(75);
    expect(threshold('alert.window')).toBe(12);
    expect(deriveAlert(null, null)).toBeNull();
  });

  it('feeds the disease models, whose numbers are somebody else published work', () => {
    expect(SMITH).toEqual({ humidity: 90, hoursPerDay: 11, minTemp: 10, days: 2 });
    expect(DIV_HUMIDITY).toBe(threshold('cercospora.humidity'));
    expect(DIV_RECENT_THRESHOLD).toBe(6);
    expect(LEAF_WET_HUMIDITY).toBe(95);
  });

  it('feeds the ladder, and the shift the reader appetite makes to it', () => {
    expect(LADDER).toEqual({ watch: 30, prepare: 60, act: 85 });
    expect(SETTLED_HIGH).toBe(85);
    expect(APPETITE_SHIFT.cautious).toBe(-threshold('risk.appetiteShift'));
    expect(APPETITE_SHIFT.patient).toBe(threshold('risk.appetiteShift'));
  });

  it('feeds the overview page own judgements', () => {
    expect(DEFAULT_WORK_LIMITS).toEqual({ wetMm: 0.1, windKmh: 20, minTempC: 1 });
    expect(DEFAULT_ADVICE_LIMITS.soakedMm).toBe(threshold('attention.soaked'));
    // The work window's wind is *not* the spraying limit: one is this app's own
    // figure for machine work, the other is law. Keeping them apart is the point.
    expect(DEFAULT_WORK_LIMITS.windKmh).not.toBe(SPRAY_WIND_MAX);
  });

  it('groups a model own boundaries for the documentation to print', () => {
    expect(thresholdsOf('spray').map((t) => t.id)).toContain('spray.wind');
    expect(thresholdsOf('spray').every((t) => t.model === 'spray')).toBe(true);
  });
});

describe('a language file per model', () => {
  const packs = {
    advice: ADVICE_STRINGS,
    agroIntel: AGRO_INTEL_STRINGS,
    disease: DISEASE_STRINGS,
    layer: LAYER_STRINGS,
  };

  it('speaks every language the app does, with no key missing in one of them', () => {
    for (const [name, pack] of Object.entries(packs)) {
      const dutch = Object.keys(pack.nl);
      expect(dutch.length, `${name} is empty`).toBeGreaterThan(5);
      for (const lang of LANG_CODES) {
        const keys = Object.keys(pack[lang]);
        expect(keys.sort(), `${name} · ${lang}`).toEqual([...dutch].sort());
      }
    }
  });

  it('reaches the reader through the same accessor as everything else', () => {
    // The split is a filing decision, not an interface one: `ta` still answers.
    for (const lang of LANG_CODES) {
      expect(ta('adviceSprayShut' as AppStringKey, lang).length).toBeGreaterThan(3);
      expect(ta('riskAct' as AppStringKey, lang).length).toBeGreaterThan(1);
      expect(ta('smithTitle' as AppStringKey, lang)).toContain('Smith');
      expect(ta('basisLayer' as AppStringKey, lang).length).toBeGreaterThan(3);
    }
  });

  it('keeps the blanks a sentence promises', () => {
    // A template whose placeholders differ between languages loses a value in one of
    // them, silently — `Sentence` prints nothing for a blank it has no value for.
    const templates: AppStringKey[] = [
      'areaShared', 'areaCommonWindow', 'areaNoCommonWindow', 'areaOrder', 'areaSpread',
      'riskMembers',
    ] as AppStringKey[];
    for (const key of templates) {
      const blanks = (s: string) => (s.match(/\{[a-zA-Z0-9]+\}/g) ?? []).sort();
      const dutch = blanks(ta(key, 'nl'));
      for (const lang of LANG_CODES) {
        expect(blanks(ta(key, lang)), `${key} · ${lang}`).toEqual(dutch);
      }
    }
  });
});
