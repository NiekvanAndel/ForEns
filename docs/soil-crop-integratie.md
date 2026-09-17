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
| Locatie | Een plaatsing wordt een **eigen locatie**, behalve wanneer er al een gewone plek binnen **200 m** ligt. Een locatie die een **weerstation** draagt wordt nooit gastheer, hoe dichtbij ook: twee instrumenten die verschillende vragen beantwoorden krijgen twee pagina's. (Was ~2 km; 17 sep teruggebracht naar 200 m, en daarna het weerstation uitgezonderd.) |
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

**`/soilstations/` bevestigt de ontbrekende velden.** Elk van de 1181 sensoren in die
vlootbrede lijst geeft
exact tien velden: `station_id`, `name`, `latitude`, `longitude`, `version_type`,
`crop`, `placement_depth` en de drie drempels. Geen `soil`, geen `field_capacity`,
geen `last_reading_at` — punt 5 van §3 staat dus zoals het er staat.

`version_type` is BASIC (790), PLUS (81) of PRO (310), en zegt **precies** welke
voelers erin zitten:

| | zuigspanning | neerslag | lucht op 10 cm |
| --- | --- | --- | --- |
| BASIC | ✓ | | |
| PLUS | ✓ | ✓ | |
| PRO | ✓ | ✓ | ✓ |

> **Gecorrigeerd op 17 sep.** Hier stond eerst dat `version_type` hier níets over zegt
> en dat je aan de metingen moest zien of er een voeler op 10 cm zit. Dat was een gok,
> en een dure: een null kan "die voeler bestaat niet" niet onderscheiden van "die
> voeler zwijgt", en juist dat onderscheid is waar de hele indicatorlaag op rust.
> `soilCapabilities` beantwoordt het nu zonder request, en `soilProbeSilent` maakt er
> de vraag van die er werkelijk toe doet: is dit een BASIC zonder voeler, of een PRO
> die stuk is?

**238 van de 1181 sensoren hebben `threshold_0_to_1 == threshold_1_to_2`.** Dat is
een vijfde van de vloot, en het is een echte instelling: op dat perceel is er geen
suboptimale band, het gaat van goed naar beregenen. Drempels moeten dus
*niet-dalend* zijn, niet strikt stijgend — een controle op strikt stijgend gooit een
vijfde van de drempels weg omdat hun eigenaar ze zo heeft gezet. Een omgekeerde
volgorde is wél een fout en levert geen drempellijn, met de sensor gewoon in de lijst.

**De vijf gesampelde sensoren antwoordden leeg** — BASIC, PLUS en PRO, over vensters
van 24 uur tot een zomerweek in juli: `total: 0`.

> **Gecorrigeerd na de eerste aansluiting.** Hier stond eerst "alle bodemsensoren
> antwoordden leeg". Dat was een veralgemenisering van vijf steekproeven naar 1181
> sensoren, en hij klopt niet: zodra de app zelf `/soilreadings/` aanriep kwam er
> gewoon een zuigspanning terug. Die vijf stonden uit; het endpoint doet het.
>
> Dezelfde controle legde een tweede ding bloot: de app ziet op dit account **vier**
> bodemsensoren, waar de lijst waarop de cijfers hierboven rusten er 1181 gaf. Dat zijn
> twee verschillende populaties — de statistieken hierboven beschrijven de vloot, niet
> wat één teler heeft. Voor de drempelregel maakt dat niet uit (een vijfde van de vloot
> is nog steeds te veel om als kapot te behandelen), voor elke uitspraak over "het
> account" wel.

De winterstand van §1 blijft daarmee gewoon staan als toestand die de app goed moet
doen — maar het is niet aangetoond dat het de toestand van de meeste sensoren is.

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

Stap 1 staat er ook:

- `core/model/indicators.ts` — de indicatorlaag zelf. `Indicator` draagt de zes
  eigenschappen van blad 1 (drempel, toestand, verloop, herkomst, zekerheid,
  geldigheidshorizon) en kent de drie vormen *momentaan*, *accumulerend* en
  *periode*. De vier eerlijkheidsregels zijn velden, geen commentaar: `horizon` is
  null zolang een reeks niets over de toekomst beweert, `certainty` is één klasse
  zonder decimalen, elk punt draagt `observed` voor massief tegenover gestippeld, en
  `provenance` zegt wat de waarde maakte — bij een proxy welke.
