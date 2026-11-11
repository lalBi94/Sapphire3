import { analyzeProgram } from './analysis.js'
import { validateLiteral, convertConstant, evaluateBinary, evaluateUnary } from './numericConstants.js'
import { createDebugRecorder } from './debugTrace.js'
import { satisfiesContract, normalizeContracts } from './contracts.js'
import { getMathNative } from './mathNatives.js'
import { createScreenStateReader, sameScreenStates } from './screenState.js'
import { createGaugeStateReader } from './gaugeState.js'
import { createLedStateReader } from './ledState.js'
import { createRgbLedStateReader } from './rgbLedState.js'
import { createProgressStateReader } from './progressState.js'
import { createBarChartStateReader } from './barChartState.js'
import { createXyPlotStateReader } from './xyPlotState.js'
import { createOscilloscopeStateReader } from './oscilloscopeState.js'
import { createHeatmapStateReader } from './heatmapState.js'
import { moduleInitializationOrder } from './moduleInitialization.js'

// Ajoute un code stable sans introduire de traduction ni de dépendance UI dans le moteur.
function simulationError(code, message) {
  return Object.assign(new Error(message), { code })
}

// Exécute le sous-ensemble déterministe du langage sans accéder au DOM ni au système.
export function simulateProgram(project, { maxSteps = 10000, captureDebug = false, functionId = null, args = [], inputs = {}, capturePluginVariables = [], onProgress = null } = {}) {
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 100000) return { ok: false, output: [], trace: [], errorCode: 'SIMULATION_BUDGET_INVALID', error: 'The step budget must be an integer between 1 and 100000.' }
  const pluginVariableNames = Array.isArray(capturePluginVariables)
    ? [...new Set(capturePluginVariables.filter((name) => typeof name === 'string' && name.length > 0))].slice(0, 64)
    : []
  const analysis = analyzeProgram(project)
  if (!analysis.canGenerate) return { ok: false, output: [], trace: [], errorCode: 'SIMULATION_DIAGNOSTICS', error: 'The program has blocking diagnostics.', diagnostics: analysis.diagnostics }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const references = new Map(analysis.semantic.references.map((reference) => [reference.nodeId, reference]))
  const types = new Map(analysis.semantic.nodeTypes.map((entry) => [entry.nodeId, entry.type]))
  const functions = new Map(analysis.semantic.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration').map((symbol) => [symbol.nodeId, nodes.get(symbol.nodeId)]))
  const classMembers = analysis.semantic.index?.classMembers ?? new Map()
  const classModules = analysis.semantic.index?.classModules ?? new Map()
  // Contraintes vérifiables attachées aux nœuds, lues sur la valeur du symbole déclaré.
  const contracts = []
  for (const node of project.nodes) {
    const entries = normalizeContracts(node?.contracts)
    if (entries.length) contracts.push({ nodeId: node.id, name: node.properties?.name || node.id, entries })
  }
  const contractViolations = []
  const contractStates = new Map()
  let contractObservations = 0
  const maximumContractViolations = 100
  const entry = [...functions.values()].find((node) => node?.properties?.entryPoint === true)
  // Cible explicite (exécuter une fonction choisie) ou, par défaut, le point d'entrée du projet.
  const target = functionId ? nodes.get(functionId) : entry
  const output = []
  const outputSteps = []
  const trace = []
  let steps = 0
  const screenReader = (project.modules ?? []).some((module) => module.screen) ? createScreenStateReader(project) : null
  const usesPresent = (project.nodes ?? []).some((node) => node?.kind === 'MathCall' && node.properties?.name === 'screenPresent')
  // Jauges : un état complet par pas, pour que la carte suive exactement le focus de nœud.
  const gaugeReader = (project.modules ?? []).some((module) => module.gauge) ? createGaugeStateReader(project) : null
  const gaugeFrames = []
  const maximumGaugeFrames = 8000
  // LED : un état booléen par pas pour suivre le focus de nœud.
  const ledReader = (project.modules ?? []).some((module) => module.led) ? createLedStateReader(project) : null
  const ledFrames = []
  // LED RVB : trois canaux entiers par pas, même suivi que les voyants.
  const rgbLedReader = (project.modules ?? []).some((module) => module.rgbLed) ? createRgbLedStateReader(project) : null
  const rgbLedFrames = []
  // Barres de progression : même suivi par pas que les jauges.
  const progressReader = (project.modules ?? []).some((module) => module.progress) ? createProgressStateReader(project) : null
  const progressFrames = []
  // Graphiques à barres : même suivi par pas que les jauges.
  const barChartReader = (project.modules ?? []).some((module) => module.barChart) ? createBarChartStateReader(project) : null
  const barChartFrames = []
  // Traceurs XY : même suivi par pas que les autres widgets.
  const xyPlotReader = (project.modules ?? []).some((module) => module.xyPlot) ? createXyPlotStateReader(project) : null
  const xyPlotFrames = []
  // Oscilloscopes : canaux et fenêtre suivis à chaque pas comme les autres widgets.
  const oscilloscopeReader = (project.modules ?? []).some((module) => module.oscilloscope) ? createOscilloscopeStateReader(project) : null
  const oscilloscopeFrames = []
  // Grilles thermiques : instantanés par pas uniquement, jamais par image d'écran.
  const heatmapReader = (project.modules ?? []).some((module) => module.heatmap) ? createHeatmapStateReader(project) : null
  const heatmapFrames = []
  const variableFrames = []
  const screenFrames = []
  // États de jauge et de LED alignés sur les images d'écran, pour les animer au même rythme.
  const screenFrameGauges = []
  const screenFrameLeds = []
  const screenFrameRgbLeds = []
  const screenFrameProgresses = []
  const screenFrameBarCharts = []
  const screenFrameXyPlots = []
  const screenFrameOscilloscopes = []
  const maximumScreenFrames = 240
  let lastScreens = null
  const breakSignal = Symbol('break')
  const continueSignal = Symbol('continue')
  const uninitialized = Symbol('uninitialized')
  let callDepth = 0
  let environmentSequence = 0
  let functionScope = null
  const activeScopes = []

  if (functionId && (!target || target.kind !== 'FunctionDeclaration')) return { ok: false, output, trace, errorCode: 'SIMULATION_FUNCTION_MISSING', error: 'The function to run cannot be resolved.' }
  if (!functionId) {
    if (!entry) return { ok: false, output, trace, errorCode: 'SIMULATION_ENTRY_MISSING', error: 'No entry point is marked.' }
    if ((entry.children.parameters ?? []).length > 0) return { ok: false, output, trace, errorCode: 'SIMULATION_ENTRY_INPUTS', error: 'The entry point must not require inputs.' }
  }

  // Valeurs d'entrée fournies par l'appelant, validées selon le type déclaré de chaque paramètre.
  const callArguments = []
  if (functionId) {
    const parameterIds = target.children.parameters ?? []
    if (!Array.isArray(args) || args.length !== parameterIds.length) return { ok: false, output, trace, errorCode: 'SIMULATION_ARGUMENTS_INVALID', error: 'The provided inputs do not match the function parameters.' }
    for (const [index, parameterId] of parameterIds.entries()) {
      const validated = validateLiteral(types.get(parameterId)?.name, args[index])
      if (validated.code) return { ok: false, output, trace, errorCode: 'SIMULATION_ARGUMENTS_INVALID', error: 'An input value is not valid for its parameter type.' }
      callArguments.push(validated.value)
    }
  }

  // Associe chaque activation à son scope source, y compris les itérations et appels récursifs.
  function environment(parent, scopeId, nodeId) {
    environmentSequence += 1
    return { values: new Map(), parent, scopeId, nodeId, instanceId: environmentSequence }
  }

  // Place un arrêt avant l'instruction, sans dévoiler les futurs états ni les futures sorties.
  function observe(node, current) {
    if (!debug) return
    lastEnvironment = current
    lastScopes = [...activeScopes]
    lastInstructionId = node.id
    debug.record(node.id, current, activeScopes)
  }

  // Compte aussi les itérations sans condition ni instruction pour garantir l'arrêt.
  function step(node) {
    steps += 1
    if (steps > maxSteps) throw simulationError('SIMULATION_STEP_LIMIT', 'Simulation step limit reached.')
    if (onProgress && steps % 500 === 0) onProgress({ phase: 'simulation', current: steps, total: maxSteps })
    trace.push(node.id)
    if (gaugeReader && gaugeFrames.length < maximumGaugeFrames) gaugeFrames.push(gaugeReader(global.values))
    if (ledReader && ledFrames.length < maximumGaugeFrames) ledFrames.push(ledReader(global.values))
    if (rgbLedReader && rgbLedFrames.length < maximumGaugeFrames) rgbLedFrames.push(rgbLedReader(global.values))
    if (progressReader && progressFrames.length < maximumGaugeFrames) progressFrames.push(progressReader(global.values))
    if (barChartReader && barChartFrames.length < maximumGaugeFrames) barChartFrames.push(barChartReader(global.values))
    if (xyPlotReader && xyPlotFrames.length < maximumGaugeFrames) xyPlotFrames.push(xyPlotReader(global.values))
    if (oscilloscopeReader && oscilloscopeFrames.length < maximumGaugeFrames) oscilloscopeFrames.push(oscilloscopeReader(global.values))
    if (heatmapReader && heatmapFrames.length < maximumGaugeFrames) heatmapFrames.push(heatmapReader(global.values))
    if (pluginVariableNames.length > 0 && variableFrames.length < maximumGaugeFrames) variableFrames.push(collectNamedVariables(pluginVariableNames))
    return node
  }

  // Conserve une image d'écran : soit à chaque écriture, soit uniquement sur `screenPresent`
  // quand le programme marque lui-même ses images. Une séquence n'est jamais ouverte par une
  // image entièrement vide.
  function captureScreens(force = false) {
    if (!screenReader || screenFrames.length >= maximumScreenFrames) return
    const current = screenReader(global.values)
    if (!force && sameScreenStates(lastScreens, current)) return
    lastScreens = current
    const blank = Object.values(current).every((screen) => !screen.pixels.some((value, index) => index % 4 === 3 && value > 0))
    if (blank && screenFrames.length === 0 && !force) return
    screenFrames.push(current)
    if (gaugeReader) screenFrameGauges.push(gaugeReader(global.values))
    if (ledReader) screenFrameLeds.push(ledReader(global.values))
    if (rgbLedReader) screenFrameRgbLeds.push(rgbLedReader(global.values))
    if (progressReader) screenFrameProgresses.push(progressReader(global.values))
    if (barChartReader) screenFrameBarCharts.push(barChartReader(global.values))
    if (xyPlotReader) screenFrameXyPlots.push(xyPlotReader(global.values))
    if (oscilloscopeReader) screenFrameOscilloscopes.push(oscilloscopeReader(global.values))
  }

  // Cherche une déclaration dans les environnements lexicaux actifs, sans valeur implicite.
  function readBinding(nodeId, environment) {
    if (environment.values.has(nodeId)) {
      const value = environment.values.get(nodeId)
      if (value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'A value was read before it was initialized.')
      return value
    }
    if (environment.parent) return readBinding(nodeId, environment.parent)
    throw simulationError('SIMULATION_UNINITIALIZED', 'A value was read before it was initialized.')
  }

  // Modifie uniquement une déclaration existante dans la chaîne lexicale.
  function writeBinding(nodeId, value, environment) {
    if (environment.values.has(nodeId)) {
      environment.values.set(nodeId, value)
      return
    }
    if (environment.parent) {
      writeBinding(nodeId, value, environment.parent)
      return
    }
    throw simulationError('SIMULATION_UNINITIALIZED', 'A value was changed before it was initialized.')
  }

  // Retrouve la valeur de this dans la chaîne lexicale, sans fuite entre appels.
  function readThis(environment) {
    let current = environment
    while (current) {
      if (current.thisValue !== undefined) return current.thisValue
      current = current.parent
    }
    throw simulationError('SIMULATION_THIS', 'this is not available in this context.')
  }

  // Retrouve un membre déclaré dans une classe, avec sa visibilité.
  function classMember(classId, name) {
    const members = classMembers.get(classId)
    const memberId = members?.public.get(name) ?? members?.private.get(name)
    return memberId ? nodes.get(memberId) ?? null : null
  }

  // Résout un accès membre sur une instance de classe.
  function resolveMember(node, environment) {
    const object = valueOf(nodes.get(node.children.object), environment)
    if (!object || object.classValue !== true) throw simulationError('SIMULATION_MEMBER', 'Member access requires a class instance.')
    const name = node.properties?.name
    const member = classMember(object.classId, name)
    if (!member) throw simulationError('SIMULATION_MEMBER', `Unknown member: ${name}.`)
    if (member.kind === 'FunctionDeclaration') return { kind: 'method', node: member, object, name }
    return { kind: 'field', object, name, value: object.fields.get(name) }
  }

  // Crée une instance, initialise ses attributs puis exécute son constructeur.
  function newObject(node, environment) {
    const classId = node.properties?.classId
    const classModule = classModules.get(classId)
    const members = classMembers.get(classId)
    if (!classModule || !members) throw simulationError('SIMULATION_CLASS', 'The class cannot be resolved.')
    const object = { classValue: true, classId, className: classModule.name ?? '', fields: new Map() }
    for (const scope of ['public', 'private']) {
      for (const [name, memberId] of members[scope]) {
        const member = nodes.get(memberId)
        if (member?.kind !== 'VariableDeclaration' && member?.kind !== 'ConstantDeclaration') continue
        object.fields.set(name, member.children.initializer ? valueOf(nodes.get(member.children.initializer), environment) : uninitialized)
      }
    }
    const constructor = members.constructor ? nodes.get(members.constructor) : null
    const args = (node.children.arguments ?? []).map((id) => valueOf(nodes.get(id), environment))
    if (constructor) executeFunction(constructor, args, object)
    else if (args.length > 0) throw simulationError('SIMULATION_CONSTRUCTOR', 'This class has no constructor for these arguments.')
    return object
  }

  // Réutilise les contrôles numériques statiques sur les valeurs calculées à l'exécution.
  function checked(result) {
    if (result.code) throw simulationError(result.code, `${result.code}: ${result.message}`)
    return result.value
  }

  // Compare deux adresses par l'emplacement désigné, jamais par l'objet qui les porte.
  function sameAddress(left, right) {
    if (left.kind !== right.kind) return false
    if (left.kind === 'element') return left.array === right.array && left.index === right.index
    return left.nodeId === right.nodeId && left.environment === right.environment
  }

  // Convertit une valeur entière source en index JavaScript et contrôle les bornes du tableau.
  function arrayIndex(value, array) {
    const index = typeof value === 'bigint' ? Number(value) : value
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= array.length) {
      throw simulationError('SIMULATION_ARRAY_BOUNDS', 'An array index is outside its bounds.')
    }
    return index
  }

  // Lit un élément en refusant les cases jamais remplies, comme une variable sans initialiseur.
  function readElement(array, index) {
    const value = array[index]
    if (value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'An array element was read before it was initialized.')
    return value
  }

  // Évalue une expression typée, avec court-circuit pour les opérateurs booléens.
  function valueOf(node, environment) {
    step(node)
    if (node.kind === 'Literal') return checked(validateLiteral(types.get(node.id)?.name, node.properties.value))
    if (node.kind === 'Reference') {
      const symbol = symbols.get(references.get(node.id)?.symbolId)
      if (!symbol) throw simulationError('SIMULATION_REFERENCE', 'The reference cannot be resolved.')
      const target = functions.get(symbol.nodeId)
      if (target) return { functionValue: true, nodeId: symbol.nodeId, label: `fn ${target.properties?.name ?? symbol.name ?? symbol.nodeId}` }
      return readBinding(symbol.nodeId, environment)
    }
    if (node.kind === 'BinaryExpression') {
      const operator = node.properties.operator
      const left = valueOf(nodes.get(node.children.left), environment)
      if (operator === 'and' && !left) return false
      if (operator === 'or' && left) return true
      const right = valueOf(nodes.get(node.children.right), environment)
      // Deux adresses sont égales si elles désignent le même emplacement, pas le même objet.
      if (['==', '!='].includes(operator) && (left?.pointer === true || right?.pointer === true)) {
        const equal = left?.pointer === true && right?.pointer === true && sameAddress(left, right)
        return operator === '==' ? equal : !equal
      }
      return checked(evaluateBinary(operator, left, right, types.get(node.children.left)?.name))
    }
    if (node.kind === 'UnaryExpression') {
      const operator = node.properties.operator
      const operand = nodes.get(node.children.operand)
      // Adresse d'une valeur stockable : référence à une variable ou à un élément de tableau.
      if (operator === '&') {
        if (operand?.kind === 'ArrayAccess') {
          const array = valueOf(nodes.get(operand.children.array), environment)
          if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The addressed value is not an array element.')
          const index = arrayIndex(valueOf(nodes.get(operand.children.index), environment), array)
          const arrayReference = nodes.get(operand.children.array)
          const arraySymbol = arrayReference?.kind === 'Reference' ? symbols.get(references.get(arrayReference.id)?.symbolId) : null
          step(operand)
          return { pointer: true, kind: 'element', array, index, constant: arraySymbol?.kind === 'ConstantDeclaration', label: `&[${index}]` }
        }
        const symbol = symbols.get(references.get(operand?.id)?.symbolId)
        if (!symbol) throw simulationError('SIMULATION_REFERENCE', 'The address target cannot be resolved.')
        step(operand)
        return { pointer: true, kind: 'reference', nodeId: symbol.nodeId, environment, constant: symbol.kind === 'ConstantDeclaration', label: `&${nodes.get(symbol.nodeId)?.properties?.name ?? symbol.nodeId}` }
      }
      // Lecture de la valeur pointée à travers l'adresse.
      if (operator === '*') {
        const pointer = valueOf(operand, environment)
        if (pointer?.pointer !== true) throw simulationError('SIMULATION_REFERENCE', 'The dereferenced value is not an address.')
        if (pointer.kind === 'element') return readElement(pointer.array, pointer.index)
        return readBinding(pointer.nodeId, pointer.environment)
      }
      return checked(evaluateUnary(operator, valueOf(operand, environment), types.get(node.id)?.name))
    }
    if (node.kind === 'CastExpression') {
      const value = valueOf(nodes.get(node.children.argument), environment)
      const target = types.get(node.id)?.name
      return target === types.get(node.children.argument)?.name ? value : checked(convertConstant(value, target))
    }
    if (node.kind === 'CallExpression') {
      const calleeNode = nodes.get(node.children.callee)
      const callee = valueOf(calleeNode, environment)
      const args = (node.children.arguments ?? []).map((id) => valueOf(nodes.get(id), environment))
      // Le callee est évalué comme une valeur : fonction déclarée, lambda ou variable de type fonction.
      if (callee?.methodValue === true) return executeFunction(callee.node, args, callee.object)
      if (callee?.lambdaValue === true) return executeLambda(callee.lambda, callee.environment, args)
      const target = callee?.functionValue === true ? functions.get(callee.nodeId) : null
      if (!target) throw simulationError('SIMULATION_REFERENCE', 'The called function cannot be resolved.')
      return executeFunction(target, args)
    }
    if (node.kind === 'LambdaExpression') {
      return { lambdaValue: true, nodeId: node.id, lambda: node, environment, label: 'fn <lambda>' }
    }
    // Opération mathématique native : déterministe et sans effet de bord.
    if (node.kind === 'MathCall') {
      const definition = getMathNative(node.properties?.name)
      if (!definition) throw simulationError('SIMULATION_REFERENCE', 'The math operation cannot be resolved.')
      const args = (node.children?.arguments ?? []).map((id) => valueOf(nodes.get(id), environment))
      const value = definition.run(args)
      // Un programme qui présente ses images ne capture que sur `screenPresent` ; sinon
      // chaque écriture native reste une image, comme avant.
      if (definition.id === 'screenPresent') captureScreens(true)
      else if (!usesPresent && !['screenBlit', 'screenResize'].includes(definition.id) && definition.id.startsWith('screen')) captureScreens(false)
      return value
    }
    if (node.kind === 'ArrayLiteral') {
      return (node.children.elements ?? []).map((id) => valueOf(nodes.get(id), environment))
    }
    if (node.kind === 'ArrayCreation') {
      const sizeValue = valueOf(nodes.get(node.children.size), environment)
      const size = typeof sizeValue === 'bigint' ? Number(sizeValue) : sizeValue
      if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
        throw simulationError('SIMULATION_ARRAY_BOUNDS', 'An array size must be a non-negative integer.')
      }
      const fill = node.children.initializer ? valueOf(nodes.get(node.children.initializer), environment) : uninitialized
      const values = []
      for (let position = 0; position < size; position += 1) {
        step(node)
        values.push(fill)
      }
      return values
    }
    if (node.kind === 'ArrayAccess') {
      const array = valueOf(nodes.get(node.children.array), environment)
      if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The indexed value is not an array.')
      return readElement(array, arrayIndex(valueOf(nodes.get(node.children.index), environment), array))
    }
    if (node.kind === 'NewExpression') return newObject(node, environment)
    if (node.kind === 'ThisExpression') return readThis(environment)
    if (node.kind === 'MemberExpression') {
      const member = resolveMember(node, environment)
      if (member.kind === 'field') {
        if (member.value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'A field was read before it was initialized.')
        return member.value
      }
      return { methodValue: true, node: member.node, object: member.object, label: `fn ${member.name}` }
    }
    throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported expression: ${node.kind}.`)
  }

  // Lit une liaison sans lever d'erreur : une valeur absente rend le contrat non évaluable.
  function peekBinding(nodeId, environment) {
    let current = environment
    while (current) {
      if (current.values.has(nodeId)) {
        const value = current.values.get(nodeId)
        return value === uninitialized ? undefined : value
      }
      current = current.parent
    }
    return undefined
  }

  // Liste les variables observées (globales puis scope de la fonction visée) avec type et valeur.
  function collectVariables() {
    const list = []
    const add = (scope, kind) => {
      if (!scope) return
      for (const [id, value] of scope.values) {
        const node = nodes.get(id)
        list.push({ id, name: node?.properties?.name ?? id, kind, type: typeText(types.get(id)), value: value === uninitialized ? null : formatValue(value), raw: value === uninitialized ? null : serializableValue(value) })
      }
    }
    add(global, 'global')
    if (functionScope && functionScope !== global) add(functionScope, 'local')
    return list
  }

  // Convertit une valeur en donnée sérialisable pour les liaisons de widgets.
  function serializableValue(value, seen = new Set()) {
    if (value === undefined) return null
    if (typeof value === 'bigint') return Number(value)
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null) return value
    if (Array.isArray(value)) return value.map((entry) => serializableValue(entry, seen))
    if (value && typeof value === 'object') {
      if (seen.has(value)) return null
      const next = new Set(seen).add(value)
      if (value.classValue === true) return formatValue(value, next)
      if (value.pointer === true || value.functionValue === true || value.lambdaValue === true || value.methodValue === true) return value.label ?? null
      return null
    }
    return String(value)
  }

  // Capture uniquement les variables demandées par les widgets de plugin du dashboard.
  function collectNamedVariables(names) {
    const values = {}
    const add = (scope) => {
      if (!scope) return
      for (const [id, value] of scope.values) {
        const name = nodes.get(id)?.properties?.name
        if (!names.includes(name)) continue
        values[name] = value === uninitialized ? null : serializableValue(value)
      }
    }
    add(global)
    if (functionScope && functionScope !== global) add(functionScope)
    return values
  }

  // Vérifie chaque contrat sur l'état courant ; une violation n'est signalée qu'une fois par valeur observée.
  function checkContracts(environment) {
    if (contracts.length === 0) return
    for (const entry of contracts) {
      const value = peekBinding(entry.nodeId, environment)
      if (value === undefined) continue
      for (const contract of entry.entries) {
        const satisfied = satisfiesContract(contract.kind, value, contract.arguments)
        if (satisfied === null) continue
        contractObservations += 1
        const key = `${entry.nodeId}:${contract.kind}:${JSON.stringify(contract.arguments ?? [])}`
        if (satisfied) { contractStates.delete(key); continue }
        const observed = formatValue(value)
        const previous = contractStates.get(key)
        if (!previous || previous !== observed) {
          contractStates.set(key, observed)
          if (contractViolations.length < maximumContractViolations) contractViolations.push({ nodeId: entry.nodeId, name: entry.name, kind: contract.kind, arguments: contract.arguments ?? [], step: steps, value: observed })
        }
      }
    }
  }

  // Vérifie les contrats après chaque instruction, même si un retour interrompt la suite.
  function executeStatement(node, environment) {
    try {
      runStatement(node, environment)
    } finally {
      checkContracts(environment)
    }
  }

  // Exécute une instruction et propage les contrôles de flux jusqu'à leur propriétaire.
  function runStatement(node, environment) {
    if (debug) {
      lastEnvironment = environment
      lastScopes = [...activeScopes]
      lastInstructionId = node.id
    }
    step(node)
    if (!['WhileStatement', 'ForStatement', 'FunctionDeclaration', 'TypeDeclaration', 'Block'].includes(node.kind)) observe(node, environment)
    if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') {
      environment.values.set(node.id, node.children.initializer ? valueOf(nodes.get(node.children.initializer), environment) : uninitialized)
      return
    }
    if (node.kind === 'PrintStatement') {
      output.push(formatValue(valueOf(nodes.get(node.children.value), environment)))
      // Position dans la trace au moment de l'affichage : l'UI révèle la sortie au rythme des pas.
      outputSteps.push(trace.length)
      return
    }
    if (node.kind === 'ForEachStatement') {
      const array = valueOf(nodes.get(node.children.array), environment)
      if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'ForEach expects an array.')
      const callback = valueOf(nodes.get(node.children.callback), environment)
      // La copie fige les éléments visités même si le rappel modifie le tableau d'origine.
      const snapshot = [...array]
      for (const element of snapshot) {
        step(node)
        observe(node, environment)
        if (callback?.lambdaValue === true) executeLambda(callback.lambda, callback.environment, [element])
        else if (callback?.methodValue === true) executeFunction(callback.node, [element], callback.object)
        else {
          const target = callback?.functionValue === true ? functions.get(callback.nodeId) : null
          if (!target) throw simulationError('SIMULATION_REFERENCE', 'ForEach expects a function callback.')
          executeFunction(target, [element])
        }
      }
      return
    }
    if (node.kind === 'AssignmentStatement') {
      const target = nodes.get(node.children.target)
      if (target?.kind === 'MemberExpression') {
        const member = resolveMember(target, environment)
        if (member.kind !== 'field') throw simulationError('SIMULATION_MEMBER', 'A method cannot be assigned.')
        member.object.fields.set(member.name, valueOf(nodes.get(node.children.value), environment))
        return
      }
      if (target?.kind === 'ArrayAccess') {
        const array = valueOf(nodes.get(target.children.array), environment)
        if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The indexed value is not an array.')
        const index = arrayIndex(valueOf(nodes.get(target.children.index), environment), array)
        array[index] = valueOf(nodes.get(node.children.value), environment)
        return
      }
      // Écriture à travers un pointeur : modifie la valeur réelle de l'emplacement visé.
      if (target?.kind === 'UnaryExpression' && target.properties.operator === '*') {
        const address = valueOf(nodes.get(target.children.operand), environment)
        if (address?.pointer !== true) throw simulationError('SIMULATION_REFERENCE', 'The dereferenced value is not an address.')
        if (address.constant) throw simulationError('SIMULATION_CONST_IMMUTABLE', 'A constant cannot be modified through a pointer.')
        const value = valueOf(nodes.get(node.children.value), environment)
        if (address.kind === 'element') {
          address.array[address.index] = value
          return
        }
        writeBinding(address.nodeId, value, address.environment)
        return
      }
      const symbol = symbols.get(references.get(target?.id)?.symbolId)
      if (!symbol) throw simulationError('SIMULATION_REFERENCE', 'The assignment target cannot be resolved.')
      writeBinding(symbol.nodeId, valueOf(nodes.get(node.children.value), environment), environment)
      return
    }
    if (node.kind === 'ExpressionStatement') {
      valueOf(nodes.get(node.children.expression), environment)
      return
    }
    if (node.kind === 'IfStatement') {
      const branch = valueOf(nodes.get(node.children.test), environment) ? node.children.consequent : node.children.alternate
      if (branch) executeBlock(nodes.get(branch), environment)
      return
    }
    if (node.kind === 'WhileStatement') {
      while (true) {
        observe(node, environment)
        if (!valueOf(nodes.get(node.children.test), environment)) break
        try { executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
      }
      return
    }
    if (node.kind === 'ForStatement') {
      executeFor(node, environment)
      return
    }
    if (node.kind === 'ReturnStatement') throw { type: 'return', value: node.children.argument ? valueOf(nodes.get(node.children.argument), environment) : undefined }
    if (node.kind === 'BreakStatement') throw breakSignal
    if (node.kind === 'ContinueStatement') throw continueSignal
    if (node.kind === 'Block') executeBlock(node, environment)
    else if (!['FunctionDeclaration', 'TypeDeclaration', 'Parameter'].includes(node.kind)) throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported statement: ${node.kind}.`)
  }

  // Garde l'initialiseur et l'update dans la même activation de boucle, séparée du bloc de corps.
  function executeFor(node, parent) {
    const current = environment(parent, `for:${node.id}`, node.id)
    activeScopes.push(current)
    try {
      if (node.children.initializer) executeStatement(nodes.get(node.children.initializer), current)
      while (true) {
        observe(node, current)
        if (node.children.test && !valueOf(nodes.get(node.children.test), current)) break
        step(node)
        try { executeBlock(nodes.get(node.children.body), current) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
        if (node.children.update) {
          const update = nodes.get(node.children.update)
          if (update.kind === 'AssignmentStatement') executeStatement(update, current)
          else {
            observe(update, current)
            valueOf(update, current)
          }
        }
      }
    } finally {
      activeScopes.pop()
    }
  }

  // Recrée les variables d'un bloc à chaque entrée, notamment dans les boucles.
  function executeBlock(block, parent, reuse = false) {
    const current = reuse ? parent : environment(parent, `block:${block.id}`, block.id)
    if (!reuse) activeScopes.push(current)
    try {
      for (const id of block.children.statements ?? []) executeStatement(nodes.get(id), current)
    } finally {
      if (!reuse) activeScopes.pop()
    }
  }

  // Isole chaque appel de lambda dans son environnement capturé, sans copier les liaisons.
  function executeLambda(lambda, captured, args) {
    callDepth += 1
    if (callDepth > 200) throw simulationError('SIMULATION_CALL_LIMIT', 'Simulation call depth limit reached.')
    const current = environment(captured, `lambda:${lambda.id}`, lambda.id)
    if (callDepth === 1) functionScope = current
    activeScopes.push(current)
    for (const [index, parameterId] of (lambda.children.parameters ?? []).entries()) current.values.set(parameterId, args[index])
    try {
      observe(lambda, current)
      const body = nodes.get(lambda.children.body)
      return body ? valueOf(body, current) : undefined
    } finally {
      activeScopes.pop()
      callDepth -= 1
    }
  }

  // Isole chaque appel du contexte de l'appelant et borne la récursion avant la pile JavaScript.
  function executeFunction(node, args, thisValue = null) {
    callDepth += 1
    if (callDepth > 200) throw simulationError('SIMULATION_CALL_LIMIT', 'Simulation call depth limit reached.')
    const current = environment(global, `function:${node.id}`, node.id)
    if (thisValue) current.thisValue = thisValue
    if (callDepth === 1) functionScope = current
    activeScopes.push(current)
    for (const [index, parameterId] of (node.children.parameters ?? []).entries()) current.values.set(parameterId, args[index])
    try {
      observe(node, current)
      executeBlock(nodes.get(node.children.body), current, true)
    } catch (signal) {
      if (signal?.type === 'return') return signal.value
      throw signal
    } finally {
      activeScopes.pop()
      callDepth -= 1
    }
    return undefined
  }

  const global = { values: new Map(), parent: null }
  if (screenReader) {
    lastScreens = screenReader(global.values)
    const visible = Object.values(lastScreens).some((screen) => screen.pixels.some((value, index) => index % 4 === 3 && value > 0))
    if (visible) {
      screenFrames.push(lastScreens)
      if (gaugeReader) screenFrameGauges.push(gaugeReader(global.values))
      if (ledReader) screenFrameLeds.push(ledReader(global.values))
      if (rgbLedReader) screenFrameRgbLeds.push(rgbLedReader(global.values))
      if (progressReader) screenFrameProgresses.push(progressReader(global.values))
      if (barChartReader) screenFrameBarCharts.push(barChartReader(global.values))
      if (xyPlotReader) screenFrameXyPlots.push(xyPlotReader(global.values))
      if (oscilloscopeReader) screenFrameOscilloscopes.push(oscilloscopeReader(global.values))
    }
  }
  const debug = captureDebug ? createDebugRecorder(analysis, global, output, uninitialized) : null
  let lastEnvironment = global
  let lastScopes = []
  let lastInstructionId = null
  try {
    for (const module of moduleInitializationOrder(project, analysis)) {
      if (module.kind === 'class') continue
      for (const id of module.rootNodeIds) {
        const node = nodes.get(id)
        if (node && node.kind !== 'FunctionDeclaration') executeStatement(node, global)
      }
    }
    // Les entrées interactives remplacent la valeur initiale des globales visées,
    // après leur déclaration et avant l'exécution du point d'entrée.
    if (inputs && typeof inputs === 'object' && !Array.isArray(inputs)) {
      for (const [nodeId, value] of Object.entries(inputs)) {
        const node = nodes.get(nodeId)
        if (!node || (node.kind !== 'VariableDeclaration' && node.kind !== 'ConstantDeclaration')) continue
        global.values.set(nodeId, checked(validateLiteral(types.get(nodeId)?.name, value)))
      }
    }
    const returned = executeFunction(target, callArguments)
    debug?.record(null, global, [], 'completed')
    return {
      ok: true,
      output,
      outputSteps,
      trace,
      result: typeof returned === 'bigint' ? Number(returned) : returned,
      returnValue: returned === undefined ? null : formatValue(returned),
      steps,
      variables: collectVariables(),
      screens: screenReader ? screenReader(global.values) : {},
      gauges: gaugeReader ? gaugeReader(global.values) : {},
      leds: ledReader ? ledReader(global.values) : {},
      rgbLeds: rgbLedReader ? rgbLedReader(global.values) : {},
      progresses: progressReader ? progressReader(global.values) : {},
      barCharts: barChartReader ? barChartReader(global.values) : {},
      xyPlots: xyPlotReader ? xyPlotReader(global.values) : {},
      oscilloscopes: oscilloscopeReader ? oscilloscopeReader(global.values) : {},
      heatmaps: heatmapReader ? heatmapReader(global.values) : {},
      ...(heatmapReader ? { heatmapFrames } : {}),
      ...(variableFrames.length ? { variableFrames } : {}),
      contracts: { total: contracts.reduce((count, entry) => count + entry.entries.length, 0), observations: contractObservations, violations: contractViolations },
      ...(debug ? { debugFrames: debug.frames } : {}),
      ...(screenReader ? { screenFrames } : {}),
      ...(screenFrameGauges.length ? { screenFrameGauges } : {}),
      ...(screenFrameLeds.length ? { screenFrameLeds } : {}),
      ...(screenFrameRgbLeds.length ? { screenFrameRgbLeds } : {}),
      ...(screenFrameProgresses.length ? { screenFrameProgresses } : {}),
      ...(screenFrameBarCharts.length ? { screenFrameBarCharts } : {}),
      ...(screenFrameXyPlots.length ? { screenFrameXyPlots } : {}),
      ...(screenFrameOscilloscopes.length ? { screenFrameOscilloscopes } : {}),
      ...(gaugeReader ? { gaugeFrames } : {}),
      ...(ledReader ? { ledFrames } : {}),
      ...(rgbLedReader ? { rgbLedFrames } : {}),
      ...(progressReader ? { progressFrames } : {}),
      ...(barChartReader ? { barChartFrames } : {}),
      ...(xyPlotReader ? { xyPlotFrames } : {}),
      ...(oscilloscopeReader ? { oscilloscopeFrames } : {}),
    }
  } catch (error) {
    const errorCode = error?.code ?? 'SIMULATION_FAILED'
    debug?.record(lastInstructionId, lastEnvironment, lastScopes, 'error', errorCode)
    return { ok: false, output, outputSteps, trace, errorCode, error: error instanceof Error ? error.message : 'Simulation stopped.', steps, screens: screenReader ? screenReader(global.values) : {}, gauges: gaugeReader ? gaugeReader(global.values) : {}, leds: ledReader ? ledReader(global.values) : {}, rgbLeds: rgbLedReader ? rgbLedReader(global.values) : {}, progresses: progressReader ? progressReader(global.values) : {}, barCharts: barChartReader ? barChartReader(global.values) : {}, xyPlots: xyPlotReader ? xyPlotReader(global.values) : {}, oscilloscopes: oscilloscopeReader ? oscilloscopeReader(global.values) : {}, heatmaps: heatmapReader ? heatmapReader(global.values) : {}, ...(heatmapReader ? { heatmapFrames } : {}), ...(variableFrames.length ? { variableFrames } : {}), ...(debug ? { debugFrames: debug.frames } : {}), ...(screenReader ? { screenFrames } : {}), ...(screenFrameGauges.length ? { screenFrameGauges } : {}), ...(screenFrameLeds.length ? { screenFrameLeds } : {}), ...(screenFrameRgbLeds.length ? { screenFrameRgbLeds } : {}), ...(screenFrameProgresses.length ? { screenFrameProgresses } : {}), ...(screenFrameBarCharts.length ? { screenFrameBarCharts } : {}), ...(screenFrameXyPlots.length ? { screenFrameXyPlots } : {}), ...(screenFrameOscilloscopes.length ? { screenFrameOscilloscopes } : {}), ...(gaugeReader ? { gaugeFrames } : {}), ...(ledReader ? { ledFrames } : {}), ...(rgbLedReader ? { rgbLedFrames } : {}), ...(progressReader ? { progressFrames } : {}), ...(barChartReader ? { barChartFrames } : {}), ...(xyPlotReader ? { xyPlotFrames } : {}), ...(oscilloscopeReader ? { oscilloscopeFrames } : {}) }
  }
}

