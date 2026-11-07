import { mkdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(root, 'native', 'discord-presence')
const outputDirectory = path.join(root, 'build', 'presence')
const stampPath = path.join(outputDirectory, '.stamp')
const sourceFiles = ['go.mod', 'main.go', 'ipc_windows.go', 'ipc_unix.go']

// Cibles réellement produites : Windows x64, Linux x64/ARM64 et macOS x64/ARM64.
const targets = [
  { platform: 'windows', arch: 'x64', goos: 'windows', goarch: 'amd64', name: 'discord-presence.exe', folder: 'windows-x64', gui: true },
  { platform: 'linux', arch: 'x64', goos: 'linux', goarch: 'amd64', name: 'discord-presence', folder: 'linux-x64' },
  { platform: 'linux', arch: 'arm64', goos: 'linux', goarch: 'arm64', name: 'discord-presence', folder: 'linux-arm64' },
  { platform: 'macos', arch: 'x64', goos: 'darwin', goarch: 'amd64', name: 'discord-presence', folder: 'macos-x64' },
  { platform: 'macos', arch: 'arm64', goos: 'darwin', goarch: 'arm64', name: 'discord-presence', folder: 'macos-arm64' },
]

// Retrouve le binaire Go, via GO_BIN ou le PATH.
export function findGo() {
  const configured = process.env.GO_BIN
  const candidates = configured
    ? [configured, path.join(configured, process.platform === 'win32' ? 'go.exe' : 'go')]
    : [process.platform === 'win32' ? 'go.exe' : 'go']
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['version'], { encoding: 'utf8' })
    if (result.status === 0) return candidate
  }
  throw new Error('Go est introuvable. Installez Go 1.27+ ou définissez GO_BIN pour construire le sidecar Discord.')
}

// Chemin attendu d'un binaire pour une plateforme et une architecture.
export function presenceBinaryPath(platform, arch) {
  const target = targets.find((entry) => entry.platform === platform && entry.arch === arch)
  return target ? path.join(outputDirectory, target.folder, target.name) : null
}

// Vérifie si les cinq binaires sont plus récents que les sources.
async function isUpToDate() {
  if (!existsSync(stampPath)) return false
  try {
    const stamp = await stat(stampPath)
    let newest = 0
    for (const file of sourceFiles) {
      const info = await stat(path.join(sourceDirectory, file))
      newest = Math.max(newest, info.mtimeMs)
    }
    for (const target of targets) {
      const output = path.join(outputDirectory, target.folder, target.name)
      if (!existsSync(output)) return false
      const info = await stat(output)
      if (info.mtimeMs < newest) return false
    }
    return stamp.mtimeMs >= newest
  } catch {
    return false
  }
}

// Compile le sidecar pour toutes les plateformes, sans dépendance runtime.
export async function buildPresenceBinaries({ force = false, quiet = false } = {}) {
  if (!force && await isUpToDate()) return { ok: true, skipped: true }
  const go = findGo()
  await mkdir(outputDirectory, { recursive: true })
  for (const target of targets) {
    const folder = path.join(outputDirectory, target.folder)
    await mkdir(folder, { recursive: true })
    const output = path.join(folder, target.name)
    const ldflags = target.gui ? '-H windowsgui -s -w' : '-s -w'
    const result = spawnSync(go, ['build', '-trimpath', '-ldflags', ldflags, '-o', output, '.'], {
      cwd: sourceDirectory,
      encoding: 'utf8',
      env: { ...process.env, CGO_ENABLED: '0', GOOS: target.goos, GOARCH: target.goarch },
    })
    if (result.status !== 0) {
      throw new Error(`Compilation du sidecar ${target.platform}-${target.arch} échouée.\n${result.stderr || result.stdout || ''}`)
    }
    if (!quiet) console.log(`Sidecar Discord : ${target.platform}-${target.arch}`)
  }
  await writeFile(stampPath, `${new Date().toISOString()}\n`)
  return { ok: true, skipped: false }
}

// Exécution directe : construit les binaires pour les scripts de distribution.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildPresenceBinaries({ force: process.argv.includes('--force') })
    if (result.skipped) console.log('Sidecar Discord déjà à jour.')
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
