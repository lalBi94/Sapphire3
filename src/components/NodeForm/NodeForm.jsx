import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { getNodeSchema, binaryOperators, unaryOperators, primitiveType, getVisibleSymbols, sameType, acceptsOperand } from '../../utils/logic/index.js'
import { initialNodeForm, nodeConfiguration } from './nodeConfiguration.js'
import NodeTypeInput from './NodeTypeInput.jsx'
import NodeValueInput from './NodeValueInput.jsx'
import ExpressionInput from './ExpressionInput.jsx'
import { diagnosticLabel } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../i18n.jsx'
import './NodeForm.css'

// Configure les propriétés du langage sans éditer ni remplacer implicitement les liens syntaxiques.
export default function NodeForm({ kind, initialNode = null, context, onSubmit, submitLabel = 'Create node' }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(() => initialNodeForm(kind, initialNode, context.expectedType, getVisibleSymbols(context)))
  const [error, setError] = useState('')

  const schema = getNodeSchema(kind)
  const symbols = getVisibleSymbols(context)
  const type = form.typeName === '@alias' ? initialNode?.properties.type : primitiveType(form.typeName)
  const resolvedName = form.typeName === '@alias' ? context.index.nodeTypes.get(initialNode?.id)?.name : form.typeName
  const isNew = !initialNode
  const required = !form.allowIncomplete
  const entryPointTaken = [...context.index.nodes.values()].some((node) => node.id !== initialNode?.id && node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  const references = symbols.filter((symbol) => {
    if (kind === 'CallExpression') return symbol.type?.kind === 'function' && (!isNew || !context.expectedType || sameType(context.expectedType, symbol.type.returnType))
    if (context.record.kind === 'CallExpression' && context.slot?.name === 'callee') return symbol.type?.kind === 'function'
    if (context.record.kind === 'AssignmentStatement' && context.slot?.name === 'target') return ['VariableDeclaration', 'Parameter'].includes(symbol.kind)
    return symbol.kind !== 'TypeDeclaration' && (!isNew || !context.expectedType || sameType(context.expectedType, symbol.type))
  })
  const unresolved = initialNode?.references?.target && !symbols.some((symbol) => symbol.id === form.symbolId)
  const operators = Object.entries(kind === 'BinaryExpression' ? binaryOperators : unaryOperators).filter(([, rule]) => !isNew || !context.expectedType || (rule.result === 'same' ? acceptsOperand(rule.operands, context.expectedType) : rule.result === context.expectedType.name))

  // Change une propriété de brouillon sans modifier le programme avant confirmation.
  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  // Les erreurs du moteur restent structurées ; l'interface affiche une explication courte.
  function handleSubmit(event) {
    event.preventDefault()
    if (required && ((schema.named && !form.name.trim()) || (isNew && kind === 'FunctionDeclaration' && form.parameters.some((parameter) => !parameter.name.trim() || !parameter.typeName)))) {
      setError(t('form.saveHint'))
      return
    }
    const result = onSubmit(nodeConfiguration(kind, form, symbols, initialNode))
    if (!result.ok) setError([diagnosticLabel(result.code), ...(result.diagnostics ?? []).map((entry) => diagnosticLabel(entry.code))].join(' '))
    else setError('')
  }

  if (!schema) return <p>{t('form.notAvailable')}</p>
  return (
    <form className="node-form" onSubmit={handleSubmit}>
      {schema.named && <label>{t('form.name')}<input aria-label={t('form.name')} value={form.name} onChange={(event) => change('name', event.target.value)} required={required} autoComplete="off" /></label>}
      {schema.declaresType && <NodeTypeInput label={kind === 'FunctionDeclaration' ? t('form.returnType') : t('form.type')} value={form.typeName} onChange={(value) => change('typeName', value)} required={required} allowVoid={kind === 'FunctionDeclaration'} alias={initialNode?.properties.type?.kind === 'named'} />}
      {kind === 'FunctionDeclaration' && <>
        <label className="node-form__check"><input type="checkbox" checked={form.entryPoint} disabled={entryPointTaken && !form.entryPoint} onChange={(event) => change('entryPoint', event.target.checked)} />{t('form.startProgram')}</label>
        {entryPointTaken && !form.entryPoint && <p className="node-form__hint">{t('form.startProgramHint')}</p>}
      </>}
      {['BinaryExpression', 'UnaryExpression'].includes(kind) && <label>Operator
        <select aria-label="Operator" value={form.operator} onChange={(event) => change('operator', event.target.value)} required={required}>
          <option value="">{t('form.chooseOperation')}</option>{operators.map(([operator]) => <option key={operator} value={operator}>{operator}</option>)}
        </select>
      </label>}
      {kind === 'Literal' && <NodeValueInput typeName={resolvedName} value={form.value} empty={form.empty} required={required} onChange={(value) => change('value', value)} onEmptyChange={(value) => change('empty', value)} />}
      {(kind === 'Reference' || (isNew && kind === 'CallExpression')) && <label>{kind === 'Reference' ? 'Symbol' : 'Function'}
        <select aria-label={kind === 'Reference' ? 'Symbol' : 'Function'} value={form.symbolId || (unresolved ? '@unresolved' : '')} onChange={(event) => change('symbolId', event.target.value)} required={required}>
          <option value="">{t('form.chooseName')}</option>
          {unresolved && <option value="@unresolved">{t('form.keepLink')}</option>}
          {references.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}
        </select>
      </label>}
      {isNew && ['VariableDeclaration', 'ConstantDeclaration'].includes(kind) && <ExpressionInput label={t('form.startingValue')} value={form.initializer} onChange={(value) => change('initializer', value)} type={type} symbols={symbols} required={kind === 'ConstantDeclaration' && required} allowIncomplete={form.allowIncomplete} />}
      {isNew && ['IfStatement', 'WhileStatement', 'ForStatement'].includes(kind) && <ExpressionInput label={t('form.condition')} value={form.condition} onChange={(value) => change('condition', value)} type={primitiveType('boolean')} symbols={symbols} required={kind !== 'ForStatement' && required} allowIncomplete={form.allowIncomplete} />}
      {isNew && kind === 'PrintStatement' && <ExpressionInput label={t('form.value')} value={form.expression} onChange={(value) => change('expression', value)} symbols={symbols} required={required} allowIncomplete={form.allowIncomplete} />}
      {isNew && kind === 'FunctionDeclaration' && <fieldset><legend>{t('form.parameters')}</legend>
        {form.parameters.map((parameter, index) => <div className="node-form__parameter" key={index}>
          <label>Parameter {index + 1} name<input aria-label={`Parameter ${index + 1} name`} value={parameter.name} required={required} onChange={(event) => change('parameters', form.parameters.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry))} /></label>
          <NodeTypeInput label={`Parameter ${index + 1} type`} value={parameter.typeName} required={required} onChange={(value) => change('parameters', form.parameters.map((entry, position) => position === index ? { ...entry, typeName: value } : entry))} />
          <button type="button" onClick={() => change('parameters', form.parameters.filter((_, position) => position !== index))}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.removeInput')}</button>
        </div>)}
        <button type="button" onClick={() => change('parameters', [...form.parameters, { name: '', typeName: '' }])}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.addInput')}</button>
      </fieldset>}
      {isNew && kind === 'ForStatement' && <p className="node-form__hint">{t('form.loopHint')}</p>}
      {isNew && <p className="node-form__hint">{t('form.incompleteHint')}</p>}
      <label className="node-form__check"><input type="checkbox" checked={form.allowIncomplete} onChange={(event) => change('allowIncomplete', event.target.checked)} />{t('form.leaveEmpty')}</label>
      {error && <p className="node-form__error" role="alert">{error}</p>}
      <button type="submit" className="node-form__submit">{initialNode ? <Save size={16} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}{initialNode ? t('form.save') : t('form.create')}</button>
    </form>
  )
}
