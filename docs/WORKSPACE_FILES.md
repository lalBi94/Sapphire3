# Workspace Sapphire 3 : dossier, document interne et images

## Modèle de dossier

Un workspace est un **dossier choisi par l'utilisateur**. L'application n'expose plus de fichier `.sp3` dans son interface : le document interne reste central, mais il est traité comme un détail d'implémentation.

```
Mon_Projet/
  workspace.sp3      document interne JSON UTF-8, jamais nommé dans l'interface
  images/            images liées par des chemins relatifs
  backups/           trois versions précédentes du document interne
```

- **Ouvrir un workspace** = choisir le dossier. L'application y cherche `workspace.sp3` ; à défaut, elle accepte l'unique `.sp3` d'un ancien dossier. Un dossier sans document produit `WORKSPACE_NOT_FOUND`.
- **Créer un workspace** = choisir un dossier ; l'application y écrit un document vierge et crée `images/` et `backups/`.
- **Enregistrer / Ctrl+S / autosauvegarde** = réécrire uniquement `workspace.sp3`. Les images ne sont jamais réécrites par l'autosauvegarde.
- **Exporter** = une archive `.zip` contenant `workspace.sp3` et `images/`. Les exports `.sp3` et JSON du workspace ne sont plus proposés.
- Les exports **JavaScript, Python, SVG, PNG et dashboard web HTML** restent des exports de code, d'image ou d'application autonome, distincts du workspace.
- Les **cinq workspaces récents** et le **dernier workspace** sont mémorisés par chemin de dossier. Une ancienne liste de fichiers `.sp3` est convertie une fois en dossiers parents.

## Contenu et versions

`workspace.sp3` est un instantané JSON UTF-8 non compressé :

```json
{
  "application": "Sapphire 3",
  "workspaceVersion": 3,
  "project": { "formatVersion": 1, "id": "workspace", "modules": [], "nodes": [] },
  "presentation": {
    "cards": [],
    "camera": { "x": 0, "y": 0, "zoomLevel": 0 },
    "selected": null
  }
}
```

- `project` : source logique complète, identifiants, références, types et marqueur de point d'entrée inclus. AST, diagnostics, index et caches sont recalculés, pas enregistrés.
- `workspaceVersion` vaut **3**. Les versions 1 et 2 restent lisibles : la version 1 est normalisée (drapeau `generic` converti en `typeParameters`, `screenScale` retiré) puis validée ; la version 2 devient 3 sans transformation de données. Toute version future ou malformée est refusée avec `WORKSPACE_VERSION_UNSUPPORTED` sans remplacer le document courant. `project.formatVersion` reste indépendant et vaut toujours 1.
- `cards` : toutes les cartes, même hors écran, dans leur ordre de rangement. Chaque carte contient `id`, `type` (`module`/`class`/`screen`/`gauge`/`progress`/`barChart`/`xyPlot`/`oscilloscope`/`heatmap`/`led`/`rgbLed`/`toggleButton`/`holdButton`/`numberInput`/`floatInput`/`stringInput`/`rgbPicker`/`rgbaPicker`/`comment`/`image`/`pluginWidget`), `name`, `x`, `y`, `width`, `height`, `expandedNodeIds`.
- Une carte `class` référence un module source `kind: "class"` ; ses membres portent `properties.visibility` (`public`/`private`) et le constructeur `properties.constructor: true`. Les nœuds `NewExpression`, `ThisExpression`, `MemberExpression` et les annotations `{kind:"class", classId}` sont sérialisés dans la source. Aucun héritage ni polymorphisme.
- Une carte Image porte **exactement l'un des deux** champs suivants :
  - `image` : Data URL d'une image encore intégrée (ancien fichier, mode web ou document jamais enregistré) ;
  - `imageRef` : référence relative `images/<nom>.<extension>` vers un fichier du dossier du workspace.
  Une carte avec `imageRef` ne peut pas contenir une Data URL non vide. Les extensions acceptées sont `png`, `jpg`/`jpeg`, `gif`, `webp`, `bmp`, `avif`, `svg` et `ico`. Les chemins absolus, les URL distantes, les remontées `..` et les noms contenant un séparateur sont refusés.
