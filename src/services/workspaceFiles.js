import { translate } from '../utils/translations.js'
import { transpilationLanguages } from '../utils/transpilation/languages.js'
import { buildWorkspaceZip } from '../utils/workspaceArchive.js'
import { isImageReference, imageMimeType } from '../utils/embeddedImage.js'

let clientPromise
const maximumFileSize = 20 * 1024 * 1024
const maximumArchiveSize = 512 * 1024 * 1024
const archiveChunkSize = 4 * 1024 * 1024
export const workspaceDocumentName = 'workspace.sp3'
export const workspaceImagesFolder = 'images'
export const workspaceBackupsFolder = 'backups'
const exportFormats = Object.freeze({ zip: 'files.zipFilter', json: 'files.jsonFilter', svg: 'files.svgFilter', png: 'files.pngFilter', ...Object.fromEntries(transpilationLanguages.filter((option) => option.available).map((option) => [option.extension, option.filterKey])) })

// Transporte un code et ses paramètres sans lier les accès natifs à React ou à une langue globale.
function fileError(code, values = {}) {
  return Object.assign(new Error(code), { code, values })
}

// Initialise uniquement le client natif local, au premier accès depuis la fenêtre desktop.
async function getClient() {
  if (typeof window === 'undefined' || typeof window.NL_TOKEN !== 'string' || !window.NL_PORT) throw fileError('DESKTOP_REQUIRED')
  if (!clientPromise) {
    clientPromise = import('@neutralinojs/lib').then((client) => {
      client.init()
      return client
    })
  }
  return clientPromise
}

// Joint un chemin de dossier et des segments relatifs avec des barres obliques stables.
function folderJoin(folder, ...parts) {
  return [String(folder).replace(/[\\/]+$/, ''), ...parts].join('/')
}

// Construit un chemin temporaire unique dans le dossier du fichier pour ne jamais écraser un brouillon existant.
function temporaryPathFor(path) {
  return `${path}.${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.tmp`
}

// Supprime un brouillon sans masquer l'échec initial ; un résidu reste récupérable et ne touche pas l'original.
async function removeTemporaryFile(filesystem, path) {
  try {
    await filesystem.remove(path)
  } catch {
    // Le nettoyage échoué ne doit pas transformer un échec d'écriture en erreur différente.
  }
}

// Écrit dans un brouillon du même dossier, le vérifie, puis le renomme sur l'original avec filesystem.move.
// Neutralinojs 6.10 ne fournit ni rename ni deleteFile ; move utilise std::filesystem::rename et remplace
// la destination existante sous Windows comme sous POSIX. En cas d'échec du remplacement, l'original reste
// intact et le brouillon vérifié est conservé pour récupération manuelle.
async function atomicWriteFile(filesystem, path, text) {
  const temporaryPath = temporaryPathFor(path)
  const expectedSize = new TextEncoder().encode(text).length
  try {
    await filesystem.writeFile(temporaryPath, text)
    const stats = await filesystem.getStats(temporaryPath)
    if (!stats?.isFile || stats.size !== expectedSize) {
      await removeTemporaryFile(filesystem, temporaryPath)
      return { ok: false, code: 'WRITE_FAILED' }
    }
  } catch {
    await removeTemporaryFile(filesystem, temporaryPath)
    return { ok: false, code: 'WRITE_FAILED' }
  }
  try {
    await filesystem.move(temporaryPath, path)
  } catch {
    return { ok: false, code: 'ATOMIC_REPLACE_FAILED', values: { temporaryPath } }
  }
  return { ok: true, path }
}

// Crée les sous-dossiers d'un workspace sans échouer s'ils existent déjà.
async function ensureWorkspaceFolders(filesystem, folder) {
  for (const name of [workspaceImagesFolder, workspaceBackupsFolder]) {
    try {
      await filesystem.createDirectory(folderJoin(folder, name))
    } catch {
      // Le dossier existe déjà ou sera signalé par l'écriture suivante.
    }
  }
}

