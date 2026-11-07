import { createDiagnostic, diagnosticCodes as codes } from './diagnostics.js'
import { isRecord } from './model.js'
import { binaryOperators, unaryOperators, getNodeSchema } from './nodeSchema.js'
import { getMathNative } from './mathNatives.js'
import { getPrimitive, primitiveType, isNumeric, sameType, acceptsOperand, arrayType, isArrayType, pointerType, pointerPointee, functionType, typeFromRecord, genericType, isGenericType, containsGeneric, isValidParameterType, classType, isClassType } from './primitives.js'
import { declaredTypeParameters, substituteType, typeParameterConstraint } from './generics.js'
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
  const { nodes, referenceSymbols, typeSymbols, contexts, classMembers, classModules } = semantic.index
  const diagnostics = []
  const annotations = new Map()
  const annotationActive = new Set()
  const resolved = new Map()
  const active = new Set()
  const constants = new Map()
  const parents = new Map()
  const genericCalls = []
  for (const node of nodes.values()) {
    for (const value of Object.values(node.children ?? {})) {
      for (const childNode of Array.isArray(value) ? value : [value]) if (childNode?.sourceId) parents.set(childNode.sourceId, node)
    }
  }

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

  // Noms des paramètres de type visibles sur le retour ou un paramètre de la fonction propriétaire.
  function genericNames(node) {
    const owner = node.kind === 'FunctionDeclaration'
      ? node
      : node.kind === 'Parameter' ? nodes.get(contexts.get(node.sourceId)?.functionId) : null
    return new Set(declaredTypeParameters(owner).map((parameter) => parameter.name))
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
    const allowedGenerics = genericNames(node)
    let type = null
    if (sourceType === undefined || sourceType === null) {
      report(codes.typeRequired, 'Un type explicitement déclaré est obligatoire.', node, 'properties.type')
    } else if (isRecord(sourceType) && sourceType.kind === 'primitive' && getPrimitive(sourceType.name)) {
      type = primitiveType(sourceType.name)
    } else if (isRecord(sourceType) && sourceType.kind === 'generic' && allowedGenerics.has(sourceType.name)) {
      type = genericType(sourceType.name)
    } else if (isRecord(sourceType) && sourceType.kind === 'array') {
      const elementSource = sourceType.elementType
      const element = isRecord(elementSource) && elementSource.kind === 'primitive' ? primitiveType(elementSource.name)
        : isRecord(elementSource) && elementSource.kind === 'generic' && allowedGenerics.has(elementSource.name) ? genericType(elementSource.name)
          : null
      if (!element || element.name === 'void') {
        report(codes.invalidType, 'Un tableau doit être formé d’éléments d’un primitif non void ou d’un paramètre de type.', node, 'properties.type')
      } else {
        type = arrayType(element)
      }
    } else if (isRecord(sourceType) && sourceType.kind === 'pointer') {
      const pointee = isRecord(sourceType.pointee) && sourceType.pointee.kind === 'primitive' ? primitiveType(sourceType.pointee.name) : null
      if (!pointee || pointee.name === 'void') {
        report(codes.invalidType, 'Un pointeur doit viser un primitif non void.', node, 'properties.type')
      } else {
        type = pointerType(pointee)
      }
    } else if (isRecord(sourceType) && sourceType.kind === 'function') {
      type = typeFromRecord(sourceType)
      if (!type) report(codes.invalidType, 'Une signature de fonction doit avoir des paramètres typés non void et un retour primitif.', node, 'properties.type')
    } else if (isRecord(sourceType) && sourceType.kind === 'class') {
      const classModule = classModules.get(sourceType.classId)
      if (!classModule) report(codes.invalidType, 'Classe inconnue ou absente du projet.', node, 'properties.type')
      else type = classType(sourceType.classId, classModule.name)
    } else if (isRecord(sourceType) && sourceType.kind === 'named') {
      const symbol = typeSymbols.get(node.sourceId)
      if (symbol && nodes.has(symbol.nodeId)) type = annotation(nodes.get(symbol.nodeId))
    } else {
      report(codes.invalidType, 'Type non autorisé ou annotation malformée.', node, 'properties.type')
    }
    if (type?.name === 'void' && node.kind !== 'FunctionDeclaration' && node.kind !== 'LambdaExpression') {
      report(codes.voidNotAllowed, 'void est réservé au retour d’une fonction.', node, 'properties.type')
      type = null
    }
    if (type?.kind === 'array' && !['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(node.kind) && !(node.kind === 'FunctionDeclaration' && containsGeneric(type))) {
      report(codes.invalidType, 'Un type tableau concret n’est autorisé que pour une variable, une constante ou un paramètre ; seul un tableau générique peut être retourné.', node, 'properties.type')
      type = null
    }
    if (type?.kind === 'pointer' && !['VariableDeclaration', 'ConstantDeclaration', 'Parameter'].includes(node.kind)) {
      report(codes.invalidType, 'Un type pointeur n’est autorisé que pour une variable, une constante ou un paramètre.', node, 'properties.type')
      type = null
    }
    if (type?.kind === 'function' && !['VariableDeclaration', 'ConstantDeclaration', 'Parameter', 'FunctionDeclaration', 'LambdaExpression'].includes(node.kind)) {
      report(codes.invalidType, 'Un type fonction n’est autorisé que pour une variable, une constante, un paramètre ou le retour d’une fonction.', node, 'properties.type')
      type = null
    }
    if (type?.kind === 'class' && !['VariableDeclaration', 'ConstantDeclaration', 'Parameter', 'FunctionDeclaration', 'LambdaExpression'].includes(node.kind)) {
      report(codes.invalidType, 'Un type de classe n’est autorisé que pour une variable, une constante, un paramètre ou le retour d’une fonction.', node, 'properties.type')
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
    // L'adresse ne se prend que sur une valeur stockable ; le déréférencement lit la cible d'un pointeur.
    if (!binary && operator === '&') {
      if (!operands[0] || !['Reference', 'ArrayAccess'].includes(operands[0].kind)) {
        report(codes.illegalPlacement, 'L’adresse ne peut être prise que sur une variable ou un élément de tableau.', node, 'children.operand')
        return null
      }
      const addressedSymbol = operands[0].kind === 'Reference' ? referenceSymbols.get(operands[0].sourceId) : null
      if (addressedSymbol?.kind === 'Parameter' && nodes.get(contexts.get(addressedSymbol.nodeId)?.functionId)?.kind === 'LambdaExpression') {
        report(codes.illegalPlacement, 'L’adresse d’un paramètre de lambda n’est pas prise en charge.', node, 'children.operand')
        return null
      }
      return pointerType(types[0])
    }
    if (!binary && operator === '*') return pointerPointee(types[0])
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

  // Une lambda publie sa signature concrète après contrôle de son corps et de ses paramètres.
  function lambda(node) {
    const returnType = annotation(node)
    const parameters = (node.children.parameters ?? []).map((parameter) => parameter.kind === 'Parameter' ? annotation(parameter) : null)
    if (!returnType || parameters.some((type) => !type)) return null
    const body = child(node, 'body')
    const bodyType = body ? resolve(body.sourceId) : null
    if (bodyType && returnType.name !== 'void' && !sameType(returnType, bodyType)) {
      report(codes.typeMismatch, 'Le résultat de la lambda doit avoir le type de retour déclaré.', node, 'children.body')
    }
    return functionType(parameters, returnType)
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
    // Une fonction générique n'est utilisable que comme cible directe d'un appel.
    if (target?.kind === 'FunctionDeclaration' && declaredTypeParameters(target).length > 0) {
      const parent = parents.get(node.sourceId)
      const callee = parent?.kind === 'CallExpression' ? parent.children?.callee : null
      const directCallee = callee === node || callee?.sourceId === node.sourceId
      if (!directCallee) {
        report(codes.typeMismatch, 'Une fonction générique ne peut pas être utilisée comme valeur de première classe.', node, 'references.target')
        return null
      }
    }
    const type = target ? declaration(target) : null
    if (target?.kind === 'ConstantDeclaration') {
      const initializer = child(target, 'initializer')
      const initialType = resolve(initializer?.sourceId)
      if (sameType(type, initialType) && constants.has(initializer?.sourceId)) constants.set(node.sourceId, constants.get(initializer.sourceId))
    }
    return type
  }

  // Résout un membre de classe en vérifiant la visibilité depuis le contexte courant.
  function memberInfo(node) {
    const object = child(node, 'object')
    const objectType = resolve(object?.sourceId)
    if (!objectType || !isClassType(objectType)) {
      report(codes.typeMismatch, 'L’accès à un membre exige une instance de classe.', node, 'children.object')
      return null
    }
    const name = node.properties?.name
    if (typeof name !== 'string' || name.length === 0) {
      report(codes.incomplete, 'Nom de membre manquant.', node, 'properties.name')
      return null
    }
    const members = classMembers.get(objectType.classId)
    const memberId = members?.public.get(name) ?? members?.private.get(name)
    if (!memberId) {
      report(codes.typeMismatch, `Membre inconnu dans cette classe : ${name}.`, node, 'properties.name')
      return null
    }
    const visibility = members.public.has(name) ? 'public' : 'private'
    const contextClassId = contexts.get(node.sourceId)?.classId ?? null
    if (visibility === 'private' && contextClassId !== objectType.classId) {
      report(codes.typeMismatch, 'Ce membre est privé et n’est accessible que dans sa classe.', node, 'properties.name')
      return null
    }
    const memberNode = nodes.get(memberId)
    const type = memberNode ? declaration(memberNode) : null
    return type ? { type, memberNode, visibility, memberId } : null
  }

  // Type d'un accès membre : attribut, méthode ou constructeur.
  function member(node) {
    return memberInfo(node)?.type ?? null
  }

  // this n'a de sens que dans une méthode ou un constructeur de classe.
  function thisExpression(node) {
    const classId = contexts.get(node.sourceId)?.classId ?? null
    const classModule = classId ? classModules.get(classId) : null
    if (!classModule) {
      report(codes.illegalPlacement, 'this est réservé aux méthodes et au constructeur d’une classe.', node)
      return null
    }
    return classType(classId, classModule.name)
  }

  // Vérifie la classe, le constructeur et les arguments d'une instanciation.
  function newExpression(node) {
    const classId = node.properties?.classId
    const classModule = classId ? classModules.get(classId) : null
    if (!classModule) {
      report(codes.invalidType, 'Classe inconnue pour cette instanciation.', node, 'properties.classId')
      return null
    }
    const args = Array.isArray(node.children.arguments) ? node.children.arguments : []
    const members = classMembers.get(classId)
    const constructorId = members?.constructor ?? null
    if (!constructorId) {
      if (args.length > 0) report(codes.typeMismatch, 'Cette classe ne déclare aucun constructeur pour ces arguments.', node, 'children.arguments')
    } else {
      const constructor = nodes.get(constructorId)
      const signature = constructor ? declaration(constructor) : null
      if (signature?.kind === 'function') {
        if (signature.parameters.length !== args.length) report(codes.typeMismatch, 'Nombre d’arguments incompatible avec le constructeur.', node, 'children.arguments')
        args.forEach((argument, index) => {
          if (signature.parameters[index]) expect(signature.parameters[index], resolve(argument.sourceId), node, `children.arguments[${index}]`)
        })
        const contextClassId = contexts.get(node.sourceId)?.classId ?? null
        if (members.constructorVisibility === 'private' && contextClassId !== classId) {
          report(codes.typeMismatch, 'Le constructeur de cette classe est privé.', node, 'properties.classId')
        }
      }
    }
    return classType(classId, classModule.name)
  }

  // Retrouve la cible directe d'un appel générique, y compris via un import.
  function genericTarget(calleeNode) {
    if (calleeNode?.kind !== 'Reference') return null
    const symbol = referenceSymbols.get(calleeNode.sourceId)
    const target = symbol?.nodeId ? nodes.get(symbol.nodeId) : null
    return target?.kind === 'FunctionDeclaration' && declaredTypeParameters(target).length > 0 ? target : null
  }

  // Lie un motif de signature à l'argument réel, en respectant les tableaux génériques.
  function bindGeneric(pattern, actual, bindings, node, field) {
    if (!actual) return false
    if (isGenericType(pattern)) {
      if (!isValidParameterType(actual)) {
        report(codes.typeMismatch, 'L’argument ne peut pas instancier un paramètre de type avec ce type.', node, field)
        return false
      }
      const previous = bindings.get(pattern.name)
      if (previous) {
        if (sameType(previous, actual)) return true
        report(codes.typeMismatch, `Les occurrences de ${pattern.name} doivent recevoir exactement le même type.`, node, field)
        return false
      }
      bindings.set(pattern.name, actual)
      return true
    }
    if (pattern?.kind === 'array') {
      if (!isArrayType(actual)) {
        report(codes.typeMismatch, 'Un tableau est attendu pour instancier ce type.', node, field)
        return false
      }
      return bindGeneric(pattern.elementType, actual.elementType, bindings, node, field)
    }
    return expect(pattern, actual, node, field)
  }

  // Infère chaque paramètre de type depuis les arguments, vérifie sa contrainte puis substitue le retour.
  function genericCall(node, target) {
    const signature = declaration(target)
    if (!signature) return null
    const typeParameters = declaredTypeParameters(target)
    const bindings = new Map()
    const args = Array.isArray(node.children.arguments) ? node.children.arguments : []
    if (signature.parameters.length !== args.length) {
      report(codes.typeMismatch, 'Nombre d’arguments incompatible avec la signature.', node, 'children.arguments')
      return null
    }
    let valid = true
    signature.parameters.forEach((parameter, index) => {
      const actual = resolve(args[index]?.sourceId)
      if (containsGeneric(parameter)) {
        if (!bindGeneric(parameter, actual, bindings, node, `children.arguments[${index}]`)) valid = false
        return
      }
      if (!expect(parameter, actual, node, `children.arguments[${index}]`)) valid = false
    })
    for (const parameter of typeParameters) {
      const inferred = bindings.get(parameter.name)
      if (!inferred) {
        report(codes.typeMismatch, `Impossible d’inférer ${parameter.name} depuis les arguments de l’appel.`, node, 'children.arguments')
        valid = false
        continue
      }
      const constraint = typeParameterConstraint(parameter)
      if (constraint && !sameType(constraint, inferred)) {
        report(codes.typeMismatch, `Le type inféré pour ${parameter.name} ne respecte pas sa contrainte exacte.`, node, 'children.arguments')
        valid = false
      }
    }
    if (!valid) return null
    const types = typeParameters.map((parameter) => ({ name: parameter.name, type: bindings.get(parameter.name) }))
    genericCalls.push({ nodeId: node.sourceId, ...(types.length === 1 ? { type: types[0].type } : {}), types })
    return substituteType(signature.returnType, bindings)
  }

  // Contrôle intégralement une signature d'appel avant de publier son type de retour.
  function call(node) {
    const calleeNode = child(node, 'callee')
    const generic = genericTarget(calleeNode)
    if (generic) return genericCall(node, generic)
    const callee = resolve(calleeNode?.sourceId)
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

  // Contrôle l'arité et les types d'une opération mathématique native, puis publie son type de retour.
  function mathCall(node) {
    const definition = getMathNative(node.properties?.name)
    if (!definition) {
      report(codes.incomplete, 'Opération mathématique absente ou inconnue.', node, 'properties.name')
      return null
    }
    const args = Array.isArray(node.children?.arguments) ? node.children.arguments : []
    if (args.length !== definition.parameters.length) {
      report(codes.typeMismatch, 'Nombre d’arguments incompatible avec l’opération mathématique.', node, 'children.arguments')
      return null
    }
    const argumentTypes = args.map((argument) => resolve(argument?.sourceId))
    let valid = true
    args.forEach((argument, index) => {
      const expected = definition.parameters[index]
      const actual = argumentTypes[index]
      // Un paramètre tableau générique accepte n'importe quel tableau sans imposer son élément.
      if (expected?.kind === 'array' && !expected.elementType) {
        if (!isArrayType(actual)) {
          report(codes.typeMismatch, 'Un tableau est attendu.', node, `children.arguments[${index}]`)
          valid = false
        }
        return
      }
      // Le second paramètre doit correspondre exactement au type d'élément du tableau reçu.
      if (expected?.kind === 'arrayElement') {
        const array = argumentTypes[expected.arrayIndex]
        if (isArrayType(array) && (!actual || !sameType(array.elementType, actual))) {
          report(codes.typeMismatch, 'L’élément doit avoir le type d’élément du tableau.', node, `children.arguments[${index}]`)
          valid = false
        }
        return
      }
      if (!expect(expected, actual, node, `children.arguments[${index}]`)) valid = false
    })
    const checkIndex = typeof definition.check === 'function' ? definition.check(argumentTypes) : null
    if (typeof checkIndex === 'number') {
      report(codes.typeMismatch, 'Les tableaux doivent avoir le même type d’élément.', node, `children.arguments[${checkIndex}]`)
      valid = false
    }
    const returnType = typeof definition.returnType === 'function' ? definition.returnType(argumentTypes) : definition.returnType
    return valid ? returnType : null
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
    else if (node.kind === 'LambdaExpression') type = lambda(node)
    else if (node.kind === 'Literal') {
      const declared = annotation(node)
      if (declared && acceptConstant(validateLiteral(declared.name, node.properties.value), node)) type = declared
    } else if (node.kind === 'Reference') type = reference(node)
    else if (['BinaryExpression', 'UnaryExpression'].includes(node.kind)) type = operation(node)
    else if (node.kind === 'CastExpression') type = cast(node)
    else if (node.kind === 'CallExpression') type = call(node)
    else if (node.kind === 'MathCall') type = mathCall(node)
    else if (node.kind === 'ArrayLiteral') type = arrayLiteral(node)
    else if (node.kind === 'ArrayCreation') type = arrayCreation(node)
    else if (node.kind === 'ArrayAccess') type = arrayAccess(node)
    else if (node.kind === 'NewExpression') type = newExpression(node)
    else if (node.kind === 'ThisExpression') type = thisExpression(node)
    else if (node.kind === 'MemberExpression') type = member(node)
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
      if (node.properties?.constructor === true) {
        if (node.properties.name !== 'constructor') report(codes.invalidStructure, 'Le constructeur doit être nommé constructor.', node, 'properties.name')
        if (result && result.name !== 'void') report(codes.invalidType, 'Le constructeur ne déclare pas de type de retour.', node, 'properties.type')
        if (node.properties.entryPoint === true) report(codes.invalidEntryPoint, 'Le constructeur ne peut pas être le point d’entrée du projet.', node, 'properties.entryPoint')
      } else if (result && result.name !== 'void' && !guaranteesReturn(child(node, 'body'))) {
        report(codes.missingReturn, 'Une fonction non void doit retourner une valeur sur tous les chemins vérifiés.', node, 'children.body')
      }
    }
    if (node.properties?.visibility !== undefined) {
      if (!['public', 'private'].includes(node.properties.visibility)) report(codes.invalidStructure, 'La visibilité doit être public ou private.', node, 'properties.visibility')
      if (!contexts.get(node.sourceId)?.classMember) report(codes.invalidStructure, 'La visibilité est réservée aux membres d’une classe.', node, 'properties.visibility')
    }
    if (Object.hasOwn(node.properties ?? {}, 'constructor')) {
      if (typeof node.properties.constructor !== 'boolean') report(codes.invalidStructure, 'Le marqueur constructeur doit être un booléen.', node, 'properties.constructor')
      else if (node.properties.constructor && (node.kind !== 'FunctionDeclaration' || !contexts.get(node.sourceId)?.classMember)) report(codes.invalidStructure, 'Le constructeur est réservé aux méthodes d’une classe.', node, 'properties.constructor')
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
      const dereference = target?.kind === 'UnaryExpression'
      if (target && !dereference && !['Reference', 'ArrayAccess', 'MemberExpression'].includes(target.kind)) report(codes.illegalPlacement, 'La cible d’affectation doit être une variable, un élément de tableau, un membre de classe ou un déréférencement.', node, 'children.target')
      if (target?.kind === 'MemberExpression') {
        const info = memberInfo(target)
        if (info && info.memberNode?.kind !== 'VariableDeclaration') report(codes.illegalPlacement, 'Seul un attribut modifiable peut être la cible d’une affectation.', node, 'children.target')
      }
      // Un déréférencement d'écriture vise la valeur stockée ; l'adresse d'une constante reste intouchable.
      if (dereference) {
        if (target.properties.operator !== '*') report(codes.illegalPlacement, 'Seul le déréférencement peut être une cible d’affectation.', node, 'children.target')
        const address = child(target, 'operand')
        if (address?.kind === 'UnaryExpression' && address.properties.operator === '&') {
          const addressed = child(address, 'operand')
          const addressedArray = addressed?.kind === 'ArrayAccess' ? child(addressed, 'array') : null
          const addressedSymbol = addressed?.kind === 'Reference' ? referenceSymbols.get(addressed.sourceId)
            : addressedArray?.kind === 'Reference' ? referenceSymbols.get(addressedArray.sourceId) : null
          if (addressedSymbol?.kind === 'ConstantDeclaration') report(codes.illegalPlacement, 'Une constante ne se modifie pas à travers un pointeur.', node, 'children.target')
        }
      }
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
    if (node.kind === 'ForEachStatement') {
      const arrayNode = child(node, 'array')
      const callbackNode = child(node, 'callback')
      const arrayValueType = arrayNode ? resolve(arrayNode.sourceId) : null
      if (arrayNode && arrayValueType && !isArrayType(arrayValueType)) {
        report(codes.typeMismatch, 'ForEach attend un tableau en premier emplacement.', node, 'children.array')
      }
      if (callbackNode) {
        const callbackType = resolve(callbackNode.sourceId)
        if (callbackType && callbackType.kind !== 'function') {
          report(codes.typeMismatch, 'ForEach attend une fonction de rappel en second emplacement.', node, 'children.callback')
        } else if (callbackType?.kind === 'function' && isArrayType(arrayValueType)) {
          const expected = functionType([arrayValueType.elementType], primitiveType('void'))
          if (!sameType(expected, callbackType)) {
            report(codes.typeMismatch, 'La fonction de rappel doit accepter un élément du tableau et retourner void.', node, 'children.callback')
          }
        }
      }
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
    genericCalls,
    symbols: semantic.model.symbols.map((symbol) => {
      const type = resolve(symbol.nodeId)
      return type ? { ...symbol, type } : { ...symbol }
    }),
  }
}
