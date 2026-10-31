# Distribution Windows — dépôt unique

> Organisation retenue pour Sapphire 3 : un seul dépôt public, les sources sur `master`, les paquets portables en assets de GitHub Releases. Aucun second dépôt, sous-module, remote supplémentaire ni système de mise à jour.

## 1. Périmètre

Le circuit décrit ici s'applique à l'application desktop Windows : frontend React/Vite compilé, conteneur Neutralinojs, ZIP portable et release GitHub. Il ne concerne pas un futur site web, qui demanderait un hébergement et des commandes de déploiement définis séparément.

Le dépôt de développement et de distribution est **`lalBi94/Sapphire3`** (public). Les sources restent sur la branche `master` ; aucune source n'est dupliquée dans un autre dépôt.

## 2. Principes

- Le dépôt Git ne contient que les sources, la documentation et les scripts. Les exécutables, `resources.neu`, ZIP et dossiers compilés restent ignorés par Git.
- Les paquets complets sont publiés comme **assets de GitHub Releases**, jamais dans l'historique Git.
- La configuration de développement (`neutralino.config.json`) n'est pas modifiée par la construction. Une configuration de production distincte est générée dans `build/production/`.
- Aucun autosave, aucune vérification de version distante, aucun manifeste `update.json`, aucun updater intégré. Une nouvelle version se télécharge et se remplace manuellement.
- Aucune donnée utilisateur, préférence ou fichier local n'est ajouté au paquet.

## 3. Versions et nommage

| Élément | Convention |
| --- | --- |
| Version applicative | `package.json` → `version`, par exemple `0.1.0-alpha.1` |
| Version Neutralinojs | partie stable avant le tiret, par exemple `0.1.0` |
| Tag de release | `v` + version complète, par exemple `v0.1.0-alpha.1` |
| Dossier préparé | `Sapphire3-<version>-windows/` |
| Archive | `Sapphire3-<version>-windows.zip` |
| Exécutable | `Sapphire3.exe` |

Le versionnement suit le schéma sémantique. Une préversion est marquée `--prerelease` dans GitHub et ne remplace pas une éventuelle version stable. Le script lit la version depuis `package.json` : ne pas la dupliquer dans le script.

## 4. Construction reproductible

Commande unique :

```sh
pnpm dist:win
```

Le script `scripts/build-windows.mjs` enchaîne :

1. Génération de `build/production/neutralino.config.json` à partir de la configuration de développement, avec :
   - `version` stable issue de `package.json` ;
   - `logging.enabled: false` ;
   - `modes.window.enableInspector: false` ;
   - suppression de `cli.frontendLibrary` (aucun serveur Vite) ;
   - `cli.distributionPath: "/build/neutralino/"` ;
   - `cli.resourcesExclude: "\\.map$"`.
2. Suppression de `dist/`, puis compilation Vite de production.
3. Suppression des fixtures de développement `dist/verify/` et refus explicite de toute source map, fixture `.sp3` ou dossier de développement dans `dist/`.
4. Construction Neutralinojs avec la configuration de production : `resources.neu` et binaires.
5. Préparation du dossier `build/release/Sapphire3-<version>-windows/` avec l'exécutable Windows renommé, `resources.neu`, `VERSION.txt`, `CREDITS.md`, `LIRE-MOI.txt`, `README.txt` et `licenses/`.
6. Compression du **contenu** du dossier, sans dossier parent, vers `build/release/Sapphire3-<version>-windows.zip`.
7. Calcul et affichage de la taille et du SHA-256 de l'archive.

Contenu distribué de référence :

```text
Sapphire3.exe
resources.neu
VERSION.txt
CREDITS.md
LIRE-MOI.txt
README.txt
licenses/
```

`resources.neu` contient uniquement le frontend compilé et la configuration de production. `pnpm dist:win` ne nécessite aucune dépendance globale : Vite et la CLI Neutralinojs sont appelés depuis `node_modules`. Node.js n'est pas requis pour exécuter le paquet distribué.

## 5. Vérifications avant publication

Appliquer une vérification proportionnée et réelle :

1. `pnpm test` : suite Node du moteur, du workspace et de la transpilation.
2. `pnpm build` : compilation Vite de production.
3. `pnpm dist:win` : construction complète et archive.
4. Audit de l'archive : liste des entrées, absence de dossier parent, présence des licences et notices.
5. Audit de `resources.neu` : uniquement `dist/index.html`, `dist/assets/*` et `neutralino.config.json` ; ni sources, ni source maps, ni fixtures `.sp3`, ni dossier `verify`.
6. Lancement de `Sapphire3.exe` extrait du paquet, dans la fenêtre Neutralinojs.
7. Vérification native des fichiers `.sp3` : première sauvegarde vers un chemin choisi, puis `Ctrl+S` sur le fichier existant avec modification de l'horodatage et absence de fichier temporaire résiduel.
8. Contrôle de la version affichée par `VERSION.txt` et des métadonnées de l'exécutable.

Ne pas annoncer un test qui n'a pas été exécuté. Distinguer « paquet construit », « paquet vérifié localement », « brouillon créé » et « release publiée ».

## 6. Release GitHub

Le dépôt autorisé est `lalBi94/Sapphire3`. Les notes de version sont conservées dans `docs/releases/v<version>.md` et versionnées avec les sources.

Procédure :

1. Commiter et pousser les sources, scripts et notes sur `master`.
2. Créer une release en **brouillon** avec le tag `v<version>` ciblant `master` :
   - titre lisible, par exemple « Sapphire 3 Alpha 0.1.0 » ;
   - `--prerelease` pour une alpha ;
   - asset unique `Sapphire3-<version>-windows.zip` ;
   - notes issues de `docs/releases/v<version>.md`.
3. Vérifier la release distante : tag, statut brouillon, asset présent, taille et SHA-256.
4. Ne publier qu'après validation explicite de l'utilisateur.

Le brouillon n'est pas une publication. Ne jamais présenter une release comme publiée avant vérification de son statut et de ses assets sur GitHub.

## 7. Mise à jour

Aucun updater n'est inclus et aucune version distante n'est consultée à l'exécution. L'utilisateur remplace manuellement l'ancien dossier par le contenu du nouveau ZIP. Cette absence est volontaire pour cette alpha ; l'ajouter exigerait une demande explicite et un contrat dédié.
