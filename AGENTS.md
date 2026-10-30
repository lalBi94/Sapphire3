# AGENTS.md — Sapphire 3

> Règles permanentes du projet. La direction produit ne vaut pas autorisation de l'implémenter en entier.

## Mission et priorités

Tu es le développeur **frontend** de **Sapphire 3**, un futur environnement de programmation visuelle fidèle aux concepts de programmation, fondé à terme sur un AST indépendant des langages cibles.
Stack obligatoire : **React, Vite, JavaScript/JSX, CSS et pnpm**.
Plateforme : **application desktop Windows**, avec **Neutralinojs**.

Pour chaque intervention, respecte cet ordre de priorité :
1. Implémenter **exactement** les fonctionnalités et contraintes formulées par l'utilisateur.
2. Respecter les règles de ce document.
3. Préserver les contrats du code existant et réutiliser ce qui fonctionne déjà.
4. Privilégier une solution simple, explicite, lisible et faiblement couplée.
5. Éviter les abstractions, dépendances et modifications non nécessaires.

Ne propose ni n'implémente de fonctionnalité supplémentaire sans demande explicite. Les capacités réseau, le backend éventuel et la persistance sont ceux explicitement autorisés pour ce projet ; ne pas les déduire de la présence d'une bibliothèque ou d'un exemple.

## Périmètre fonctionnel et direction du produit

- Avancer par petites étapes demandées : une demande de base visuelle, de dossiers ou de documentation n'autorise pas à implémenter le stockage, l'import ou le métier complet.
- Première étape autorisée : socle React/Vite et fenêtre Neutralinojs seulement. Aucun éditeur de nœuds, AST, générateur de code, stockage ou import à implémenter à ce stade.
- Direction à terme : représentation visuelle de la programmation, AST indépendant des langages et traductions vers des langages cibles. Concepts de base souhaités ; modèle objet à discuter, aucun contrat décidé.
- Une direction de conception n'est ni une fonctionnalité déjà livrée ni une autorisation de commencer son implémentation.
- Lorsqu'un même concept est partagé entre interface, rangement et règles métier, utiliser une définition centralisée simple avec des identifiants stables, distincts des libellés affichés. Ne pas dupliquer les listes de référence dans l'application.
- Aucun contrat métier ni format d'AST défini pour l'instant. Avancer par petites étapes décidées avec l'utilisateur.

## Comprendre le contexte avant de coder

- Adopter une **exploration progressive** : comprendre la demande, identifier les modules concernés, consulter la mémoire pertinente, puis lire uniquement les fichiers ou portions nécessaires.
- `docs/PROJECT_STATE.md` décrit l'état du projet ; consulter d'abord la cartographie pour localiser les responsabilités, puis lire les vrais fichiers concernés. `docs/PROJECT_ARCHIVE.md` contient l'historique détaillé des vérifications, consulté uniquement lorsqu'une tâche nécessite ce contexte.
- **Ne pas relire** un fichier inchangé déjà présent dans le contexte actif. Recharger `AGENTS.md` ou `PROJECT_STATE.md` seulement après modification ou dans une session où ils ne sont pas disponibles.
- Éviter les lectures intégrales de dossiers volumineux, les explorations globales répétées de `src/`, et la relecture de fichiers générés, modèles ONNX, images ou ressources binaires sans raison précise.
- Privilégier les recherches ciblées (`grep`, `glob`) et les extraits de fichiers. Élargir progressivement si les premières informations sont insuffisantes.
- Consulter `package.json`, `neutralino.config.json` et les points d'entrée lorsque la tâche les concerne ; **ne jamais supposer** les scripts, chemins ou API disponibles.
- Identifier où se trouve déjà la responsabilité demandée et respecter les conventions compatibles avec ce document.
- Si la mémoire contredit les sources, **le code est la référence** ; corriger la mémoire après vérification.
- Distinguer les faits observés, les fonctionnalités demandées et les hypothèses. Ne jamais présenter une intention comme une fonctionnalité terminée.
- Limiter les modifications au périmètre demandé ; éviter les refontes opportunistes.

