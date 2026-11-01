import { useState } from 'react'
import { Bug, Play, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { failureLabel } from '../../utils/translations.js'
import './FunctionPanel.css'

const numericTypes = new Set(['short int', 'short uint', 'int', 'uint', 'float', 'double'])
const textTypes = new Set(['string', 'char'])

// Nom primitif d'un type, ou null quand l'entrée n'est pas un primitif simple.
function primitiveName(type) {
  return type?.kind === 'primitive' ? type.name : null
}

// Valeur par défaut d'un champ selon son type déclaré.
function defaultValue(type) {
  const name = primitiveName(type)
  if (name === 'boolean') return 'false'
  if (textTypes.has(name)) return ''
  return numericTypes.has(name) ? '0' : ''
}

// Convertit la saisie en valeur brute attendue par le moteur.
function parseValue(type, raw) {
  const name = primitiveName(type)
  if (name === 'boolean') return raw === 'true'
  if (numericTypes.has(name)) return raw.trim() === '' ? Number.NaN : Number(raw)
  return raw
}

// Saisit les entrées d'une fonction et présente son résultat, sa sortie et ses variables.
export default function FunctionPanel({ index, functionNode, result, onRun, onDebug, onClose }) {
  const { t } = useTranslation()
  const parameters = (functionNode.children.parameters ?? []).map((id) => {
    const node = index.nodes.get(id)
    return { id, name: node?.properties?.name ?? id, type: node?.properties?.type ?? null }
  })
  const [inputs, setInputs] = useState(() => parameters.map((parameter) => defaultValue(parameter.type)))
  const unsupported = parameters.some((parameter) => !['boolean', ...textTypes, ...numericTypes].includes(primitiveName(parameter.type)))
  const name = functionNode.properties?.name || t('details.block')
  const collect = () => parameters.map((parameter, position) => parseValue(parameter.type, inputs[position] ?? ''))

  // Met à jour une entrée sans valider la valeur : le moteur reste seul juge.
  function update(position, value) {
    setInputs((current) => current.map((entry, index2) => index2 === position ? value : entry))
  }

  // Rend un champ adapté au type du paramètre.
  function inputFor(parameter, position) {
    const type = primitiveName(parameter.type)
    if (type === 'boolean') {
      return <select value={inputs[position]} aria-label={parameter.name} onChange={(event) => update(position, event.target.value)}>
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    }
    return <input type="text" value={inputs[position]} aria-label={parameter.name} spellCheck={false} inputMode={numericTypes.has(type) ? 'decimal' : 'text'} onChange={(event) => update(position, event.target.value)} />
  }

  return <aside className="function-panel" data-canvas-ui data-canvas-scroll aria-label={t('function.title', { name })} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <header>
      <h2>{t('function.title', { name })}</h2>
      <button type="button" aria-label={t('function.close')} onClick={onClose}><X size={16} aria-hidden="true" /></button>
    </header>
    <h3>{t('function.inputs')}</h3>
    {parameters.length === 0
      ? <p>{t('function.noInputs')}</p>
      : <div className="function-panel__inputs">{parameters.map((parameter, position) => <label key={parameter.id}><span>{parameter.name}</span>{inputFor(parameter, position)}</label>)}</div>}
    {unsupported && <p role="alert">{t('function.unsupported')}</p>}
    <div className="function-panel__actions">
      <button type="button" disabled={unsupported} onClick={() => onRun(collect())}><Play size={14} aria-hidden="true" />{t('function.run')}</button>
      <button type="button" disabled={unsupported} onClick={() => onDebug(collect())}><Bug size={14} aria-hidden="true" />{t('function.debug')}</button>
    </div>
    {result && (result.ok ? <>
      <h3>{t('function.returnValue')}</h3>
      <p className="function-panel__return">{result.returnValue === null || result.returnValue === undefined ? t('function.noReturn') : result.returnValue}</p>
      <h3>{t('function.output')}</h3>
      <pre>{result.output.join('\n') || t('simulation.noOutput')}</pre>
      <h3>{t('function.variables')}</h3>
      {result.variables?.length
        ? <ul className="function-panel__variables">{result.variables.map((variable) => <li key={variable.id} data-scope={variable.kind}><code>{variable.name}</code>{variable.type && <span>{variable.type}</span>}<strong>{variable.value}</strong></li>)}</ul>
        : <p>{t('function.noVariables')}</p>}
    </> : <p className="function-panel__error" role="alert">{failureLabel({ code: result.errorCode ?? 'SIMULATION_FAILED' }, t)}</p>)}
  </aside>
}