// Retrouve le document interne du dossier : `workspace.sp3`, ou l'unique `.sp3` d'un ancien dossier.
async function findWorkspaceDocument(filesystem, folder) {
  const direct = folderJoin(folder, workspaceDocumentName)
  try {
    const info = await filesystem.getStats(direct)
    if (info?.isFile) return workspaceDocumentName
  } catch (error) {
    if (error?.code !== 'NE_FS_NOPATHE') throw error
  }
  let entries = []
  try {
    entries = await filesystem.readDirectory(folder)
  } catch {
    entries = []
  }
  const documents = (Array.isArray(entries) ? entries : []).filter((entry) => {
    const name = entry?.entry ?? entry?.name ?? ''
    return typeof name === 'string' && /\.sp3$/i.test(name) && (entry.type === 'FILE' || entry.type === 'file' || entry.isFile === true)
  })
  if (documents.length === 1) return documents[0].entry ?? documents[0].name
  throw fileError('WORKSPACE_NOT_FOUND')
}

// Indique le nom du document interne du dossier, ou null s'il n'y en a pas.
export async function workspaceDocumentNameIn(folder, client = null) {
  try {
    const { filesystem } = client || await getClient()
    return await findWorkspaceDocument(filesystem, folder)
  } catch (error) {
    if (error?.code === 'WORKSPACE_NOT_FOUND' || error?.code === 'DESKTOP_REQUIRED') return null
    throw error
  }
}

// Ouvre le dossier choisi par l'utilisateur et relit son document interne.
export async function openWorkspaceFolder(language = 'en', client = null) {
  const folder = await chooseWorkspaceFolder(language, client)
  if (!folder) return null
  return readWorkspaceFolder(folder, client)
}

// Demande à l'utilisateur de choisir un dossier de workspace.
export async function chooseWorkspaceFolder(language = 'en', client = null) {
  const { os } = client || await getClient()
  const folder = await os.showFolderDialog(translate(language, 'files.openTitle'))
  return folder || null
}

// Relit un workspace depuis son dossier sans second dialogue de sélection.
export async function readWorkspaceFolder(folder, client = null) {
  if (typeof folder !== 'string' || folder.length === 0) throw fileError('WORKSPACE_FOLDER_REQUIRED')
  const { filesystem } = client || await getClient()
  const documentName = await findWorkspaceDocument(filesystem, folder)
  const documentPath = folderJoin(folder, documentName)
  const info = await filesystem.getStats(documentPath)
  if (!info?.isFile || info.size > maximumFileSize) throw fileError('FILE_INVALID')
  return { folder, documentName, text: await filesystem.readFile(documentPath) }
}

// Écrit le document interne du workspace, en créant les dossiers nécessaires.
export async function writeWorkspaceDocument(folder, text, client = null, documentName = workspaceDocumentName) {
  if (typeof folder !== 'string' || folder.length === 0) throw fileError('WORKSPACE_FOLDER_REQUIRED')
  if (new TextEncoder().encode(text).length > maximumFileSize) throw fileError('FILE_TOO_LARGE')
  const { filesystem } = client || await getClient()
  await ensureWorkspaceFolders(filesystem, folder)
  const writeResult = await atomicWriteFile(filesystem, folderJoin(folder, documentName), text)
  if (!writeResult.ok) throw fileError(writeResult.code, writeResult.values)
  return folder
}

const backupGenerations = 3

// Construit le chemin d'une génération de sauvegarde dans le sous-dossier `backups/`.
function backupPath(folder, generation) {
  return folderJoin(folder, workspaceBackupsFolder, `workspace.backup-${generation}.sp3`)
}

// Ignore seulement l'absence d'un fichier pendant la rotation des sauvegardes.
async function removeIfPresent(filesystem, target) {
  try {
    await filesystem.getStats(target)
  } catch {
    return
  }
  await filesystem.remove(target)
}

// Déplace une génération existante ; une génération absente n'interrompt pas la rotation.
async function moveIfPresent(filesystem, source, destination) {
  try {
    await filesystem.getStats(source)
  } catch {
    return
  }
  await filesystem.move(source, destination)
}

// Fait tourner jusqu'à trois copies du document précédent, sans jamais bloquer l'écriture du fichier courant.
async function createBackup(filesystem, folder, documentName) {
  const documentPath = folderJoin(folder, documentName)
  let info
  try {
    info = await filesystem.getStats(documentPath)
  } catch (error) {
    return error?.code === 'NE_FS_NOPATHE' ? null : error
  }
  if (!info?.isFile || info.size > maximumFileSize) return null
  try {
    const text = await filesystem.readFile(documentPath)
    await removeIfPresent(filesystem, backupPath(folder, backupGenerations))
    for (let generation = backupGenerations - 1; generation >= 1; generation -= 1) {
      await moveIfPresent(filesystem, backupPath(folder, generation), backupPath(folder, generation + 1))
    }
    const result = await atomicWriteFile(filesystem, backupPath(folder, 1), text)
    return result.ok ? null : fileError(result.code, result.values)
  } catch (error) {
    return error?.code ? error : fileError('BACKUP_FAILED')
  }
}

