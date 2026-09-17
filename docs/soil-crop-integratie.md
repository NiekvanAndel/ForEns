# SoilExact en CropExact in ExactCast

Plan voor het integreren van de bodemsensoren in de bestaande pagina's, en voor hun
plaats in de agro-indicatorlaag. Vastgelegd 17 september 2026.

De visuele samenvatting hiervan is blad 3 van het integrale voorstel
(`Bodem in de indicatorlaag`); dit bestand is de uitgewerkte versie, met de
codeverwijzingen erbij.

## Uitgangspunt

Bodem wordt **geen aparte pagina en geen zevende laag**. Het wordt geïntegreerd in
'Actueel', 'Grafiek' en 'Vooruitzicht', met de grootheden die een SoilExact of
CropExact daadwerkelijk meet — en het wordt de eerste klant van de indicatorlaag,
omdat het de enige indicator is die vandaag al een drempel, een toestand, een
herkomst én een hoeveelheid heeft.

De webapp is de plek waar de instellingen geregeld worden. Deze app laadt alleen
data uit de API en past niets in de webapp aan, met uitzondering van de expliciet
benoemde backend-toevoegingen hieronder.

## Besluiten van 17 september 2026

| | Besluit |
| --- | --- |
| Verplaatsen | Zelfde `SoilStation`, nieuwe lat/lon en nieuwe instellingen. Verplaatsen is een **expliciete handeling in de webapp**, geen afleiding uit gewijzigde coördinaten. |
| Locatie | Een plaatsing wordt een **eigen locatie**, behalve wanneer er al een weerlocatie binnen ~2 km ligt — dan wordt hij daaraan gekoppeld. |
| Historie | Afgeleide waarden worden berekend met de **instellingen van dat moment**, niet met de huidige. |
| Windwrijving | Blijft buiten de app. |
| Neerslag en beregening | Eén getal, geen scheiding. |
| Bladnat-proxy | Wordt gebruikt, gelabeld als proxy. |
| RV-rekenkern | Op 10 cm waar een CropExact staat, anders op 1,50 m. Nooit beide. |
| Eerste indicator | Zuigspanning, niet wind. |

## 1. Een bodemstation is een plaatsing, geen locatie

Een AtmoExact is een paal die jaren op één plek staat; in de app is dat één
`SavedLocation` met een `stationId`. Een SoilExact is **station × perceel × gewas ×
grondsoort × diepte × seizoen**. Alles behalve het station verandert bij een
verplaatsing, en de historie hoort bij het perceel.

Daarom krijgt `core/model/soil.ts` een eigen begrip:

```ts
interface Placement {
  stationId: string;          // blijft hetzelfde over plaatsingen heen
  placementId: string;
  lat: number; lon: number;
  from: string; to: string | null;   // null = de lopende plaatsing
  crop: string | null;
  soil: string | null;
  depthCm: number;
  thresholds: { scarce: number; irrigate: number; critical: number };  // kPa
}
```

`SavedLocation` krijgt `kind: 'weather' | 'soil'` en optioneel `placementId`; de sync
in `state/stations.ts` wordt uitgebreid met `/soilstations/`, analoog aan wat er al
staat voor `/stations/`.

- **De lopende plaatsing is een gewone locatie**, met de perceelnaam (`station.name`)
  in plaats van de reverse-geocode woonplaats.
- **Oude plaatsingen zijn geen locaties.** Ze zouden de lijst volzetten met percelen
  van drie seizoenen terug. Ze zijn bereikbaar via de datumkiezer op 'Grafiek', met
  een regel boven de grafiek die zegt op welk perceel dat deel van de reeks viel.
- **Winterstand.** Laatste meting ouder dan veertien dagen (dezelfde grens die
  `SoilStation.last_reading` hanteert) → bodemblokken verdwijnen, de locatie blijft
  als gewone weerlocatie staan, en 'Grafiek' zegt "niet actief sinds «datum»" met de
  historie gewoon opvraagbaar. Een sensor die eruit is, is een toestand, geen
  storing: de indicatorlaag moet *uit* en *stuk* uit elkaar houden, anders meldt de
  app elk najaar dat er iets kapot is.

