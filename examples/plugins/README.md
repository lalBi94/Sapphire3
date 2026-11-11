# Exemples de plugins Sapphire 3

Trois plugins locaux complets sont fournis. Ils sont générés par
`build-examples.mjs` avec `@sapphire3/plugin-sdk` et peuvent être importés depuis
**Settings → Plugins → Import local plugin**.

| Fichier | Capacité |
| --- | --- |
| `voltmeter.sp3plugin` | Widget avec entrée `double`, sortie `double`, slider, propriétés et état persistant |
| `clamp.sp3plugin` | Opération native `pluginClamp` / `CLAMP`, typée `int`, pure, validée, avec émetteurs JavaScript et Python |
| `between.sp3plugin` | Nœud composite « Value between bounds » qui se déplie en comparaisons natives et trous |

## Régénérer les fichiers

```sh
node examples/plugins/build-examples.mjs
```

Le script valide chaque manifeste avant de l'écrire. Il ne publie rien et
n'accède à aucun service distant.

## Essayer le widget

1. Importer `voltmeter.sp3plugin`.
2. Ouvrir la palette de commandes (**Ctrl+K**) et choisir **Digital voltmeter**,
   ou utiliser le menu de création du canvas.
3. Le widget apparaît avec une mesure à `0.00 V` et un slider.
4. Pour recevoir une valeur, exécuter un programme qui déclare une variable
   visible, puis choisir cette variable dans **Configuration → Inputs**.
5. Pour produire une entrée, lier une fonction `(double) -> void` dans
   **Configuration → Outputs**, puis déplacer le slider.

## Essayer l'opération native

Importer `clamp.sp3plugin`, puis créer un nœud `MathCall` et choisir
**CLAMP** dans **Plugin operations**. Le typage vérifie trois entiers et la
simulation comme la transpilation JavaScript/Python utilisent l'implémentation
déclarée. Le backend C refuse explicitement `MathCall`.

## Essayer le composite

Importer `between.sp3plugin`, puis ouvrir le menu d'un emplacement d'expression
compatible (par exemple l'initialiseur d'une variable booléenne) et choisir
**Value between bounds**. Le nœud se déplie en un `and` de deux comparaisons
avec quatre trous à remplir.

## Limites

- Aucun code React ou JavaScript tiers n'est exécuté.
- Les permissions de fichiers, réseau et API native ne sont pas disponibles.
- Les nœuds sémantiques de niveau B ne sont pas opérationnels.
- Aucun marketplace ni backend distant.
