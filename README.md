# Sapphire 3

![Espace de travail Sapphire 3 : deux modules reliés par une flèche, avec leurs blocs dépliés](docs/assets/sapphire3-workspace.png)

Application **desktop Windows** de programmation visuelle, en bêta (`0.1.0-beta.3`). Chaque carte posée sur le canvas est une construction d'un langage typé, analysée par un moteur JavaScript pur et indépendant des langages cibles. Le texte reste possible, mais il n'est plus le point de départ.

## Installation et démarrage

Prérequis : Node.js compatible avec Vite 8 (22.12+ ou 24+), pnpm 11.5 et Windows avec WebView2.

```sh
pnpm install
pnpm desktop:setup
pnpm dev
```

`desktop:setup` télécharge le runtime Neutralinojs 6.10.0 dans `bin/` (ignoré par Git). `pnpm dev` démarre Vite et ouvre la fenêtre native avec rechargement à chaud.

## Commandes

- `pnpm dev:web` : frontend seul dans le navigateur, sur `http://127.0.0.1:5173`.
- `pnpm test` : tests Node et Python du moteur, du workspace et de la transpilation.
- `pnpm build` : compile le frontend dans `dist/`.
- `pnpm desktop:start` : compile puis ouvre le frontend compilé dans Neutralinojs, sans Vite.
- `pnpm dist:win` : construit le paquet portable Windows et son ZIP dans `build/release/`.
- `pnpm docs:ast` : recompile le rapport LaTeX `abstract/ARCHITECTURE_AST.pdf`.

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute l’installation verrouillée, les contrôles de qualité, les tests et le build sur chaque pull request.

## Ce que l’application sait faire

### Canvas et compréhension visuelle
- Canvas plein écran navigable, zoom jusqu’à 400 %, quadrillage courbé, mini-carte et cadrage des modules.
- **Zoom sémantique** : instructions détaillées au-dessus de 21 %, liste des fonctions racines de 10 à 21 %, puis seules les cartes de modules et les relations intermodules à 10 % et moins.
- Modules, annotations **Comment** (avec formules KaTeX entre `$$ … $$`) et cartes **Image** intégrées localement.
- Cartes spéciales **Screen**, **Gauge**, **ProgressBar**, **LED** et **RGB LED**, adossées à des modules cachés normaux, avec aperçu ou code et lecture des images à 24 fps. La LED RVB expose trois canaux entiers 0–255 (`RGBLED_SP3_SET_COLOR`, `GET_RED`, `GET_GREEN`, `GET_BLUE`).
- **BarChart** : tableau `int[]`, barres avec dégradé/halo, `SET_VALUE`, `SET_DATA`, `CLEAR`. **Heatmap** : grille fixe `int[]`, `SET_CELL(x, y, value)`, `CLEAR`, intensité simple du thème et suivi par pas sans lecture à 24 fps. Les deux proposent aussi la vue code du module caché.
- Liens intermodules, vue graphique simplifiée, graphe de contrôle, dépendances et recherche de blocs.
- **Modules magnétiques** : pendant un glisser, bords et centres s’alignent sur les modules voisins avec des guides visuels. La case **Magnetic modules** de View/Settings désactive l’aimant sans auto-arrangement global.

### Langage et moteur
- Typage statique strict : primitifs, tableaux, pointeurs, signatures de fonction, type `void` réservé aux retours.
- Fonctions, paramètres, conditions, boucles, `ForEach`, affectations, appels, littéraux, opérations natives et conversions explicites.
- **Génériques avancés** : plusieurs paramètres `T`, `U`…, tableaux génériques `T[]`, contraintes exactes et inférence par appel. Ancien `generic: true` toujours lu.
- **Lambdas et fermetures** : `LambdaExpression` anonyme à corps expression, capture lexicale par référence, retours de type fonction, appel via variable, callback `ForEach` et invocation immédiate.
- Pointeurs exécutés **et transpilés** en JavaScript et Python (`&`, `*p`, écriture à travers un pointeur).
- Initialisation globale des modules dans un **ordre topologique stable** selon les imports.
- Simulation locale bornée, débogage pas à pas avec points d’arrêt, mémoire pédagogique, valeurs au survol et exécution d’une fonction choisie.
- **Vitesse de simulation** : ×1, ×2, ×3 ou ×N (1 à 100) dans le panneau Simulation, ajustable pendant l’exécution. Le calcul temporel conserve la vitesse choisie même si le rendu ralentit.
- Transpilation **JavaScript** et **Python** sur action explicite ; C, C++ et Java sont désactivés.

