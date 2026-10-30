# PROJECT_ARCHIVE.md — Sapphire 3

## Initialisation du socle — 30 octobre 2026

- Environnement : Windows, Node.js 24.16.0, pnpm 11.5.0.
- `pnpm install` : première tentative bloquée par les scripts transitifs non approuvés sous pnpm 11. Configuration corrigée avec `allowBuilds: false` pour `bufferutil`, `es5-ext` et `utf-8-validate` ; nouvelle installation réussie.
- `pnpm build` : réussi avec Vite 8.3.5, React/React DOM 19.3.1 et plugin React 6.1.2.
- `pnpm desktop:setup` : téléchargement et extraction du runtime Neutralinojs 6.10.0 réussis avec neu 11.8.0.
- `pnpm dev` : Vite prêt sur `127.0.0.1:5173`, processus `neutralino-win_x64.exe` lancé. Accessibilité Windows : fenêtre titrée « Sapphire 3 », contenu Web contenant le titre et « Tout commence ici. ». Fermeture demandée via `CloseMainWindow`, résultat vrai.
- Aucune fonctionnalité métier, persistance ou API native à tester. Pas de publication, packaging de distribution, test sur autre OS ni vérification séparée de `pnpm preview`.
- `pnpm desktop:start` : tentative initiale rejetée car neu 11 ne propose plus `--frontend-lib-dev`. Script corrigé pour lancer directement le runtime Windows x64 après compilation. Fenêtre compilée contrôlée par l'accessibilité Windows : titre et contenu React présents, sans dépendre de Vite. Fenêtre laissée ouverte.
- `git diff --check` : aucune erreur d'espacement ; avertissement Windows de conversion LF/CRLF uniquement.

## Premier jet du canvas visuel — 30 octobre 2026

- Page unique décomposée en modules `Canvas` et `CanvasGrid`, sans fonctionnalité interactive ni dépendance supplémentaire.
- Quadrillage SVG à distorsion progressive, vignette CSS, surface plein viewport.
- Navigateur sur Vite : capture contrôlée visuellement ; viewport 752 × 670, surface 752 × 670,4 (arrondi des unités CSS), aucune dimension de défilement supplémentaire. Aucun message console de niveau erreur.
- `pnpm build` réussi. Pas de nouvelle vérification de la fenêtre native pour cet incrément visuel.

## Déplacement libre du canvas — 30 octobre 2026

- Hook de navigation locale : pointeur capturé, glisser gauche/central, gestion annulation/perte de capture, flèches clavier et focus visible. CSS `touch-action: none` pour laisser le geste au canvas.
- Grille recalculée avec une translation modulo l'espacement ; échelle SVG suivie par ResizeObserver. La distorsion reste attachée à la fenêtre.
- Contrôles navigateur avec événements DOM synthétiques : une flèche modifie le tracé ; le glisser active le curseur et modifie la grille ; le relâchement termine le geste.
- Déplacement simulé de -10 000 003 px / +10 000 007 px : coordonnées valides, 69 lignes avant et après. Annulation du geste confirmée, aucun déplacement sur les mouvements suivants. Aucun message console de niveau erreur.
- `pnpm build` réussi. Limites : pas de test de glisser physique, de tactile réel ou de nouvelle vérification native ; pas de limites dynamiques ni de zoom implémentés.
