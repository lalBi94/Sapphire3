import { createWorkspace } from './document.js'
import { PROJECT_ERROR_CODES, ProjectError, projectDiagnostic } from './errors.js'

// Résout un nœud par identifiant ou par nom dans un module.
function resolveNodeId(workspace, moduleId, reference) {
  if (typeof reference !== 'string' || reference.length === 0) return null
  const direct = workspace.getNode(reference)
  if (direct?.moduleId === moduleId) return reference
  return workspace.getNodeId(moduleId, reference)
}

// Construit une clef de déduplication lisible pour les diagnostics.
function diagnosticKey(diagnostic) {
  return [diagnostic.code, diagnostic.object?.kind ?? '', diagnostic.object?.id ?? '', diagnostic.message ?? ''].join('|')
}

/**
 * Constructeur déclaratif de workspace.
 *
 * Les méthodes ajoutent un objet, enregistrent un diagnostic associé en cas
 * d'échec et retournent le builder pour le chaînage. `build()` valide ensuite
 * la structure et la sémantique avant de retourner le workspace.
 */
export class WorkspaceBuilder {
  constructor(options = {}) {
    this._workspace = createWorkspace(options)
    this._diagnostics = []
    this._lastNodeId = null
  }

  /** Workspace courant, même s'il reste incomplet. */
  get workspace() {
    return this._workspace
  }

  /** Diagnostics d'opérations échouées, associés à leurs objets. */
  get diagnostics() {
    return [...this._diagnostics]
  }

  /** Dernier nœud créé avec succès. */
  get lastNodeId() {
    return this._lastNodeId
  }

  // Enregistre un résultat de mutation et conserve le dernier workspace valide.
  _record(result, { kind, id = null } = {}) {
    if (result?.ok) {
      this._workspace = result.workspace
      if (result.nodeId) this._lastNodeId = result.nodeId
      return result
    }
    const object = result?.object ?? { kind, id }
    const diagnostics = Array.isArray(result?.diagnostics) && result.diagnostics.length > 0
      ? result.diagnostics
      : [projectDiagnostic(result?.code ?? PROJECT_ERROR_CODES.mutationFailed, result?.message ?? 'Workspace operation failed.', { object })]
    for (const diagnostic of diagnostics) {
      this._diagnostics.push({ ...diagnostic, object: diagnostic.object ?? object, operation: kind })
    }
    return result
  }

  // Enregistre un échec local sans appeler le workspace.
  _fail(code, message, object) {
    this._diagnostics.push(projectDiagnostic(code, message, { object, operation: object.kind }))
  }

  /** Ajoute un module et sa carte. */
  addModule(id, options = {}) {
    this._record(this._workspace.addModule({ ...options, id }), { kind: 'module', id })
    return this
  }

  /** Ajoute une classe et sa carte. */
  addClass(id, options = {}) {
    this._record(this._workspace.addClass({ ...options, id }), { kind: 'class', id })
    return this
  }

  /** Ajoute une fonction à un module ou une méthode à une classe. */
  addFunction(moduleId, definition, options = {}) {
    this._record(this._workspace.addFunction(moduleId, definition, options), { kind: 'function', id: null })
    return this
  }

  /** Ajoute une variable à la racine d'un module ou d'une classe. */
  addVariable(moduleId, definition, options = {}) {
    this._record(this._workspace.addVariable(moduleId, definition, options), { kind: 'variable', id: null })
    return this
  }

  /** Ajoute une constante à la racine d'un module ou d'une classe. */
  addConstant(moduleId, definition, options = {}) {
    this._record(this._workspace.addConstant(moduleId, definition, options), { kind: 'constant', id: null })
    return this
  }

  /** Ajoute une méthode de classe. */
  addMethod(classId, definition, options = {}) {
    this._record(this._workspace.addMethod(classId, definition, options), { kind: 'method', id: null })
    return this
  }

  /** Ajoute un constructeur de classe. */
  addConstructor(classId, definition = {}) {
    this._record(this._workspace.addConstructor(classId, definition), { kind: 'constructor', id: null })
    return this
  }

  /** Ajoute un membre de classe déclaratif. */
  addClassMember(classId, draft, options = {}) {
    this._record(this._workspace.addClassMember(classId, draft, options), { kind: 'member', id: null })
    return this
  }

