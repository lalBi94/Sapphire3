import { ProjectWorkspace, loadWorkspace } from './document.js'
import { buildWorkspaceArchive, readWorkspaceArchive, WORKSPACE_DOCUMENT_NAME } from './archive.js'
import { PROJECT_ERROR_CODES, ProjectError } from './errors.js'
import { copyBytes, encodeText, isSafeArchiveName } from './helpers.js'
import { isImageReference } from '../../../src/utils/embeddedImage.js'

// Vérifie qu'un adaptateur fournit les méthodes asynchrones attendues.
function assertAdapter(adapter, methods) {
  if (!adapter || typeof adapter !== 'object' || methods.some((method) => typeof adapter[method] !== 'function')) {
    throw new ProjectError(PROJECT_ERROR_CODES.storageUnavailable, `The storage adapter must provide ${methods.join(', ')}.`)
  }
  return adapter
}

// Crée un adaptateur en mémoire pour les tests, les exemples et les agents.
export function createMemoryStorage(initial = {}) {
  const files = new Map()
  const entries = initial instanceof Map ? initial.entries() : Object.entries(initial)
  for (const [path, value] of entries) {
    const bytes = typeof value === 'string' ? null : copyBytes(value)
    files.set(path, bytes ?? String(value))
  }
  return {
    files,
    async exists(path) {
      return files.has(path)
    },
    async readText(path) {
      if (!files.has(path)) throw new ProjectError(PROJECT_ERROR_CODES.storageMissing, `Missing storage entry: ${path}.`, { details: { path } })
      const value = files.get(path)
      return typeof value === 'string' ? value : new TextDecoder().decode(value)
    },
    async writeText(path, text) {
      files.set(path, String(text))
    },
    async readBinary(path) {
      if (!files.has(path)) throw new ProjectError(PROJECT_ERROR_CODES.storageMissing, `Missing storage entry: ${path}.`, { details: { path } })
      const value = files.get(path)
      return typeof value === 'string' ? encodeText(value) : new Uint8Array(value)
    },
    async writeBinary(path, bytes) {
      const copy = copyBytes(bytes)
      if (!copy) throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, 'Expected binary data.')
      files.set(path, copy)
    },
    async remove(path) {
      files.delete(path)
    },
  }
}

// Charge un workspace depuis un adaptateur de stockage.
export async function loadWorkspaceFromStorage(adapter, { path = WORKSPACE_DOCUMENT_NAME } = {}) {
  assertAdapter(adapter, ['readText'])
  const text = await adapter.readText(path)
  if (typeof text !== 'string' && !(text instanceof Uint8Array) && !(text instanceof ArrayBuffer)) {
    throw new ProjectError(PROJECT_ERROR_CODES.storageUnavailable, `The storage entry ${path} is not text or bytes.`)
  }
  return loadWorkspace(text)
}

// Écrit le document workspace dans un adaptateur de stockage.
export async function saveWorkspaceToStorage(adapter, input, { path = WORKSPACE_DOCUMENT_NAME } = {}) {
  assertAdapter(adapter, ['writeText'])
  const workspace = input instanceof ProjectWorkspace ? input : loadWorkspace(input)
  const text = workspace.toJSON()
  await adapter.writeText(path, text)
  return { path, workspace }
}

// Charge un workspace et les octets de ses images liées depuis un adaptateur.
export async function loadWorkspaceBundle(adapter, { documentPath = WORKSPACE_DOCUMENT_NAME, strictImages = false } = {}) {
  let workspace = await loadWorkspaceFromStorage(adapter, { path: documentPath })
  const missingImages = []
  const references = new Set(workspace.cards.filter((card) => card.type === 'image' && card.imageRef).map((card) => card.imageRef))
  if (references.size > 0 && typeof adapter.readBinary !== 'function') {
    missingImages.push(...references)
  } else {
    for (const reference of references) {
      try {
        const bytes = await adapter.readBinary(reference)
        const result = workspace.setImageResource(reference, bytes)
        if (!result.ok) throw new ProjectError(result.code, result.message, { diagnostics: result.diagnostics, object: result.object })
        workspace = result.workspace
      } catch {
        missingImages.push(reference)
      }
    }
  }
  missingImages.sort()
  if (strictImages && missingImages.length > 0) {
    throw new ProjectError(PROJECT_ERROR_CODES.imageMissing, 'The storage adapter does not provide all referenced images.', {
      details: { missingImages },
      object: { kind: 'workspace', id: workspace.projectId },
    })
  }
  return { workspace, missingImages }
}

// Écrit le document, ses images liées et ses fichiers annexes dans un adaptateur.
export async function saveWorkspaceBundle(adapter, input, { documentPath = WORKSPACE_DOCUMENT_NAME, promoteEmbeddedImages = true, strictImages = true } = {}) {
  assertAdapter(adapter, ['writeText'])
  let workspace = input instanceof ProjectWorkspace ? input : loadWorkspace(input)
  if (promoteEmbeddedImages) {
    const promoted = workspace.promoteEmbeddedImages()
    if (!promoted.ok) throw new ProjectError(promoted.code, promoted.message, { diagnostics: promoted.diagnostics, object: promoted.object, details: promoted.details })
    workspace = promoted.workspace
  }
  const missingImages = workspace.getMissingImageReferences()
  if (strictImages && missingImages.length > 0) {
    throw new ProjectError(PROJECT_ERROR_CODES.imageMissing, 'The workspace references images that are not available in its resources.', {
      details: { missingImages },
      object: { kind: 'workspace', id: workspace.projectId },
    })
  }
  const imageNames = workspace.listImageResources()
  const extraNames = workspace.listExtraFiles()
  for (const reference of imageNames) {
    if (!isImageReference(reference)) throw new ProjectError(PROJECT_ERROR_CODES.imageInvalid, `Unsafe image entry: ${reference}.`, { object: { kind: 'image', id: reference } })
  }
  for (const name of extraNames) {
    if (!isSafeArchiveName(name) || name === WORKSPACE_DOCUMENT_NAME || name.startsWith('images/')) {
      throw new ProjectError(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe extra archive entry: ${name}.`, { object: { kind: 'file', id: name } })
    }
  }
  if (imageNames.length + extraNames.length > 0) assertAdapter(adapter, ['writeText', 'writeBinary'])
  for (const reference of imageNames) await adapter.writeBinary(reference, workspace.getImageResource(reference))
  for (const name of extraNames) await adapter.writeBinary(name, workspace.getExtraFile(name))
  await adapter.writeText(documentPath, workspace.toJSON())
  return { path: documentPath, workspace, missingImages, writtenImages: imageNames, writtenFiles: extraNames }
}

// Construit puis écrit une archive ZIP complète dans un adaptateur.
export async function exportWorkspaceArchiveToStorage(adapter, input, { path = 'workspace.zip', ...options } = {}) {
  assertAdapter(adapter, ['writeBinary'])
  const bytes = buildWorkspaceArchive(input, options)
  await adapter.writeBinary(path, bytes)
  return { path, bytes }
}

// Lit une archive ZIP depuis un adaptateur.
export async function loadWorkspaceArchiveFromStorage(adapter, { path = 'workspace.zip', ...options } = {}) {
  assertAdapter(adapter, ['readBinary'])
  const bytes = await adapter.readBinary(path)
  return readWorkspaceArchive(bytes, options)
}
