# Accessibilité — Sapphire 3

> Référentiel d'accessibilité de **Sapphire 3**, version `0.1.0-beta.6`. Audit daté des **6, 7 et 8 novembre 2026**. Ce document décrit ce qui a été vérifié, corrigé et ce qui reste partiel ou non vérifié. **Il ne constitue pas une certification WCAG.**

## A. Périmètre

### Version et environnements

- Application : Sapphire 3 `0.1.0-beta.6`, React 19, Vite 8, JavaScript/JSX, CSS, pnpm, Neutralinojs 6.10.0.
- Audit principal : Chromium piloté par l'outil navigateur, serveur `pnpm dev:web` sur `http://127.0.0.1:5173`.
- Fenêtre desktop Neutralinojs/WebView2 : **non testée dans cet audit**. Les résultats ci-dessous concernent le frontend dans Chromium.
- Système : Windows. Facteur de mise à l'échelle Windows, zoom WebView2 et haute densité : **non testés**.
- Lecteurs d'écran réellement exécutés : **aucun**. NVDA, Narrator, JAWS et VoiceOver n'ont pas été lancés. Les constats sur les rôles et noms accessibles proviennent du DOM, d'axe-core et de l'arbre d'accessibilité du navigateur, pas d'une restitution vocale.

### Outils

- `axe-core` 4.10.2, déjà présent en dépendance de développement.
- Inspection du DOM et des styles calculés.
- Calcul mathématique des rapports de contraste WCAG 2.x sur les sept palettes prédéfinies et leurs variantes sombre et claire.
- Vérification des tailles de cibles avec `getBoundingClientRect`.
- Aucun test axe automatisé n'est exécuté dans la CI.

### États audités

| État | Violations axe-core |
| --- | --- |
| Canvas vide avec HUD d’arrière-plan, barre supérieure fermée | 0 |
| Workspace **Weather station** (5 cartes, BarChart, Heatmap, Run actif) | 0 |
| Panneau de propriétés d'un nœud | 0 |
| Recherche de blocs (`Ctrl+F`) | 0 |
| Menu d'actions d'un nœud | 0 |
| Menu de création catégorisé (3 colonnes, recherche) | 0 |
| Panneau de simulation | 0 |
| Panneau de debug | 0 |
| Panneau d'exercice | 0 |
| Historique des notifications | 0 |
| Fenêtre Paramètres — les 7 onglets | 0 |
| Langue arabe (`lang="ar"`, `dir="rtl"`) | 0 |

Les résultats `incomplete` ont aussi été examinés. Après corrections, il ne reste que des `color-contrast` incomplets sur des textes posés sur des dégradés, surfaces translucides ou flous. Ces cas ont été vérifiés par le calcul des tokens (section D), pas par axe.

**Rejeu après la refonte Void / Acid (7 novembre 2026)** : 0 violation sur le canvas vide, le workspace **Arrays**, la fenêtre **Paramètres** et le volet **Theme**. La géométrie et les surfaces opaques sont conservées ; la **palette Sapphire par défaut** garde ses contrastes audités, et la **palette Void / Acid optionnelle** a été vérifiée : texte principal `#E8EDF2` sur `#06070A`, texte atténué `#9CA7B5` sur `#0C0F14`, acide `#B6FF2E` sur `#06070A` et texte sombre sur acide. Les `incomplete` restants concernent des textes posés sur des visuels ou des dégradés fonctionnels.

**Rejeu après l'ajout des variantes sombre et claire (7 novembre 2026)** : 0 violation axe-core sur la fenêtre **Paramètres → Theme** et le menu **Theme** de la barre, en apparence sombre puis claire, avec **Sapphire** puis **Void / Acid**. Les `incomplete` restants sont les textes du statut de canvas posés sur le fond dégradé. Les contrastes des variantes claires sont dérivés et vérifiés par calcul : texte principal ≥ 14,9:1 sur les surfaces claires, texte atténué ≥ 5,0:1, accents, accents secondaires, statuts et familles de nœuds ≥ 4,5:1, texte sur accent ≥ 4,5:1, y compris sur les teintes douces utilisées en sélection. Les overrides d'un thème personnalisé s'appliquent aux deux variantes.

