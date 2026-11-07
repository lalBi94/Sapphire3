# Mode exercice — Sapphire 3

> Premier incrément, 7 novembre 2026. Outil d'entraînement local, pas un examen surveillé.

## 1. Principe

Un exercice est un **workspace `.sp3` normal** auquel s'ajoute un manifeste `exercise`. Il contient :

- un titre et des consignes ;
- un **snapshot de départ** (`starter`) : le squelette que l'élève peut restaurer ;
- une liste de **tests** exécutés par le moteur existant.

Le manifeste vit dans le fichier, sous la clé racine `exercise`, à côté de `project` et `presentation`. Il n'entre ni dans la source logique ni dans l'AST.

## 2. Flux enseignant

1. Préparer le **squelette** dans le canvas, avec le point d'entrée et les fonctions attendues.
2. Ouvrir **Exercise → Create exercise** : le squelette courant devient le `starter`.
3. Compléter titre et consignes dans **Edit exercise**.
4. Résoudre l'exercice, puis capturer les résultats attendus :
   - **Capture entry point output** exécute le point d'entrée et enregistre sa sortie ;
   - **Add a function test** exécute une fonction avec des arguments typés et enregistre sa valeur de retour.
5. Enregistrer le `.sp3`. L'élève qui l'ouvre peut travailler, vérifier et **Reset to starter**.
6. Conserver une solution séparée si nécessaire : le fichier élève contient le squelette et les tests, pas une correction séparée.

## 3. Flux élève

1. Ouvrir le `.sp3` : le panneau **Exercise** s'ouvre automatiquement.
2. Lire les consignes, modifier le programme.
3. **Check** exécute chaque test dans le Web Worker, avec annulation possible.
4. Le panneau affiche réussi/échoué par test, la valeur attendue et la valeur obtenue.
5. **Reset to starter** restaure le squelette après confirmation ; les tests sont conservés.
6. À la fin de **Check**, le robot réagit via le système de notifications existant : expression **succès** si tous les tests passent, **erreur** sinon. Le message est traduit et remplacé à chaque nouvelle vérification.
7. Quand tous les tests passent, **Save solution** propose d'enregistrer une copie `.sp3` sous `<titre>-solution.sp3`. C'est la « banque de corrections » : un dossier de fichiers corrigés, sans stockage interne supplémentaire.

## 4. Protection par mot de passe

Un exercice peut être verrouillé par un mot de passe :

- sans `lock`, l'exercice reste éditable normalement ;
- avec `lock`, le panneau remplace **Edit exercise** par **Unlock to edit** ; il faut saisir le mot de passe pour modifier le titre, les consignes ou les tests ;
- le déverrouillage vaut pour la session courante, pas pour le fichier ;
- **Protect exercise** demande un mot de passe et sa confirmation, puis stocke uniquement une empreinte **PBKDF2-SHA256** (sel aléatoire, 150 000 itérations, 32 octets) ;
- **Remove protection** est disponible après déverrouillage.

**Limite importante** : c'est un verrou d'**interface**, pas un chiffrement du `.sp3`. Le fichier reste modifiable dans un éditeur de texte, et le verrou peut être retiré. Le message est affiché dans le panneau.

## 5. Format du manifeste

```json
{
  "version": 1,
  "title": "Additionner deux entiers",
  "instructions": "Implémentez add(a, b).",
  "lock": { "algorithm": "PBKDF2-SHA256", "iterations": 150000, "salt": "…", "hash": "…" },
  "starter": {
    "project": { "formatVersion": 1, "id": "workspace", "modules": [], "nodes": [] },
    "presentation": {
      "cards": [],
      "camera": { "x": 0, "y": 0, "zoomLevel": 0 },
      "selected": null
    }
  },
  "tests": [
    {
      "id": "uuid",
      "kind": "entry",
      "title": "affiche ok",
      "expectedOutput": ["ok"]
    },
    {
      "id": "uuid",
      "kind": "function",
      "title": "add(2, 3)",
      "functionName": "add",
      "args": [2, 3],
      "expectedReturn": "5"
    }
  ]
}
```

### Types de test

| `kind` | Exécution | Comparaison |
| --- | --- | --- |
| `entry` | point d'entrée, sans paramètre | sortie complète, ligne par ligne |
| `function` | fonction nommée avec `args` | `returnValue` formaté, égalité stricte |

Règles :

- comparaison stricte, sans conversion implicite ;
- `args` ne contient que des valeurs JSON primitives (chaîne, booléen, nombre fini) ;
- une fonction introuvable ou ambiguë produit une erreur de test, jamais un choix arbitraire ;
- budget de simulation existant (10 000 pas) ;
- un test en erreur n'interrompt pas les suivants ;
- les résultats ne sont pas enregistrés dans le fichier.

## 6. Validation

- `validateExercise` refuse un manifeste mal formé, un titre vide, des identifiants dupliqués, un `starter` incomplet ou plus de 100 tests.
- Le `starter` est validé comme un workspace complet (projet et présentation) à l'import et à l'export.
- Un fichier sans `exercise` reste un workspace ordinaire.

## 7. Limites assumées

- **Les tests sont lisibles et modifiables** dans le JSON. C'est un outil de feedback, pas d'anti-triche.
- Le mot de passe verrouille l'**interface**, pas le fichier : le `.sp3` reste modifiable et le verrou retirable.
- La « banque » est un simple dossier de fichiers `<titre>-solution.sp3` ; aucun catalogue interne ni suivi de versions.
- Pas encore de zones verrouillées, d'indices progressifs, de notation partielle, de soumission ni de correction automatique côté enseignant.
- Pas de serveur, de compte ni de suivi de progression.
- Un test de fonction dépend du **nom** de la fonction ; renommer la fonction casse le test, qui apparaît alors en erreur explicite.
- Les entrées de fonction restent limitées aux primitifs simples, comme le panneau « Run this function » existant.
- La capture exécute le programme courant : elle ne doit pas dépendre de valeurs aléatoires ou d'un état externe.

## 8. Vérifications

- `tests/workspace/exercise.test.js` : validation, évaluation entrée/fonction, erreurs, nom ambigu, snapshot de départ, aller-retour workspace.
- Contrôle navigateur : création, capture d'un test, Check réussi, ajout de carte, Reset restaurant le squelette, Check à nouveau réussi.
- Audit axe : panneau élève et mode édition sans violation.
