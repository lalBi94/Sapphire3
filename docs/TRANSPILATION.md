# Transpilation — périmètre et correspondances

Cette page décrit ce que Sapphire 3 accepte de traduire vers chaque langage cible, comment les constructions SP3 sont reliées à leurs équivalents, et ce qui est refusé explicitement. Elle complète `docs/LOGIC_API.md`, qui reste la référence des contrats du moteur.

La transpilation est toujours une **action explicite**. Aucun code n'est généré, compilé ou exécuté au chargement d'un projet. Le modèle source, l'AST, l'analyse sémantique et les types restent indépendants des langages cibles.

## Chaîne commune

1. `analyzeProgram()` construit l'AST, les portées, les symboles, les types et les diagnostics.
2. Les gardes globales refusent les projets contenant une carte widget ou d'entrée, quelle que soit la cible.
3. `createGenerationContext()` prépare les noms, les imports, les classes, le point d'entrée et la sélection.
4. Le backend choisi émet le fichier ou l'extrait, avec ses propres helpers.
5. Les diagnostics du backend sont fusionnés avec ceux de l'analyse ; une erreur bloquante rend le résultat `ok: false`.

Un programme complet exige exactement un point d'entrée sans paramètre. Un aperçu de sélection (`transpileSelection`) n'exige pas de point d'entrée et ne produit jamais un fichier autonome.

## Matrice de périmètre

| Construction SP3 | JavaScript | Python | C expérimental |
| --- | --- | --- | --- |
| Primitifs numériques et booléen | Oui | Oui | Oui |
| `string` | Oui | Oui | Oui, en `const char *` UTF-8 |
| `char` | Oui | Oui | Non |
| Fonctions, paramètres, retours | Oui | Oui | Oui |
| Variables et constantes | Oui | Oui | Oui, avec initialiseur obligatoire |
| Blocs, `if`, `while`, `for`, `break`, `continue` | Oui | Oui | Oui |
| `Print` | Oui | Oui | Oui, sauf pointeur |
| Tableaux | Oui | Oui | Non |
| Pointeurs `&` / `*` | Oui, par cellules | Oui, par cellules | Oui, pointeurs natifs |
| Références de fonction | Oui | Oui | Non |
| Lambdas et fermetures | Oui | Oui | Non |
| `ForEach` | Oui | Oui | Non |
| Classes, `new`, `this`, membres | Oui | Oui | Non |
| Génériques | Oui, fonction ordinaire | Oui, fonction ordinaire | Non |
| `MathCall` | Partiel | Partiel | Non |
| Conversions explicites | Oui | Oui | Non |
| Contrats | Non émis | Non émis | Non émis |
| Cartes widget et entrées | Refusées | Refusées | Refusées |

« Partiel » pour `MathCall` signifie que les opérations sans équivalent direct dans le registre du backend sont refusées : `arrayFill`, `arrayConvolve` et `arrayLookup` ne sont pas encore transpilées vers JavaScript/Python. Les opérations d'écran sont hors sujet puisque toute carte Screen rend le projet non transpilable.

## Correspondances communes

### Noms et références

`createGenerationContext()` réserve les noms de déclarations avant l'émission. Un nom de module et de fonction devient un identifiant stable et unique, par exemple `Library_square`. Les mots réservés du langage cible sont préfixés, les caractères non valides sont remplacés, et les collisions reçoivent un suffixe.

Les références et les imports ne sont pas réinterprétés : ils utilisent les symboles déjà résolus par l'analyse. Une référence non résolue produit `TRANSPILE_REFERENCE_UNRESOLVED` plutôt qu'un nom inventé.

Les classes ont leurs propres noms de membres, réservés par langage (`constructor`, `__init__`, `__proto__`, etc.) et désambiguïsés à l'intérieur de la classe.

### Fonctions, modules et imports

