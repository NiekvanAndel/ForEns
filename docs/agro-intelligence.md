# AgroIntelligence — de tweede laag

Blad 2, §4 van het integrale voorstel, in code. Vastgelegd 18 september 2026.

Onderdeel **A** (gebiedsconclusies), **B** (zekerheid als product) en **D** (vergelijken
in beeld) staan er. Onderdeel **C** (AI) is bewust uitgesteld; zie onderaan.

## De grens tussen de twee lagen

De basisversie beantwoordt alles wat over **één locatie** gaat, en doet dat de hele
dag. Deze laag is wat pas ontstaat als je locaties náást elkaar legt, of wat over de
verwachting zélf gaat. Die grens is niet alleen een verhaal in een voorstel: hij staat
in de catalogus. Een widget draagt `tier: 'agroIntel'`, en `widgetsFor` filtert de
lijst vóór de indeling.

Dat is wat het een laag maakt in plaats van een verzameling verborgen knopjes: met de
add-on uit worden zijn widgets **niet getekend, niet aangeboden in de editor en niet
opgehaald** — `neededSources` leest dezelfde gefilterde lijst. Een uitgezette laag kost
dus geen enkel request per locatie.

`prefs.agroIntel` is in alles behalve naam een licentievlag. Wordt de add-on verkocht,
dan zet een abonnement hem in plaats van een schakelaar, en verder hoeft er niets te
verhuizen. Daarom staat hij standaard **uit**.

| | |
| --- | --- |
| `core/areaConclusions.ts` | A — wat alleen over locaties heen te zeggen valt |
| `core/riskLadder.ts` | B — kans in plaats van waarde, met de escalatieladder |
| `core/dayWindows.ts` | D — de komende dagen als vensters, met zekerheid als verzadiging |
| `core/sources/ensembleOutlook.ts` | de minimumtemperatuur per lid, voor de vorstkans |
| `ui/overview/widgets.tsx` | `AreaWidget`, `RiskWidget`, `WindowsWidget` |
| `app/(tabs)/settings.tsx` | Instellingen → AgroIntelligence, met risicobereidheid |
| `core/notifyScope.ts` | of de gebiedsconclusies en de kansen mogen melden |
| `tests/agroIntelligence.test.ts` | 28 gevallen, waarvan een derde over de laaggrens |

## A · Gebiedsconclusies

Vier uitspraken, elk een zin die geen enkele perceelspagina kan maken:

| | |
| --- | --- |
| **Gezamenlijk venster** | Het eerstvolgende stuk waarin álle locaties tegelijk werkbaar zijn, per uur doorgesneden. Is er geen enkel uur, dan is het antwoord "hoogstens 6 van de 9" — een andere zin dan "geen venster", en de bruikbare. |
| **Volgorde** | Begin bij het perceel waarvan het venster het eerst sluit. Alleen onder de percelen die nú werkbaar zijn: een volgorde over percelen waar niemand op kan is een plan voor een dag die niet begonnen is. |
| **Spreiding** | "22 mm op Heesch, 1,4 mm op Rosmalen." Een verschil én een verhouding, want een verschil alleen noemt 30 en 19 een spreiding en een verhouding alleen noemt 0,3 en 0,1 er een. |
| **Ontdubbeling** | Vijf percelen die op wind stilliggen zijn één regel, geen vijf. Alleen wat dicht staat telt; een grens die op vijf percelen aandacht vraagt is geen vijf verloren percelen. |

Feiten, geen zinnen — dezelfde regel als `overviewBrief` en `overviewAdvice`. De
module draagt de getallen, de widget maakt er taal van, en daarmee blijft de laag
vertaalbaar.

Elke regel heeft een drempel waaronder hij zwijgt, en die drempels staan bovenaan het
bestand bij elkaar om ruzie over te maken. Een conclusie die elke ochtend afgaat is een
regel die de lezer leert over te slaan.

## B · Zekerheid als product

"65% kans op nachtvorst" in plaats van "−1 °C". De kans wordt **geteld over de leden**
— nooit afgeleid uit één run met een zelfgekozen spreiding — en daarvoor draagt de
ensemble-aanvraag nu ook `temperature_2m_min` mee. Eén veld extra op een aanvraag die
er toch al was.

