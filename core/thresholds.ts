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
  /** Law. */
  | 'bal-gewasbescherming'
  | 'besluit-meststoffen'
  /** Published models, institutes and peer-reviewed work. */
  | 'knmi-waarschuwingen'
  | 'knmi-neerslagtekort'
  | 'grdc-deltat'
  | 'stull-2011'
  | 'cbgv-tsom'
  | 'smith-1956'
  | 'irs-div'
  | 'sentelhas-2008'
  | 'huijsmans-ammoniak'
  /** Dutch growing practice, without one document behind it. */
  | 'spuittemperatuur'
  | 'regenvastheid'
  | 'inversie-drift'
  | 'grondvorst'
  | 'bloesemvorst'
  | 'vorstberegening'
  | 'maaivenster'
  | 'uitspoeling'
  /** This app's own reasoning. */
  | 'waterbalans'
  | 'eigen-keuze'
  | 'ladder-voorstel';

export interface Source {
  /** What to cite, as a reader would look it up. */
  title: string;
  /** Where it is to be found, or who holds it. */
  where: string;
  /**
   * The page or document itself, where there is one to link to.
   *
   * Present on every source that rests on a published text. Absent only where the
   * source genuinely is not a publication: this app's own choices, and the rules that
   * are common practice among Dutch growers without one document behind them.
   */
  url?: string;
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
  'bal-gewasbescherming': {
    title: 'Besluit activiteiten leefomgeving, \u00a7 4.64 (art. 4.723e) \u2014 spuiten bij meer dan 5 m/s is verboden',
    where: 'Besluit activiteiten leefomgeving (BWBR0041330), onder de Omgevingswet. Verving per 1 januari 2024 de gelijkluidende bepaling uit het Activiteitenbesluit milieubeheer.',
    url: 'https://wetten.overheid.nl/BWBR0041330',
    caveat: 'De wet meet op twee meter hoogte, of \u00e9\u00e9n meter boven de spuitboom; de verwachting in de app geldt op tien meter en is daar hoger. De app is dus strenger dan de wet, niet losser. Het etiket van het middel kan strenger zijn dan beide, en er geldt een uitzondering bij een teeltbedreigende situatie.',
  },
  'besluit-meststoffen': {
    title: 'Besluit gebruik meststoffen \u2014 verbod op uitrijden op bevroren of besneeuwde grond',
    where: 'Besluit gebruik meststoffen (BWBR0009066)',
    url: 'https://wetten.overheid.nl/BWBR0009066',
    caveat: 'Het verbod gaat over de bodem; de app leidt bevriezing af uit de luchttemperatuur op 1,50 meter. Bij lichte vorst zonder bevroren bodem waarschuwt de app dus terwijl uitrijden is toegestaan.',
  },
  'knmi-waarschuwingen': {
    title: 'KNMI \u2014 uitleg en drempelwaarden van de weerwaarschuwingen',
    where: 'KNMI. Code geel bij windstoten boven 75 km/u; code oranje boven 100 km/u.',
    url: 'https://www.knmi.nl/kennis-en-datacentrum/uitleg/knmi-waarschuwingen',
    caveat: 'De app waarschuwt bewust \u00e9\u00e9n stap onder code geel. Het is dus geen weerwaarschuwing en zegt niets over de officiële waarschuwing die op dat moment geldt.',
  },
  'knmi-neerslagtekort': {
    title: 'KNMI \u2014 achtergrondinformatie neerslagtekort',
    where: 'KNMI. Neerslagtekort is de gesommeerde referentiegewasverdamping volgens Makkink minus de neerslag, landelijk over 1 april t/m 30 september.',
    url: 'https://www.knmi.nl/kennis-en-datacentrum/achtergrond/achtergrondinformatie-neerslagtekort',
    caveat: 'De app rekent per locatie over een voortschrijdend venster van veertien dagen, niet landelijk vanaf 1 april. De getallen zijn daarom niet te vergelijken met het landelijke neerslagtekort in het nieuws.',
  },
  'grdc-deltat': {
    title: 'GRDC \u2014 Spray Application Manual, module 10.3: Temperature and humidity',
    where: 'Grains Research and Development Corporation (Australi\u00eb), naar Tepper (2012). Spuiten bij Delta T tussen 2 en 8; voorzichtigheid onder 2 en boven 10.',
    url: 'https://grdc.com.au/resources-and-publications/grownotes/technical-manuals/spray-application-manual/preparing-for-spraying/module-10-weather-monitoring-for-spraying-operations/10.3-temperature-and-humidity',
    caveat: 'Australische richtlijn, in Nederland overgenomen door adviesdiensten. Geen wettelijke status: buiten het venster bepalen middel en doptype wat kan.',
  },
  'stull-2011': {
    title: 'Stull, R. (2011). Wet-Bulb Temperature from Relative Humidity and Air Temperature',
    where: 'Journal of Applied Meteorology and Climatology 50, 2267\u20132269. De formule waarmee de app de natboltemperatuur berekent, en daarmee Delta T.',
    url: 'https://journals.ametsoc.org/view/journals/apme/50/11/jamc-d-11-0143.1.xml',
    caveat: 'Geldig bij 5\u201399 % RV en \u221220 tot 50 \u00b0C, met een gemiddelde afwijking onder 0,3 \u00b0C. Bij lage temperatuur \u00e9n lage luchtvochtigheid tegelijk loopt de afwijking op.',
  },
  'cbgv-tsom': {
    title: 'Adviesbasis bemesting grasland en voedergewassen \u2014 de T-somregel voor de eerste stikstofgift',
    where: 'Commissie Bemesting Grasland en Voedergewassen. Gangbaar advies: eerste gift bij een T-som tussen 180 en 250 graaddagen.',
    url: 'https://www.bemestingsadvies.nl/',
    caveat: 'De app houdt 180 aan, de onderkant van het venster. Het advies noemt ook bodemtemperatuur en draagkracht; die weegt de app niet mee.',
  },
  'smith-1956': {
    title: 'Smith, L.P. (1956) \u2014 de Smith-periode voor Phytophthora infestans',
    where: 'Twee opeenvolgende dagen met een minimumtemperatuur van 10 \u00b0C of hoger en op elke dag minstens elf uur met een relatieve luchtvochtigheid boven 90 %. In Nederland en het Verenigd Koninkrijk breed in gebruik.',
    url: 'https://euroblight.net/fileadmin/euroblight/Workshops/AArhus/Proceedings/5._Siobhan_Dancy-p53-58.pdf',
    caveat: 'Het criterium staat sinds 1956 vast; er loopt vakdiscussie over of het onder het huidige klimaat niet te laat waarschuwt.',
  },
  'irs-div': {
    title: 'IRS \u2014 infectiewaarden (DIV) voor cercospora in suikerbieten',
    where: 'Instituut voor Rationele Suikerproductie. Bij een som van zes of hoger over twee opeenvolgende dagen is infectie mogelijk als er sporen aanwezig zijn; de eerste vlekken volgen tien tot achttien dagen later.',
    url: 'https://www.irs.nl/bladschimmelpagina/wanneer-spuiten-en-gebruik-infectiewaarden/',
    caveat: 'De drempel van zes over twee dagen is bevestigd. De onderliggende tabel van vochturen tegen gemiddelde temperatuur staat in de app als de gangbare reproductie en is nog niet regel voor regel tegen de IRS-publicatie gelegd.',
  },
  'sentelhas-2008': {
    title: 'Sentelhas, P.C. e.a. (2008). Suitability of relative humidity as an estimator of leaf wetness duration',
    where: 'Agricultural and Forest Meteorology 148, 392\u2013400. Een uur met een relatieve luchtvochtigheid van 90 % of hoger blijkt een bruikbare schatter voor bladnat.',
    url: 'https://www.sciencedirect.com/science/article/abs/pii/S0168192307002614',
    caveat: 'De app houdt 95 % aan en is daarmee strenger dan de gevalideerde 90 %. Het onderzoek laat ook zien dat de beste drempel per locatie verschilt (83 tot 92 %).',
  },
  'huijsmans-ammoniak': {
    title: 'Huijsmans, J.F.M. e.a. \u2014 ammoniakemissie bij mesttoediening',
    where: 'Wageningen University & Research. De emissiesnelheid loopt op bij hogere luchttemperatuur, meer straling en meer wind, en daalt bij hogere luchtvochtigheid.',
    url: 'https://edepot.wur.nl/255878',
    caveat: 'Het onderzoek onderbouwt de richting, niet de twee getallen die de app gebruikt. 15 \u00b0C en 60 % zijn een praktijkvuistregel; straling en windsnelheid weegt de app nog niet mee.',
  },
  'spuittemperatuur': {
    title: 'Temperatuurgrenzen voor een bespuiting: 1 tot 25 \u00b0C',
    where: 'Nederlandse teelt- en adviespraktijk. Onder 1 \u00b0C werkt het middel niet en dreigt vorstschade; boven 25 \u00b0C verdampt te veel en neemt de kans op verbranding toe.',
  },
  'regenvastheid': {
    title: 'Regenvastheid: het gewas droog houden na de bespuiting',
    where: 'Middeletiketten en teeltadvies. Twee uur is een gangbare vuistregel; het etiket van het middel is leidend en noemt soms een half uur, soms langer.',
  },
  'inversie-drift': {
    title: 'Temperatuurinversie en driftrisico bij windstilte',
    where: 'Nederlandse voorlichtingspraktijk rond driftreductie. Bij een heldere, windstille nacht blijft de nevel hangen en verplaatst zich over grote afstand.',
    url: 'https://www.syngenta.nl/duurzame-landbouw/driftreductie',
    caveat: 'De app meet geen inversie. Zij leidt het af uit aanhoudende windstilte in de nacht en noemt dat in de app een afgeleide waarde.',
  },
  'grondvorst': {
    title: 'Grondvorst bij ongeveer 2 \u00b0C op 1,50 meter',
    where: 'Vuistregel uit de tuinbouw- en fruitteeltpraktijk: bij heldere, windstille nachten koelt het vlak boven de grond enkele graden verder af dan op meethoogte.',
  },
  'bloesemvorst': {
    title: 'Schadegrens voor bloesem: ongeveer \u22122 \u00b0C',
    where: 'Nederlandse fruitteeltpraktijk. In knop verdraagt bloesem meer, in volle bloei treedt schade al op tussen \u22121 en \u22122 \u00b0C.',
    url: 'https://www.nfofruit.nl/nieuws/vorstschade-op-niet-beregende-percelen/',
    caveat: 'De grens verschilt per gewas en per ontwikkelingsstadium. De app kent het stadium niet en houdt \u00e9\u00e9n getal aan.',
  },
  'vorstberegening': {
    title: 'Vorstberegening en de natboltemperatuur',
    where: 'Fruitteeltpraktijk, onder meer pcfruit. De natboltemperatuur geeft beter dan de luchttemperatuur weer wat de bloesem ondervindt; bij diepe vorst kost beregenen meer warmte dan het oplevert.',
    url: 'https://www.pcfruit.be/nl/fruitteler/bedrijfsbegeleiding/vorstbescherming/overzicht-0-0',
    caveat: 'De grens van \u22125 \u00b0C natbol is een praktijkgetal. Waterhoeveelheid per hectare en windsnelheid bepalen mede waar hij in werkelijkheid ligt.',
  },
  'maaivenster': {
    title: 'Maaivenster: drie droge dagen',
    where: 'Ruwvoerpraktijk. Gras dat gemaaid wordt heeft een aantal droge dagen nodig om te velden en in te kuilen.',
  },
  'uitspoeling': {
    title: 'Uitspoeling van stikstof bij zware neerslag kort na bemesting',
    where: 'Nederlands bemestingsadvies. Zware neerslag binnen enkele dagen na een gift spoelt stikstof onder de wortelzone.',
    caveat: 'Hoeveel neerslag daarvoor nodig is hangt sterk af van grondsoort en vochttoestand. De app houdt \u00e9\u00e9n getal aan voor alle percelen.',
  },
  'waterbalans': {
    title: 'Berijdbaarheid geschat uit een neerslag-verdampingsbalans',
    where: 'Eigen benadering van deze app: neerslag minus referentieverdamping over een voortschrijdend venster. Een echte meting is de zuigspanning uit een bodemsensor.',
    caveat: 'Grondsoort, ontwatering en bandenspanning bepalen de werkelijke draagkracht en zitten geen van drie\u00ebn in deze som. Waar een bodemsensor staat, is die het antwoord en is deze balans de terugval.',
  },
  'eigen-keuze': {
    title: 'Eigen keuze van deze app',
    where: 'Meestal een ondergrens waaronder een melding of een zin achterwege blijft, gekozen zodat de app niet elke ochtend hetzelfde zegt. Bedoeld om herzien te worden zodra er gebruikscijfers zijn.',
  },
  'ladder-voorstel': {
    title: 'Escalatieladder 30 / 60 / 85 procent',
    where: 'ExactCast agro-voorstel, blad 2, paragraaf 4B. Drie kansdrempels met elk een andere handeling: in de gaten houden, voorbereiden, handelen.',
  },
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
  'alert.gust': { model: 'alert', value: 60, unit: 'km/h', basis: 'published', source: 'knmi-waarschuwingen', means: 'Wind worth knowing about; KNMI issues code yellow at 75.' },
  'alert.gustHeavy': { model: 'alert', value: 75, unit: 'km/h', basis: 'published', source: 'knmi-waarschuwingen', means: 'Code-yellow gust: damage to trees and loose objects.' },
  'alert.rain': { model: 'alert', value: 1, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Rain over the 12-hour window worth a block.' },
  'alert.rainHeavy': { model: 'alert', value: 5, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'A downpour rather than a shower.' },
  'alert.frost': { model: 'alert', value: 0, unit: '°C', basis: 'published', source: 'knmi-waarschuwingen', means: 'Air frost: slippery roads, damage to plants.' },
  'alert.heat': { model: 'alert', value: 30, unit: '°C', basis: 'published', source: 'knmi-waarschuwingen', means: 'Heat worth naming. Never notifies — a block only.' },
  'alert.window': { model: 'alert', value: 12, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'How far ahead the block looks.' },

  // ── Spraying ───────────────────────────────────────────────────────────────
  'spray.wind': { model: 'spray', value: 18, unit: 'km/h', basis: 'legal', source: 'bal-gewasbescherming', means: '5 m/s: above it spraying is not permitted.' },
  'spray.tempMin': { model: 'spray', value: 1, unit: '°C', basis: 'practice', source: 'spuittemperatuur', means: 'Too cold to spray.' },
  'spray.tempMax': { model: 'spray', value: 25, unit: '°C', basis: 'practice', source: 'spuittemperatuur', means: 'Too warm: evaporation and scorch.' },
  'spray.deltaTMin': { model: 'spray', value: 2, unit: '°C', basis: 'published', source: 'grdc-deltat', means: 'Below it the droplets hang and drift.' },
  'spray.deltaTMax': { model: 'spray', value: 8, unit: '°C', basis: 'published', source: 'grdc-deltat', means: 'Above it they evaporate before the leaf.' },
  'spray.rainfastMm': { model: 'spray', value: 0.2, unit: 'mm', basis: 'practice', source: 'regenvastheid', means: 'Rain inside the rainfast window that washes it off.' },
  'spray.rainfastH': { model: 'spray', value: 2, unit: 'h', basis: 'practice', source: 'regenvastheid', means: 'How long a spray needs to stay on.' },
  'spray.inversionWind': { model: 'spray', value: 5, unit: 'km/h', basis: 'practice', source: 'inversie-drift', means: 'A night this calm layers the air. Proxy.' },
  'spray.inversionHold': { model: 'spray', value: 3, unit: 'h', basis: 'app', source: 'inversie-drift', means: 'How long the calm must hold before it counts.' },
  'spray.horizon': { model: 'spray', value: 48, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'Beyond this a spray window is a guess.' },

  // ── Frost ──────────────────────────────────────────────────────────────────
  'frost.air': { model: 'frost', value: 0, unit: '°C', basis: 'published', source: 'knmi-waarschuwingen', means: 'Air frost at 1.50 m.' },
  'frost.ground': { model: 'frost', value: 2, unit: '°C', basis: 'practice', source: 'grondvorst', means: 'At 1.50 m it can still freeze at the ground. Proxy.' },
  'frost.blossom': { model: 'frost', value: -2, unit: '°C', basis: 'practice', source: 'bloesemvorst', means: 'Damage to blossom and young shoots.' },
  'frost.wetBulb': { model: 'frost', value: -5, unit: '°C', basis: 'practice', source: 'vorstberegening', means: 'Below it frost irrigation takes out more heat than it puts in.' },
  'frost.horizon': { model: 'frost', value: 72, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'How far ahead frost is claimed.' },

  // ── Workability, per field ─────────────────────────────────────────────────
  'workability.balanceDays': { model: 'workability', value: 7, unit: 'd', basis: 'app', source: 'waterbalans', means: 'The window the water balance runs over.' },
  'workability.trafficMarginal': { model: 'workability', value: 5, unit: 'mm', basis: 'app', source: 'waterbalans', means: 'Surplus at which ruts become likely.' },
  'workability.trafficBlocked': { model: 'workability', value: 15, unit: 'mm', basis: 'app', source: 'waterbalans', means: 'Surplus at which the land is shut.' },
  'workability.mowingDays': { model: 'workability', value: 3, unit: 'd', basis: 'practice', source: 'maaivenster', means: 'Dry days a cut needs.' },
  'workability.mowingDryMm': { model: 'workability', value: 1, unit: 'mm', basis: 'practice', source: 'maaivenster', means: 'A day under this counts as dry.' },
  'workability.droughtDays': { model: 'workability', value: 14, unit: 'd', basis: 'published', source: 'knmi-neerslagtekort', means: 'The window the deficit runs over.' },
  'workability.droughtMarginal': { model: 'workability', value: 25, unit: 'mm', basis: 'app', source: 'knmi-neerslagtekort', means: 'Deficit worth naming.' },
  'workability.droughtBlocked': { model: 'workability', value: 50, unit: 'mm', basis: 'app', source: 'knmi-neerslagtekort', means: 'Deficit that decides irrigation.' },

  // ── Fertilising ────────────────────────────────────────────────────────────
  'fertilise.frozen': { model: 'fertilise', value: 0, unit: '°C', basis: 'legal', source: 'besluit-meststoffen', means: 'Spreading on frozen or snow-covered ground is prohibited.' },
  'fertilise.emissionTemp': { model: 'fertilise', value: 15, unit: '°C', basis: 'practice', source: 'huijsmans-ammoniak', means: 'Above it ammonia goes off before it is in the ground.' },
  'fertilise.emissionRh': { model: 'fertilise', value: 60, unit: '%', basis: 'practice', source: 'huijsmans-ammoniak', means: 'Dry air, with the same effect.' },
  'fertilise.emissionMarginalH': { model: 'fertilise', value: 3, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'Hours of both before it is worth saying.' },
  'fertilise.emissionBlockedH': { model: 'fertilise', value: 6, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'Hours of both that make it a bad day.' },
  'fertilise.leaching': { model: 'fertilise', value: 25, unit: 'mm', basis: 'practice', source: 'uitspoeling', means: 'Rain over two days that takes nitrogen past the roots.' },
  'fertilise.tSum': { model: 'fertilise', value: 180, unit: '°C·d', basis: 'published', source: 'cbgv-tsom', means: 'The first grass dressing.' },
  'fertilise.horizon': { model: 'fertilise', value: 48, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'How far ahead this family speaks.' },

  // ── Disease ────────────────────────────────────────────────────────────────
  'smith.humidity': { model: 'smith', value: 90, unit: '%', basis: 'published', source: 'smith-1956', means: 'Relative humidity an hour must reach.' },
  'smith.hoursPerDay': { model: 'smith', value: 11, unit: 'h', basis: 'published', source: 'smith-1956', means: 'Such hours in a day.' },
  'smith.minTemp': { model: 'smith', value: 10, unit: '°C', basis: 'published', source: 'smith-1956', means: "The day's minimum temperature." },
  'smith.days': { model: 'smith', value: 2, unit: 'd', basis: 'published', source: 'smith-1956', means: 'Consecutive qualifying days that make a period.' },
  'cercospora.humidity': { model: 'cercospora', value: 90, unit: '%', basis: 'published', source: 'irs-div', means: 'The RH an hour must reach to count toward a DIV.' },
  'cercospora.recent': { model: 'cercospora', value: 6, unit: 'DIV', basis: 'published', source: 'irs-div', means: 'Two-day total at which conditions are favourable.' },
  'leafWet.humidity': { model: 'leafWet', value: 95, unit: '%', basis: 'app', source: 'sentelhas-2008', means: 'RH at which the leaf is assumed wet. A proxy, labelled as one.' },

  // ── The overview page's work window ────────────────────────────────────────
  'workWindow.wet': { model: 'workWindow', value: 0.1, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Rain in the hour that stops field work.' },
  'workWindow.wind': { model: 'workWindow', value: 20, unit: 'km/h', basis: 'app', source: 'eigen-keuze', means: 'Wind that stops machine work. Not the spraying limit — that is legal and lower.' },
  'workWindow.minTemp': { model: 'workWindow', value: 1, unit: '°C', basis: 'app', source: 'eigen-keuze', means: 'Below it the hour is too cold to work.' },

  // ── The attention list ─────────────────────────────────────────────────────
  'attention.soaked': { model: 'attention', value: 15, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Rain over 24 hours that shuts the land.' },
  'attention.rainAhead': { model: 'attention', value: 10, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Rain in the next 24 worth hurrying for.' },
  'attention.usefulRun': { model: 'attention', value: 3, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'A run shorter than this is not a window.' },
  'attention.frost': { model: 'attention', value: 0, unit: '°C', basis: 'published', source: 'knmi-waarschuwingen', means: 'Frost tonight worth naming.' },

  // ── The brief ──────────────────────────────────────────────────────────────
  'brief.wettest': { model: 'brief', value: 0.5, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Below it, "the most rain fell at" reports a damp morning.' },
  'brief.ahead': { model: 'brief', value: 1, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Rain ahead worth a sentence.' },
  'brief.tempSpan': { model: 'brief', value: 1.5, unit: '°C', basis: 'app', source: 'eigen-keuze', means: 'A temperature spread under this is not a spread.' },
  'brief.windSpan': { model: 'brief', value: 5, unit: 'km/h', basis: 'app', source: 'eigen-keuze', means: 'Nor is a wind spread under this.' },

  // ── AgroIntelligence ───────────────────────────────────────────────────────
  'area.spreadMm': { model: 'area', value: 10, unit: 'mm', basis: 'app', source: 'eigen-keuze', means: 'Gap between wettest and driest field worth a line.' },
  'area.spreadRatio': { model: 'area', value: 3, unit: '', basis: 'app', source: 'eigen-keuze', means: 'And by what factor, so two wet fields stay quiet.' },
  'area.usefulRun': { model: 'area', value: 2, unit: 'h', basis: 'app', source: 'eigen-keuze', means: 'A joint window shorter than this is true and useless.' },
  'area.sharedMin': { model: 'area', value: 2, unit: '', basis: 'app', source: 'eigen-keuze', means: 'Fields with the same boundary before it is a pattern.' },
  'risk.watch': { model: 'risk', value: 30, unit: '%', basis: 'app', source: 'ladder-voorstel', means: 'Worth knowing about; nothing to do yet.' },
  'risk.prepare': { model: 'risk', value: 60, unit: '%', basis: 'app', source: 'ladder-voorstel', means: 'Worth getting ready for — fuel, covers, a contractor called.' },
  'risk.act': { model: 'risk', value: 85, unit: '%', basis: 'app', source: 'ladder-voorstel', means: 'Worth acting on tonight, at the cost of being wrong one time in seven.' },
  'risk.appetiteShift': { model: 'risk', value: 15, unit: '%', basis: 'app', source: 'ladder-voorstel', means: 'How far the rungs move for a cautious or patient reader.' },
  'risk.settledHigh': { model: 'risk', value: 85, unit: '%', basis: 'app', source: 'eigen-keuze', means: 'Above it the forecast has committed.' },
  'risk.settledLow': { model: 'risk', value: 15, unit: '%', basis: 'app', source: 'eigen-keuze', means: 'And below its mirror, so has it.' },
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