Un module n'est pas émis comme un objet d'exécution : ses fonctions deviennent des fonctions du langage cible, préfixées par le nom du module. Un import ne produit ni `import` JavaScript, ni `import` Python, ni inclusion C : la référence importée est résolue vers le nom généré de la fonction exportée. Le fichier reste autonome.

Une fonction ordinaire est émise une seule fois, avec ses paramètres concrets. Les génériques ne créent pas de copie : JavaScript/Python émettent la même fonction ordinaire et la simulation applique les types inférés. C refuse les types génériques.

Les références de fonction sont des valeurs de première classe en JavaScript et Python. C ne les accepte pas : seuls les appels directs à une fonction nommée sont émis.

Le point d'entrée est appelé à la fin de l'initialisation globale, dans le `main` généré. Les méthodes de classe restent dans leur classe en JavaScript/Python ; C refuse les classes.

### Initialisation globale

Les modules sont initialisés dans le **même ordre topologique stable** que la simulation : un module consommateur passe après ses fournisseurs d'imports, et l'ordre source départage les modules indépendants. Les déclarations de fonctions et de classes sont écrites avant l'initialisation, puis le point d'entrée est appelé.

### Contrats

Les contrats attachés aux variables, constantes et paramètres sont vérifiés par le **simulateur** et le **Run live**. Ils ne sont pas émis dans le code généré des trois cibles : le fichier produit ne contient pas de vérification de contrat.

### Widgets et entrées

Toute carte **Screen**, **Gauge**, **ProgressBar**, **BarChart**, **XY plot**, **Oscilloscope**, **Heatmap**, **LED**, **RGB LED**, bouton d'entrée, entrée entière/décimale/texte, sélecteur RGB ou RGBA rend le projet non transpilable, avec un code dédié (`TRANSPILE_SCREEN_UNSUPPORTED`, `TRANSPILE_GAUGE_UNSUPPORTED`, `TRANSPILE_INPUT_NUMBER_UNSUPPORTED`, etc.). Ces cartes restent simulables et exportables en SVG.

## JavaScript

Cible active, fichier `.js` unique sans `import` ni `export`.

| Élément SP3 | Émission JavaScript |
| --- | --- |
| Module et fonction | `Module_fonction`, prototype implicite par déclaration de fonction |
| `Print` | `console.log(sapphireFormat(valeur))` |
| Nombres | `sapphireNumeric` et `sapphireChecked` ; entiers en `BigInt` interne, arrondi binaire32 pour `float` |
| Tableaux | tableaux JavaScript, `sapphireArray`, `sapphireElement`, `sapphireWrite` |
| Pointeurs | jeton d'adresse et `sapphirePointer` / `sapphireDeref` / `sapphireDerefWrite` |
| `ForEach` | `sapphireForEach(copie, callback)` |
| Références de fonction | valeur de fonction JavaScript |
| Lambdas | fonction fléchée |
| Classes | `class`, `constructor`, champs par instance, méthodes ; `sapphireMember` lie les méthodes |
| `Print` d'une classe | `sapphireFormat` produit `ClassName { champ: valeur }` |
| `MathCall` | table `nativeJavaScript` : `Math.*`, `sapphireInteger*`, `sapphireArray*`, `sapphireString*` |
| Conversions | `sapphireNumeric.convertConstant` ou opérateur équivalent |
| Chaînes et `char` | chaînes JavaScript ; `Array.from` pour compter les scalaires Unicode |
| Génériques | une seule fonction ordinaire, sans spécialisation |

Refus principaux : cartes widget, `arrayFill`, `arrayConvolve`, `arrayLookup`, et les expressions ou instructions qu'un backend ne sait pas encore émettre (`TRANSPILE_EXPRESSION_UNSUPPORTED`, `TRANSPILE_STATEMENT_UNSUPPORTED`, `TRANSPILE_LITERAL_UNSUPPORTED`).

## Python

Cible active, fichier `.py` unique avec un runtime Python embarqué.

