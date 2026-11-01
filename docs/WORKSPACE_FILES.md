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
- `cards` : toutes les cartes, même hors écran, dans leur ordre de rangement. Chaque carte contient `id`, `type` (`module`/`comment`/`image`), `name`, `x`, `y`, `width`, `height`, `expandedNodeIds`. Les commentaires ajoutent `text` ; les images ajoutent `image` (Data URL d'image intégrée, ou chaîne vide) et `caption`. Les URL distantes, chemins locaux et autres protocoles sont refusés avant remplacement. La carte active au premier plan n'est pas persistée comme ordre de rangement.
- `hidden` est une clef optionnelle de carte, acceptée seulement comme booléen : absente ou fausse, la carte est affichée ; le drapeau n'est écrit dans le fichier que lorsqu'il vaut `true`.
- `locked` est une clef optionnelle de carte, acceptée seulement comme booléenne : absente ou fausse, la carte est libre ; le drapeau n'est écrit que lorsqu'il vaut `true`. Une carte verrouillée ne peut être ni déplacée ni redimensionnée (pointeur ou clavier) ; position, taille, nom et source restent inchangés, aucune étape d'historique dédiée n'est créée.
- `emoji` est une clef optionnelle de carte, acceptée seulement comme chaîne d'au plus 16 unités : absente ou vide, aucun emoji n'est affiché ; la valeur n'est écrite que lorsqu'elle est non vide. L'emoji est une présentation posée en haut à gauche d'une carte Module, hors source logique, et ne crée aucune étape d'historique dédiée.
- `contracts` est une liste optionnelle sur un nœud source, chaque entrée valant `{ kind }` avec un genre connu (`positive`, `nonNegative`, `nonEmpty`). Une entrée de genre inconnu est refusée à l'import ; la liste est conservée telle quelle à la sérialisation et survit aux éditions de propriétés.
- La carte d'un module partage son identifiant et son nom ; chaque module doit posséder exactement une carte. Les annotations ne figurent pas dans `project`.
- Géométrie en unités monde ; minimum 180 × 120. `expandedNodeIds` contient les nœuds dépliés du module ; les identifiants supprimés sont écartés à l'export, sans modifier l'état actif. La bascule « tout déplier » et l'action « tout replier » d'un module n'écrivent que cette liste, sans nouvelle clef de fichier.
- La croissance du module après insertion met à jour cette géométrie exportable ; le signal d'ajustement automatique reste temporaire. L'import ne redimensionne pas les cartes restaurées. La suppression confirmée d'un Comment ne modifie que `cards`, sans toucher à la source logique.
- Masquer une carte ne modifie que `cards` : position, taille, pliage, nom et source logique sont conservés, aucune étape d'historique dédiée n'est créée (la branche redo est invalidée comme pour toute édition de présentation). Une carte masquée n'est pas montée : elle disparaît du canvas, des liens intermodules, du cadre de recentrage et des résultats de la recherche de blocs, mais reste enregistrée dans le fichier et réaffichable. Ni la simulation ni le débogueur ne la réaffichent automatiquement.
- `camera` reprend les coordonnées du centre et l'exposant de zoom existant (maximum 2, soit 400 %). `selected` vaut `null` ou `{kind: "module" | "node", id}`.
- Menus ouverts, formulaires non validés, gestes en cours et positions de défilement internes ne sont pas sauvegardés. L'export est celui du document validé en mémoire au clic, pas une capture d'image.
- Le presse-papiers local de nœuds, les indicateurs de DnD et les messages de transfert ne sont pas exportés. Un import confirmé vide ce presse-papiers. Les sous-arbres copiés/déplacés effectivement validés appartiennent à la source normale du workspace ; le format v1 ne change pas.

## Import

Le lecteur accepte un instantané complet ou une **source logique JSON v1 seule**. Dans ce dernier cas, il crée une disposition déterministe des modules, tous les nœuds pliés, avec une vue à l'origine et sans sélection. Aucun contenu logique n'est inventé.

Les versions inconnues, doublons d'identifiants, géométries invalides, incohérences carte/module et structures incompatibles avec l'interface sont refusés. Une ancienne catégorie de module `main` n'est pas convertie silencieusement. Un programme sémantiquement incomplet ou invalide peut être restauré si sa structure est affichable ; le moteur garde ses diagnostics, notamment de typage ou de points d'entrée multiples.

La lecture et la validation précèdent la confirmation **Replace and import**. L'annulation ou une erreur conserve le document courant. L'import confirmé remplace le workspace, réinitialise les interactions temporaires, restaure le pliage, la vue et la sélection ; il ne fusionne pas les documents.

L'historique undo/redo est vidé après import confirmé : un ancien document ne doit pas être restauré sous le chemin du nouveau fichier. L'annulation de suppression est locale, sans écriture sur disque. Les déplacements, saisies d'annotations et changements de pliage ne créent pas d'étapes dédiées d'historique ; ils invalident toutefois la branche redo.

## Accès aux fichiers

- Barre supérieure compacte : **Edit** expose undo/redo, **View** la navigation ; **Settings** propose **Open .sp3 file**, les fichiers récents, **Save .sp3**, **Import .sp3 / .json** et **Export JSON**.
- Dialogues de choix de fichier Neutralinojs ; aucun chemin de projet imposé, autosave, accès distant ou stockage du workspace dans le navigateur. Langue, thème et chemins récents sont des préférences locales séparées.
- Extension choisie garantie à l'export ; confirmation avant écrasement du chemin final. Après ouverture confirmée d'un `.sp3`, son chemin est conservé en mémoire et ajouté aux cinq chemins récents persistés localement : cliquer sur un chemin relit directement le fichier et repasse par la confirmation de remplacement. **Ctrl+S** et **Save .sp3** écrivent directement le fichier ouvert. Un workspace sans chemin ouvre « Enregistrer sous » avec le filtre `.sp3`, puis mémorise le chemin après écriture. Les chemins devenus inaccessibles sont retirés de la liste. Succès affiché uniquement après écriture terminée.
- Écriture atomique : un brouillon unique est créé dans le dossier cible, sa taille UTF-8 est vérifiée, puis `filesystem.move` le renomme sur l'original. Aucune réécriture directe de l'original en cas d'échec : celui-ci reste intact et le brouillon vérifié est conservé, avec son chemin dans l'erreur `ATOMIC_REPLACE_FAILED`.
- Limite actuelle : 20 Mio en import/export. Annulations silencieuses ; erreurs de lecture, permission, données ou écriture affichées, sans blocage des fonctionnalités hors fichier.
- Services natifs dans `src/services/workspaceFiles.js` ; client `@neutralinojs/lib` 6.10.0. Authentification `one-time`, globals injectés dans la fenêtre et permissions explicites pour les dialogues, `getStats`, `readFile`, `writeFile`, `move` et `remove`.
- Titres et filtres applicatifs des dialogues selon la langue de l'interface, passée explicitement au service. Erreurs de format/fichier identifiées par codes stables et paramètres ; traduction dans l'UI, y compris après un changement de langue. Messages techniques internes conservés pour les tests, jamais utilisés comme catalogue de traduction. Boutons et erreurs propres à Windows dans la langue système.
- `pnpm dev:web` sert au contrôle du frontend : les opérations de fichier affichent qu'elles nécessitent l'application desktop. Redémarrer une ancienne fenêtre Neutralinojs après un changement de permissions/configuration.

## Vérifications

`tests/workspace/workspaceFile.test.js` contrôle l'aller-retour, Unicode, annotations, source incomplète, géométrie, pliage, sélection, vue, versions, données invalides et absence de mutation. Le moteur reste pur ; le module de format ne fait aucun accès disque. Les contrôles natifs détaillés sont consignés dans `docs/PROJECT_ARCHIVE.md`.
