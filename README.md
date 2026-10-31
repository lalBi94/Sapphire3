# Sapphire 3

Application desktop de programmation visuelle en construction. Le canvas visuel, l'édition contextuelle des nœuds et les fondations d'un moteur AST indépendant des langages sont présents.

## Installation et démarrage

Prérequis : Node.js compatible avec Vite 8 (22.12+ ou 24+), pnpm 11.5 et Windows avec WebView2 installé.

```sh
pnpm install
pnpm desktop:setup
pnpm dev
```

`desktop:setup` télécharge le runtime Neutralinojs 6.10.0 dans `bin/` (ignoré par Git). `pnpm dev` démarre Vite et ouvre la fenêtre native avec rechargement à chaud.

## Commandes

- `pnpm dev:web` : frontend seul, sur http://127.0.0.1:5173.
- `pnpm build` : compile le frontend dans `dist/`.
- `pnpm preview` : prévisualise le frontend compilé dans un navigateur.
- `pnpm desktop:start` : compile puis ouvre le frontend compilé dans Neutralinojs, sans Vite.
- `pnpm dist:win` : construit le paquet portable Windows et son ZIP dans `build/release/`.

L'application contient une page unique avec un canvas plein écran : quadrillage discret, déformé aux bords. Glissez avec le bouton gauche ou central pour vous déplacer sans limite applicative, ou utilisez les flèches après avoir donné le focus au canvas.

La molette zoome autour du milieu de la vue, jusqu'à 400 %. Le dézoom n'a pas de minimum applicatif (hors limites numériques JavaScript), et la grille adapte sa densité. Une croix marque l'origine absolue (0, 0). En bas à droite : coordonnées, zoom et bouton cadrant l'ensemble des modules, sans les annotations et au maximum à 100 %. Sans module, il revient à l'origine à 100 %.

Clic droit sur le canvas vide pour ouvrir « Create module » / « Create comment » / « Create image ». Glissez l'en-tête pour déplacer une carte ; les flèches la déplacent aussi lorsque l'en-tête a le focus. La poignée inférieure droite permet de redimensionner la zone, également au clavier. Aucun module Main : cochez « Start program here » sur une fonction pour désigner le point d'entrée, indépendamment de son nom. Zéro ou une seule fonction peut porter ce rôle ; un badge la distingue dans l'arbre. **Run** lance une simulation locale bornée, sans effet natif. Sans sauvegarde manuelle, le document disparaît au rechargement.

La barre supérieure propose **Settings** (ouverture `.sp3`, cinq chemins récents, sauvegarde directe, import et export JSON), **Edit** (undo/redo), **View** (zoom, cadrage, grille) et **Theme** (six palettes). **Ctrl+S** écrit le fichier `.sp3` courant ou ouvre « Enregistrer sous » s'il n'a pas encore de chemin. Les fichiers conservent source logique, cartes/commentaires/images, géométrie, pliage, vue et sélection. L'import validé demande confirmation avant remplacement ; annulations et erreurs conservent le travail courant. Une source logique JSON v1 seule est aussi importable. Aucun autosave ni stockage distant. Limite : 20 Mio, images intégrées comprises. Voir `docs/WORKSPACE_FILES.md`.

Les dialogues de fichiers nécessitent la fenêtre **Neutralinojs**, pas `pnpm dev:web`. Redémarrez une ancienne fenêtre desktop après cette évolution des permissions natives.

### Simulation et debug SP3

**Run** est le cinquième contrôle de la barre, après Settings, Edit, View et Theme. Son bouton adjacent déplie **Run SP3 simulation** et **Debug SP3 workspace**. Les deux actions de la future exécution graphique compacte sont affichées mais désactivées : cette vue n'est pas encore implémentée.

Le debug travaille sur le workspace courant, avec un panneau mémoire déplaçable et redimensionnable, également au clavier :

