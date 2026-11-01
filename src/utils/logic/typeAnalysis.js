import { createDiagnostic, diagnosticCodes as codes } from './diagnostics.js'
import { isRecord } from './model.js'
import { binaryOperators, unaryOperators, getNodeSchema } from './nodeSchema.js'
import { getPrimitive, primitiveType, isNumeric, sameType, acceptsOperand, arrayType, isArrayType } from './primitives.js'
import { validateLiteral, convertConstant, evaluateBinary, evaluateUnary } from './numericConstants.js'

// Extrait un enfant simple sans interpréter un trou ou une liste malformée comme une expression.
function child(node, name) {
  const value = node.children[name]
  return value && !Array.isArray(value) && !['Invalid', 'Hole'].includes(value.kind) ? value : null
}

// Ne prouve les retours que pour les blocs et les deux branches d'une condition.
function guaranteesReturn(node) {
  if (!node) return false
  if (node.kind === 'ReturnStatement') return true
  if (node.kind === 'Block') return node.children.statements.some(guaranteesReturn)
  if (node.kind === 'IfStatement') return guaranteesReturn(child(node, 'consequent')) && guaranteesReturn(child(node, 'alternate'))
  return false
}

// Vérifie les annotations et les expressions sans inférence de déclarations ni type de secours.
export function analyzeTypes(semantic, projectId) {
  const { nodes, referenceSymbols, typeSymbols, contexts } = semantic.index
  const diagnostics = []
  const annotations = new Map()
  const annotationActive = new Set()
  const resolved = new Map()
  const active = new Set()
  const constants = new Map()

  // Localise chaque erreur sur le nœud qui viole une contrainte statique.
  function report(code, message, node, field = null) {
    diagnostics.push(createDiagnostic(code, message, { projectId, moduleId: node.moduleId, nodeId: node.sourceId, field }))
  }

  // Une absence de type n'est ni compatible, ni remplacée par un type arbitraire.
  function expect(expected, actual, node, field) {
    if (!expected || !actual) return false
    if (sameType(expected, actual)) return true
    report(codes.typeMismatch, 'Les types doivent être strictement identiques ; une conversion explicite est nécessaire.', node, field)
    return false
  }

  // Résout seulement une annotation écrite par l'utilisateur ; les alias restent transparents.
  function annotation(node) {
    if (annotations.has(node.sourceId)) return annotations.get(node.sourceId)
    if (annotationActive.has(node.sourceId)) {
      report(codes.typeCycle, 'Alias de type cyclique.', node, 'properties.type')
      return null
    }
    if (annotationActive.size >= 200) {
      report(codes.depthExceeded, 'Profondeur de dépendances de types maximale dépassée.', node, 'properties.type')
      annotations.set(node.sourceId, null)
      return null
    }
    annotationActive.add(node.sourceId)
    const sourceType = node.properties.type
    let type = null
    if (sourceType === undefined || sourceType === null) {
      report(codes.typeRequired, 'Un type explicitement déclaré est obligatoire.', node, 'properties.type')
    } else if (isRecord(sourceType) && sourceType.kind === 'primitive' && getPrimitive(sourceType.name)) {
      type = primitiveType(sourceType.name)
    } else if (isRecord(sourceType) && sourceType.kind === 'array') {
      const element = isRecord(sourceType.elementType) && sourceType.elementType.kind === 'primitive' ? primitiveType(sourceType.elementType.name) : null
      if (!element || element.name === 'void') {
        report(codes.invalidType, 'Un tableau doit être formé d’éléments d’un primitif non void.', node, 'properties.type')
      } else {
        type = arrayType(element)
      }
    } else if (isRecord(sourceType) && sourceType.kind === 'named') {
      const symbol = typeSymbols.get(node.sourceId)
      if (symbol && nodes.has(symbol.nodeId)) type = annotation(nodes.get(symbol.nodeId))
    } else {
      report(codes.invalidType, 'Type non autorisé ou annotation malformée.', node, 'properties.type')
    }
    if (type?.name === 'void' && node.kind !== 'FunctionDeclaration') {
      report(codes.voidNotAllowed, 'void est réservé au retour d’une fonction.', node, 'properties.type')
      type = null
    }
    if (type?.kind === 'array' && !['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(node.kind)) {
      report(codes.invalidType, 'Un type tableau n’est autorisé que pour une variable, une constante ou un paramètre.', node, 'properties.type')
      type = null
    }
    annotationActive.delete(node.sourceId)
    annotations.set(node.sourceId, type)
    return type
  }

  // Publie une constante seulement si son contrôle de valeur a réussi.
  function acceptConstant(result, node) {
    if (result.code) {
      report(result.code, result.message, node, node.kind === 'Literal' ? 'properties.value' : null)
      return false
    }
    constants.set(node.sourceId, result.value)
    return true
  }

  // Vérifie les opérandes avant de donner un type au résultat de l'opération.
  function operation(node) {
    const binary = node.kind === 'BinaryExpression'
    const operators = binary ? binaryOperators : unaryOperators
    const operator = node.properties.operator
    const rule = typeof operator === 'string' && Object.hasOwn(operators, operator) ? operators[operator] : null
    if (!rule) {
      report(codes.incomplete, 'Opérateur absent ou non pris en charge.', node, 'properties.operator')
      return null
    }
    const slots = binary ? ['left', 'right'] : ['operand']
    const operands = slots.map((slot) => child(node, slot))
    const types = operands.map((operand) => resolve(operand?.sourceId))
    if (types.some((type) => !type)) return null
    if (types.some((type) => !acceptsOperand(rule.operands, type))) {
      report(codes.typeMismatch, 'Type d’opérande interdit pour cet opérateur.', node, 'properties.operator')
      return null
    }
    if (binary && !expect(types[0], types[1], node, 'children.right')) return null
    if (binary && ['/', '%'].includes(operator) && constants.has(operands[1].sourceId)) {
      const divisor = constants.get(operands[1].sourceId)
      if (divisor === 0 || divisor === 0n) {
        report(codes.divisionByZero, 'Division ou reste par zéro.', node, 'children.right')
        return null
      }
    }
    if (operands.every((operand) => constants.has(operand.sourceId))) {
      const values = operands.map((operand) => constants.get(operand.sourceId))
      const result = binary ? evaluateBinary(operator, values[0], values[1], types[0].name) : evaluateUnary(operator, values[0], types[0].name)
      if (!acceptConstant(result, node)) return null
    }
    return rule.result === 'same' ? types[0] : primitiveType(rule.result)
  }

  // N'autorise que les conversions numériques explicites ou l'identité d'un primitif non vide.
  function cast(node) {
    const target = annotation(node)
    const argument = child(node, 'argument')
    const source = resolve(argument?.sourceId)
    if (!target || !source) return null
    if (source.kind !== 'primitive' || source.name === 'void' ||
      !(sameType(source, target) || (isNumeric(source.name) && isNumeric(target.name)))) {
      report(codes.typeMismatch, 'Conversion explicite interdite entre ces types.', node, 'properties.type')
      return null
    }
    if (constants.has(argument.sourceId)) {
      const value = constants.get(argument.sourceId)
      const result = sameType(source, target) ? { value } : convertConstant(value, target.name)
      if (!acceptConstant(result, node)) return null
    }
    return target
  }

  // Une déclaration garde son type écrit, jamais celui d'un initialiseur ou d'un appel.
  function declaration(node) {
    if (node.kind !== 'FunctionDeclaration') return annotation(node)
    const returnType = annotation(node)
    const parameters = node.children.parameters.map((parameter) => parameter.kind === 'Parameter' ? annotation(parameter) : null)
    if (!returnType || parameters.some((type) => !type)) return null
    return { kind: 'function', parameters, returnType }
  }

  // Résout une référence puis propage seulement les valeurs d'initialiseurs constants prouvées.
  function reference(node) {
    const symbol = referenceSymbols.get(node.sourceId)
    if (!symbol) return null
    if (symbol.kind === 'TypeDeclaration') {
      report(codes.typeMismatch, 'Un type ne peut pas être utilisé comme une valeur.', node, 'references.target')
      return null
    }
    const target = nodes.get(symbol.nodeId)
    const type = target ? declaration(target) : null
    if (target?.kind === 'ConstantDeclaration') {
      const initializer = child(target, 'initializer')
      const initialType = resolve(initializer?.sourceId)
      if (sameType(type, initialType) && constants.has(initializer?.sourceId)) constants.set(node.sourceId, constants.get(initializer.sourceId))
    }
    return type
  }

  // Contrôle intégralement une signature d'appel avant de publier son type de retour.
  function call(node) {
    const callee = resolve(child(node, 'callee')?.sourceId)
    const args = node.children.arguments
    const argumentsTypes = args.map((argument) => resolve(argument.sourceId))
    if (!callee) return null
    if (callee.kind !== 'function') {
      report(codes.typeMismatch, 'La valeur appelée n’est pas une fonction.', node, 'children.callee')
      return null
    }
    let valid = true
    if (callee.parameters.length !== args.length) {
      report(codes.typeMismatch, 'Nombre d’arguments incompatible avec la signature.', node, 'children.arguments')
      valid = false
    }
    argumentsTypes.forEach((type, index) => {
      if (!callee.parameters[index] || !expect(callee.parameters[index], type, node, `children.arguments[${index}]`)) valid = false
    })
    return valid ? callee.returnType : null
  }

  // Résout le type d'élément annoté d'un tableau ; seuls les primitifs non void sont admis.
  function arrayElementType(node) {
    const source = node.properties.elementType
    if (source === undefined || source === null) {
      report(codes.typeRequired, 'Un type d’élément explicite est obligatoire pour ce tableau.', node, 'properties.elementType')
      return null
    }
    const type = isRecord(source) && source.kind === 'primitive' ? primitiveType(source.name) : null
    if (!type || type.name === 'void') {
      report(codes.invalidType, 'Le type d’élément d’un tableau doit être un primitif non void.', node, 'properties.elementType')
      return null
    }
    return type
  }

  // Un littéral de tableau publie le type tableau si chaque élément a exactement le type annoncé.
  function arrayLiteral(node) {
    const element = arrayElementType(node)
    if (!element) return null
    const elements = node.children.elements
    if (!Array.isArray(elements)) return null
    let valid = true
    elements.forEach((entry, index) => {
      if (!expect(element, resolve(entry?.sourceId), node, `children.elements[${index}]`)) valid = false
    })
    return valid ? arrayType(element) : null
  }

  // Une création de tableau publie le type tableau après contrôle de la taille et de la valeur de remplissage.
  function arrayCreation(node) {
    const element = arrayElementType(node)
    if (!element) return null
    const size = child(node, 'size')
    if (!size) return null
    const sizeType = resolve(size.sourceId)
    if (sizeType?.kind !== 'primitive' || getPrimitive(sizeType.name)?.category !== 'integer') {
      report(codes.typeMismatch, 'La taille d’un tableau doit être une expression entière.', node, 'children.size')
      return null
    }
    const initializer = child(node, 'initializer')
    if (initializer && !expect(element, resolve(initializer.sourceId), node, 'children.initializer')) return null
    return arrayType(element)
  }

  // Un accès par index publie le type de l'élément du tableau visé.
  function arrayAccess(node) {
    const array = child(node, 'array')
    const index = child(node, 'index')
    if (!array || !index) return null
    const targetType = resolve(array.sourceId)
    if (!isArrayType(targetType)) {
      report(codes.typeMismatch, 'L’accès par index vise une valeur qui n’est pas un tableau.', node, 'children.array')
      return null
    }
    const indexType = resolve(index.sourceId)
    if (indexType?.kind !== 'primitive' || getPrimitive(indexType.name)?.category !== 'integer') {
      report(codes.typeMismatch, 'L’index d’un tableau doit être une expression entière.', node, 'children.index')
      return null
    }
    return targetType.elementType
  }

  // Résout les expressions avec mémoïsation ; null indique uniquement une absence de résultat.
  function resolve(nodeId) {
    if (!nodeId || !nodes.has(nodeId)) return null
    if (resolved.has(nodeId)) return resolved.get(nodeId)
    const node = nodes.get(nodeId)
    if (active.has(nodeId)) {
      report(codes.constantCycle, 'Cycle dans les dépendances d’une expression constante.', node)
      for (const id of active) resolved.set(id, null)
      return null
    }
    if (active.size >= 200) {
      report(codes.depthExceeded, 'Profondeur d’expression constante maximale dépassée.', node)
      resolved.set(nodeId, null)
      return null
    }
    active.add(nodeId)
    let type = null
    if (getNodeSchema(node.kind)?.named) type = declaration(node)
    else if (node.kind === 'Literal') {
      const declared = annotation(node)
      if (declared && acceptConstant(validateLiteral(declared.name, node.properties.value), node)) type = declared
    } else if (node.kind === 'Reference') type = reference(node)
    else if (['BinaryExpression', 'UnaryExpression'].includes(node.kind)) type = operation(node)
    else if (node.kind === 'CastExpression') type = cast(node)
    else if (node.kind === 'CallExpression') type = call(node)
    else if (node.kind === 'ArrayLiteral') type = arrayLiteral(node)
    else if (node.kind === 'ArrayCreation') type = arrayCreation(node)
    else if (node.kind === 'ArrayAccess') type = arrayAccess(node)
    active.delete(nodeId)
    if (!resolved.has(nodeId)) resolved.set(nodeId, type)
    return resolved.get(nodeId)
  }

  // Toutes les déclarations et toutes les expressions sont contrôlées, même sans utilisation.
  for (const node of nodes.values()) resolve(node.sourceId)
  for (const node of nodes.values()) {
    if (['VariableDeclaration', 'ConstantDeclaration'].includes(node.kind)) {
      const initializer = child(node, 'initializer')
      if (initializer) expect(resolve(node.sourceId), resolve(initializer.sourceId), node, 'children.initializer')
    }
    if (['IfStatement', 'WhileStatement', 'ForStatement'].includes(node.kind)) {
      const test = child(node, 'test')
      if (test) expect(primitiveType('boolean'), resolve(test.sourceId), node, 'children.test')
    }
    if (node.kind === 'FunctionDeclaration') {
      const result = annotation(node)
      if (result && result.name !== 'void' && !guaranteesReturn(child(node, 'body'))) {
        report(codes.missingReturn, 'Une fonction non void doit retourner une valeur sur tous les chemins vérifiés.', node, 'children.body')
      }
    }
    if (node.kind === 'ReturnStatement') {
      const owner = nodes.get(contexts.get(node.sourceId)?.functionId)
      const result = owner ? annotation(owner) : null
      const argument = child(node, 'argument')
      if (result?.name === 'void' && argument) report(codes.voidNotAllowed, 'Une fonction void ne peut pas retourner une expression.', node, 'children.argument')
      else if (result && result.name !== 'void') {
        if (!argument) report(codes.typeMismatch, 'Une valeur de retour est obligatoire.', node, 'children.argument')
        else expect(result, resolve(argument.sourceId), node, 'children.argument')
      }
    }
    if (node.kind === 'AssignmentStatement') {
      const target = child(node, 'target')
      if (target && !['Reference', 'ArrayAccess'].includes(target.kind)) report(codes.illegalPlacement, 'La cible d’affectation doit être une variable ou un élément de tableau.', node, 'children.target')
      if (target?.kind === 'ArrayAccess') {
        const arrayTarget = child(target, 'array')
        const arraySymbol = arrayTarget?.kind === 'Reference' ? referenceSymbols.get(arrayTarget.sourceId) : null
        if (arraySymbol?.kind === 'ConstantDeclaration') report(codes.illegalPlacement, 'Les éléments d’une constante ne sont pas modifiables.', node, 'children.target')
      }
      const symbol = target?.kind === 'Reference' ? referenceSymbols.get(target.sourceId) : null
      if (symbol && !['VariableDeclaration', 'Parameter'].includes(symbol.kind)) report(codes.illegalPlacement, 'La cible d’affectation n’est pas une variable modifiable.', node, 'children.target')
      expect(resolve(target?.sourceId), resolve(child(node, 'value')?.sourceId), node, 'children.value')
    }
    if (node.kind === 'PrintStatement') {
      const value = child(node, 'value')
      const type = resolve(value?.sourceId)
      if (type?.kind === 'primitive' && type.name === 'void') report(codes.voidNotAllowed, 'Une instruction Print doit recevoir une valeur.', node, 'children.value')
    }
  }

  const untypedNodeIds = []
  for (const node of nodes.values()) {
    if (getNodeSchema(node.kind)?.category === 'expression' && !resolve(node.sourceId)) {
      untypedNodeIds.push(node.sourceId)
      report(codes.untypedExpression, 'Cette expression ne possède pas de type statique valide.', node)
    }
  }
  return {
    diagnostics,
    nodeTypes: [...resolved].filter(([, type]) => type !== null).map(([nodeId, type]) => ({ nodeId, type })),
    untypedNodeIds,
    symbols: semantic.model.symbols.map((symbol) => {
      const type = resolve(symbol.nodeId)
      return type ? { ...symbol, type } : { ...symbol }
    }),
  }
}
