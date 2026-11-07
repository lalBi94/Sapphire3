import { useState } from 'react'
import { Check, CircleX, Lock, Pencil, Plus, RotateCcw, Save, Square, Trash2, TriangleAlert, Unlock } from 'lucide-react'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { createEntryTest, createFunctionTest } from '../../utils/exercise.js'
import { createExerciseLock, verifyExerciseLock } from '../../utils/exerciseLock.js'
import { defaultValue, isEditableType, parseValue, primitiveName } from '../../utils/functionInputs.js'
import './ExercisePanel.css'

// Présente la consigne, lance les tests et permet à l'enseignant de capturer les résultats attendus.
export default function ExercisePanel({ exercise, onChange, index, state, onClose, onRemove, onReset, onSaveSolution, readOnly = false }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [functionId, setFunctionId] = useState('')
  const [inputs, setInputs] = useState([])
  const [unlocked, setUnlocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [lockError, setLockError] = useState('')
  const [lockBusy, setLockBusy] = useState(false)
  if (!exercise) return null

  const functions = [...index.nodes.values()].filter((node) => node.kind === 'FunctionDeclaration')
  const selectedFunction = functions.find((node) => node.id === functionId) ?? null
  const parameters = (selectedFunction?.children.parameters ?? []).map((id) => {
    const node = index.nodes.get(id)
    return { id, name: node?.properties?.name ?? id, type: node?.properties?.type ?? null }
  })
  const editable = parameters.every((parameter) => isEditableType(parameter.type))
  const results = new Map((state.summary?.results ?? []).map((result) => [result.id, result]))
  const complete = Boolean(state.summary && state.summary.total > 0 && state.summary.failed === 0)
  const locked = Boolean(exercise.lock) && !unlocked

  // Met à jour un champ du manifeste sans créer d'étape undo.
  function update(patch) {
    onChange({ ...exercise, ...patch })
  }

  // Vérifie le mot de passe puis ouvre l'édition pour la session courante.
  async function unlockExercise() {
    setLockBusy(true)
    setLockError('')
    const valid = await verifyExerciseLock(unlockPassword, exercise.lock)
    setLockBusy(false)
    if (!valid) {
      setLockError('exercise.wrongPassword')
      return
    }
    setUnlocked(true)
    setUnlocking(false)
    setUnlockPassword('')
    setEditing(true)
  }

  // Hache le mot de passe et verrouille l'édition ; aucun secret en clair n'est conservé.
  async function protectExercise() {
    if (password.length < 4) {
      setLockError('exercise.passwordTooShort')
      return
    }
    if (password !== passwordConfirm) {
      setLockError('exercise.passwordMismatch')
      return
    }
    setLockBusy(true)
    setLockError('')
    try {
      const lock = await createExerciseLock(password)
      update({ lock })
      setPassword('')
      setPasswordConfirm('')
      setEditing(false)
      setUnlocked(false)
    } catch {
      setLockError('exercise.lockFailed')
    } finally {
      setLockBusy(false)
    }
  }

  // Retire le verrou après déverrouillage, sans toucher aux tests ni au squelette.
  function removeProtection() {
    const { lock: _lock, ...rest } = exercise
    onChange(rest)
    setUnlocked(false)
    setEditing(false)
    setLockError('')
  }

  // Capture la sortie du point d'entrée et l'ajoute comme test.
  async function addEntryTest() {
    setCaptureError('')
    const result = await state.captureEntry()
    if (!result.ok) {
      setCaptureError(result.code)
      return
    }
    update({ tests: [...exercise.tests, createEntryTest(t('exercise.testName', { index: exercise.tests.length + 1 }), result.output)] })
  }

  // Change de fonction cible et réinitialise les champs d'arguments.
  function selectFunction(id) {
    const node = functions.find((entry) => entry.id === id)
    const nextParameters = (node?.children.parameters ?? []).map((parameterId) => index.nodes.get(parameterId)?.properties?.type ?? null)
    setFunctionId(id)
    setInputs(nextParameters.map((type) => defaultValue(type)))
    setCaptureError('')
  }

  // Capture la valeur de retour d'une fonction avec les arguments saisis.
  async function addFunctionTest() {
    setCaptureError('')
    if (!selectedFunction || !editable) return
    const args = parameters.map((parameter, position) => parseValue(parameter.type, inputs[position] ?? ''))
    const result = await state.captureFunction(selectedFunction.id, args)
    if (!result.ok) {
      setCaptureError(result.code)
      return
    }
    const name = selectedFunction.properties?.name ?? selectedFunction.id
    update({ tests: [...exercise.tests, createFunctionTest(t('exercise.functionTest', { name }), name, args, result.returnValue)] })
  }

  // Supprime un test précis sans toucher aux autres.
  function removeTest(id) {
    update({ tests: exercise.tests.filter((test) => test.id !== id) })
  }

  // Affiche une valeur attendue ou obtenue de façon lisible, sans inventer de contenu.
  function format(value) {
    if (value === null || value === undefined) return t('exercise.noValue')
    return Array.isArray(value) ? value.join('\n') || t('exercise.noOutput') : String(value)
  }

  // Icône et libellé cohérents avec le statut du test.
  function statusOf(test) {
    const result = results.get(test.id)
    if (!result) return { icon: null, label: '' }
    if (result.status === 'pass') return { icon: <Check size={14} aria-hidden="true" />, label: t('exercise.passed') }
    if (result.status === 'fail') return { icon: <CircleX size={14} aria-hidden="true" />, label: t('exercise.failed') }
    return { icon: <TriangleAlert size={14} aria-hidden="true" />, label: result.errorCode ?? t('exercise.error') }
  }

  return <FloatingPanel title={t('exercise.title')} label={t('exercise.title')} onClose={onClose} className="exercise-panel">
    <div className="exercise-panel__body">
      {editing ? <>
        <label className="exercise-panel__field">{t('exercise.titleField')}
          <input value={exercise.title} maxLength={120} onChange={(event) => update({ title: event.target.value })} />
        </label>
        <label className="exercise-panel__field">{t('exercise.instructions')}
          <textarea value={exercise.instructions} rows={5} placeholder={t('exercise.instructionsPlaceholder')} onChange={(event) => update({ instructions: event.target.value })} />
        </label>

        <h3>{t('exercise.tests')} · {exercise.tests.length}</h3>
        {exercise.tests.length === 0
          ? <p className="exercise-panel__empty">{t('exercise.noTests')}</p>
          : <ul className="exercise-panel__tests">{exercise.tests.map((test) => <li key={test.id}>
            <span>{test.title}</span>
            <button type="button" aria-label={t('exercise.removeTest')} title={t('exercise.removeTest')} onClick={() => removeTest(test.id)}><Trash2 size={14} aria-hidden="true" /></button>
          </li>)}</ul>}

        <button type="button" className="exercise-panel__action" onClick={addEntryTest}><Plus size={14} aria-hidden="true" />{t('exercise.addEntry')}</button>

        <h3>{t('exercise.addFunction')}</h3>
        {functions.length === 0
          ? <p className="exercise-panel__empty">{t('exercise.noFunctions')}</p>
          : <>
            <label className="exercise-panel__field">{t('exercise.function')}
              <select value={functionId} onChange={(event) => selectFunction(event.target.value)}>
                <option value="">{t('exercise.chooseFunction')}</option>
                {functions.map((node) => <option key={node.id} value={node.id}>{node.properties?.name ?? node.id}</option>)}
              </select>
            </label>
            {selectedFunction && <div className="exercise-panel__arguments">
              {parameters.map((parameter, position) => <label key={parameter.id}><span>{parameter.name} · {primitiveName(parameter.type) ?? '?'}</span>
                {primitiveName(parameter.type) === 'boolean'
                  ? <select value={inputs[position] ?? 'false'} onChange={(event) => setInputs((current) => current.map((entry, index2) => index2 === position ? event.target.value : entry))}><option value="false">false</option><option value="true">true</option></select>
                  : <input value={inputs[position] ?? ''} spellCheck={false} onChange={(event) => setInputs((current) => current.map((entry, index2) => index2 === position ? event.target.value : entry))} />}
              </label>)}
            </div>}
            <button type="button" className="exercise-panel__action" disabled={!selectedFunction || !editable} onClick={addFunctionTest}><Plus size={14} aria-hidden="true" />{t('exercise.captureReturn')}</button>
          </>}
        {captureError && <p className="exercise-panel__error" role="alert">{captureError}</p>}
        <div className="exercise-panel__actions"><button type="button" className="exercise-panel__primary" onClick={() => setEditing(false)}><Check size={14} aria-hidden="true" />{t('exercise.done')}</button></div>
        <div className="exercise-panel__protection">
          <h3>{t('exercise.protection')}</h3>
          {exercise.lock
            ? <>
              <p className="exercise-panel__hint">{t('exercise.protected')}</p>
              <button type="button" className="exercise-panel__action" onClick={removeProtection}><Unlock size={14} aria-hidden="true" />{t('exercise.removeProtection')}</button>
            </>
            : <>
              <p className="exercise-panel__hint">{t('exercise.lockHint')}</p>
              <label className="exercise-panel__field">{t('exercise.password')}
                <input type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setLockError('') }} />
              </label>
              <label className="exercise-panel__field">{t('exercise.confirmPassword')}
                <input type="password" autoComplete="new-password" value={passwordConfirm} onChange={(event) => { setPasswordConfirm(event.target.value); setLockError('') }} />
              </label>
              {lockError && <p className="exercise-panel__error" role="alert">{t(lockError)}</p>}
              <button type="button" className="exercise-panel__action" disabled={lockBusy || password.length === 0 || passwordConfirm.length === 0} onClick={protectExercise}><Lock size={14} aria-hidden="true" />{t('exercise.protect')}</button>
            </>}
        </div>
        {onRemove && <div className="exercise-panel__danger">
          {confirmRemove
            ? <>
              <p>{t('exercise.removeConfirm')}</p>
              <div className="exercise-panel__actions">
                <button type="button" className="exercise-panel__danger-button" onClick={() => { setConfirmRemove(false); onRemove() }}><Trash2 size={14} aria-hidden="true" />{t('exercise.remove')}</button>
                <button type="button" onClick={() => setConfirmRemove(false)}>{t('exercise.cancel')}</button>
              </div>
            </>
            : <button type="button" onClick={() => setConfirmRemove(true)}><Trash2 size={14} aria-hidden="true" />{t('exercise.remove')}</button>}
        </div>}
      </> : <>
        <h3 className="exercise-panel__title">{exercise.title}</h3>
        <p className="exercise-panel__instructions">{exercise.instructions || t('exercise.noInstructions')}</p>
        <p className="exercise-panel__meta">{t('exercise.tests')} · {exercise.tests.length}</p>
        {state.summary && <p className={`exercise-panel__summary${state.summary.failed === 0 ? ' exercise-panel__summary--pass' : ''}`} role="status">{t('exercise.summary', { passed: state.summary.passed, total: state.summary.total })}</p>}
        {state.error && <p className="exercise-panel__error" role="alert">{state.error}</p>}
        <div className="exercise-panel__actions">
          {state.status === 'running'
            ? <button type="button" onClick={state.cancel}><Square size={14} aria-hidden="true" />{t('exercise.cancel')}</button>
            : <button type="button" className="exercise-panel__primary" disabled={exercise.tests.length === 0} onClick={state.check}><Check size={14} aria-hidden="true" />{t('exercise.check')}</button>}
          {!readOnly && (locked
            ? <button type="button" onClick={() => { setUnlocking(true); setLockError('') }}><Lock size={14} aria-hidden="true" />{t('exercise.unlock')}</button>
            : <button type="button" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />{t('exercise.edit')}</button>)}
          {complete && onSaveSolution && <button type="button" onClick={onSaveSolution}><Save size={14} aria-hidden="true" />{t('exercise.saveSolution')}</button>}
          {onReset && <button type="button" onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden="true" />{t('exercise.reset')}</button>}
        </div>
        {unlocking && <div className="exercise-panel__unlock">
          <p className="exercise-panel__hint">{t('exercise.unlockHint')}</p>
          <label className="exercise-panel__field">{t('exercise.password')}
            <input type="password" autoComplete="off" value={unlockPassword} onChange={(event) => { setUnlockPassword(event.target.value); setLockError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); unlockExercise() } }} />
          </label>
          {lockError && <p className="exercise-panel__error" role="alert">{t(lockError)}</p>}
          <div className="exercise-panel__actions">
            <button type="button" className="exercise-panel__primary" disabled={lockBusy || unlockPassword.length === 0} onClick={unlockExercise}><Unlock size={14} aria-hidden="true" />{t('exercise.unlockAction')}</button>
            <button type="button" onClick={() => { setUnlocking(false); setUnlockPassword(''); setLockError('') }}>{t('exercise.cancel')}</button>
          </div>
        </div>}
        {confirmReset && <div className="exercise-panel__danger">
          <p>{t('exercise.resetConfirm')}</p>
          <div className="exercise-panel__actions">
            <button type="button" className="exercise-panel__danger-button" onClick={() => { setConfirmReset(false); onReset() }}><RotateCcw size={14} aria-hidden="true" />{t('exercise.reset')}</button>
            <button type="button" onClick={() => setConfirmReset(false)}>{t('exercise.cancel')}</button>
          </div>
        </div>}
        {exercise.tests.length === 0
          ? <p className="exercise-panel__empty">{t('exercise.noTests')}</p>
          : <ul className="exercise-panel__results">{exercise.tests.map((test) => {
            const status = statusOf(test)
            const result = results.get(test.id)
            return <li key={test.id} data-status={result?.status ?? 'idle'}>
              <span className="exercise-panel__result-title">{status.icon}{test.title}</span>
              {status.label && <span className="exercise-panel__result-status">{status.label}</span>}
              {result && result.status !== 'pass' && <div className="exercise-panel__compare">
                <div><span>{t('exercise.expected')}</span><pre>{format(result.expected)}</pre></div>
                <div><span>{t('exercise.actual')}</span><pre>{format(result.actual)}</pre></div>
              </div>}
            </li>
          })}</ul>}
      </>}
    </div>
  </FloatingPanel>
}