// Rend une référence de type lisible brièvement.
function typeText(type) {
  if (!type) return null
  if (type.kind === 'primitive') return type.name
  if (type.kind === 'array') return `${typeText(type.elementType) ?? '?'}[]`
  if (type.kind === 'pointer') return `${typeText(type.pointee) ?? '?'}*`
  if (type.kind === 'function') return `(${type.parameters.map((parameter) => typeText(parameter) ?? '?').join(', ')}) -> ${typeText(type.returnType) ?? '?'}`
  if (type.kind === 'class') return type.name || 'class'
  return type.kind
}

// Rend une valeur de simulation lisible sans perdre la distinction booléenne.
function formatValue(value, seen = new Set()) {
  if (value && typeof value === 'object' && value.pointer === true) return value.label
  if (value && typeof value === 'object' && value.functionValue === true) return value.label
  if (value && typeof value === 'object' && value.lambdaValue === true) return value.label
  if (value && typeof value === 'object' && value.methodValue === true) return value.label
  if (value && typeof value === 'object' && value.classValue === true) {
    if (seen.has(value)) return `${value.className || 'class'} { … }`
    const next = new Set(seen).add(value)
    const fields = [...value.fields].map(([name, fieldValue]) => `${name}: ${formatValue(fieldValue, next)}`).join(', ')
    return `${value.className || 'class'} { ${fields} }`
  }
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'symbol') return 'uninitialized'
  if (Array.isArray(value)) return `[${value.map((entry) => formatValue(entry, seen)).join(', ')}]`
  return String(value)
}
