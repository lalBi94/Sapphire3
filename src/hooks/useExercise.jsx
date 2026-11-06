import { useEffect, useRef, useState } from 'react'
import { evaluateExercise } from '../utils/exercise.js'
import { runSimulation } from '../services/engineRunner.js'

// Orchestre l'évaluation dans le worker existant, avec annulation et capture des résultats de référence.
export default function useExercise({ project, exercise }) {
  const [status, setStatus] = useState('idle')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const controller = useRef(null)

  // Une modification du programme invalide les résultats précédents et arrête une vérification en cours.
  useEffect(() => {
    controller.current?.abort()
    controller.current = null
    setStatus('idle')
    setSummary(null)
    setError(null)
  }, [project])

  // Interrompt immédiatement le worker ; une évaluation partielle n'est jamais publiée comme réussie.
  function cancel() {
    controller.current?.abort()
    controller.current = null
    setStatus('idle')
  }

  // Exécute tous les tests dans l'ordre et conserve le détail par test.
  async function check() {
    if (!exercise) return null
    cancel()
    const next = new AbortController()
    controller.current = next
    setStatus('running')
    setSummary(null)
    setError(null)
    try {
      const result = await evaluateExercise(project, exercise, (options) => runSimulation(project, options, { signal: next.signal }), { signal: next.signal })
      setSummary(result)
      setStatus('done')
      return result
    } catch (failure) {
      if (failure?.code === 'ENGINE_CANCELLED') {
        setStatus('idle')
        return null
      }
      setError(failure?.code ?? 'EXERCISE_FAILED')
      setStatus('error')
      return null
    } finally {
      if (controller.current === next) controller.current = null
    }
  }

  // Exécute le point d'entrée courant pour capturer une sortie attendue.
  async function captureEntry() {
    try {
      const result = await runSimulation(project, {})
      return result.ok ? { ok: true, output: result.output } : { ok: false, code: result.errorCode ?? 'SIMULATION_FAILED' }
    } catch (failure) {
      return { ok: false, code: failure?.code ?? 'ENGINE_FAILED' }
    }
  }

  // Exécute une fonction avec des arguments typés pour capturer sa valeur de retour.
  async function captureFunction(functionId, args) {
    try {
      const result = await runSimulation(project, { functionId, args })
      return result.ok ? { ok: true, returnValue: result.returnValue ?? null, output: result.output } : { ok: false, code: result.errorCode ?? 'SIMULATION_FAILED' }
    } catch (failure) {
      return { ok: false, code: failure?.code ?? 'ENGINE_FAILED' }
    }
  }

  return { status, summary, error, check, cancel, captureEntry, captureFunction }
}
