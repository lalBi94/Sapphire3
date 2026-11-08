# Discord Rich Presence — Sapphire 3

> Intégration locale, sans compte, sans OAuth, sans backend et sans fichier utilisateur publié.

## 1. Principe

Sapphire 3 publie une activité Discord générique lorsque l'application desktop est ouverte et que Discord Desktop est lancé. Le réglage est **activé par défaut** et peut être désactivé dans **Settings → About → Application**.

La présence ne dépend pas de Discord pour démarrer : si Discord est absent, le sidecar réessaie avec un backoff borné et l'application reste normale.

## 2. Architecture retenue

```text
Canvas React
  └─ useDiscordPresence / src/services/discordPresence.js
       └─ Neutralinojs os.spawnProcess + stdIn
            └─ sidecar C++20 natif (native/discord-presence)
                 └─ IPC local Discord (named pipe / Unix socket)
```

- **Pas de Node.js, Python ou runtime supplémentaire** chez l'utilisateur : le sidecar est un binaire natif C++20.
- **Pas de WebSocket RPC déprécié** : le sidecar utilise l'IPC local officiel de Discord (`discord-ipc-0` à `9`).
- **Pas de dépendance externe** : uniquement la bibliothèque standard C++ et les API système. Le SDK officiel Discord a été évalué, mais l'IPC direct reste plus léger et préserve le protocole `A/C/Q` existant.
- **Un seul sidecar par instance applicative** : le service React est un singleton, même avec StrictMode ou plusieurs montages. Plusieurs instances Sapphire simultanées gardent chacune leur sidecar ; Discord affiche l'activité la plus récente.
- **Aucun second moteur** : l'activité est dérivée des états React existants (`execution`, `debugSession`, `engineWork`, `transpilationResult`, `document.exercise`, compteurs du projet).
- **Recherche Unix corrigée** : chaque base (`XDG_RUNTIME_DIR`, `TMPDIR`, `TMP`, `TEMP`, `/tmp`) est essayée pour chaque index `discord-ipc-0` à `9`, sans sauter de base après le premier index.
- **Clear dédupliqué** : un `SET_ACTIVITY` identique n'est pas renvoyé ; `C` puis `Q` ne produisent pas deux effacements.

### Cycle de vie

| Situation | Comportement |
| --- | --- |
| Discord déjà ouvert | Connexion au premier essai et publication de l'activité. |
| Discord fermé | Sidecar silencieux, reconnexion 1 s, 2 s, 4 s… jusqu'à 60 s. |
| Discord ouvert après Sapphire 3 | Connexion à la prochaine tentative. |
| Discord redémarré | Détection par PING/écriture, reconnexion automatique. |
| Changement d'activité | Mise à jour seulement si la signature change. |
| Fermeture de Sapphire 3 | `Q` puis `exit`, effacement de l'activité ; la fermeture de stdin fait aussi sortir le sidecar. |
| Plantage du sidecar | Aucun impact sur Sapphire 3 ; le service réessaie sans erreur visible. |
| Réglage désactivé | Arrêt immédiat et `SET_ACTIVITY` avec `activity: null`. |

## 3. Application Discord et configuration développeur

L'Application ID commun est intégré dans `native/discord-presence/src/presence_core.h` :

```text
1568755585250492416
```

### Étapes à faire une seule fois

1. Créer ou ouvrir l'application **Sapphire 3** dans le [Discord Developer Portal](https://discord.com/developers/applications).
2. Vérifier que l'Application ID correspond à `1568755585250492416`. S'il change, modifier la constante `applicationID` et reconstruire les sidecars.
3. Dans **Rich Presence → Art Assets**, importer les images avec exactement ces clés :
   - `sapphire3_logo` — grande image. Fichier conseillé : `src/assets/branding/01_WEB/PNG_transparent/sapphire3_logo_512x512.png` (ou `1024x1024`).
   - `sapphire3_activity` — petite image. Fichier conseillé : `src/assets/branding/04_DISCORD_RICH_PRESENCE/sapphire3-rich-presence-large-512x512.png` (ou le logo 256 px).