## 2. Waarom de historie bevroren moet worden

`status_code` staat per meting vast — die wordt bij binnenkomst berekend en
opgeslagen (`agroapp/jobs.py:474`). Dat deel klopt al.

`pF`, `bijvulruimte` en `water_percentage` worden bij élke API-call opnieuw gerekend
met de *huidige* grondsoortcoëfficiënten, en de drempels op `/soilstations/` zijn per
definitie de huidige. Verhuist een station van klei naar zand, dan verandert de
bijvulruimte van vorig seizoen met terugwerkende kracht — en, erger voor de
indicatorlaag, de drempellijn in de grafiek staat dan over de hele reeks op de nieuwe
waarde. Een grafiek met een grens op de verkeerde hoogte is precies wat de
herkomstregel van het voorstel verbiedt.

Daar komt bij dat `LocationDelta` pas wordt geschreven bij een verschil van ≥ 0,01°
(`agroapp/signals.py:62`), oftewel ~1,1 km in breedte. Voor een weerpaal is dat een
zinnige ruisfilter; voor een perceelsensor is het onbruikbaar, want het perceel
ernaast is dan onzichtbaar.

## 3. Wat er in de backend moet (AgroExactWebApp)

Geen van deze punten raakt de bestaande webapp-pagina's.

1. **`SoilPlacement`** — `station`, `from`, `to`, `lat`, `lon`, `crop`, `soil`,
   `placement_depth`, plus de drie afgeleide drempels **bevroren bij aanmaak**. Een
   verplaatsing sluit de lopende plaatsing en opent een nieuwe. Backfill uit
   `LocationDelta` voor wat er is; alles daarvóór is één plaatsing met de huidige
   instellingen, gelabeld als "instellingen onbekend vóór «datum»".
2. **Afgeleide velden rekenen met de plaatsing van dat moment**, niet met
   `station.soil`.
3. **`/soilstations/{id}/placements/`** in API v2, met de bevroren drempels per
   plaatsing.
4. **Zuigspanningsverwachting in API v2.** De rekenkern bestaat al —
   `water_tension.estimate_water_tension` achter
   `api_soilreading_get_interval(..., with_forecast=true)` in
   `agroapp/views/views_api.py:353` — maar zit alleen in de interne API.
5. **Ontbrekende velden op `/soilstations/`**: `soil` (grondsoortnaam),
   `field_capacity` (voor de lijn *Veldcapaciteit*), en `online` /
   `last_reading_at` voor de winterstand zonder eerst metingen op te halen.
6. **`leaf_wet` in `SoilReadingSerializer`.** Staat in het model, niet in de API.

## 4. Bladnat: proxy, geen meting

`SoilMeasurement.leaf_wet` wordt niet gemeten. Het wordt afgeleid in
`agroapp/views/views_data_util.py:288`:

```python
leaf_wet = True if prec_last_hour > 0 or humidity_10 > 95 else False
```

Dus: neerslag in het laatste uur, óf RV op 10 cm boven 95%. Besloten is dat de proxy
gewoon gebruikt wordt, mits gelabeld als proxy. Hij voedt Smith en de vochturen;
**Mills blijft wachten op een echte bladnatsensor.** De webapp heeft er al een
aggregatie voor ("Uren bladnat", `agroapp/aggregation/aggregation.py:217`).

## 5. 'Actueel'

`core/model/tiles.ts` krijgt naast `modelTiles` een voorwaardelijke
`soilTiles(placement, latest)`, in dezelfde `Tile`-vorm, zodat `TileEditor` en
`prefs.tiles` (slepen, uitschakelen) er zonder wijziging overheen werken. `TileKind`
groeit met `'kpa'` en `'pf'`.

| Blok | Bron (`/soilreadings/{id}/`) | Eenheid |
| --- | --- | --- |
| Zuigspanning | `water_tension` | kPa |
| Vochtstatus | `status_code` | 0–3, als gekleurd woord |
| Bijvulruimte | `bijvulruimte × depth / 10` | mm |
| Bij te vullen | `water_until_nonschaarste` … `bijvulruimte` | mm, alleen bij status ≥ 1 |
| Waterpercentage | `water_percentage` | vol-% |
| pF | `pF` | — |
| Bodemtemperatuur | `temperature_placement_depth` | °C |
| Temperatuur 10 cm | `temperature_10` | °C, alleen CropExact |
| Luchtvochtigheid 10 cm | `humidity_10` | %, alleen CropExact |
| Dauwpunt 10 cm | `dewpoint` | °C, alleen CropExact |
| Bladnat | `leaf_wet` | ja/nee, gelabeld als proxy |

