import { buildWorkspaceZip, readWorkspaceZip } from '../../../src/utils/workspaceArchive.js'
import { isImageReference } from '../../../src/utils/embeddedImage.js'
import { ProjectWorkspace, loadWorkspace } from './document.js'
import { PROJECT_ERROR_CODES, ProjectError } from './errors.js'
import { copyBytes, decodeText, encodeText, isSafeArchiveName, normalizeArchiveName } from './helpers.js'

/** Nom du document interne dans une archive de workspace. */
export const WORKSPACE_DOCUMENT_NAME = 'workspace.sp3'

// Convertit une erreur ZIP ou de format en ProjectError stable.
function archiveError(error, code = PROJECT_ERROR_CODES.archiveInvalid) {
  if (error instanceof ProjectError) return error
  return new ProjectError(error?.code ?? code, error?.message ?? 'Invalid workspace archive.', { cause: error })
}

// Construit une archive ZIP à store contenant le document interne et les ressources.
export function buildWorkspaceArchive(input, options = {}) {
  const strictImages = options.strictImages !== false
  let workspace = input instanceof ProjectWorkspace ? input : loadWorkspace(input)
  const promoted = workspace.promoteEmbeddedImages()
  if (!promoted.ok) throw new ProjectError(promoted.code, promoted.message, { diagnostics: promoted.diagnostics, object: promoted.object, details: promoted.details })
  workspace = promoted.workspace

  const entries = [{ name: WORKSPACE_DOCUMENT_NAME, data: encodeText(workspace.toJSON()) }]
  const included = new Set([WORKSPACE_DOCUMENT_NAME])
  const missing = new Set()

  for (const reference of workspace.listImageResources()) {
    if (included.has(reference)) continue
    if (!isImageReference(reference)) throw new ProjectError(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe image entry: ${reference}.`, { object: { kind: 'image', id: reference } })
    const bytes = workspace.getImageResource(reference)
    if (!bytes) continue
    entries.push({ name: reference, data: bytes })
    included.add(reference)
  }

  for (const card of workspace.cards) {
    if (card.type !== 'image' || !card.imageRef || included.has(card.imageRef)) continue
    if (!isImageReference(card.imageRef)) throw new ProjectError(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe image entry: ${card.imageRef}.`, { object: { kind: 'image', id: card.id } })
    const bytes = workspace.getImageResource(card.imageRef)
    if (!bytes) {
      missing.add(card.imageRef)
      continue
    }
    entries.push({ name: card.imageRef, data: bytes })
    included.add(card.imageRef)
  }

  for (const name of workspace.listExtraFiles()) {
    if (!isSafeArchiveName(name) || included.has(name)) throw new ProjectError(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe extra archive entry: ${name}.`, { object: { kind: 'file', id: name } })
    const bytes = workspace.getExtraFile(name)
    if (!bytes) continue
    entries.push({ name, data: bytes })
    included.add(name)
  }

  if (strictImages && missing.size > 0) {
    throw new ProjectError(PROJECT_ERROR_CODES.imageMissing, 'The workspace references images that are not available in its resources.', {
      details: { missingImages: [...missing].sort() },
      object: { kind: 'workspace', id: workspace.projectId },
    })
  }

  return buildWorkspaceZip(entries)
}

// Relit une archive de workspace et associe ses images au document.
export function readWorkspaceArchive(bytes, options = {}) {
  const strictImages = options.strictImages !== false
  const data = copyBytes(bytes)
  if (!data) throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, 'Expected archive bytes as a Uint8Array or ArrayBuffer.')
  let entries
  try {
    entries = readWorkspaceZip(data)
  } catch (error) {
    throw archiveError(error)
  }
  const names = new Set()
  for (const entry of entries) {
    const name = normalizeArchiveName(entry.name)
    if (names.has(name)) throw new ProjectError(PROJECT_ERROR_CODES.archiveInvalid, `Duplicate archive entry: ${name}.`, { object: { kind: 'file', id: name } })
    names.add(name)
  }
  const documentEntry = entries.find((entry) => normalizeArchiveName(entry.name) === WORKSPACE_DOCUMENT_NAME)
  if (!documentEntry) throw new ProjectError(PROJECT_ERROR_CODES.archiveInvalid, 'The archive does not contain workspace.sp3.', { object: { kind: 'file', id: WORKSPACE_DOCUMENT_NAME } })

  const workspace = loadWorkspace(decodeText(documentEntry.data))
  const resources = new Map()
  const extraFiles = new Map()
  for (const entry of entries) {
    const name = normalizeArchiveName(entry.name)
    if (name === WORKSPACE_DOCUMENT_NAME) continue
    if (name.endsWith('/') && entry.data.length === 0) continue
    if (name.startsWith('images/')) {
      if (!isImageReference(name)) throw new ProjectError(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe image entry: ${name}.`, { object: { kind: 'file', id: name } })
      resources.set(name, copyBytes(entry.data))
      continue
    }
    if (!isSafeArchiveName(name)) throw new ProjectError(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe archive entry: ${name}.`, { object: { kind: 'file', id: name } })
    extraFiles.set(name, copyBytes(entry.data))
  }
  const attached = new ProjectWorkspace(workspace.toDocument(), { resources, extraFiles })
  const missingImages = attached.getMissingImageReferences()
  if (strictImages && missingImages.length > 0) {
    throw new ProjectError(PROJECT_ERROR_CODES.imageMissing, 'The archive does not contain all referenced images.', {
      details: { missingImages },
      object: { kind: 'workspace', id: attached.projectId },
    })
  }
  return { workspace: attached, missingImages }
}

// Charge uniquement le workspace d'une archive.
export function loadWorkspaceArchive(bytes, options = {}) {
  return readWorkspaceArchive(bytes, options).workspace
}
