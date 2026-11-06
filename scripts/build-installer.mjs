import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const version = packageJson.version
const numericVersion = numericVersionFor(version)
const releaseFolder = `Sapphire3-${version}-windows`
const stagingDirectory = path.join(root, 'build', 'release', releaseFolder)
const outputDirectory = path.join(root, 'build', 'release')
const installerPath = path.join(outputDirectory, `Sapphire3-${version}-windows-setup.exe`)
const scriptPath = path.join(root, 'installer', 'Sapphire3.iss')
const signScript = path.join(root, 'scripts', 'sign-windows.ps1')

// Convertit une version sémantique, préversion comprise, en version numérique Windows.
function numericVersionFor(value) {
  const [core, suffix = ''] = value.split('-')
  const numbers = core.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pre = Number.parseInt((suffix.match(/(\d+)$/) ?? [])[1] ?? '0', 10) || 0
  return [...numbers.slice(0, 3), pre].join('.')
}

// Localise ISCC.exe : variable dédiée, PATH, puis emplacements d'installation courants.
function findInnoCompiler() {
  if (process.env.ISCC_PATH && existsSync(process.env.ISCC_PATH)) return process.env.ISCC_PATH
  const where = spawnSync('where.exe', ['iscc.exe'], { encoding: 'utf8' })
  if (where.status === 0) return where.stdout.split(/\r?\n/).find(Boolean)
  for (const candidate of [
    'C:\\Program Files (x86)\\Inno Setup 7\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 7\\ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  ]) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error('ISCC.exe introuvable. Installez Inno Setup 6/7 ou définissez ISCC_PATH.')
}

// Refuse de produire un installateur sans les fichiers du paquet portable.
function assertStaging() {
  if (!existsSync(stagingDirectory)) {
    throw new Error(`Dossier de paquet absent : ${stagingDirectory}. Lancez d'abord « pnpm dist:win ».`)
  }
  for (const required of ['Sapphire3.exe', 'resources.neu', 'LICENSE.txt', 'VERSION.txt']) {
    if (!existsSync(path.join(stagingDirectory, required))) {
      throw new Error(`Fichier distribué manquant : ${required}. Relancez « pnpm dist:win ».`)
    }
  }
}

// Lance un script PowerShell en échouant explicitement sur un code non nul.
function runPowerShell(argumentsList) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...argumentsList], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Signe les fichiers si un certificat est configuré ; sinon signale clairement l'absence de signature.
function signArtifacts(paths) {
  if (!process.env.SAPPHIRE_SIGN_PFX && !process.env.SAPPHIRE_SIGN_THUMBPRINT) {
    console.warn('\nSignature : aucun certificat configuré. Paquet NON signé, à ne pas distribuer tel quel.')
    return false
  }
  runPowerShell(['-File', signScript, '-Path', paths.join(',')])
  return true
}

// Construit l'installateur Inno Setup, le signe si possible et publie son empreinte.
async function buildInstaller() {
  assertStaging()
  const iscc = findInnoCompiler()
  console.log(`\nInstallateur : ${iscc}`)
  const result = spawnSync(iscc, [
    `/DAppVersion=${version}`,
    `/DAppVersionNumeric=${numericVersion}`,
    `/DStagingDir=${stagingDirectory}`,
    `/DOutputDir=${outputDirectory}`,
    scriptPath,
  ], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  if (!existsSync(installerPath)) throw new Error(`Installateur attendu absent : ${installerPath}`)

  const signed = signArtifacts([installerPath])
  const buffer = await readFile(installerPath)
  console.log(`\nInstallateur : ${installerPath}`)
  console.log(`Taille : ${buffer.length} octets`)
  console.log(`SHA-256 : ${createHash('sha256').update(buffer).digest('hex')}`)
  console.log(`Signature : ${signed ? 'vérifiée' : 'absente'}`)
}

await buildInstaller()
