# De modellen: wat de app zegt, waarop, en op wiens gezag

Elk oordeel dat de app uitspreekt is een model: een regel met een grens eronder. Dit
bestand is de index ervan — vijftien modellen, zesenzestig drempels, waar ze
verschijnen en welke tekst ze gebruiken. Vastgelegd 18 september 2026.

De cliëntversie hiervan is een apart artifact van tien A4-bladen, `Modellen en
drempels`, met de bronnenlijst en de openstaande punten erbij. Wat daar staat komt
uit deze drie bestanden; wijzigt er een drempel, dan wijzigt het daar ook.

## De drie bestanden waar alles samenkomt

| | |
| --- | --- |
| `core/thresholds.ts` | **elk getal**, met eenheid, herkomst (`legal` / `published` / `practice` / `app`) en bronverwijzing. Modules lezen hieruit; ze houden geen eigen kopie. |
| `core/i18n/*Strings.ts` | **elke tekst**, per model: `alertStrings`, `adviceStrings`, `diseaseStrings`, `agroIntelStrings`, `layerStrings`. Vijf talen per bestand. |
| `core/notifyScope.ts` | **wie mag melden**, en de drie poorten waar dat langs moet. |

De modellen zelf bevatten geen getallen en geen woorden meer — alleen de regel.

### De aliassen

`fieldAdvice` exporteert nog steeds `SPRAY_WIND_MAX`; dat is nu
`threshold('spray.wind')` in plaats van een letterlijke 18. De naam blijft omdat de
regel er beter van leest, het getal verhuist omdat een getal dat niemand kan opzoeken
een getal is waar niemand het mee oneens kan zijn. `tests/thresholds.test.ts` bewaakt
dat de twee niet uit elkaar lopen.

### Waarom `basis` het belangrijkste veld is

- **legal** — staat in de wet. Niet aan ons om te verschuiven. Twee stuks:
  spuiten boven 5 m/s, en uitrijden op bevroren grond.
- **published** — van een genoemd model of instituut (Smith, IRS, KNMI). Ons werk is
  het getrouw implementeren, niet het bijstellen.
- **practice** — wat een Nederlandse teler of adviseur herkent, zonder één publicatie
  eronder. Verdedigbaar en bediscussieerbaar.
- **app** — onze eigen keuze, meestal een bar waaronder een zin zwijgt. Eerste
  kandidaten voor herziening, en daarom gemarkeerd.
- De bodemdrempels staan **niet** in het register: die komen per perceel uit
  `/soilstations/`, berekend uit grondsoort en gewas, en zijn bevroren per plaatsing.

## De modellen

Laag: **B** = basisversie · **A** = AgroIntelligence add-on.

| # | Model | Laag | Data | Drempels | Waar | Tekst |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Significant weer (`alert`) | B | 12 u verwachting: windstoten, WMO-code, neerslag, temperatuur; radar-nowcast voor het beginmoment | `alert.*` | Blok op 'Nu'; melding (regen/wind/vorst) | `alertStrings` |
| 2 | Eigen drempels (`userAlerts`) | B | de blokwaarde van 'Actueel', per station | door de lezer zelf gezet | Lijst in Meldingen; melding | `appStrings` (alert*) |
| 3 | Smith-periode | B | uren ≥ 90 % RV en dagminimum, 7 dagen | `smith.*` | Kaart op 'Nu', blokje, widget, reeks op 'Grafiek' | `diseaseStrings` |
| 4 | Cercospora-DIV | B | dezelfde uren, via de DIV-tabel | `cercospora.*` | idem | `diseaseStrings` |
| 5 | Bladnat (proxy) | B | RV ≥ 95 % of neerslag in het uur | `leafWet.humidity` | Regel onder de ziektekaart | `diseaseStrings` |
| 6 | Spuitvenster | B | uurverwachting: wind, temperatuur, RV (Delta T), neerslag, dag/nacht | `spray.*` | Kaart op 'Nu', blokje, widgetregel, **lijn in de windgrafiek** | `adviceStrings` |
| 7 | Vorst (veld) | B | uurtemperatuur 72 u; RV voor de natbol | `frost.*` | Kaart, blokje, widgetregel | `adviceStrings` |
| 8 | Werkbaarheid (perceel) | B | waterbalans 7 en 14 dagen; dagneerslag | `workability.*` | Kaart, blokje, widgetregel | `adviceStrings` |
| 9 | Bemesten | B | uurtemperatuur, RV, neerslag 48 u; T-som indien aangereikt | `fertilise.*` | Kaart, blokje, widgetregel | `adviceStrings` |
| 10 | Werkvenster (`werkbaar weer`) | B | uurverwachting per locatie, 24 u | `workWindow.*` | Widget 'Werkbaar weer'; voedt 11 en 13 | `appStrings` (ov*) |
| 11 | Attentielijst | B | 10 plus 24-uurs neerslag, verwachte neerslag, nachtminimum | `attention.*` | Widget 'Wat vraagt aandacht' | `appStrings` (adv*) |
| 12 | Bulletin | B | alle locaties: neerslag, temperatuur, wind, werkvenster | `brief.*` | Widget 'Samenvatting' | `appStrings` (bri*) |
| 13 | Gebiedsconclusies | A | werkvensters, 24-uurs neerslag, de uitspraken van 6–9 | `area.*` | Widget 'Over je locaties heen' | `agroIntelStrings` |
| 14 | Kansen | A | ensemble: 51 leden, dagneerslag en dagminimum | `risk.*` | Widget 'Kansen' | `agroIntelStrings` |
| 15 | Vensters vergelijken | A | werkvenster per dag plus ensemble-overeenstemming | `workWindow.*` | Widget 'Vensters vergelijken' | `agroIntelStrings` |

