import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const archiveScript = path.join(root, 'scripts', 'archive.py')

// Lit la version applicative depuis package.json, source unique de vérité.
export async function readPackage() {
  return JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
}

// Copie une licence en échouant explicitement si le fichier attendu manque.
async function copyLicense(source, destination) {
  if (!existsSync(source)) throw new Error(`Licence manquante : ${source}`)
  await cp(source, destination)
}

// Copie les licences des composants distribués dans le dossier du paquet.
export async function copyLicenses(stagingDirectory) {
  const licensesDirectory = path.join(stagingDirectory, 'licenses')
  await mkdir(licensesDirectory, { recursive: true })
  await copyLicense(path.join(root, 'node_modules', 'react', 'LICENSE'), path.join(licensesDirectory, 'react-MIT.txt'))
  await copyLicense(path.join(root, 'node_modules', 'react-dom', 'LICENSE'), path.join(licensesDirectory, 'react-dom-MIT.txt'))
  await copyLicense(path.join(root, 'node_modules', 'lucide-react', 'LICENSE'), path.join(licensesDirectory, 'lucide-react-ISC.txt'))
  await copyLicense(path.join(root, 'node_modules', 'katex', 'LICENSE'), path.join(licensesDirectory, 'katex-MIT.txt'))
  await copyLicense(path.join(root, 'node_modules', '@neutralinojs', 'lib', 'LICENSE'), path.join(licensesDirectory, 'neutralinojs-lib-MIT.txt'))
  await copyLicense(path.join(root, 'scripts', 'licenses', 'neutralinojs.txt'), path.join(licensesDirectory, 'neutralinojs-MIT.txt'))
  await copyLicense(path.join(root, 'scripts', 'licenses', 'libtrashcan.txt'), path.join(licensesDirectory, 'libtrashcan-MIT.txt'))
}

// Écrit les fichiers communs : licence, version, crédits et notices.
export async function writeCommonFiles(stagingDirectory, { releaseVersion, releaseTitle, notices }) {
  await copyLicense(path.join(root, 'LICENSE'), path.join(stagingDirectory, 'LICENSE.txt'))
  await writeFile(path.join(stagingDirectory, 'VERSION.txt'), `${releaseVersion}\n`)
  await writeFile(path.join(stagingDirectory, 'CREDITS.md'), `# Crédits — ${releaseTitle}\n\nSapphire 3 est distribué sous licence MIT (voir \`LICENSE.txt\`). Il est construit avec React, Vite, Neutralinojs, Lucide et KaTeX.\n\n## Composants distribués\n\n- React et React DOM — MIT — Copyright (c) Meta Platforms, Inc. and affiliates.\n- Lucide React — ISC — Copyright (c) 2026 Lucide Icons and Contributors.\n- KaTeX — MIT — Copyright (c) 2013-2020 Khan Academy and other contributors.\n- Neutralinojs client — MIT — Copyright (c) 2021 Neutralinojs.\n- Neutralinojs core — MIT — Copyright (c) 2021-2025 Neutralinojs and contributors.\n- libtrashcan — MIT — Copyright (c) 2019 Robert Gützkow.\n\nLes textes complets figurent dans le dossier \`licenses/\`.\n`)
  await writeFile(path.join(stagingDirectory, 'LIRE-MOI.txt'), `${releaseTitle} — ${notices.platform}\n\n${notices.fr}\n`)
  await writeFile(path.join(stagingDirectory, 'README.txt'), `${releaseTitle} — ${notices.platform}\n\n${notices.en}\n`)
  await copyLicenses(stagingDirectory)
}

// Localise un interpréteur Python disponible pour créer les archives.
function pythonCommand() {
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
  for (const command of candidates) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8' })
    if (probe.status === 0) return command
  }
  throw new Error('Python introuvable. Installez Python 3 pour créer les archives Linux/macOS.')
}

// Crée une archive avec les permissions Unix adaptées.
export function createArchive(format, source, output, { prefix = '', executable = '' } = {}) {
  const args = [archiveScript, '--format', format, '--source', source, '--output', output]
  if (prefix) args.push('--prefix', prefix)
  for (const entry of Array.isArray(executable) ? executable : executable ? [executable] : []) args.push('--executable', entry)
  const result = spawnSync(pythonCommand(), args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Affiche le chemin, la taille et l'empreinte SHA-256 d'une archive.
export async function reportArchive(file) {
  const buffer = await readFile(file)
  console.log(`\nArchive : ${file}`)
  console.log(`Taille : ${buffer.length} octets`)
  console.log(`SHA-256 : ${createHash('sha256').update(buffer).digest('hex')}`)
}
