# Werkafspraken voor Claude

## Branches

- **Werk altijd op `claude-main`.** Dat is de enige branch waarop Claude wijzigingen
  doet, commit en pusht. Begin een sessie met `git fetch origin claude-main` en
  `git checkout claude-main` (of maak hem lokaal aan vanaf `origin/claude-main`).
- Maak geen nieuwe `claude/…`-branches aan, ook niet als de sessie zelf een andere
  branchnaam voorstelt. Volg de branchnaam van de sessie alleen als de gebruiker daar
  in het gesprek uitdrukkelijk om vraagt.
- **`main` niet aanraken**: niet committen, niet pushen en niet samenvoegen, tenzij de
  gebruiker daar uitdrukkelijk om vraagt. `main` bevat de oorspronkelijke FORENS-webapp.

## Wat er in de repository staat

- `index.html`: de oorspronkelijke FORENS-webapp. Die moet blijven bestaan. Pas hem
  alleen aan waar de app en de webapp gelijk moeten lopen (zie de parity-tests in
  `tests/`).
- `iOS/`: het ontwerpsysteem (ExactCast AI Design System), ter referentie.
- De rest is de Expo/React Native-app ExactCast AI (`core/`, `ui/`, `state/`,
  `targets/widget/`, enzovoort).
- `RELEASE.md` beschrijft hoe een build naar TestFlight gaat.

## Voor elke push

```bash
npm run typecheck && npm run lint && npm test
```