- `waterTensionIndicator` is de eerste klant. Elk veld komt uit iets dat al bestaat:
  de drempels uit de plaatsing, de toestand uit `status_code`, het verloop uit
  `/soil_aggregates/`, de herkomst uit gewas × grondsoort × diepte. De bevroren
  `status_code` wint van een herberekening — vorig seizoen tegen de drempels van
  vandaag narekenen is precies de terugwerkende herschrijving waarvoor de plaatsing
  bestaat. `statusFromTension` vult alleen in waar een rij géén status draagt.
- `tests/indicators.test.ts` — vijftien tests, met een test per eerlijkheidsregel.

Twee dingen die uit het bouwen zelf volgden en nergens stonden:

- **De bindende drempel bij een samenvallend paar is de hoogste van de twee.** Bij
  `scarce == irrigate` zegt de badge "grens 19,9 — beregen nu", niet "suboptimaal".
- **De hoeveelheid komt van dezelfde meting als de toestand**, niet van het eind van
  de reeks. Zolang er geen verwachting in de reeks zit is dat hetzelfde punt; vanaf
  stap 4c niet meer, en dan zou er een bijvulling van morgen naast een meting van
  vanochtend staan.

`next` — de eerstvolgende toestandsovergang — is nu altijd null, omdat de reeks
alleen metingen bevat. Dat is het eerlijke antwoord en geen ontbrekende functie:
zodra de zuigspanningsverwachting van stap 4c in dezelfde reeks landt, begint
dezelfde functie "passeert 45 om 11:20" te antwoorden zonder te veranderen.

Stap 2 staat er ook: **de drempellijn is één prop.**

- `ui/graph/SeriesChart.tsx` krijgt `thresholds?: ChartThreshold[]` — per grens een
  waarde, een kleur, een label en of de zone erboven getint wordt. Geen eigen
  `bands`-mechanisme: de indicator kent zijn grenzen al, dus de grafiek krijgt ze
  aangereikt. Wat hier voor zuigspanning getekend wordt, tekent straks de 18 km/u-lijn
  op wind met één entry.
- `ChartThreshold` draagt een optionele `from`/`to` in sample-indices, zodat een grens
  die halverwege het venster wisselt daar ook stopt. Dat is de haak voor stap 4b: een
  sensor die halverwege het seizoen verhuist heeft twee drempelsets, en één lijn dwars
  over de reeks zet de eerste helft onder een grens die er nooit gold.
- De rekenkant staat puur in `indicators.ts` (`thresholdsInPlay`, `thresholdZones`) en
  is getest; de component tekent alleen.

Drie beslissingen die tijdens het bouwen vielen:

- **Welke grenzen meedoen.** Een grens ver buiten de reeks wordt niet getekend. Niet
  om hem te verbergen, maar omdat de as ernaartoe rekken de reeks platdrukt: het
  account heeft percelen waarvan de kritieke grens tienmaal de zomerzuigspanning is,
  en een as tot 200 kPa toont de grens en verder niets. De regel staat als wat hij
  beschermt — **de reeks houdt minstens een kwart van de ashoogte** — en niet als een
  afstand, want een afstand werkt niet op een vlakke dag.
- **De zone onder de laagste grens blijft ongekleurd.** Waar niets aan de hand is
  wordt niets ingekleurd; het luidste middel van de grafiek hoort niet naar zijn minst
  interessante toestand te gaan.
- **Een samengevallen band krijgt geen hoogte**, en tekent dus niets, in plaats van een
  streepje in de kleur van een toestand waar dat perceel nooit in kan staan.

Nog geen pagina geeft de prop mee: de bodemreeksen op 'Grafiek' zijn stap 4b, en
zuigspanning is volgens blad 3 de eerste klant. Wind en Delta T staan er in de
volgorde expliciet áchter.

### Eerste aansluiting op een scherm

Tussen stap 2 en 3 in, en buiten de volgorde om: tot hier riep niets in de app de
bodemcode aan, dus er was niets te zien of te controleren. Daarom is er nu één rij op
Instellingen → Integraties → AgroExact:

- `state/soilStations.ts` — `useAgroSoilStations` (de lijst) en `useNearestSoilSensor`
  (de dichtstbijzijnde sensor bij de eerste locatie, plus zijn laatste meting). Apart
  van `state/stations.ts` gehouden: een bodemsensor is geen weerstation met andere
  velden, en de twee syncs gaan uiteenlopen zodra de plaatsingen er zijn.
