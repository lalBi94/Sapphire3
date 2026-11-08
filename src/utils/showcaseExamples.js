import { createProject, createModule, createNode } from './logic/model.js'
import { createScreenModule } from './screenNode.js'
import { createXyPlotModule } from './xyPlotNode.js'
import { createOscilloscopeModule } from './oscilloscopeNode.js'

const intType = { kind: 'primitive', name: 'int' }
const doubleType = { kind: 'primitive', name: 'double' }
const booleanType = { kind: 'primitive', name: 'boolean' }
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
  // Déclare le drapeau interne qui prolonge une animation en live.
  function liveFlag() {
    const initial = node('Literal', { type: booleanType, value: false })
    current.rootNodeIds.push(node('VariableDeclaration', { name: 'SP3_LIVE', type: booleanType }, { initializer: initial }))
  }
  // Condition de boucle : finie en Run borné, infinie en Run live.
  function liveCondition(frame, limit) {
    return node('BinaryExpression', { operator: 'or' }, { left: ref('SP3_LIVE'), right: op('<', ref(frame), integer(limit)) })
  }
  return {
    project, library, app, node, ref, real, integer, op, math, cast, block, declare, assign, statement, call, imported, formula, finish, liveFlag, liveCondition,
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
  b.liveFlag()
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
    initializer: b.declare('i', intType, b.integer(0)), test: b.liveCondition('i', 128),
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
  b.liveFlag()
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
    initializer: b.declare('frame', intType, b.integer(0)), test: b.liveCondition('frame', 64),
    update: b.assign('frame', b.op('+', b.ref('frame'), b.integer(1))), body: b.block([angle, ...writes, paint, present]),
  })
  return b.finish([instance, palette, grid, loop], String.raw`Deux satellites jaune/cyan dessinent une trajectoire de Lissajous en 64 images. La classe Rotor encapsule sa phase privée et avance avec step(). Le module Math fournit les coordonnées, App orchestre les appels et l’écran. Modèle géométrique, pas simulation gravitationnelle. $$x=32+26\cos(t),\quad y=20+15\sin(2t)$$`)
}

