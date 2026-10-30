# Prompt agentique — initialiser le projet et sa mémoire

Tu dois initialiser ce projet avec la méthode fournie dans `reproduction-general/`.
Ce dossier est un kit réutilisable : ce n'est ni une description du produit à construire, ni la preuve d'un état déjà livré.

## Objectif

Installer un cadre de travail opérationnel : un `AGENTS.md` adapté au projet, une mémoire durable courte, une archive de vérifications et un socle technique limité au besoin demandé.

La stack frontend est **obligatoirement React, JavaScript/JSX, Vite, CSS et pnpm**. Ne pas proposer TypeScript ni un autre framework frontend. Le projet peut être un **site web** ou une **application desktop**. Pour le desktop, utiliser **Neutralinojs** comme dans le modèle ; pour un site web, ne pas ajouter Neutralinojs ni un packaging d'exécutable.

Le style est **à définir au fur et à mesure du projet**. Ne pas importer l'identité visuelle ou les fonctionnalités d'un autre produit.

## 1. Comprendre le besoin et le dépôt

- Lire les instructions déjà applicables et les modèles de ce dossier.
- Examiner progressivement les fichiers de premier niveau utiles : manifeste, scripts, configuration, documentation et éventuelles sources existantes. Réutiliser ce qui fonctionne ; ne pas écraser le travail présent.
- Relever ce que l'utilisateur a déjà décidé. Ne poser que les questions utiles dont la réponse manque pour avancer : nom et objectif, site ou desktop, périmètre de départ, besoin réseau/backend et cible de livraison.
- Si la plateforme ou une décision engageante manque, la demander avant de créer un socle incompatible. Une destination de publication peut rester « non définie » : ce n'est pas une autorisation de créer un compte, un dépôt distant ou un service.
- L'utilisateur crée lui-même le dépôt Git. Ne pas lancer `git init`, ni créer automatiquement un dépôt Git imbriqué. Si Git manque, poursuivre seulement les travaux autorisés et signaler que le commit devra attendre sa création.

## 2. Installer les règles adaptées

Utiliser `reproduction-general/AGENTS.md` comme base pour le vrai `AGENTS.md` à la racine.

- Remplacer les éléments à renseigner avec les décisions explicites de l'utilisateur et les faits observés.
- Adapter le rôle, le métier, les contrats de données et les règles réseau au projet réel. Ne pas reprendre de catégories, noms de données, communes, URL ou fonctionnalités d'un autre produit.
- Garder la stack obligatoire, le découpage React et toutes les restrictions de travail du modèle.
- **Recopier sans modification la section « Comprendre le contexte avant de coder ».** C'est la politique d'exploration et d'économie de tokens demandée. Ne pas lui ajouter de quota, de budget, d'outil obligatoire, de routine de résumé ou de délégation.
- Garder le même fonctionnement de la mémoire : règles permanentes, état vérifié et archive détaillée séparés.
- Garder `git add .` puis `git commit` à la fin de chaque demande après les vérifications pertinentes. Aucun commit vide ; aucun push sans nouvelle demande explicite. Ne pas annuler les modifications déjà présentes.
- Si des instructions existent déjà, les examiner et les fusionner sans retirer silencieusement une règle du projet. Signaler toute contradiction nécessitant une décision de l'utilisateur.
- Ne pas recopier les instructions privées d'un outil, d'un fournisseur ou d'un agent : utiliser seulement les consignes de projet fournies dans ce kit.

## 3. Créer la mémoire réelle

Adapter les modèles dans le vrai répertoire `docs/` :

- `PROJECT_STATE.md` : présentation, périmètre réellement livré, cartographie des fichiers présents, commandes vérifiées, contrats utiles, décisions durables, limites actives et statut des vérifications.
- `PROJECT_ARCHIVE.md` : détails des vérifications effectivement réalisées. Pas de test ou de fonctionnalité inventé.
- `DISTRIBUTION.md` : uniquement si la distribution fait partie du contexte du projet. Adapter le nom du dossier, le dépôt distant et les fichiers réellement utilisés. Laisser explicitement non configuré ce qui ne l'est pas.