// Écrit le document interne en conservant le contenu précédent ; une sauvegarde impossible n'annule pas l'enregistrement.
export async function writeWorkspaceDocumentWithBackup(folder, text, client = null, documentName = workspaceDocumentName) {
  if (typeof folder !== 'string' || folder.length === 0) throw fileError('WORKSPACE_FOLDER_REQUIRED')
  if (new TextEncoder().encode(text).length > maximumFileSize) throw fileError('FILE_TOO_LARGE')
  const target = client || await getClient()
  await ensureWorkspaceFolders(target.filesystem, folder)
  const backupError = await createBackup(target.filesystem, folder, documentName)
  const written = await writeWorkspaceDocument(folder, text, target, documentName)
  return { folder: written, backupError }
}

// Demande une confirmation native avant de remplacer un workspace déjà présent dans le dossier choisi.
export async function confirmWorkspaceReplace(language = 'en', client = null) {
  const { os } = client || await getClient()
  return await os.showMessageBox(translate(language, 'files.replaceWorkspaceTitle'), translate(language, 'files.replaceWorkspaceBody'), 'YES_NO', 'WARNING') === 'YES'
}

// Produit un nom de fichier d'image sûr, avec une extension d'image connue.
function safeImageName(fileName) {
  const base = String(fileName ?? '').replace(/^.*[\\/]/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '')
  const name = base.length > 0 ? base : 'image'
  return /\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)$/i.test(name) ? name.slice(0, 120) : `${name.slice(0, 116)}.png`
}

// Copie une image dans le sous-dossier `images/` et renvoie sa référence relative unique.
export async function storeWorkspaceImage(folder, fileName, bytes, client = null) {
  if (typeof folder !== 'string' || folder.length === 0) throw fileError('WORKSPACE_FOLDER_REQUIRED')
  const data = bytes instanceof Uint8Array ? bytes : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null
  if (!data || data.length === 0) throw fileError('IMAGE_INVALID')
  if (data.length > maximumFileSize) throw fileError('FILE_TOO_LARGE')
  const { filesystem } = client || await getClient()
  await ensureWorkspaceFolders(filesystem, folder)
  const base = safeImageName(fileName)
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const extension = dot > 0 ? base.slice(dot) : ''
  for (let attempt = 1; attempt <= 999; attempt += 1) {
    const name = attempt === 1 ? `${stem}${extension}` : `${stem}-${attempt}${extension}`
    const target = folderJoin(folder, workspaceImagesFolder, name)
    try {
      await filesystem.getStats(target)
      continue
    } catch (error) {
      if (error?.code !== 'NE_FS_NOPATHE') throw error
    }
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    await filesystem.writeBinaryFile(target, buffer)
    return `${workspaceImagesFolder}/${name}`
  }
  throw fileError('IMAGE_NAME_CONFLICT')
}

// Relit une image liée, en refusant tout chemin hors du sous-dossier `images/`.
export async function readWorkspaceImage(folder, reference, client = null) {
  if (!isImageReference(reference)) throw fileError('IMAGE_REFERENCE_INVALID')
  if (typeof folder !== 'string' || folder.length === 0) throw fileError('WORKSPACE_FOLDER_REQUIRED')
  const { filesystem } = client || await getClient()
  const target = folderJoin(folder, ...reference.split('/'))
  const info = await filesystem.getStats(target)
  if (!info?.isFile || info.size > maximumFileSize) throw fileError('IMAGE_INVALID')
  return { bytes: await filesystem.readBinaryFile(target), mimeType: imageMimeType(reference) }
}

