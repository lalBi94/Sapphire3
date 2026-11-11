# Transpiler SDK Sapphire 3

`@sapphire3/Transpiler` transforme un projet Sapphire 3 en code JavaScript, Python ou C expérimental sans lancer l'IDE. Le SDK réutilise directement `transpileProgram`, `transpileSelection` et l'analyse sémantique existante ; il ne crée ni second AST ni second analyseur.

## Statut et versionnement

- Package : `@sapphire3/Transpiler`, version `0.1.0`.
- Contrat public : `TRANSPILER_API_VERSION = 1`.
- SemVer : correctif pour une correction compatible, mineure pour un ajout, majeure pour une rupture. Toute rupture incrémente aussi `TRANSPILER_API_VERSION`.
- Package `private: true` dans le dépôt : aucune publication npm. L'archive locale reste installable via `npm pack`.
- Les projets créés par `@sapphire3/core` sont acceptés directement. Le SDK ne dépend pas de `@sapphire3/core` à l'exécution ; il réutilise le même analyseur sémantique.

## Construction et installation

```sh
pnpm install
pnpm --filter @sapphire3/Transpiler build
pnpm --filter @sapphire3/Transpiler run pack
```

L'archive est écrite dans `build/sdk/sapphire3-Transpiler-0.1.0.tgz`. Dans un projet externe :

```sh
npm install /chemin/vers/build/sdk/sapphire3-Transpiler-0.1.0.tgz
```

Le package n'a aucune dépendance runtime.

## API

```js
import {
  compile,
  compileModule,
  compileSelection,
  getTargets,
  getTargetCapabilities,
} from '@sapphire3/Transpiler'

const program = compile(project, { target: 'javascript' })
const module = compileModule(project, 'app', { target: 'python' })
const fragment = compileSelection(project, { kind: 'node', id: functionId }, { target: 'javascript' })
const targets = getTargets()
const capabilities = getTargetCapabilities('python')
```

### `compile(project, { target })`

Génère un programme autonome. Le projet doit être valide et contenir exactement un point d'entrée sans paramètre. Les cartes widget et les constructions non supportées sont refusées avec leurs diagnostics.

### `compileModule(project, moduleId, { target })`

Génère le code d'un module. C'est un **extrait de prévisualisation** : `kind: 'module'`, `standalone: false`. Aucun point d'entrée n'est exigé. Pour une classe, le code complet de la classe est émis.

### `compileSelection(project, selection, { target })`

Génère le code d'un nœud ou d'un module. `selection` vaut `{ kind: 'node' | 'module', id }` ou directement un identifiant de nœud. C'est un extrait (`standalone: false`) ; `kind` vaut `'selection'` pour un nœud et `'module'` pour un module.

Une sélection de membre de classe est élargie au module de classe par le backend existant ; les métadonnées exposent alors `expandedTo: { kind: 'module', id }`.

### `getTargets()`

Retourne toutes les cibles connues, y compris celles non installées. Chaque descripteur contient `id`, `name`, `extension`, `installed`, `available`, `status`, `operational`, `experimental` et `capabilities`.

### `getTargetCapabilities(target)`

Retourne le descripteur d'une cible, ou `null` si elle est inconnue.

## Résultat

```js
{
  ok: true,
  target: 'javascript',
  kind: 'program' | 'module' | 'selection',
  standalone: true,
  code: '...',
  diagnostics: [],
  metadata: { ... }
}
```

En cas d'échec, `ok` vaut `false`, `code` est vide et `metadata` vaut `null`. Les diagnostics restent disponibles avec leur code stable et leur localisation.

## Cibles et capacités

| Cible | Statut | Opérationnelle | Notes |
| --- | --- | --- | --- |
| JavaScript | stable | oui | primitives, tableaux, pointeurs, lambdas, classes, génériques, `ForEach` |
| Python | stable | oui | mêmes familles, runtime Python embarqué |
| C | expérimental | **non** | primitives, chaînes, fonctions, contrôle, pointeurs, pointeurs de fonction nommés, lambdas sans capture, `Print` |
| C++ | indisponible | non | aucune capacité |
| Java | indisponible | non | aucune capacité |