- `caption` reste la légende libre de la carte Image. Les commentaires ajoutent `text` ; les écrans ajoutent `screenWidth` et `screenHeight` ; l'ancien champ `screenScale` n'est plus écrit et reste ignoré à la relecture. Les vues `screenView`, `gaugeView`, `progressView`, `barChartView`, `heatmapView` et `ledView` ne sont écrites que lorsqu'elles valent `code`.
- `hidden`, `locked` et `emoji` restent des clefs optionnelles de carte, écrites seulement lorsqu'elles sont utiles.
- `contracts`, `generic`, `typeParameters`, les lambdas, les types fonction et les références de fonction suivent les contrats du moteur logique décrits dans `docs/LOGIC_API.md`.
- Les **raccourcis clavier personnalisés** sont des préférences de l'application (`sapphire-keybinds`) et ne figurent jamais dans le document.
- `exercise` est une clef racine optionnelle. Un `lock` valide est `{algorithm: "PBKDF2-SHA256", iterations, salt, hash}` ; il ne chiffre pas le document et ne bloque que l'édition dans l'interface. Une solution est exportée en archive `<titre>-solution.zip`.
- `dashboard` est une clef racine optionnelle qui mémorise la configuration d'export web : `name`, `description`, `themeId`, `palette` (instantané portable des couleurs sombres du thème choisi) et `layoutKey` (identifiant local de disposition). L'export embarque aussi les thèmes prédéfinis et personnalisés disponibles avec leurs variantes claire et sombre ; le thème sélectionné est proposé par défaut et la palette mémorisée reste une palette de secours portable. Aucun chemin, aucune image et aucune donnée de visiteur n'y sont écrits. Une palette invalide est refusée avec `DASHBOARD_CONFIG_INVALID`. La clef est absente des anciens documents et reçoit les valeurs par défaut à l'ouverture ; aucune migration de version n'est nécessaire.
- Géométrie en unités monde ; minimum 180 × 120. `camera` reprend les coordonnées du centre et l'exposant de zoom (maximum 2, soit 400 %). `selected` vaut `null` ou `{kind: "module" | "node", id}`.
- Menus ouverts, formulaires non validés, gestes en cours et positions de défilement internes ne sont pas sauvegardés. L'export est celui du document validé en mémoire au clic, pas une capture d'image.

## Cartes de plugin

Une carte `pluginWidget` est une carte de présentation fixe qui porte les
données d'un widget fourni par un plugin local :

```json
{
  "id": "card-uuid",
  "type": "pluginWidget",
  "name": "Digital voltmeter",
  "pluginId": "org.example.voltmeter",
  "widgetId": "voltmeter",
  "pluginVersion": "1.0.0",
  "x": 0,
  "y": 0,
  "width": 360,
  "height": 250,
  "minWidth": 240,
  "minHeight": 170,
  "properties": { "unit": "V" },
  "state": { "value": 0, "setpoint": 5 },
  "bindings": {
    "inputs": { "value": "voltage" },
    "outputs": { "setpoint": "function-node-id" }
  },
  "pluginWidgetView": "definition",
  "expandedNodeIds": []
}
```

- `pluginId` et `widgetId` identifient le manifeste et le widget.
- `pluginVersion` est indicative ; la version active peut différer.
- `properties`, `state` et `bindings` sont des objets JSON bornés.
- Les liaisons d'entrée associent un port à un nom de variable visible.
- Les liaisons de sortie associent un port à un identifiant de fonction
  `(T) -> void`.
- Une carte de plugin ne crée pas de module source et ne participe pas aux
  nœuds logiques.
- Si le plugin est absent ou désactivé, la carte est conservée intégralement et
  affiche un diagnostic. Aucun champ n'est supprimé ni transformé.
- Le widget participe à la sélection, au déplacement, au redimensionnement, au
  masquage, au verrouillage et au stockage du workspace.
- `pluginWidgetView` est optionnel : `widget` (défaut) ou `definition`. La vue
  `definition` affiche la définition déclarative en lecture seule et n'est
  écrite que lorsqu'elle est active ; aucune valeur inconnue n'est acceptée.

Les plugins installés et leurs préférences sont hors du workspace, dans la
préférence locale `sapphire-plugins`. Un workspace ne déclenche jamais
l'installation automatique d'un plugin.

Le dashboard exporté embarque les widgets `pluginWidget` visibles, leurs
définitions, les manifestes de plugins actifs et les liaisons d'entrée/sortie.
Les opérations natives de plugin sont revalidées dans le runtime borné et le
worker live. Un widget dont le plugin est absent reste un panneau de diagnostic.

## Images

- À l'import d'une image dans un workspace associé à un dossier, le fichier est copié dans `images/` sous un nom sûr et unique (`blackhole.png`, `blackhole-2.png`…), puis la carte reçoit `imageRef`. La limite par image est de 20 Mio.
- L'affichage relit les octets avec `filesystem.readBinaryFile` et construit une Data URL **en mémoire** ; le document sur disque ne contient jamais cette Data URL.
- Pour un document jamais enregistré, l'image reste intégrée en Data URL jusqu'au premier enregistrement. Elle est alors écrite dans `images/` et la carte est convertie en `imageRef`.
- Une image absente ou illisible laisse la carte vide, sans bloquer le reste du workspace. Remplacer une image crée un nouveau fichier ; l'ancien n'est pas supprimé automatiquement.
- L'export ZIP inclut toutes les images référencées et convertit les éventuelles images encore intégrées.

