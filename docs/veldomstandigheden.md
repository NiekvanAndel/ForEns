# Veldomstandigheden: spuitvenster, vorst, werkbaarheid, bemesten

De vier regelgebaseerde families van de basislaag, naast de ziektemodellen die er al
staan. Vastgelegd 18 september 2026.

Blad 1 van het integrale voorstel noemt ze in §3, onder "wat erbij komt". Dit bestand
is de uitgewerkte versie, met de codeverwijzingen erbij.

## Waar het staat

| | |
| --- | --- |
| `core/model/psychro.ts` | natbol en Delta T (Stull 2011) — eigen kernel, want twee families lezen hem |
| `core/model/fieldAdvice.ts` | de vier families en hun grenzen; puur en woordloos |
| `ui/advice/words.ts` | hoe een uitspraak heet — één vocabulaire voor vier oppervlakken |
| `ui/nowcast/AdviceCard.tsx` | de kaart op 'Nu', één `IndicatorBadge` per uitspraak |
| `core/model/adviceTiles.ts` | de blokjes op 'Actueel', in dezelfde `Tile`-vorm als de rest |
| `core/nowCards.ts` | de kaartvolgorde op 'Nu' — potlood, met de conclusies onderaan |
| `core/overviewFieldAdvice.ts` | dezelfde uitspraken per locatie, voor de widgetpagina |
| `state/advice.ts` | één afleiding voor 'Nu', 'Actueel' en 'Grafiek' |
| `core/prefs.ts` | `AdviceLayer` — hoofdschakelaar plus wat er uit staat |
| `app/(tabs)/settings.tsx` | Instellingen → Adviezen |
| `tests/fieldAdvice.test.ts` | 46 gevallen, waarvan de helft over zwijgen gaat |
| `tests/adviceSurfaces.test.ts` | wat de oppervlakken ermee doen, vooral wat ze weglaten |

De opzet volgt `diseasePressure` en niet de generieke `Indicator` uit
`core/model/indicators.ts`. Reden: die vorm is één grootheid met een oplopende reeks
drempels, en een spuitvenster is een samenstelling van zes regels waarvan er twee
tweezijdig zijn (Delta T moet tussen 2 en 8 liggen). Wat wél gedeeld wordt is de
zekerheidsregel — `certaintyAt` staat in `indicators.ts` en wordt hier gebruikt, zodat
"matig" overal hetzelfde betekent.

## De grenzen

Elk getal is een wettelijke grens, een fysische drempel of gepubliceerde praktijk.
Geen ervan hangt van de boer af; dát is het criterium dat deze familie in de
basisversie houdt in plaats van achter de add-on.

| Familie | Regels | Grenzen |
| --- | --- | --- |
| **Spuitvenster** | wind, te koud, te warm, Delta T, regenvastheid, inversie | 18 km/u (5 m/s, wettelijk) · 1 °C · 25 °C · Delta T 2–8 · 0,2 mm binnen 2 u · < 5 km/u dat 3 uur aanhoudt |
| **Vorst** | nachtvorst, grondvorst, bloesemvorst, vorstberegening | 0 °C · 2 °C · −2 °C · natbol −5 °C |
| **Werkbaarheid** | berijdbaarheid, maaivenster, droogte-oploop | overschot 5 / 15 mm over 7 dagen · 3 dagen onder 1 mm · tekort 25 / 50 mm over 14 dagen |
| **Bemesten** | bevroren grond, emissierisico, uitspoeling, T-som | 0 °C (verbod) · 15 °C bij < 60 % RV · 25 mm binnen 48 u · T-som 180 |

De volgorde binnen het spuitvenster is niet willekeurig. Er wordt **één** reden
teruggegeven, want de badge heeft één regel en zes gestapelde waarschuwingen zijn
precies de muur tekst die deze laag vervangt. Eerst de wettelijke windgrens, dan de
temperaturen waarbij je überhaupt niet spuit, dan de fysica van de druppel, dan wat de
lucht gaat doen.

## Wat het weigert te doen

- **Niets spreekt voorbij zijn eigen horizon.** Elke uitspraak draagt `horizon`; het
  spuitvenster kijkt 48 uur, vorst 72, bemesten 48. Een spuitvenster op dag negen is
  geen venster maar een gok met een trekker eraan.
- **Een proxy noemt zichzelf.** Inversie wordt afgeleid uit een nacht die zijn wind
  kwijt is, grondvorst uit de schermtemperatuur op 1,50 m, en berijdbaarheid uit een
  waterbalans in plaats van uit de wortelzone. Alle drie dragen
  `provenance.kind = 'proxy'`, en de kaart zet dat op de regel zelf — niet in een
  voetnoot.
- **Een inversie waarschuwt, hij sluit niet.** Niveau 1, niet 2: de lezer kan naar
  buiten kijken en het er niet mee eens zijn, en dat kan hij bij de windgrens niet.
- **Het signaleert, het schrijft niet voor.** Onder de badges staat één zin die dat
  zegt. De variëteit, de machine, de vorige bespuiting en de loonwerkersagenda zitten
  geen van alle in deze app.