## 'Werkbaar weer' hoort nu bij de werkbaarheidsfamilie

Model 10 rekende met zijn eigen drempels (0,1 mm · 20 km/u · 1 °C) en zat in geen
enkele laag: wie de werkbaarheidsfamilie uitzette, hield op de widgetpagina precies
dezelfde percelen op dezelfde regels gerangschikt. Besloten 18 september: een widget
**draagt zijn laag**.

```ts
{ id: 'workability', size: 'full', needs: [...], component: 'workability', ... }
```

`widgetsFor(access)` filtert nu op twee dingen — de add-on én de basisonderdelen — en
`neededSources` leest dezelfde gefilterde lijst. Uit betekent ook hier: niet getekend,
niet aangeboden, niet opgehaald. Hetzelfde geldt voor de attentielijst (11, ook
werkbaarheid), het waarschuwingsblok (1, `alerts`) en de ziektewidget (3–4,
`disease`); de zin "waar het meeste werkbaar is" in het bulletin volgt dezelfde
schakelaar.

De windgrens van model 10 is **niet** de spuitgrens van model 6. De eerste is onze
eigen keuze voor machinewerk, de tweede is wettelijk en lager. Ze staan naast elkaar
in het register met verschillende `basis`, en een test houdt ze uit elkaar.

## Meldingen

Drie poorten, alle drie open voordat er iets verstuurd wordt:

1. **De lezer heeft erom gevraagd** — `prefs.notifyAgro`, of de oudere
   `notifyRain` / `notifyWind` / `notifyFrost` voor het weerblok.
2. **Het onderdeel staat aan** — `basisComponentOn`.
3. **De laag is er** — voor de add-on: `prefs.agroIntel.enabled`.

Op de draad: `kinds` (weer) en `agroKinds` (de rest), zie `docs/push_contract.md`.
Vandaag verstuurt er **niets**: de dienst bestaat nog niet, en voor de agro-onderwerpen
is er ook geen lokale terugval zoals `core/notifications.ts` die voor het weer is.

Niet te melden, met opzet: het venstervergelijk (model 15). Dat is een manier van
kíjken naar drie dagen, geen moment waarop iets gebeurt — en een melding heeft een
moment nodig om over te gaan.

## Wat nog niet klopt of nog moet

- **De DIV-tabel is niet tegen de IRS-publicatie gelegd.** Staat als `caveat` bij de
  bron. Een tabel die te laag scoort vertelt een teler dat zijn biet veilig is.
- **`app`-drempels zijn eerste concepten** — vijfendertig stuks. Ze zijn nu vindbaar, wat
  de voorwaarde is om ze te herzien.
- **De T-som** wacht op een seizoen aan dagwaarden; **trips** en **10-10-48** op een
  biofix. Beide backend.
- **De risicobereidheid** moet in de push-registratie voordat een dienst model 14 kan
  versturen: die verschuift de sporten van de ladder met vijftien punten.
