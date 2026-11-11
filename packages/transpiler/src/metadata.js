// Ajoute les champs de localisation utiles sans retirer le diagnostic d'origine.
export function normalizeDiagnostics(diagnostics = []) {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    nodeId: diagnostic.location?.nodeId ?? null,
    moduleId: diagnostic.location?.moduleId ?? null,
    field: diagnostic.location?.field ?? null,
  }))
}

// Liste les nœuds couverts par une sélection de module ou de nœud.
export function selectionNodeIds(project, selection) {
  const ids = new Set()
  if (selection.kind === 'module') {
    for (const node of project.nodes) if (node.moduleId === selection.id) ids.add(node.id)
    return ids
  }
  const byId = new Map(project.nodes.map((node) => [node.id, node]))
  const pending = [selection.id]
  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || ids.has(id)) continue
    ids.add(id)
    const node = byId.get(id)
    if (!node) continue
    for (const value of Object.values(node.children ?? {})) {
      for (const childId of Array.isArray(value) ? value : [value]) if (typeof childId === 'string') pending.push(childId)
    }
  }
  return ids
}

// Décrit les helpers et dépendances d'un fichier autonome.
export function helpersFor(target) {
  if (target === 'c') return { embedded: true, standalone: true, external: ['libc', 'libm'], compileFlags: ['-std=c11', '-lm'] }
  if (target === 'python') return { embedded: true, standalone: true, external: ['python3-stdlib'], compileFlags: [] }
  if (target === 'javascript') return { embedded: true, standalone: true, external: [], compileFlags: [] }
  return { embedded: false, standalone: false, external: [], compileFlags: [] }
}

// Décrit les helpers d'un extrait de prévisualisation.
function fragmentHelpers(target) {
  return { ...helpersFor(target), embedded: false, standalone: false }
}

// Décrit le statut de la cible dans les métadonnées.
function targetMetadata(descriptor) {
  return {
    targetStatus: descriptor?.status ?? 'unavailable',
    operational: descriptor?.operational ?? false,
    experimental: descriptor?.experimental ?? false,
    capabilities: descriptor?.capabilities ?? null,
  }
}

// Construit les métadonnées d'un programme autonome.
export function buildProgramMetadata(result, descriptor, target) {
  const code = result.code ?? ''
  const metadata = result.metadata ?? null
  return {
    mode: 'program',
    target,
    standalone: true,
    codeLength: code.length,
    fragments: [{ id: 'program', kind: 'program', sourceId: null, start: 0, end: code.length }],
    declarations: metadata?.declarations ?? [],
    classes: metadata?.classes ?? [],
    entryPoint: metadata?.entryPoint ?? null,
    helpers: helpersFor(target),
    ...targetMetadata(descriptor),
  }
}

// Construit les métadonnées d'un module ou d'une sélection de nœud.
export function buildSelectionMetadata(project, selection, result, descriptor, target) {
  const code = result.code ?? ''
  const selectedNode = selection.kind === 'node' ? project.nodes.find((node) => node.id === selection.id) ?? null : null
  const selectedModule = selection.kind === 'module' ? project.modules.find((module) => module.id === selection.id) ?? null : null
  const classModule = selectedNode ? project.modules.find((module) => module.id === selectedNode.moduleId && module.kind === 'class') ?? null : null
  const expandedTo = classModule ? { kind: 'module', id: classModule.id } : null
  const effectiveSelection = expandedTo ?? selection
  const ids = selectionNodeIds(project, effectiveSelection)
  const metadata = result.metadata ?? null
  const declarations = (metadata?.declarations ?? []).filter((entry) => ids.has(entry.nodeId))
  const classes = (metadata?.classes ?? []).filter((entry) => ids.has(entry.classId) || effectiveSelection.kind === 'module' && entry.classId === effectiveSelection.id)
  return {
    mode: selection.kind === 'module' ? 'module' : 'selection',
    target,
    standalone: false,
    codeLength: code.length,
    selection,
    ...(expandedTo ? { expandedTo } : {}),
    fragments: [{ id: `${effectiveSelection.kind}:${effectiveSelection.id}`, kind: effectiveSelection.kind, sourceId: effectiveSelection.id, start: 0, end: code.length }],
    declarations,
    classes,
    entryPoint: null,
    helpers: fragmentHelpers(target),
    ...targetMetadata(descriptor),
  }
}
