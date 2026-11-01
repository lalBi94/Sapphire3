import { acceptsOperand, primitiveDefinitions, primitiveType } from '../../utils/logic/index.js'
import NodeValueInput from './NodeValueInput.jsx'
import { emptyExpression, expressionOperators, expressionOperandType, expressionSymbols } from './nodeConfiguration.js'
import { symbolLabel } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Configure les expressions imbriquées directement dans le formulaire de création, avec typage strict.
// `allowAnyType` couvre un emplacement sans type attendu, par exemple une instruction d'expression : une lecture ou un appel, y compris de procédure.
export default function ExpressionInput({ label, value = emptyExpression(), onChange, type, symbols, required, allowIncomplete = false, depth = 0, allowAnyType = false }) {
  const { t } = useTranslation()
  const { references: matching, functions } = expressionSymbols(symbols, type, allowAnyType)
  const functionSymbol = functions.find((symbol) => symbol.id === value.symbolId)
  const operators = expressionOperators(value.mode, type)
  const operandType = expressionOperandType(value, type)
  const rule = operators.find(([operator]) => operator === value.operator)?.[1]
  const chooseOperandType = rule && rule.operands !== 'boolean' && rule.result !== 'same'
  const nested = depth < 6

  // Remplace uniquement le brouillon visé, sans conserver de champs incompatibles d'un autre mode.
  function handleModeChange(event) {
    const mode = event.target.value
    const next = { ...emptyExpression(), mode }
    if (mode === 'arrayLiteral') next.arrayElements = []
    if (mode === 'arrayCreation') next.arraySize = emptyExpression()
    onChange(next)
  }

  // Ajoute un élément de littéral ou une valeur de remplissage selon le mode courant.
  function arrayChange(field, next) {
    onChange({ ...value, [field]: next })
  }

  // Met à jour un opérande indépendamment des autres éléments de l'expression.
  function changeOperand(field, next) {
    onChange({ ...value, [field]: next })
  }

  const isList = type?.kind === 'array'
  // Les modes qui imposent un type concret (littéral, opération, conversion) ne sont proposés que si ce slot en attend un.
  const concrete = Boolean(type)

  return (
    <fieldset className="expression-input">
      <legend>{label}</legend>
      <label>{t('form.value')}
        <select aria-label={t('expression.expression', { label })} value={value.mode} onChange={handleModeChange} required={required} disabled={!concrete && !allowAnyType}>
          <option value="">{required ? t('form.chooseName') : t('form.leaveEmpty')}</option>
          {concrete && !isList && <option value="literal">{t('expression.literal')}</option>}<option value="reference">{t('expression.reference')}</option>
          {nested && concrete && !isList && expressionOperators('binary', type).length > 0 && <option value="binary">{t('expression.binary')}</option>}
          {nested && concrete && !isList && expressionOperators('unary', type).length > 0 && <option value="unary">{t('expression.unary')}</option>}
          {nested && isList && <option value="arrayLiteral">{t('expression.arrayLiteral')}</option>}
          {nested && isList && <option value="arrayCreation">{t('expression.arrayCreation')}</option>}
          {nested && <option value="call" disabled={functions.length === 0}>{t('expression.call')}</option>}
          {nested && concrete && !isList && acceptsOperand('numeric', type) && <option value="cast">{t('expression.cast')}</option>}
        </select>
      </label>
      {value.mode === 'literal' && <NodeValueInput label={t('expression.value', { label })} typeName={type?.name} value={value.value} empty={value.empty} onEmptyChange={(empty) => onChange({ ...value, empty })} required={!allowIncomplete} onChange={(next) => onChange({ ...value, value: next })} />}
      {value.mode === 'reference' && <label>{t('form.symbol')}
        <select aria-label={t('expression.symbol', { label })} value={value.symbolId} required={!allowIncomplete} onChange={(event) => onChange({ ...value, symbolId: event.target.value })}>
          <option value="">{t('form.chooseName')}</option>
          {matching.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbolLabel(symbol)}</option>)}
        </select>
      </label>}
      {['binary', 'unary'].includes(value.mode) && <>
        <label>{t('form.operator')}<select aria-label={t('expression.operator', { label })} value={value.operator} required={!allowIncomplete} onChange={(event) => onChange({ ...value, operator: event.target.value })}>
          <option value="">{t('form.chooseOperation')}</option>
          {operators.map(([operator]) => <option key={operator} value={operator}>{operator}</option>)}
        </select></label>
        {chooseOperandType && <label>{t('expression.operandTypeLabel')}<select aria-label={t('expression.operandType', { label })} value={value.operandTypeName} required={!allowIncomplete} onChange={(event) => onChange({ ...value, operandTypeName: event.target.value })}>
          <option value="">{t('expression.chooseType')}</option>
          {Object.keys(primitiveDefinitions).filter((name) => acceptsOperand(rule.operands, primitiveType(name))).map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>}
        {value.operator && (value.mode === 'binary' ? ['left', 'right'] : ['operand']).map((field) => <ExpressionInput key={field} label={t('expression.part', { label, part: t(`slot.${field}`) })} value={value[field]} onChange={(next) => changeOperand(field, next)} type={operandType} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />)}
      </>}
      {value.mode === 'call' && <>
        <label>{t('form.function')}<select aria-label={t('expression.function', { label })} value={value.symbolId} required={!allowIncomplete} onChange={(event) => onChange({ ...value, symbolId: event.target.value, arguments: [] })}>
          <option value="">{t('expression.chooseFunction')}</option>
          {functions.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbolLabel(symbol)}</option>)}
        </select></label>
        {functionSymbol?.type.parameters.map((parameter, index) => <ExpressionInput key={index} label={t('expression.argument', { label, number: index + 1 })} value={value.arguments?.[index]} onChange={(next) => onChange({ ...value, arguments: functionSymbol.type.parameters.map((_, position) => position === index ? next : value.arguments?.[position] ?? emptyExpression()) })} type={parameter} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />)}
      </>}
      {value.mode === 'cast' && <>
        <label>{t('expression.fromType')}<select aria-label={t('expression.sourceType', { label })} value={value.operandTypeName} required={!allowIncomplete} onChange={(event) => onChange({ ...value, operandTypeName: event.target.value })}>
          <option value="">{t('expression.chooseNumericType')}</option>
          {Object.keys(primitiveDefinitions).filter((name) => acceptsOperand('numeric', primitiveType(name))).map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <ExpressionInput label={t('expression.part', { label, part: t('slot.argument') })} value={value.argument} onChange={(next) => changeOperand('argument', next)} type={primitiveType(value.operandTypeName)} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />
      </>}
      {value.mode === 'arrayLiteral' && isList && <>
        {(value.arrayElements ?? []).map((element, index) => <div className="node-form__parameter" key={index}>
          <ExpressionInput label={t('expression.element', { number: index + 1 })} value={element} onChange={(next) => onChange({ ...value, arrayElements: value.arrayElements.map((entry, position) => position === index ? next : entry) })} type={type.elementType} symbols={symbols} required={false} allowIncomplete={allowIncomplete} depth={depth + 1} />
          <button type="button" onClick={() => onChange({ ...value, arrayElements: value.arrayElements.filter((_, position) => position !== index) })}>{t('form.removeElement')}</button>
        </div>)}
        <button type="button" onClick={() => onChange({ ...value, arrayElements: [...(value.arrayElements ?? []), emptyExpression()] })}>{t('form.addElement')}</button>
      </>}
      {value.mode === 'arrayCreation' && isList && <>
        <ExpressionInput label={t('slot.size')} value={value.arraySize ?? emptyExpression()} onChange={(next) => arrayChange('arraySize', next)} type={primitiveType('int')} symbols={symbols} required={!allowIncomplete} allowIncomplete={allowIncomplete} depth={depth + 1} />
        <ExpressionInput label={t('slot.initializer')} value={value.arrayFill ?? emptyExpression()} onChange={(next) => arrayChange('arrayFill', next)} type={type.elementType} symbols={symbols} required={false} allowIncomplete={true} depth={depth + 1} />
      </>}
      {!nested && <p className="node-form__hint">{t('expression.depthHint')}</p>}
    </fieldset>
  )
}