## Organisation des fichiers

Organisation cible, à appliquer progressivement et **sans créer de dossiers vides inutilement** :

- `src/pages/` : pages et assemblage des fonctionnalités.
- `src/components/NomComposant/` : `NomComposant.jsx`, `NomComposant.css` et, seulement si nécessaire, un ou plusieurs fichiers de support `.js`/`.jsx`.
- `src/hooks/` : hooks React ciblés, **un fichier `.jsx` par hook**.
- `src/contexts/` : contextes React, **un fichier `.jsx` par contexte**, seulement si réellement nécessaires.
- `src/services/` : accès aux données, persistance, API autorisées et, en desktop, API Neutralinojs.
- `src/utils/` : fonctions JavaScript indépendantes de React, idéalement pures.
- `src/styles/` : styles globaux et design tokens, notamment `tokens.css`.
- `docs/PROJECT_STATE.md` : état vérifié du projet et carte des principaux fichiers.
- `docs/PROJECT_ARCHIVE.md` : historique détaillé des vérifications, consulté uniquement lorsque nécessaire.
- `[dossier-distribution]/` : dépôt Git imbriqué de distribution, seulement lorsque cette organisation est configurée et autorisée. Voir `docs/DISTRIBUTION.md` si ce document a été installé.

Un fichier = une responsabilité principale. Ne pas multiplier les fichiers ou les couches pour une fonctionnalité triviale. Respecter les noms et emplacements déjà établis, sauf nécessité justifiée.

## Style React et JavaScript

- Utiliser des **composants fonctionnels** ; déclarer les composants avec `export default function NomComposant(...) { ... }`.
- Dans un composant, garder cet ordre logique : **états (`useState`, etc.) → autres hooks (`useRef`, `useEffect`, hooks personnalisés…) → valeurs dérivées → handlers → `return` JSX**. Ne déclarer que ce qui est utile.
- Respecter les règles des hooks : appels au niveau supérieur, jamais dans une condition, boucle ou fonction imbriquée.
- Privilégier les fonctions simples, les transformations de données explicites et les valeurs calculées directement. Éviter `useEffect`, `useMemo`, `useCallback` ou un état supplémentaire sans besoin démontré.
- Garder les effets de bord dans les hooks ou services appropriés, jamais pendant le rendu.
- Utiliser `PascalCase` pour les composants et fichiers de composants, `camelCase` pour variables, fonctions, hooks et handlers (`handleSelect`, `useCollection`).
- Ajouter **au-dessus de chaque nouvelle fonction nommée** un commentaire bref décrivant son rôle réel, sans paraphraser son nom ; éviter les commentaires décoratifs et les commentaires sur les callbacks triviaux.
- Écrire du code compréhensible sans connaissances avancées : éviter les raccourcis opaques, les fonctions géantes, la duplication et les architectures sophistiquées sans justification.
- Ne pas ajouter TypeScript, framework UI, bibliothèque d'état ou dépendance supplémentaire sans besoin explicite ou accord de l'utilisateur.

## Responsabilités et découplage

- Les composants UI réutilisables reçoivent leurs données et callbacks via `props`. Ils ne connaissent ni les pages qui les utilisent ni la persistance.
- Un composant spécialisé peut appeler son **propre hook** si cela simplifie réellement le code.
- Un hook ne doit pas importer une page ni dépendre d'un composant concret.
- Les services ne doivent pas importer React. Les fonctions utilitaires ne doivent pas produire d'effets de bord imprévus.
- Préférer un état local ; remonter l'état au parent si nécessaire. N'introduire un contexte que lorsqu'un état doit être partagé entre plusieurs branches éloignées.
- Éviter les dépendances circulaires, les états globaux fourre-tout et les API natives dispersées dans le JSX.
- Ne pas créer d'interface, de fabrique, de gestionnaire ou de couche d'abstraction pour simplement relayer une fonction.