- Eén extra call, niet één per sensor: de vraag "komt er data binnen" wordt door één
  sensor beantwoord, en een vlootbrede lijst loopt in de duizenden.
- **Geen straal.** Een sensor op tachtig kilometer wordt gemeld als tachtig kilometer,
  niet verborgen achter een grens die deze app had moeten verzinnen. De afstand is het
  antwoord op "is dit de mijne", en de lezer is daar beter in dan een constante.
- **"Niet actief" is een toestand**, geen storing — ook als er helemaal geen meting is.
  Een sensor die eruit ligt is het normale najaar.

**Uitkomst van die controle, 17 september:** vier sensoren op het account, en de
dichtstbijzijnde bij de eerste locatie staat op **287 km** en meet **34 kPa**. Dus: de
keten werkt end-to-end, er komt wel degelijk data binnen, en de keuze om geen straal te
hanteren was de juiste — met de ~2 km uit §1 was er niets te zien geweest.

Die 287 km zegt ook iets voor stap 4: op dit account ligt géén bodemsensor bij een
bestaande weerlocatie in de buurt, dus alle vier worden ze een eigen locatie. De
koppelregel van §1 is hier dood materiaal, en de sensor-als-locatie is het pad dat
werkelijk gelopen wordt.

### Stap 4 — de blokken zelf

Stap 3 (profielwizard) is voor bodem een lege stap: het gewas staat al in de webapp,
en de wizard levert pas iets op bij de ziektemodellen van stap 5. Dus door naar 4.

- `core/model/soilTiles.ts` — dezelfde `Tile`-vorm als `modelTiles`, zodat
  `arrangeTiles` en de blokkeneditor ze zonder wijziging dragen: slepen en uitzetten
  werkt, en niemands indeling breekt.
- `TileKind` groeit met `kpa`, `pf` en `status`. De eerste twee hebben geen
  lezerseenheid om naar om te rekenen; `status` is geen grootheid maar een niveau dat
  de pagina in woorden zet — een blok met "2" erin vraagt de lezer de nummering van de
  API te kennen.
- **Bladnat krijgt geen blok.** Twee redenen die elk los al genoeg zijn: `leaf_wet`
  zit nog niet in API v2, en het is afgeleid in plaats van gemeten. Het hoort dus een
  ja/nee-blok te worden met "proxy" erop, niet een getal tussen de metingen. Beide
  eerst beslissen, dan pas tonen.
- **De blokken verdwijnen bij winterstand**, en ook bij helemaal geen meting. Een
  raster streepjes zegt dat er een sensor staat die zwijgt, en dat is een alarmerender
  bewering dan geen bodemblokken.
- "Bij te vullen" verschijnt vanaf status ≥ 1, terwijl de badge pas vanaf ≥ 2 een
  hoeveelheid noemt. Dat is met opzet: een blok in een raster cijfers is een cijfer, en
  een badge die een hoeveelheid noemt is een advies.

Eén ding dat tsc afdwong en de moeite van het opschrijven waard is: `UserAlert.kind`
is teruggebracht van `TileKind` naar een smallere `AlertKind`. Een regel kijkt naar
**weerstations**, dus een regel op zuigspanning zou opslaan en nooit afgaan. De knop
"melding toevoegen" verschijnt daarom niet op een bodemblok. Zuigspanning zou juist de
beste regel in de app zijn — het is de enige grootheid die met eigen drempels
binnenkomt — maar dat vraagt dat de regelmachinerie bodemsensoren leert kennen.

### De koppeling, en de 200 meter

`SavedLocation` krijgt `soilStationId`, en `syncSoilLocations` in `core/prefs.ts` doet
per sensor één van drie dingen: koppelen aan een **gewone** plek binnen 200 m — een
locatie met een weerstation erop komt daar niet voor in aanmerking, hoe dichtbij ook,
want de pagina van een weerpaal gaat over de lucht boven een streek en die van een
bodemsensor over het water in één perceel — anders een eigen locatie worden met de
**perceelnaam** (geen reverse-geocode: vier percelen rond één
dorp zouden anders alle vier naar dat dorp heten), en per plek hoogstens één sensor —
twee sensoren op één plek zijn twee percelen, en de tweede mag de metingen van de
eerste niet overschrijven.

