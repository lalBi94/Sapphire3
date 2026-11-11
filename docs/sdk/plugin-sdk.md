# Plugin SDK Sapphire 3

`@sapphire3/plugin-sdk` permet à un développeur externe de créer un plugin
local pour Sapphire 3, de le valider, de le distribuer comme fichier
`.sp3plugin` et de l'installer depuis **Settings → Plugins**.

Cette première version privilégie un contrat réellement exécutable :

- widgets de canvas déclaratifs et interactifs ;
- opérations natives typées, exécutées par le moteur et transpilables vers
  JavaScript/Python ;
- nœuds composites de niveau A, transformés en constructions Sapphire natives ;
- registre versionné, cycle de vie, permissions, dépendances et restauration
  non destructive des workspaces.

Les nœuds sémantiques de niveau B ne sont **pas** opérationnels. Aucune API de
niveau B n'est exposée tant que le schéma, le typage, l'exécution, le debug, la
sérialisation, la transpilation et le rendu ne sont pas tous livrés.

## Statut et versionnement

| Élément | Valeur |
| --- | --- |
| Package | `@sapphire3/plugin-sdk` |
| Version du package | `0.1.0` |
| Format de document | `pluginFormatVersion: 1` |
| API du contrat | `apiVersion: 1` |
| Extension locale | `.sp3plugin` |
| Publication npm | non, package `private: true` |

Le package est construit par Vite en ESM autonome dans
`packages/plugin-sdk/dist/`. Les définitions publiques sont dans
`packages/plugin-sdk/types/index.d.ts`.

## Installation locale

1. Construire ou récupérer un fichier `.sp3plugin` valide.
2. Ouvrir **Settings → Plugins**.
3. Cliquer **Import local plugin** et choisir le fichier.
4. Le plugin est validé, contrôlé contre les conflits, installé et activé.
5. Il peut être désactivé, réactivé ou désinstallé sans toucher aux cartes du
   workspace.

Le fichier est lu par un dialogue natif Neutralinojs. Aucun import dynamique de
code JavaScript n'est effectué. Le manifeste est stocké dans la préférence
`sapphire-plugins` du répertoire persistant de l'application.

## Manifeste

```json
{
  "pluginFormatVersion": 1,
  "apiVersion": 1,
  "id": "org.example.instruments",
  "name": "Example instruments",
  "version": "1.0.0",
  "author": "Example",
  "description": "Local widgets and operations.",
  "license": "MIT",
  "minAppVersion": "0.1.0",
  "permissions": ["ui.widgets", "workspace.widget-state"],
  "dependencies": [
    { "id": "org.example.base", "version": "^1.0.0", "optional": false }
  ],
  "widgets": [],
  "nativeOperations": [],
  "composites": []
}
```

Règles principales :

- `id` : identifiant stable, unique parmi les plugins installés.
- `version` : version sémantique `major.minor.patch`.
- `permissions` : liste explicite des capacités demandées.
- `dependencies` : identifiants et plages `*`, exacte, `^`, `~`, `>=` ou `>`.
- Au moins un widget, une opération native ou un composite.
- Les identifiants de widgets et de composites sont limités au plugin.
- Les identifiants d'opérations natives sont globaux : ils ne peuvent pas
  entrer en conflit avec une opération intégrée ni avec un autre plugin.
- Toute permission inconnue ou non prise en charge est refusée.
- Un plugin déclarant `widgets` doit demander `ui.widgets` et
  `workspace.widget-state`.
- Un plugin déclarant `nativeOperations` doit demander
  `engine.native-operations`.
- Un plugin déclarant `composites` doit demander `engine.composites`.

### Permissions

| Permission | Première version |
| --- | --- |
| `ui.widgets` | prise en charge |
| `workspace.widget-state` | prise en charge |
| `engine.native-operations` | prise en charge |
| `engine.composites` | prise en charge |
| `filesystem.read` | déclarable mais refusée |
| `filesystem.write` | déclarable mais refusée |
| `network.access` | déclarable mais refusée |
| `native.api` | déclarable mais refusée |

Le refus produit `PLUGIN_PERMISSION_UNSUPPORTED` à l'import. Aucun plugin ne
reçoit donc implicitement un accès au système de fichiers, au réseau, à
Neutralinojs ou au DOM privilégié.

## Cycle de vie

