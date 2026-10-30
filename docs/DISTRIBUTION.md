# Distribution séparée — modèle DR3 généralisé

> Contrat à adapter au futur projet. Les chemins, noms et URL ci-dessous sont des paramètres à définir ; aucune publication ni mise à jour n'est déjà opérationnelle du fait de ce document.

## 1. Périmètre

Le circuit Windows décrit ici reprend celui de DR3 : React/Vite compilé, Neutralinojs, dépôt public de distribution séparé, GitHub Releases, ZIP complet et manifeste de mise à jour.

Il s'applique **aux projets desktop Windows**. Pour un site web, garder les sources séparées des artefacts si cette organisation est demandée, mais définir explicitement l'hébergement et les commandes de déploiement. Ne pas produire de `.exe`, de conteneur Neutralinojs ou d'updater Windows pour un site.

## 2. Paramètres à faire définir

| Paramètre | Valeur à renseigner |
| --- | --- |
| Nom du produit | [Nom] |
| Nom sans espaces pour les fichiers distribués | [NomPaquet] |
| Sous-dossier du dépôt de distribution | [distribution] |
| Dépôt GitHub autorisé | [propriétaire/dépôt] |
| Branche de publication | [branche réelle] |
| Racine persistante des données | [chemin et nom approuvés] |
| Version stable | [X.Y.Z] |

Ne pas réutiliser l'URL du dépôt DR3. L'utilisateur crée les dépôts Git ; ne pas lancer `git init` automatiquement. Ne pas changer un remote, une branche ou la visibilité d'un dépôt sans autorisation.

## 3. Deux dépôts, deux responsabilités

```text
projet/                           dépôt de développement, sources privées
  AGENTS.md
  package.json
  src/
  docs/
  [distribution]/                 dépôt Git imbriqué, distribution seulement
    .git/                        créé/configuré par l'utilisateur
    .gitignore
    README.md
    CREDITS.md
    scripts/
      Build-Windows.mjs
      Publish-Release.ps1
    releases/
      vX.Y.Z.md
    build/                       ignoré par le Git de distribution
      runtime/
      [NomPaquet]-X.Y.Z-windows/
      [NomPaquet]-X.Y.Z-windows.zip
```

- Le dépôt public n'accepte que README, crédits, `.gitignore`, scripts de construction/publication et notes de versions autorisées. Utiliser une liste d'autorisation dans son `.gitignore`, comme DR3.
- Ne jamais y pousser `src/`, tests, `.env`, secrets, photos, données utilisateur, dépendances, préférences, sources maps ou historique privé.
- Les exécutables, modèles et ZIP vont dans les **assets des releases**, jamais dans l'historique Git.
- Le dépôt principal enregistre la référence Git du dépôt imbriqué ; les commits sont distincts. Ne pas transformer cette organisation en un simple dossier contenant les sources publiques.
- Le JavaScript compilé reste inspectable : distribuer une application ne rend pas son code exécuté secret. Cela n'autorise pas à publier le dépôt de développement.

## 4. Construire le paquet Windows

Créer ou adapter les scripts seulement lorsque la distribution est demandée. Vérifier les versions et API réellement installées ; ne pas supposer les chemins de binaires.

1. Aligner la version applicative, la configuration Neutralinojs et la version du paquet.
2. Vérifier le frontend avec les scripts réels de lint, tests et build.
3. Construire le frontend de production dans `[distribution]/build/runtime/web-dist/`, sans source maps ni données de développement.
4. Préparer dans `runtime/` seulement le frontend compilé, l'icône du produit et `neutralino.config.json` de production : inspecteur désactivé, configuration CLI de développement absente, données et préférences dans le stockage utilisateur système.
5. Créer `resources.neu` avec l'outil de conteneur utilisé par Neutralinojs, à l'image du script DR3 (`@electron/asar` fourni par le CLI installé).
6. Copier le binaire Windows Neutralinojs et renseigner ses métadonnées pour produire `[NomPaquet].exe`.
7. Ajouter `VERSION.txt`, `CREDITS.md`, `LIRE-MOI.txt` et `licenses/`. Inclure les notices de **toutes les dépendances effectivement distribuées**, ressources et modèles compris. Ne pas recopier la liste de dépendances métier de DR3.
8. Ouvrir et vérifier le paquet dans la fenêtre native sur des données de test isolées.
9. Auditer les fichiers du paquet et l'intérieur de `resources.neu`, pas seulement le nom du ZIP.
10. Compresser **le contenu du paquet**, sans dossier parent supplémentaire, dans `[NomPaquet]-X.Y.Z-windows.zip`.

Contenu distribué de référence :

```text
[NomPaquet].exe
resources.neu
VERSION.txt
CREDITS.md
LIRE-MOI.txt
licenses/
```

Adapter le nom du produit partout de manière cohérente : builder, manifeste, validateur de téléchargement et helper de remplacement. Aucune donnée utilisateur n'est ajoutée au paquet.

## 5. Versions, release et manifeste

- Versionnement sémantique : correctif `X.Y.Z+1` pour les corrections ; nouvelle version mineure pour des fonctionnalités compatibles ; version majeure pour une rupture. Choisir le tag selon les changements réellement livrés.
- Tag stable `vX.Y.Z`, notes dans `releases/vX.Y.Z.md`.
- Les préversions sont explicitement marquées et ne remplacent pas la dernière stable.
- Une release contient `[NomPaquet]-X.Y.Z-windows.zip` et `update.json`.