**HUD d’arrière-plan (7 novembre 2026)** : les artefacts texte du canvas sont **décoratifs et ambiants**, marqués `aria-hidden="true"` et sans équivalent interactif ; l’information essentielle (version, compteurs, zoom, thème, grille, aimantation, raccourcis) reste disponible dans la barre, le statut de canvas, les paramètres et le catalogue de raccourcis. Axe-core ne relève **aucune violation** sur le canvas avec HUD en sombre et en clair ; les textes à faible opacité apparaissent en `color-contrast` **incomplet**, ce qui est attendu pour cette couche volontairement discrète. Le HUD est ignoré en mouvement réduit (animation du voyant) et renforcé en contraste élevé.

**Classes, scopes et instances (7 novembre 2026)** : 0 violation axe-core sur une carte **Class**, ses scopes **Public**/**Private**, le menu d’insertion limité aux membres et le formulaire **Constructeur**. Le badge `Class`, l’accent de sélection, les boutons de scope et les formulaires reprennent les tokens du thème et restent lisibles dans les deux apparences. Les boutons d’action du menu utilisent un état visuel `data-selected` plutôt que `aria-pressed`, conforme au rôle `menuitem` ; les boutons de scope conservent `aria-pressed` dans leur groupe. Limite : les tests NVDA/Narrator et WebView2 ne sont toujours pas exécutés.

**Export Web Dashboard (8 novembre 2026)** : audit Lighthouse du dashboard exporté (`gaugeDemo` et `rgbMixer`) : **accessibilité 1.0**, **bonnes pratiques 1.0**. Le document reprend la DA Void/Acid de l'application et embarque les polices Inter, Space Grotesk et JetBrains Mono en data URL. Il contient un lien d'évitement, les repères `banner`/`main`/`contentinfo`, des titres de panneaux, des boutons nommés, un statut `role="status"`, des focus visibles et des poignées de déplacement/redimensionnement utilisables au clavier. La barre de progression est un curseur nommé, utilisable au clic et au clavier (flèches, Home, End) ; elle met l'exécution en pause et revient au pas choisi. Les widgets exposent un nom accessible ; Screen, Gauge, ProgressBar, BarChart et Heatmap ont un résumé textuel borné, mais les pixels d'un écran n'ont pas d'équivalent textuel complet. Le mode clair/sombre, la disposition locale et l'ouverture `file://` ont été vérifiés dans Chromium (polices, `localStorage`, sélecteur et worker). Limites : aucun lecteur d'écran réel, aucune ouverture `file://` dans WebView2/Neutralinojs, et les tableaux de données détaillés des widgets ne sont pas reproduits dans le dashboard.

## B. Matrice WCAG 2.2 — niveau A et AA

Légende : **✅** conforme et vérifié ; **◐** partiellement conforme ; **✖** non conforme ; **?** non vérifié ; **—** non applicable.

### Principe 1 — Perceptible

| Critère | Niv. | Applicabilité | État | Preuve / méthode | Limite |
| --- | --- | --- | --- | --- | --- |
| 1.1.1 Non-text Content | A | Applicable | ◐ | Icônes décoratives `aria-hidden`, images avec `alt`, widgets avec nom accessible, BarChart/Heatmap avec tableaux masqués, Screen `role="img"`. DOM et axe. | Les pixels d'un Screen n'ont pas d'équivalent textuel ; le contenu visuel arbitraire reste non décrit. |
| 1.2.1 Audio-only and Video-only (Prerecorded) | A | Non applicable | — | Aucun média audio/vidéo. | — |
| 1.2.2 Captions (Prerecorded) | A | Non applicable | — | Aucun média. | — |
| 1.2.3 Audio Description or Media Alternative | A | Non applicable | — | Aucun média. | — |
| 1.2.4 Captions (Live) | AA | Non applicable | — | Aucun flux live. | — |
| 1.2.5 Audio Description (Prerecorded) | AA | Non applicable | — | Aucun média. | — |
| 1.3.1 Info and Relationships | A | Applicable | ◐ | HTML sémantique (`main`, `nav`, `section`, `h2`/`h3`, `label`, `table`), rôles ARIA ciblés, arbre logique avec boutons et `aria-expanded`/`aria-pressed`. | Le canvas spatial n'expose pas toutes les relations intermodules dans une structure unique ; l'arbre logique est par module. |
| 1.3.2 Meaningful Sequence | A | Applicable | ◐ | Lien d'évitement, ordre DOM barre → canvas → panneaux, arbre logique ordonné. | L'ordre spatial du canvas est arbitraire et ne constitue pas un ordre de lecture. |
| 1.3.3 Sensory Characteristics | A | Applicable | ◐ | La plupart des actions ont un libellé textuel. | Certaines aides mentionnent une position ou un geste ; revue exhaustive non réalisée. |
| 1.3.4 Orientation | AA | Applicable | ✅ | Fenêtre redimensionnable, aucune orientation imposée (`neutralino.config.json`, 480×320 minimum). | Comportement à toutes les tailles non testé. |
| 1.3.5 Identify Input Purpose | AA | Non applicable | — | L'application ne collecte pas de données personnelles ; les champs portent des noms, types et valeurs de programme. | — |
| 1.4.1 Use of Color | A | Applicable | ✅ | Groupes de nœuds avec libellé de type, sélection avec anneau et soulignement, point d'entrée avec badge texte, diagnostics textuels. | Simulation de daltonisme non exécutée. |
| 1.4.2 Audio Control | A | Non applicable | — | Aucun son. | — |
| 1.4.3 Contrast (Minimum) | AA | Applicable | ✅ | Texte 16,84–17,58:1 ; texte atténué 6,65–9,72:1 ; primaire, sélection et diagnostic 8,46–14,26:1 sur les six thèmes. Calcul WCAG. | Thèmes personnalisés non vérifiés ; dégradés approchés par leur surface de base. |
| 1.4.4 Resize Text | AA | Applicable | ? | Aucun test de zoom texte à 200 %. | Polices majoritairement en `px` ; vérification Windows/WebView2 nécessaire. |
| 1.4.5 Images of Text | AA | Applicable | ✅ | Aucune image de texte ; l'interface utilise du texte réel et la mascotte est décorative. | — |
| 1.4.10 Reflow | AA | Applicable | ? | Panneaux avec largeur maximale et défilement ; canvas spatial assumé. | Test à 320 px CSS / 400 % non réalisé ; le canvas ne peut pas être aplati sans perdre sa nature. |
| 1.4.11 Non-text Contrast | AA | Applicable | ◐ | Focus, sélection, primaire et couleurs de nœuds ≥ 3:1. **Bordures 1,46–1,68:1**, bordures de survol 2,44–2,93:1. Calcul WCAG. | Les composants identifiés uniquement par leur bordure fine ne satisfont pas 3:1. Correction globale reportée pour préserver l'identité visuelle. |
| 1.4.12 Text Spacing | AA | Applicable | ? | Aucun test avec espacement de texte personnalisé. | Risque de rognage dans les cartes compactes ; à vérifier. |
| 1.4.13 Content on Hover or Focus | AA | Applicable | ◐ | InfoHint s'affiche au survol/focus, se ferme à la sortie et à `Échap`. | L'infobulle n'est pas survolable (`pointer-events: none`) et n'est pas persistante. |

### Principe 2 — Utilisable

| Critère | Niv. | Applicabilité | État | Preuve / méthode | Limite |
| --- | --- | --- | --- | --- | --- |
| 2.1.1 Keyboard | A | Applicable | ◐ | Contrôles natifs, déplacement/redimensionnement au clavier, réordonnancement par boutons, copier/coller/dupliquer, dialogues et menus au clavier. | Certaines manipulations spatiales n'ont pas d'alternative au clic seul (voir 2.5.7). |
| 2.1.2 No Keyboard Trap | A | Applicable | ✅ | Dialogue modal natif avec piège de focus volontaire, fermeture par `Échap` ; pas d'autre piège. | Non testé avec lecteur d'écran. |
| 2.1.4 Character Key Shortcuts | A | Applicable | ✅ | Raccourcis par défaut avec `Ctrl`, `Shift`, `F5`, `F6` ; personnalisables. | — |
| 2.2.1 Timing Adjustable | A | Non applicable | — | Aucune limite de temps imposée à l'utilisateur. Le budget de pas de simulation n'est pas un délai d'interface. | — |
| 2.2.2 Pause, Stop, Hide | A | Applicable | ✅ | Pause/arrêt de la simulation, mouvement réduit, animations non essentielles désactivées. | Non testé avec lecteur d'écran. |
| 2.3.1 Three Flashes or Below Threshold | A | Applicable | ✅ | Aucun contenu clignotant. | — |
| 2.4.1 Bypass Blocks | A | Applicable | ✅ | Lien d'évitement « Aller au canvas » vers `#canvas-main`, premier arrêt clavier. | Non testé avec lecteur d'écran. |
| 2.4.2 Page Titled | A | Applicable | ✅ | `<title>Sapphire 3</title>` dans `index.html`. | — |
| 2.4.3 Focus Order | A | Applicable | ◐ | Lien d'évitement, barre, canvas, panneaux ; dialogues natifs. | L'ordre spatial du canvas et les panneaux dynamiques ne suivent pas toujours un ordre visuel simple. |
| 2.4.4 Link Purpose (In Context) | A | Applicable | ✅ | Les liens visibles ont un texte explicite (dépôt, crédits). | Revue exhaustive des liens externes non réalisée. |
| 2.4.5 Multiple Ways | AA | Applicable | ✅ | Menus, recherche de blocs, bibliothèque d'exemples et fichiers récents. | — |
| 2.4.6 Headings and Labels | AA | Applicable | ◐ | `h1` masqué, titres de panneaux `h2`/`h3`, titres de cartes `h2`, champs libellés. | Hiérarchie de tous les panneaux secondaires non parcourue exhaustivement. |
| 2.4.7 Focus Visible | AA | Applicable | ✅ | Anneaux `outline` 2 px, `focus-within` sur les champs, trait de sélection sur le graphe. | Tous les contrôles n'ont pas été parcourus au clavier un par un. |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Applicable | ◐ | Panneaux ramenés au premier plan, lien d'évitement, focus capturé dans les dialogues. | Un panneau flottant peut encore masquer un élément focalisé du canvas. |
| 2.5.1 Pointer Gestures | A | Applicable | ◐ | Déplacement/zoom au clavier et par boutons ; gestes tactiles non requis pour les fonctions principales. | Tous les gestes de pointeur n'ont pas été audités. |
| 2.5.2 Pointer Cancellation | A | Applicable | ◐ | `pointercancel` géré, capture de pointeur, `Échap` annule le glisser de nœud, pas d'action irréversible au `pointerdown`. | Audit exhaustif de chaque glisser non réalisé. |
| 2.5.3 Label in Name | A | Applicable | ✅ | Les boutons visibles ont un nom accessible cohérent ; les boutons d'icône ont un `aria-label`. | — |
| 2.5.4 Motion Actuation | A | Non applicable | — | Aucune action par capteur de mouvement. | — |
| 2.5.7 Dragging Movements | AA | Applicable | ◐ | Réordonnancement par boutons haut/bas ; copier/coller/dupliquer pour les nœuds ; déplacement et redimensionnement au clavier. | **Pas d'alternative au clic seul** pour déplacer/redimensionner spatialement un module, une annotation ou un panneau flottant. |
| 2.5.8 Target Size (Minimum) | AA | Applicable | ◐ | Contrôles audités à 24×24 : menus de carte, vues, pliage, verrou, redimensionnement, arbre logique, vitesse de simulation. InfoHint étendu à 24×24 par zone de clic. Cases à cocher portées par un libellé de 35 px de haut. | Audit exhaustif de tous les écrans non réalisé ; certaines cibles décoratives ou très compactes restent à vérifier. |

### Principe 3 — Compréhensible

| Critère | Niv. | Applicabilité | État | Preuve / méthode | Limite |
| --- | --- | --- | --- | --- | --- |
| 3.1.1 Language of Page | A | Applicable | ✅ | `lang` mis à jour pour les 8 langues ; arabe en `dir="rtl"`. Vérifié dans le navigateur. | — |
| 3.1.2 Language of Parts | AA | Applicable | ◐ | Textes d'interface traduits dans `translations.js`. | Contenus utilisateur, noms de programme et sorties ne portent pas de `lang` ; leur langue est inconnue. |
| 3.2.1 On Focus | A | Applicable | ✅ | Le focus seul ne déclenche pas de changement de contexte. | — |
| 3.2.2 On Input | A | Applicable | ◐ | Les sélecteurs de langue et de thème changent l'interface immédiatement ; leur libellé annonce l'effet. | Changement de contexte automatique, jugé acceptable car c'est la fonction du contrôle. |
| 3.2.3 Consistent Navigation | AA | Applicable | ✅ | Barre et menus conservent le même ordre et les mêmes groupes. | — |
| 3.2.4 Consistent Identification | AA | Applicable | ✅ | Mêmes icônes et libellés pour les mêmes actions. | — |
| 3.2.6 Consistent Help | A | Applicable | ✅ | Aides InfoHint placées de façon cohérente près des libellés concernés. | — |
| 3.3.1 Error Identification | A | Applicable | ◐ | Erreurs affichées avec `role="alert"` et codes traduits. | Les erreurs de formulaire ne sont pas reliées au champ précis par `aria-invalid`/`aria-describedby`. |
| 3.3.2 Labels or Instructions | A | Applicable | ✅ | Champs avec `label` ou `aria-label`, aides InfoHint, contraintes annoncées. | Formulaires dynamiques non parcourus exhaustivement. |
| 3.3.3 Error Suggestion | AA | Applicable | ◐ | Les diagnostics expliquent la cause et parfois la correction attendue. | Toutes les erreurs ne proposent pas une correction explicite. |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Applicable | ✅ | Confirmations avant remplacement/suppression, undo/redo, sauvegarde et récupération. | — |
| 3.3.7 Redundant Entry | A | Non applicable | — | Aucune saisie multi-étapes exigeant de ressaisir une information. | — |
| 3.3.8 Accessible Authentication (Minimum) | AA | Applicable | ✅ | Champ mot de passe natif, collage autorisé, aucun CAPTCHA. Verrou d'interface local, pas d'authentification distante. | Non testé avec gestionnaire de mots de passe. |

### Principe 4 — Robuste

| Critère | Niv. | Applicabilité | État | Preuve / méthode | Limite |
| --- | --- | --- | --- | --- | --- |
| 4.1.1 Parsing | A | Non applicable | — | Critère retiré de WCAG 2.2. | — |
| 4.1.2 Name, Role, Value | A | Applicable | ◐ | Contrôles natifs, rôles ARIA ciblés, `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current` ; axe sans violation. | Le canvas spatial n'est pas une arborescence complète d'éléments nommés ; l'arbre logique est un palliatif. |
| 4.1.3 Status Messages | AA | Applicable | ✅ | `role="status"` et `role="alert"` sur les messages ; le compteur de pas de simulation n'est plus une région live, seuls les changements d'état sont annoncés. | Non testé avec lecteur d'écran. |

### Critères AAA examinés sans obligation

- **2.3.3 Animation from Interactions** : mouvement réduit pris en charge.
- **2.4.13 Focus Appearance** : anneaux de focus 2 px avec décalage, jugés suffisamment visibles, sans vérification formelle.
- **1.4.6 Contrast (Enhanced)** : non atteint partout (texte atténué sur surface élevée jusqu'à 6,65:1).
- **2.5.5 Target Size (Enhanced)** : non atteint (cible AAA de 44×44 non généralisée).
- **3.3.6 Error Prevention (All)** : partiel, les confirmations ne couvrent pas toutes les actions.

## C. Résultats automatisés

### Violations trouvées et corrigées pendant cet audit

1. **`landmark-unique`** sur les nœuds logiques. Les nœuds étaient des `<section>` répétés avec des noms vides ou identiques, créant des régions dupliquées. Correction : les nœuds sont des `<div>` sans rôle de repère ; le bouton de titre porte le nom accessible. Vérification : 0 violation sur Weather station.
2. **`scrollable-region-focusable`** sur `.settings-window__content` dans l'onglet « Informations projet ». La zone défilante sans contrôle focalisable n'était pas atteignable au clavier. Correction : `tabIndex={0}` et anneau de focus visible. Vérification : 0 violation sur les 7 onglets.
3. **`aria-prohibited-attr`** (incomplete) sur `aria-label` posé sur un `<div>` générique et sur des `<header>` sans rôle. Correction : suppression du libellé redondant sur le nœud, ajout de `role="group"` aux en-têtes déplaçables. Vérification : plus d'incomplete de ce type.
4. **`aria-required-children`** (incomplete) sur une `listbox` vide. Correction : la liste n'est rendue que lorsqu'elle contient des options ; le message « aucun résultat » reste affiché. Vérification : `aria-expanded="false"`, pas de `listbox` vide.

### Incomplete restants

- `color-contrast` sur 27 textes posés sur des dégradés, surfaces translucides ou flous. Ces cas ne peuvent pas être tranchés par axe. Le calcul des tokens donne des rapports conformes pour le texte et le texte atténué ; les limites des bordures sont documentées en 1.4.11.

### Absence de test automatisé en CI

La CI actuelle exécute `pnpm test` et `pnpm build`, pas axe-core. Aucun navigateur headless n'est configuré. La procédure manuelle de rejeu est décrite en section F.

## D. Résultats manuels et mesures

### Contraste mathématique des six thèmes

Rapports WCAG calculés sur les couleurs composées, avec transparence prise en compte pour les bordures. Plage observée sur `sapphire`, `neon`, `mono`, `rose`, `pro` et `educational` :

| Paire | Rapport minimal–maximal | Seuil | Résultat |
| --- | --- | --- | --- |
| Texte / fond noir ou anthracite | 16,84–17,58:1 | 4,5:1 | ✅ |
| Texte atténué / fond ou surface élevée | 6,65–9,72:1 | 4,5:1 | ✅ |
| Primaire / fond | 8,72–15,44:1 | 4,5:1 | ✅ |
| Texte sur primaire | 9,66–15,44:1 | 4,5:1 | ✅ |
| Sélection / fond | 8,46–11,67:1 | 3:1 | ✅ |
| Diagnostic / fond | 9,36–11,38:1 | 3:1 | ✅ |
| Couleurs de groupes de nœuds / anthracite | 4,62–14,75:1 | 3:1 | ✅ |
| **Bordure / fond** | **1,46–1,68:1** | 3:1 | ✖ |
| **Bordure de survol / surface élevée** | **2,44–2,93:1** | 3:1 | ✖ |

Les bordures très discrètes font partie de l'identité visuelle. Une correction globale a été écartée pour ne pas dégrader l'apparence ; le point reste une non-conformité connue de 1.4.11.

### Langues et direction

Les huit langues ont été activées successivement : `lang` suit la langue et `dir="rtl"` est appliqué uniquement à l'arabe. Les captures axe en arabe donnent 0 violation.

### Clavier et focus

- Le lien d'évitement est le premier arrêt et cible `#canvas-main`.
- Les dialogues natifs piègent le focus et `Échap` les ferme.
- Les panneaux flottants stoppent la propagation des touches pour ne pas déclencher les flèches du canvas pendant la saisie.
- Les raccourcis globaux ignorent les champs `input`, `textarea`, `select` et `contenteditable`.
- Le menu de création place le focus dans la recherche ; les flèches haut/bas atteignent les cartes, `Entrée` active le premier résultat et `Échap` ferme le menu.
- Le retour de focus après la confirmation de remplacement a été implémenté avec un suivi du dernier élément focalisé. **Il n'a pas pu être validé de façon fiable dans l'environnement de test**, car la fenêtre du navigateur n'était pas focalisée au niveau du système ; à rejouer manuellement.

### Widgets et données

- **BarChart** : tableau masqué avec position et valeur pour chaque barre ; le résumé `role="img"` reste disponible.
- **Heatmap** : tableau masqué avec ligne, colonne et valeur pour chaque cellule ; le résumé de dimensions reste disponible. Une grille 32×32 produit 1 024 lignes, volontairement consultables et non annoncées automatiquement.
- **Screen** : `role="img"` et libellé de dimensions ; les pixels restent une représentation visuelle sans équivalent textuel.
- **Gauge, ProgressBar, LED, RGB LED** : noms accessibles et valeurs déjà présents.

### Tailles de cibles mesurées

Contrôles ramenés ou maintenus à **24×24 CSS px** : menu de carte, verrou, vues écran/code, pliage de module, redimensionnement de panneau flottant et de debug, contrôles de l'arbre logique (plier, point d'arrêt, réordonner, titre), boutons de vitesse et champ de vitesse personnalisée. InfoHint conserve une icône de 16 px mais une zone interactive de 24×24 via pseudo-élément. Les cases à cocher de 13 px sont portées par des libellés de 35 px de haut.

## E. Limites restantes

### Non conformités ou écarts connus

1. **1.4.11 — contraste des bordures** : 1,46–1,68:1, sous le seuil de 3:1. Les surfaces et les libellés restent perceptibles, mais une bordure seule ne suffit pas à identifier certains composants.
2. **2.5.7 — glisser-déposer** : pas d'alternative au clic seul pour déplacer ou redimensionner spatialement un module, une annotation ou un panneau flottant. Le réordonnancement de nœuds et les transferts par copier/coller disposent d'alternatives.
3. **3.3.1 / 3.3.3 — erreurs de formulaire** : messages globaux traduits, mais pas de liaison `aria-invalid`/`aria-describedby` au champ fautif.
4. **1.4.13 — infobulle** : InfoHint n'est ni survolable ni persistante ; `Échap` la ferme désormais.
5. **1.1.1 — Screen** : les pixels n'ont pas de description textuelle significative.

### Vérifications humaines encore nécessaires

1. **NVDA et Narrator** sur Windows, dans Chromium puis dans la fenêtre WebView2 du build desktop.
2. **Zoom texte 200 %**, **reflow 320 px / 400 %** et **espacement de texte** personnalisé.
3. **Mise à l'échelle Windows** et haute densité.
4. **Retour de focus** après les dialogues, avec une fenêtre réellement focalisée.
5. **Parcours clavier complet** création → édition → Run → Debug → exercice.
6. **Simulation de daltonisme** sur les douze couleurs de groupes.
7. **Thèmes personnalisés** : aucune vérification ni avertissement de contraste pour les couleurs choisies.
8. **Build desktop Neutralinojs/WebView2** : non testé dans cet audit.

### Backlog priorisé

1. Vérifier et corriger les contrastes de bordure sans refonte visuelle (P2).
2. Ajouter des commandes de déplacement/redimensionnement accessibles au clic seul pour les modules, annotations et panneaux (P1).
3. Relier les erreurs de formulaire aux champs concernés (P1).
4. Rendre InfoHint survolable et persistante, ou la remplacer par une aide intégrée (P2).
5. Ajouter un avertissement de contraste dans l'éditeur de thèmes personnalisés (P2).
6. Compléter la vue structurelle intermodules et son équivalence fonctionnelle (P1).
7. Ajouter axe-core à la CI avec un navigateur headless léger (P3).
8. Tester NVDA/Narrator et le build WebView2 (P3).

## F. Procédure de reproduction

### Lancer l'application et axe

1. `pnpm install`
2. `pnpm dev:web`
3. Ouvrir `http://127.0.0.1:5173`.
4. Dans la console, injecter axe-core :

```js
const script = document.createElement('script')
script.src = '/node_modules/axe-core/axe.min.js'
document.head.appendChild(script)
```

5. Après chargement, exécuter :

```js
const result = await axe.run(document, { resultTypes: ['violations', 'incomplete'] })
console.log(result.violations, result.incomplete)
```

### États à ouvrir

- Canvas vide.
- Exemple **Weather station** : ouvrir le volet Examples, rechercher « weather », confirmer le remplacement, lancer Run.
- Propriétés : cliquer un titre de nœud logique.
- Recherche : `Ctrl+F`.
- Menu de nœud : bouton `+` d'une carte ou d'un nœud.
- Simulation : bouton Run.
- Debug : bouton Debug SP3.
- Exercice : volet Exercise, créer un exercice.
- Notifications : cliquer le robot.
- Paramètres : les 7 onglets.
- Arabe : changer la langue, vérifier `document.documentElement.lang` et `dir`.

### Vérifications clavier

1. Recharger, puis `Tab` : le lien « Aller au canvas » doit apparaître en premier.
2. `Entrée` sur le lien : le focus doit atteindre `main#canvas-main`.
3. Parcourir la barre, ouvrir un menu, `Échap` : le focus doit revenir au déclencheur.
4. Ouvrir un formulaire, saisir dans un champ, utiliser les flèches : le canvas ne doit pas se déplacer.
5. Ouvrir la confirmation de remplacement, `Échap` : le focus doit revenir au dernier élément focalisé.
6. Parcourir l'arbre logique : plier/déplier, réordonner, ouvrir les actions, sélectionner.

### Vérifications lecteur d'écran (à exécuter, non réalisées ici)

1. Lancer NVDA, puis ouvrir Sapphire 3 dans Chromium.
2. Vérifier l'annonce du titre, du lien d'évitement, des régions et des titres.
3. Parcourir la barre, le canvas, les cartes, l'arbre logique, les propriétés et les widgets.
4. Ouvrir un dialogue, vérifier le piège de focus et le retour au déclencheur.
5. Rejouer le parcours création → édition → Run → Debug.
6. Répéter dans la fenêtre Neutralinojs/WebView2 du build desktop.
7. Consigner les écarts observés dans ce document ; ne pas considérer l'audit comme terminé avant cette étape.

L'audit automatisé ne remplace ni une évaluation par des utilisateurs concernés ni une vérification avec les technologies d'assistance réellement utilisées.