### Exécution hors du fil React
- Simulation, préparation du debug, transpilation et vérifications de cibles s’exécutent dans un **Web Worker**.
- Messages d’avancement (analyse, pas exécutés, génération) et bouton **Cancel** qui termine immédiatement le worker.
- Les mutations structurelles gardent une analyse synchrone pour renvoyer leurs diagnostics sans délai.

### Fichiers et sécurité des données
- Import/export `.sp3` et JSON par dialogues natifs, export SVG, export PNG/JSON d’un nœud.
- Autosauvegarde du fichier `.sp3` courant après modification ; dernier fichier rouvert au lancement ; cinq chemins récents.
- **Récupération après crash** : un document neuf non vierge sans chemin est conservé dans `sapphire3-recovery.sp3` (répertoire de données persistant) et restauré au lancement.
- **Sauvegardes de secours** : jusqu’à trois générations `<base>.backup-1.sp3` à `3` lors d’un enregistrement direct. Une copie impossible n’annule pas la sauvegarde et est signalée par la mascotte.
- **Workspace version 2** : les fichiers version 1 sont migrés à la lecture (`generic` → `typeParameters`, retrait de `screenScale`) ; une version future ou malformée est refusée sans remplacer le document.
- Limite de fichier : 20 Mio, images intégrées comprises. Voir `docs/WORKSPACE_FILES.md`.

### Interface
- Barre compacte **Settings**, **Edit**, **View**, **Theme**, **Examples**, **Bookmarks**, **Windows**, Transpile et Run.
- Fenêtre de paramètres, thèmes prédéfinis et personnalisés, huit langues (anglais par défaut, français, chinois, espagnol, arabe, japonais, hindi, russe), raccourcis clavier configurables.
- Favoris personnels de fonctions et modules purs, gestionnaire de fenêtres flottantes, undo/redo structurel.
- **Notifications par mascotte** : 16 expressions du robot au-dessus de la mini-carte, alignées sur son bord gauche ; le robot lévite et peut être déplacé au pointeur. Bulles en verre anthracite, actions et historique récent, file priorisée, remplacement des progressions et fermeture manuelle. Les dialogues bloquants et les panneaux de diagnostics restent inchangés.

## Distribution et mises à jour

L’application vérifie les **releases publiées** du dépôt `lalBi94/Sapphire3`. L’installation demande confirmation, vérifie la version, la taille et l’empreinte SHA-256 de l’archive, puis un helper `updater.ps1` embarqué remplace les fichiers distribués après fermeture. Les données et préférences de l’utilisateur ne sont jamais remplacées.

## Documentation

- `docs/LOGIC_API.md` : contrats du moteur, types, génériques, lambdas, simulation et transpilation.
- `docs/WORKSPACE_FILES.md` : format `.sp3`, versions, récupération et sauvegardes.
- `docs/PROJECT_STATE.md` : état vérifié et cartographie des fichiers.
- `abstract/visual/index.html`, `documentation.html`, `ast.html` : documentation visuelle du projet.
- `abstract/ARCHITECTURE_AST.tex` / `.pdf` : rapport d’architecture.
- `AGENTS.md` : règles de développement et périmètre.

## Limites connues

- Modèle objet, classes et structures non décidés ; `TypeDeclaration` reste un alias transparent.
- Lambdas à corps expression unique, non génériques ; `&` sur un paramètre de lambda refusé.
- Les sauvegardes de secours ne tournent qu’à l’enregistrement direct, pas à l’autosauvegarde ni lors d’un « Enregistrer sous ».
- C, C++ et Java indisponibles ; les cartes Screen/Gauge/ProgressBar/BarChart/Heatmap/LED/RGB LED ne sont pas transpilables.
- L’analyse reste conservatrice et ne prouve ni terminaison ni valeurs générales.
- Les captures de `abstract/visual` datent d’une campagne antérieure ; les fonctionnalités récentes y sont décrites dans le texte.

Dernier check-up : **508 tests Node et Python réussis**, build frontend et parcours navigateur vérifiés. Les trente exemples passent Run et Debug dans le Web Worker ; les douze exemples transpilables sont exécutés en JavaScript et Python. Les notifications par mascotte, l’aimantation des modules et la vitesse de simulation sont couvertes par des tests purs et des contrôles navigateur. Pour la bêta 0.1.0-beta.3, le paquet Windows a été audité et lancé dans Neutralinojs avec un profil isolé ; première sauvegarde native, Ctrl+S et création d’une sauvegarde de secours vérifiés. Détail dans `docs/PROJECT_ARCHIVE.md`.
