import { analyzeProgram } from '../logic/analysis.js'
import { hasBlockingDiagnostics } from '../logic/diagnostics.js'
import { generateJavaScript } from './javascript.js'

const backends = Object.freeze({ javascript: generateJavaScript })

// Transpile un programme Sapphire vers une cible enregistrée sans coupler l'AST à cette cible.
export function transpileProgram(source, options = {}) {
  const target = options.target ?? 'javascript'
  const analysis = analyzeProgram(source)
  const backend = backends[target]
  if (!backend) {
    return { ok: false, target, code: '', diagnostics: [{ code: 'TRANSPILE_TARGET_UNSUPPORTED', severity: 'error', message: `Cible non prise en charge : ${target}.`, location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }], analysis }
  }
  const generated = backend(analysis)
  const diagnostics = [...analysis.diagnostics, ...generated.diagnostics]
  return { ok: !hasBlockingDiagnostics(diagnostics), target, code: generated.code, diagnostics, analysis }
}

// Retourne les cibles effectivement installées pour alimenter l'interface sans dupliquer la liste.
export function getTranspilationTargets() {
  return Object.keys(backends)
}
