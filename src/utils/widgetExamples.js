import { createProject, createModule, createNode } from './logic/index.js'
import { createBarChartModule } from './barChartNode.js'
import { createHeatmapModule } from './heatmapNode.js'
import { createGaugeModule } from './gaugeNode.js'
import { createProgressModule } from './progressNode.js'
import { createLedModule } from './ledNode.js'
import { createRgbLedModule } from './rgbLedNode.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const booleanType = { kind: 'primitive', name: 'boolean' }
const voidType = { kind: 'primitive', name: 'void' }
const arrayType = { kind: 'array', elementType: intType }

// Construit une classe complète (membres publics/privés, constructeur, this) hors du module principal.
function classBuilder(id, name) {
  const module = createModule(id, name, 'class')
  const nodes = []
  let sequence = 0
  const make = (kind, properties = {}, children = {}, references = {}) => {
    const nodeId = `${id}:${++sequence}`
    nodes.push(createNode(nodeId, id, kind, { properties, children, references }))
    return nodeId
  }
  const member = (kind, properties = {}, children = {}, references = {}) => {
    const nodeId = make(kind, properties, children, references)
    module.rootNodeIds.push(nodeId)
    return nodeId
  }
  const read = (name) => make('Reference', {}, {}, { target: { kind: 'name', name } })
  const thisNode = () => make('ThisExpression')
  const memberAccess = (object, name) => make('MemberExpression', { name }, { object })
  const integer = (value) => make('Literal', { type: intType, value: String(value) })
  const real = (value) => make('Literal', { type: doubleType, value: String(value) })
  const boolean = (value) => make('Literal', { type: booleanType, value })
  const op = (operator, left, right) => make('BinaryExpression', { operator }, { left, right })
  const call = (callee, args) => make('CallExpression', {}, { callee, arguments: args })
  const assign = (target, value) => make('AssignmentStatement', {}, { target, value })
  const block = (statements) => make('Block', {}, { statements })
  const ifThen = (test, consequent, alternate = null) => make('IfStatement', {}, { test, consequent, alternate })
  const returnValue = (argument) => make('ReturnStatement', {}, { argument })
  const parameter = (name, type) => make('Parameter', { name, type })
  const newObject = (classId, args) => make('NewExpression', { classId }, { arguments: args })
  const importRef = (importId) => make('Reference', {}, {}, { target: { kind: 'import', importId } })
  const castInt = (argument) => make('CastExpression', { type: intType }, { argument })
  const statement = (expression) => make('ExpressionStatement', {}, { expression })
  // Importe une fonction exportée d'un widget dans le module de classe.
  const importFunction = (importId, widget, name) => {
    const exported = widget.module.exports.find((entry) => entry.name === name)
    if (!exported) throw new Error(`Unknown widget export: ${name}`)
    module.imports.push({ id: importId, moduleId: widget.module.id, nodeId: exported.nodeId, localName: name })
    return importId
  }
  return { module, nodes, make, member, read, thisNode, memberAccess, integer, real, boolean, op, call, assign, block, ifThen, returnValue, parameter, newObject, importRef, castInt, statement, importFunction }
}

