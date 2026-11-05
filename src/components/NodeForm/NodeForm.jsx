import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { getNodeSchema, binaryOperators, unaryOperators, primitiveType, getCallableSymbols, sameType, isArrayType, mathNatives, containsGeneric, declaredTypeParameters, typeFromRecord, maximumTypeParameters } from '../../utils/logic/index.js'
import { initialNodeForm, nodeConfiguration, emptyExpression, typeFromName, typeNameFromType, accessedArrayType, arrayIndexType, integerTypeNames, expressionOperators } from './nodeConfiguration.js'
import NodeTypeInput from './NodeTypeInput.jsx'
import NodeValueInput from './NodeValueInput.jsx'
import ExpressionInput from './ExpressionInput.jsx'
import InfoHint from '../InfoHint/InfoHint.jsx'
import { diagnosticLabel, symbolLabel, typeLabel } from '../LogicTree/logicLabels.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './NodeForm.css'

// Configure les propriétés du langage sans éditer ni remplacer implicitement les liens syntaxiques.
// Regroupe les opérations natives par sous-catégorie, dans l'ordre du registre.
function nativeGroups() {
  const groups = []
  for (const native of Object.values(mathNatives)) {
    const group = groups.find((entry) => entry.id === native.group)
    if (group) group.ids.push(native.id)
    else groups.push({ id: native.group, ids: [native.id] })
  }
  return groups
}

