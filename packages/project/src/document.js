import {
  addClassMember,
  addConstant,
  addConstructor,
  addDeclaration,
  addFunction,
  addImport,
  addMethod,
  addModule,
  addVariable,
  createProject,
  deleteModule,
  deleteNode,
  ensureImports,
  moduleKinds,
  moveNode,
  removeImport,
  renameSymbol,
  reorderNode,
  serializeProject as serializeCoreProject,
  setExport,
  setNodeContracts,
  sourceFormatVersion,
  updateNode,
  validate as validateCore,
} from '../../../packages/core/src/index.js'
import {
  deserializeWorkspace as deserializeAppWorkspace,
  serializeWorkspace as serializeAppWorkspace,
  workspaceFileVersion,
} from '../../../src/utils/workspaceFile.js'
import { serializeSource } from '../../../src/utils/logic/serialization.js'
import { isEmbeddedImage, isImageReference, dataUrlToBytes, dataUrlMimeType, imageExtension } from '../../../src/utils/embeddedImage.js'
import { PROJECT_ERROR_CODES, ProjectError, projectDiagnostic, toProjectError } from './errors.js'
import { cloneJson, copyByteMap, copyBytes, decodeText, deepFreeze, isRecord, isSafeArchiveName, safeImageBaseName } from './helpers.js'
import {
  cleanSelection,
  collectModuleNodeIds,
  collectSubtreeNodeIds,
  createCommentCard,
  createImageCard,
  createModuleCard,
  findNodeByName,
  isModuleCardType,
  removeExpandedNodeIds,
} from './presentation.js'

/** Version du format workspace écrite par le SDK. */
export const WORKSPACE_VERSION = workspaceFileVersion

/** Version du format logique projet, indépendante du workspace. */
export const PROJECT_FORMAT_VERSION = sourceFormatVersion

const ROOT_KEYS = new Set(['application', 'workspaceVersion', 'project', 'presentation', 'exercise', 'dashboard'])
const PRESENTATION_KEYS = new Set(['cards', 'camera', 'selected'])

// Vérifie un identifiant non vide.
function requireId(value, label = 'identifier') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, `Expected a non-empty ${label}.`)
  }
  return value
}

// Vérifie un nom de module non vide.
function requireName(value, label = 'name') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, `Expected a non-empty ${label}.`)
  }
  return value
}

// Extrait les clefs inconnues d'un objet, sans les clefs déjà gérées.
function pickExtras(object, knownKeys) {
  const extras = {}
  if (!isRecord(object)) return extras
  for (const [key, value] of Object.entries(object)) {
    if (!knownKeys.has(key)) extras[key] = cloneJson(value)
  }
  return extras
}

// Normalise une entrée texte, binaire, objet ou workspace déjà chargé.
function normalizeWorkspaceInput(input, options = {}) {
  if (input instanceof ProjectWorkspace) {
    return {
      document: input.toDocument(),
      resources: options.resources ?? input._resources,
      extraFiles: options.extraFiles ?? input._extraFiles,
    }
  }
  let text = decodeText(input)
  if (text === null && isRecord(input)) {
    const serialized = serializeSource(input)
    if (serialized.json === null) {
      throw new ProjectError(PROJECT_ERROR_CODES.serializationInvalid, 'The workspace object contains values that cannot be preserved as JSON.', { diagnostics: serialized.diagnostics })
    }
    text = serialized.json
  }
  if (text === null) {
    throw new ProjectError(PROJECT_ERROR_CODES.unsupportedInput, 'Expected a workspace JSON string, UTF-8 bytes or a plain workspace object.')
  }
  try {
    return {
      document: deserializeAppWorkspace(text),
      resources: options.resources,
      extraFiles: options.extraFiles,
    }
  } catch (error) {
    throw toProjectError(error, PROJECT_ERROR_CODES.invalidWorkspace)
  }
}

// Produit le document workspace courant en conservant les métadonnées inconnues.
export function serializeWorkspaceDocument(document) {
  const plain = document instanceof ProjectWorkspace ? document.toDocument() : cloneJson(document)
  if (!isRecord(plain) || !isRecord(plain.project) || !isRecord(plain.presentation)) {
    throw new ProjectError(PROJECT_ERROR_CODES.invalidWorkspace, 'Expected a workspace document with project and presentation.')
  }
  let baseText
  try {
    baseText = serializeAppWorkspace(
      plain.project,
      plain.presentation.cards,
      plain.presentation.camera,
      plain.presentation.selected ?? null,
      plain.exercise ?? null,
      plain.dashboard ?? null,
    )
  } catch (error) {
    throw toProjectError(error, PROJECT_ERROR_CODES.invalidWorkspace)
  }
  const base = JSON.parse(baseText)
  const rootExtras = pickExtras(plain, ROOT_KEYS)
  const presentationExtras = pickExtras(plain.presentation, PRESENTATION_KEYS)
  const payload = {
    ...rootExtras,
    ...base,
    presentation: { ...presentationExtras, ...base.presentation },
  }
  const result = serializeSource(payload)
  if (result.json === null) {
    throw new ProjectError(PROJECT_ERROR_CODES.serializationInvalid, 'The workspace contains data that cannot be exported as JSON.', { diagnostics: result.diagnostics })
  }
  return result.json
}