C reste volontairement **expérimental** : tableaux, classes, lambdas capturantes, `ForEach`, `MathCall`, conversions explicites, `char`, variables sans initialiseur et adresse d'une constante sont refusés. Le SDK ne le présente pas comme opérationnel.

`nativeMath` vaut `'partial'` pour JavaScript et Python : `arrayFill`, `arrayConvolve` et `arrayLookup` ne sont pas encore transpilés. Les contrats ne sont émis par aucune cible. Les widgets et entrées sont refusés pour toutes les cibles.

## Diagnostics

Les codes `TRANSPILE_*` existants sont conservés. Chaque diagnostic expose aussi `nodeId`, `moduleId` et `field` au niveau supérieur, en plus de `location`.

Principaux codes :

- `TRANSPILE_TARGET_UNSUPPORTED` ;
- `TRANSPILE_ENTRY_POINT_REQUIRED`, `TRANSPILE_ENTRY_POINT_DUPLICATE`, `TRANSPILE_ENTRY_POINT_INPUTS` ;
- `TRANSPILE_REFERENCE_UNRESOLVED` ;
- `TRANSPILE_SCREEN_UNSUPPORTED`, `TRANSPILE_GAUGE_UNSUPPORTED`, `TRANSPILE_INPUT_NUMBER_UNSUPPORTED`, etc. ;
- `TRANSPILE_C_UNSUPPORTED` ;
- `TRANSPILE_EXPRESSION_UNSUPPORTED`, `TRANSPILE_STATEMENT_UNSUPPORTED`, `TRANSPILE_LITERAL_UNSUPPORTED`.

Aucune génération silencieusement incorrecte : un backend qui ne sait pas émettre une construction produit un diagnostic et un résultat `ok: false`.

## Traçabilité

Les métadonnées exposent :

- `fragments` : fragment de programme ou extrait sélectionné, avec `sourceId`, `kind`, `start` et `end` ;
- `declarations` : nœuds déclarés avec leur nom source et leur nom généré ;
- `classes` : classes générées ;
- `entryPoint` : nœud et nom généré du point d'entrée ;
- `helpers` : helpers embarqués, dépendances externes et options de compilation ;
- `targetStatus`, `operational`, `experimental` et `capabilities`.

Les noms générés proviennent du contexte de génération réel. Pour les membres de classe, le nom effectif est utilisé (`constructor` en JavaScript, `__init__` en Python). Une sélection de membre de classe expose `expandedTo` lorsque le backend émet la classe complète.

## Exemples

- `examples/transpiler/javascript-class.mjs`
- `examples/transpiler/python-class.mjs`

```sh
pnpm --filter @sapphire3/Transpiler build
node examples/transpiler/javascript-class.mjs
node examples/transpiler/python-class.mjs
```

Les deux exemples construisent une classe `Counter` avec `@sapphire3/core`, compilent, exécutent le code généré et vérifient la sortie `6`.

## Vérifications

```sh
pnpm transpiler:test
pnpm transpiler:pack
```

Les tests couvrent les cibles et capacités, la compilation complète JavaScript/Python, les classes et méthodes, les tableaux, pointeurs et lambdas, les diagnostics, les widgets, les erreurs d'API, la traçabilité et le packaging `npm pack` dans un projet externe. Les suites de transpilation existantes restent vertes : le panneau Transpile de l'application n'est pas modifié.

## Ajouter une cible

1. Ajouter le backend et son entrée dans `src/utils/transpilation/languages.js`.
2. Enregistrer le backend dans `src/utils/transpilation/index.js`.
3. Décrire ses capacités réelles dans `packages/transpiler/src/targets.js`.
4. Ajouter des tests de conformité et documenter ses limites.

Aucune cible factice n'est enregistrée : une cible absente de `getTranspilationTargets()` reste `available: false`.

## Limites

- Le SDK ne compile ni n'exécute le code généré.
- Les extraits ne sont pas des fichiers autonomes : les helpers et déclarations englobantes ne sont pas recopiés.
- C est expérimental et limité au sous-ensemble documenté.
- Les cartes widget et d'entrée ne sont jamais transpilées.
- Aucun backend factice n'est ajouté ; C++ et Java restent indisponibles.