| Élément SP3 | Émission Python |
| --- | --- |
| Module et fonction | `Module_fonction`, `global` pour les globales affectées |
| `Print` | `print(sapphireFormat(valeur))` |
| Nombres | `sapphireBinary`, `sapphireUnary`, `sapphireCheck`, arrondi binaire32 pour `float` |
| Tableaux | listes Python, `sapphireArray`, `sapphireElement`, `sapphireWrite` |
| Pointeurs | cellule à un élément et `_SapphirePointer` |
| `ForEach` | `sapphireForEach(liste, callback)` avec copie |
| Références de fonction | callable Python |
| Lambdas | `lambda` |
| Classes | `class`, `__init__`, méthodes, `self` ; `sapphireMember` |
| `Print` d'une classe | `sapphireFormat` produit `ClassName { champ: valeur }` |
| `MathCall` | table `nativePython` : `math.*`, `sapphireClamp`, `sapphireSign`, `sapphireArray*`, `sapphireString*` |
| Conversions | `sapphireCast` |
| Chaînes et `char` | `str` Python, indexation par scalaires Unicode |
| Génériques | une seule fonction ordinaire, sans spécialisation |

Refus principaux : cartes widget, `arrayFill`, `arrayConvolve`, `arrayLookup`, et les textes Unicode contenant un surrogate isolé (`TRANSPILE_PYTHON_STRING_UNSUPPORTED`).

## C expérimental

Cible active mais volontairement restreinte, fichier `.c` C11 unique. Les helpers flottants utilisent `<math.h>` ; à l'édition, compiler avec `cc -std=c11 … -lm` sur les plateformes qui séparent la bibliothèque mathématique.

| Élément SP3 | Émission C |
| --- | --- |
| Types | `int16_t`, `uint16_t`, `int32_t`, `uint32_t`, `float`, `double`, `const char *`, `bool` |
| Module et fonction | `Module_fonction`, prototypes avant les définitions |
| `Print` | `sapphire_print_i16`, `sapphire_print_u16`, `sapphire_print_i32`, `sapphire_print_u32`, `sapphire_print_f32`, `sapphire_print_f64`, `sapphire_print_bool`, `sapphire_print_string` |
| Entiers | `sapphire_iadd/isub/imul/idiv/imod` et `sapphire_uadd/usub/umul/udiv/umod`, bornes et division par zéro |
| Flottants | `sapphire_f32_add/sub/mul/div` et `sapphire_f64_add/sub/mul/div`, infinis, sous-flux et division par zéro |
| Flottants imprimés | représentation décimale courte qui round-trip, notation fixe entre `1e-6` et `1e21` |
| Pointeurs | `&variable`, `&paramètre`, `*p` ; adresse d'une constante refusée |
| Chaînes | `const char *` UTF-8, égalité par `strcmp` ; NUL et surrogates isolés refusés |
| `Print` d'un pointeur | Refusé |
| Globales | `static T nom;`, initialisées dans `main()` dans l'ordre topologique |
| Point d'entrée | `Module_<entrée>()` appelé depuis le `main` C |
| Contrats | Non émis |

Refus explicites avec `TRANSPILE_C_UNSUPPORTED` : tableaux, classes, lambdas, références de fonction, `ForEach`, `MathCall`, conversions explicites, `char`, variables sans initialiseur et adresse d'une constante. Le backend vérifie ces limites avant d'émettre le fichier.

Limites connues du C : les globales non encore initialisées valent zéro avant leur affectation ; un pointeur vers une variable locale ne doit pas survivre à sa fonction ; les flottants de magnitude extrême peuvent différer du format JavaScript. C++ et Java restent indisponibles.

## Comment les opérations SP3 sont reliées

Le registre `src/utils/logic/mathNatives.js` est le **catalogue unique** des opérations natives SP3 : identifiant stable, catégorie, signature et groupe d'interface. Les backends ne recréent pas ce catalogue ; ils fournissent chacun une table de correspondance par identifiant :

- `nativeJavaScript` dans `src/utils/transpilation/javascript.js` ;
- `nativePython` dans `src/utils/transpilation/python.js` ;
- le backend C refuse actuellement toutes les `MathCall`.