Drie regels:

- **Neerslag gaat naar het bestaande neerslagblok**, met de groene stip aan; regen en
  beregening zijn één getal. Temperatuur en RV op 10 cm blijven aparte blokken — dat
  is fysisch iets anders dan 1,50 m en mag het temperatuurblok nooit stilzwijgend
  overschrijven.
- **De groene stip blijft per grootheid.** Een BASIC die neerslag schat uit
  AtmoNetwork krijgt er geen: dat zou een instrumentgezag achter een modelgetal
  zetten.
- **De contextregel is een herkomstregel**, geen decoratie: "Aardappel · matig zware
  klei · sensor op 30 cm". Zonder gewas, grondsoort en diepte is een zuigspanning
  niet te duiden, dus hij staat altijd op de pagina — en in het vergelijkscherm per
  rij.

Het vergelijkscherm (tik op een blok → alle locaties) werkt door voor bodemblokken:
alleen locaties met een plaatsing, gesorteerd op zuigspanning aflopend.

## 6. 'Grafiek'

`SeriesKey` in `core/model/series.ts` groeit met `waterTension`, `pF`,
`waterPercentage`, `bijvulruimte`, `soilTemp`, `temp10` en `humidity10`. De pillenrij
is al een horizontale scroller. Welke pillen zichtbaar zijn volgt uit wat er staat:
een locatie zonder plaatsing houdt de huidige zes.

- **Zuigspanning is de eerste klant van de drempellijn-prop** uit de indicatorlaag —
  niet van een eigen `bands`-mechanisme. Vier grenzen per perceel (veldcapaciteit,
  suboptimaal, beregen nu, kritiek), overgenomen uit `agroapp/static/javascript/soil.js`.
  Wie dit hier goed krijgt, krijgt de 18 km/u-lijn op wind gratis.
- **De grenzen komen uit de plaatsing**, dus ze stappen mee op een plaatsingsgrens.
- **pF krijgt een vaste as** (0–4,2) in plaats van een meeschalende: logaritmisch en
  meeschalend samen maakt van een natte week één rechte streep.
- **Bijvulruimte deelt de as met neerslag**, zodat zichtbaar is dat een bui van 8 mm
  de 33 mm ruimte niet vulde.
- **Ophalen is een kopie van wat er staat, met andere paden**: `fetchSoilRange` →
  `/soil_aggregates/{id}/` voor hourly, `fetchSoilReadings` → `/soilreadings/{id}/`
  voor het één-dagsvenster. Zelfde `dd-mm-YYYY`-datumconversie (`apiDay`), zelfde
  `bucket_size`, zelfde NDJSON-tolerante `parseRows`, zelfde meet-solid /
  voorspel-dashed-regel. Let op: `/soil_aggregates/` laat rijen jonger dan dertig
  minuten weg, dus het laatste halfuur komt alleen uit `/soilreadings/`.

## 7. 'Vooruitzicht'

Eén extra laag in `LAYERS` (`core/model/layers.ts`), alleen zichtbaar op een locatie
met een plaatsing: **toestand per dag** in de statuskleur, met de verdamping als
tweede getal (`values.et0` zit al in `resolveDayValues`). Erboven één zin die het
besluit geeft — "Zonder neerslag beregenen op donderdag", of "De 6 mm van woensdag
houdt u tot zaterdag".

Op 'Grafiek' loopt de zuigspanningslijn gestippeld door na nu, zoals elke andere
grootheid daar al doet: `buildSeries` markeert elk sample al met zijn bron.

## 8. Wat bodem aan de andere indicatoren toevoegt