- **Geen getal zonder onderbouwing.** Een familie waarvan de invoer ontbreekt geeft
  niets terug. Berijdbaarheid zwijgt onder een dag historie, uitspoeling zwijgt op een
  droge verwachting, en de T-som zwijgt tot iemand hem een seizoen aanreikt.

## De T-som

`tSum(dailyMeans)` staat er als pure functie, maar de uitspraak verschijnt alleen als
de aanroeper een getal meegeeft. De app houdt een kleine twee weken weer vast en een
T-som telt vanaf 1 januari; een som over de veertien dagen die toevallig in het
geheugen zitten zou een getal zijn waar niemand naar kan handelen. Zodra de
stationshistorie van de grafiekpagina doorgegeven wordt, krijgt hij zijn getal — en
tot die tijd is de stilte het eerlijke antwoord.

## Aan en uit

`prefs.advice` is een `AdviceLayer`: een hoofdschakelaar plus een verzameling
familie-ids die uit staan, opgeslagen zoals `TileLayout` dat doet.

- Wie alleen de meetwaarden wil, zet de hele laag uit.
- Wie geen spuit heeft, zet één familie uit.
- Wat uit staat **wordt niet berekend** — `enabledAdviceFamilies` bepaalt wat er
  draait, niet wat er getekend wordt.
- Omdat het opgeslagen veld zegt wát er uit staat, verschijnt een familie die later
  bijkomt vanzelf voor wie dit vorige maand heeft ingesteld. De omgekeerde vorm ("dit
  zijn mijn onderdelen") zou elke volgende familie stilzwijgend onthouden aan precies
  de mensen die de moeite namen.

Instellingen → **Adviezen**. De indexrij zegt `Uit` of `3/4`, zodat de stand zichtbaar
is zonder de pagina te openen.

## Waar het te zien is

- **'Nu'** — een kaart met één badge per uitspraak. De kaartvolgorde op die pagina is
  nu van de lezer: potlood naast de plaatsnaam, dezelfde editor als op 'Actueel' en de
  widgetpagina. Ziektedruk en veldomstandigheden staan **standaard onderaan** — het
  zijn conclusies uit de metingen erboven, en een pagina die met vier oordelen opent
  bedient een teler in april en niemand in november. Twee gebaren zetten ze bovenaan.
  Alleen 'Nu ter plaatse' kan niet uit: dat is waar het tabblad naar heet.
- **'Actueel'** — een blokje per uitspraak, in dezelfde `Tile`-vorm als de rest, dus
  `arrangeTiles` en de editor dragen ze zonder te weten dat ze bestaan. De titel is de
  grootheid ("Wind", "Natbol", "Tekort 14 dagen") en het tijdlabel de familie, zodat
  een spuitblokje te onderscheiden is van het gewone windblokje ernaast. Nooit een
  groene stip: een spuitvenster is een conclusie, geen meting.
- **Widgetpagina** — één regel per locatie, ergste eerst, met de bindende reden erbij
  en `+2` als er meer speelt. Locaties waar niets aan de hand is vallen weg; een lijst
  van "goed, goed, goed" is een lijst waar niemand de bovenkant van leest. De
  korte-termijnverwachting draagt nu ook luchtvochtigheid en dag/nacht mee, zodat dit
  **geen extra request** kost — twee velden op een aanvraag die de pagina toch al doet.
- **'Grafiek'** — de spuitgrens als stippellijn dwars door de windgrafiek, met het
  gebied erboven gearceerd, in de eenheid van de lezer. Alleen wanneer het
  spuitvenster aanstaat: wie in Instellingen heeft gezegd niet te spuiten, krijgt geen
  rode lijn door zijn windgrafiek.

## Wat er nog niet in zit

- **Datakwaliteit** (station stil, regenmeter verdacht) — komt uit de API, geen eigen
  berekening nodig.
- **Vee** (THI ≥ 68) — bewust overgeslagen; de focus ligt op akkerbouw en fruitteelt.
- **De Delta T-grafiek.** De windgrafiek heeft zijn grens; Delta T heeft nog geen
  eigen reeks om er een lijn in te tekenen, en zijn band is tweezijdig — 2 tot 8 —
  waar `thresholdZones` van oplopende grenzen uitgaat.
- **Werkbaarheid op de widgetpagina.** Berijdbaarheid en droogte lezen een week en een
  veertiendaagse balans, en die houdt die pagina niet per locatie vast. `fieldAdvice`
  zwijgt er dan over, wat het eerlijke antwoord is — maar het is een gat.
- **Meldingen op toestandsovergangen.** Stap 7 van de volgorde, en met opzet het
  sluitstuk: pas als elke melding in de app te controleren is, mag hij afgaan. De
  vorm is er — een uitspraak draagt niveau, grens en horizon, dus een overgang is een
  verschil tussen twee draaiingen.
- **Een eigen vensterbalk.** De kaart noemt het venster in woorden ("Spuitbaar tot
  09:00"); de balk uit blad 2 van het voorstel is nog niet getekend.