Une opération présente dans le registre mais absente de la table du backend produit un diagnostic stable (`TRANSPILE_EXPRESSION_UNSUPPORTED` en JavaScript/Python, `TRANSPILE_C_UNSUPPORTED` en C). Une opération inconnue est déjà refusée par l'analyse (`NODE_INCOMPLETE` ou `TYPE_MISMATCH`).

Pour ajouter une opération :

1. l'ajouter au registre `mathNatives.js` avec sa signature et son groupe ;
2. ajouter son émission dans `nativeJavaScript` et/ou `nativePython` ;
3. si la cible C doit la porter, ajouter un helper et une émission C, sinon la laisser refusée ;
4. ajouter un test qui compare la simulation et le code généré.

Les fonctions ordinaires suivent le même principe : le contexte commun réserve leurs noms et résout leurs références, puis chaque backend émet une fonction, une méthode de classe ou une fonction C avec sa signature concrète. Les génériques ne créent pas de copie : JavaScript/Python émettent une seule fonction ordinaire et la simulation exécute la même fonction avec les types inférés. Le C n'accepte pas les types génériques.

## Codes de refus utiles

| Code | Signification |
| --- | --- |
| `TRANSPILE_TARGET_UNSUPPORTED` | Cible inconnue ou non installée |
| `TRANSPILE_ENTRY_POINT_REQUIRED` | Aucun point d'entrée pour un programme complet |
| `TRANSPILE_ENTRY_POINT_INPUTS` | Point d'entrée paramétré |
| `TRANSPILE_ENTRY_POINT_DUPLICATE` | Plusieurs points d'entrée |
| `TRANSPILE_REFERENCE_UNRESOLVED` | Référence non résolue |
| `TRANSPILE_SCREEN_UNSUPPORTED`, `TRANSPILE_GAUGE_UNSUPPORTED`, `TRANSPILE_PROGRESS_UNSUPPORTED`, `TRANSPILE_BAR_CHART_UNSUPPORTED`, `TRANSPILE_XY_PLOT_UNSUPPORTED`, `TRANSPILE_OSCILLOSCOPE_UNSUPPORTED`, `TRANSPILE_HEATMAP_UNSUPPORTED`, `TRANSPILE_LED_UNSUPPORTED`, `TRANSPILE_RGB_LED_UNSUPPORTED` | Carte graphique non transpilable |
| `TRANSPILE_INPUT_BUTTON_UNSUPPORTED`, `TRANSPILE_INPUT_NUMBER_UNSUPPORTED`, `TRANSPILE_INPUT_STRING_UNSUPPORTED`, `TRANSPILE_RGB_PICKER_UNSUPPORTED`, `TRANSPILE_RGBA_PICKER_UNSUPPORTED` | Entrée ou sélecteur non transpilable |
| `TRANSPILE_C_UNSUPPORTED` | Construction hors du sous-ensemble C expérimental |
| `TRANSPILE_EXPRESSION_UNSUPPORTED`, `TRANSPILE_STATEMENT_UNSUPPORTED`, `TRANSPILE_LITERAL_UNSUPPORTED` | Trou de couverture d'un backend JavaScript/Python |

## Vérifications

La suite `pnpm test` couvre les trois backends. Les tests C compilent le fichier généré avec `cc -std=c11` et l'exécutent ; ils vérifient les primitives et `Print`, les fonctions et le contrôle, les pointeurs, le débordement contrôlé, les refus explicites et la sélection. Les exemples **Fibonacci**, **Recursion**, **Imports**, **Pointers** et **Calculus** produisent la même sortie que le simulateur en C. JavaScript et Python couvrent en plus les tableaux, les lambdas, `ForEach`, les classes et les opérations natives prises en charge.

`pnpm build` vérifie la compilation du frontend. La cible C n'est pas compilée par l'application elle-même : l'export produit un fichier `.c` que l'utilisateur compile avec son outil C.
