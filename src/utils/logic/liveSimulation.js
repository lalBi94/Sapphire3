import { analyzeProgram } from './analysis.js'
import { normalizeContracts, satisfiesContract } from './contracts.js'
import { validateLiteral, convertConstant, evaluateBinary, evaluateUnary } from './numericConstants.js'
import { getMathNative } from './mathNatives.js'
import { createScreenStateReader } from './screenState.js'
import { createGaugeStateReader } from './gaugeState.js'
import { createLedStateReader } from './ledState.js'
import { createRgbLedStateReader } from './rgbLedState.js'
import { createProgressStateReader } from './progressState.js'
import { createBarChartStateReader } from './barChartState.js'
import { createXyPlotStateReader } from './xyPlotState.js'
import { createOscilloscopeStateReader } from './oscilloscopeState.js'
import { createHeatmapStateReader } from './heatmapState.js'
import { moduleInitializationOrder } from './moduleInitialization.js'

// Signal interne : le pilote a demandé l'arrêt du run live.
const liveStopped = Symbol('liveStopped')

// Ajoute un code stable au moteur live, sans dépendance UI.
function simulationError(code, message) {
  return Object.assign(new Error(message), { code })
}

// Rend une valeur lisible dans la sortie live.
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

// Exécute un programme en continu : chaque frame rend la main au pilote, qui peut
// fournir de nouvelles entrées ou demander l'arrêt. Aucun budget total n'est imposé.
export async function runLiveProgram(project, { inputs = {}, sliceSteps = 400, onFrame = null } = {}) {
  const analysis = analyzeProgram(project)
  if (!analysis.canGenerate) return { ok: false, output: [], errorCode: 'SIMULATION_DIAGNOSTICS', error: 'The program has blocking diagnostics.', diagnostics: analysis.diagnostics }
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const symbols = new Map(analysis.semantic.symbols.map((symbol) => [symbol.id, symbol]))
  const references = new Map(analysis.semantic.references.map((reference) => [reference.nodeId, reference]))
  const types = new Map(analysis.semantic.nodeTypes.map((entry) => [entry.nodeId, entry.type]))
  const functions = new Map(analysis.semantic.symbols.filter((symbol) => symbol.kind === 'FunctionDeclaration').map((symbol) => [symbol.nodeId, nodes.get(symbol.nodeId)]))
  const classMembers = analysis.semantic.index?.classMembers ?? new Map()
  const classModules = analysis.semantic.index?.classModules ?? new Map()
  // Contraintes vérifiables attachées aux nœuds, relues pendant le live.
  const contracts = []
  for (const node of project.nodes) {
    const entries = normalizeContracts(node?.contracts)
    if (entries.length) contracts.push({ nodeId: node.id, name: node.properties?.name || node.id, entries })
  }
  const contractViolations = []
  const contractActive = new Map()
  const contractStates = new Map()
  let contractObservations = 0
  const maximumContractViolations = 100
  const entry = [...functions.values()].find((node) => node?.properties?.entryPoint === true)
  if (!entry) return { ok: false, output: [], errorCode: 'SIMULATION_ENTRY_MISSING', error: 'No entry point is marked.' }
  if ((entry.children.parameters ?? []).length > 0) return { ok: false, output: [], errorCode: 'SIMULATION_ENTRY_INPUTS', error: 'The entry point must not require inputs.' }

  const output = []
  const maximumOutputLines = 500
  let steps = 0
  let currentNodeId = null
  let lastYield = 0
  const screenReader = (project.modules ?? []).some((module) => module.screen) ? createScreenStateReader(project) : null
  const gaugeReader = (project.modules ?? []).some((module) => module.gauge) ? createGaugeStateReader(project) : null
  const ledReader = (project.modules ?? []).some((module) => module.led) ? createLedStateReader(project) : null
  const rgbLedReader = (project.modules ?? []).some((module) => module.rgbLed) ? createRgbLedStateReader(project) : null
  const progressReader = (project.modules ?? []).some((module) => module.progress) ? createProgressStateReader(project) : null
  const barChartReader = (project.modules ?? []).some((module) => module.barChart) ? createBarChartStateReader(project) : null
  const xyPlotReader = (project.modules ?? []).some((module) => module.xyPlot) ? createXyPlotStateReader(project) : null
  const oscilloscopeReader = (project.modules ?? []).some((module) => module.oscilloscope) ? createOscilloscopeStateReader(project) : null
  const heatmapReader = (project.modules ?? []).some((module) => module.heatmap) ? createHeatmapStateReader(project) : null
  const breakSignal = Symbol('break')
  const continueSignal = Symbol('continue')
  const uninitialized = Symbol('uninitialized')
  let callDepth = 0
  let environmentSequence = 0
  let functionScope = null
  const activeScopes = []

  // Associe chaque activation à son scope source, y compris les itérations et appels récursifs.
  function environment(parent, scopeId, nodeId) {
    environmentSequence += 1
    return { values: new Map(), parent, scopeId, nodeId, instanceId: environmentSequence }
  }

  // Compte un pas sans limite totale : la main est rendue au pilote par maybeYield.
  function step(node) {
    steps += 1
    currentNodeId = node.id
  }

  // Lit une liaison dans la chaîne lexicale.
  function readBinding(nodeId, environment) {
    let current = environment
    while (current) {
      if (current.values.has(nodeId)) {
        const value = current.values.get(nodeId)
        if (value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'A value was read before it was initialized.')
        return value
      }
      current = current.parent
    }
    throw simulationError('SIMULATION_UNINITIALIZED', 'A value was read before it was initialized.')
  }

  // Lit une liaison sans lever d'erreur si elle n'est pas encore initialisée.
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

  // Modifie une liaison existante.
  function writeBinding(nodeId, value, environment) {
    let current = environment
    while (current) {
      if (current.values.has(nodeId)) {
        current.values.set(nodeId, value)
        return
      }
      current = current.parent
    }
    throw simulationError('SIMULATION_UNINITIALIZED', 'A value was changed before it was initialized.')
  }

  // Lit l'instance courante de `this`.
  function readThis(environment) {
    let current = environment
    while (current) {
      if (current.thisValue) return current.thisValue
      current = current.parent
    }
    throw simulationError('SIMULATION_REFERENCE', '`this` is only available inside a class.')
  }

  // Retrouve un membre déclaré dans une classe, avec sa visibilité.
  function classMember(classId, name) {
    const members = classMembers.get(classId)
    const memberId = members?.public.get(name) ?? members?.private.get(name)
    return memberId ? nodes.get(memberId) ?? null : null
  }

  // Convertit un entier source en index de tableau sûr.
  function arrayIndex(value, array) {
    const index = typeof value === 'bigint' ? Number(value) : value
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= array.length) throw simulationError('SIMULATION_ARRAY_BOUNDS', 'An array index is outside its bounds.')
    return index
  }

  // Lit un élément déjà initialisé.
  function readElement(array, index) {
    const value = array[index]
    if (value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'An array element was read before it was initialized.')
    return value
  }

  // Contrôle un résultat numérique.
  function checked(result) {
    if (result.code) throw simulationError(result.code, `${result.code}: ${result.message}`)
    return result.value
  }

  // Compare deux adresses par leur emplacement.
  function sameAddress(left, right) {
    if (left.kind !== right.kind) return false
    if (left.kind === 'element') return left.array === right.array && left.index === right.index
    return left.nodeId === right.nodeId && left.environment === right.environment
  }

  // Lit le dernier état des widgets et le transmet au pilote.
  // Résume les contrats observés pour le panneau de simulation live.
  function contractSummary() {
    return {
      total: contracts.reduce((count, entry) => count + entry.entries.length, 0),
      observations: contractObservations,
      violations: [...contractViolations],
      active: [...contractActive.values()],
    }
  }

  function collectState(extra = {}) {
    return {
      steps,
      currentNodeId,
      output: [...output],
      contracts: contractSummary(),
      screens: screenReader ? screenReader(global.values) : {},
      gauges: gaugeReader ? gaugeReader(global.values) : {},
      leds: ledReader ? ledReader(global.values) : {},
      rgbLeds: rgbLedReader ? rgbLedReader(global.values) : {},
      progresses: progressReader ? progressReader(global.values) : {},
      barCharts: barChartReader ? barChartReader(global.values) : {},
      xyPlots: xyPlotReader ? xyPlotReader(global.values) : {},
      oscilloscopes: oscilloscopeReader ? oscilloscopeReader(global.values) : {},
      heatmaps: heatmapReader ? heatmapReader(global.values) : {},
      ...extra,
    }
  }

  // Applique les entrées fournies par le pilote aux globales correspondantes.
  function applyInputs(nextInputs) {
    if (!nextInputs || typeof nextInputs !== 'object' || Array.isArray(nextInputs)) return
    for (const [nodeId, value] of Object.entries(nextInputs)) {
      const node = nodes.get(nodeId)
      if (!node || (node.kind !== 'VariableDeclaration' && node.kind !== 'ConstantDeclaration')) continue
      global.values.set(nodeId, checked(validateLiteral(types.get(nodeId)?.name, value)))
    }
  }

  // Appelle la fonction `onClick(bool)` d'un bouton depuis son binding courant.
  async function applyEvents(events) {
    if (!Array.isArray(events)) return
    for (const event of events) {
      const node = nodes.get(event?.nodeId)
      if (!node || node.kind !== 'VariableDeclaration') continue
      const callback = global.values.get(node.id)
      const rawValue = event?.value
      const colorArray = Array.isArray(rawValue) && (rawValue.length === 3 || rawValue.length === 4) && rawValue.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)
      const value = colorArray ? [...rawValue] : typeof rawValue === 'boolean' ? rawValue : typeof rawValue === 'string' ? rawValue : typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null
      if (value === null) continue
      if (callback?.functionValue === true) {
        const target = functions.get(callback.nodeId)
        if (target) await executeFunction(target, [value])
      } else if (callback?.lambdaValue === true) {
        await executeLambda(callback.lambda, callback.environment, [value])
      } else if (callback?.methodValue === true) {
        await executeFunction(callback.node, [value], callback.object)
      }
    }
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
        if (satisfied) {
          contractStates.delete(key)
          contractActive.delete(key)
          continue
        }
        const observed = formatValue(value)
        const previous = contractStates.get(key)
        if (!previous || previous !== observed) {
          const violation = { nodeId: entry.nodeId, name: entry.name, kind: contract.kind, arguments: contract.arguments ?? [], step: steps, value: observed }
          contractStates.set(key, observed)
          contractActive.set(key, violation)
          if (contractViolations.length < maximumContractViolations) contractViolations.push(violation)
        }
      }
    }
  }

  // Rend la main au pilote après une tranche ou sur demande explicite.
  async function maybeYield(force = false) {
    if (!onFrame) return
    if (!force && steps - lastYield < sliceSteps) return
    lastYield = steps
    const response = await onFrame(collectState())
    if (response?.stop === true) throw liveStopped
    applyInputs(response?.inputs)
    checkContracts(global)
    await applyEvents(response?.events)
  }

  // Évalue une expression, en coopérant avec le pilote.
  async function valueOf(node, environment) {
    step(node)
    await maybeYield()
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
      const left = await valueOf(nodes.get(node.children.left), environment)
      if (operator === 'and' && !left) return false
      if (operator === 'or' && left) return true
      const right = await valueOf(nodes.get(node.children.right), environment)
      if (['==', '!='].includes(operator) && (left?.pointer === true || right?.pointer === true)) {
        const equal = left?.pointer === true && right?.pointer === true && sameAddress(left, right)
        return operator === '==' ? equal : !equal
      }
      return checked(evaluateBinary(operator, left, right, types.get(node.children.left)?.name))
    }
    if (node.kind === 'UnaryExpression') {
      const operator = node.properties.operator
      const operand = nodes.get(node.children.operand)
      if (operator === '&') {
        if (operand?.kind === 'ArrayAccess') {
          const array = await valueOf(nodes.get(operand.children.array), environment)
          if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The addressed value is not an array element.')
          const index = arrayIndex(await valueOf(nodes.get(operand.children.index), environment), array)
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
      if (operator === '*') {
        const pointer = await valueOf(operand, environment)
        if (pointer?.pointer !== true) throw simulationError('SIMULATION_REFERENCE', 'The dereferenced value is not an address.')
        if (pointer.kind === 'element') return readElement(pointer.array, pointer.index)
        return readBinding(pointer.nodeId, pointer.environment)
      }
      return checked(evaluateUnary(operator, await valueOf(operand, environment), types.get(node.id)?.name))
    }
    if (node.kind === 'CastExpression') {
      const value = await valueOf(nodes.get(node.children.argument), environment)
      const target = types.get(node.id)?.name
      return target === types.get(node.children.argument)?.name ? value : checked(convertConstant(value, target))
    }
    if (node.kind === 'CallExpression') {
      const calleeNode = nodes.get(node.children.callee)
      const callee = await valueOf(calleeNode, environment)
      const args = []
      for (const id of node.children.arguments ?? []) args.push(await valueOf(nodes.get(id), environment))
      if (callee?.methodValue === true) return executeFunction(callee.node, args, callee.object)
      if (callee?.lambdaValue === true) return executeLambda(callee.lambda, callee.environment, args)
      const target = callee?.functionValue === true ? functions.get(callee.nodeId) : null
      if (!target) throw simulationError('SIMULATION_REFERENCE', 'The called function cannot be resolved.')
      return executeFunction(target, args)
    }
    if (node.kind === 'LambdaExpression') return { lambdaValue: true, nodeId: node.id, lambda: node, environment, label: 'fn <lambda>' }
    if (node.kind === 'MathCall') {
      const definition = getMathNative(node.properties?.name)
      if (!definition) throw simulationError('SIMULATION_REFERENCE', 'The math operation cannot be resolved.')
      const args = []
      for (const id of node.children?.arguments ?? []) args.push(await valueOf(nodes.get(id), environment))
      const value = definition.run(args)
      if (definition.id === 'screenPresent') await maybeYield(true)
      return value
    }
    if (node.kind === 'ArrayLiteral') {
      const values = []
      for (const id of node.children.elements ?? []) values.push(await valueOf(nodes.get(id), environment))
      return values
    }
    if (node.kind === 'ArrayCreation') {
      const sizeValue = await valueOf(nodes.get(node.children.size), environment)
      const size = typeof sizeValue === 'bigint' ? Number(sizeValue) : sizeValue
      if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) throw simulationError('SIMULATION_ARRAY_BOUNDS', 'An array size must be a non-negative integer.')
      const fill = node.children.initializer ? await valueOf(nodes.get(node.children.initializer), environment) : uninitialized
      const values = []
      for (let position = 0; position < size; position += 1) {
        step(node)
        if (position % 500 === 0) await maybeYield()
        values.push(fill)
      }
      return values
    }
    if (node.kind === 'ArrayAccess') {
      const array = await valueOf(nodes.get(node.children.array), environment)
      if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The indexed value is not an array.')
      return readElement(array, arrayIndex(await valueOf(nodes.get(node.children.index), environment), array))
    }
    if (node.kind === 'NewExpression') return newObject(node, environment)
    if (node.kind === 'ThisExpression') return readThis(environment)
    if (node.kind === 'MemberExpression') {
      const member = await resolveMember(node, environment)
      if (member.kind === 'field') {
        if (member.value === uninitialized) throw simulationError('SIMULATION_UNINITIALIZED', 'A field was read before it was initialized.')
        return member.value
      }
      return { methodValue: true, node: member.node, object: member.object, label: `fn ${member.name}` }
    }
    throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported expression: ${node.kind}.`)
  }

  // Résout un accès membre sur une instance de classe.
  async function resolveMember(node, environment) {
    const object = await valueOf(nodes.get(node.children.object), environment)
    if (!object || object.classValue !== true) throw simulationError('SIMULATION_MEMBER', 'Member access requires a class instance.')
    const name = node.properties?.name
    const member = classMember(object.classId, name)
    if (!member) throw simulationError('SIMULATION_MEMBER', `Unknown member: ${name}.`)
    if (member.kind === 'FunctionDeclaration') return { kind: 'method', node: member, object, name }
    return { kind: 'field', object, name, value: object.fields.get(name) }
  }

  // Crée une instance, initialise ses attributs puis exécute son constructeur.
  async function newObject(node, environment) {
    const classId = node.properties?.classId
    const classModule = classModules.get(classId)
    const members = classMembers.get(classId)
    if (!classModule || !members) throw simulationError('SIMULATION_CLASS', 'The class cannot be resolved.')
    const object = { classValue: true, classId, className: classModule.name ?? '', fields: new Map() }
    for (const scope of ['public', 'private']) {
      for (const [name, memberId] of members[scope]) {
        const member = nodes.get(memberId)
        if (member?.kind !== 'VariableDeclaration' && member?.kind !== 'ConstantDeclaration') continue
        object.fields.set(name, member.children.initializer ? await valueOf(nodes.get(member.children.initializer), environment) : uninitialized)
      }
    }
    const constructor = members.constructor ? nodes.get(members.constructor) : null
    const args = []
    for (const id of node.children.arguments ?? []) args.push(await valueOf(nodes.get(id), environment))
    if (constructor) await executeFunction(constructor, args, object)
    else if (args.length > 0) throw simulationError('SIMULATION_CONSTRUCTOR', 'This class has no constructor for these arguments.')
    return object
  }

  // Exécute une instruction avec coopération.
  async function executeStatement(node, environment) {
    await maybeYield()
    try {
      return await runStatement(node, environment)
    } finally {
      checkContracts(environment)
    }
  }

  // Exécute une instruction et propage les contrôles de flux.
  async function runStatement(node, environment) {
    step(node)
    if (node.kind === 'VariableDeclaration' || node.kind === 'ConstantDeclaration') {
      environment.values.set(node.id, node.children.initializer ? await valueOf(nodes.get(node.children.initializer), environment) : uninitialized)
      return
    }
    if (node.kind === 'PrintStatement') {
      output.push(formatValue(await valueOf(nodes.get(node.children.value), environment)))
      if (output.length > maximumOutputLines) output.splice(0, output.length - maximumOutputLines)
      return
    }
    if (node.kind === 'ForEachStatement') {
      const array = await valueOf(nodes.get(node.children.array), environment)
      if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'ForEach expects an array.')
      const callback = await valueOf(nodes.get(node.children.callback), environment)
      const snapshot = [...array]
      for (const element of snapshot) {
        step(node)
        await maybeYield()
        if (callback?.lambdaValue === true) await executeLambda(callback.lambda, callback.environment, [element])
        else if (callback?.methodValue === true) await executeFunction(callback.node, [element], callback.object)
        else {
          const target = callback?.functionValue === true ? functions.get(callback.nodeId) : null
          if (!target) throw simulationError('SIMULATION_REFERENCE', 'ForEach expects a function callback.')
          await executeFunction(target, [element])
        }
      }
      return
    }
    if (node.kind === 'AssignmentStatement') {
      const target = nodes.get(node.children.target)
      if (target?.kind === 'MemberExpression') {
        const member = await resolveMember(target, environment)
        if (member.kind !== 'field') throw simulationError('SIMULATION_MEMBER', 'A method cannot be assigned.')
        member.object.fields.set(member.name, await valueOf(nodes.get(node.children.value), environment))
        return
      }
      if (target?.kind === 'ArrayAccess') {
        const array = await valueOf(nodes.get(target.children.array), environment)
        if (!Array.isArray(array)) throw simulationError('SIMULATION_REFERENCE', 'The indexed value is not an array.')
        const index = arrayIndex(await valueOf(nodes.get(target.children.index), environment), array)
        array[index] = await valueOf(nodes.get(node.children.value), environment)
        return
      }
      if (target?.kind === 'UnaryExpression' && target.properties.operator === '*') {
        const address = await valueOf(nodes.get(target.children.operand), environment)
        if (address?.pointer !== true) throw simulationError('SIMULATION_REFERENCE', 'The dereferenced value is not an address.')
        if (address.constant) throw simulationError('SIMULATION_CONST_IMMUTABLE', 'A constant cannot be modified through a pointer.')
        const value = await valueOf(nodes.get(node.children.value), environment)
        if (address.kind === 'element') {
          address.array[address.index] = value
          return
        }
        writeBinding(address.nodeId, value, address.environment)
        return
      }
      const symbol = symbols.get(references.get(target?.id)?.symbolId)
      if (!symbol) throw simulationError('SIMULATION_REFERENCE', 'The assignment target cannot be resolved.')
      writeBinding(symbol.nodeId, await valueOf(nodes.get(node.children.value), environment), environment)
      return
    }
    if (node.kind === 'ExpressionStatement') {
      await valueOf(nodes.get(node.children.expression), environment)
      return
    }
    if (node.kind === 'IfStatement') {
      const branch = await valueOf(nodes.get(node.children.test), environment) ? node.children.consequent : node.children.alternate
      if (branch) await executeBlock(nodes.get(branch), environment)
      return
    }
    if (node.kind === 'WhileStatement') {
      while (true) {
        await maybeYield()
        if (!await valueOf(nodes.get(node.children.test), environment)) break
        try { await executeBlock(nodes.get(node.children.body), environment) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
      }
      return
    }
    if (node.kind === 'ForStatement') {
      await executeFor(node, environment)
      return
    }
    if (node.kind === 'ReturnStatement') throw { type: 'return', value: node.children.argument ? await valueOf(nodes.get(node.children.argument), environment) : undefined }
    if (node.kind === 'BreakStatement') throw breakSignal
    if (node.kind === 'ContinueStatement') throw continueSignal
    if (node.kind === 'Block') await executeBlock(node, environment)
    else if (!['FunctionDeclaration', 'TypeDeclaration', 'Parameter'].includes(node.kind)) throw simulationError('SIMULATION_UNSUPPORTED', `Unsupported statement: ${node.kind}.`)
  }

  // Garde l'initialiseur et l'update dans la même activation de boucle.
  async function executeFor(node, parent) {
    const current = environment(parent, `for:${node.id}`, node.id)
    activeScopes.push(current)
    try {
      if (node.children.initializer) await executeStatement(nodes.get(node.children.initializer), current)
      while (true) {
        await maybeYield()
        if (node.children.test && !await valueOf(nodes.get(node.children.test), current)) break
        step(node)
        try { await executeBlock(nodes.get(node.children.body), current) } catch (signal) {
          if (signal === breakSignal) break
          if (signal !== continueSignal) throw signal
        }
        if (node.children.update) {
          const update = nodes.get(node.children.update)
          if (update.kind === 'AssignmentStatement') await executeStatement(update, current)
          else await valueOf(update, current)
        }
      }
    } finally {
      activeScopes.pop()
    }
  }

  // Recrée les variables d'un bloc à chaque entrée.
  async function executeBlock(block, parent, reuse = false) {
    const current = reuse ? parent : environment(parent, `block:${block.id}`, block.id)
    if (!reuse) activeScopes.push(current)
    try {
      for (const id of block.children.statements ?? []) await executeStatement(nodes.get(id), current)
    } finally {
      if (!reuse) activeScopes.pop()
    }
  }

  // Isole un appel de lambda.
  async function executeLambda(lambda, captured, args) {
    callDepth += 1
    if (callDepth > 200) throw simulationError('SIMULATION_CALL_LIMIT', 'Simulation call depth limit reached.')
    const current = environment(captured, `lambda:${lambda.id}`, lambda.id)
    if (callDepth === 1) functionScope = current
    activeScopes.push(current)
    for (const [index, parameterId] of (lambda.children.parameters ?? []).entries()) current.values.set(parameterId, args[index])
    try {
      const body = nodes.get(lambda.children.body)
      return body ? await valueOf(body, current) : undefined
    } finally {
      activeScopes.pop()
      callDepth -= 1
    }
  }

  // Isole chaque appel de fonction et borne la récursion.
  async function executeFunction(node, args, thisValue = null) {
    callDepth += 1
    if (callDepth > 200) throw simulationError('SIMULATION_CALL_LIMIT', 'Simulation call depth limit reached.')
    const current = environment(global, `function:${node.id}`, node.id)
    if (thisValue) current.thisValue = thisValue
    if (callDepth === 1) functionScope = current
    activeScopes.push(current)
    for (const [index, parameterId] of (node.children.parameters ?? []).entries()) current.values.set(parameterId, args[index])
    try {
      await executeBlock(nodes.get(node.children.body), current, true)
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
  try {
    for (const module of moduleInitializationOrder(project, analysis)) {
      if (module.kind === 'class') continue
      for (const id of module.rootNodeIds) {
        const node = nodes.get(id)
        if (node && node.kind !== 'FunctionDeclaration') await executeStatement(node, global)
      }
    }
    applyInputs(inputs)
    checkContracts(global)
    // Convention des exemples : `SP3_LIVE` prolonge leur boucle principale en live.
    for (const node of project.nodes ?? []) {
      if (node?.kind === 'VariableDeclaration' && node.properties?.name === 'SP3_LIVE') global.values.set(node.id, true)
    }
    await maybeYield(true)
    const returned = await executeFunction(entry, [])
    if (onFrame) await onFrame(collectState({ done: true, returnValue: returned === undefined ? null : formatValue(returned) }))
    return { ok: true, output, steps, contracts: contractSummary(), returned: typeof returned === 'bigint' ? Number(returned) : returned, returnValue: returned === undefined ? null : formatValue(returned) }
  } catch (error) {
    if (error === liveStopped) return { ok: true, stopped: true, output, steps, contracts: contractSummary() }
    const errorCode = error?.code ?? 'SIMULATION_FAILED'
    if (onFrame) await onFrame(collectState({ error: { code: errorCode, message: error instanceof Error ? error.message : 'Simulation stopped.' } }))
    return { ok: false, output, steps, contracts: contractSummary(), errorCode, error: error instanceof Error ? error.message : 'Simulation stopped.' }
  }
}