// Assemble des nœuds source ordinaires à identifiants neufs ; aucun résultat algorithmique n'est précalculé.
function demo(id, title, widgets, extraModules = []) {
  const project = createProject(id)
  for (const widget of widgets) {
    project.modules.push(widget.module)
    project.nodes.push(...widget.nodes)
  }
  for (const extra of extraModules) {
    project.modules.push(extra.module)
    project.nodes.push(...extra.nodes)
  }
  const app = createModule(`${id}App`, title)
  project.modules.push(app)
  let sequence = 0
  const imports = new Map()

  // Conserve l'appartenance au module tout en laissant l'ordre des instructions explicite.
  function make(kind, properties = {}, children = {}, references = {}) {
    const nodeId = `${id}:${++sequence}`
    project.nodes.push(createNode(nodeId, app.id, kind, { properties, children, references }))
    return nodeId
  }
  // Un entier explicitement typé, jamais un type déduit ou de secours.
  function integer(value) { return make('Literal', { type: intType, value: String(value) }) }
  // Un réel double explicitement typé.
  function real(value) { return make('Literal', { type: doubleType, value: String(value) }) }
  // Un booléen explicitement typé.
  function boolean(value) { return make('Literal', { type: booleanType, value }) }
  // Résout une déclaration dans sa portée lexicale au moment de l'analyse.
  function read(name) { return make('Reference', {}, {}, { target: { kind: 'name', name } }) }
  // Accède à un membre d'une instance de classe.
  function member(object, name) { return make('MemberExpression', { name }, { object }) }
  // Appelle une méthode sur une instance, avec les arguments fournis.
  function methodCall(object, name, args) { return make('CallExpression', {}, { callee: member(object, name), arguments: args }) }
  // Instancie une classe avec les arguments de son constructeur.
  function newObject(classId, args) { return make('NewExpression', { classId }, { arguments: args }) }
  // Enveloppe une expression dans une instruction.
  function statement(expression) { return make('ExpressionStatement', {}, { expression }) }
  // Type de classe référencé par l'identifiant stable de son module.
  function classType(classId) { return { kind: 'class', classId } }
  // Une expression binaire avec deux enfants distincts.
  function op(operator, left, right) { return make('BinaryExpression', { operator }, { left, right }) }
  // Appelle uniquement une opération native SP3 existante.
  function math(name, args) { return make('MathCall', { name }, { arguments: args }) }
  // Convertit explicitement une valeur entière avant de piloter un widget double.
  function asDouble(argument) { return make('CastExpression', { type: doubleType }, { argument }) }
  // Construit un tableau d'entrée ; son traitement reste exécuté dans le projet.
  function array(values) { return make('ArrayLiteral', { elementType: intType }, { elements: values.map(integer) }) }
  // Lit ou cible une case de tableau sans réutiliser une référence syntaxique.
  function at(name, index) { return make('ArrayAccess', {}, { array: read(name), index }) }
  // Déclare une variable locale du type demandé.
  function declare(name, initializer, type = intType) { return make('VariableDeclaration', { name, type }, { initializer }) }
  // Modifie une déclaration existante, sans changer son identifiant.
  function assign(name, value) { return make('AssignmentStatement', {}, { target: read(name), value }) }
  // Écrit réellement dans une case du tableau de travail.
  function store(name, index, value) { return make('AssignmentStatement', {}, { target: at(name, index), value }) }
  // Préserve l'ordre explicite des étapes du bloc.
  function block(statements) { return make('Block', {}, { statements }) }
  // Construit les deux branches indépendantes d'une condition.
  function branch(test, yes, no = null) { return make('IfStatement', {}, { test, consequent: block(yes), alternate: no ? block(no) : null }) }
  // La terminaison dépend des variables du programme, pas du générateur d'exemple.
  function whileLoop(test, statements) { return make('WhileStatement', {}, { test, body: block(statements) }) }
  // Une boucle entière bornée, sans conversion implicite.
  function loop(name, start, limit, statements) {
    return make('ForStatement', {}, { initializer: declare(name, integer(start)), test: op('<', read(name), limit), update: assign(name, op('+', read(name), integer(1))), body: block(statements) })
  }
  // Importe une API de widget une seule fois et crée un appel source ordinaire à chaque utilisation.
  function widgetCall(widget, name, args) {
    const key = `${widget.module.id}:${name}`
    if (!imports.has(key)) {
      const exported = widget.module.exports.find((entry) => entry.name === name)
      if (!exported) throw new Error(`Unknown widget export: ${name}`)
      const importId = `${id}:import:${imports.size}`
      imports.set(key, importId)
      app.imports.push({ id: importId, moduleId: widget.module.id, nodeId: exported.nodeId, localName: name })
    }
    const callee = make('Reference', {}, {}, { target: { kind: 'import', importId: imports.get(key) } })
    const expression = make('CallExpression', {}, { callee, arguments: args })
    return make('ExpressionStatement', {}, { expression })
  }
  // Rend le résultat calculé visible dans la sortie de Run et Debug.
  function print(value) { return make('PrintStatement', {}, { value }) }
  // Ajoute l'unique point d'entrée ; la présentation est assemblée par la bibliothèque existante.
  function finish(statements, description) {
    app.rootNodeIds.push(make('FunctionDeclaration', { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, { parameters: [], body: block(statements) }))
    return { project, description, title }
  }
  return { make, integer, real, boolean, read, member, methodCall, newObject, statement, classType, op, math, asDouble, array, at, declare, assign, store, branch, whileLoop, loop, widgetCall, print, finish }
}

// Les restes successifs de l'algorithme d'Euclide deviennent les deux barres du graphique.
function euclid() {
  const bars = createBarChartModule('euclidBars', 'Euclid operands', 1, { size: 2 })
  const led = createLedModule('euclidDone', 'GCD found', 1)
  const b = demo('euclid', 'Euclidean algorithm', [bars, led])
  const paint = b.widgetCall(bars, bars.functions.setData, [b.make('ArrayLiteral', { elementType: intType }, { elements: [b.read('a'), b.read('b')] })])
  return b.finish([
    b.declare('a', b.integer(252)), b.declare('b', b.integer(105)),
    b.whileLoop(b.op('!=', b.read('b'), b.integer(0)), [paint, b.declare('remainder', b.op('%', b.read('a'), b.read('b'))), b.assign('a', b.read('b')), b.assign('b', b.read('remainder'))]),
    b.widgetCall(bars, bars.functions.setData, [b.make('ArrayLiteral', { elementType: intType }, { elements: [b.read('a'), b.read('b')] })]),
    b.widgetCall(led, led.functions.setValue, [b.boolean(true)]), b.print(b.read('a')),
  ], 'Calcule le PGCD de 252 et 105 par les restes successifs : (a, b) devient (b, a % b). Les deux barres suivent les opérandes ; la LED s’allume lorsque b vaut zéro. Résultat attendu : 21. Modifiez les deux entiers de départ, avec b strictement positif.')
}

// La recherche dichotomique réduit réellement sa fenêtre avant d'allumer la LED RVB.
function binarySearch() {
  const bars = createBarChartModule('searchBars', 'Visited indices', 1, { size: 10 })
  const led = createRgbLedModule('searchLed', 'Search result', 1)
  const b = demo('binarySearch', 'Binary search', [bars, led])
  return b.finish([
    b.declare('values', b.array([3, 7, 12, 18, 24, 31, 42, 55, 68, 90]), arrayType), b.declare('target', b.integer(42)),
    b.declare('low', b.integer(0)), b.declare('high', b.integer(9)), b.declare('found', b.integer(-1)),
    b.whileLoop(b.op('and', b.op('<=', b.read('low'), b.read('high')), b.op('==', b.read('found'), b.integer(-1))), [
      b.declare('mid', b.op('/', b.op('+', b.read('low'), b.read('high')), b.integer(2))),
      b.widgetCall(bars, bars.functions.setValue, [b.read('mid'), b.at('values', b.read('mid'))]),
      b.branch(b.op('==', b.at('values', b.read('mid')), b.read('target')), [b.assign('found', b.read('mid'))], [
        b.branch(b.op('<', b.at('values', b.read('mid')), b.read('target')), [b.assign('low', b.op('+', b.read('mid'), b.integer(1)))], [b.assign('high', b.op('-', b.read('mid'), b.integer(1)))]),
      ]),
    ]),
    b.branch(b.op('>=', b.read('found'), b.integer(0)), [b.widgetCall(led, led.functions.setColor, [b.integer(0), b.integer(255), b.integer(0)])], [b.widgetCall(led, led.functions.setColor, [b.integer(255), b.integer(0), b.integer(0)])]),
    b.print(b.read('found')),
  ], 'Cherche 42 dans un tableau déjà trié. Chaque barre non nulle correspond à un indice inspecté. low/high resserrent l’intervalle ; la LED RVB finit verte si la cible existe, rouge sinon. La sortie indique l’indice (6), ou -1. Changez target, mais gardez le tableau trié.')
}

// Le crible marque les multiples dans un tableau avant de peindre la carte des nombres premiers.
function primeSieve() {
  const heat = createHeatmapModule('primeHeat', 'Primes 0–31', 1, { width: 8, height: 4 })
  const progress = createProgressModule('primeProgress', 'Sieve progress', 1)
  const b = demo('primeSieve', 'Prime sieve', [heat, progress])
  return b.finish([
    b.declare('prime', b.math('arrayFill', [b.integer(32), b.integer(1)]), arrayType), b.store('prime', b.integer(0), b.integer(0)), b.store('prime', b.integer(1), b.integer(0)),
    b.loop('p', 2, b.integer(6), [b.branch(b.op('==', b.at('prime', b.read('p')), b.integer(1)), [
      b.declare('multiple', b.op('*', b.read('p'), b.read('p'))),
      b.whileLoop(b.op('<', b.read('multiple'), b.integer(32)), [b.store('prime', b.read('multiple'), b.integer(0)), b.assign('multiple', b.op('+', b.read('multiple'), b.read('p')))]),
    ]), b.widgetCall(progress, progress.functions.setValue, [b.asDouble(b.op('*', b.op('-', b.read('p'), b.integer(1)), b.integer(25)))])]),
    b.declare('count', b.integer(0)),
    b.loop('n', 0, b.integer(32), [
      b.branch(b.op('==', b.at('prime', b.read('n')), b.integer(1)), [b.assign('count', b.op('+', b.read('count'), b.integer(1)))]),
      b.widgetCall(heat, 'HEATMAP_SP3_SET_CELL_1', [b.op('%', b.read('n'), b.integer(8)), b.op('/', b.read('n'), b.integer(8)), b.op('*', b.at('prime', b.read('n')), b.integer(100))]),
    ]), b.print(b.read('count')),
  ], 'Crible d’Ératosthène sur 0–31 : les multiples de chaque candidat premier sont éliminés à partir de p². La progression suit les candidats, puis la grille 8×4 affiche les onze nombres premiers (cases lumineuses), lus de gauche à droite et de haut en bas. La sortie vaut 11.')
}

// Le tri par insertion déplace les cases une à une et publie chaque état intermédiaire.
function insertionSort() {
  const bars = createBarChartModule('insertionBars', 'Insertion sort', 1, { size: 8 })
  const progress = createProgressModule('insertionProgress', 'Sorted prefix', 1)
  const b = demo('insertionSort', 'Insertion sort', [bars, progress])
  return b.finish([
    b.declare('values', b.array([8, 3, 7, 4, 9, 2, 6, 1]), arrayType), b.widgetCall(bars, bars.functions.setData, [b.read('values')]),
    b.loop('i', 1, b.integer(8), [b.declare('key', b.at('values', b.read('i'))), b.declare('j', b.op('-', b.read('i'), b.integer(1))),
      b.whileLoop(b.op('>=', b.read('j'), b.integer(0)), [
        b.branch(b.op('<=', b.at('values', b.read('j')), b.read('key')), [b.make('BreakStatement')]),
        b.store('values', b.op('+', b.read('j'), b.integer(1)), b.at('values', b.read('j'))), b.assign('j', b.op('-', b.read('j'), b.integer(1))),
        b.widgetCall(bars, bars.functions.setData, [b.read('values')]),
      ]), b.store('values', b.op('+', b.read('j'), b.integer(1)), b.read('key')), b.widgetCall(bars, bars.functions.setData, [b.read('values')]),
      b.widgetCall(progress, progress.functions.setValue, [b.asDouble(b.op('/', b.op('*', b.op('+', b.read('i'), b.integer(1)), b.integer(100)), b.integer(8))) ]),
    ]), b.loop('index', 0, b.integer(8), [b.print(b.at('values', b.read('index')))]),
  ], 'Le préfixe de gauche est déjà trié. Pour chaque nouvelle clé, les valeurs plus grandes sont décalées à droite, puis la clé est insérée. Les barres montrent les décalages réels ; la progression mesure le préfixe trié. Résultat : 1, 2, 3, 4, 6, 7, 8, 9. Modifiez les huit valeurs initiales.')
}

// Un petit générateur congruentiel reproductible alimente réellement les six compteurs du dé.
function diceHistogram() {
  const bars = createBarChartModule('diceBars', 'Dice frequencies', 1, { size: 6 })
  const progress = createProgressModule('diceProgress', '48 samples', 1)
  const b = demo('diceHistogram', 'Dice histogram', [bars, progress])
  return b.finish([
    b.declare('seed', b.integer(7)), b.declare('counts', b.math('arrayFill', [b.integer(6), b.integer(0)]), arrayType),
    b.loop('sample', 0, b.integer(48), [
      b.assign('seed', b.op('%', b.op('+', b.op('*', b.read('seed'), b.integer(17)), b.integer(43)), b.integer(97))),
      b.declare('face', b.op('%', b.read('seed'), b.integer(6))), b.store('counts', b.read('face'), b.op('+', b.at('counts', b.read('face')), b.integer(1))),
      b.widgetCall(bars, bars.functions.setData, [b.read('counts')]),
      b.widgetCall(progress, progress.functions.setValue, [b.asDouble(b.op('/', b.op('*', b.op('+', b.read('sample'), b.integer(1)), b.integer(100)), b.integer(48)))]),
    ]), b.print(b.integer(48)),
  ], '48 tirages de dé illustratifs. Un petit générateur congruentiel (17 × seed + 43) % 97, puis % 6, met à jour six compteurs. Les barres représentent les faces 1 à 6 ; la progression compte les tirages. Changez seed (0–96) pour une autre séquence reproductible. Ce jouet n’est ni un générateur sécurisé ni une expérience statistique non biaisée.')
}

// Une file accumule les arrivées et sert au plus deux clients à chaque pas.
function checkoutQueue() {
  const bars = createBarChartModule('queueBars', 'Queue history', 1, { size: 12 })
  const gauge = createGaugeModule('queueGauge', 'Waiting customers', 1, { min: 0, max: 10 })
  const led = createLedModule('queueLed', 'Busy checkout', 1)
  const b = demo('checkoutQueue', 'Checkout queue', [bars, gauge, led])
  return b.finish([
    b.declare('arrivals', b.array([3, 1, 4, 0, 2, 5, 1, 0, 3, 2, 0, 1]), arrayType), b.declare('waiting', b.integer(0)),
    b.loop('minute', 0, b.integer(12), [
      b.assign('waiting', b.math('max', [b.integer(0), b.op('-', b.op('+', b.read('waiting'), b.at('arrivals', b.read('minute'))), b.integer(2))])),
      b.widgetCall(bars, bars.functions.setValue, [b.read('minute'), b.read('waiting')]), b.widgetCall(gauge, gauge.functions.setValue, [b.asDouble(b.read('waiting'))]),
      b.widgetCall(led, led.functions.setValue, [b.op('>=', b.read('waiting'), b.integer(3))]),
    ]), b.print(b.read('waiting')),
  ], 'Douze minutes simulées : les clients du tableau arrivals arrivent, puis une caisse en sert au plus deux. La jauge donne la file actuelle, les barres son historique, et la LED s’allume à partir de trois clients en attente. La file finit vide (0). Changez les arrivées ou le débit de service pour créer un embouteillage.')
}

// L'hystérésis du thermostat évite de changer de chauffage à chaque passage autour de la cible.
function thermostat() {
  const bars = createBarChartModule('thermoBars', 'Temperature history', 1, { size: 24 })
  const gauge = createGaugeModule('thermoGauge', 'Room temperature', 1, { min: 15, max: 30 })
  const led = createLedModule('thermoLed', 'Heater on', 1)

  // La classe garde la température et l'état du chauffage privés ; la boucle ne lit que step() et les accesseurs.
  const room = classBuilder('thermostatClass', 'Thermostat')
  room.member('VariableDeclaration', { name: 'temperature', type: intType, visibility: 'private' }, { initializer: room.integer(18) })
  room.member('VariableDeclaration', { name: 'heating', type: booleanType, visibility: 'private' }, { initializer: room.boolean(false) })
  const ctorBody = room.block([
    room.assign(room.memberAccess(room.thisNode(), 'temperature'), room.read('start')),
  ])
  room.member('FunctionDeclaration', { name: 'constructor', type: voidType, constructor: true, visibility: 'public' }, { parameters: [room.parameter('start', intType)], body: ctorBody })
  const stepBody = room.block([
    room.ifThen(room.op('<=', room.memberAccess(room.thisNode(), 'temperature'), room.integer(20)), room.block([room.assign(room.memberAccess(room.thisNode(), 'heating'), room.boolean(true))])),
    room.ifThen(room.op('>=', room.memberAccess(room.thisNode(), 'temperature'), room.integer(24)), room.block([room.assign(room.memberAccess(room.thisNode(), 'heating'), room.boolean(false))])),
    room.ifThen(
      room.memberAccess(room.thisNode(), 'heating'),
      room.block([room.assign(room.memberAccess(room.thisNode(), 'temperature'), room.op('+', room.memberAccess(room.thisNode(), 'temperature'), room.integer(2)))]),
      room.block([room.assign(room.memberAccess(room.thisNode(), 'temperature'), room.op('-', room.memberAccess(room.thisNode(), 'temperature'), room.integer(1)))]),
    ),
  ])
  room.member('FunctionDeclaration', { name: 'step', type: voidType, visibility: 'public' }, { parameters: [], body: stepBody })
  room.member('FunctionDeclaration', { name: 'current', type: intType, visibility: 'public' }, { parameters: [], body: room.block([room.returnValue(room.memberAccess(room.thisNode(), 'temperature'))]) })
  room.member('FunctionDeclaration', { name: 'isHeating', type: booleanType, visibility: 'public' }, { parameters: [], body: room.block([room.returnValue(room.memberAccess(room.thisNode(), 'heating'))]) })

  const b = demo('thermostat', 'Thermostat control', [bars, gauge, led], [room])
  return b.finish([
    b.declare('thermostat', b.newObject('thermostatClass', [b.integer(18)]), b.classType('thermostatClass')),
    b.loop('step', 0, b.integer(24), [
      b.statement(b.methodCall(b.read('thermostat'), 'step', [])),
      b.widgetCall(gauge, gauge.functions.setValue, [b.asDouble(b.methodCall(b.read('thermostat'), 'current', []))]),
      b.widgetCall(led, led.functions.setValue, [b.methodCall(b.read('thermostat'), 'isHeating', [])]),
      b.widgetCall(bars, bars.functions.setValue, [b.read('step'), b.methodCall(b.read('thermostat'), 'current', [])]),
    ]),
    b.print(b.methodCall(b.read('thermostat'), 'current', [])),
  ], 'Modèle thermique volontairement simplifié : chauffage actif à 20 °C ou moins, coupé à 24 °C ou plus. La classe Thermostat garde la température et le chauffage privés ; step() applique l’hystérésis et un pas chauffe de 2 °C ou refroidit de 1 °C. La LED montre le chauffage, la jauge la température et les barres les 24 pas. Température finale : 21 °C ; ce n’est pas un modèle physique de bâtiment.')
}

// Un ressort discret amorti utilise des doubles ; seules les barres convertissent explicitement la position en centièmes.
function dampedSpring() {
  const bars = createBarChartModule('springBars', 'Position × 100', 1, { size: 24 })
  const gauge = createGaugeModule('springGauge', 'Spring displacement', 1, { min: -12, max: 12 })

  // La classe porte la position et la vitesse ; la boucle appelle step() puis lit la position courante.
  const spring = classBuilder('springClass', 'Spring')
  spring.member('VariableDeclaration', { name: 'position', type: doubleType, visibility: 'private' }, { initializer: spring.real(10) })
  spring.member('VariableDeclaration', { name: 'velocity', type: doubleType, visibility: 'private' }, { initializer: spring.real(0) })
  const ctorBody = spring.block([
    spring.assign(spring.memberAccess(spring.thisNode(), 'position'), spring.read('start')),
  ])
  spring.member('FunctionDeclaration', { name: 'constructor', type: voidType, constructor: true, visibility: 'public' }, { parameters: [spring.parameter('start', doubleType)], body: ctorBody })
  const stepBody = spring.block([
    spring.assign(spring.memberAccess(spring.thisNode(), 'velocity'), spring.op('*', spring.op('-', spring.memberAccess(spring.thisNode(), 'velocity'), spring.op('*', spring.memberAccess(spring.thisNode(), 'position'), spring.real(0.18))), spring.real(0.88))),
    spring.assign(spring.memberAccess(spring.thisNode(), 'position'), spring.op('+', spring.memberAccess(spring.thisNode(), 'position'), spring.memberAccess(spring.thisNode(), 'velocity'))),
  ])
  spring.member('FunctionDeclaration', { name: 'step', type: voidType, visibility: 'public' }, { parameters: [], body: stepBody })
  spring.member('FunctionDeclaration', { name: 'current', type: doubleType, visibility: 'public' }, { parameters: [], body: spring.block([spring.returnValue(spring.memberAccess(spring.thisNode(), 'position'))]) })

  const b = demo('dampedSpring', 'Damped spring', [bars, gauge], [spring])
  return b.finish([
    b.declare('spring', b.newObject('springClass', [b.real(10)]), b.classType('springClass')),
    b.loop('step', 0, b.integer(24), [
      b.statement(b.methodCall(b.read('spring'), 'step', [])),
      b.widgetCall(gauge, gauge.functions.setValue, [b.methodCall(b.read('spring'), 'current', [])]),
      b.widgetCall(bars, bars.functions.setValue, [b.read('step'), b.make('CastExpression', { type: intType }, { argument: b.op('*', b.methodCall(b.read('spring'), 'current', []), b.real(100)) })]),
    ]),
    b.print(b.make('Literal', { type: { kind: 'primitive', name: 'string' }, value: 'Damped spring' })),
  ], 'Oscillateur discret amorti encapsulé dans une classe Spring : step() applique v ← (v − 0,18 × x) × 0,88, puis x ← x + v pendant 24 pas. La jauge suit x et les barres signées conservent l’historique en centièmes (conversion double → int explicite). Changez la raideur et l’amortissement avec prudence : certaines valeurs rendent le schéma instable. Modèle pédagogique, sans unités physiques calibrées.')
}

// Un parcours en largeur remplit les cases libres ; une case est marquée dès son entrée dans la file.
function floodFill() {
  const heat = createHeatmapModule('floodHeat', 'Flood fill', 1, { width: 8, height: 6 })
  const progress = createProgressModule('floodProgress', 'Reachable cells', 1)
  const b = demo('floodFill', 'Flood fill', [heat, progress])
  const walls = Array.from({ length: 48 }, (_, index) => {
    const x = index % 8
    const y = Math.floor(index / 8)
    return x === 0 || x === 7 || y === 0 || y === 5 || (x === 4 && y >= 1 && y <= 3) ? 1 : 0
  })
  return b.finish([
    b.declare('grid', b.array(walls), arrayType), b.declare('queue', b.math('arrayFill', [b.integer(48), b.integer(0)]), arrayType),
    b.declare('offsets', b.array([-8, 1, 8, -1]), arrayType), b.declare('head', b.integer(0)), b.declare('tail', b.integer(1)),
    b.store('queue', b.integer(0), b.integer(9)), b.store('grid', b.integer(9), b.integer(2)),
    b.loop('cell', 0, b.integer(48), [b.widgetCall(heat, 'HEATMAP_SP3_SET_CELL_1', [b.op('%', b.read('cell'), b.integer(8)), b.op('/', b.read('cell'), b.integer(8)), b.op('*', b.at('grid', b.read('cell')), b.integer(20))])]),
    b.whileLoop(b.op('<', b.read('head'), b.read('tail')), [
      b.declare('current', b.at('queue', b.read('head'))), b.assign('head', b.op('+', b.read('head'), b.integer(1))),
      b.widgetCall(heat, 'HEATMAP_SP3_SET_CELL_1', [b.op('%', b.read('current'), b.integer(8)), b.op('/', b.read('current'), b.integer(8)), b.integer(100)]),
      b.loop('direction', 0, b.integer(4), [b.declare('neighbor', b.op('+', b.read('current'), b.at('offsets', b.read('direction')))),
        b.branch(b.op('==', b.at('grid', b.read('neighbor')), b.integer(0)), [b.store('grid', b.read('neighbor'), b.integer(2)), b.store('queue', b.read('tail'), b.read('neighbor')), b.assign('tail', b.op('+', b.read('tail'), b.integer(1)))]),
      ]), b.widgetCall(progress, progress.functions.setValue, [b.asDouble(b.op('/', b.op('*', b.read('head'), b.integer(100)), b.integer(21)))]),
    ]), b.print(b.read('tail')),
  ], 'Remplissage par parcours en largeur sur une grille 8×6 : les murs valent 1, les cases libres 0, les découvertes 2. Une file stocke les voisins haut/droite/bas/gauche ; marquer à l’entrée évite les doublons. La carte distingue murs (20) et cases traitées (100). Depuis (1,1), les 21 cases libres sont atteintes. Gardez les murs du bord si vous modifiez le plan : ils protègent les accès voisins.')
}

// La mise à jour inverse conserve la ligne précédente du triangle de Pascal dans un unique tableau.
function pascalTriangle() {
  const heat = createHeatmapModule('pascalHeat', 'Pascal triangle', 1, { width: 8, height: 8 })
  const bars = createBarChartModule('pascalBars', 'Current row', 1, { size: 8 })
  const b = demo('pascalTriangle', 'Pascal triangle', [heat, bars])
  return b.finish([
    b.declare('values', b.math('arrayFill', [b.integer(8), b.integer(0)]), arrayType), b.store('values', b.integer(0), b.integer(1)),
    b.loop('row', 0, b.integer(8), [b.declare('j', b.read('row')),
      b.whileLoop(b.op('>', b.read('j'), b.integer(0)), [b.store('values', b.read('j'), b.op('+', b.at('values', b.read('j')), b.at('values', b.op('-', b.read('j'), b.integer(1))))), b.assign('j', b.op('-', b.read('j'), b.integer(1)))]),
      b.loop('column', 0, b.op('+', b.read('row'), b.integer(1)), [b.widgetCall(heat, 'HEATMAP_SP3_SET_CELL_1', [b.read('column'), b.read('row'), b.at('values', b.read('column'))])]),
      b.widgetCall(bars, bars.functions.setData, [b.read('values')]),
    ]), b.loop('index', 0, b.integer(8), [b.print(b.at('values', b.read('index')))]),
  ], 'Huit lignes du triangle de Pascal, calculées en place. Chaque coefficient devient values[j] + values[j−1] en parcourant j de droite à gauche : cela évite de relire une valeur déjà modifiée. La heatmap conserve les lignes ; les barres montrent la dernière. Sortie attendue : 1, 7, 21, 35, 35, 21, 7, 1. Gardez huit lignes pour respecter les dimensions des widgets.')
}

// Deux classes coopèrent et pilotent une jauge, un graphique et une LED depuis leurs méthodes.
function reactorControl() {
  const gauge = createGaugeModule('reactorGauge', 'Core output', 1, { min: 0, max: 100 })
  const bars = createBarChartModule('reactorBars', 'Core history', 1, { size: 12 })
  const led = createLedModule('reactorLed', 'Temperature safe', 1)

  const reactor = classBuilder('reactorControlClass', 'Reactor')
  const gaugeImport = reactor.importFunction('reactorControl:import:gauge', gauge, gauge.functions.setValue)
  const barsImport = reactor.importFunction('reactorControl:import:bars', bars, bars.functions.setValue)
  const ledImport = reactor.importFunction('reactorControl:import:led', led, led.functions.setValue)

  reactor.member('VariableDeclaration', { name: 'energy', type: doubleType, visibility: 'private' }, { initializer: reactor.real(40) })
  reactor.member('VariableDeclaration', { name: 'temperature', type: doubleType, visibility: 'private' }, { initializer: reactor.real(20) })
  const reactorCtorBody = reactor.block([
    reactor.assign(reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.read('start')),
  ])
  reactor.member('FunctionDeclaration', { name: 'constructor', type: voidType, constructor: true, visibility: 'public' }, { parameters: [reactor.parameter('start', doubleType)], body: reactorCtorBody })

  const limitBody = reactor.block([
    reactor.returnValue(reactor.real(100)),
  ])
  reactor.member('FunctionDeclaration', { name: 'limit', type: doubleType, visibility: 'private' }, { parameters: [], body: limitBody })

  const injectBody = reactor.block([
    reactor.assign(reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.op('+', reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.read('amount'))),
    reactor.ifThen(
      reactor.op('>', reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.call(reactor.memberAccess(reactor.thisNode(), 'limit'), [])),
      reactor.block([reactor.assign(reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.call(reactor.memberAccess(reactor.thisNode(), 'limit'), []))]),
    ),
    reactor.ifThen(
      reactor.op('<', reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.real(0)),
      reactor.block([reactor.assign(reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.real(0))]),
    ),
  ])
  reactor.member('FunctionDeclaration', { name: 'inject', type: voidType, visibility: 'public' }, { parameters: [reactor.parameter('amount', doubleType)], body: injectBody })

  const tickBody = reactor.block([
    reactor.assign(reactor.memberAccess(reactor.thisNode(), 'temperature'), reactor.op('-', reactor.op('+', reactor.memberAccess(reactor.thisNode(), 'temperature'), reactor.op('*', reactor.memberAccess(reactor.thisNode(), 'energy'), reactor.real(0.08))), reactor.real(3))),
    reactor.ifThen(
      reactor.op('<', reactor.memberAccess(reactor.thisNode(), 'temperature'), reactor.real(0)),
      reactor.block([reactor.assign(reactor.memberAccess(reactor.thisNode(), 'temperature'), reactor.real(0))]),
    ),
  ])
  reactor.member('FunctionDeclaration', { name: 'tick', type: voidType, visibility: 'public' }, { parameters: [], body: tickBody })

  reactor.member('FunctionDeclaration', { name: 'level', type: doubleType, visibility: 'public' }, { parameters: [], body: reactor.block([reactor.returnValue(reactor.memberAccess(reactor.thisNode(), 'energy'))]) })
  reactor.member('FunctionDeclaration', { name: 'heat', type: doubleType, visibility: 'public' }, { parameters: [], body: reactor.block([reactor.returnValue(reactor.memberAccess(reactor.thisNode(), 'temperature'))]) })

  const publishBody = reactor.block([
    reactor.statement(reactor.call(reactor.importRef(gaugeImport), [reactor.call(reactor.memberAccess(reactor.thisNode(), 'level'), [])])),
    reactor.statement(reactor.call(reactor.importRef(barsImport), [reactor.read('step'), reactor.castInt(reactor.call(reactor.memberAccess(reactor.thisNode(), 'level'), []))])),
    reactor.statement(reactor.call(reactor.importRef(ledImport), [reactor.op('<', reactor.call(reactor.memberAccess(reactor.thisNode(), 'heat'), []), reactor.real(30))])),
  ])
  reactor.member('FunctionDeclaration', { name: 'publish', type: voidType, visibility: 'public' }, { parameters: [reactor.parameter('step', intType)], body: publishBody })

  const controller = classBuilder('controllerControlClass', 'Controller')
  controller.member('VariableDeclaration', { name: 'target', type: doubleType, visibility: 'private' }, { initializer: controller.real(70) })
  controller.member('VariableDeclaration', { name: 'cycles', type: intType, visibility: 'private' }, { initializer: controller.integer(0) })
  const controllerCtorBody = controller.block([
    controller.assign(controller.memberAccess(controller.thisNode(), 'target'), controller.read('goal')),
  ])
  controller.member('FunctionDeclaration', { name: 'constructor', type: voidType, constructor: true, visibility: 'public' }, { parameters: [controller.parameter('goal', doubleType)], body: controllerCtorBody })
  const thresholdBody = controller.block([controller.returnValue(controller.real(5))])
  controller.member('FunctionDeclaration', { name: 'threshold', type: doubleType, visibility: 'private' }, { parameters: [], body: thresholdBody })

  const regulateBody = controller.block([
    controller.ifThen(
      controller.op('<', controller.call(controller.memberAccess(controller.read('reactor'), 'level'), []), controller.op('-', controller.memberAccess(controller.thisNode(), 'target'), controller.call(controller.memberAccess(controller.thisNode(), 'threshold'), []))),
      controller.block([controller.statement(controller.call(controller.memberAccess(controller.read('reactor'), 'inject'), [controller.real(8)]))]),
    ),
    controller.ifThen(
      controller.op('>', controller.call(controller.memberAccess(controller.read('reactor'), 'level'), []), controller.op('+', controller.memberAccess(controller.thisNode(), 'target'), controller.call(controller.memberAccess(controller.thisNode(), 'threshold'), []))),
      controller.block([controller.statement(controller.call(controller.memberAccess(controller.read('reactor'), 'inject'), [controller.real(-6)]))]),
    ),
    controller.assign(controller.memberAccess(controller.thisNode(), 'cycles'), controller.op('+', controller.memberAccess(controller.thisNode(), 'cycles'), controller.integer(1))),
  ])
  controller.member('FunctionDeclaration', { name: 'regulate', type: voidType, visibility: 'public' }, { parameters: [controller.parameter('reactor', { kind: 'class', classId: 'reactorControlClass' })], body: regulateBody })
  controller.member('FunctionDeclaration', { name: 'count', type: intType, visibility: 'public' }, { parameters: [], body: controller.block([controller.returnValue(controller.memberAccess(controller.thisNode(), 'cycles'))]) })

  const b = demo('reactorControl', 'Reactor control', [gauge, bars, led], [reactor, controller])
  return b.finish([
    b.declare('reactor', b.newObject('reactorControlClass', [b.real(40)]), b.classType('reactorControlClass')),
    b.declare('controller', b.newObject('controllerControlClass', [b.real(70)]), b.classType('controllerControlClass')),
    b.loop('step', 0, b.integer(12), [
      b.statement(b.methodCall(b.read('controller'), 'regulate', [b.read('reactor')])),
      b.statement(b.methodCall(b.read('reactor'), 'tick', [])),
      b.statement(b.methodCall(b.read('reactor'), 'publish', [b.read('step')])),
    ]),
    b.print(b.methodCall(b.read('reactor'), 'level', [])),
    b.print(b.methodCall(b.read('controller'), 'count', [])),
  ], 'Deux classes coopèrent : Reactor garde energy et temperature privés, expose un constructeur, inject, tick, level, heat et publish ; Controller garde target et cycles privés et régule le réacteur avec un seuil privé. La boucle crée les instances avec new, appelle les méthodes publiques et met à jour une jauge, un graphique à barres et une LED depuis la classe Reactor. Les champs privés ne sont accessibles que par this. Sortie attendue : 72 puis 12 ; la LED s’éteint quand la température dépasse 30 °C.')
}

// Onze projets supplémentaires ; le catalogue principal fournit les cartes et la confirmation d'ouverture habituelles.
export const widgetExamples = [
  { id: 'euclid', labelKey: 'examples.euclid', category: 'medium', subcategory: 'operations', build: euclid },
  { id: 'binarySearch', labelKey: 'examples.binarySearch', category: 'medium', subcategory: 'arrays', build: binarySearch },
  { id: 'primeSieve', labelKey: 'examples.primeSieve', category: 'medium', subcategory: 'arrays', build: primeSieve },
  { id: 'insertionSort', labelKey: 'examples.insertionSort', category: 'medium', subcategory: 'sorting', build: insertionSort },
  { id: 'diceHistogram', labelKey: 'examples.diceHistogram', category: 'medium', subcategory: 'simulation', build: diceHistogram },
  { id: 'checkoutQueue', labelKey: 'examples.checkoutQueue', category: 'medium', subcategory: 'simulation', build: checkoutQueue },
  { id: 'thermostat', labelKey: 'examples.thermostat', category: 'medium', subcategory: 'simulation', build: thermostat },
  { id: 'dampedSpring', labelKey: 'examples.dampedSpring', category: 'hard', subcategory: 'simulation', build: dampedSpring },
  { id: 'reactorControl', labelKey: 'examples.reactorControl', category: 'hard', subcategory: 'simulation', build: reactorControl },
  { id: 'floodFill', labelKey: 'examples.floodFill', category: 'hard', subcategory: 'arrays', build: floodFill },
  { id: 'pascalTriangle', labelKey: 'examples.pascalTriangle', category: 'hard', subcategory: 'dynamic', build: pascalTriangle },
]