/**
 * Instantané immuable d'un workspace Sapphire 3 complet.
 *
 * Les méthodes de modification retournent un résultat `{ ok, workspace, ... }`.
 * En cas d'échec, `workspace` reste l'instantané d'origine.
 */
export class ProjectWorkspace {
  /**
   * @param {string|Uint8Array|ArrayBuffer|object|ProjectWorkspace} input
   * @param {{resources?: Map<string, Uint8Array>|object, extraFiles?: Map<string, Uint8Array>|object}} [options]
   */
  constructor(input, options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, 'Expected a workspace options object.')
    }
    const normalized = normalizeWorkspaceInput(input, options)
    const document = normalized.document
    this._project = cloneJson(document.project)
    this._presentation = cloneJson(document.presentation)
    this._exercise = document.exercise === undefined ? null : cloneJson(document.exercise)
    this._dashboard = document.dashboard === undefined ? null : cloneJson(document.dashboard)
    this._rootExtras = pickExtras(document, ROOT_KEYS)
    this._presentationExtras = pickExtras(document.presentation, PRESENTATION_KEYS)
    this._resources = copyByteMap(normalized.resources)
    this._extraFiles = copyByteMap(normalized.extraFiles)
  }

  /** Version du workspace après migration. */
  get workspaceVersion() {
    return WORKSPACE_VERSION
  }

  /** Identifiant du projet logique. */
  get projectId() {
    return this._project.id ?? null
  }

  /** Nombre de modules et classes. */
  get moduleCount() {
    return this._project.modules.length
  }

  /** Nombre de nœuds logiques. */
  get nodeCount() {
    return this._project.nodes.length
  }

  /** Nombre de cartes de présentation. */
  get cardCount() {
    return this._presentation.cards.length
  }

  /** Projet logique gelé, sans les cartes ni la présentation. */
  get project() {
    return deepFreeze(cloneJson(this._project))
  }

  /** Présentation gelée : cartes, caméra et sélection. */
  get presentation() {
    return deepFreeze(cloneJson(this._presentation))
  }

  /** Cartes gelées dans leur ordre de rangement. */
  get cards() {
    return deepFreeze(cloneJson(this._presentation.cards))
  }

  /** Caméra gelée. */
  get camera() {
    return deepFreeze(cloneJson(this._presentation.camera))
  }

  /** Sélection gelée ou null. */
  get selected() {
    return this._presentation.selected === null ? null : deepFreeze(cloneJson(this._presentation.selected))
  }

  /** Manifeste d'exercice gelé, ou null. */
  get exercise() {
    return this._exercise === null ? null : deepFreeze(cloneJson(this._exercise))
  }

  /** Configuration dashboard gelée, ou null. */
  get dashboard() {
    return this._dashboard === null ? null : deepFreeze(cloneJson(this._dashboard))
  }

  /** Métadonnées racine inconnues, conservées lors du round-trip. */
  get metadata() {
    return deepFreeze(cloneJson(this._rootExtras))
  }

  /** Métadonnées de présentation inconnues, conservées lors du round-trip. */
  get presentationMetadata() {
    return deepFreeze(cloneJson(this._presentationExtras))
  }

  /** Retourne un module gelé, ou null. */
  getModule(moduleId) {
    const module = this._project.modules.find((entry) => entry.id === moduleId)
    return module ? deepFreeze(cloneJson(module)) : null
  }

  /** Retourne un nœud gelé, ou null. */
  getNode(nodeId) {
    const node = this._project.nodes.find((entry) => entry.id === nodeId)
    return node ? deepFreeze(cloneJson(node)) : null
  }

  /** Retourne une carte gelée, ou null. */
  getCard(cardId) {
    const card = this._presentation.cards.find((entry) => entry.id === cardId)
    return card ? deepFreeze(cloneJson(card)) : null
  }

  /** Retrouve l'identifiant d'une déclaration nommée dans un module. */
  getNodeId(moduleId, name) {
    return findNodeByName(this._project, moduleId, name)?.id ?? null
  }

  /** Retourne une ressource d'image copiée, ou null. */
  getImageResource(reference) {
    const bytes = this._resources.get(reference)
    return bytes ? new Uint8Array(bytes) : null
  }

  /** Liste les références d'images possédant des octets dans l'instantané. */
  listImageResources() {
    return [...this._resources.keys()].sort()
  }

  /** Liste les images référencées mais absentes des ressources. */
  getMissingImageReferences() {
    const missing = new Set()
    for (const card of this._presentation.cards) {
      if (card.type === 'image' && card.imageRef && !this._resources.has(card.imageRef)) missing.add(card.imageRef)
    }
    return [...missing].sort()
  }

  /** Retourne un fichier annexe d'archive copié, ou null. */
  getExtraFile(name) {
    const bytes = this._extraFiles.get(name)
    return bytes ? new Uint8Array(bytes) : null
  }

  /** Liste les fichiers annexes d'archive. */
  listExtraFiles() {
    return [...this._extraFiles.keys()].sort()
  }

  /** Document workspace complet, non sérialisé, avec métadonnées inconnues. */
  toDocument() {
    return {
      ...cloneJson(this._rootExtras),
      application: 'Sapphire 3',
      workspaceVersion: WORKSPACE_VERSION,
      project: cloneJson(this._project),
      presentation: {
        ...cloneJson(this._presentationExtras),
        ...cloneJson(this._presentation),
      },
      ...(this._exercise === null ? {} : { exercise: cloneJson(this._exercise) }),
      ...(this._dashboard === null ? {} : { dashboard: cloneJson(this._dashboard) }),
    }
  }

  /** Sérialise le workspace complet en JSON UTF-8 canonique. */
  toJSON() {
    return serializeWorkspaceDocument(this.toDocument())
  }

  /** Sérialise uniquement la source logique. */
  toProjectJSON() {
    try {
      const result = serializeCoreProject(this._project)
      if (!result.ok) {
        throw new ProjectError(result.code ?? PROJECT_ERROR_CODES.serializationInvalid, 'The logical project cannot be serialized as JSON.', { diagnostics: result.diagnostics })
      }
      return result.json
    } catch (error) {
      throw toProjectError(error, PROJECT_ERROR_CODES.serializationInvalid)
    }
  }

  /** Valide séparément la structure du workspace et la sémantique du programme. */
  validate() {
    let structural
    try {
      serializeWorkspaceDocument(this.toDocument())
      structural = { ok: true, code: null, message: null, diagnostics: [] }
    } catch (error) {
      structural = {
        ok: false,
        code: error?.code ?? PROJECT_ERROR_CODES.invalidWorkspace,
        message: error?.message ?? 'Invalid workspace structure.',
        diagnostics: [projectDiagnostic(error?.code ?? PROJECT_ERROR_CODES.invalidWorkspace, error?.message ?? 'Invalid workspace structure.', {
          source: 'structural',
          object: { kind: 'workspace', id: this._project.id ?? null },
          details: error?.details ?? null,
        })],
      }
    }
    let semantic
    try {
      const result = validateCore(this._project)
      semantic = {
        ok: Boolean(result.ok && result.canGenerate),
        canGenerate: Boolean(result.canGenerate),
        diagnostics: (result.diagnostics ?? []).map((diagnostic) => ({ ...diagnostic, source: 'semantic' })),
      }
    } catch (error) {
      semantic = {
        ok: false,
        canGenerate: false,
        diagnostics: [projectDiagnostic(error?.code ?? PROJECT_ERROR_CODES.semanticInvalid, error?.message ?? 'Semantic analysis failed.', {
          source: 'semantic',
          object: { kind: 'workspace', id: this._project.id ?? null },
          details: error?.details ?? null,
        })],
      }
    }
    return {
      ok: structural.ok && semantic.ok,
      structural,
      semantic,
      diagnostics: [...structural.diagnostics, ...semantic.diagnostics],
    }
  }

  /** Clone profond, ressources et fichiers annexes compris. */
  clone() {
    return new ProjectWorkspace(this.toDocument(), { resources: this._resources, extraFiles: this._extraFiles })
  }

  // Construit un résultat d'échec qui conserve l'instantané courant.
  _failure(code, message = 'Workspace operation failed.', { diagnostics = [], object = null, details = null } = {}) {
    return { ok: false, workspace: this, code, message, diagnostics, object, details }
  }

  // Construit un résultat de succès avec les champs spécifiques utiles.
  _success(workspace, extra = {}) {
    const result = {
      ok: true,
      workspace,
      code: null,
      message: null,
      diagnostics: extra.diagnostics ?? [],
      object: extra.object ?? null,
    }
    for (const key of ['nodeId', 'moduleId', 'cardId', 'promoted']) {
      if (extra[key] !== undefined) result[key] = extra[key]
    }
    return result
  }

  // Valide et adopte un document candidat ; en cas d'échec, conserve l'original.
  _commit(document, extra = {}) {
    try {
      const workspace = new ProjectWorkspace(document, {
        resources: extra.resources ?? this._resources,
        extraFiles: extra.extraFiles ?? this._extraFiles,
      })
      return this._success(workspace, extra)
    } catch (error) {
      return this._failure(error?.code ?? PROJECT_ERROR_CODES.mutationFailed, error?.message ?? 'Workspace mutation failed.', {
        diagnostics: error?.diagnostics ?? [],
        object: extra.object ?? null,
        details: { cause: error },
      })
    }
  }

  // Applique un résultat de mutation Core et valide le workspace candidat.
  _applyProject(result, extra = {}) {
    if (!result?.ok) {
      return this._failure(result?.code ?? PROJECT_ERROR_CODES.mutationFailed, result?.message ?? 'Core mutation failed.', {
        diagnostics: result?.diagnostics ?? [],
        object: extra.object ?? null,
        details: result ?? null,
      })
    }
    const document = this.toDocument()
    document.project = result.project
    return this._commit(document, { ...extra, diagnostics: result.diagnostics ?? [] })
  }

  // Exécute une opération Core qui peut lever une erreur d'argument.
  _core(operation, object = null) {
    try {
      return operation()
    } catch (error) {
      return {
        ok: false,
        code: error?.code ?? PROJECT_ERROR_CODES.mutationFailed,
        message: error?.message ?? 'Core mutation failed.',
        diagnostics: error?.diagnostics ?? [],
        details: error,
        object,
      }
    }
  }

  // Ajoute un module ordinaire ou une classe avec sa carte.
  addModule(definition = {}) {
    if (!isRecord(definition)) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected a module definition.', { object: { kind: 'module', id: null } })
    const id = definition.id
    const name = definition.name
    try {
      requireId(id, 'module id')
      requireName(name, 'module name')
    } catch (error) {
      return this._failure(error.code, error.message, { object: { kind: definition.kind === moduleKinds.class ? 'class' : 'module', id: id ?? null } })
    }
    if (this._presentation.cards.some((card) => card.id === id)) {
      return this._failure(PROJECT_ERROR_CODES.duplicateId, `A card already uses the id ${id}.`, { object: { kind: 'module', id } })
    }
    const result = this._core(() => addModule(this._project, { id, name, kind: definition.kind ?? moduleKinds.module }), { kind: 'module', id })
    if (!result.ok) return this._failure(result.code, result.message, { diagnostics: result.diagnostics, object: { kind: 'module', id } })
    const document = this.toDocument()
    document.project = result.project
    const presentationOptions = isRecord(definition.presentation) ? { ...definition.presentation, ...definition } : definition
    document.presentation.cards = [...document.presentation.cards, createModuleCard(result.module, presentationOptions, document.presentation.cards.length)]
    return this._commit(document, {
      object: { kind: result.module.kind === 'class' ? 'class' : 'module', id },
      moduleId: id,
      cardId: id,
      diagnostics: result.diagnostics ?? [],
    })
  }

  // Ajoute une classe avec sa carte.
  addClass(definition = {}) {
    return this.addModule({ ...definition, kind: moduleKinds.class })
  }

  // Supprime un module, ses nœuds, sa carte et ses références de pliage.
  removeModule(moduleId) {
    try {
      requireId(moduleId, 'module id')
    } catch (error) {
      return this._failure(error.code, error.message, { object: { kind: 'module', id: moduleId ?? null } })
    }
    if (!this._project.modules.some((module) => module.id === moduleId)) {
      return this._failure(PROJECT_ERROR_CODES.moduleNotFound, `Unknown module: ${moduleId}.`, { object: { kind: 'module', id: moduleId } })
    }
    const removedNodes = collectModuleNodeIds(this._project, moduleId)
    const result = this._core(() => deleteModule(this._project, moduleId), { kind: 'module', id: moduleId })
    if (!result.ok) return this._failure(result.code, result.message, { diagnostics: result.diagnostics, object: { kind: 'module', id: moduleId } })
    const document = this.toDocument()
    document.project = result.project
    document.presentation.cards = removeExpandedNodeIds(document.presentation.cards.filter((card) => card.id !== moduleId), removedNodes)
    document.presentation.selected = cleanSelection(document.presentation.selected, { moduleIds: new Set([moduleId]), nodeIds: removedNodes })
    return this._commit(document, { object: { kind: 'module', id: moduleId }, moduleId })
  }

  // Renomme un module ou une classe et sa carte ensemble.
  renameModule(moduleId, name) {
    try {
      requireId(moduleId, 'module id')
      requireName(name, 'module name')
    } catch (error) {
      return this._failure(error.code, error.message, { object: { kind: 'module', id: moduleId ?? null } })
    }
    const module = this._project.modules.find((entry) => entry.id === moduleId)
    if (!module) return this._failure(PROJECT_ERROR_CODES.moduleNotFound, `Unknown module: ${moduleId}.`, { object: { kind: 'module', id: moduleId } })
    if (!this._presentation.cards.some((card) => card.id === moduleId)) {
      return this._failure(PROJECT_ERROR_CODES.cardNotFound, `The module ${moduleId} has no visual card.`, { object: { kind: 'module', id: moduleId } })
    }
    const document = this.toDocument()
    document.project.modules = document.project.modules.map((entry) => entry.id === moduleId ? { ...entry, name } : entry)
    document.presentation.cards = document.presentation.cards.map((card) => card.id === moduleId ? { ...card, name } : card)
    return this._commit(document, { object: { kind: module.kind === 'class' ? 'class' : 'module', id: moduleId }, moduleId })
  }

  // Déplace une carte Module ou Class sans toucher à la source logique.
  moveModule(moduleId, position = {}) {
    const card = this._presentation.cards.find((entry) => entry.id === moduleId)
    if (!card) return this._failure(PROJECT_ERROR_CODES.cardNotFound, `Unknown card: ${moduleId}.`, { object: { kind: 'module', id: moduleId } })
    return this.updateCard(moduleId, position)
  }

  // Modifie une carte de présentation, en synchronisant le nom des modules.
  updateCard(cardId, patch = {}) {
    try {
      requireId(cardId, 'card id')
    } catch (error) {
      return this._failure(error.code, error.message, { object: { kind: 'card', id: cardId ?? null } })
    }
    const card = this._presentation.cards.find((entry) => entry.id === cardId)
    if (!card) return this._failure(PROJECT_ERROR_CODES.cardNotFound, `Unknown card: ${cardId}.`, { object: { kind: 'card', id: cardId } })
    if (!isRecord(patch)) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected a card patch object.', { object: { kind: 'card', id: cardId } })
    if ((patch.id !== undefined && patch.id !== card.id) || (patch.type !== undefined && patch.type !== card.type)) {
      return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'A card id or type cannot be changed in place.', { object: { kind: 'card', id: cardId } })
    }
    const document = this.toDocument()
    document.presentation.cards = document.presentation.cards.map((entry) => entry.id === cardId ? { ...entry, ...cloneJson(patch) } : entry)
    if (isModuleCardType(card.type) && patch.name !== undefined) {
      document.project.modules = document.project.modules.map((module) => module.id === cardId ? { ...module, name: patch.name } : module)
    }
    return this._commit(document, { object: { kind: 'card', id: cardId }, cardId, ...(isModuleCardType(card.type) ? { moduleId: cardId } : {}) })
  }

  // Remplace la caméra de la présentation.
  setCamera(camera) {
    const document = this.toDocument()
    document.presentation.camera = cloneJson(camera)
    return this._commit(document, { object: { kind: 'presentation', id: null } })
  }

  // Remplace la sélection de la présentation.
  setSelected(selected) {
    const document = this.toDocument()
    document.presentation.selected = selected === null ? null : cloneJson(selected)
    return this._commit(document, { object: { kind: 'presentation', id: null } })
  }

  // Ajoute une annotation Comment hors source logique.
  addComment(options = {}) {
    if (!isRecord(options)) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected a comment definition.', { object: { kind: 'comment', id: null } })
    const id = options.id
    try {
      requireId(id, 'comment id')
    } catch (error) {
      return this._failure(error.code, error.message, { object: { kind: 'comment', id: id ?? null } })
    }
    if (this._presentation.cards.some((card) => card.id === id) || this._project.modules.some((module) => module.id === id)) {
      return this._failure(PROJECT_ERROR_CODES.duplicateId, `The id ${id} is already used.`, { object: { kind: 'comment', id } })
    }
    const document = this.toDocument()
    document.presentation.cards = [...document.presentation.cards, createCommentCard(options, document.presentation.cards.length)]
    return this._commit(document, { object: { kind: 'comment', id }, cardId: id })
  }

  // Ajoute une annotation Image avec Data URL, référence images/ ou les deux octets.
  addImage(options = {}) {
    if (!isRecord(options)) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected an image definition.', { object: { kind: 'image', id: null } })
    const id = options.id
    try {
      requireId(id, 'image id')
    } catch (error) {
      return this._failure(error.code, error.message, { object: { kind: 'image', id: id ?? null } })
    }
    if (this._presentation.cards.some((card) => card.id === id) || this._project.modules.some((module) => module.id === id)) {
      return this._failure(PROJECT_ERROR_CODES.duplicateId, `The id ${id} is already used.`, { object: { kind: 'image', id } })
    }
    if (options.image && options.imageRef) {
      return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'An image card accepts either image or imageRef, never both.', { object: { kind: 'image', id } })
    }
    if (options.image !== undefined && options.image !== '' && !isEmbeddedImage(options.image)) {
      return this._failure(PROJECT_ERROR_CODES.imageInvalid, 'The embedded image is not a valid image Data URL.', { object: { kind: 'image', id } })
    }
    if (options.imageRef !== undefined && !isImageReference(options.imageRef)) {
      return this._failure(PROJECT_ERROR_CODES.imageInvalid, 'The image reference must stay inside images/ with a supported extension.', { object: { kind: 'image', id } })
    }
    let resources = this._resources
    if (options.bytes !== undefined) {
      if (!options.imageRef) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Image bytes require an imageRef.', { object: { kind: 'image', id } })
      const bytes = copyBytes(options.bytes)
      if (!bytes) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected image bytes as a Uint8Array or ArrayBuffer.', { object: { kind: 'image', id } })
      if (bytes.length === 0) return this._failure(PROJECT_ERROR_CODES.imageInvalid, 'Image bytes cannot be empty.', { object: { kind: 'image', id } })
      resources = new Map(this._resources)
      resources.set(options.imageRef, bytes)
    }
    const document = this.toDocument()
    document.presentation.cards = [...document.presentation.cards, createImageCard(options, document.presentation.cards.length)]
    return this._commit(document, { object: { kind: 'image', id }, cardId: id, resources })
  }

  // Retire une annotation Comment ou Image, sans supprimer un module.
  removeCard(cardId) {
    const card = this._presentation.cards.find((entry) => entry.id === cardId)
    if (!card) return this._failure(PROJECT_ERROR_CODES.cardNotFound, `Unknown card: ${cardId}.`, { object: { kind: 'card', id: cardId } })
    if (isModuleCardType(card.type)) {
      return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Remove a Module or Class with removeModule().', { object: { kind: 'card', id: cardId } })
    }
    const document = this.toDocument()
    document.presentation.cards = document.presentation.cards.filter((entry) => entry.id !== cardId)
    return this._commit(document, { object: { kind: 'card', id: cardId }, cardId })
  }

  // Ajoute une fonction à un module ou une méthode à une classe.
  addFunction(moduleId, definition, options = {}) {
    const result = this._core(() => addFunction(this._project, moduleId, definition, options), { kind: 'function', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId, nodeId: result?.nodeId })
  }

  // Ajoute une méthode de classe.
  addMethod(classId, definition, options = {}) {
    const result = this._core(() => addMethod(this._project, classId, definition, options), { kind: 'method', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId: classId, nodeId: result?.nodeId })
  }

  // Ajoute un constructeur de classe.
  addConstructor(classId, definition = {}) {
    const result = this._core(() => addConstructor(this._project, classId, definition), { kind: 'constructor', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId: classId, nodeId: result?.nodeId })
  }

  // Ajoute une variable à la racine d'un module ou d'une classe.
  addVariable(moduleId, definition, options = {}) {
    const result = this._core(() => addVariable(this._project, moduleId, definition, options), { kind: 'variable', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId, nodeId: result?.nodeId })
  }

  // Ajoute une constante à la racine d'un module ou d'une classe.
  addConstant(moduleId, definition, options = {}) {
    const result = this._core(() => addConstant(this._project, moduleId, definition, options), { kind: 'constant', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId, nodeId: result?.nodeId })
  }

  // Ajoute un membre de classe déclaratif.
  addClassMember(classId, draft, options = {}) {
    const result = this._core(() => addClassMember(this._project, classId, draft, options), { kind: 'member', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId: classId, nodeId: result?.nodeId })
  }

  // Ajoute une déclaration arbitraire à la racine d'un module.
  addNode(moduleId, draft, options = {}) {
    const result = this._core(() => addDeclaration(this._project, moduleId, draft, options), { kind: 'node', id: null })
    return this._applyProject(result, { object: { kind: 'node', id: result?.nodeId ?? null }, moduleId, nodeId: result?.nodeId })
  }

  // Met à jour les propriétés ou références d'un nœud.
  updateNode(nodeId, patch) {
    const result = this._core(() => updateNode(this._project, nodeId, patch), { kind: 'node', id: nodeId })
    return this._applyProject(result, { object: { kind: 'node', id: nodeId }, nodeId })
  }

  // Supprime un nœud, son sous-arbre et ses références de pliage.
  deleteNode(nodeId) {
    const removedNodes = collectSubtreeNodeIds(this._project, nodeId)
    const result = this._core(() => deleteNode(this._project, nodeId), { kind: 'node', id: nodeId })
    if (!result.ok) return this._failure(result.code, result.message, { diagnostics: result.diagnostics, object: { kind: 'node', id: nodeId } })
    const document = this.toDocument()
    document.project = result.project
    document.presentation.cards = removeExpandedNodeIds(document.presentation.cards, removedNodes)
    document.presentation.selected = cleanSelection(document.presentation.selected, { nodeIds: removedNodes })
    return this._commit(document, { object: { kind: 'node', id: nodeId }, nodeId, diagnostics: result.diagnostics ?? [] })
  }

  // Déplace un nœud vers un destinataire compatible.
  moveNode(nodeId, receiver, options = {}) {
    const result = this._core(() => moveNode(this._project, nodeId, receiver, options), { kind: 'node', id: nodeId })
    return this._applyProject(result, { object: { kind: 'node', id: nodeId }, nodeId })
  }

  // Réordonne un nœud dans sa liste parente.
  reorderNode(nodeId, offset, options = {}) {
    const result = this._core(() => reorderNode(this._project, nodeId, offset, options), { kind: 'node', id: nodeId })
    return this._applyProject(result, { object: { kind: 'node', id: nodeId }, nodeId })
  }

  // Renomme un symbole et tous ses liens sémantiques.
  renameSymbol(nodeId, name, options = {}) {
    const result = this._core(() => renameSymbol(this._project, nodeId, name, options), { kind: 'node', id: nodeId })
    return this._applyProject(result, { object: { kind: 'node', id: nodeId }, nodeId })
  }

  // Ajoute un import de module.
  addImport(moduleId, entry) {
    const result = this._core(() => addImport(this._project, moduleId, entry), { kind: 'module', id: moduleId })
    return this._applyProject(result, { object: { kind: 'module', id: moduleId }, moduleId })
  }

  // Retire un import de module.
  removeImport(moduleId, importId) {
    const result = this._core(() => removeImport(this._project, moduleId, importId), { kind: 'module', id: moduleId })
    return this._applyProject(result, { object: { kind: 'module', id: moduleId }, moduleId })
  }

  // Ajoute automatiquement les imports nécessaires à des déclarations.
  ensureImports(moduleId, sources, idFactory = null) {
    const result = this._core(() => ensureImports(this._project, moduleId, sources, idFactory), { kind: 'module', id: moduleId })
    return this._applyProject(result, { object: { kind: 'module', id: moduleId }, moduleId })
  }

  // Ajoute ou retire un export de module.
  setExport(moduleId, nodeId, exported = true) {
    const result = this._core(() => setExport(this._project, moduleId, nodeId, exported), { kind: 'module', id: moduleId })
    return this._applyProject(result, { object: { kind: 'module', id: moduleId }, moduleId, nodeId })
  }

  // Remplace les contrats attachés à un nœud.
  setNodeContracts(nodeId, contracts) {
    const result = this._core(() => setNodeContracts(this._project, nodeId, contracts), { kind: 'node', id: nodeId })
    return this._applyProject(result, { object: { kind: 'node', id: nodeId }, nodeId })
  }

  // Remplace le manifeste d'exercice, ou le retire avec null.
  setExercise(exercise) {
    const document = this.toDocument()
    if (exercise === null || exercise === undefined) delete document.exercise
    else document.exercise = cloneJson(exercise)
    return this._commit(document, { object: { kind: 'exercise', id: null } })
  }

  // Remplace la configuration dashboard, ou la retire avec null.
  setDashboard(dashboard) {
    const document = this.toDocument()
    if (dashboard === null || dashboard === undefined) delete document.dashboard
    else document.dashboard = cloneJson(dashboard)
    return this._commit(document, { object: { kind: 'dashboard', id: null } })
  }

  // Ajoute ou remplace les octets d'une image liée.
  setImageResource(reference, bytes) {
    if (!isImageReference(reference)) {
      return this._failure(PROJECT_ERROR_CODES.imageInvalid, 'The image reference must stay inside images/ with a supported extension.', { object: { kind: 'image', id: reference ?? null } })
    }
    const copy = copyBytes(bytes)
    if (!copy) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected image bytes as a Uint8Array or ArrayBuffer.', { object: { kind: 'image', id: reference } })
    if (copy.length === 0) return this._failure(PROJECT_ERROR_CODES.imageInvalid, 'Image bytes cannot be empty.', { object: { kind: 'image', id: reference } })
    const resources = new Map(this._resources)
    resources.set(reference, copy)
    return this._commit(this.toDocument(), { object: { kind: 'image', id: reference }, resources })
  }

  // Retire les octets d'une image liée sans modifier la carte.
  removeImageResource(reference) {
    if (!this._resources.has(reference)) return this._success(this)
    const resources = new Map(this._resources)
    resources.delete(reference)
    return this._commit(this.toDocument(), { object: { kind: 'image', id: reference }, resources })
  }

  // Ajoute un fichier annexe d'archive.
  setExtraFile(name, bytes) {
    if (!isSafeArchiveName(name) || name === 'workspace.sp3' || name.startsWith('images/')) {
      return this._failure(PROJECT_ERROR_CODES.archiveUnsafeEntry, `Unsafe extra archive entry: ${String(name)}.`, { object: { kind: 'file', id: name ?? null } })
    }
    const copy = copyBytes(bytes)
    if (!copy) return this._failure(PROJECT_ERROR_CODES.invalidArgument, 'Expected extra file bytes as a Uint8Array or ArrayBuffer.', { object: { kind: 'file', id: name } })
    const extraFiles = new Map(this._extraFiles)
    extraFiles.set(name, copy)
    return this._commit(this.toDocument(), { object: { kind: 'file', id: name }, extraFiles })
  }

  // Retire un fichier annexe d'archive.
  removeExtraFile(name) {
    if (!this._extraFiles.has(name)) return this._success(this)
    const extraFiles = new Map(this._extraFiles)
    extraFiles.delete(name)
    return this._commit(this.toDocument(), { object: { kind: 'file', id: name }, extraFiles })
  }

  // Convertit les images intégrées en fichiers `images/` et conserve leurs octets.
  promoteEmbeddedImages() {
    try {
      const resources = new Map(this._resources)
      const used = new Set([...resources.keys(), ...this._presentation.cards.filter((card) => card.imageRef).map((card) => card.imageRef)])
      const promoted = []
      const cards = this._presentation.cards.map((card) => {
        if (card.type !== 'image' || card.imageRef || !card.image) return card
        const bytes = dataUrlToBytes(card.image)
        if (!bytes) throw new ProjectError(PROJECT_ERROR_CODES.imageInvalid, `The image card ${card.id} contains an invalid Data URL.`, { object: { kind: 'image', id: card.id } })
        const extension = imageExtension(dataUrlMimeType(card.image))
        const base = safeImageBaseName(`${card.id}.${extension}`)
        const dot = base.lastIndexOf('.')
        const stem = dot > 0 ? base.slice(0, dot) : base
        const suffix = dot > 0 ? base.slice(dot) : `.${extension}`
        let attempt = 1
        let reference
        do {
          const name = attempt === 1 ? `${stem}${suffix}` : `${stem}-${attempt}${suffix}`
          reference = `images/${name}`
          attempt += 1
        } while (used.has(reference) && attempt <= 999)
        if (used.has(reference)) throw new ProjectError(PROJECT_ERROR_CODES.imageInvalid, `No safe image name is available for ${card.id}.`, { object: { kind: 'image', id: card.id } })
        resources.set(reference, bytes)
        used.add(reference)
        promoted.push({ id: card.id, reference })
        return { ...card, imageRef: reference, image: '' }
      })
      if (promoted.length === 0) return this._success(this, { promoted })
      const document = this.toDocument()
      document.presentation.cards = cards
      return this._commit(document, { object: { kind: 'workspace', id: this._project.id ?? null }, resources, promoted })
    } catch (error) {
      return this._failure(error?.code ?? PROJECT_ERROR_CODES.imageInvalid, error?.message ?? 'Embedded image promotion failed.', {
        diagnostics: error?.diagnostics ?? [],
        object: error?.object ?? { kind: 'workspace', id: this._project.id ?? null },
        details: { cause: error },
      })
    }
  }
}