- **Beregening wordt gemeten in plaats van gemodelleerd.** "Droogte-oploop" en
  "beregeningsprioriteit" zijn nu afgeleiden van neerslag en verdamping; met een
  SoilExact is het een meting in de wortelzone. Dat is ook het argument richting
  Dacom en Agrovision: de meeste DSS'en draaien op een regionaal weerbestand.
- **De RV-rekenkern gaat naar 10 cm** waar een CropExact staat. Smith, DIV, 10-10-48
  en trips draaien allemaal op aaneengesloten uren boven een RV-drempel. De meethoogte
  staat bij de indicator als herkomst: het is geen betere 1,50 m, het is een andere
  grootheid.
- **Bodemtemperatuur op diepte** is nu nergens beschikbaar en hoort bij bemesten
  (bevroren bodem, emissierisico) en berijdbaarheid.
- **Twee meldingen bestaan al.** `check_alerts` (`agroapp/models/models.py:970`)
  stuurt vandaag de overgangen *kritieke zuigspanning* en *beregen nu*. Stap 7 van de
  volgorde begint dus met twee overgangen die in productie bewezen zijn.

## 9. Twee eenheidsvallen

In de geest van `global_radiation`, dat J/cm² betekent op `/aggregates/` en W/m² op
`/readings/`. Beide horen aan de rand thuis, in `core/sources/agroexact.ts`, met een
test eromheen.

- **`bijvulruimte` uit de API is geen mm.** Het is een volumeprocent-verschil; mm
  ontstaat pas na `× placement_depth / 10`, zoals de webapp het doet
  (`agroapp/templates/agroapp/soil.html:131`). Vergeten betekent 11 tonen waar 33
  hoort.
- **`water_percentage`** staat in de API-documentatie als 0–1 en wordt als procent
  getoond. Pinnen tegen de live API voordat er een as omheen komt.

## 10. Tiering

Het criterium van het voorstel — één locatie is basis, over locaties heen is add-on,
partner is een andere bron — beslist dit zonder discussie.

| Basis | AgroIntelligence | Partner |
| --- | --- | --- |
| Bodemblokken op 'Actueel' | Beregeningsprioriteit over percelen | Partneradvies vervangt de indicator; de eigen meting blijft de onderbouwing eronder |
| Bodemreeksen met drempellijnen op 'Grafiek' | Spreidingsmelding over percelen | |
| Zuigspanningsverwachting en beregeningsdag | Gezamenlijk beregeningsvenster | |
| Voeding voor de ziektemodellen | Kans op drempeloverschrijding | |

Bodem hoort in de basis om dezelfde reden als de ziektemodellen: een bodem achter een
betaalmuur bereikt de meeste gebruikers nooit en telt dus niet mee in het gesprek met
een partner.

## 10b. Wat de live API op 17 september 2026 antwoordde

Gecontroleerd tegen `/soilstations/`, `/soilreadings/` en `/soil_aggregates/` op het
eigen account, voordat er code omheen kwam. Drie dingen die het plan raken.

**`/soilstations/` bevestigt de ontbrekende velden.** Elk van de 1181 sensoren geeft
exact tien velden: `station_id`, `name`, `latitude`, `longitude`, `version_type`,
`crop`, `placement_depth` en de drie drempels. Geen `soil`, geen `field_capacity`,
geen `last_reading_at` — punt 5 van §3 staat dus zoals het er staat. `version_type` is
BASIC (790), PLUS (81) of PRO (310); dat is *niet* de as SoilExact–CropExact. Wat
beslist of er een gewassensor is, is of de metingen `temperature_10` dragen, en dat
is per meting te zien in plaats van per station te raden.

**238 van de 1181 sensoren hebben `threshold_0_to_1 == threshold_1_to_2`.** Dat is
een vijfde van het bestand, en het is een echte instelling: op dat perceel is er geen
suboptimale band, het gaat van goed naar beregenen. Drempels moeten dus
*niet-dalend* zijn, niet strikt stijgend — een controle op strikt stijgend gooit een
vijfde van de drempels weg omdat hun eigenaar ze zo heeft gezet. Een omgekeerde
volgorde is wél een fout en levert geen drempellijn, met de sensor gewoon in de lijst.

