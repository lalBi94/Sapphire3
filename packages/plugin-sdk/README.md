# Plugin SDK Sapphire 3

`@sapphire3/plugin-sdk` est le kit local pour ajouter des widgets, des opérations
natives typées et des nœuds composites de niveau A à Sapphire 3, sans modifier
les fichiers internes du moteur.

La première version est **déclarative** : un plugin est un document JSON
`.sp3plugin`, importé par l'utilisateur. Aucun `import()` de code tiers, `eval`,
`new Function` ou accès direct au DOM, au moteur ou au système de fichiers n'est
exécuté.

## Construire le SDK

```sh
pnpm --filter @sapphire3/plugin-sdk build
pnpm --filter @sapphire3/plugin-sdk run pack
```

L'archive locale est produite dans `build/sdk/`.

## Écrire un plugin

```js
import { definePlugin, defineWidget, defineNativeOperation, stringifyPluginDocument } from '@sapphire3/plugin-sdk'

const plugin = definePlugin({
  pluginFormatVersion: 1,
  apiVersion: 1,
  id: 'org.example.hello',
  name: 'Hello plugin',
  version: '1.0.0',
  author: 'Example',
  description: 'A local widget example.',
  permissions: ['ui.widgets', 'workspace.widget-state'],
  widgets: [defineWidget({
    id: 'hello',
    name: 'Hello widget',
    description: 'Shows a label and a button.',
    category: 'Examples',
    icon: 'box',
    defaultSize: { width: 260, height: 160 },
    minSize: { width: 200, height: 120 },
    properties: [],
    inputs: [],
    outputs: [],
    interactions: [{ id: 'click', kind: 'button', label: 'Click', value: true }],
    initialState: {},
    renderer: { kind: 'stack', children: [
      { kind: 'text', text: 'Hello Sapphire' },
      { kind: 'button', interaction: 'click' },
    ] },
  })],
})

console.log(stringifyPluginDocument(plugin))
```

Écrire le résultat dans un fichier `.sp3plugin`, puis l'importer depuis
**Settings → Plugins → Import local plugin**.

## Capacités

- **Widgets** : rendu déclaratif sûr, propriétés configurables, état persistant,
  ports d'entrée typés liés à une variable, sorties typées liées à une fonction
  `(T) -> void`, slider et bouton.
- **Opérations natives** : signature typée, pureté/effets, validation,
  implémentation par expression sûre, émetteurs JavaScript/Python optionnels,
  refus explicite si un backend manque.
- **Nœuds composites** : un brouillon de constructions Sapphire natives est
  inséré dans un slot compatible ; le typage, l'exécution, le debug et la
  transpilation restent ceux du moteur.

Les nœuds sémantiques de **niveau B** ne sont pas opérationnels dans cette
version : aucune API factice n'est exposée.

## Permissions

Permissions prises en charge :

- `ui.widgets`
- `workspace.widget-state`
- `engine.native-operations`
- `engine.composites`

Les permissions `filesystem.read`, `filesystem.write`, `network.access` et
`native.api` sont déclarables mais **refusées à l'import** : aucun accès
correspondant n'existe dans l'hôte.

## Documentation complète

Voir `docs/sdk/plugin-sdk.md` du dépôt Sapphire 3 : manifeste, cycle de vie,
permissions, compatibilité, tests, limites et rapport de capacités.
