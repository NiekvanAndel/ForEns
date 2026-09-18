/**
 * Every boundary the app decides anything on, in one table — with where the number
 * came from.
 *
 * The app now carries about fifty of them, spread over ten modules, and each one was
 * defensible where it sat. Together they were not readable: nobody could answer "what
 * does this app claim, and on whose authority" without opening ten files, and a
 * grower who disagrees with a figure had nothing to disagree *with*. So the numbers
 * live here, each with its provenance, and the modules read them.
 *
 * ## The modules keep their names
 *
 * `fieldAdvice` still exports `SPRAY_WIND_MAX`; it is an alias of `value('spray.wind')`
 * now rather than a literal. That keeps every call site and every test as it was, and
 * means this file cannot drift from the code that uses it: there is one number, and
 * the alias is the only way to reach it.
 *
 * ## `basis` is the part that matters
 *
 * It says how much weight a figure carries, and it is the difference between a
 * boundary a grower can look up and one this app chose:
 *
 *  - **legal** — written in Dutch or European rule. Not ours to move.
 *  - **published** — from a named model or institute: Smith, the IRS DIV table, KNMI's
 *    warning practice. Ours to implement faithfully and not to tune.
 *  - **practice** — the figure a Dutch grower or adviser would recognise, without one
 *    publication behind it. Defensible, arguable, and worth arguing about.
 *  - **app** — this app's own choice, usually a bar under which a sentence stays
 *    quiet. These are the first ones to revisit, and they are marked so they can be
 *    found.
 *  - **api** — per field, from AgroExact. Not in this table at all beyond a note: the
 *    values differ per placement and belong to the grower's own configuration.
 *
 * Anything marked `app` is a first draft by definition. That is not an apology — a
 * threshold nobody can see is worse than one somebody can argue with.
 */

/** Who or what a number rests on. See the module comment. */
export type ThresholdBasis = 'legal' | 'published' | 'practice' | 'app';

/** The models that own thresholds. One id per thing that makes a statement. */
export type ModelId =
  /** Significant weather — the block on 'Nu' and the oldest notifications. */
  | 'alert'
  /** The four rule-based field families. */
  | 'spray' | 'frost' | 'workability' | 'fertilise'
  /** The disease models. */
  | 'smith' | 'cercospora' | 'leafWet'
  /** The overview page's own judgements. */
  | 'workWindow' | 'attention' | 'brief'
  /** AgroIntelligence. */
  | 'area' | 'risk';

export type SourceKey =
  | 'knmi-warnings'
  | 'activiteitenbesluit'
  | 'deltaT-practice'
  | 'rainfast-practice'
  | 'inversion-practice'
  | 'frost-practice'
  | 'blossom-practice'
  | 'wetbulb-irrigation'
  | 'balance-practice'
  | 'mowing-practice'
  | 'deficit-practice'
  | 'fertiliser-decree'
  | 'ammonia-practice'
  | 'leaching-practice'
  | 'tsum-practice'
  | 'smith-1956'
  | 'irs-div'
  | 'leafwet-proxy'
  | 'app-choice'
  | 'ladder-plan';

export interface Source {
  /** What to cite, as a reader would look it up. */
  title: string;
  /** Where it is to be found, or who holds it. */
  where: string;
  /** What still has to be checked against the primary text, where anything does. */
  caveat?: string;
}

/**
 * Where each figure comes from, as a reader would go and check it.
 *
 * Deliberately naming the *kind* of source rather than pretending to a citation the
 * app does not have: three of these are practice rather than publication, and saying
 * so is the honest version of a bibliography.
 */
