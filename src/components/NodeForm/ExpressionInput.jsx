import { sameType, acceptsOperand, primitiveDefinitions, primitiveType } from '../../utils/logic/index.js'
import NodeValueInput from './NodeValueInput.jsx'
import { emptyExpression, expressionOperators, expressionOperandType } from './nodeConfiguration.js'
import { useTranslation } from '../../i18n.jsx'

// Configure les expressions imbriquées directement dans le formulaire de création, avec typage strict.
export default function ExpressionInput({ label, value = emptyExpression(), onChange, type, symbols, required, allowIncomplete = false, depth = 0 }) {
  const { t } = useTranslation()
  const matching = symbols.filter((symbol) => sameType(type, symbol.type))
  const functions = symbols.filter((symbol) => symbol.type?.kind === 'function' && sameType(type, symbol.type.returnType))
  const functionSymbol = functions.find((symbol) => symbol.id === value.symbolId)
  const operators = expressionOperators(value.mode, type)
  const operandType = expressionOperandType(value, type)
  const rule = operators.find(([operator]) => operator === value.operator)?.[1]
  const chooseOperandType = rule && rule.operands !== 'boolean' && rule.result !== 'same'
  const nested = depth < 6

  // Remplace uniquement le brouillon visé, sans conserver de champs incompatibles d'un autre mode.
  function handleModeChange(event) {
    onChange({ ...emptyExpression(), mode: event.target.value })
  }

  // Met à jour un opérande indépendamment des autres éléments de l'expression.
  function changeOperand(field, next) {
    onChange({ ...value, [field]: next })
  }

  return (
    <fieldset className="expression-input">
      <legend>{label}</legend>
      <label>Value
        <select aria-label={`${label} expression`} value={value.mode} onChange={handleModeChange} required={required} disabled={!type}>
          <option value="">{required ? t('form.chooseName') : t('form.leaveEmpty')}</option>
          <option value="literal">Literal</option><option value="reference">Reference</option>
          {nested && expressionOperators('binary', type).length > 0 && <option value="binary">Operation</option>}
          {nested && expressionOperators('unary', type).length > 0 && <option value="unary">Operation on one value</option>}
          {nested && <option value="call" disabled={functions.length === 0}>Use a function</option>}
          {nested && acceptsOperand('numeric', type) && <option value="cast">Convert the type</option>}
        </select>
      </label>
      {value.mode === 'literal' && <NodeValueInput label={`${label} value`} typeName={type?.name} value={value.value} empty={value.empty} onEmptyChange={(empty) => onChange({ ...value, empty })} required={!allowIncomplete} onChange={(next) => onChange({ ...value, value: next })} />}
      {value.mode === 'reference' && <label>Symbol
        <select aria-label={`${label} symbol`} value={value.symbolId} required={!allowIncomplete} onChange={(event) => onChange({ ...value, symbolId: event.target.value })}>
          <option value="">{t('form.chooseName')}</option>
          {matching.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}
        </select>
      </label>}
      {['binary', 'unary'].includes(value.mode) && <>
        <label>Operator<select aria-label={`${label} operator`} value={value.operator} required={!allowIncomplete} onChange={(event) => onChange({ ...value, operator: event.target.value })}>
          <option value="">{t('form.chooseOperation')}</option>
          {operators.map(([operator]) => <option key={operator} value={operator}>{operator}</option>)}
        </select></label>
        {chooseOperandType && <label>Operand type<select aria-label={`${label} operand type`} value={value.operandTypeName} required={!allowIncomplete} onChange={(event) => onChange({ ...value, operandTypeName: event.target.value })}>
          <option value="">Choose a type</option>
          {Object.keys(primitiveDefinitions).filter((name) => acceptsOperand(rule.operands, primitiveType(name))).map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>}
        {value.operator && (value.mode === 'binary' ? ['left', 'right'] : ['operand']).map((field) => <ExpressionInput key={field} label={`${label} ${field}`} value={value[field]} onChange={(next) => changeOperand(field, next)} type={operandType} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />)}
      </>}
      {value.mode === 'call' && <>
        <label>Function<select aria-label={`${label} function`} value={value.symbolId} required={!allowIncomplete} onChange={(event) => onChange({ ...value, symbolId: event.target.value, arguments: [] })}>
          <option value="">Choose a function</option>
          {functions.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}
        </select></label>
        {functionSymbol?.type.parameters.map((parameter, index) => <ExpressionInput key={index} label={`${label} argument ${index + 1}`} value={value.arguments?.[index]} onChange={(next) => onChange({ ...value, arguments: functionSymbol.type.parameters.map((_, position) => position === index ? next : value.arguments?.[position] ?? emptyExpression()) })} type={parameter} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />)}
      </>}
      {value.mode === 'cast' && <>
        <label>From type<select aria-label={`${label} source type`} value={value.operandTypeName} required={!allowIncomplete} onChange={(event) => onChange({ ...value, operandTypeName: event.target.value })}>
          <option value="">Choose a number type</option>
          {Object.keys(primitiveDefinitions).filter((name) => acceptsOperand('numeric', primitiveType(name))).map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <ExpressionInput label={`${label} argument`} value={value.argument} onChange={(next) => changeOperand('argument', next)} type={primitiveType(value.operandTypeName)} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />
      </>}
      {!nested && <p className="node-form__hint">For a more complex expression, add another block after creating this one.</p>}
    </fieldset>
  )
}