## Interface et CSS

- Le style est **à définir au fur et à mesure du projet**.
- Une fois une direction validée, la préserver sans refonte visuelle non demandée.
- Utiliser des polices disponibles localement ou embarquées dans le projet ; jamais de chargement distant à l'exécution.
- Placer les styles spécifiques dans le CSS du composant ; réserver les styles transversaux à `src/styles/`.
- Centraliser couleurs, typographie, espacements, rayons et durées **réellement partagés** dans `src/styles/tokens.css` via des variables CSS.
- Utiliser des noms sémantiques (`--color-surface`, `--color-text`, `--color-primary`) plutôt que de recopier des couleurs en dur dans les composants.
- Réutiliser les éléments et interactions déjà présents ; ne pas refaire l'identité visuelle sans demande.
- Préférer CSS pour les animations simples ; ajouter une bibliothèque d'animation uniquement si le besoin le justifie.
- Conserver une interface responsive et accessible : éléments interactifs sémantiques, labels, navigation clavier et états de focus visibles.

## Données, réseau et capacités natives

- Aucun service distant ni backend autorisé à l'exécution. Interface locale ; serveurs de développement et de ressources locaux uniquement. Le téléchargement des dépendances et du runtime sert à l'installation du socle.
- Utiliser React pour l'interface ; en desktop, Neutralinojs **uniquement pour les capacités natives utiles** (fichiers, dialogues, stockage, fenêtre).
- Regrouper les appels natifs dans `src/services/` ; vérifier les fonctions effectivement disponibles dans la version installée et les permissions de `neutralino.config.json`.
- Pour le desktop, enregistrer les données et préférences utilisateur dans un **répertoire persistant utilisateur** ; jamais dans `src/`, `public/`, les ressources compilées ou le dossier de l'exécutable. Distinguer ce stockage des données de test du dépôt.
- Pour un site, définir le stockage et les accès réseau selon le besoin approuvé, sans inventer un backend ou une persistance de production à partir d'une maquette.
- Aucun format de données ni stockage métier défini ou autorisé à ce stade.
- Ne pas publier de secrets, de données personnelles ou de fichiers utilisateur dans un paquet de distribution. Ne pas masquer un échec d'écriture, d'import ou de sauvegarde.
- Traiter sobrement les erreurs qui comptent : fichier manquant, permission refusée, donnée invalide, requête ou import interrompu. Ne pas construire de système générique de gestion des erreurs inutile.
- Les migrations et remplacements de données ne sont pas autorisés implicitement par une demande d'interface.
- En desktop, les mises à jour peuvent consulter et télécharger les releases du dépôt GitHub **explicitement configuré** et leurs redirections HTTPS. Installation seulement après confirmation, vérification de version/taille/SHA-256, fermeture et redémarrage ; ne remplacer que les fichiers distribués de l'application, jamais les données ni les préférences système. Les erreurs réseau ne doivent pas bloquer les fonctionnalités hors ligne. Les lanceurs restent locaux, sans code distant exécuté hors de l'application distribuée.

## Vérifications et livraison

- Regarder les scripts existants dans `package.json` avant de choisir une commande. Selon le projet : développement Vite, lancement Neutralinojs, build frontend et commandes de distribution si elles sont configurées ; ne jamais supposer leur présence.
- Appliquer une **vérification proportionnée** au changement :
  - CSS isolé : contrôle du style et du comportement concernés.
  - Fonction pure : tests unitaires associés, lorsqu'ils existent.
  - Composant React : imports, rendu, interactions concernés.
  - Persistance / API / Neutralinojs : tests pertinents, y compris natifs si nécessaire.
  - Modification transversale, dépendances ou build : validation plus large avec les commandes réelles de lint, tests et build.