4. Vérifier que **Rich Presence** est activé pour l'application.
5. Tant que l'application n'est pas approuvée par Discord, ajouter les testeurs dans **App Testers** (jusqu'à 50 comptes) : Discord limite l'accès RPC des applications non approuvées aux testeurs. Une fois approuvée, tous les utilisateurs peuvent voir la présence sans configuration.
6. Aucun scope OAuth, token, client secret ou redirect URI n'est nécessaire pour `SET_ACTIVITY`. Ne jamais embarquer de secret dans l'application.

Les assets sont optionnels pour le fonctionnement : si une clé manque, la présence textuelle reste publiée mais l'image correspondante peut ne pas s'afficher.

## 4. Activités publiées

| Situation | Details | State | Petite image |
| --- | --- | --- | --- |
| Application vide | Exploring visual programming | Ready to create | `sapphire3_activity` |
| Édition | Building a visual program | `N modules · M nodes` | `sapphire3_activity` |
| Simulation | Running a simulation | Executing program / Simulation paused / Simulation stopped | `sapphire3_activity` |
| Débogage | Debugging a program | Execution paused | `sapphire3_activity` |
| Transpilation | Transpiling to JavaScript / Python / code | Generating code | `sapphire3_activity` |
| Exercice | Working on an exercise | Visual programming | `sapphire3_activity` |

Le chronomètre (`timestamps.start`) est fixé au démarrage du service et conservé lors des reconnexions. Deux boutons sont ajoutés :

- **View on GitHub** → `https://github.com/lalBi94/Sapphire3`
- **Download Sapphire 3** → `https://github.com/lalBi94/Sapphire3/releases`

Aucun bouton **Join**, aucune invitation collaborative, aucune `party` ni `secrets`.

## 5. Confidentialité

La présence ne publie jamais :

- le nom ou le chemin d'un fichier, d'un dossier ou d'un workspace ;
- le nom d'un module, d'une fonction, d'une variable ou d'un type ;
- le code source, les valeurs, les diagnostics ou les sorties ;
- l'identité Discord de l'utilisateur.

Seuls des **compteurs généraux** (modules, nœuds) et des libellés fixes sont transmis. Le sidecar ne contacte que l'IPC local de Discord ; aucun serveur, aucune télémétrie, aucun stockage distant.

## 6. Réglage utilisateur

- Préférence : `sapphire-discord-presence`, valeurs `true`/`false`, défaut **activé**.
- Écrite par `src/services/preferences.js` (localStorage + `storage.setData` Neutralinojs).
- Appliquée immédiatement : désactiver envoie `Q`/`exit` et efface l'activité.
- Le réglage est dans **Settings → About → Application**, avec une aide courte indiquant que l'activité peut être visible sur le profil Discord.

## 7. Construction et distribution

Prérequis de build uniquement : **CMake 3.25+**, **Ninja** et **Zig 0.17+**. Les utilisateurs n'ont besoin d'aucun runtime.

```sh
pnpm presence:build   # CMake + Zig : cinq sidecars dans build/presence/
pnpm presence:test    # tests C++ via CMake/CTest
pnpm presence:ipc-test # faux serveur IPC : handshake, READY, SET_ACTIVITY, clear, reconnexion
pnpm presence:nodiscord-test # sidecar sans Discord : stable, silencieux, arrêt propre
pnpm dist:win         # copie discord-presence.exe à côté de Sapphire3.exe
pnpm dist:linux       # copie discord-presence dans chaque archive Linux
pnpm dist:mac         # copie discord-presence-x64 et -arm64 dans le bundle
```

La variable d'environnement `SAPPHIRE_DISCORD_IPC_PATH`, réservée aux tests, force un chemin IPC unique pour ne jamais toucher au Discord réel de la machine. Elle n'est pas définie en production.

Variables de build facultatives : `CMAKE_BIN`, `NINJA_BIN` et `ZIG_BIN` permettent de pointer vers des installations hors PATH.

- Windows : cible CMake `WIN32` et option `-Wl,--subsystem,windows` (aucune console visible) ; le binaire est signé avec l'exécutable si un certificat est configuré.
- Linux : `discord-presence` est marqué exécutable dans le `.tar.gz` avec `Sapphire3`.
- macOS : les deux architectures sont livrées dans `Contents/MacOS/` et marquées exécutables.
- CI : `mlugg/setup-zig` installe Zig, CMake/Ninja sont installés via `apt`, puis `pnpm presence:build`, `pnpm presence:test`, les tests IPC et le scénario sans Discord s'exécutent avant les tests et le build.

### Plateformes validées

- **Windows x64** : sidecar C++20 compilé et testé localement avec un faux serveur IPC (handshake, READY, SET_ACTIVITY, clear, reconnexion), puis application réelle → sidecar → IPC avec activité complète, un seul sidecar et aucun terminal visible. L'intégration avec un Discord réel et un compte testeur reste à confirmer manuellement.
- **Linux x64/ARM64** et **macOS x64/ARM64** : binaires **compilés** par CMake/Zig, mais **non exécutés** sur leur système cible. Le rendu Discord réel, les permissions et l'IPC Unix restent à valider sur ces plateformes.

## 8. Limites connues

- Discord Desktop doit être lancé ; l'application ne démarre jamais Discord.
- Les applications Discord non approuvées limitent le RPC aux testeurs (50 comptes). C'est une règle Discord, pas un réglage de Sapphire 3.
- Certaines distributions Linux (Flatpak/Snap) ou configurations macOS peuvent isoler l'IPC Discord ; aucune contournement de sandbox n'est implémenté.
- Plusieurs instances Sapphire simultanées publient chacune leur activité ; Discord affiche la plus récente. Aucun verrou global inter-processus n'est imposé.
- Le sidecar ne journalise pas dans un fichier ; les erreurs restent silencieuses côté utilisateur.
- Aucun bouton de test manuel n'est ajouté : le réglage Enabled/Disabled suffit.
