import { isId, isRecord } from './logic/model.js'

export const exerciseVersion = 1
export const maximumExerciseTests = 100

// Erreur stable, traduisible par code dans l'interface.
function exerciseError(message, code = 'EXERCISE_INVALID') {
  return Object.assign(new Error(message), { code })
}

// Un argument d'exercice reste une valeur JSON primitive, jamais un objet implicite.
function validArgument(value) {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
}

// Un snapshot de départ reste un couple projet/présentation, jamais une référence vivante au document.
function validStarter(value) {
  return isRecord(value) && isRecord(value.project) && isRecord(value.presentation) && Array.isArray(value.presentation.cards) && ['x', 'y', 'zoomLevel'].every((key) => Number.isFinite(value.presentation.camera?.[key]))
}

// Un verrou d'édition reste une empreinte PBKDF2, jamais un mot de passe en clair.
function validLock(value) {
  return isRecord(value) && value.algorithm === 'PBKDF2-SHA256' && Number.isInteger(value.iterations) && value.iterations >= 1 && value.iterations <= 1000000 && typeof value.salt === 'string' && value.salt.length > 0 && typeof value.hash === 'string' && value.hash.length > 0
}

// Valide le manifeste avant toute exécution ou écriture, sans compléter les champs manquants.
export function validateExercise(value) {
  if (!isRecord(value) || value.version !== exerciseVersion) throw exerciseError('Unsupported or missing exercise manifest.')
  if (typeof value.title !== 'string' || value.title.trim() === '') throw exerciseError('An exercise needs a non-empty title.')
  if (typeof value.instructions !== 'string') throw exerciseError('Exercise instructions must be text.')
  if (value.starter !== undefined && !validStarter(value.starter)) throw exerciseError('Invalid exercise starter snapshot.')
  if (value.lock !== undefined && !validLock(value.lock)) throw exerciseError('Invalid exercise lock.')
  if (!Array.isArray(value.tests) || value.tests.length > maximumExerciseTests) throw exerciseError('Invalid exercise test list.')
  const ids = new Set()
  for (const test of value.tests) {
    if (!isRecord(test) || !isId(test.id) || ids.has(test.id)) throw exerciseError('Duplicate or invalid test identifier.')
    if (typeof test.title !== 'string' || test.title.trim() === '') throw exerciseError('Every test needs a title.')
    if (test.kind === 'entry') {
      if (!Array.isArray(test.expectedOutput) || test.expectedOutput.some((line) => typeof line !== 'string')) throw exerciseError('Entry tests need an expected output.')
    } else if (test.kind === 'function') {
      if (!isId(test.functionName)) throw exerciseError('Function tests need a function name.')
      if (!Array.isArray(test.args) || test.args.some((argument) => !validArgument(argument))) throw exerciseError('Function test arguments must be JSON primitives.')
      if (test.expectedReturn !== null && typeof test.expectedReturn !== 'string') throw exerciseError('Function tests need a text return value or null.')
    } else {
      throw exerciseError('Unknown exercise test kind.')
    }
    ids.add(test.id)
  }
  return value
}

// Prépare un manifeste vide ; l'enseignant le complète dans le panneau.
export function createExercise({ title = 'Untitled exercise', instructions = '', starter = null } = {}) {
  return validateExercise({ version: exerciseVersion, title, instructions, tests: [], ...(starter ? { starter } : {}) })
}

// Capture la sortie du point d'entrée comme attendu d'un nouveau test.
export function createEntryTest(title, expectedOutput, idFactory = () => crypto.randomUUID()) {
  return { id: idFactory(), kind: 'entry', title, expectedOutput: [...expectedOutput] }
}

// Capture la valeur de retour d'une fonction comme attendu d'un nouveau test.
export function createFunctionTest(title, functionName, args, expectedReturn, idFactory = () => crypto.randomUUID()) {
  return { id: idFactory(), kind: 'function', title, functionName, args: [...args], expectedReturn }
}

// Résout une fonction par son nom ; un nom ambigu est refusé plutôt que choisi au hasard.
export function findFunction(project, name) {
  const matches = (project?.nodes ?? []).filter((node) => node?.kind === 'FunctionDeclaration' && node?.properties?.name === name)
  if (matches.length === 0) return { ok: false, code: 'EXERCISE_FUNCTION_MISSING' }
  if (matches.length > 1) return { ok: false, code: 'EXERCISE_FUNCTION_AMBIGUOUS' }
  return { ok: true, id: matches[0].id }
}

// Compare une exécution au test, sans convertir implicitement les valeurs.
function compareTest(test, result) {
  if (!result?.ok) {
    return { id: test.id, title: test.title, kind: test.kind, status: 'error', errorCode: result?.errorCode ?? 'SIMULATION_FAILED', expected: null, actual: null }
  }
  if (test.kind === 'entry') {
    const actual = Array.isArray(result.output) ? result.output : []
    const passed = actual.length === test.expectedOutput.length && actual.every((line, index) => line === test.expectedOutput[index])
    return { id: test.id, title: test.title, kind: test.kind, status: passed ? 'pass' : 'fail', expected: test.expectedOutput, actual }
  }
  const actual = result.returnValue ?? null
  return { id: test.id, title: test.title, kind: test.kind, status: actual === test.expectedReturn ? 'pass' : 'fail', expected: test.expectedReturn, actual }
}

// Exécute chaque test dans l'ordre avec le lanceur fourni (worker ou moteur synchrone).
export async function evaluateExercise(project, exercise, run, { signal = null } = {}) {
  validateExercise(exercise)
  const results = []
  for (const test of exercise.tests) {
    if (signal?.aborted) throw exerciseError('Exercise check cancelled.', 'ENGINE_CANCELLED')
    const options = test.kind === 'entry' ? {} : (() => {
      const target = findFunction(project, test.functionName)
      return target.ok ? { functionId: target.id, args: test.args } : null
    })()
    if (options === null) {
      results.push({ id: test.id, title: test.title, kind: test.kind, status: 'error', errorCode: 'EXERCISE_FUNCTION_MISSING', expected: null, actual: null })
      continue
    }
    let result
    try {
      result = await run(options)
    } catch (error) {
      if (error?.code === 'ENGINE_CANCELLED') throw error
      results.push({ id: test.id, title: test.title, kind: test.kind, status: 'error', errorCode: error?.code ?? 'ENGINE_FAILED', expected: null, actual: null })
      continue
    }
    results.push(compareTest(test, result))
  }
  const passed = results.filter((entry) => entry.status === 'pass').length
  return { total: results.length, passed, failed: results.length - passed, results }
}

// Présente un résumé court, utilisé par le panneau et les notifications.
export function summarizeExercise(summary) {
  if (!summary) return null
  return { total: summary.total, passed: summary.passed, failed: summary.failed, complete: summary.total > 0 && summary.failed === 0 }
}

// Prépare la notification du robot : succès seulement si tous les tests passent, sinon erreur temporaire.
export function exerciseNotification(summary, t) {
  if (!summary || summary.total === 0) return null
  const passed = summary.failed === 0
  return {
    type: passed ? 'success' : 'error',
    message: passed ? t('exercise.notifyPass', { total: summary.total }) : t('exercise.notifyFail', { failed: summary.failed, total: summary.total }),
    key: 'exercise-result',
    duration: passed ? 4500 : 6000,
  }
}

// Propose un nom d'archive portable pour la solution, sans caractère interdit sous Windows.
export function solutionFileName(title) {
  const base = String(title ?? '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || 'exercise'}-solution.zip`
}