  /** Ajoute une déclaration arbitraire à la racine d'un module. */
  addNode(moduleId, draft, options = {}) {
    this._record(this._workspace.addNode(moduleId, draft, options), { kind: 'node', id: null })
    return this
  }

  /** Modifie les propriétés ou références d'un nœud. */
  updateNode(nodeId, patch) {
    this._record(this._workspace.updateNode(nodeId, patch), { kind: 'node', id: nodeId })
    return this
  }

  /** Supprime un nœud et son sous-arbre. */
  deleteNode(nodeId) {
    this._record(this._workspace.deleteNode(nodeId), { kind: 'node', id: nodeId })
    return this
  }

  /** Déplace un nœud vers un destinataire compatible. */
  moveNode(nodeId, receiver, options = {}) {
    this._record(this._workspace.moveNode(nodeId, receiver, options), { kind: 'node', id: nodeId })
    return this
  }

  /** Réordonne un nœud dans sa liste parente. */
  reorderNode(nodeId, offset, options = {}) {
    this._record(this._workspace.reorderNode(nodeId, offset, options), { kind: 'node', id: nodeId })
    return this
  }

  /** Renomme un symbole et ses références. */
  renameSymbol(nodeId, name, options = {}) {
    this._record(this._workspace.renameSymbol(nodeId, name, options), { kind: 'node', id: nodeId })
    return this
  }

  /** Remplace les contrats d'un nœud. */
  setNodeContracts(nodeId, contracts) {
    this._record(this._workspace.setNodeContracts(nodeId, contracts), { kind: 'node', id: nodeId })
    return this
  }

  /** Ajoute automatiquement les imports nécessaires. */
  ensureImports(moduleId, sources, idFactory = null) {
    this._record(this._workspace.ensureImports(moduleId, sources, idFactory), { kind: 'module', id: moduleId })
    return this
  }

  /** Ajoute un import, avec résolution optionnelle par nodeName. */
  addImport(moduleId, entry = {}) {
    if (!entry || typeof entry !== 'object') {
      this._fail(PROJECT_ERROR_CODES.invalidArgument, 'Expected an import entry.', { kind: 'import', id: null })
      return this
    }
    const { nodeName, ...rest } = entry
    let nodeId = rest.nodeId ?? null
    if (!nodeId && nodeName) nodeId = resolveNodeId(this._workspace, rest.moduleId ?? rest.targetModuleId, nodeName)
    if (!nodeId && nodeName) {
      this._fail(PROJECT_ERROR_CODES.nodeNotFound, `Unknown imported node: ${nodeName}.`, { kind: 'node', id: null })
      return this
    }
    this._record(this._workspace.addImport(moduleId, { ...rest, ...(nodeId ? { nodeId } : {}) }), { kind: 'import', id: entry.id ?? null })
    return this
  }

  /** Ajoute ou retire un export, avec résolution optionnelle par nodeName. */
  setExport(moduleId, nodeReference, exported = true) {
    const nodeId = resolveNodeId(this._workspace, moduleId, nodeReference)
    if (!nodeId) {
      this._fail(PROJECT_ERROR_CODES.nodeNotFound, `Unknown exported node: ${String(nodeReference)}.`, { kind: 'node', id: null })
      return this
    }
    this._record(this._workspace.setExport(moduleId, nodeId, exported), { kind: 'module', id: moduleId })
    return this
  }

  /** Ajoute une annotation Comment. */
  addComment(options = {}) {
    if (!options || typeof options !== 'object') {
      this._fail(PROJECT_ERROR_CODES.invalidArgument, 'Expected a comment definition.', { kind: 'comment', id: null })
      return this
    }
    this._record(this._workspace.addComment(options), { kind: 'comment', id: options.id ?? null })
    return this
  }

  /** Ajoute une annotation Image. */
  addImage(options = {}) {
    if (!options || typeof options !== 'object') {
      this._fail(PROJECT_ERROR_CODES.invalidArgument, 'Expected an image definition.', { kind: 'image', id: null })
      return this
    }
    this._record(this._workspace.addImage(options), { kind: 'image', id: options.id ?? null })
    return this
  }

  /** Retire une annotation. */
  removeCard(cardId) {
    this._record(this._workspace.removeCard(cardId), { kind: 'card', id: cardId })
    return this
  }