```text
fichier .sp3plugin
      │
      ▼
validation du manifeste ── erreur ──► affichage dans Settings → Plugins
      │
      ▼
contrôle des conflits (id, opérations natives)
      │
      ▼
installation persistée (activée par défaut)
      │
      ▼
résolution des dépendances et de la compatibilité
      │
      ├── inactive : dépendance manquante, version incompatible, cycle
      └── active : registre du moteur et menus mis à jour
      │
      ├── désactivation : les cartes du workspace restent intactes
      ├── réactivation : le registre et l'analyse sont rafraîchis
      └── désinstallation : les cartes restent dans le workspace
```

Un plugin n'est jamais installé automatiquement à l'ouverture d'un workspace.
Un workspace contenant un widget d'un plugin absent conserve toutes ses
données : identité du plugin, widget, version, propriétés, état, liaisons et
géométrie. L'interface affiche une carte de diagnostic et **Settings → Plugins**
liste la dépendance manquante. Aucune transformation silencieuse n'est faite.

Les versions de dépendances sont vérifiées à l'activation. Les plugins sont
activés dans l'ordre de leurs dépendances ; un cycle produit
`PLUGIN_DEPENDENCY_CYCLE` et aucun membre du cycle n'est activé.

## Widgets

```json
{
  "id": "voltmeter",
  "name": "Digital voltmeter",
  "version": "1.0.0",
  "author": "Example",
  "description": "Shows a measurement and emits a setpoint.",
  "category": "Instruments",
  "icon": "gauge",
  "defaultSize": { "width": 360, "height": 250 },
  "minSize": { "width": 240, "height": 170 },
  "properties": [
    { "id": "unit", "label": "Unit", "type": "select", "default": "V", "options": ["V", "mV", "kV"] }
  ],
  "inputs": [
    { "id": "value", "name": "Voltage", "type": { "kind": "primitive", "name": "double" } }
  ],
  "outputs": [
    { "id": "setpoint", "name": "Setpoint", "type": { "kind": "primitive", "name": "double" } }
  ],
  "interactions": [
    { "id": "setpoint", "kind": "slider", "label": "Setpoint", "min": 0, "max": 10, "step": 0.1, "stateKey": "setpoint", "output": "setpoint" }
  ],
  "initialState": { "value": 0, "setpoint": 5 },
  "renderer": {
    "kind": "stack",
    "children": [
      { "kind": "text", "text": "LIVE MEASUREMENT" },
      { "kind": "value", "source": "input.value", "label": "Voltage", "suffix": "{property.unit}", "precision": 2 },
      { "kind": "bar", "source": "input.value", "min": 0, "max": 10 },
      { "kind": "input", "interaction": "setpoint" }
    ]
  }
}
```

### Propriétés

Types acceptés : `string`, `int`, `float`, `boolean`, `color`, `select`.
La valeur `default` doit correspondre au type. Les propriétés sont rendues dans
le panneau **Configuration** de la carte et persistées dans `card.properties`.

### Ports

Les entrées et sorties acceptent un primitif non `void` ou un tableau de
primitifs. Une entrée est liée à une variable visible du programme ; une sortie
est liée à une fonction `(T) -> void`. La liaison est stockée dans
`card.bindings.inputs` et `card.bindings.outputs`, jamais dans le manifeste.

### État

`initialState` doit être un objet JSON borné. L'état restauré est fusionné avec
les valeurs initiales ; les clés inconnues sont conservées si elles restent
JSON. L'état d'un widget est stocké dans `card.state` et persiste avec le
workspace, même lorsque le plugin est absent.

### Interactions

- `slider` : `min`, `max`, `step`, `stateKey` optionnel, `output` optionnel.
- `button` : `value` optionnel, `output` optionnel.

Chaque changement d'interaction met à jour l'état puis émet la valeur sur la
sortie liée. Aucun callback arbitraire n'est exécuté dans l'interface.

### Renderer déclaratif

Nœuds acceptés :

| Kind | Champs |
| --- | --- |
| `stack` | `children[]` |
| `row` | `children[]` |
| `text` | `text` |
| `value` | `source`, `label?`, `suffix?`, `precision?` |
| `bar` | `source`, `label?`, `min?`, `max?` |
| `led` | `source`, `label?` |
| `input` | `interaction` |
| `button` | `interaction` |
| `divider` | — |
| `spacer` | — |

`source` accepte `input.<id>`, `state.<id>` ou `property.<id>`. Les textes
peuvent interpoler `{input.x}`, `{state.x}` et `{property.x}`. Les valeurs sont
rendues comme texte React ; aucun HTML, script, URL distante ou composant
arbitraire n'est accepté.

Le rendu ne reçoit que des données sérialisables. Il ne peut pas muter le
moteur, le workspace ou les fichiers.