**Alle bodemsensoren antwoordden leeg.** BASIC, PLUS en PRO, over vensters van 24 uur
tot een zomerweek in juli: `total: 0`. De winterstand van §1 is daarmee niet de
uitzondering maar de toestand waarin de meeste sensoren het grootste deel van het jaar
staan, en het is de eerste toestand die de app goed moet doen — niet de laatste.

Het gevolg voor §9: **de eenheden zijn niet gepind.** `water_percentage` en
`bijvulruimte` konden niet tegen echte waarden gehouden worden zoals
`global_radiation` dat wel is. `refillMm` volgt de webapp (vol-% × diepte / 10) en is
daarmee zo goed als de bron. `waterPercent` moet gokken, en doet dat langs de enige
grens waar bodemvocht niet dubbelzinnig over kan zijn — geen grond zit op of onder
1 vol-%, geen grond haalt 100 — in één functie, zodat pinnen later één regel is.

## 11. Volgorde

Ingevlochten in de veertien stappen van het integrale voorstel.

| | |
| --- | --- |
| 0 | `SoilPlacement`, bevroren drempels, `/placements/` — backend, voorwaarde voor al het andere |
| 1 | `indicators.ts` — zuigspanning als eerste indicator, niet wind |
| 2 | Drempellijnen in grafieken — zuigspanning als eerste klant |
| 3 | Profielwizard — voor een SoilExact staat het gewas al in de webapp |
| 4 | Indicatorblokjes in 'Actueel', bodem inbegrepen |
| 4b | Bodemreeksen op 'Grafiek', in plaatsingssegmenten |
| 4c | Zuigspanningsverwachting in API v2 → bodemlaag op 'Vooruitzicht' |
| 5 | Ziektemodellen, met RV en temperatuur op 10 cm waar een CropExact staat |
| 6–7 | Vensterbalk; meldingen op toestandsovergangen |
| 8–14 | Ongewijzigd; bodem voedt 9, 10 en 11 met data die niet uit een model komt |

Fase 1 van de app-kant (de bron in `core/sources/agroexact.ts`, met de eenheden en de
tests) is onafhankelijk van de backend en kan meteen.

## Wat er nu in de app staat

Fase 1 is gebouwd en staat los van de backend:

- `core/model/soil.ts` — `Placement`, `SoilThresholds`, `SoilStatus`, de twee
  eenheidsomrekeningen (`refillMm`, `waterPercent`), de winterstand (`isDormant`) en
  het splitsen van een reeks op plaatsingsgrenzen (`placementAt`,
  `segmentByPlacement`). Zolang `/placements/` er niet is, maakt
  `placementFromStation` de ene lopende plaatsing die de huidige instellingen
  beschrijven, gemarkeerd `assumed` zodat een pagina "instellingen onbekend vóór
  «datum»" kan zeggen in plaats van een bevroren drempel te suggereren die er niet is.
- `core/sources/agroexact.ts` — `fetchSoilStations`, `fetchLatestSoilMeasurement`,
  `fetchSoilRange` (`/soil_aggregates/`, uur, eind-van-het-uur gecorrigeerd) en
  `fetchSoilReadings` (`/soilreadings/`, halfuur). Dezelfde `dd-mm-YYYY`-conversie,
  dezelfde NDJSON-tolerante rijlezer, dezelfde oudste-eerst-volgorde als de weerkant.
- `tests/soil.test.ts` — dertien tests om de besluiten heen: de drempelbanden en de
  samenvallende drempel, de twee eenheidsvallen, het uur dat een uur terug hoort, de
  lege reeks, de plaatsingssplitsing en de winterstand.

Stap 1 van de volgorde — zuigspanning als eerste indicator in `indicators.ts` — is
hiermee aan de beurt, met de drempels die de bron al meelevert.

## Nog open

- De grens van ~2 km waarbinnen een SoilExact aan een bestaande locatie wordt
  gekoppeld in plaats van een eigen locatie te worden — voorlopig een aanname.
- Of oude plaatsingen ook op de kaart zichtbaar moeten zijn, of alleen in de grafiek.
- Zuigspanningsbubbels per perceel op de volledige kaart, in de vorm van de
  cumulatieve neerslaglaag. Niet ingepland, wel voor de hand liggend.