- **Next / Suivant** exécute l'instruction courante et avance, en entrant dans les fonctions appelées.
- **Finish scope / Sauter le bloc** exécute normalement jusqu'à la sortie du scope courant, sans ignorer le code.
- **Back / Précédent** restaure le dernier arrêt choisi, variables et sorties comprises.
- **Restart / Recommencer** revient au premier arrêt de la même session et oublie l'historique de navigation.

Le panneau de propriétés suit automatiquement le bloc exécuté, en simulation comme en debug, sans réinitialiser sa position. Le panneau mémoire montre les globaux, les variables des scopes lexicaux actifs seulement, les fonctions du programme et une analyse conservatrice des nœuds inatteignables. Il ne confond pas une branche non visitée avec une branche impossible. Le nœud courant est surligné sur le canvas, avec dépliage temporaire de ses parents. Les états sont pré-calculés par le simulateur borné, puis parcourus de façon réversible ; ils ne sont ni sauvegardés dans le workspace ni envoyés à un service. Une modification du code ferme la session pour éviter un état périmé. Contrat et limites dans `docs/LOGIC_API.md`.

### Édition contextuelle

Chaque carte/nœud possède **un seul « + » dans son coin haut droit** : il ouvre le même menu que le clic droit, **sous le bouton**. Pour les modules et nœuds logiques, ce menu propose le slot libre puis les constructions compatibles avec le contexte lexical (fonctions et types seulement aux racines du module, paramètres dans une liste de fonction, break/continue dans une boucle…). Clic gauche sur le nœud : sélection et panneau de propriétés.

À la création d'une condition ou d'un initialiseur, choisissez directement une comparaison/opération binaire, une opération unaire, un appel de fonction ou une conversion numérique explicite, en plus des littéraux et références. Les opérandes/arguments et leurs expressions imbriquées se renseignent **dans le même formulaire**, avec types explicites et validation atomique : plus besoin de créer chaque `left`/`right` dans un menu séparé. Le formulaire autorise six niveaux d'imbrication ; les slots restent disponibles au-delà.

Après insertion, le module s'agrandit pour afficher le contenu déplié sans rester limité à sa petite taille initiale. L'ajustement ne réduit jamais les dimensions ; un redimensionnement manuel le suspend jusqu'à la prochaine insertion. Les tailles restent incluses dans l'export workspace.

Chaque insertion est atomique : slot unique occupé jamais remplacé, ordre des listes conservé, identifiants stables, projet réanalysé et insertion rejetée si elle introduit une erreur dure (type incompatible, dépassement de bornes…). Un nœud incomplet reste représentable et éditable, avec ses diagnostics. Les possibilités du menu sont déduites du moteur (`getAvailableActions`). Pas encore de déplacement individuel ni de copier/coller des nœuds logiques.

Un module expose aussi ses échanges de fonctions dans son panneau de propriétés. **Functions shared with other modules** liste ses déclarations de premier niveau et permet de les exporter ou de retirer l'export ; **Functions used from other modules** liste les imports avec leur nom local et permet de les retirer. L'import propose les fonctions des autres modules, accepte un nom local et crée l'export manquant dans le module source. Ces changements restent des modifications de source annulables. Seules les fonctions réellement visibles dans la portée peuvent ensuite être choisies dans « Utiliser une fonction » ; un import retiré laisse ses références visibles avec leur diagnostic.

### Pliage et suppression

Le bouton `▸`/`▾` de chaque nœud logique le plie ou le déplie. Tous les nœuds sont pliés par défaut, sauf restauration d'un fichier ; seuls ceux que vous dépliez restent ouverts. Un nœud créé s'affiche déplié avec ses parents. Plié, il tient sur une ligne avec ses données utiles et masque ses slots ; déplié, il reprend le rendu complet. Ce pliage est purement visuel, inclus dans les exports workspace et sans effet sur l'AST.

