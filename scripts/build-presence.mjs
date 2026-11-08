import { chmod, mkdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(root, 'native', 'discord-presence')
const outputDirectory = path.join(root, 'build', 'presence')
const cmakeDirectory = path.join(outputDirectory, 'cmake')
const toolchainDirectory = path.join(outputDirectory, 'toolchains')
const stampPath = path.join(outputDirectory, '.stamp')
const sourceFiles = [
  'CMakeLists.txt',
  'src/main.cpp',
  'src/presence_core.cpp',
  'src/presence_core.h',
]

// Cibles réellement produites : Windows x64, Linux x64/ARM64 et macOS x64/ARM64.
export const targets = [
  { platform: 'windows', arch: 'x64', systemName: 'Windows', processor: 'x86_64', zigTarget: 'x86_64-windows-gnu', name: 'discord-presence.exe', folder: 'windows-x64' },
  { platform: 'linux', arch: 'x64', systemName: 'Linux', processor: 'x86_64', zigTarget: 'x86_64-linux-musl', name: 'discord-presence', folder: 'linux-x64' },
  { platform: 'linux', arch: 'arm64', systemName: 'Linux', processor: 'aarch64', zigTarget: 'aarch64-linux-musl', name: 'discord-presence', folder: 'linux-arm64' },
  { platform: 'macos', arch: 'x64', systemName: 'Darwin', processor: 'x86_64', zigTarget: 'x86_64-macos', name: 'discord-presence', folder: 'macos-x64' },
  { platform: 'macos', arch: 'arm64', systemName: 'Darwin', processor: 'arm64', zigTarget: 'aarch64-macos', name: 'discord-presence', folder: 'macos-arm64' },
]

// Cherche un outil de build via une variable dédiée puis le PATH.
function findTool(environmentName, command, argumentsList) {
  const configured = process.env[environmentName]
  const candidates = configured
    ? [configured, path.join(configured, process.platform === 'win32' ? `${command}.exe` : command)]
    : [command]
  for (const candidate of candidates) {
    const result = spawnSync(candidate, argumentsList, { encoding: 'utf8' })
    if (result.status === 0) return candidate
  }
  throw new Error(`${command} est introuvable. Installez-le ou définissez ${environmentName}.`)
}

export function findCmake() {
  return findTool('CMAKE_BIN', 'cmake', ['--version'])
}

export function findNinja() {
  return findTool('NINJA_BIN', 'ninja', ['--version'])
}

export function findZig() {
  return findTool('ZIG_BIN', 'zig', ['version'])
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

// Crée un wrapper de compilateur Zig pour une cible CMake.
export async function writeCompilerWrapper(target, zig) {
  const extension = process.platform === 'win32' ? '.cmd' : '.sh'
  const wrapper = path.join(toolchainDirectory, `zig-cxx-${target.folder}${extension}`)
  if (process.platform === 'win32') {
    await writeFile(wrapper, `@echo off\r\n"${zig}" c++ -target ${target.zigTarget} %*\r\n`)
  } else {
    await writeFile(wrapper, `#!/bin/sh\nexec "${zig}" c++ -target ${target.zigTarget} "$@"\n`)
    await chmod(wrapper, 0o755)
  }
  return wrapper
}

// Écrit un fichier toolchain CMake minimal pour la compilation croisée.
export async function writeToolchain(target, wrapper) {
  const toolchain = path.join(toolchainDirectory, `${target.folder}.cmake`)
  const compiler = wrapper.replace(/\\/g, '/')
  await writeFile(toolchain, [
    `set(CMAKE_SYSTEM_NAME ${target.systemName})`,
    `set(CMAKE_SYSTEM_PROCESSOR ${target.processor})`,
    `set(CMAKE_CXX_COMPILER "${compiler}")`,
    'set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)',
    '',
  ].join('\n'))
  return toolchain
}

// Exécute une commande et échoue explicitement avec sa sortie.
function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, { encoding: 'utf8', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} a échoué.\n${result.stderr || result.stdout || ''}`)
  }
  return result
}

// Configure et compile une cible avec CMake + Ninja + Zig.
async function buildTarget(target, cmake, ninja, zig, quiet) {
  const wrapper = await writeCompilerWrapper(target, zig)
  const toolchain = await writeToolchain(target, wrapper)
  const buildDirectory = path.join(cmakeDirectory, target.folder)
  const binaryDirectory = path.join(outputDirectory, target.folder)
  await mkdir(buildDirectory, { recursive: true })
  await mkdir(binaryDirectory, { recursive: true })
  run(cmake, [
    '-G', 'Ninja',
    '-S', sourceDirectory,
    '-B', buildDirectory,
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    `-DCMAKE_MAKE_PROGRAM=${ninja}`,
    '-DCMAKE_BUILD_TYPE=Release',
    `-DCMAKE_RUNTIME_OUTPUT_DIRECTORY=${binaryDirectory}`,
    '-DPRESENCE_BUILD_TESTS=OFF',
  ], { cwd: root })
  run(cmake, ['--build', buildDirectory, '--target', 'discord-presence'], { cwd: root })
  const output = path.join(binaryDirectory, target.name)
  if (!existsSync(output)) {
    throw new Error(`Binaire attendu absent : ${output}`)
  }
  if (!quiet) console.log(`Sidecar Discord : ${target.platform}-${target.arch}`)
  return output
}

// Compile le sidecar pour toutes les plateformes, sans runtime supplémentaire.
export async function buildPresenceBinaries({ force = false, quiet = false } = {}) {
  if (!force && await isUpToDate()) return { ok: true, skipped: true }
  const cmake = findCmake()
  const ninja = findNinja()
  const zig = findZig()
  await mkdir(outputDirectory, { recursive: true })
  await mkdir(cmakeDirectory, { recursive: true })
  await mkdir(toolchainDirectory, { recursive: true })
  for (const target of targets) {
    await buildTarget(target, cmake, ninja, zig, quiet)
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
