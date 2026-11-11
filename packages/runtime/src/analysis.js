// Clone une valeur publique pour qu'un appelant ne puisse pas muter l'analyse interne.
function clonePublic(value) {
  try {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

// Expose uniquement les informations d'analyse utiles au runtime, sans Maps internes.
export function toRuntimeAnalysis(analysis) {
  return {
    canGenerate: analysis.canGenerate,
    diagnostics: clonePublic(analysis.diagnostics),
    symbols: clonePublic(analysis.semantic.symbols),
    nodeTypes: clonePublic(analysis.semantic.nodeTypes),
    classes: clonePublic(analysis.semantic.classes),
  }
}