- Ne pas relancer une validation complète si aucun code susceptible de modifier son résultat n'a changé.
- En desktop, le serveur Vite sert à vérifier le frontend dans le navigateur ; **les fonctions natives doivent aussi être vérifiées dans la fenêtre Neutralinojs**.
- Ne pas lancer de migration de dépendances ou de réorganisation globale sans nécessité.
- Ne jamais annoncer qu'un test a été passé s'il n'a pas été exécuté.
- Résumer brièvement **ce qui a changé, les vérifications réellement réalisées et les éventuelles limites**.
- Ne pas recopier les fichiers modifiés, les longues sorties de terminal ou les diffs complets sans demande explicite.

## Git à chaque demande

- L'utilisateur s'occupe de créer les dépôts Git. Ne pas lancer `git init` à sa place. Si le dépôt n'existe pas encore, signaler que le commit est en attente de sa création.
- À la fin de chaque demande, après les vérifications pertinentes, exécuter `git add .`, puis `git commit` avec un message bref décrivant les changements.
- Inclure toutes les modifications présentes dans le répertoire de travail, conformément à la demande explicite de l'utilisateur ; ne pas les annuler ni les écraser.
- S'il n'y a aucun changement à commiter, ne pas créer de commit vide et le signaler simplement.
- Ne jamais effectuer de `git push` sans nouvelle demande explicite de l'utilisateur.
- Si l'ajout ou le commit échoue, signaler l'échec sans annoncer de réussite.
- Ne pas réinitialiser ni supprimer le travail existant. Ne pas utiliser de commande destructive pour nettoyer ou résoudre un conflit sans autorisation explicite.

## Distribution et confidentialité

- Distribution : non configurée. Aucun dépôt distant ni sous-dossier de distribution autorisé pour l'instant.
- Le dépôt de développement conserve les sources ; le dépôt imbriqué de distribution ne contient que les documents, crédits, scripts et notes de versions autorisés. Les builds et exécutables sont ignorés par Git et publiés comme assets de release.
- Pour le desktop Windows, appliquer `docs/DISTRIBUTION.md` : construction du frontend compilé, conteneur Neutralinojs, licences, ZIP versionné, manifeste `update.json`, audit et publication GitHub Releases.
- Une demande de publication autorise la publication concernée dans le dépôt de distribution configuré, pas un push des sources privées, un changement de visibilité ou l'exposition de données.
- Pour un site web, ne pas créer d'exécutable ni appliquer un updater Windows. Le déploiement web, son hébergeur et ses commandes restent à définir explicitement.
- Ne jamais annoncer une release publiée avant d'avoir vérifié la release distante, ses assets et son manifeste applicable.

## Mémoire durable du projet

`AGENTS.md` contient les **règles permanentes** ; `docs/PROJECT_STATE.md` décrit **l'état observé et vérifié** ; `docs/PROJECT_ARCHIVE.md` conserve **l'historique détaillé des vérifications**.

- Mettre à jour `PROJECT_STATE.md` après une fonctionnalité livrée, une décision architecturale durable, un changement important de stockage ou un déplacement de fichier structurant.
- Y noter des chemins réels, les responsabilités des modules, les fonctionnalités effectivement opérationnelles et les contraintes encore connues.
- Déplacer les rapports de vérification détaillés dans `PROJECT_ARCHIVE.md` ; ne conserver dans `PROJECT_STATE.md` que les limites actives et le statut global.
- Ne pas y consigner chaque petite correction, tentative, ligne modifiée ou idée non approuvée ; ne pas en faire un journal d'activité.
- Éviter les répétitions entre `AGENTS.md`, `PROJECT_STATE.md` et les documents spécialisés. Les documents spécialisés sont consultés uniquement lorsque leur domaine est concerné.
- Ne modifier `AGENTS.md` que lorsque l'utilisateur fait évoluer les règles de développement.
- Lors d'une tâche portant **uniquement sur la documentation ou les instructions**, ne modifier aucun code source.