Contrat du manifeste, identique à DR3 :

```json
{
  "schemaVersion": 1,
  "version": "X.Y.Z",
  "platform": "windows",
  "prerelease": false,
  "url": "https://github.com/PROPRIETAIRE/DEPOT/releases/download/vX.Y.Z/NOMPAQUET-X.Y.Z-windows.zip",
  "sha256": "EMPREINTE_SHA256_HEXADECIMALE_REELLE_DE_64_CARACTERES",
  "size": 0,
  "releaseNotesUrl": "https://github.com/PROPRIETAIRE/DEPOT/releases/tag/vX.Y.Z"
}
```

Ce JSON illustre les champs, **ce n'est pas un manifeste publiable** : remplacer chaque paramètre, calculer l'empreinte réelle et la taille positive exacte en octets. L'URL stable de consultation est :

```text
https://github.com/PROPRIETAIRE/DEPOT/releases/latest/download/update.json
```

Le script de publication :

1. Refuse les chemins de développement ou données privées dans le ZIP et exige des notes de version.
2. Utilise `GITHUB_TOKEN` ou les identifiants du gestionnaire Git, sans les écrire ni les afficher.
3. Calcule taille et SHA-256 du ZIP local et produit le manifeste.
4. Crée une release en **brouillon** ; ne remplace pas une release existante.
5. Charge le ZIP puis `update.json` ; ne publie qu'après réussite des deux transferts.
6. Laisse le brouillon en place si le transfert échoue, pour diagnostic ; ne prétend pas à une publication réussie.

Sur demande explicite de publication : commiter les documents/scripts/notes du dépôt de distribution, pousser **ce seul dépôt** vers la branche configurée, publier les assets, puis vérifier la release et l'URL `latest`. Vérifier version, taille, SHA-256 et digest distant lorsqu'il est disponible. Enregistrer ensuite localement la version et la référence du dépôt imbriqué dans le dépôt de développement, sans pousser ses sources privées.

## 6. Mise à jour intégrée desktop, si demandée

L'initialisation des instructions ne constitue pas une demande d'implémenter cet updater. Lorsqu'il est explicitement demandé, reprendre le fonctionnement DR3 :

- Section **Mises à jour** dans Paramètres : recherche à l'ouverture avec cache de session de 10 minutes et bouton de vérification manuelle.
- Consultation de la dernière stable du seul dépôt officiel configuré ; comparaison numérique des versions stables, pas lexicographique.
- Affichage de la version disponible, de la taille et du lien vers les notes.
- Téléchargement et redémarrage **après confirmation explicite**, jamais installation silencieuse au démarrage.
- Service sans React pour les opérations natives ; lanceurs PowerShell locaux embarqués dans l'application. Aucun script distant téléchargé et exécuté.
- Paramètres transmis comme données encodées, chemins protégés, archive téléchargée dans un temporaire unique.
- Validation du manifeste, du nom/URL attendus, de la version plus récente, de la taille et du SHA-256 ; refus des archives inattendues, chemins sortants, liens et expansions excessives. Dans le modèle DR3 : ZIP au plus 1 Gio et contenu décompressé au plus 2 Gio ; ne pas contourner silencieusement ces limites.
- Extraction limitée aux six éléments distribués ci-dessus, avec vérification de `VERSION.txt`. Adapter explicitement les validateurs si le contrat du paquet change.
- Helper indépendant : vérifier le dossier d'installation et son accès en écriture, signaler qu'il est prêt, attendre la fermeture du bon processus, sauvegarder les fichiers distribués, les remplacer puis relancer l'application.
- En cas d'échec détecté pendant le remplacement : restaurer les fichiers sauvegardés et relancer l'ancienne version si la restauration a réussi. Garder un diagnostic et indiquer quand une restauration manuelle est nécessaire.
- Ne jamais supprimer/remplacer les données utilisateur ou préférences système, ni tuer d'autres instances/processus pour forcer l'installation. Pas d'élévation administrateur implicite.
- Bloquer les opérations incompatibles pendant l'installation ; une erreur réseau ne bloque pas les fonctionnalités hors ligne.
- Une version sans updater doit être remplacée manuellement une première fois. Le téléchargement reste celui du **paquet complet**, pas un patch différentiel.
- Un arrêt brutal de Windows peut nécessiter une restauration manuelle. Un SHA-256 assure l'intégrité, pas une signature indépendante de l'éditeur ; ne pas annoncer un exécutable signé s'il ne l'est pas.

## 7. Vérifications avant d'annoncer une publication

- Paquet compilé réellement testé, versions cohérentes, notices incluses, audit du ZIP et du conteneur effectué.
- Release accessible, tag correct, statut stable/préversion correct, assets présents, manifeste et empreinte conformes.
- Lorsque l'ancienne version possède l'updater : contrôler sa détection de la nouvelle release sur une installation isolée et la préparation de l'archive officielle, sans remplacer l'installation de l'utilisateur.
- Tester les fonctions natives concernées dans la fenêtre Neutralinojs, pas seulement dans le navigateur.
- Distinguer « paquet construit », « publication réussie », « préparation vérifiée » et « installation/redémarrage vérifiés ». Ne pas confondre ces résultats.
- Reporter le statut global dans `PROJECT_STATE.md`, les preuves détaillées et limites dans `PROJECT_ARCHIVE.md`. Ne pas écrire que la release est publiée avant la vérification distante.