  /** Supprime un module et sa carte. */
  removeModule(moduleId) {
    this._record(this._workspace.removeModule(moduleId), { kind: 'module', id: moduleId })
    return this
  }

  /** Renomme un module et sa carte. */
  renameModule(moduleId, name) {
    this._record(this._workspace.renameModule(moduleId, name), { kind: 'module', id: moduleId })
    return this
  }

  /** Déplace un module sur le canvas. */
  moveModule(moduleId, position = {}) {
    this._record(this._workspace.moveModule(moduleId, position), { kind: 'module', id: moduleId })
    return this
  }

  /** Modifie une carte de présentation. */
  updateCard(cardId, patch = {}) {
    this._record(this._workspace.updateCard(cardId, patch), { kind: 'card', id: cardId })
    return this
  }

  /** Remplace la caméra. */
  setCamera(camera) {
    this._record(this._workspace.setCamera(camera), { kind: 'presentation', id: null })
    return this
  }

  /** Remplace la sélection. */
  setSelected(selected) {
    this._record(this._workspace.setSelected(selected), { kind: 'presentation', id: null })
    return this
  }

  /** Remplace le manifeste d'exercice. */
  setExercise(exercise) {
    this._record(this._workspace.setExercise(exercise), { kind: 'exercise', id: null })
    return this
  }

  /** Remplace la configuration dashboard. */
  setDashboard(dashboard) {
    this._record(this._workspace.setDashboard(dashboard), { kind: 'dashboard', id: null })
    return this
  }

  /** Ajoute les octets d'une image liée. */
  setImageResource(reference, bytes) {
    this._record(this._workspace.setImageResource(reference, bytes), { kind: 'image', id: reference })
    return this
  }

  /** Retire les octets d'une image liée. */
  removeImageResource(reference) {
    this._record(this._workspace.removeImageResource(reference), { kind: 'image', id: reference })
    return this
  }

  /** Ajoute un fichier annexe d'archive. */
  setExtraFile(name, bytes) {
    this._record(this._workspace.setExtraFile(name, bytes), { kind: 'file', id: name })
    return this
  }

  /** Retire un fichier annexe d'archive. */
  removeExtraFile(name) {
    this._record(this._workspace.removeExtraFile(name), { kind: 'file', id: name })
    return this
  }

  /** Retrouve l'identifiant d'une déclaration nommée. */
  nodeId(moduleId, name) {
    return this._workspace.getNodeId(moduleId, name)
  }

  /** Valide le workspace construit et retourne ses diagnostics associés. */
  build(options = {}) {
    const requireValidProgram = options.requireValidProgram !== false
    const validation = this._workspace.validate()
    const diagnostics = [...this._diagnostics]
    const seen = new Set(diagnostics.map(diagnosticKey))
    const append = (diagnostic) => {
      const object = diagnostic.object ?? (diagnostic.location?.nodeId
        ? { kind: 'node', id: diagnostic.location.nodeId }
        : diagnostic.location?.moduleId
          ? { kind: 'module', id: diagnostic.location.moduleId }
          : { kind: 'workspace', id: this._workspace.projectId })
      const entry = { ...diagnostic, object }
      const key = diagnosticKey(entry)
      if (seen.has(key)) return
      seen.add(key)
      diagnostics.push(entry)
    }
    for (const diagnostic of validation.structural.diagnostics) append(diagnostic)
    for (const diagnostic of validation.semantic.diagnostics) append(diagnostic)
    const ok = this._diagnostics.length === 0 && validation.structural.ok && (!requireValidProgram || validation.semantic.ok)
    return { ok, workspace: this._workspace, diagnostics, validation }
  }

  /** Valide et retourne le workspace, ou lève une ProjectError. */
  buildOrThrow(options = {}) {
    const result = this.build(options)
    if (result.ok) return result.workspace
    const first = result.diagnostics[0]
    throw new ProjectError(first?.code ?? PROJECT_ERROR_CODES.semanticInvalid, 'The generated workspace is not valid.', {
      diagnostics: result.diagnostics,
      details: result.validation,
    })
  }

  /** Sérialise le workspace après validation. */
  toJSON(options = {}) {
    return this.buildOrThrow(options).toJSON()
  }
}

// Crée un constructeur déclaratif de workspace.
export function createWorkspaceBuilder(options = {}) {
  return new WorkspaceBuilder(options)
}
