import { analyzeProgram } from './analysis.js'
import { createContextIndex } from './contextResolver.js'
import { addModuleImport, removeModuleImport } from './moduleInterface.js'
import { updateSourceNode } from './sourceMutation.js'
import { sameType } from './primitives.js'
import { inputButtonOnClickBinding } from './inputButtonState.js'

const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const callbackType = { kind: 'function', parameters: [booleanType], returnType: voidType }

// Vérifie qu'une fonction accepte exactement un booléen et ne retourne rien.
export function isInputButtonCallbackType(type) {
  return sameType(type, callbackType)
}

// Vérifie qu'un nœud est la fonction vide interne d'un bouton.
export function isInputButtonNoop(node) {
  return node?.kind === 'FunctionDeclaration' && typeof node?.properties?.name === 'string' && node.properties.name.startsWith('INPUT_SP3_GLOBAL_NOOP_')
}

// Compte les références restantes à un import dans un module.
function importReferenceCount(project, moduleId, importId) {
  return (project?.nodes ?? []).filter((node) => node?.moduleId === moduleId && node?.references?.target?.kind === 'import' && node?.references?.target?.importId === importId).length
}

// Choisit un nom local libre pour l'import du callback.
function availableImportName(project, moduleId, baseName, index) {
  const analysis = analyzeProgram(project)
  const scopeId = analysis.semantic.scopes.find((scope) => scope.moduleId === moduleId && scope.parentId === null)?.id ?? null
  const names = new Set(analysis.semantic.symbols.filter((symbol) => symbol.scopeId === scopeId).map((symbol) => symbol.name))
  if (!names.has(baseName)) return baseName
  let suffix = 1
  let candidate = `${baseName}_${index}`
  while (names.has(candidate)) {
    suffix += 1
    candidate = `${baseName}_${index}_${suffix}`
  }
  return candidate
}

// Lie ou retire la fonction `onClick(bool)` d'un bouton, sans toucher au reste du module.
export function bindInputButtonCallback(project, moduleId, targetFunctionId) {
  const failure = (code) => ({ ok: false, code, project })
  if (!Array.isArray(project?.modules) || !Array.isArray(project?.nodes)) return failure('SOURCE_INVALID')
  const module = project.modules.find((entry) => entry?.id === moduleId)
  if (!module?.inputButton) return failure('INPUT_BUTTON_MISSING')
  const binding = inputButtonOnClickBinding(project, moduleId)
  if (!binding?.initializerId) return failure('INPUT_BUTTON_CALLBACK_MISSING')

  const unbind = targetFunctionId === null || targetFunctionId === undefined || targetFunctionId === ''
  const analysis = analyzeProgram(project)
  let targetSymbol = null
  if (!unbind) {
    targetSymbol = analysis.semantic.symbols.find((symbol) => symbol.nodeId === targetFunctionId && symbol.kind === 'FunctionDeclaration') ?? null
    const targetNode = project.nodes.find((node) => node?.id === targetFunctionId)
    if (!targetSymbol || !targetNode || isInputButtonNoop(targetNode)) return failure('INPUT_BUTTON_CALLBACK_INVALID')
    if (!isInputButtonCallbackType(targetSymbol.type)) return failure('INPUT_BUTTON_CALLBACK_TYPE')
  }

  let next = project
  let nextImportId = null
  let target = { kind: 'name', name: binding.noopName }

  if (!unbind) {
    const targetModuleId = targetSymbol.moduleId
    if (targetModuleId === moduleId) {
      target = { kind: 'name', name: targetSymbol.name }
    } else {
      const existing = (module.imports ?? []).find((entry) => entry?.moduleId === targetModuleId && entry?.nodeId === targetFunctionId)
      const importId = existing?.id ?? `input-button:${moduleId}:${targetFunctionId}`
      if (existing) {
        nextImportId = existing.id
      } else {
        const localName = availableImportName(project, moduleId, targetSymbol.name, module.inputButton.index)
        const imported = addModuleImport(project, moduleId, { id: importId, targetModuleId, nodeId: targetFunctionId, localName })
        if (!imported.ok) return failure(imported.code)
        next = imported.project
        nextImportId = importId
      }
      target = { kind: 'import', importId }
    }
  }

  const updated = updateSourceNode(next, binding.initializerId, { references: { target } })
  if (!updated.ok) return failure(updated.code)
  next = updated.project

  // Retire l'ancien import de binding s'il n'est plus utilisé ailleurs.
  if (binding.importId && binding.importId !== nextImportId && importReferenceCount(next, moduleId, binding.importId) === 0) {
    const removed = removeModuleImport(next, moduleId, binding.importId)
    if (removed.ok) next = removed.project
  }

  const nextAnalysis = analyzeProgram(next)
  return {
    ok: true,
    project: next,
    analysis: nextAnalysis,
    index: createContextIndex(next, nextAnalysis),
    callbackId: unbind ? null : targetFunctionId,
    importId: nextImportId,
  }
}