// Enregistre un texte au chemin choisi, avec extension garantie et confirmation d'écrasement.
export async function exportWorkspaceFile(extension, text, language = 'en', defaultName = null, client = null) {
  if (!Object.hasOwn(exportFormats, extension)) throw fileError('EXPORT_FORMAT_INVALID')
  if (new TextEncoder().encode(text).length > maximumFileSize) throw fileError('FILE_TOO_LARGE')
  const { os, filesystem } = await getClient()
  const filterKey = exportFormats[extension]
  let path = await os.showSaveDialog(translate(language, 'files.exportTitle'), { defaultPath: defaultName || `workspace.${extension}`, filters: [{ name: translate(language, filterKey), extensions: [extension] }] })
  if (!path) return null
  if (!path.toLowerCase().endsWith(`.${extension}`)) path += `.${extension}`
  let exists = false
  try {
    const info = await filesystem.getStats(path)
    if (info.isDirectory) throw fileError('FILE_REQUIRED')
    exists = true
  } catch (error) {
    if (error.code !== 'NE_FS_NOPATHE') throw error
  }
  if (exists && await os.showMessageBox(translate(language, 'files.replaceTitle'), translate(language, 'files.replaceBody'), 'YES_NO', 'WARNING') !== 'YES') return null
  const writeResult = await atomicWriteFile(filesystem, path, text)
  if (!writeResult.ok) throw fileError(writeResult.code, writeResult.values)
  return writeResult.path
}

// Enregistre un contenu binaire (image, archive) au chemin choisi, avec confirmation d'écrasement.
// Une archive ZIP est écrite par blocs pour ne pas dépendre de la taille d'un message natif.
export async function exportBinaryFile(extension, bytes, language = 'en', defaultName = null, client = null) {
  if (!Object.hasOwn(exportFormats, extension)) throw fileError('EXPORT_FORMAT_INVALID')
  if (!(bytes instanceof ArrayBuffer) && !(bytes instanceof Uint8Array)) throw fileError('EXPORT_FORMAT_INVALID')
  const size = bytes.byteLength ?? bytes.length
  if (size > (extension === 'zip' ? maximumArchiveSize : maximumFileSize)) throw fileError('FILE_TOO_LARGE')
  const { os, filesystem } = client || await getClient()
  const filterKey = exportFormats[extension]
  let path = await os.showSaveDialog(translate(language, 'files.exportTitle'), { defaultPath: defaultName || `node.${extension}`, filters: [{ name: translate(language, filterKey), extensions: [extension] }] })
  if (!path) return null
  if (!path.toLowerCase().endsWith(`.${extension}`)) path += `.${extension}`
  let exists = false
  try {
    const info = await filesystem.getStats(path)
    if (info.isDirectory) throw fileError('FILE_REQUIRED')
    exists = true
  } catch (error) {
    if (error.code !== 'NE_FS_NOPATHE') throw error
  }
  if (exists && await os.showMessageBox(translate(language, 'files.replaceTitle'), translate(language, 'files.replaceBody'), 'YES_NO', 'WARNING') !== 'YES') return null
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const chunkOf = (start, length) => view.buffer.slice(view.byteOffset + start, view.byteOffset + start + length)
  try {
    if (extension !== 'zip' || view.length <= archiveChunkSize) {
      await filesystem.writeBinaryFile(path, chunkOf(0, view.length))
    } else {
      await filesystem.writeBinaryFile(path, chunkOf(0, archiveChunkSize))
      for (let offset = archiveChunkSize; offset < view.length; offset += archiveChunkSize) {
        await filesystem.appendBinaryFile(path, chunkOf(offset, Math.min(archiveChunkSize, view.length - offset)))
      }
    }
  } catch {
    // Une archive partielle ne doit pas rester présentée comme un export valide.
    try {
      await filesystem.remove(path)
    } catch {
      // La suppression impossible ne masque pas l'échec d'écriture initial.
    }
    throw fileError('WRITE_FAILED')
  }
  return path
}

// Exporte le workspace complet en archive ZIP contenant le document interne et les images.
export async function exportWorkspaceArchive(entries, language = 'en', defaultName = 'workspace.zip', client = null) {
  const zip = buildWorkspaceZip(entries)
  return exportBinaryFile('zip', zip, language, defaultName, client)
}