// Crée un workspace vide avec une présentation explicite.
export function createWorkspace(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, 'Expected a workspace options object.')
  }
  let project
  try {
    project = createProject(options.id ?? 'workspace')
  } catch (error) {
    throw toProjectError(error, PROJECT_ERROR_CODES.invalidProject)
  }
  const presentation = {
    cards: [],
    camera: options.camera ?? { x: 0, y: 0, zoomLevel: 0 },
    selected: options.selected ?? null,
  }
  const presentationExtras = pickExtras(options.presentationMetadata, PRESENTATION_KEYS)
  const rootExtras = pickExtras(options.metadata, ROOT_KEYS)
  const document = {
    ...rootExtras,
    application: 'Sapphire 3',
    workspaceVersion: WORKSPACE_VERSION,
    project,
    presentation: { ...presentationExtras, ...presentation },
    ...(options.exercise === undefined || options.exercise === null ? {} : { exercise: options.exercise }),
    ...(options.dashboard === undefined || options.dashboard === null ? {} : { dashboard: options.dashboard }),
  }
  return new ProjectWorkspace(document, { resources: options.resources, extraFiles: options.extraFiles })
}

// Charge un workspace complet depuis un texte, des octets ou un objet.
export function loadWorkspace(input, options = {}) {
  return input instanceof ProjectWorkspace ? input.clone() : new ProjectWorkspace(input, options)
}