### Vue définition et dépendances

Un widget de plugin n'a pas de module source : la bascule de la carte affiche
donc sa **définition déclarative JSON** en lecture seule, et non un faux arbre
AST. La vue active est conservée dans `pluginWidgetView` (`widget` par défaut,
`definition` pour la définition).

Les liaisons d'entrée et de sortie produisent des **liens de dépendance** dans
la couche graphique habituelle : une flèche part du module qui déclare la
variable ou la fonction liée et entre dans la carte du widget. Un widget masqué,
sans liaison ou dont le module fournisseur n'a pas de carte visible ne produit
aucun lien.

## Opérations natives

```json
{
  "id": "pluginClamp",
  "name": "CLAMP",
  "description": "Clamps an integer between inclusive bounds.",
  "parameters": [
    { "name": "value", "type": { "kind": "primitive", "name": "int" } },
    { "name": "min", "type": { "kind": "primitive", "name": "int" } },
    { "name": "max", "type": { "kind": "primitive", "name": "int" } }
  ],
  "returnType": { "kind": "primitive", "name": "int" },
  "purity": "pure",
  "effects": [],
  "validation": {
    "kind": "binary", "operator": "<=",
    "left": { "kind": "param", "name": "min" },
    "right": { "kind": "param", "name": "max" }
  },
  "implementation": {
    "kind": "conditional",
    "test": { "kind": "binary", "operator": "<", "left": { "kind": "param", "name": "value" }, "right": { "kind": "param", "name": "min" } },
    "consequent": { "kind": "param", "name": "min" },
    "alternate": {
      "kind": "conditional",
      "test": { "kind": "binary", "operator": ">", "left": { "kind": "param", "name": "value" }, "right": { "kind": "param", "name": "max" } },
      "consequent": { "kind": "param", "name": "max" },
      "alternate": { "kind": "param", "name": "value" }
    }
  },
  "transpilers": {
    "javascript": { "...": "même expression" },
    "python": { "...": "même expression" }
  }
}
```

Une opération n'est jamais acceptée sur la seule base d'un nom et d'une
fonction JavaScript. Elle exige :

- une signature typée complète ;
- une implémentation dans un petit langage d'expression pur ;
- une validation optionnelle booléenne ;
- une pureté déclarée (`pure` ou `effect`) et des effets libellés ;
- des émetteurs optionnels JavaScript/Python dans le même langage sûr.

Le moteur consulte le registre dynamique via `getMathNative`, après les
opérations intégrées. L'analyse de types vérifie l'arité et les types ; la
simulation bornée et le live exécutent l'implémentation ; la transpilation
JavaScript/Python utilise l'émetteur déclaré. Si une cible manque, le diagnostic
explicite `TRANSPILE_EXPRESSION_UNSUPPORTED` est produit. Le backend C refuse
`MathCall` avec `TRANSPILE_C_UNSUPPORTED`, y compris pour une opération de
plugin.

### Langage d'expression

Nœuds :

- `param` : `{ "kind": "param", "name": "value" }`
- `literal` : `{ "kind": "literal", "type": { "kind": "primitive", "name": "int" }, "value": 0 }`
- `binary` : opérateurs `+`, `-`, `*`, `/`, `%`, `<`, `<=`, `>`, `>=`, `==`,
  `!=`, `and`, `or`
- `unary` : `-`, `+`, `not`
- `conditional` : `{ "kind": "conditional", "test": ..., "consequent": ..., "alternate": ... }`

Aucun appel arbitraire, accès de propriété, indexation, import ou nom libre
n'est autorisé. Les expressions sont validées récursivement, bornées en
profondeur et évaluées sans `eval`.

## Nœuds composites de niveau A

```json
{
  "id": "between",
  "name": "Value between bounds",
  "description": "Expands to (value >= lower) and (value <= upper).",
  "expansion": {
    "kind": "BinaryExpression",
    "properties": { "operator": "and" },
    "children": {
      "left": { "kind": "BinaryExpression", "properties": { "operator": ">=" }, "children": { "left": { "kind": "Hole" }, "right": { "kind": "Hole" } } },
      "right": { "kind": "BinaryExpression", "properties": { "operator": "<=" }, "children": { "left": { "kind": "Hole" }, "right": { "kind": "Hole" } } }
    }
  }
}
```

Le brouillon est inséré atomiquement dans un slot compatible. Les constructions
sont des nœuds Sapphire natifs : elles utilisent le schéma, le typage,
l'exécution, le debug et la transpilation existants. Les trous `Hole` restent
des emplacements incomplets à remplir dans l'IDE.

