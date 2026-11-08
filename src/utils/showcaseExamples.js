import { createProject, createModule, createNode } from './logic/model.js'
import { createScreenModule } from './screenNode.js'
import { createXyPlotModule } from './xyPlotNode.js'
import { createOscilloscopeModule } from './oscilloscopeNode.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const voidType = { kind: 'primitive', name: 'void' }
const intArrayType = { kind: 'array', elementType: intType }

// Assemble de petits programmes SP3 : calculs dans un module dédié, orchestration dans App.
function scene(id, title, widget) {
  const project = createProject(id)
  project.modules.push(widget.module)
  project.nodes.push(...widget.nodes)
  const library = createModule(`${id}Math`, `${title} · Math`)
  const app = createModule(`${id}App`, title)
  project.modules.push(library, app)
  let current = library
  let sequence = 0
  const node = (kind, properties = {}, children = {}, references = {}) => {
    const nodeId = `${id}:${++sequence}`
    project.nodes.push(createNode(nodeId, current.id, kind, { properties, children, references }))
    return nodeId
  }
  const ref = (name) => node('Reference', {}, {}, { target: { kind: 'name', name } })
  const real = (value) => node('Literal', { type: doubleType, value: String(value) })
  const integer = (value) => node('Literal', { type: intType, value: String(value) })
  const op = (operator, left, right) => node('BinaryExpression', { operator }, { left, right })
  const math = (name, args) => node('MathCall', { name }, { arguments: args })
  const cast = (type, argument) => node('CastExpression', { type }, { argument })
  const block = (statements) => node('Block', {}, { statements })
  const declare = (name, type, initializer) => node('VariableDeclaration', { name, type }, { initializer })
  const assign = (name, value) => node('AssignmentStatement', {}, { target: ref(name), value })
  const statement = (expression) => node('ExpressionStatement', {}, { expression })
  const call = (callee, args) => node('CallExpression', {}, { callee, arguments: args })
  const imported = (provider, name) => {
    const published = provider.exports.find((entry) => entry.name === name)
    let entry = current.imports.find((item) => item.moduleId === provider.id && item.nodeId === published.nodeId)
    if (!entry) {
      entry = { id: `${current.id}:import:${current.imports.length}`, moduleId: provider.id, nodeId: published.nodeId, localName: name }
      current.imports.push(entry)
    }
    return node('Reference', {}, {}, { target: { kind: 'import', importId: entry.id } })
  }
  // Publie une fonction mathématique pure à un paramètre double.
  function formula(name, result) {
    const parameter = node('Parameter', { name: 'x', type: doubleType })
    const body = block([node('ReturnStatement', {}, { argument: result })])
    const functionId = node('FunctionDeclaration', { name, type: doubleType }, { parameters: [parameter], body })
    library.rootNodeIds.push(functionId)
    library.exports.push({ nodeId: functionId, name })
  }
  // Termine le programme et ajoute une sortie stable, indépendante des tirages.
  function finish(statements, description) {
    const message = node('Literal', { type: { kind: 'primitive', name: 'string' }, value: title })
    const body = block([...statements, node('PrintStatement', {}, { value: message })])
    app.rootNodeIds.push(node('FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body }))
    return { project, title, description }
  }
  return {
    project, library, app, node, ref, real, integer, op, math, cast, block, declare, assign, statement, call, imported, formula, finish,
    useApp: () => { current = app },
    useModule: (module) => { current = module },
  }
}

// Compare trois signatures de signal, calculées réellement par le module de l'instrument.
function harmonicStudio() {
  const widget = createOscilloscopeModule('harmonicStudioScope', 'Harmonic studio', 1)
  const b = scene('harmonicStudio', 'Harmonic studio', widget)
  b.formula('carrier', b.math('sin', [b.ref('x')]))
  b.formula('harmonics', b.op('+', b.math('sin', [b.ref('x')]), b.op('*', b.real(0.4), b.math('sin', [b.op('*', b.real(3), b.ref('x'))]))))
  b.formula('beats', b.op('*', b.math('sin', [b.op('*', b.real(3), b.ref('x'))]), b.math('cos', [b.op('*', b.real(0.35), b.ref('x'))])))
  b.useApp()
  const statements = [b.statement(b.call(b.imported(widget.module, widget.functions.setRange), [b.real(-10), b.real(10)]))]
  for (const name of ['carrier', 'harmonics', 'beats']) {
    statements.push(b.statement(b.call(b.imported(widget.module, widget.functions.addChannel), [b.imported(b.library, name)])))
  }
  return b.finish(statements, String.raw`Trois canaux : porteuse sinusoïdale, ajout d’une harmonique et battements. Les fonctions vivent dans un module Math séparé. Comparez-les avec les commandes de visibilité, amplitude et offset de l’oscilloscope ; aucun calcul DSP ni FFT. $$b(x)=\sin(3x)\cos(0{,}35x)$$`)
}

// Trace un signal dont la fréquence augmente avec la distance à l'origine.
function chirpRibbon() {
  const widget = createXyPlotModule('chirpRibbonPlot', 'Chirp ribbon', 1)
  const b = scene('chirpRibbon', 'Chirp ribbon', widget)
  b.formula('chirp', b.math('sin', [b.op('*', b.real(0.6), b.op('*', b.ref('x'), b.ref('x')))]))
  b.useApp()
  return b.finish([
    b.statement(b.call(b.imported(widget.module, widget.functions.setRange), [b.real(-8), b.real(8), b.real(-1.3), b.real(1.3)])),
    b.statement(b.call(b.imported(widget.module, widget.functions.setFunction), [b.imported(b.library, 'chirp')])),
  ], String.raw`Une sinusoïde à phase quadratique : les oscillations se resserrent vers les bords. Les 64 points sont calculés pendant Run, pas dans le rendu. Le zoom inspecte un échantillonnage fini : ce n’est pas une courbe analytique continue. $$f(x)=\sin(0{,}6x^2)$$`)
}

// Un paquet d'ondes associe une enveloppe gaussienne et une porteuse rapide.
function wavePacket() {
  const widget = createXyPlotModule('wavePacketPlot', 'Wave packet', 1)
  const b = scene('wavePacket', 'Wave packet', widget)
  const envelope = b.math('pow', [b.real(Math.E), b.op('*', b.real(-0.12), b.op('*', b.ref('x'), b.ref('x')))])
  b.formula('packet', b.op('*', envelope, b.math('cos', [b.op('*', b.real(3), b.ref('x'))])))
  b.useApp()
  return b.finish([
    b.statement(b.call(b.imported(widget.module, widget.functions.setFunction), [b.imported(b.library, 'packet')])),
  ], String.raw`Une porteuse cosinus s’efface dans une enveloppe gaussienne. Le module Math exporte la fonction ; App l’importe puis pilote le traceur. $$p(x)=e^{-0{,}12x^2}\cos(3x)$$`)
}

// Dessine une rosace polaire multicolore, point après point, sans image précalculée.
function neonRose() {
  const widget = createScreenModule('neonRoseScreen', 'Neon rose', 1, { width: 64, height: 40 })
  const b = scene('neonRose', 'Neon rose', widget)
  b.formula('roseRadius', b.op('*', b.real(17), b.math('cos', [b.op('*', b.real(5), b.ref('x'))])))
  b.useApp()
  const paletteValues = [10, 10, 18, 255, 245, 213, 71, 255, 196, 177, 255, 255, 70, 210, 235, 255, 240, 100, 170, 255, 120, 255, 160, 255]
  const palette = b.declare('palette', intArrayType, b.node('ArrayLiteral', { elementType: intType }, { elements: paletteValues.map(b.integer) }))
  const grid = b.declare('grid', intArrayType, b.math('arrayFill', [b.integer(64 * 40), b.integer(0)]))
  const phase = b.declare('phase', doubleType, b.op('*', b.math('randomDouble', []), b.real(2 * Math.PI)))
  const t = b.declare('angle', doubleType, b.op('+', b.ref('phase'), b.op('*', b.cast(doubleType, b.ref('i')), b.real(2 * Math.PI / 128))))
  const radius = b.declare('radius', doubleType, b.call(b.imported(b.library, 'roseRadius'), [b.ref('angle')]))
  const x = b.declare('px', intType, b.cast(intType, b.op('+', b.real(32), b.op('*', b.ref('radius'), b.math('cos', [b.ref('angle')])))))
  const y = b.declare('py', intType, b.cast(intType, b.op('+', b.real(20), b.op('*', b.ref('radius'), b.math('sin', [b.ref('angle')])))))
  const index = b.op('+', b.op('*', b.ref('py'), b.integer(64)), b.ref('px'))
  const write = b.node('AssignmentStatement', {}, {
    target: b.node('ArrayAccess', {}, { array: b.ref('grid'), index }),
    value: b.op('+', b.integer(1), b.op('%', b.op('/', b.ref('i'), b.integer(4)), b.integer(5))),
  })
  const paint = b.statement(b.call(b.imported(widget.module, widget.functions.blit), [b.ref('grid'), b.ref('palette')]))
  const present = b.statement(b.call(b.imported(widget.module, widget.functions.present), []))
  const show = b.node('IfStatement', {}, {
    test: b.op('==', b.op('%', b.ref('i'), b.integer(4)), b.integer(3)),
    consequent: b.block([paint, present]), alternate: null,
  })
  const loop = b.node('ForStatement', {}, {
    initializer: b.declare('i', intType, b.integer(0)), test: b.op('<', b.ref('i'), b.integer(128)),
    update: b.assign('i', b.op('+', b.ref('i'), b.integer(1))), body: b.block([t, radius, x, y, write, show]),
  })
  return b.finish([palette, grid, phase, loop], String.raw`Une rosace à cinq pétales se trace en 32 images sur un écran 64×40. Une phase aléatoire choisit le point de départ à chaque simulation ; la teinte change à chaque image et recolore le tracé au second passage. La géométrie est calculée au Run dans un module Math. $$r(\theta)=17\cos(5\theta)$$`)
}

// Deux satellites laissent leurs trajectoires ; une classe garde la phase commune privée.
function orbitalTrails() {
  const widget = createScreenModule('orbitalTrailsScreen', 'Orbital trails', 1, { width: 64, height: 40 })
  const b = scene('orbitalTrails', 'Orbital trails', widget)
  b.formula('orbitX', b.op('+', b.real(32), b.op('*', b.real(26), b.math('cos', [b.ref('x')]))))
  b.formula('orbitY', b.op('+', b.real(20), b.op('*', b.real(15), b.math('sin', [b.op('*', b.real(2), b.ref('x'))]))))
  const rotor = createModule('orbitalRotor', 'Rotor', 'class')
  b.project.modules.push(rotor)
  b.useModule(rotor)
  rotor.rootNodeIds.push(b.declare('angle', doubleType, b.real(0)))
  b.project.nodes.at(-1).properties.visibility = 'private'
  const member = () => b.node('MemberExpression', { name: 'angle' }, { object: b.node('ThisExpression') })
  const ctorParameter = b.node('Parameter', { name: 'start', type: doubleType })
  const ctor = b.node('FunctionDeclaration', { name: 'constructor', constructor: true, visibility: 'public', type: voidType }, {
    parameters: [ctorParameter], body: b.block([b.node('AssignmentStatement', {}, { target: member(), value: b.ref('start') })]),
  })
  const step = b.node('FunctionDeclaration', { name: 'step', visibility: 'public', type: doubleType }, { parameters: [], body: b.block([
    b.node('AssignmentStatement', {}, { target: member(), value: b.op('+', member(), b.real(2 * Math.PI / 64)) }),
    b.node('ReturnStatement', {}, { argument: member() }),
  ]) })
  rotor.rootNodeIds.push(ctor, step)
  b.useApp()
  const instance = b.declare('rotor', { kind: 'class', classId: rotor.id }, b.node('NewExpression', { classId: rotor.id }, { arguments: [b.op('*', b.math('randomDouble', []), b.real(2 * Math.PI))] }))
  const palette = b.declare('palette', intArrayType, b.node('ArrayLiteral', { elementType: intType }, { elements: [10, 10, 18, 255, 245, 213, 71, 255, 90, 220, 240, 255].map(b.integer) }))
  const grid = b.declare('grid', intArrayType, b.math('arrayFill', [b.integer(64 * 40), b.integer(0)]))
  const angle = b.declare('angle', doubleType, b.call(b.node('MemberExpression', { name: 'step' }, { object: b.ref('rotor') }), []))
  const writes = []
  for (let satellite = 0; satellite < 2; satellite += 1) {
    const x = b.cast(intType, b.call(b.imported(b.library, 'orbitX'), [b.op('+', b.ref('angle'), b.real(satellite * Math.PI / 2))]))
    const y = b.cast(intType, b.call(b.imported(b.library, 'orbitY'), [b.op('+', b.ref('angle'), b.real(satellite * Math.PI / 2))]))
    writes.push(b.node('AssignmentStatement', {}, {
      target: b.node('ArrayAccess', {}, { array: b.ref('grid'), index: b.op('+', b.op('*', y, b.integer(64)), x) }), value: b.integer(satellite + 1),
    }))
  }
  const paint = b.statement(b.call(b.imported(widget.module, widget.functions.blit), [b.ref('grid'), b.ref('palette')]))
  const present = b.statement(b.call(b.imported(widget.module, widget.functions.present), []))
  const loop = b.node('ForStatement', {}, {
    initializer: b.declare('frame', intType, b.integer(0)), test: b.op('<', b.ref('frame'), b.integer(64)),
    update: b.assign('frame', b.op('+', b.ref('frame'), b.integer(1))), body: b.block([angle, ...writes, paint, present]),
  })
  return b.finish([instance, palette, grid, loop], String.raw`Deux satellites jaune/cyan dessinent une trajectoire de Lissajous en 64 images. La classe Rotor encapsule sa phase privée et avance avec step(). Le module Math fournit les coordonnées, App orchestre les appels et l’écran. Modèle géométrique, pas simulation gravitationnelle. $$x=32+26\cos(t),\quad y=20+15\sin(2t)$$`)
}

// Cinq créations de la vitrine, également ouvrables dans la bibliothèque locale.
export const showcaseExamples = [
  { id: 'harmonicStudio', labelKey: 'examples.harmonicStudio', category: 'medium', subcategory: 'widgets', build: harmonicStudio },
  { id: 'chirpRibbon', labelKey: 'examples.chirpRibbon', category: 'medium', subcategory: 'widgets', build: chirpRibbon },
  { id: 'wavePacket', labelKey: 'examples.wavePacket', category: 'medium', subcategory: 'widgets', build: wavePacket },
  { id: 'neonRose', labelKey: 'examples.neonRose', category: 'hard', subcategory: 'animation', build: neonRose },
  { id: 'orbitalTrails', labelKey: 'examples.orbitalTrails', category: 'hard', subcategory: 'animation', build: orbitalTrails },
]
