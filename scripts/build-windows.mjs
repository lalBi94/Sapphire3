import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const releaseVersion = packageJson.version
const appVersion = releaseVersion.split('-')[0]
const productName = 'Sapphire3'
const releaseFolder = `${productName}-${releaseVersion}-windows`
const archiveName = `${releaseFolder}.zip`
const buildDirectory = path.join(root, 'build')
const productionConfigPath = path.join(buildDirectory, 'production', 'neutralino.config.json')
const neutralinoBuildDirectory = path.join(buildDirectory, 'neutralino')
const stagingDirectory = path.join(buildDirectory, 'release', releaseFolder)
const archivePath = path.join(buildDirectory, 'release', archiveName)

// Exécute un script Node du projet sans dépendre d'un shell ni d'un outil global.
function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Compresse le contenu du dossier de préparation sans ajouter de dossier parent au ZIP.
function runPowerShell(command) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Refuse les sources maps, workspaces et dossiers de développement dans le frontend compilé.
async function assertNoDevelopmentFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (['verify', 'src', 'node_modules'].includes(entry.name)) throw new Error(`Dossier de développement interdit dans le paquet : ${target}`)
      await assertNoDevelopmentFiles(target)
    } else if (entry.name.endsWith('.map') || entry.name.endsWith('.sp3')) {
      throw new Error(`Fichier de développement interdit dans le paquet : ${target}`)
    }
  }
}

// Copie une licence requise en échouant explicitement si le fichier attendu manque.
async function copyLicense(source, destination) {
  if (!existsSync(source)) throw new Error(`Licence manquante : ${source}`)
  await cp(source, destination)
}

// Produit une configuration Neutralinojs de production sans toucher à la configuration de développement.
async function writeProductionConfig(devConfig) {
  const productionConfig = {
    ...devConfig,
    version: appVersion,
    logging: { enabled: false, writeToLogFile: false },
    modes: {
      ...devConfig.modes,
      window: { ...devConfig.modes.window, enableInspector: false },
    },
    cli: {
      binaryName: devConfig.cli.binaryName,
      binaryVersion: devConfig.cli.binaryVersion,
      resourcesPath: devConfig.cli.resourcesPath,
      distributionPath: '/build/neutralino/',
      resourcesExclude: '\\.map$',
    },
  }
  await mkdir(path.dirname(productionConfigPath), { recursive: true })
  await writeFile(productionConfigPath, `${JSON.stringify(productionConfig, null, 2)}\n`)
}