Un nœud peut être supprimé par « Delete block » dans son menu, ou depuis le panneau de propriétés avec confirmation. La suppression retire le nœud et ses descendants, puis sélectionne son parent logique. Les références restantes deviennent des diagnostics `REFERENCE_UNRESOLVED`, sans réécriture silencieuse. Modules et annotations se retirent avec confirmation depuis leur menu. Supprimer la fonction point d'entrée ou son module libère le rôle. Undo permet de revenir sur une suppression en mémoire ; l'import confirmé remet l'historique à zéro. Déplacements, texte d'annotations et pliage ne créent pas d'étapes dédiées d'historique.

Chaque nœud affiche une bordure colorée selon sa catégorie logique : variable, type, fonction, paramètre, condition, boucle, retour, bloc, instruction, opérateur, valeur ou incomplet. Le groupe est défini avec le schéma de la construction, et les couleurs sont des variables CSS partagées.

L'interface propose l'anglais par défaut et le français, y compris aides, textes accessibles, résumés, diagnostics, erreurs et textes applicatifs des dialogues natifs. Le catalogue unique est dans `src/utils/translations.js` ; les contextes sont dans `src/contexts/`. Les noms saisis, types/opérateurs et sorties du programme restent inchangés ; les boutons et messages Windows suivent la langue système. Les commentaires et la documentation du projet sont en français. Langue, thème et chemins récents sont des préférences locales, séparées du workspace.

Double-cliquez sur le titre d'un Module pour le renommer (ou Entrée/F2 sur son en-tête). Entrée ou sortie du champ valide, Échap annule.

« Create comment » ajoute une carte d'annotation : titre renommable, texte multiligne dans le corps, déplacement par l'en-tête et redimensionnement par le coin. Ces notes sont uniquement visuelles : elles ne sont ni des modules logiques, ni des commentaires de code, et ne sont pas envoyées à l'AST. Titres et textes sont inclus dans les exports workspace.

Les API natives utiles aux dialogues et fichiers sont limitées et regroupées dans `src/services/`. Aucun backend ni service distant. Les scripts d'installation de trois dépendances transitives de la CLI sont explicitement désactivés dans `pnpm-workspace.yaml` ; les accélérations WebSocket natives ne sont pas nécessaires ici.

## Repères

### Moteur logique

`src/utils/logic/index.js` expose une API JavaScript pure : source JSON v1, AST tolérant, portées, références intermodules et typage statique strict. Les dix primitifs sont `short int`, `short uint`, `int`, `uint`, `float`, `double`, `string`, `char`, `boolean`, `void` (retour uniquement). Déclarations et littéraux explicitement typés ; aucune conversion implicite ni type de secours. Le simulateur réutilise les règles numériques pour contrôler les valeurs calculées. Aucun moteur de suggestions ni générateur de code.

- `pnpm test` : tests automatisés avec le runner natif Node.
- `docs/LOGIC_API.md` : conventions, API et exemple à deux modules.
- `ARCHITECTURE_AST.tex` et `ARCHITECTURE_AST.pdf` : rapport technique français de quatre pages.
- `pnpm docs:ast` : recompile le PDF depuis le LaTeX (MiKTeX/pdfLaTeX, Latin Modern et PowerShell requis). Auxiliaires dans `build/latex/`, ignorés par Git.

Les conteneurs graphiques et le modèle logique sont raccordés : chaque Module visuel possède son module source de même identifiant, et les nœuds sont créés/édités via l'API contextuelle. Les positions/dimensions et les annotations Comment restent hors du moteur, dans l'enveloppe workspace exportable. Le moteur peut conserver et diagnostiquer une ancienne source contenant un module `main` ; l'import UI refuse cette ancienne catégorie sans migration automatique.

### Documentation du projet

- `AGENTS.md` : règles de développement et périmètre.
- `docs/PROJECT_STATE.md` : état actuel et cartographie.
- `docs/PROJECT_ARCHIVE.md` : vérifications détaillées.
- `PROMPT_INITIALISATION.md` : kit d'origine conservé.
- `docs/DISTRIBUTION.md` : construction reproductible et publication des paquets portables Windows via les GitHub Releases du dépôt unique. Aucun updater.