Une intention va dans « demandé/non implémenté », jamais dans « opérationnel ». Ne pas créer de documentation spécialisée sans domaine effectivement concerné. Ne pas transformer la mémoire en journal de chaque action.

## 4. Initialiser seulement le socle autorisé

- Si le projet est neuf et que l'utilisateur demande son initialisation technique, préparer un socle minimal React/Vite/JavaScript/JSX/CSS/pnpm. Utiliser l'organisation du modèle sans créer inutilement tous les dossiers vides.
- Si l'utilisateur demande seulement les instructions ou la documentation, **ne modifier aucun code source**.
- Si du code existe, ne pas remplacer le projet par un nouveau scaffold ; conserver les conventions compatibles et demander un accord avant une migration nécessaire.
- Ne pas ajouter de fonctionnalité métier, backend, authentification, base de données, bibliothèque d'état, framework UI ou autre dépendance sans besoin explicite ou accord.
- Pour le desktop, configurer seulement les capacités Neutralinojs nécessaires et les permissions correspondantes ; conserver les appels natifs dans les services.
- Pour un site, ne pas inventer de backend, d'hébergement, d'API distante ou d'authentification. Les choix réseau et de données doivent correspondre au besoin approuvé.
- Ne pas implémenter automatiquement un updater ou lancer un déploiement sous prétexte d'initialiser les règles. Respecter le contrat de distribution ci-dessous quand cette fonctionnalité est explicitement demandée.

## 5. Conserver le même circuit de distribution que DR3

Pour une application desktop Windows, reprendre **exactement le circuit décrit dans `reproduction-general/docs/DISTRIBUTION.md`** :

- Dépôt de développement privé et **dépôt Git de distribution séparé, imbriqué dans un sous-dossier**.
- Dans le dépôt public : seulement documentation, crédits, scripts de construction/publication et notes de versions. Aucune source métier, photo, donnée utilisateur ou secret.
- Builds et ZIP ignorés par Git et joints aux **GitHub Releases**, pas ajoutés à l'historique.
- Paquet Windows compilé avec exécutable, `resources.neu`, version, crédits, fichier d'installation et licences.
- Tags sémantiques `vX.Y.Z` et `update.json` compatible avec le contrat du modèle : taille et SHA-256 inclus.
- Si demandé, mise à jour depuis Paramètres, après confirmation, contrôle de l'archive, fermeture, remplacement borné des fichiers distribués et redémarrage, sans toucher aux données ni aux préférences. Première installation manuelle si l'ancienne version ne dispose pas du mécanisme.
- Publication uniquement sur demande explicite ; push du seul dépôt de distribution autorisé pour cette publication, **jamais des sources privées**.

Pour un site web, ne pas simuler un exécutable ou un updater Windows. Conserver la séparation sources/artefacts si elle est demandée ; faire définir le mode de publication web et ne pas inventer ses commandes. Le modèle Windows reste disponible pour un futur projet desktop.

## 6. Vérifier et terminer

- Consulter les scripts avant de choisir les commandes. Effectuer des vérifications proportionnées aux fichiers réellement modifiés.
- Mettre à jour la mémoire avec les chemins, commandes et résultats réels ; conserver les limites non vérifiées.
- Si un dépôt Git est présent, exécuter `git add .`, puis `git commit` avec un message bref, en incluant les modifications présentes conformément au modèle. S'il n'y a rien à commiter, ne pas créer de commit vide.
- Si Git manque ou si une commande échoue, le dire sans annoncer une réussite. Ne pas créer le dépôt à la place de l'utilisateur.
- Ne pas pousser, publier, déployer ou initialiser un dépôt distant sans demande explicite.
- Terminer par un bilan court : cadre installé, socle effectivement créé, vérifications réalisées et décisions encore nécessaires.

## Besoin de l'utilisateur

Utiliser la description donnée dans le message qui accompagne ce prompt. Si aucune description n'a été fournie, la demander au lieu d'inventer un produit.
