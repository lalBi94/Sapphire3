import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createArchive, readPackage, reportArchive, root, writeCommonFiles } from './build-common.mjs'
import { buildPresenceBinaries, presenceBinaryPath } from './build-presence.mjs'

// Convertit une version sémantique, préversion comprise, en version numérique macOS.
function numericVersionFor(value) {
  const [core, suffix = ''] = value.split('-')
  const numbers = core.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pre = Number.parseInt((suffix.match(/(\d+)$/) ?? [])[1] ?? '0', 10) || 0
  return [...numbers.slice(0, 3), pre].join('.')
}

const { version } = await readPackage()
await buildPresenceBinaries()
const appVersion = version.split('-')[0]
const neutralinoOutput = path.join(root, 'build', 'neutralino', 'sapphire3')
const binary = path.join(neutralinoOutput, 'sapphire3-mac_universal')
const resourcesFile = path.join(neutralinoOutput, 'resources.neu')
if (!existsSync(binary)) throw new Error(`Binaire macOS universel absent : ${binary}. Lancez d'abord « pnpm dist:win ».`)
if (!existsSync(resourcesFile)) throw new Error(`resources.neu absent : ${resourcesFile}. Lancez d'abord « pnpm dist:win ».`)

const releaseFolder = `Sapphire3-${version}-macos-universal`
const stagingDirectory = path.join(root, 'build', 'release', releaseFolder)
const appDirectory = path.join(stagingDirectory, 'Sapphire 3.app')
const contentsDirectory = path.join(appDirectory, 'Contents')
const macosDirectory = path.join(contentsDirectory, 'MacOS')
await rm(stagingDirectory, { recursive: true, force: true })
await mkdir(macosDirectory, { recursive: true })
await mkdir(path.join(contentsDirectory, 'Resources'), { recursive: true })
await cp(path.join(root, 'src', 'assets', 'branding', '03_DESKTOP', 'macOS', 'sapphire3.icns'), path.join(contentsDirectory, 'Resources', 'sapphire3.icns'))

await cp(binary, path.join(macosDirectory, 'Sapphire 3'))
await cp(resourcesFile, path.join(macosDirectory, 'resources.neu'))
await cp(presenceBinaryPath('macos', 'x64'), path.join(macosDirectory, 'discord-presence-x64'))
await cp(presenceBinaryPath('macos', 'arm64'), path.join(macosDirectory, 'discord-presence-arm64'))
await writeFile(path.join(contentsDirectory, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>Sapphire 3</string>
  <key>CFBundleExecutable</key><string>Sapphire 3</string>
  <key>CFBundleIdentifier</key><string>local.sapphire3.app</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Sapphire 3</string>
  <key>CFBundleIconFile</key><string>sapphire3.icns</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${appVersion}</string>
  <key>CFBundleVersion</key><string>${numericVersionFor(version)}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
`)

await writeCommonFiles(stagingDirectory, {
  releaseVersion: version,
  releaseTitle: `Sapphire 3 Beta ${version}`,
  notices: {
    platform: 'macOS Universal',
    fr: `Décompressez cette archive, puis ouvrez Sapphire 3.app depuis le Finder.\nAucune installation de Node.js n'est nécessaire. macOS 11 ou ultérieur est requis.\nCette version n'est ni signée ni notariée par Apple : au premier lancement, utilisez clic droit > Ouvrir ou Réglages Système > Confidentialité et sécurité. Ne désactivez pas Gatekeeper ni SIP.\nLes mises à jour sont téléchargées manuellement depuis les releases GitHub ; l'installation automatique n'est pas encore disponible sur macOS.`,
    en: `Extract this archive, then open Sapphire 3.app from Finder.\nNode.js is not required. macOS 11 or later is required.\nThis build is neither signed nor notarized by Apple: on first launch, use right-click > Open or System Settings > Privacy & Security. Do not disable Gatekeeper or SIP.\nUpdates are downloaded manually from the GitHub releases; automatic installation is not available on macOS yet.`,
  },
})

const archivePath = path.join(root, 'build', 'release', `${releaseFolder}.zip`)
await rm(archivePath, { force: true })
createArchive('zip', stagingDirectory, archivePath, { executable: ['Sapphire 3.app/Contents/MacOS/Sapphire 3', 'Sapphire 3.app/Contents/MacOS/discord-presence-x64', 'Sapphire 3.app/Contents/MacOS/discord-presence-arm64'] })
await reportArchive(archivePath)
