# Fichiers workspace Sapphire 3

## Contenu et versions

`.sp3` et `.json` sont deux extensions du **même instantané JSON UTF-8**, non compressé :

```json
{
  "application": "Sapphire 3",
  "workspaceVersion": 1,
  "project": { "formatVersion": 1, "id": "workspace", "modules": [], "nodes": [] },
  "presentation": {
    "cards": [],
    "camera": { "x": 0, "y": 0, "zoomLevel": 0 },
    "selected": null
  }
}
```

- `project` : source logique complète, identifiants, références, types et marqueur de point d'entrée inclus. AST, diagnostics, index et caches sont recalculés, pas enregistrés.
- `cards` : toutes les cartes, même hors écran, dans leur ordre de superposition. Chaque carte contient `id`, `type` (`module`/`comment`), `name`, `x`, `y`, `width`, `height`, `expandedNodeIds`. Les annotations ajoutent `text`.
- La carte d'un module partage son identifiant et son nom ; chaque module doit posséder exactement une carte. Les annotations ne figurent pas dans `project`.
- Géométrie en unités monde ; minimum 180 × 120. `expandedNodeIds` contient les nœuds dépliés du module ; les identifiants supprimés sont écartés à l'export, sans modifier l'état actif.
- La croissance du module après insertion met à jour cette géométrie exportable ; le signal d'ajustement automatique reste temporaire. L'import ne redimensionne pas les cartes restaurées. La suppression confirmée d'un Comment ne modifie que `cards`, sans toucher à la source logique.
- `camera` reprend les coordonnées du centre et l'exposant de zoom existant (maximum 2, soit 400 %). `selected` vaut `null` ou `{kind: "module" | "node", id}`.
- Menus ouverts, formulaires non validés, gestes en cours et positions de défilement internes ne sont pas sauvegardés. L'export est celui du document validé en mémoire au clic, pas une capture d'image.

## Import

Le lecteur accepte un instantané complet ou une **source logique JSON v1 seule**. Dans ce dernier cas, il crée une disposition déterministe des modules, tous les nœuds pliés, avec une vue à l'origine et sans sélection. Aucun contenu logique n'est inventé.

Les versions inconnues, doublons d'identifiants, géométries invalides, incohérences carte/module et structures incompatibles avec l'interface sont refusés. Une ancienne catégorie de module `main` n'est pas convertie silencieusement. Un programme sémantiquement incomplet ou invalide peut être restauré si sa structure est affichable ; le moteur garde ses diagnostics, notamment de typage ou de points d'entrée multiples.

La lecture et la validation précèdent la confirmation **Replace and import**. L'annulation ou une erreur conserve le document courant. L'import confirmé remplace le workspace, réinitialise les interactions temporaires, restaure le pliage, la vue et la sélection ; il ne fusionne pas les documents.

## Accès aux fichiers

- Barre supérieure compacte : **Edit** et **View** réservent des volets sans actions ; **Settings** propose **Import .sp3 / .json**, **Export .sp3**, **Export JSON**.
- Dialogues de choix de fichier Neutralinojs ; aucun chemin de projet imposé, autosave, accès distant ou stockage navigateur.
- Extension choisie garantie à l'export ; confirmation avant écrasement du chemin final. Succès affiché uniquement après écriture terminée.
- Limite actuelle : 20 Mio en import/export. Annulations silencieuses ; erreurs de lecture, permission, données ou écriture affichées, sans blocage des fonctionnalités hors fichier.
- Services natifs dans `src/services/workspaceFiles.js` ; client `@neutralinojs/lib` 6.10.0. Authentification `one-time`, globals injectés dans la fenêtre et permissions explicites pour les dialogues, `getStats`, `readFile`, `writeFile` seulement.
- `pnpm dev:web` sert au contrôle du frontend : les opérations de fichier affichent qu'elles nécessitent l'application desktop. Redémarrer une ancienne fenêtre Neutralinojs après un changement de permissions/configuration.

## Vérifications

`tests/workspace/workspaceFile.test.js` contrôle l'aller-retour, Unicode, annotations, source incomplète, géométrie, pliage, sélection, vue, versions, données invalides et absence de mutation. Le moteur reste pur ; le module de format ne fait aucun accès disque. Les contrôles natifs détaillés sont consignés dans `docs/PROJECT_ARCHIVE.md`.