// Ne lit que le fichier choisi avec les extensions autorisees ; une annulation ne modifie pas le document.
export async function importWorkspaceFile(extensions = ['sp3', 'json'], language = 'en', client = null) {
  const { os, filesystem } = client || await getClient()
  const filters = extensions.includes('json')
    ? [{ name: translate(language, 'files.legacyCombinedFilter'), extensions }]
    : [{ name: translate(language, 'files.legacyFilter'), extensions }]
  const paths = await os.showOpenDialog(translate(language, 'files.openLegacyTitle'), { multiSelections: false, filters })
  if (!paths.length) return null
  const path = paths[0]
  if (!new RegExp(`\\.(${extensions.join('|')})$`, 'i').test(path)) throw fileError('FILE_EXTENSION_INVALID', { extension: extensions[0] })
  const info = await filesystem.getStats(path)
  if (!info.isFile || info.size > maximumFileSize) throw fileError('FILE_INVALID')
  return { path, text: await filesystem.readFile(path) }
}

const recoveryFolderName = 'sapphire3-recovery'
const legacyRecoveryFileName = 'sapphire3-recovery.sp3'

// Retrouve le répertoire de données persistant, en le créant si nécessaire.
async function dataFolder(client) {
  const dataPath = await client.os.getPath('data')
  try {
    await client.filesystem.createDirectory(dataPath)
  } catch {
    // Le répertoire existe déjà ou sera signalé par l'écriture suivante.
  }
  return String(dataPath).replace(/[\\/]+$/, '')
}

// Dossier de récupération : un vrai workspace dans le répertoire de données de l'application.
async function recoveryFolder(client) {
  return `${await dataFolder(client)}/${recoveryFolderName}`
}

// Supprime récursivement un dossier de récupération, y compris les fichiers .tmp et les sous-dossiers.
async function removeTree(filesystem, path) {
  let entries = []
  try {
    entries = await filesystem.readDirectory(path)
  } catch (error) {
    if (error?.code === 'NE_FS_NOPATHE') return
    throw error
  }
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = entry?.entry ?? entry?.name
    if (typeof name !== 'string') continue
    const child = entry.path ?? folderJoin(path, name)
    const type = String(entry.type ?? '').toLowerCase()
    if (type === 'directory' || type === 'dir') await removeTree(filesystem, child)
    else {
      try {
        await filesystem.remove(child)
      } catch (error) {
        if (error?.code !== 'NE_FS_NOPATHE') throw error
      }
    }
  }
  try {
    await filesystem.remove(path)
  } catch (error) {
    if (error?.code !== 'NE_FS_NOPATHE') throw error
  }
}

// Supprime d'abord le document de récupération, puis nettoie le reste sans jamais restaurer une copie périmée.
async function removeRecoveryFolder(filesystem, folder) {
  try {
    await filesystem.remove(folderJoin(folder, workspaceDocumentName))
  } catch (error) {
    if (error?.code !== 'NE_FS_NOPATHE') throw error
  }
  await removeTree(filesystem, folder)
}

// Écrit une copie de récupération d'un document qui n'a pas encore de dossier de workspace.
export async function writeRecoveryFile(text, client = null) {
  const target = client || await getClient()
  return writeWorkspaceDocument(await recoveryFolder(target), text, target)
}

// Relit la copie de récupération ; son absence est un état normal.
// L'ancien fichier unique est encore accepté une fois, puis effacé par la sauvegarde suivante.
export async function readRecoveryFile(client = null) {
  const target = client || await getClient()
  const folder = await recoveryFolder(target)
  try {
    const file = await readWorkspaceFolder(folder, target)
    return { path: folderJoin(folder, file.documentName), text: file.text }
  } catch (error) {
    if (error?.code !== 'NE_FS_NOPATHE' && error?.code !== 'WORKSPACE_NOT_FOUND') throw error
  }
  const legacy = folderJoin(await dataFolder(target), legacyRecoveryFileName)
  try {
    const info = await target.filesystem.getStats(legacy)
    if (!info?.isFile || info.size > maximumFileSize) return null
    return { path: legacy, text: await target.filesystem.readFile(legacy) }
  } catch (error) {
    if (error?.code === 'NE_FS_NOPATHE') return null
    throw error
  }
}

// Supprime la copie de récupération après une sauvegarde ou un remplacement volontaire.
export async function clearRecoveryFile(client = null) {
  const target = client || await getClient()
  await removeRecoveryFolder(target.filesystem, await recoveryFolder(target))
  try {
    await target.filesystem.remove(folderJoin(await dataFolder(target), legacyRecoveryFileName))
  } catch (error) {
    if (error?.code !== 'NE_FS_NOPATHE') throw error
  }
}
