import test from 'node:test'
import assert from 'node:assert/strict'
import {
  writeWorkspaceDocument, writeWorkspaceDocumentWithBackup, readWorkspaceFolder, workspaceDocumentNameIn,
  storeWorkspaceImage, readWorkspaceImage, exportWorkspaceArchive, writeRecoveryFile, readRecoveryFile, clearRecoveryFile,
  workspaceDocumentName,
} from '../../src/services/workspaceFiles.js'
import { readWorkspaceZip } from '../../src/utils/workspaceArchive.js'

const folder = 'C:\\workspace\\Projet'
const documentPath = `${folder}/workspace.sp3`

// Calcule la taille d'un contenu texte ou binaire.
function sizeOf(value) {
  return typeof value === 'string' ? new TextEncoder().encode(value).length : value.byteLength
}

// Simule un système de fichiers en mémoire avec les seules méthodes utilisées par le service.
// Les options `failures` injectent les pannes réelles de Neutralinojs sans toucher aux données.
function createFilesystem({ files: initialFiles = {}, directories: initialDirectories = [folder] } = {}, failures = {}) {
  const files = new Map()
  for (const [path, value] of Object.entries(initialFiles)) {
    files.set(path, typeof value === 'string' ? value : new Uint8Array(value))
  }
  const directories = new Set(initialDirectories)
  const calls = []
  return {
    files,
    directories,
    calls,
    async writeFile(target, data) {
      calls.push(['writeFile', target, data])
      if (failures.writeFile) throw Object.assign(new Error('write failed'), { code: 'NE_FS_FILWRER' })
      files.set(target, data)
    },
    async writeBinaryFile(target, data) {
      calls.push(['writeBinaryFile', target])
      if (failures.writeBinaryFile) throw Object.assign(new Error('write failed'), { code: 'NE_FS_FILWRER' })
      files.set(target, new Uint8Array(data))
    },
    async readFile(target) {
      calls.push(['readFile', target])
      if (failures.readFile) throw Object.assign(new Error('read failed'), { code: 'NE_FS_FILRDERR' })
      if (!files.has(target)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      return files.get(target)
    },
    async readBinaryFile(target) {
      calls.push(['readBinaryFile', target])
      if (!files.has(target)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      const value = files.get(target)
      return value instanceof Uint8Array ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : new TextEncoder().encode(value).buffer
    },
    async getStats(target) {
      calls.push(['getStats', target])
      if (files.has(target)) return { isFile: true, isDirectory: false, size: failures.corruptSize ? 0 : sizeOf(files.get(target)) }
      if (directories.has(target)) return { isFile: false, isDirectory: true, size: 0 }
      throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
    },
    async readDirectory(target) {
      calls.push(['readDirectory', target])
      if (failures.readDirectory) throw Object.assign(new Error('read failed'), { code: 'NE_FS_FILRDERR' })
      if (!directories.has(target)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      const prefix = `${target.replace(/[\\/]+$/, '')}/`
      const entries = new Map()
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue
        const rest = path.slice(prefix.length)
        const slash = rest.indexOf('/')
        const name = slash === -1 ? rest : rest.slice(0, slash)
        entries.set(name, { entry: name, path: `${prefix}${name}`, type: slash === -1 ? 'FILE' : 'DIRECTORY' })
      }
      for (const path of directories) {
        if (!path.startsWith(prefix)) continue
        const rest = path.slice(prefix.length)
        if (!rest || rest.includes('/')) continue
        entries.set(rest, { entry: rest, path, type: 'DIRECTORY' })
      }
      return [...entries.values()]
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
      if (failures.remove || failures.removePaths?.has(target)) throw Object.assign(new Error('remove failed'), { code: 'NE_FS_REMVERR' })
      if (!files.has(target) && !directories.has(target)) throw Object.assign(new Error('missing'), { code: 'NE_FS_NOPATHE' })
      files.delete(target)
      directories.delete(target)
    },
    async createDirectory(target) {
      calls.push(['createDirectory', target])
      directories.add(target)
    },
  }
}

// Regroupe le client natif minimal attendu par le service.
function createClient(filesystem, overrides = {}) {
  return {
    filesystem,
    os: {
      async showFolderDialog() { return folder },
      async showSaveDialog() { return 'C:\\sortie\\workspace.zip' },
      async showOpenDialog() { return [] },
      async showMessageBox() { return 'YES' },
      async getPath(name) { return name === 'data' ? 'C:\\Users\\me\\Data' : '' },
      ...overrides,
    },
  }
}

// Retourne le premier chemin temporaire écrit, pour vérifier sa forme et son sort.
function temporaryPathOf(filesystem) {
  return filesystem.calls.find(([name]) => name === 'writeFile')?.[1]
}

test('écrit le document interne dans un brouillon puis le renomme', async () => {
  const filesystem = createFilesystem()
  const result = await writeWorkspaceDocument(folder, 'contenu', createClient(filesystem))
  assert.equal(result, folder)
  assert.equal(filesystem.files.get(documentPath), 'contenu')
  assert.ok(filesystem.directories.has(`${folder}/images`))
  assert.ok(filesystem.directories.has(`${folder}/backups`))
  const temporaryPath = temporaryPathOf(filesystem)
  assert.ok(temporaryPath.startsWith(`${documentPath}.`))
  assert.ok(temporaryPath.endsWith('.tmp'))
  assert.deepEqual(filesystem.calls.filter(([name]) => name === 'move'), [['move', temporaryPath, documentPath]])
})

test('un échec d’écriture du brouillon conserve l’original intact', async () => {
  const filesystem = createFilesystem({ files: { [documentPath]: 'ancien' } }, { writeFile: true })
  await assert.rejects(writeWorkspaceDocument(folder, 'nouveau', createClient(filesystem)), (error) => error.code === 'WRITE_FAILED')
  assert.equal(filesystem.files.get(documentPath), 'ancien')
  assert.equal(filesystem.files.size, 1)
  assert.equal(filesystem.calls.some(([name]) => name === 'move'), false)
})

test('un échec de remplacement conserve l’original et le brouillon vérifié', async () => {
  const filesystem = createFilesystem({ files: { [documentPath]: 'ancien' } }, { move: true })
  let failure
  try {
    await writeWorkspaceDocument(folder, 'nouveau', createClient(filesystem))
  } catch (error) {
    failure = error
  }
  const temporaryPath = temporaryPathOf(filesystem)
  assert.equal(failure?.code, 'ATOMIC_REPLACE_FAILED')
  assert.equal(failure.values.temporaryPath, temporaryPath)
  assert.equal(filesystem.files.get(documentPath), 'ancien')
  assert.equal(filesystem.files.get(temporaryPath), 'nouveau')
})

test('refuse un document au-delà de la taille maximale', async () => {
  const filesystem = createFilesystem()
  const text = 'x'.repeat(20 * 1024 * 1024 + 1)
  await assert.rejects(writeWorkspaceDocument(folder, text, createClient(filesystem)), (error) => error.code === 'FILE_TOO_LARGE')
  assert.equal(filesystem.files.size, 0)
})

test('exige l’application desktop sans client fourni', async () => {
  await assert.rejects(writeWorkspaceDocument(folder, 'contenu'), (error) => error.code === 'DESKTOP_REQUIRED')
})

test('relit le document interne ou l’unique ancien .sp3 du dossier', async () => {
  const filesystem = createFilesystem({ files: { [documentPath]: 'contenu' } })
  assert.deepEqual(await readWorkspaceFolder(folder, createClient(filesystem)), { folder, documentName: workspaceDocumentName, text: 'contenu' })

  const legacy = createFilesystem({ files: { [`${folder}/note.sp3`]: 'ancien' } })
  assert.deepEqual(await readWorkspaceFolder(folder, createClient(legacy)), { folder, documentName: 'note.sp3', text: 'ancien' })
  assert.equal(await workspaceDocumentNameIn(folder, createClient(legacy)), 'note.sp3')
})

test('refuse un dossier qui ne contient aucun workspace', async () => {
  const filesystem = createFilesystem()
  await assert.rejects(readWorkspaceFolder(folder, createClient(filesystem)), (error) => error.code === 'WORKSPACE_NOT_FOUND')
  assert.equal(await workspaceDocumentNameIn(folder, createClient(filesystem)), null)
})

test('sauvegardes de secours : trois versions précédentes tournent dans backups/', async () => {
  const filesystem = createFilesystem()
  const client = createClient(filesystem)
  const backup = (generation) => `${folder}/backups/workspace.backup-${generation}.sp3`
  const first = await writeWorkspaceDocumentWithBackup(folder, 'v1', client)
  assert.equal(first.folder, folder)
  assert.equal(first.backupError, null)
  assert.equal(filesystem.files.has(backup(1)), false, 'aucune sauvegarde pour un document neuf')

  await writeWorkspaceDocumentWithBackup(folder, 'v2', client)
  assert.equal(filesystem.files.get(backup(1)), 'v1')

  await writeWorkspaceDocumentWithBackup(folder, 'v3', client)
  assert.equal(filesystem.files.get(backup(1)), 'v2')
  assert.equal(filesystem.files.get(backup(2)), 'v1')

  await writeWorkspaceDocumentWithBackup(folder, 'v4', client)
  assert.equal(filesystem.files.get(backup(1)), 'v3')
  assert.equal(filesystem.files.get(backup(2)), 'v2')
  assert.equal(filesystem.files.get(backup(3)), 'v1')

  await writeWorkspaceDocumentWithBackup(folder, 'v5', client)
  assert.equal(filesystem.files.get(documentPath), 'v5')
  assert.equal(filesystem.files.get(backup(1)), 'v4')
  assert.equal(filesystem.files.get(backup(2)), 'v3')
  assert.equal(filesystem.files.get(backup(3)), 'v2')
  assert.equal(filesystem.files.has(backup(4)), false)
})

test('sauvegardes de secours : un échec de copie laisse l’enregistrement réussir', async () => {
  const filesystem = createFilesystem({ files: { [documentPath]: 'ancien' } }, { readFile: true })
  const saved = await writeWorkspaceDocumentWithBackup(folder, 'nouveau', createClient(filesystem))
  assert.equal(saved.folder, folder)
  assert.equal(saved.backupError?.code, 'NE_FS_FILRDERR')
  assert.equal(filesystem.files.get(documentPath), 'nouveau')
})

test('sauvegardes de secours : un échec de suppression n’annule pas l’enregistrement', async () => {
  const filesystem = createFilesystem({ files: { [documentPath]: 'ancien', [`${folder}/backups/workspace.backup-3.sp3`]: 'old' } }, { remove: true })
  const saved = await writeWorkspaceDocumentWithBackup(folder, 'nouveau', createClient(filesystem))
  assert.equal(saved.folder, folder)
  assert.equal(saved.backupError?.code, 'NE_FS_REMVERR')
  assert.equal(filesystem.files.get(documentPath), 'nouveau')
})

test('récupération : un fichier .tmp résiduel n’empêche pas la suppression complète', async () => {
  const recovery = 'C:\\Users\\me\\Data/sapphire3-recovery'
  const filesystem = createFilesystem({
    files: {
      [`${recovery}/workspace.sp3`]: 'ancien',
      [`${recovery}/workspace.sp3.abc.tmp`]: 'brouillon',
      [`${recovery}/images/photo.png`]: new Uint8Array([1]),
      [`${recovery}/backups/workspace.backup-1.sp3`]: 'backup',
    },
    directories: [recovery, `${recovery}/images`, `${recovery}/backups`],
  })
  await clearRecoveryFile(createClient(filesystem))
  assert.equal(filesystem.files.size, 0)
  assert.equal(filesystem.directories.has(recovery), false)
  assert.equal(filesystem.directories.has(`${recovery}/images`), false)
  assert.equal(filesystem.directories.has(`${recovery}/backups`), false)
})

test('récupération : un fichier verrouillé laisse le document de récupération supprimé', async () => {
  const recovery = 'C:\\Users\\me\\Data/sapphire3-recovery'
  const locked = `${recovery}/workspace.sp3.locked.tmp`
  const filesystem = createFilesystem({
    files: { [`${recovery}/workspace.sp3`]: 'ancien', [locked]: 'brouillon' },
    directories: [recovery],
  }, { removePaths: new Set([locked]) })
  await assert.rejects(clearRecoveryFile(createClient(filesystem)), (error) => error.code === 'NE_FS_REMVERR')
  assert.equal(filesystem.files.has(`${recovery}/workspace.sp3`), false)
  assert.equal(filesystem.files.has(locked), true)
})

test('images : copie dans images/ avec un nom unique et relit les octets', async () => {
  const filesystem = createFilesystem()
  const client = createClient(filesystem)
  const first = await storeWorkspaceImage(folder, 'black hole.png', new Uint8Array([1, 2, 3]), client)
  assert.equal(first, 'images/black-hole.png')
  const second = await storeWorkspaceImage(folder, 'black hole.png', new Uint8Array([4, 5]), client)
  assert.equal(second, 'images/black-hole-2.png')
  assert.deepEqual([...filesystem.files.get(`${folder}/images/black-hole.png`)], [1, 2, 3])
  const image = await readWorkspaceImage(folder, first, client)
  assert.equal(image.mimeType, 'image/png')
  assert.deepEqual([...new Uint8Array(image.bytes)], [1, 2, 3])
})

test('images : refuse une référence hors de images/ ou un fichier absent', async () => {
  const filesystem = createFilesystem()
  const client = createClient(filesystem)
  await assert.rejects(readWorkspaceImage(folder, '../secret.png', client), (error) => error.code === 'IMAGE_REFERENCE_INVALID')
  await assert.rejects(readWorkspaceImage(folder, 'images/absent.png', client), (error) => error.code === 'NE_FS_NOPATHE')
})

test('archive : exporte le document interne et les images dans un ZIP relisible', async () => {
  const filesystem = createFilesystem()
  const client = createClient(filesystem)
  const entries = [
    { name: 'workspace.sp3', data: new TextEncoder().encode('{"application":"Sapphire 3"}') },
    { name: 'images/blackhole.png', data: new Uint8Array([9, 8, 7]) },
  ]
  const path = await exportWorkspaceArchive(entries, 'en', 'projet.zip', client)
  assert.equal(path, 'C:\\sortie\\workspace.zip')
  const written = filesystem.files.get(path)
  const read = readWorkspaceZip(written)
  assert.deepEqual(read.map((entry) => entry.name), ['workspace.sp3', 'images/blackhole.png'])
  assert.equal(new TextDecoder().decode(read[0].data), '{"application":"Sapphire 3"}')
  assert.deepEqual([...read[1].data], [9, 8, 7])
})

test('récupération : écrit puis efface un dossier de récupération complet', async () => {
  const filesystem = createFilesystem()
  const client = createClient(filesystem)
  const target = await writeRecoveryFile('contenu', client)
  assert.equal(target, 'C:\\Users\\me\\Data/sapphire3-recovery')
  assert.equal(filesystem.files.get('C:\\Users\\me\\Data/sapphire3-recovery/workspace.sp3'), 'contenu')
  assert.deepEqual(await readRecoveryFile(client), { path: 'C:\\Users\\me\\Data/sapphire3-recovery/workspace.sp3', text: 'contenu' })
  await clearRecoveryFile(client)
  assert.equal(filesystem.files.has('C:\\Users\\me\\Data/sapphire3-recovery/workspace.sp3'), false)
  assert.equal(await readRecoveryFile(client), null)
})

test('une copie de récupération absente est un état normal', async () => {
  const filesystem = createFilesystem()
  assert.equal(await readRecoveryFile(createClient(filesystem)), null)
})
