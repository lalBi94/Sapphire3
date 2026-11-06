# Distribution Windows — dépôt unique

> Organisation retenue pour Sapphire 3 : un seul dépôt public, les sources sur `master`, les paquets portables en assets de GitHub Releases. Aucun second dépôt, sous-module, remote supplémentaire ni système de mise à jour.

## 1. Périmètre

Le circuit décrit ici s'applique à l'application desktop Windows : frontend React/Vite compilé, conteneur Neutralinojs, ZIP portable et release GitHub. Il ne concerne pas le site statique de présentation : GitHub Pages sert séparément la branche `gh-pages` du même dépôt, qui contient uniquement un instantané de `abstract/` placé à sa racine, sans historique des sources applicatives. L'entrée `https://lalbi94.github.io/Sapphire3/` redirige vers `visual/` ; le PDF et la source LaTeX restent à côté pour préserver les liens relatifs. Le fichier `.nojekyll` désactive la transformation Jekyll. Une publication du site ne pousse pas `master` et ne déclenche pas de release Windows ; elle demande une autorisation explicite de publication.

Le dépôt de développement et de distribution est **`lalBi94/Sapphire3`** (public). Les sources restent sur la branche `master` ; aucune source n'est dupliquée dans un autre dépôt.

## 2. Principes