// Charge uniquement le projet logique d'un workspace ou d'une source v1.
export function loadProject(input) {
  return loadWorkspace(input).project
}

// Sérialise un workspace complet en JSON canonique.
export function serializeWorkspace(input) {
  return input instanceof ProjectWorkspace ? input.toJSON() : new ProjectWorkspace(input).toJSON()
}

// Sérialise uniquement une source logique.
export function serializeProject(input) {
  if (input instanceof ProjectWorkspace) return input.toProjectJSON()
  if (typeof input === 'string' || input instanceof Uint8Array || input instanceof ArrayBuffer) return serializeProject(loadProject(input))
  if (isRecord(input) && Object.hasOwn(input, 'workspaceVersion')) return loadWorkspace(input).toProjectJSON()
  try {
    const result = serializeCoreProject(input)
    if (!result.ok) throw new ProjectError(result.code ?? PROJECT_ERROR_CODES.serializationInvalid, 'The logical project cannot be serialized as JSON.', { diagnostics: result.diagnostics })
    return result.json
  } catch (error) {
    throw toProjectError(error, PROJECT_ERROR_CODES.serializationInvalid)
  }
}

// Valide un workspace complet, structure puis sémantique.
export function validateWorkspace(input) {
  return loadWorkspace(input).validate()
}

// Valide uniquement la sémantique d'un projet logique.
export function validateProject(project) {
  try {
    return validateCore(project)
  } catch (error) {
    return {
      ok: false,
      canGenerate: false,
      diagnostics: [projectDiagnostic(error?.code ?? PROJECT_ERROR_CODES.invalidProject, error?.message ?? 'Semantic analysis failed.', {
        source: 'semantic',
        object: { kind: 'workspace', id: null },
        details: error?.details ?? null,
      })],
    }
  }
}