De ladder heeft drie sporten, elk met een andere handeling: **30 in de gaten houden ·
60 voorbereiden · 85 handelen**. Eén instelling verschuift ze allemaal — de
risicobereidheid: *voorzichtig* haalt ze vijftien punten omlaag, *afwachtend* vijftien
omhoog. Niemand hoeft te weten wat p25 betekent; het alternatief was percentielknoppen,
en dan geeft de app het probleem van de modelleur aan de teler.

Daarnaast draagt elke regel of de verwachting zich heeft vastgelegd: boven 85% of onder
15% **kun je nu beslissen**, en wachten maakt het antwoord niet beter. Daartussen staat
er "nog open". Dat is de helft van een kans die een getal alleen nooit meedraagt.

En het aantal leden staat erbij: een kans over acht leden en een over eenenvijftig zijn
niet dezelfde bewering.

## D · Vergelijken in beeld

Eén rij per locatie, drie balken per rij — het werkbare deel van elke dag — en
**bleker waar de leden het minder eens zijn**. Verzadiging is zekerheid: eerlijkheids-
regel 2 in een vorm, zodat een vaste donderdag en een schim van een zaterdag er ook
verschillend uitzien. De balk voor één locatie hoort bij de basis; "donderdag kan
overal en vrijdag alleen in het noorden" is een zin die ze allemaal tegelijk nodig
heeft.

De dagen worden gesplitst op de **eigen kalenderdag van de locatie**, en vandaag is
kort omdat hij al begonnen is. De balk zegt dat door kort te zijn.

## Mogen ze melden?

Ja, als de lezer erom vraagt. Onder Instellingen → Meldingen staat een groep
**AgroIntelligence** met twee schakelaars: *gebiedsconclusies* (een gezamenlijk
venster, of meerdere percelen die op dezelfde grens stilliggen) en *kansen* (een kans
die een sport van de ladder haalt).

Drie poorten moeten open voordat er iets verstuurd wordt: de lezer heeft erom
gevraagd, het onderdeel staat aan, én de add-on is er. Die zijn met opzet apart —
"stop met dit uitrekenen" is iets anders dan "maak me hier niet wakker voor" — en de
groep verschijnt dan ook niet in Meldingen zolang de laag uitstaat. Zie
`core/notifyScope.ts`; de sport waarop `risk` afgaat hangt aan de risicobereidheid, en
dat veld moet nog aan het push-contract worden toegevoegd (`docs/push_contract.md`).

## Wat er bewust níét in zit

- **C · AI.** Uitgesteld op verzoek. De regelgebaseerde samenvatter waar blad 2 hem
  bovenop wilde zetten bestaat wél — `overviewBrief` en nu `areaConclusions` — dus
  wanneer C landt, is het een laag over bestaande feiten en geen vervanging ervan.
  Dat was ook het argument om hem zo te bouwen: de regels beslissen, de AI verwoordt.
- **Omslagmelding, stabiliteit en kalibratie** (punt 4 van §4B). **Komt niet in de
  app.** Besloten 18 september 2026: als dit ergens thuishoort is het een
  API-functie, niet iets wat een telefoon erbij gaat houden. Dat is ook de eerlijke
  plek ervoor — alle drie vragen om een archief van verwachtingen om die van vandaag
  tegen af te zetten, en zo'n archief hoort aan de serverkant, één keer, voor alle
  gebruikers samen. Een telefoon die zijn eigen verwachtingshistorie bijhoudt, kan
  alleen kalibreren tegen de dagen dat de app toevallig openstond.

  Wat dat voor de app betekent: stap 8 van de volgorde ("verwachtingshistorie
  opslaan") vervalt hier, en de drie uitspraken die eraan hingen komen terug zodra de
  API ze levert — dan zijn ze een bron, geen berekening.
- **Modelonenigheid tussen modellen.** De spreiding hier is die tussen de leden van
  één ensemble. Onenigheid tussen ECMWF en HARMONIE is een andere grootheid en wacht
  op de partnerverwachting van blad 2, §5.
- **Afwijkend station en beregeningsprioriteit.** Het eerste vraagt om een vergelijking
  tussen naburige stations die de app nog niet doet; het tweede staat al in de
  basisversie als de bodemwidget, die de percelen op droogte rangschikt.