export const SOURCES: Record<SourceKey, Source> = {
  'knmi-warnings': {
    title: 'KNMI — waarschuwingscriteria (code geel)',
    where: 'knmi.nl/kennis-en-datacentrum/uitleg/waarschuwingen',
    caveat: 'De app waarschuwt één stap ónder code geel: dit is "wetenswaardig", geen weerwaarschuwing.',
  },
  'activiteitenbesluit': {
    title: 'Activiteitenbesluit milieubeheer, art. 3.78a — spuiten bij windsnelheid boven 5 m/s',
    where: 'wetten.overheid.nl, Activiteitenbesluit milieubeheer',
    caveat: 'Wettelijke grens. Per gewasbeschermingsmiddel kan het etiket strenger zijn; het etiket wint.',
  },
  'deltaT-practice': {
    title: 'Delta T 2–8 °C als spuitvenster',
    where: 'Australische GRDC/NUFARM-praktijkrichtlijn, in NL overgenomen door adviesdiensten',
    caveat: 'Praktijkrichtlijn, geen wet. Buiten 2–8 is het middel- en doptype bepalend.',
  },
  'rainfast-practice': { title: 'Regenvastheid: twee uur droog na toepassing', where: 'Middeletiketten en teeltadvies; varieert per middel' },
  'inversion-practice': { title: 'Inversie bij windstilte in de nacht', where: 'Praktijkregel uit driftonderzoek; de app leidt het af, meet het niet' },
  'frost-practice': { title: 'Grondvorst bij 2 °C op 1,50 m', where: 'Vuistregel uit de tuinbouw- en fruitteeltpraktijk' },
  'blossom-practice': { title: 'Bloesemvorst vanaf −2 °C', where: 'Fruitteeltpraktijk; de schadegrens verschilt per gewasstadium' },
  'wetbulb-irrigation': {
    title: 'Vorstberegening en de natboltemperatuur',
    where: 'Fruitteeltpraktijk; onder circa −5 °C natbol kost beregenen meer warmte dan het geeft',
  },
  'balance-practice': { title: 'Berijdbaarheid uit een neerslag-verdampingsbalans', where: 'Eigen benadering; een echte meting is de bodemsensor' },
  'mowing-practice': { title: 'Maaivenster: drie droge dagen', where: 'Ruwvoerpraktijk' },
  'deficit-practice': { title: 'Neerslagtekort als maat voor droogte', where: 'KNMI/Meteobase rekenen het landelijk op dezelfde manier: verdamping minus neerslag' },
  'fertiliser-decree': {
    title: 'Besluit gebruik meststoffen — verbod op bevroren of besneeuwde grond',
    where: 'wetten.overheid.nl, Besluit gebruik meststoffen',
    caveat: 'Wettelijk verbod. De app leidt "bevroren" af uit de luchttemperatuur, niet uit een bodemmeting.',
  },
  'ammonia-practice': { title: 'Ammoniakemissie bij warm en droog uitrijden', where: 'WUR-emissieonderzoek; de app gebruikt de vuistregel, niet het model' },
  'leaching-practice': { title: 'Uitspoeling bij zware neerslag kort na bemesting', where: 'Bemestingsadvies; het getal hangt van grondsoort af' },
  'tsum-practice': { title: 'T-som 180 voor de eerste stikstofgift op gras', where: 'Nederlands bemestingsadvies grasland (T-som-regel)' },
  'smith-1956': { title: 'Smith-periode: 2 dagen met ≥11 uur ≥90% RV en minimum ≥10 °C', where: 'Smith (1956), Beaumont-varianten; in NL breed gebruikt voor Phytophthora' },
  'irs-div': {
    title: 'Cercospora-DIV — daily infection values',
    where: 'IRS; de tabel in de app is de gangbare reproductie',
    caveat: 'Nog niet tegen de IRS-publicatie gelegd. Een tabel die te laag scoort vertelt een teler dat zijn biet veilig is.',
  },
  'leafwet-proxy': { title: 'Bladnat als proxy: RV ≥ 95% of neerslag in het laatste uur', where: 'Eigen proxy; gelabeld als proxy omdat de sensor het niet meet' },
  'app-choice': { title: 'Eigen keuze van deze app', where: 'Meestal een bar waaronder een zin zwijgt — bedoeld om over te twisten' },
  'ladder-plan': { title: 'Escalatieladder 30 / 60 / 85 %', where: 'ExactCast agro-voorstel, blad 2 §4B' },
};

export interface ThresholdSpec {
  /** Which model reads it. */
  model: ModelId;
  value: number;
  /** The app's own canonical unit — never the reader's. */
  unit: 'km/h' | '°C' | 'mm' | '%' | 'h' | 'd' | '°C·d' | 'DIV' | '';
  basis: ThresholdBasis;
  source: SourceKey;
  /** What crossing it means, in one line. Documentation, never shown to a reader. */
  means: string;
}

/**
 * The table. Ids read `model.what`, and nothing outside this file invents one.
 *
 * Ordered by model, and within a model the way the rules are tried: the order a
 * reader would want to check them in is the order the code tries them in.
 */
