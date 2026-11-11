# Rapport de capacités — Plugin SDK Sapphire 3

Date : 11 novembre 2026.  
Package : `@sapphire3/plugin-sdk` `0.1.0`.  
Contrat : `pluginFormatVersion: 1`, `apiVersion: 1`.

Ce rapport distingue strictement ce qui est **opérationnel**, ce qui est
**partiel** et ce qui reste **hors périmètre**.

## Opérationnel

| Capacité | État | Preuves / chemins |
| --- | --- | --- |
| Importer un plugin local `.sp3plugin` | Opérationnel | `Settings → Plugins`, `src/services/plugins.js`, dialogue natif Neutralinojs |
| Valider un manifeste versionné | Opérationnel | `packages/plugin-sdk/src/manifest.js`, `tests/plugins/manifest.test.js` |
| Installer, activer, désactiver, désinstaller | Opérationnel | `src/utils/plugins/pluginLifecycle.js`, `tests/plugins/lifecycle.test.js` |
| Détecter les conflits de plugin et d'opération native | Opérationnel | `findPluginConflicts`, `tests/plugins/lifecycle.test.js` |
| Vérifier les dépendances et versions | Opérationnel | `resolvePluginRecords`, `satisfiesVersionRange`, tests de dépendances et cycles |
| Vérifier la compatibilité de l'hôte | Opérationnel | `minAppVersion`, `checkPluginCompatibility`, test d'hôte incompatible |
| Préserver un workspace avec plugin absent | Opérationnel | carte `pluginWidget`, `isPluginWidgetCardValid`, `tests/plugins/widget.test.js` |
| Widgets interactifs sur le canvas | Opérationnel | renderer déclaratif, `PluginWidgetCard`, slider, bouton, LED, valeur, barre |
| Sélection, déplacement, redimensionnement | Opérationnel | type de sélection `pluginWidget`, géométrie de carte, dimensions minimales du manifeste |
| Propriétés configurables | Opérationnel | panneau Configuration, `sanitizeWidgetProperties` |
| État initial, sérialisation et restauration | Opérationnel | `card.state`, `sanitizeWidgetState`, `serializeWorkspace`/`deserializeWorkspace` |
| Entrées typées depuis une variable | Opérationnel | `card.bindings.inputs`, collecte des variables live/debug/bornées |
| Sorties typées vers une fonction | Opérationnel | `card.bindings.outputs`, événement `functionId` du live |
| Opération native typée | Opérationnel | `MathCall` + registre dynamique, `createNativeOperationDefinition` |
| Validation et pureté/effets déclarés | Opérationnel | expression `validation`, `purity`, `effects` |
| Simulation bornée et live | Opérationnel | `simulation.js`, `liveSimulation.js`, payload Worker revalidé |
| Transpilation JavaScript/Python optionnelle | Opérationnel | émetteurs d'expression, `TRANSPILE_EXPRESSION_UNSUPPORTED` si absent |
| Refus C explicite | Opérationnel | `TRANSPILE_C_UNSUPPORTED`, test dédié |
| Nœud composite de niveau A | Opérationnel | `composite.expansion`, action de menu, `createNodeBundle` + `insertSourceNodes` |
| Composites transformés en AST natif | Opérationnel | `tests/plugins/composite.test.js` |
| Aucun `eval`, `new Function`, import de code tiers | Opérationnel | renderer whitelisté, interpréteur d'expressions, import JSON |
| Permissions explicites | Opérationnel | `ui.widgets`, `workspace.widget-state`, `engine.native-operations`, `engine.composites` |
| Permissions fichiers/réseau/native refusées | Opérationnel | `PLUGIN_PERMISSION_UNSUPPORTED` |
| Interface multilingue du gestionnaire | Opérationnel | clés `plugins.*` dans les huit langues |
| Tests automatisés | Opérationnel | `tests/plugins/*.test.js`, packaging npm local |
| Documentation externe | Opérationnel | `docs/sdk/plugin-sdk.md`, `packages/plugin-sdk/README.md`, exemples |

## Partiel ou volontairement limité

| Capacité | Limite actuelle |
| --- | --- |
| Renderer de widget | Arbre déclaratif whitelisté ; pas de React/JS tiers, pas de HTML, pas de ressource distante |
| Entrées de widget | Liaison à une variable visible par nom ; pas d'abonnement par port ni de flux d'événements riche |
| Sorties de widget | Une fonction `(T) -> void` par sortie ; pas de callbacks multiples |
| Dashboard web exporté | Opérationnel | widgets de plugin, opérations natives de plugin, variables capturées au pas, runtime borné/live et rendu déclaratif embarqués |
| Persistance des plugins | Préférence locale `sapphire-plugins` ; pas de synchronisation |
| Import local | Dialogue natif Neutralinojs ; pas de glisser-déposer de fichier plugin |
| Compatibilité de version | Plages simples `*`, exacte, `^`, `~`, `>=`, `>` ; pas de résolution de conflits avancée |
| Isolation | Frontière déclarative et Worker du moteur ; ce n'est pas un sandbox JavaScript généraliste |
| Composite | Niveau A seulement ; les trous sont remplis avec les outils natifs existants |
| Signatures natives | Primitifs et tableaux de primitifs ; pas de classes, pointeurs ou fonctions comme paramètres |

## Hors périmètre / futur

| Capacité | État |
| --- | --- |
| Nœuds sémantiques de niveau B | Non opérationnel, aucune API exposée |
| Schéma de slots de niveau B | Non implémenté |
| Passes de typage/exécution/debug de niveau B | Non implémentées |
| Déclarations de transpilation de niveau B | Non implémentées |
| Sérialisation versionnée de niveau B | Non implémentée |
| Marketplace, backend distant, OAuth | Non implémentés et hors demande |
| Publication npm | Non effectuée, package `private: true` |
| Accès fichiers/réseau/natif des plugins | Non implémenté et refusé |
| Code UI React tiers | Non exécuté |
| Notifications de mise à jour de plugin | Non implémentées |

## Critère de réussite

Un développeur externe peut :

1. écrire un manifeste avec `definePlugin` ;
2. le valider avec `validatePluginDocument` ;
3. produire un `.sp3plugin` avec `stringifyPluginDocument` ;
4. l'installer localement depuis **Settings → Plugins** ;
5. ajouter un widget fonctionnel, une opération native typée ou un composite
   natif sans modifier les fichiers du moteur.

Les trois exemples fournis sont validés et testés. Le widget affiche un état,
accepte une interaction, persiste ses données et survit à l'absence du plugin.
L'opération native est typée, simulée et transpilée vers JavaScript/Python.
Le composite s'insère atomiquement comme AST natif.

## Vérifications associées

- `pnpm plugin:test` : tests SDK, cycle de vie, widgets, opérations natives,
  composites, packaging.
- `pnpm test` : suite complète du dépôt, sans régression des widgets intégrés.
- `pnpm build` : build Vite du frontend.
- `pnpm plugin:pack` : archive locale `build/sdk/`.
- Aucun push distant ni publication npm.