## Import d'anciens fichiers

Le bouton **Import legacy file…** reste disponible pour les anciens `.sp3` et `.json` et pour une source logique JSON v1 seule. L'import est validé avant remplacement, puis le document devient un workspace sans dossier : ses images intégrées sont conservées jusqu'au premier enregistrement, qui crée le dossier et `images/`.

Les versions inconnues, doublons d'identifiants, géométries invalides, incohérences carte/module et structures incompatibles avec l'interface sont refusés. Une ancienne catégorie de module `main` n'est pas convertie silencieusement. Un programme sémantiquement incomplet ou invalide peut être restauré si sa structure est affichable.

## Accès aux fichiers

- Barre supérieure : **Settings** propose **Open workspace folder**, les workspaces récents, **Save workspace**, **Save workspace as…**, **Import legacy file…**, **Export workspace (.zip)** et **Export SVG**.
- Dialogues de choix de dossier et de fichier Neutralinojs ; aucun chemin de projet imposé, aucun accès distant ni stockage du workspace dans le navigateur.
- Un dossier associé est **autosauvegardé** après chaque modification. Un document jamais enregistré est protégé par un dossier de récupération dans le répertoire de données persistant.
- Copie de récupération : `<répertoire de données>/sapphire3-recovery/workspace.sp3` (+ `images/`). L'ancien fichier `sapphire3-recovery.sp3` est encore lu une fois. Au lancement, une copie valide est restaurée avant toute autre ouverture ; sans copie, le dernier dossier connu est rouvert. Une copie illisible est supprimée sans bloquer cette réouverture.
- Écriture atomique : un brouillon unique est créé dans le dossier cible, sa taille UTF-8 est vérifiée, puis `filesystem.move` le renomme sur l'original. Aucune réécriture directe de l'original en cas d'échec ; celui-ci reste intact et le brouillon vérifié est conservé, avec son chemin dans l'erreur `ATOMIC_REPLACE_FAILED`.
- Sauvegardes de secours : un enregistrement direct fait tourner jusqu'à **trois copies** du document précédent dans `backups/` (`workspace.backup-1.sp3` à `workspace.backup-3.sp3`). La plus ancienne est retirée, les autres sont décalées, puis la copie la plus récente est écrite avec le même mécanisme atomique. Une génération absente est ignorée. L'autosauvegarde ne fait pas tourner ces copies. Un échec de copie **n'annule pas** l'enregistrement.
- Export ZIP : archive « store » construite en mémoire (en-têtes locaux, répertoire central, CRC32, noms UTF-8), puis écrite par blocs de 4 Mio avec `filesystem.appendBinaryFile` pour ne pas dépendre de la taille d'un message natif. La taille maximale d'une archive est de 512 Mio ; le document interne reste limité à 20 Mio.
- Services natifs dans `src/services/workspaceFiles.js` ; client `@neutralinojs/lib` 6.10.0. Permissions explicites pour `showFolderDialog`, `readFile`, `readBinaryFile`, `readDirectory`, `writeFile`, `writeBinaryFile`, `appendBinaryFile`, `getStats`, `move`, `remove`, `createDirectory` et `getPath`.
- Titres et filtres applicatifs des dialogues selon la langue de l'interface, passée explicitement au service. Erreurs de format/fichier identifiées par codes stables et paramètres ; traduction dans l'UI, y compris après un changement de langue.
- `pnpm dev:web` sert au contrôle du frontend : les opérations de fichier affichent qu'elles nécessitent l'application desktop. Les exemples restent utilisables en mémoire.

## Vérifications

`tests/workspace/workspaceFile.test.js` contrôle l'écriture atomique, les sauvegardes, la lecture d'un dossier, la compatibilité d'un ancien `.sp3`, les images, l'export ZIP et la récupération. `tests/workspace/workspaceArchive.test.js` couvre l'archive ZIP, les références d'images et les conversions Data URL. `tests/workspace/migration.test.js` couvre la version 3 et le refus des références d'images hors dossier. `tests/workspace/dashboard.test.js` couvre la configuration d'export, les palettes, la disposition, les commandes d'exécution, les états initiaux, l'export HTML et sa relecture. Le moteur reste pur ; le module de format ne fait aucun accès disque.