// Huit planètes sur des ellipses képlériennes ; la Terre bleue est suivie par sa traînée.
function solarSystem() {
  const width = 128
  const height = 96
  const frames = 26
  const years = 2
  const centerX = 64
  const centerY = 48
  const widget = createScreenModule('solarSystemScreen', 'Solar system', 1, { width, height })
  const b = scene('solarSystem', 'Solar system', widget)
  const planets = [
    { id: 'mercury', a: 0.387, e: 0.2056, period: 0.2408, phase: 0.4, color: 1 },
    { id: 'venus', a: 0.723, e: 0.0068, period: 0.6152, phase: 1.3, color: 2 },
    { id: 'earth', a: 1, e: 0.0167, period: 1, phase: 2.2, color: 3 },
    { id: 'mars', a: 1.524, e: 0.0934, period: 1.8808, phase: 3.1, color: 4 },
    { id: 'jupiter', a: 5.203, e: 0.0489, period: 11.862, phase: 4, color: 5 },
    { id: 'saturn', a: 9.537, e: 0.0565, period: 29.457, phase: 5, color: 6 },
    { id: 'uranus', a: 19.19, e: 0.0463, period: 84.011, phase: 0.8, color: 7 },
    { id: 'neptune', a: 30.07, e: 0.0086, period: 164.79, phase: 2.6, color: 8 },
  ]
  // Projette une distance en UA dans le cadre : les orbites externes restent visibles.
  const scale = Math.log(1 + 31)
  const pixelRadius = (a) => 6 + 36 * Math.log(1 + a) / scale
  const earth = planets.find((planet) => planet.id === 'earth')
  const earthMajor = pixelRadius(earth.a)
  const earthMinor = earthMajor * Math.sqrt(1 - earth.e * earth.e)
  const earthFocus = earthMajor * earth.e
  // La trajectoire de la Terre est calculée dans le module Math, puis importée par App.
  b.formula('earthX', b.op('-', b.op('+', b.real(centerX), b.op('*', b.real(earthMajor), b.math('cos', [b.ref('x')]))), b.real(earthFocus)))
  b.formula('earthY', b.op('+', b.real(centerY), b.op('*', b.real(earthMinor), b.math('sin', [b.ref('x')]))))
  b.useApp()
  b.liveFlag()
  const declarations = []
  for (const planet of planets) {
    const aPx = pixelRadius(planet.a)
    declarations.push(
      b.declare(`phase_${planet.id}`, doubleType, b.real(planet.phase)),
      b.declare(`speed_${planet.id}`, doubleType, b.real(2 * Math.PI * years / planet.period / (frames - 1))),
      b.declare(`color_${planet.id}`, intType, b.integer(planet.color)),
    )
    if (planet.id !== 'earth') {
      declarations.push(
        b.declare(`major_${planet.id}`, doubleType, b.real(aPx)),
        b.declare(`minor_${planet.id}`, doubleType, b.real(aPx * Math.sqrt(1 - planet.e * planet.e))),
        b.declare(`focus_${planet.id}`, doubleType, b.real(aPx * planet.e)),
      )
    }
  }
  const palette = b.declare('palette', intArrayType, b.node('ArrayLiteral', { elementType: intType }, {
    elements: [6, 8, 20, 255, 190, 190, 200, 255, 235, 215, 160, 255, 70, 150, 255, 255, 230, 110, 80, 255, 230, 170, 100, 255, 235, 210, 130, 255, 120, 230, 235, 255, 90, 130, 255, 255, 255, 245, 150, 255, 255, 190, 60, 255, 35, 45, 80, 255, 220, 240, 255, 255].map(b.integer),
  }))
  const grid = b.declare('grid', intArrayType, b.math('arrayFill', [b.integer(width * height), b.integer(0)]))
  // Seule la Terre reçoit une traînée : son orbite complète est dessinée une fois.
  const guides = []
  {
    const aPx = pixelRadius(earth.a)
    const bPx = aPx * Math.sqrt(1 - earth.e * earth.e)
    for (let marker = 0; marker < 64; marker += 1) {
      const angle = 2 * Math.PI * marker / 64
      const x = Math.floor(centerX + aPx * Math.cos(angle) - aPx * earth.e)
      const y = Math.floor(centerY + bPx * Math.sin(angle))
      guides.push(b.node('AssignmentStatement', {}, {
        target: b.node('ArrayAccess', {}, { array: b.ref('grid'), index: b.integer(y * width + x) }),
        value: b.integer(3),
      }))
    }
  }
  // Le Soleil est un disque fixe de 29 pixels, dessiné une seule fois.
  const sun = []
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const distance = dx * dx + dy * dy
      if (distance <= 10) {
        sun.push(b.node('AssignmentStatement', {}, {
          target: b.node('ArrayAccess', {}, { array: b.ref('grid'), index: b.integer((centerY + dy) * width + centerX + dx) }),
          value: b.integer(distance <= 4 ? 9 : 10),
        }))
      }
    }
  }
  const draws = [b.declare('frameGrid', intArrayType, b.math('arraySlice', [b.ref('grid'), b.integer(0), b.integer(width * height)]))]
  for (const planet of planets) {
    const key = planet.id
    const target = planet.id === 'earth' ? 'grid' : 'frameGrid'
    const angle = b.declare(`angle_${key}`, doubleType, b.op('+', b.ref(`phase_${key}`), b.op('*', b.ref(`speed_${key}`), b.cast(doubleType, b.ref('frame')))))
    const xValue = planet.id === 'earth'
      ? b.call(b.imported(b.library, 'earthX'), [b.ref(`angle_${key}`)])
      : b.op('-', b.op('+', b.real(centerX), b.op('*', b.ref(`major_${key}`), b.math('cos', [b.ref(`angle_${key}`)]))), b.ref(`focus_${key}`))
    const yValue = planet.id === 'earth'
      ? b.call(b.imported(b.library, 'earthY'), [b.ref(`angle_${key}`)])
      : b.op('+', b.real(centerY), b.op('*', b.ref(`minor_${key}`), b.math('sin', [b.ref(`angle_${key}`)])))
    const x = b.declare(`x_${key}`, doubleType, xValue)
    const y = b.declare(`y_${key}`, doubleType, yValue)
    const pixel = b.declare(`pixel_${key}`, intType, b.op('+', b.op('*', b.cast(intType, b.ref(`y_${key}`)), b.integer(width)), b.cast(intType, b.ref(`x_${key}`))))
    draws.push(angle, x, y, pixel, b.node('AssignmentStatement', {}, {
      target: b.node('ArrayAccess', {}, { array: b.ref(target), index: b.ref(`pixel_${key}`) }),
      value: b.ref(`color_${key}`),
    }))
    if (planet.id === 'earth') {
      for (const offset of [1, width, width + 1]) {
        draws.push(b.node('AssignmentStatement', {}, {
          target: b.node('ArrayAccess', {}, { array: b.ref('grid'), index: b.op('+', b.ref(`pixel_${key}`), b.integer(offset)) }),
          value: b.ref(`color_${key}`),
        }))
      }
      draws.push(b.node('AssignmentStatement', {}, {
        target: b.node('ArrayAccess', {}, { array: b.ref('grid'), index: b.ref(`pixel_${key}`) }),
        value: b.integer(12),
      }))
    }
  }
  const paint = b.statement(b.call(b.imported(widget.module, widget.functions.blit), [b.ref('frameGrid'), b.ref('palette')]))
  const present = b.statement(b.call(b.imported(widget.module, widget.functions.present), []))
  const loop = b.node('ForStatement', {}, {
    initializer: b.declare('frame', intType, b.integer(0)), test: b.liveCondition('frame', frames),
    update: b.assign('frame', b.op('+', b.ref('frame'), b.integer(1))), body: b.block([...draws, paint, present]),
  })
  return b.finish([...declarations, palette, grid, ...guides, ...sun, loop], String.raw`Écran 128×96. Huit planètes suivent des ellipses képlériennes autour du Soleil, avec les demi-grands axes, excentricités et périodes réelles ; la projection radiale logarithmique garde tout le système visible. La Terre, en bleu, est la seule à laisser une traînée ; les autres planètes restent des points. Le Soleil est le disque jaune central. L'écran rejoue la séquence tant que le Run est actif. Pas d'interactions planète-planète ni de Lune. $$x=a(\cos E-e),\quad y=b\sin E$$`)
}

// Six créations dédiées, également ouvrables dans la bibliothèque locale.
export const showcaseExamples = [
  { id: 'harmonicStudio', labelKey: 'examples.harmonicStudio', category: 'medium', subcategory: 'widgets', build: harmonicStudio },
  { id: 'chirpRibbon', labelKey: 'examples.chirpRibbon', category: 'medium', subcategory: 'widgets', build: chirpRibbon },
  { id: 'wavePacket', labelKey: 'examples.wavePacket', category: 'medium', subcategory: 'widgets', build: wavePacket },
  { id: 'neonRose', labelKey: 'examples.neonRose', category: 'hard', subcategory: 'animation', build: neonRose },
  { id: 'orbitalTrails', labelKey: 'examples.orbitalTrails', category: 'hard', subcategory: 'animation', build: orbitalTrails },
  { id: 'solarSystem', labelKey: 'examples.solarSystem', category: 'hard', subcategory: 'simulation', build: solarSystem },
]