// Rassemble l'exécutable Windows, les ressources et les notices dans le dossier distribué.
async function stagePackage(binaryName) {
  const neutralinoOutput = path.join(neutralinoBuildDirectory, binaryName)
  const windowsBinary = path.join(neutralinoOutput, 'sapphire3-win_x64.exe')
  const resourcesFile = path.join(neutralinoOutput, 'resources.neu')
  if (!existsSync(windowsBinary)) throw new Error(`Exécutable Windows absent : ${windowsBinary}`)
  if (!existsSync(resourcesFile)) throw new Error(`resources.neu absent : ${resourcesFile}`)

  await rm(stagingDirectory, { recursive: true, force: true })
  await mkdir(stagingDirectory, { recursive: true })
  await cp(windowsBinary, path.join(stagingDirectory, `${productName}.exe`))
  await cp(resourcesFile, path.join(stagingDirectory, 'resources.neu'))
  await writeFile(path.join(stagingDirectory, 'VERSION.txt'), `${releaseVersion}\n`)

  const licensesDirectory = path.join(stagingDirectory, 'licenses')
  await mkdir(licensesDirectory)
  await copyLicense(path.join(root, 'node_modules', 'react', 'LICENSE'), path.join(licensesDirectory, 'react-MIT.txt'))
  await copyLicense(path.join(root, 'node_modules', 'react-dom', 'LICENSE'), path.join(licensesDirectory, 'react-dom-MIT.txt'))
  await copyLicense(path.join(root, 'node_modules', 'lucide-react', 'LICENSE'), path.join(licensesDirectory, 'lucide-react-ISC.txt'))
  await copyLicense(path.join(root, 'node_modules', '@neutralinojs', 'lib', 'LICENSE'), path.join(licensesDirectory, 'neutralinojs-lib-MIT.txt'))
  await copyLicense(path.join(root, 'scripts', 'licenses', 'neutralinojs.txt'), path.join(licensesDirectory, 'neutralinojs-MIT.txt'))
  await copyLicense(path.join(root, 'scripts', 'licenses', 'libtrashcan.txt'), path.join(licensesDirectory, 'libtrashcan-MIT.txt'))

  await writeFile(path.join(stagingDirectory, 'CREDITS.md'), `# Crédits — Sapphire 3 ${releaseVersion}\n\nSapphire 3 est construit avec React, Vite, Neutralinojs et Lucide.\n\n## Composants distribués\n\n- React et React DOM — MIT — Copyright (c) Meta Platforms, Inc. and affiliates.\n- Lucide React — ISC — Copyright (c) 2026 Lucide Icons and Contributors.\n- Neutralinojs client — MIT — Copyright (c) 2021 Neutralinojs.\n- Neutralinojs core — MIT — Copyright (c) 2021-2025 Neutralinojs and contributors.\n- libtrashcan — MIT — Copyright (c) 2019 Robert Gützkow.\n\nLes textes complets figurent dans le dossier \`licenses/\`.\n`)

  await writeFile(path.join(stagingDirectory, 'LIRE-MOI.txt'), `Sapphire 3 Alpha ${releaseVersion} — Windows\n\nDécompressez cette archive dans un dossier accessible en écriture, puis lancez Sapphire3.exe.\nAucune installation de Node.js n'est nécessaire. Windows 10/11 avec WebView2 est requis.\nLes fichiers .sp3 s'ouvrent et s'enregistrent via les dialogues de l'application.\nAucun système de mise à jour automatique n'est inclus.\n`)

  await writeFile(path.join(stagingDirectory, 'README.txt'), `Sapphire 3 Alpha ${releaseVersion} — Windows\n\nExtract this archive to a writable folder, then run Sapphire3.exe.\nNode.js is not required. Windows 10/11 with WebView2 is required.\n.sp3 files are opened and saved through the application dialogs.\nNo automatic update system is included.\n`)
}

// Construit le paquet Windows, calcule son empreinte et affiche les chemins de distribution.
async function buildWindowsPackage() {
  const devConfig = JSON.parse(await readFile(path.join(root, 'neutralino.config.json'), 'utf8'))
  await writeProductionConfig(devConfig)

  await rm(path.join(root, 'dist'), { recursive: true, force: true })
  runNode([path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'])
  // Les fixtures de vérification restent dans public/ pour le développement mais ne sont pas distribuées.
  await rm(path.join(root, 'dist', 'verify'), { recursive: true, force: true })
  await assertNoDevelopmentFiles(path.join(root, 'dist'))

  await rm(neutralinoBuildDirectory, { recursive: true, force: true })
  runNode([
    path.join(root, 'node_modules', '@neutralinojs', 'neu', 'bin', 'neu.js'),
    'build',
    '--config-file',
    path.relative(root, productionConfigPath),
    '--clean',
  ])

  await stagePackage(devConfig.cli.binaryName)

  await rm(archivePath, { force: true })
  const escapedStaging = stagingDirectory.replace(/'/g, "''")
  const escapedArchive = archivePath.replace(/'/g, "''")
  runPowerShell(`Compress-Archive -Path '${escapedStaging}\\*' -DestinationPath '${escapedArchive}' -Force`)

  const archive = await readFile(archivePath)
  const sha256 = createHash('sha256').update(archive).digest('hex')
  console.log(`\nDossier distribué : ${stagingDirectory}`)
  console.log(`Archive : ${archivePath}`)
  console.log(`Taille : ${archive.length} octets`)
  console.log(`SHA-256 : ${sha256}`)
}

await buildWindowsPackage()