Un composite ne peut pas être proposé si sa racine n'est pas acceptée par le
slot ou si son placement est interdit. L'insertion revalide le brouillon avec
`createNodeBundle` et `insertSourceNodes`.

### Niveau B

Les nouveaux types d'AST sémantiques ne sont pas pris en charge. Le SDK ne
contient volontairement ni `semanticNodes`, ni schéma de slots de niveau B, ni
hook de passe moteur. Les annoncer comme opérationnels serait faux.

## Sécurité et frontière d'exécution

- Les plugins sont des **données** JSON, pas du code importé.
- Aucun `eval`, `new Function`, `import()` de plugin ou injection de script.
- Les widgets utilisent un renderer whitelisté et des composants React locaux.
- Les opérations natives sont évaluées par un interpréteur d'expressions
  whitelisté.
- La simulation, le debug et la transpilation s'exécutent dans le Worker du
  moteur avec le payload des plugins actifs ; le worker revalide le manifeste.
- Le renderer ne reçoit qu'un état sérialisable et des callbacks contrôlés.
- Les permissions de fichiers, réseau et API native sont refusées.
- Un plugin ne peut pas modifier librement le workspace ou l'état interne du
  moteur : il passe par les cartes, les ports typés, les opérations natives et
  les composites natifs.

Cette frontière n'est pas un sandbox JavaScript généraliste. Elle est plus
étroite : le code tiers n'est pas exécuté comme JavaScript du tout.

## Compatibilité

- `pluginFormatVersion` et `apiVersion` doivent valoir `1`.
- `minAppVersion` est comparé à la version de l'application ; `dev` ignore la
  contrainte pendant le développement.
- Les dépendances utilisent des plages sémantiques simples.
- Les conflits d'identifiants et d'opérations sont refusés à l'installation.
- Une désactivation ne détruit ni le plugin installé ni les cartes.
- Une désinstallation ne détruit pas les cartes ; elles deviennent des
  diagnostics de dépendance manquante.

## Dashboard exporté

Les widgets de plugin sont intégrés au dashboard web autonome :

- le renderer déclaratif est reproduit en DOM natif dans `src/dashboard/client.js` ;
- les widgets actifs et leurs définitions sont embarqués dans le JSON du dashboard ;
- les opérations natives de plugin sont transmises au runtime borné et au worker live, puis revalidées avant exécution ;
- les entrées liées à une variable utilisent les frames de variables capturées pendant le Run borné et les frames du live ;
- les sorties liées à une fonction `(T) -> void` déclenchent le callback dans le run borné ou le live ;
- un widget dont le plugin est absent reste visible sous forme de panneau de diagnostic, sans perte de données.

## Tests

```sh
pnpm plugin:test
pnpm plugin:build
pnpm plugin:pack
```

Les tests couvrent :

- installation, activation, désactivation, désinstallation ;
- conflits de plugins et d'opérations intégrées ;
- compatibilité d'hôte et de dépendances, cycles ;
- workspace avec widget de plugin absent et préservation des données ;
- persistance et restauration des widgets ;
- typage, simulation, transpilation JavaScript/Python et refus C ;
- backend manquant et manifeste invalide ;
- composite natif et insertion atomique ;
- dashboard exporté : widgets de plugin, définitions embarquées, variables capturées et runtime borné/live ;
- build, `npm pack` et utilisation depuis un projet externe.

## Exemples

- `examples/plugins/voltmeter.sp3plugin` : widget avec entrée, sortie, slider et
  propriétés.
- `examples/plugins/clamp.sp3plugin` : opération native `CLAMP` typée, pure,
  avec validation et émetteurs JavaScript/Python.
- `examples/plugins/between.sp3plugin` : composite « valeur comprise entre deux
  bornes » avec quatre trous après insertion.
- `examples/plugins/build-examples.mjs` : génère les trois fichiers avec le SDK.

## Limites de la première version

- Les widgets ne peuvent pas exécuter de composant React ou de JavaScript tiers.
- Les permissions fichiers/réseau/native ne sont pas implémentées.
- Les entrées de widget sont liées à une variable visible ; il n'existe pas
  encore de bus de données par port avec abonnement.
- Les sorties de widget appellent une fonction `(T) -> void` ; les callbacks
  multiples ou les événements riches ne sont pas disponibles.
- Les nœuds composites sont de niveau A uniquement.
- Aucun marketplace, backend distant ou publication npm.