Drie dingen die pas bij het bouwen bleken:

- **De stationsync gooide elke bodemlocatie meteen weer weg.** Die verwijdert elke
  `agroexact`-locatie zonder weerstation, en een bodemlocatie heeft er nooit één gehad.
  Eén verversing van de stationslijst had alle percelen van het account gewist.
- **Loskoppelen liet de bodembinding hangen** op een plek die de gebruiker zelf had
  opgeslagen — die is immers geen `agroexact`-locatie. De app zou een uitgelogd account
  om metingen blijven vragen. Door een test gevonden.
- **De volgorde van de twee syncs doet ertoe.** Draait de bodemsync eerst, dan is er
  nog geen plek om aan te koppelen en maakt de sensor een eigen pagina; daarna zet de
  stationsync een paal vijftig meter verderop als tweede pagina voor dezelfde grond.
  Een perceel dat zo'n gastheer heeft gekregen wordt daarom teruggevouwen, en de sync
  draait opnieuw zodra de koppelbare plekken veranderen.

Op 'Actueel' schuiven de bodemblokken in dezelfde lijst als de rest, dus
`arrangeTiles` plaatst ze en de blokkeneditor toont ze. Eronder staat de herkomstregel
— gewas · grondsoort · sensordiepte — omdat 48 kPa op zand onder uien iets anders
betekent dan op zware klei onder aardappelen.

### Stap 4b — de reeksen op 'Grafiek'

`core/model/soilSeries.ts` staat náást `buildSeries` en niet erin. Een weerreeks mengt
meting en model per uur en loopt door na nu; een bodemreeks heeft geen model achter
zich — `/soil_aggregates/` is alles wat er is, en de zuigspanningsverwachting zit in de
webapp maar niet in API v2. De weerbouwer daaromheen buigen betekent een merge zonder
iets om te mergen en een toekomsthelft die altijd leeg is. Wat ze wél delen is de vorm:
beide leveren de app's eigen `Sample`, dus `SeriesChart` tekent ze met dezelfde as,
dezelfde cursor en de drempellijnen van stap 2.

- **Zuigspanning is de eerste klant van die drempellijn.** Vier grenzen uit de
  plaatsing, per perceel anders, met de zones erboven getint.
- **pF krijgt een vaste as 0–4,2.** Logaritmisch én meeschalend samen maakt van een
  natte week één rechte streep — precies het enige wat de lezer kwam zien.
- **Zuigspanning krijgt géén vaste bovengrens.** De drempels bepalen hoever de as
  reikt, en die verschillen per perceel.
- **Welke pillen verschijnen volgt uit twee filters.** Het model van de sensor zegt
  welke voelers er zijn — dat is hardware, dus een BASIC biedt nooit een 10 cm-pil, hoe
  het venster ook liep — en de metingen zeggen of er iets terugkwam, want een pil naar
  een lege grafiek geeft de lezer de schuld.
- **Een gat blijft een gat.** De sensor meet elk halfuur en die gaten zijn echt; een
  lijn die er stilletjes overheen loopt zegt dat er gemeten is waar dat niet zo is.
- Een venster langer dan drie dagen vouwt naar één punt per dag met de spreiding als
  band — een perceel dat van 20 naar 55 kPa liep en een perceel dat op 37 stond zijn
  dezelfde lijn en heel verschillende dagen.
- Swipe je naar een locatie zonder die sensor, dan springt de pil terug: een lege
  grafiek met een geselecteerde pil leest als een storing.

**Nog niet gedaan binnen 4b:** de plaatsingssegmenten. `ChartThreshold` draagt de
`from`/`to` ervoor en `segmentByPlacement` staat klaar, maar zolang er geen
`/placements/` is kent de app één plaatsing en is er niets te splitsen. Dat wordt echt
werk zodra de backend stap 0 levert.

### De neerslag-merge

Besloten in §5 en nu gebouwd: **regen en beregening zijn één getal.** Een perceel dat
acht millimeter kreeg vraagt niet wie ze leverde, en twee blokken naast elkaar — één
met 8 en één met 4 — zou de lezer vragen zijn eigen perceel op te tellen.

- `fetchSoilHours` haalt de laatste 26 uur op, want de blokken sommeren over vensters
  van uren; één laatste meting kan "hoeveel viel er in zes uur" niet beantwoorden.
