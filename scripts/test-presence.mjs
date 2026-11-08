import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findCmake, findNinja, findZig, targets, writeCompilerWrapper, writeToolchain } from './build-presence.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(root, 'native', 'discord-presence')
const outputDirectory = path.join(root, 'build', 'presence', 'tests')
const buildDirectory = path.join(outputDirectory, 'cmake')
const binaryDirectory = path.join(outputDirectory, 'bin')
const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
const hostTarget = targets.find((entry) => entry.platform === platform && entry.arch === arch)

// Lance une commande et propage sa sortie.
function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { stdio: 'inherit', cwd: root })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const cmake = findCmake()
const ninja = findNinja()
await rm(buildDirectory, { recursive: true, force: true })
await mkdir(buildDirectory, { recursive: true })
await mkdir(binaryDirectory, { recursive: true })

const argumentsList = [
  '-G', 'Ninja',
  '-S', sourceDirectory,
  '-B', buildDirectory,
  '-DCMAKE_BUILD_TYPE=Release',
  '-DPRESENCE_BUILD_TESTS=ON',
  `-DCMAKE_RUNTIME_OUTPUT_DIRECTORY=${binaryDirectory}`,
  `-DCMAKE_MAKE_PROGRAM=${ninja}`,
]

// Sous Windows, réutilise le wrapper Zig pour compiler les tests avec le même C++20.
if (process.platform === 'win32') {
  const zig = findZig()
  const wrapper = await writeCompilerWrapper(hostTarget, zig)
  const toolchain = await writeToolchain(hostTarget, wrapper)
  argumentsList.push(`-DCMAKE_TOOLCHAIN_FILE=${toolchain}`)
} else if (process.env.CXX) {
  argumentsList.push(`-DCMAKE_CXX_COMPILER=${process.env.CXX}`)
}

run(cmake, argumentsList)
run(cmake, ['--build', buildDirectory, '--target', 'presence_tests'])

const executable = path.join(binaryDirectory, process.platform === 'win32' ? 'presence_tests.exe' : 'presence_tests')
if (!existsSync(executable)) throw new Error(`Tests C++ absents : ${executable}`)
run(executable, [])
