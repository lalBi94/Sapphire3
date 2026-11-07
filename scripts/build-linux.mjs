import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createArchive, readPackage, reportArchive, root, writeCommonFiles } from './build-common.mjs'
import { buildPresenceBinaries, presenceBinaryPath } from './build-presence.mjs'

const { version } = await readPackage()
await buildPresenceBinaries()
const neutralinoOutput = path.join(root, 'build', 'neutralino', 'sapphire3')
const resourcesFile = path.join(neutralinoOutput, 'resources.neu')
if (!existsSync(resourcesFile)) {
  throw new Error(`resources.neu absent : ${resourcesFile}. Lancez d'abord « pnpm dist:win ».`)
}

const binaries = [
  { arch: 'x64', source: path.join(neutralinoOutput, 'sapphire3-linux_x64') },
  { arch: 'arm64', source: path.join(neutralinoOutput, 'sapphire3-linux_arm64') },
]

for (const { arch, source } of binaries) {
  if (!existsSync(source)) throw new Error(`Binaire Linux ${arch} absent : ${source}. Lancez d'abord « pnpm dist:win ».`)
  const releaseFolder = `Sapphire3-${version}-linux-${arch}`
  const stagingDirectory = path.join(root, 'build', 'release', releaseFolder)
  await rm(stagingDirectory, { recursive: true, force: true })
  await mkdir(stagingDirectory, { recursive: true })
  await cp(source, path.join(stagingDirectory, 'Sapphire3'))
  await cp(resourcesFile, path.join(stagingDirectory, 'resources.neu'))
  await cp(presenceBinaryPath('linux', arch), path.join(stagingDirectory, 'discord-presence'))
  await cp(path.join(root, 'src', 'assets', 'branding', '03_DESKTOP', 'Linux', 'hicolor'), path.join(stagingDirectory, 'share', 'icons', 'hicolor'), { recursive: true })
  await mkdir(path.join(stagingDirectory, 'share', 'applications'), { recursive: true })
  await writeFile(path.join(stagingDirectory, 'share', 'applications', 'sapphire3.desktop'), `[Desktop Entry]
Type=Application
Name=Sapphire 3
Exec=Sapphire3
Icon=sapphire3
Terminal=false
Categories=Development;IDE;
`)
  await writeCommonFiles(stagingDirectory, {
    releaseVersion: version,
    releaseTitle: `Sapphire 3 Beta ${version}`,
    notices: {
      platform: `Linux ${arch}`,
      fr: `Décompressez cette archive dans un dossier accessible en écriture, puis lancez ./Sapphire3.\nAucune installation de Node.js n'est nécessaire. WebKitGTK 4.1 doit être disponible sur le système.\nLes fichiers .sp3 s'ouvrent et s'enregistrent via les dialogues de l'application.\nLes mises à jour sont téléchargées manuellement depuis les releases GitHub ; l'installation automatique n'est pas encore disponible sur Linux.`,
      en: `Extract this archive to a writable folder, then run ./Sapphire3.\nNode.js is not required. WebKitGTK 4.1 must be available on the system.\n.sp3 files are opened and saved through the application dialogs.\nUpdates are downloaded manually from the GitHub releases; automatic installation is not available on Linux yet.`,
    },
  })

  const archivePath = path.join(root, 'build', 'release', `${releaseFolder}.tar.gz`)
  await rm(archivePath, { force: true })
  createArchive('tar.gz', stagingDirectory, archivePath, { prefix: releaseFolder, executable: ['Sapphire3', 'discord-presence'] })
  await reportArchive(archivePath)
}