export default function NodeForm({ kind, initialNode = null, preset = null, context, onSubmit, showName = true }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(() => initialNodeForm(kind, initialNode, context.expectedType, getCallableSymbols(context), preset))
  const [error, setError] = useState(null)

  const schema = getNodeSchema(kind)
  const symbols = getCallableSymbols(context)
  const type = form.typeName === '@alias' ? initialNode?.properties.type : typeFromName(form.typeName)
  const resolvedName = form.typeName === '@alias' ? context.index.nodeTypes.get(initialNode?.id)?.name : form.typeName
  const isNew = !initialNode
  const required = !form.allowIncomplete
  const entryPointTaken = [...context.index.nodes.values()].some((node) => node.id !== initialNode?.id && node.kind === 'FunctionDeclaration' && node.properties?.entryPoint === true)
  // Les noms de type proposés viennent de la fonction propriétaire, jamais d'une liste implicite.
  const ownerFunction = context.context?.functionId ? context.index.nodes.get(context.context.functionId) : null
  const ownerGenerics = kind === 'Parameter' ? declaredTypeParameters(ownerFunction).map((parameter) => parameter.name) : []
  const formGenerics = kind === 'FunctionDeclaration' ? form.typeParameters.map((parameter) => parameter.name.trim()).filter(Boolean) : ownerGenerics
  // Une fonction générique n'est pas une valeur de première classe, mais reste une cible d'appel directe.
  const genericFunction = (symbol) => {
    const target = context.index.nodes.get(symbol.nodeId)
    return declaredTypeParameters(target).length > 0
  }
  // Le type d'élément d'un tableau est connu dès que le slot attend un tableau.
  const arrayElementType = isNew && isArrayType(context.expectedType) ? context.expectedType.elementType : null
  // Un accès par index vise un tableau du type attendu par le slot ; sans type attendu précis, la lecture reste libre.
  const accessTargetType = isNew && kind === 'ArrayAccess' ? accessedArrayType(context.expectedType) : null
  // Signatures existantes proposées comme annotation de variable, constante ou paramètre.
  const declaredFunctionType = initialNode ? context.index.nodeTypes.get(initialNode.id) : null
  // Une contrainte de fonction déjà enregistrée reste proposée même sans symbole correspondant.
  const constraintTypes = kind === 'FunctionDeclaration' && Array.isArray(initialNode?.properties?.typeParameters)
    ? initialNode.properties.typeParameters.map((parameter) => typeFromRecord(parameter.constraint)).filter((candidate) => candidate?.kind === 'function')
    : []
  const functionTypes = []
  if (['VariableDeclaration', 'ConstantDeclaration', 'Parameter', 'FunctionDeclaration'].includes(kind)) {
    const seen = new Set()
    for (const candidate of [declaredFunctionType, ...constraintTypes, ...symbols.map((symbol) => symbol.type)]) {
      if (candidate?.kind !== 'function' || containsGeneric(candidate)) continue
      const value = typeNameFromType(candidate)
      if (!value || seen.has(value)) continue
      seen.add(value)
      functionTypes.push({ value, label: typeLabel(candidate, t) })
    }
  }
  // ForEach : le rappel doit accepter exactement un élément du tableau choisi et retourner void.
  const forEachArray = symbols.find((symbol) => symbol.id === form.forEachArrayId)
  const forEachElementType = isArrayType(forEachArray?.type) ? forEachArray.type.elementType : null
  const forEachArrays = symbols.filter((symbol) => isArrayType(symbol.type))
  const forEachCallbacks = symbols.filter((symbol) => symbol.type?.kind === 'function' && symbol.type.parameters.length === 1 && symbol.type.returnType?.name === 'void' && (!forEachElementType || sameType(symbol.type.parameters[0], forEachElementType)))
  const references = symbols.filter((symbol) => {
    if (kind === 'CallExpression') {
      if (symbol.type?.kind !== 'function') return false
      if (!genericFunction(symbol)) return !isNew || !context.expectedType || sameType(context.expectedType, symbol.type.returnType)
      const returnType = symbol.type.returnType
      // Un retour générique ne peut être confronté au slot qu'après inférence : la sélection reste ouverte.
      if (containsGeneric(returnType)) return true
      return !context.expectedType || sameType(context.expectedType, returnType)
    }
    if (context.record.kind === 'CallExpression' && context.slot?.name === 'callee') return symbol.type?.kind === 'function' && !containsGeneric(symbol.type)
    if (context.record.kind === 'AssignmentStatement' && context.slot?.name === 'target') return ['VariableDeclaration', 'Parameter'].includes(symbol.kind)
    return symbol.kind !== 'TypeDeclaration' && (!isNew || !context.expectedType || sameType(context.expectedType, symbol.type))
  })
  const unresolved = initialNode?.references?.target && !symbols.some((symbol) => symbol.id === form.symbolId)
  const operators = !isNew || !context.expectedType
    ? Object.entries(kind === 'BinaryExpression' ? binaryOperators : unaryOperators)
    : expressionOperators(kind === 'BinaryExpression' ? 'binary' : 'unary', context.expectedType)

  // Change une propriété de brouillon sans modifier le programme avant confirmation.
  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  // Ajoute un paramètre de type avec la première lettre libre T, U, V…
  function addTypeParameter() {
    const used = new Set(form.typeParameters.map((parameter) => parameter.name.trim()))
    const name = [...'TUVWXYZ'].find((letter) => !used.has(letter)) ?? `T${form.typeParameters.length + 1}`
    change('typeParameters', [...form.typeParameters, { name, constraintName: '' }])
  }

  // Les erreurs du moteur restent structurées ; l'interface affiche une explication courte.
  function handleSubmit(event) {
    event.preventDefault()
    if (required && ((schema.named && !form.name.trim()) || (isNew && kind === 'FunctionDeclaration' && form.parameters.some((parameter) => !parameter.name.trim() || !parameter.typeName)) || (kind === 'FunctionDeclaration' && form.typeParameters.some((parameter) => !parameter.name.trim())) || (isNew && kind === 'ForEachStatement' && (!form.forEachArrayId || !form.forEachCallbackId)))) {
      setError({ key: kind === 'ForEachStatement' ? 'form.forEachRequired' : 'form.saveHint' })
      return
    }
    const result = onSubmit(nodeConfiguration(kind, form, symbols, initialNode))
    if (!result.ok) setError({ codes: [result.code, ...(result.diagnostics ?? []).map((entry) => entry.code)] })
    else setError(null)
  }

  if (!schema) return <p>{t('form.notAvailable')}</p>
  return (
    <form className="node-form" onSubmit={handleSubmit}>
      {schema.named && showName && <label>{t('form.name')}<input aria-label={t('form.name')} value={form.name} onChange={(event) => change('name', event.target.value)} required={required} autoComplete="off" /></label>}
      {(schema.declaresType || isNew && kind === 'PrintStatement') && <NodeTypeInput label={kind === 'FunctionDeclaration' ? t('form.returnType') : t('form.type')} value={form.typeName} onChange={(value) => change('typeName', value)} required={required} allowVoid={kind === 'FunctionDeclaration'} allowArray={['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(kind) || (isNew && kind === 'PrintStatement') || (kind === 'FunctionDeclaration' && formGenerics.length > 0)} allowPointer={['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(kind) || (isNew && kind === 'PrintStatement')} allowFunction={['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(kind)} genericNames={['FunctionDeclaration', 'Parameter'].includes(kind) ? formGenerics : []} functionTypes={functionTypes} alias={initialNode?.properties.type?.kind === 'named'} />}
      {['ArrayLiteral', 'ArrayCreation'].includes(kind) && (arrayElementType
        ? <p className="node-form__hint">{t('form.arrayElementsOfType', { type: arrayElementType.name })}</p>
        : <NodeTypeInput label={t('field.elementType')} value={form.elementTypeName} onChange={(value) => change('elementTypeName', value)} required={required} />)}
      {kind === 'FunctionDeclaration' && <>
        <div className="node-form__check-row">
          <label className="node-form__check"><input type="checkbox" checked={form.entryPoint} disabled={entryPointTaken && !form.entryPoint} onChange={(event) => change('entryPoint', event.target.checked)} />{t('form.startProgram')}</label>
          {entryPointTaken && !form.entryPoint && <InfoHint text={t('form.startProgramHint')} />}
        </div>
        <fieldset>
          <legend>{t('form.typeParameters')}</legend>
          {form.typeParameters.map((parameter, index) => <div className="node-form__parameter" key={index}>
            <label>{t('form.typeParameterName', { number: index + 1 })}<input aria-label={t('form.typeParameterName', { number: index + 1 })} value={parameter.name} required={required} onChange={(event) => change('typeParameters', form.typeParameters.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry))} /></label>
            <NodeTypeInput label={t('form.typeParameterConstraint', { number: index + 1 })} value={parameter.constraintName} onChange={(value) => change('typeParameters', form.typeParameters.map((entry, position) => position === index ? { ...entry, constraintName: value } : entry))} allowArray allowPointer allowFunction emptyLabel={t('form.noConstraint')} functionTypes={functionTypes} />
            <button type="button" onClick={() => change('typeParameters', form.typeParameters.filter((_, position) => position !== index))}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.removeTypeParameter')}</button>
          </div>)}
          <button type="button" onClick={addTypeParameter} disabled={form.typeParameters.length >= maximumTypeParameters}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.addTypeParameter')}</button>
          <InfoHint text={t('form.typeParameterHint')} />
        </fieldset>
      </>}
      {['BinaryExpression', 'UnaryExpression'].includes(kind) && <label>{t('form.operator')}
        <select aria-label={t('form.operator')} value={form.operator} onChange={(event) => change('operator', event.target.value)} required={required}>
          <option value="">{t('form.chooseOperation')}</option>{operators.map(([operator]) => <option key={operator} value={operator}>{operator}</option>)}
        </select>
      </label>}
      {kind === 'Literal' && <NodeValueInput label={t('form.value')} typeName={resolvedName} value={form.value} empty={form.empty} required={required} onChange={(value) => change('value', value)} onEmptyChange={(value) => change('empty', value)} />}
      {kind === 'MathCall' && <label>{t('kind.MathCall')}
        <select aria-label={t('kind.MathCall')} value={form.mathName ?? ''} onChange={(event) => change('mathName', event.target.value)} required={required}>
          <option value="">{t('form.chooseName')}</option>
          {nativeGroups().map((group) => <optgroup key={group.id} label={t(`group.${group.id}`)}>{group.ids.map((id) => <option key={id} value={id}>{id}</option>)}</optgroup>)}
        </select>
      </label>}
      {(kind === 'Reference' || (isNew && kind === 'CallExpression')) && <label>{t(kind === 'Reference' ? 'form.symbol' : 'form.function')}
        <select aria-label={t(kind === 'Reference' ? 'form.symbol' : 'form.function')} value={form.symbolId || (unresolved ? '@unresolved' : '')} onChange={(event) => change('symbolId', event.target.value)} required={required}>
          <option value="">{t('form.chooseName')}</option>
          {unresolved && <option value="@unresolved">{t('form.keepLink')}</option>}
          {references.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbolLabel(symbol)}</option>)}
        </select>
      </label>}
      {isNew && ['VariableDeclaration', 'ConstantDeclaration'].includes(kind) && <ExpressionInput label={t('form.startingValue')} value={form.initializer} onChange={(value) => change('initializer', value)} type={type} symbols={symbols} required={kind === 'ConstantDeclaration' && required} allowIncomplete={form.allowIncomplete} />}
      {isNew && ['IfStatement', 'WhileStatement', 'ForStatement'].includes(kind) && <ExpressionInput label={t('form.condition')} value={form.condition} onChange={(value) => change('condition', value)} type={primitiveType('boolean')} symbols={symbols} required={kind !== 'ForStatement' && required} allowIncomplete={form.allowIncomplete} />}
      {isNew && kind === 'PrintStatement' && <ExpressionInput label={t('form.value')} value={form.expression} onChange={(value) => change('expression', value)} type={type} symbols={symbols} required={required} allowIncomplete={form.allowIncomplete} />}
      {isNew && kind === 'ExpressionStatement' && <ExpressionInput label={t('slot.expression')} value={form.expression} onChange={(value) => change('expression', value)} type={null} symbols={symbols} required={required} allowIncomplete={form.allowIncomplete} allowAnyType />}
      {isNew && kind === 'FunctionDeclaration' && <fieldset><legend>{t('form.parameters')}</legend>
        {form.parameters.map((parameter, index) => <div className="node-form__parameter" key={index}>
          <label>{t('form.parameterName', { number: index + 1 })}<input aria-label={t('form.parameterName', { number: index + 1 })} value={parameter.name} required={required} onChange={(event) => change('parameters', form.parameters.map((entry, position) => position === index ? { ...entry, name: event.target.value } : entry))} /></label>
          <NodeTypeInput label={t('form.parameterType', { number: index + 1 })} value={parameter.typeName} required={required} allowArray allowPointer allowFunction genericNames={formGenerics} functionTypes={functionTypes} onChange={(value) => change('parameters', form.parameters.map((entry, position) => position === index ? { ...entry, typeName: value } : entry))} />
          <button type="button" onClick={() => change('parameters', form.parameters.filter((_, position) => position !== index))}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.removeInput')}</button>
        </div>)}
        <button type="button" onClick={() => change('parameters', [...form.parameters, { name: '', typeName: '' }])}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.addInput')}</button>
      </fieldset>}
      {kind === 'ArrayLiteral' && (isNew ? <fieldset><legend>{t('slot.elements')}</legend>
        {form.arrayElements.map((element, index) => <div className="node-form__parameter" key={index}>
          <ExpressionInput label={t('expression.element', { number: index + 1 })} value={element} onChange={(value) => change('arrayElements', form.arrayElements.map((entry, position) => position === index ? value : entry))} type={primitiveType(form.elementTypeName)} symbols={symbols} required={false} allowIncomplete={form.allowIncomplete} />
          <button type="button" onClick={() => change('arrayElements', form.arrayElements.filter((_, position) => position !== index))}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.removeElement')}</button>
        </div>)}
        <button type="button" onClick={() => change('arrayElements', [...form.arrayElements, emptyExpression()])}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />{t('form.addElement')}</button>
      </fieldset> : null)}
      {isNew && kind === 'ArrayCreation' && <>
        <ExpressionInput label={t('slot.size')} value={form.arraySize} onChange={(value) => change('arraySize', value)} type={primitiveType('int')} symbols={symbols} required={required} allowIncomplete={form.allowIncomplete} />
        <ExpressionInput label={t('slot.initializer')} value={form.arrayFill} onChange={(value) => change('arrayFill', value)} type={primitiveType(form.elementTypeName)} symbols={symbols} required={false} allowIncomplete={form.allowIncomplete} />
      </>}
      {isNew && kind === 'ArrayAccess' && <>
        <ExpressionInput label={t('slot.array')} value={form.accessArray} onChange={(value) => change('accessArray', value)} type={accessTargetType} allowAnyType={!accessTargetType} symbols={symbols} required={required} allowIncomplete={form.allowIncomplete} />
        <label>{t('expression.indexTypeLabel')}
          <select aria-label={t('expression.indexType', { label: t('slot.array') })} value={form.indexTypeName} onChange={(event) => change('indexTypeName', event.target.value)} required={required}>
            <option value="">{t('expression.chooseType')}</option>
            {integerTypeNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <ExpressionInput label={t('slot.index')} value={form.accessIndex} onChange={(value) => change('accessIndex', value)} type={arrayIndexType(form.indexTypeName)} symbols={symbols} required={required} allowIncomplete={form.allowIncomplete} />
      </>}
      {isNew && kind === 'ForEachStatement' && <>
        <label>{t('form.forEachArray')}
          <select aria-label={t('form.forEachArray')} value={form.forEachArrayId} onChange={(event) => change('forEachArrayId', event.target.value)} required={required}>
            <option value="">{t('form.chooseName')}</option>
            {forEachArrays.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbolLabel(symbol)}</option>)}
          </select>
        </label>
        {forEachArrays.length === 0 && <InfoHint text={t('form.forEachArrayHint')} />}
        <label>{t('form.forEachCallback')}
          <select aria-label={t('form.forEachCallback')} value={form.forEachCallbackId} onChange={(event) => change('forEachCallbackId', event.target.value)} required={required}>
            <option value="">{t('form.chooseName')}</option>
            {forEachCallbacks.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbolLabel(symbol)}</option>)}
          </select>
        </label>
        {forEachArray && forEachCallbacks.length === 0 && <InfoHint text={t('form.forEachCallbackHint')} />}
      </>}
      {isNew && kind === 'ForStatement' && <InfoHint text={t('form.loopHint')} />}
      <label className="node-form__check"><input type="checkbox" checked={form.allowIncomplete} onChange={(event) => change('allowIncomplete', event.target.checked)} />{t('form.leaveEmpty')}</label>
      {error && <p className="node-form__error" role="alert">{error.key ? t(error.key) : error.codes.map((code) => diagnosticLabel(code, t)).join(' ')}</p>}
      <button type="submit" className="node-form__submit">{initialNode ? <Save size={16} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={16} strokeWidth={1.75} aria-hidden="true" />}{initialNode ? t('form.save') : t('form.create')}</button>
    </form>
  )
}