- Le dépôt Git ne contient que les sources, la documentation et les scripts. Les exécutables, `resources.neu`, ZIP et dossiers compilés restent ignorés par Git.
- Les paquets complets sont publiés comme **assets de GitHub Releases**, jamais dans l'historique Git.
- La configuration de développement (`neutralino.config.json`) n'est pas modifiée par la construction. Une configuration de production distincte est générée dans `build/production/`.
- L'application vérifie les releases **publiées** du dépôt configuré et propose l'installation d'une version plus récente. L'installation est confirmée par l'utilisateur, l'archive est vérifiée (taille et SHA‑256 de l'asset GitHub) puis remplacée par un **helper `updater.ps1` embarqué dans le ZIP**, après fermeture, sans toucher aux données ni aux préférences. Aucun manifeste `update.json`, aucun service tiers.
- Aucune donnée utilisateur, préférence ou fichier local n'est ajouté au paquet.

## 3. Versions et nommage

| Élément | Convention |
| --- | --- |
| Version applicative | `package.json` → `version`, par exemple `0.1.0-beta.1` |
| Version Neutralinojs | partie stable avant le tiret, par exemple `0.1.0` |
| Tag de release | `v` + version complète, par exemple `v0.1.0-alpha.1` |
| Dossier préparé | `Sapphire3-<version>-windows/` |
| Archive | `Sapphire3-<version>-windows.zip` |
| Installateur | `Sapphire3-<version>-windows-setup.exe` |
| Exécutable | `Sapphire3.exe` |

Le versionnement suit le schéma sémantique. Une préversion est marquée `--prerelease` dans GitHub et ne remplace pas une éventuelle version stable. Le script lit la version depuis `package.json` : ne pas la dupliquer dans le script.

## 4. Construction reproductible

Commande unique :

```sh
pnpm dist:installer
```

`pnpm dist:win` construit uniquement le ZIP portable ; `pnpm dist:installer` enchaîne le ZIP puis l'installateur Inno Setup.

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
5. Préparation du dossier `build/release/Sapphire3-<version>-windows/` avec l'exécutable Windows renommé, `resources.neu`, `VERSION.txt`, `CREDITS.md`, `LICENSE.txt`, `LIRE-MOI.txt`, `README.txt` et `licenses/`.
6. Signature de `Sapphire3.exe` **avant** compression, si un certificat est configuré (voir 4.1).
7. Compression du **contenu** du dossier, sans dossier parent, vers `build/release/Sapphire3-<version>-windows.zip`.
8. Calcul et affichage de la taille et du SHA-256 de l'archive.

Contenu distribué de référence :

```text
Sapphire3.exe
resources.neu
updater.ps1
VERSION.txt
CREDITS.md
LICENSE.txt
LIRE-MOI.txt
README.txt
licenses/
```

`resources.neu` contient uniquement le frontend compilé et la configuration de production. `pnpm dist:win` ne nécessite aucune dépendance globale : Vite et la CLI Neutralinojs sont appelés depuis `node_modules`. Node.js n'est pas requis pour exécuter le paquet distribué.

### 4.1 Signature de code

Sans signature, Windows SmartScreen affiche un avertissement et les services informatiques refusent souvent le déploiement. La chaîne est prête, mais **le certificat doit appartenir à l'éditeur** : aucun certificat n'est fourni dans le dépôt.

Options acceptables :

- **Certificat OV ou EV de signature de code** (PFX) acheté auprès d'une autorité de certification. EV réduit plus vite les avertissements SmartScreen.
- **Azure Trusted Signing** ou service équivalent, avec une intégration dédiée à ajouter au script.
- Un certificat **auto-signé** ne convient qu'aux tests internes : il n'est pas approuvé par Windows et ne doit jamais être distribué.

Configuration par variables d'environnement :

| Variable | Rôle |
| --- | --- |
| `SAPPHIRE_SIGN_PFX` | chemin du fichier PFX |
| `SAPPHIRE_SIGN_PASSWORD` | mot de passe du PFX |
| `SAPPHIRE_SIGN_THUMBPRINT` | alternative : empreinte d'un certificat du magasin utilisateur |
| `SAPPHIRE_TIMESTAMP_URL` | horodatage RFC 3161, par défaut `http://timestamp.digicert.com` |
| `SIGTOOL_PATH` | chemin explicite de `signtool.exe` |
| `ISCC_PATH` | chemin explicite de `ISCC.exe` (Inno Setup) |

```powershell
$env:SAPPHIRE_SIGN_PFX = 'C:\certificats\sapphire3.pfx'
$env:SAPPHIRE_SIGN_PASSWORD = '...'
pnpm dist:installer
```

Sont signés : `Sapphire3.exe` avant le ZIP, puis l'installateur. `scripts/sign-windows.ps1` vérifie ensuite chaque fichier avec `Get-AuthenticodeSignature` et échoue si la chaîne n'est pas valide. Sans certificat, la construction continue mais affiche explicitement **« Paquet NON signé, à ne pas distribuer tel quel »**.

Vérification manuelle :

```powershell
Get-AuthenticodeSignature .\Sapphire3-<version>-windows-setup.exe | Format-List Status, SignerCertificate
signtool verify /pa /v .\Sapphire3-<version>-windows-setup.exe
```

Un certificat neuf peut conserver un avertissement SmartScreen tant que sa réputation n'est pas établie. Ce n'est pas un défaut de signature.

### 4.2 Installateur

`installer/Sapphire3.iss` produit un installateur **par utilisateur**, sans droit administrateur :

- dossier par défaut `%LOCALAPPDATA%\Programs\Sapphire 3` ;
- raccourcis menu Démarrer, bureau optionnel ;
- page de licence MIT, avertissement si WebView2 manque ;
- désinstallation qui retire le programme sans toucher aux fichiers `.sp3`, préférences ni données de récupération ;
- mêmes fichiers que le ZIP, y compris `updater.ps1`.

Inno Setup 6 ou 7 est requis sur la machine de construction (`ISCC.exe`), pas sur les postes des utilisateurs.

## 5. Vérifications avant publication

Appliquer une vérification proportionnée et réelle :

1. `pnpm test` : suite Node du moteur, du workspace et de la transpilation.
2. `pnpm build` : compilation Vite de production.
3. `pnpm dist:installer` : construction du ZIP et de l'installateur.
4. Audit de l'archive : liste des entrées, absence de dossier parent, présence de `LICENSE.txt`, des licences et notices.
5. Audit de `resources.neu` : uniquement `dist/index.html`, `dist/assets/*`, les licences embarquées `dist/fonts/licenses/OFL-*.txt` et `neutralino.config.json` ; ni sources, ni source maps, ni fixtures `.sp3`, ni dossier `verify`.
6. Lancement de `Sapphire3.exe` extrait du paquet, dans la fenêtre Neutralinojs.
7. Vérification native des fichiers `.sp3` : première sauvegarde vers un chemin choisi, puis `Ctrl+S` sur le fichier existant avec modification de l'horodatage et absence de fichier temporaire résiduel.
8. Contrôle de la version affichée par `VERSION.txt` et des métadonnées de l'exécutable.
9. Installateur : installation silencieuse dans un dossier temporaire, présence des fichiers, lancement, puis désinstallation silencieuse et vérification que le dossier a disparu.
10. Signature : `Get-AuthenticodeSignature` sur l'exécutable et l'installateur. Sans certificat, le résultat est explicitement `NotSigned` et le paquet ne doit pas être présenté comme prêt pour un établissement.
11. Accessibilité : suivre `docs/ACCESSIBILITY.md` sur les états principaux.

Ne pas annoncer un test qui n'a pas été exécuté. Distinguer « paquet construit », « paquet vérifié localement », « brouillon créé » et « release publiée ».

## 6. Release GitHub

Le dépôt autorisé est `lalBi94/Sapphire3`. Les notes de version sont conservées dans `docs/releases/v<version>.md` et versionnées avec les sources.

Procédure :

1. Commiter et pousser les sources, scripts et notes sur `master`.
2. Créer une release en **brouillon** avec le tag `v<version>` ciblant `master` :
   - titre lisible, par exemple « Sapphire 3 Beta 0.1.0 » ;
   - `--prerelease` pour une alpha ou une bêta ;
   - asset unique `Sapphire3-<version>-windows.zip` ;
   - notes issues de `docs/releases/v<version>.md`.
3. Vérifier la release distante : tag, statut brouillon, asset présent, taille et SHA-256.
4. Publier après validation explicite de l'utilisateur ; une bêta est publiée en **pré-release**, avec son tag créé par GitHub Releases.

Le brouillon n'est pas une publication. Ne jamais présenter une release comme publiée avant vérification de son statut et de ses assets sur GitHub.

## 7. Mise à jour

L'application intègre un updater simple, sans service tiers :

1. Au lancement et sur demande, elle consulte `https://api.github.com/repos/lalBi94/Sapphire3/releases` (API GitHub, HTTPS) et retient la release **publiée** la plus récente dont l'asset `Sapphire3-<version>-windows.zip` fournit une taille et un `digest` `sha256:…`.
2. Si cette version est plus récente que `package.json`, un bouton **Update** apparaît dans la barre et la fenêtre de paramètres propose la vérification et l'installation.
3. Après confirmation native, l'application lance `updater.ps1` (livré dans le ZIP, à la racine du dossier installé) avec l'URL de l'asset, la taille, l'empreinte et le PID courant, puis se ferme.
4. Le helper attend la fermeture, télécharge l'archive, **vérifie taille et SHA‑256**, extrait, remplace uniquement les fichiers distribués (jamais les données/préférences, stockées hors du dossier d'installation), puis relance `Sapphire3.exe`.
5. Un échec de vérification interrompt l'installation et est consigné dans `%TEMP%\sapphire3-update.log`.

Le helper est exécuté localement (PowerShell fourni par Windows) et n'exécute aucun code distant : seule l'archive signée par son empreinte est installée. Les erreurs réseau ne bloquent jamais les fonctionnalités hors ligne. Le ZIP doit toujours contenir `updater.ps1` pour que la mise à jour suivante puisse être appliquée.
