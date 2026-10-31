import test from 'node:test'
import assert from 'node:assert/strict'
import { writeWorkspaceFile } from '../../src/services/workspaceFiles.js'

const path = 'C:\\workspace\\note.sp3'

// Simule un système de fichiers en mémoire avec les seules méthodes utilisées par le service.
// Les options `failures` injectent les pannes réelles de Neutralinojs sans toucher aux données.
function createFilesystem(initialFiles = {}, failures = {}) {
  const files = new Map(Object.entries(initialFiles))
  const calls = []
  return {
    files,
    calls,
    async writeFile(target, data) {
      calls.push(['writeFile', target, data])
      if (failures.writeFile) throw Object.assign(new Error('write failed'), { code: 'NE_FS_FILWRER' })
      files.set(target, data)
    },
    async readFile(target) {
      calls.push(['readFile', target])
      if (!files.has(target)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      return files.get(target)
    },
    async getStats(target) {
      calls.push(['getStats', target])
      if (!files.has(target)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      const data = files.get(target)
      return { isFile: true, isDirectory: false, size: failures.corruptSize ? 0 : new TextEncoder().encode(data).length }
    },
    async move(source, destination) {
      calls.push(['move', source, destination])
      if (failures.move) throw Object.assign(new Error('move failed'), { code: 'NE_FS_MOVEERR' })
      if (!files.has(source)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      files.set(destination, files.get(source))
      files.delete(source)
    },
    async remove(target) {
      calls.push(['remove', target])
      if (failures.remove) throw Object.assign(new Error('remove failed'), { code: 'NE_FS_REMVERR' })
      files.delete(target)
    },
  }
}

// Regroupe le client minimal attendu par writeWorkspaceFile.
function createClient(filesystem, extension = 'sp3') {
  return { extension, filesystem }
}

// Retourne le premier chemin temporaire écrit, pour vérifier sa forme et son sort.
function temporaryPathOf(filesystem) {
  return filesystem.calls.find(([name]) => name === 'writeFile')?.[1]
}

test('écrit un fichier neuf dans un brouillon puis le renomme', async () => {
  const filesystem = createFilesystem()
  const result = await writeWorkspaceFile(path, 'contenu', createClient(filesystem))
  assert.equal(result, path)
  assert.equal(filesystem.files.get(path), 'contenu')
  const temporaryPath = temporaryPathOf(filesystem)
  assert.ok(temporaryPath.startsWith(`${path}.`))
  assert.ok(temporaryPath.endsWith('.tmp'))
  assert.deepEqual(filesystem.calls.filter(([name]) => name === 'move'), [['move', temporaryPath, path]])
  assert.equal(filesystem.calls.some(([name]) => name === 'readFile'), false)
})

test('remplace l’original uniquement par move, jamais par réécriture directe', async () => {
  const filesystem = createFilesystem({ [path]: 'ancien' })
  await writeWorkspaceFile(path, 'nouveau', createClient(filesystem))
  assert.equal(filesystem.files.get(path), 'nouveau')
  const writes = filesystem.calls.filter(([name]) => name === 'writeFile')
  assert.equal(writes.length, 1)
  assert.notEqual(writes[0][1], path)
  assert.equal(filesystem.calls.some(([name]) => name === 'readFile'), false)
})

test('le brouillon porte un nom unique à chaque écriture', async () => {
  const filesystem = createFilesystem()
  await writeWorkspaceFile(path, 'premier', createClient(filesystem))
  await writeWorkspaceFile(path, 'second', createClient(filesystem))
  const [first, second] = filesystem.calls.filter(([name]) => name === 'writeFile').map(([, target]) => target)
  assert.notEqual(first, second)
  assert.notEqual(first, `${path}.tmp.$$`)
  assert.ok(first.startsWith(`${path}.`) && second.startsWith(`${path}.`))
})

test('un échec d’écriture du brouillon conserve l’original intact', async () => {
  const filesystem = createFilesystem({ [path]: 'ancien' }, { writeFile: true })
  await assert.rejects(writeWorkspaceFile(path, 'nouveau', createClient(filesystem)), (error) => error.code === 'WRITE_FAILED')
  assert.equal(filesystem.files.get(path), 'ancien')
  assert.equal(filesystem.files.size, 1)
  assert.equal(filesystem.calls.some(([name]) => name === 'move'), false)
})

test('une écriture partielle est détectée et le brouillon est nettoyé', async () => {
  const filesystem = createFilesystem({ [path]: 'ancien' }, { corruptSize: true })
  await assert.rejects(writeWorkspaceFile(path, 'nouveau', createClient(filesystem)), (error) => error.code === 'WRITE_FAILED')
  assert.equal(filesystem.files.get(path), 'ancien')
  assert.equal(filesystem.files.size, 1)
  assert.equal(filesystem.calls.some(([name]) => name === 'move'), false)
})

test('un échec de remplacement conserve l’original et le brouillon vérifié', async () => {
  const filesystem = createFilesystem({ [path]: 'ancien' }, { move: true })
  let failure
  try {
    await writeWorkspaceFile(path, 'nouveau', createClient(filesystem))
  } catch (error) {
    failure = error
  }
  const temporaryPath = temporaryPathOf(filesystem)
  assert.equal(failure?.code, 'ATOMIC_REPLACE_FAILED')
  assert.equal(failure.values.temporaryPath, temporaryPath)
  assert.equal(filesystem.files.get(path), 'ancien')
  assert.equal(filesystem.files.get(temporaryPath), 'nouveau')
  assert.equal(filesystem.calls.some(([name]) => name === 'readFile'), false)
})

test('un nettoyage impossible ne masque pas l’échec d’écriture initial', async () => {
  const filesystem = createFilesystem({ [path]: 'ancien' }, { corruptSize: true, remove: true })
  await assert.rejects(writeWorkspaceFile(path, 'nouveau', createClient(filesystem)), (error) => error.code === 'WRITE_FAILED')
  assert.equal(filesystem.files.get(path), 'ancien')
})

test('la vérification compare les octets UTF-8, pas les caractères', async () => {
  const filesystem = createFilesystem()
  const text = 'éàü 🚀'
  await writeWorkspaceFile(path, text, createClient(filesystem))
  assert.equal(filesystem.files.get(path), text)
})

test('refuse une extension étrangère au client', async () => {
  const filesystem = createFilesystem()
  await assert.rejects(writeWorkspaceFile('C:\\workspace\\note.txt', 'contenu', createClient(filesystem)), (error) => error.code === 'FILE_EXTENSION_INVALID')
  assert.equal(filesystem.files.size, 0)
})

test('refuse un fichier au-delà de la taille maximale', async () => {
  const filesystem = createFilesystem()
  const text = 'x'.repeat(20 * 1024 * 1024 + 1)
  await assert.rejects(writeWorkspaceFile(path, text, createClient(filesystem)), (error) => error.code === 'FILE_TOO_LARGE')
  assert.equal(filesystem.files.size, 0)
})

test('exige l’application desktop sans client fourni', async () => {
  await assert.rejects(writeWorkspaceFile(path, 'contenu'), (error) => error.code === 'DESKTOP_REQUIRED')
})