export const THRESHOLDS = {
  // ── Significant weather ────────────────────────────────────────────────────
  'alert.gust': { model: 'alert', value: 60, unit: 'km/h', basis: 'published', source: 'knmi-warnings', means: 'Wind worth knowing about; KNMI issues code yellow at 75.' },
  'alert.gustHeavy': { model: 'alert', value: 75, unit: 'km/h', basis: 'published', source: 'knmi-warnings', means: 'Code-yellow gust: damage to trees and loose objects.' },
  'alert.rain': { model: 'alert', value: 1, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Rain over the 12-hour window worth a block.' },
  'alert.rainHeavy': { model: 'alert', value: 5, unit: 'mm', basis: 'app', source: 'app-choice', means: 'A downpour rather than a shower.' },
  'alert.frost': { model: 'alert', value: 0, unit: '°C', basis: 'published', source: 'knmi-warnings', means: 'Air frost: slippery roads, damage to plants.' },
  'alert.heat': { model: 'alert', value: 30, unit: '°C', basis: 'published', source: 'knmi-warnings', means: 'Heat worth naming. Never notifies — a block only.' },
  'alert.window': { model: 'alert', value: 12, unit: 'h', basis: 'app', source: 'app-choice', means: 'How far ahead the block looks.' },

  // ── Spraying ───────────────────────────────────────────────────────────────
  'spray.wind': { model: 'spray', value: 18, unit: 'km/h', basis: 'legal', source: 'activiteitenbesluit', means: '5 m/s: above it spraying is not permitted.' },
  'spray.tempMin': { model: 'spray', value: 1, unit: '°C', basis: 'practice', source: 'deltaT-practice', means: 'Too cold to spray.' },
  'spray.tempMax': { model: 'spray', value: 25, unit: '°C', basis: 'practice', source: 'deltaT-practice', means: 'Too warm: evaporation and scorch.' },
  'spray.deltaTMin': { model: 'spray', value: 2, unit: '°C', basis: 'practice', source: 'deltaT-practice', means: 'Below it the droplets hang and drift.' },
  'spray.deltaTMax': { model: 'spray', value: 8, unit: '°C', basis: 'practice', source: 'deltaT-practice', means: 'Above it they evaporate before the leaf.' },
  'spray.rainfastMm': { model: 'spray', value: 0.2, unit: 'mm', basis: 'practice', source: 'rainfast-practice', means: 'Rain inside the rainfast window that washes it off.' },
  'spray.rainfastH': { model: 'spray', value: 2, unit: 'h', basis: 'practice', source: 'rainfast-practice', means: 'How long a spray needs to stay on.' },
  'spray.inversionWind': { model: 'spray', value: 5, unit: 'km/h', basis: 'practice', source: 'inversion-practice', means: 'A night this calm layers the air. Proxy.' },
  'spray.inversionHold': { model: 'spray', value: 3, unit: 'h', basis: 'app', source: 'inversion-practice', means: 'How long the calm must hold before it counts.' },
  'spray.horizon': { model: 'spray', value: 48, unit: 'h', basis: 'app', source: 'app-choice', means: 'Beyond this a spray window is a guess.' },

  // ── Frost ──────────────────────────────────────────────────────────────────
  'frost.air': { model: 'frost', value: 0, unit: '°C', basis: 'published', source: 'knmi-warnings', means: 'Air frost at 1.50 m.' },
  'frost.ground': { model: 'frost', value: 2, unit: '°C', basis: 'practice', source: 'frost-practice', means: 'At 1.50 m it can still freeze at the ground. Proxy.' },
  'frost.blossom': { model: 'frost', value: -2, unit: '°C', basis: 'practice', source: 'blossom-practice', means: 'Damage to blossom and young shoots.' },
  'frost.wetBulb': { model: 'frost', value: -5, unit: '°C', basis: 'practice', source: 'wetbulb-irrigation', means: 'Below it frost irrigation takes out more heat than it puts in.' },
  'frost.horizon': { model: 'frost', value: 72, unit: 'h', basis: 'app', source: 'app-choice', means: 'How far ahead frost is claimed.' },

  // ── Workability, per field ─────────────────────────────────────────────────
  'workability.balanceDays': { model: 'workability', value: 7, unit: 'd', basis: 'app', source: 'balance-practice', means: 'The window the water balance runs over.' },
  'workability.trafficMarginal': { model: 'workability', value: 5, unit: 'mm', basis: 'app', source: 'balance-practice', means: 'Surplus at which ruts become likely.' },
  'workability.trafficBlocked': { model: 'workability', value: 15, unit: 'mm', basis: 'app', source: 'balance-practice', means: 'Surplus at which the land is shut.' },
  'workability.mowingDays': { model: 'workability', value: 3, unit: 'd', basis: 'practice', source: 'mowing-practice', means: 'Dry days a cut needs.' },
  'workability.mowingDryMm': { model: 'workability', value: 1, unit: 'mm', basis: 'practice', source: 'mowing-practice', means: 'A day under this counts as dry.' },
  'workability.droughtDays': { model: 'workability', value: 14, unit: 'd', basis: 'practice', source: 'deficit-practice', means: 'The window the deficit runs over.' },
  'workability.droughtMarginal': { model: 'workability', value: 25, unit: 'mm', basis: 'app', source: 'deficit-practice', means: 'Deficit worth naming.' },
  'workability.droughtBlocked': { model: 'workability', value: 50, unit: 'mm', basis: 'app', source: 'deficit-practice', means: 'Deficit that decides irrigation.' },

  // ── Fertilising ────────────────────────────────────────────────────────────
  'fertilise.frozen': { model: 'fertilise', value: 0, unit: '°C', basis: 'legal', source: 'fertiliser-decree', means: 'Spreading on frozen or snow-covered ground is prohibited.' },
  'fertilise.emissionTemp': { model: 'fertilise', value: 15, unit: '°C', basis: 'practice', source: 'ammonia-practice', means: 'Above it ammonia goes off before it is in the ground.' },
  'fertilise.emissionRh': { model: 'fertilise', value: 60, unit: '%', basis: 'practice', source: 'ammonia-practice', means: 'Dry air, with the same effect.' },
  'fertilise.emissionMarginalH': { model: 'fertilise', value: 3, unit: 'h', basis: 'app', source: 'app-choice', means: 'Hours of both before it is worth saying.' },
  'fertilise.emissionBlockedH': { model: 'fertilise', value: 6, unit: 'h', basis: 'app', source: 'app-choice', means: 'Hours of both that make it a bad day.' },
  'fertilise.leaching': { model: 'fertilise', value: 25, unit: 'mm', basis: 'practice', source: 'leaching-practice', means: 'Rain over two days that takes nitrogen past the roots.' },
  'fertilise.tSum': { model: 'fertilise', value: 180, unit: '°C·d', basis: 'practice', source: 'tsum-practice', means: 'The first grass dressing.' },
  'fertilise.horizon': { model: 'fertilise', value: 48, unit: 'h', basis: 'app', source: 'app-choice', means: 'How far ahead this family speaks.' },

  // ── Disease ────────────────────────────────────────────────────────────────
  'smith.humidity': { model: 'smith', value: 90, unit: '%', basis: 'published', source: 'smith-1956', means: 'Relative humidity an hour must reach.' },
  'smith.hoursPerDay': { model: 'smith', value: 11, unit: 'h', basis: 'published', source: 'smith-1956', means: 'Such hours in a day.' },
  'smith.minTemp': { model: 'smith', value: 10, unit: '°C', basis: 'published', source: 'smith-1956', means: "The day's minimum temperature." },
  'smith.days': { model: 'smith', value: 2, unit: 'd', basis: 'published', source: 'smith-1956', means: 'Consecutive qualifying days that make a period.' },
  'cercospora.humidity': { model: 'cercospora', value: 90, unit: '%', basis: 'published', source: 'irs-div', means: 'The RH an hour must reach to count toward a DIV.' },
  'cercospora.recent': { model: 'cercospora', value: 6, unit: 'DIV', basis: 'published', source: 'irs-div', means: 'Two-day total at which conditions are favourable.' },
  'leafWet.humidity': { model: 'leafWet', value: 95, unit: '%', basis: 'app', source: 'leafwet-proxy', means: 'RH at which the leaf is assumed wet. A proxy, labelled as one.' },

  // ── The overview page's work window ────────────────────────────────────────
  'workWindow.wet': { model: 'workWindow', value: 0.1, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Rain in the hour that stops field work.' },
  'workWindow.wind': { model: 'workWindow', value: 20, unit: 'km/h', basis: 'app', source: 'app-choice', means: 'Wind that stops machine work. Not the spraying limit — that is legal and lower.' },
  'workWindow.minTemp': { model: 'workWindow', value: 1, unit: '°C', basis: 'app', source: 'app-choice', means: 'Below it the hour is too cold to work.' },

  // ── The attention list ─────────────────────────────────────────────────────
  'attention.soaked': { model: 'attention', value: 15, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Rain over 24 hours that shuts the land.' },
  'attention.rainAhead': { model: 'attention', value: 10, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Rain in the next 24 worth hurrying for.' },
  'attention.usefulRun': { model: 'attention', value: 3, unit: 'h', basis: 'app', source: 'app-choice', means: 'A run shorter than this is not a window.' },
  'attention.frost': { model: 'attention', value: 0, unit: '°C', basis: 'published', source: 'knmi-warnings', means: 'Frost tonight worth naming.' },

  // ── The brief ──────────────────────────────────────────────────────────────
  'brief.wettest': { model: 'brief', value: 0.5, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Below it, "the most rain fell at" reports a damp morning.' },
  'brief.ahead': { model: 'brief', value: 1, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Rain ahead worth a sentence.' },
  'brief.tempSpan': { model: 'brief', value: 1.5, unit: '°C', basis: 'app', source: 'app-choice', means: 'A temperature spread under this is not a spread.' },
  'brief.windSpan': { model: 'brief', value: 5, unit: 'km/h', basis: 'app', source: 'app-choice', means: 'Nor is a wind spread under this.' },

  // ── AgroIntelligence ───────────────────────────────────────────────────────
  'area.spreadMm': { model: 'area', value: 10, unit: 'mm', basis: 'app', source: 'app-choice', means: 'Gap between wettest and driest field worth a line.' },
  'area.spreadRatio': { model: 'area', value: 3, unit: '', basis: 'app', source: 'app-choice', means: 'And by what factor, so two wet fields stay quiet.' },
  'area.usefulRun': { model: 'area', value: 2, unit: 'h', basis: 'app', source: 'app-choice', means: 'A joint window shorter than this is true and useless.' },
  'area.sharedMin': { model: 'area', value: 2, unit: '', basis: 'app', source: 'app-choice', means: 'Fields with the same boundary before it is a pattern.' },
  'risk.watch': { model: 'risk', value: 30, unit: '%', basis: 'app', source: 'ladder-plan', means: 'Worth knowing about; nothing to do yet.' },
  'risk.prepare': { model: 'risk', value: 60, unit: '%', basis: 'app', source: 'ladder-plan', means: 'Worth getting ready for — fuel, covers, a contractor called.' },
  'risk.act': { model: 'risk', value: 85, unit: '%', basis: 'app', source: 'ladder-plan', means: 'Worth acting on tonight, at the cost of being wrong one time in seven.' },
  'risk.appetiteShift': { model: 'risk', value: 15, unit: '%', basis: 'app', source: 'ladder-plan', means: 'How far the rungs move for a cautious or patient reader.' },
  'risk.settledHigh': { model: 'risk', value: 85, unit: '%', basis: 'app', source: 'app-choice', means: 'Above it the forecast has committed.' },
  'risk.settledLow': { model: 'risk', value: 15, unit: '%', basis: 'app', source: 'app-choice', means: 'And below its mirror, so has it.' },
} as const satisfies Record<string, ThresholdSpec>;

export type ThresholdId = keyof typeof THRESHOLDS;

/** One boundary's number. The only way a module should reach a figure. */
export function threshold(id: ThresholdId): number {
  return THRESHOLDS[id].value;
}

/** Every threshold one model owns, in table order — what the documentation prints. */
export function thresholdsOf(model: ModelId): (ThresholdSpec & { id: ThresholdId })[] {
  return (Object.keys(THRESHOLDS) as ThresholdId[])
    .filter((id) => THRESHOLDS[id].model === model)
    .map((id) => ({ id, ...(THRESHOLDS[id] as ThresholdSpec) }));
}

/**
 * The soil boundaries are not in this table, and that is the point.
 *
 * `threshold_0_to_1`, `1_to_2` and `2_to_3` come from `/soilstations/` per field,
 * computed from that field's own soil and crop, and are frozen per placement. There
 * is no app-wide number to list: the same colour on two fields means the same thing
 * about two very different figures — which is exactly why suction was built first.
 */
export const SOIL_THRESHOLDS_ARE_PER_FIELD = true;