- `applySoilPrecip` zet die neerslag in de uren die er al zijn, en raakt verder niets
  aan: een bodemsensor heeft geen thermometer op 1,50 m en geen anemometer.
- **Een BASIC wordt overgeslagen.** Die heeft geen regenmeter, en een groene stip
  achter een modelgetal is precies wat de per-grootheid-merge moet voorkomen. Sinds
  `version_type` bekend is, is dat een feit in plaats van een gok.
- **Geen `station`-overlay.** Die is wat de hero leest om "gemeten om 14:20" naast een
  *temperatuur* te zetten, en deze sensor heeft over de temperatuur niets gezegd. De
  stip reist daarom als losse vlag naast het model mee (`precipIsMeasured`), niet erop.
- De merge geeft hetzelfde object terug als er niets te mergen valt, zodat de urenstrip
  niet elke verversing opnieuw tekent.

Daarmee is §5 af op één punt na: de vergelijkrij over locaties voor bodemblokken.

### Gemeten tegenover aangevuld, en de kaart van een perceel

Onder een kop die 'Meetwaarde' heet stond een gemodelleerde temperatuur naast een
gemeten zuigspanning, en las precies zo waar. Vier plekken waar dat nu uit elkaar
gehaald is.

- **'Grafiek': de pillenrij splitst in tweeën** — *hier gemeten* met de groene stip,
  en daaronder *aangevuld uit het model*. Per grootheid bepaald en niet per station:
  met externe aanvulling aan geeft een regenmeter een volledig record terug, en de
  temperatuur daarin is geen meting. Zonder instrument blijft het de ene rij die het
  was.
- **'Actueel': gemeten blokken vooraan** in de natuurlijke volgorde. Een stabiele
  partitie, en alleen de *natuurlijke* volgorde — wie zijn raster zelf heeft ingedeeld
  merkt er niets van.
- **Een perceel bewaart zijn eigen indeling** (`prefs.soilTiles`). Op een perceel open
  je de app voor de zuigspanning, op een dorp voor de regen; één gedeelde indeling zou
  betekenen dat elk bodemblok dat naar boven gesleept wordt ook de gewone pagina's
  herordent.
- **Het vergelijkscherm werkt door voor bodemblokken** — het laatste punt van §5. Tik
  op zuigspanning en alle percelen staan ernaast, het droogste eerst, elk met gewas en
  diepte eronder. Alleen locaties met een sensor: een dorp heeft geen antwoord op hoe
  droog het op dertig centimeter is.

En op 'Nu' vervangt `SoilHero` de weerhero op een perceel. Die leidde met een
temperatuur die voor de streek gemodelleerd is, op een pagina die over één perceel
gaat, en liet de meting die vandaag beslist helemaal weg. De kaart volgt die van de
webapp, met wat deze app eerlijk kan tonen: geen serienummer en geen grondsoort, want
geen van beide zit in API v2.

De balk eronder is de indicatorlaag getekend: vier zones uit de drempels van dít
perceel met de meting erin. Een samengevallen band krijgt geen breedte en tekent dus
niets. Elke volgende indicator kan zo getekend worden zodra hij grenzen heeft die het
waard zijn.

Eén bug die het bouwen opleverde: de laatste meting werd op UTC gebucket terwijl
`nowHour` een lokale sleutel is. Westelijk van Greenwich valt die meting daarmee in de
toekomst, telt `buildIndicator` hem niet als de huidige toestand, en verdwijnt de balk.
De offset van de locatie gaat nu mee.

## Nog open

- ~~De grens van ~2 km waarbinnen een SoilExact aan een bestaande locatie wordt
  gekoppeld~~ — **beantwoord: 200 m.** Een bodemsensor meet het water in één perceel,
  en op twee kilometer sta je op dat van de buren. Het gevolg is met opzet: vrijwel
  geen enkele sensor valt erbinnen, dus vrijwel elke sensor wordt een eigen locatie.
  Een ruimere straal had minder pagina's opgeleverd én zuigspanning aan de verkeerde
  grond gehangen, en van die twee is dat de fout die je niet ziet.
- Of oude plaatsingen ook op de kaart zichtbaar moeten zijn, of alleen in de grafiek.
- Zuigspanningsbubbels per perceel op de volledige kaart, in de vorm van de
  cumulatieve neerslaglaag. Niet ingepland, wel voor de hand liggend.
