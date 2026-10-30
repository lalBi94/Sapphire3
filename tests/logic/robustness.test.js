import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { analyzeProgram, serializeSource, deserializeSource, diagnosticCodes as codes, moduleKinds } from '../../src/utils/logic/index.js'
import { moduleTypes } from '../../src/utils/moduleTypes.js'
import { program, root, node, intType, twoModules } from './fixtures.js'

// Gèle récursivement une source JSON pour détecter les écritures accidentelles.
function freezeSource(value) {
  if (!value || typeof value !== 'object') return value
  Object.values(value).forEach(freezeSource)
  return Object.freeze(value)
}

test('le moteur analyse une source profondément gelée sans effets de bord', () => {
  assert.equal(analyzeProgram(freezeSource(twoModules())).canGenerate, true)
})

test('indépendance : tous les imports du moteur sont des fichiers JavaScript locaux', () => {
  assert.deepEqual(Object.keys(moduleTypes).filter((kind) => kind !== 'comment'), Object.values(moduleKinds))
  assert.equal(Object.values(moduleKinds).includes('comment'), false)
  assert.equal(moduleTypes.comment.hasText, true)
  const directory = new URL('../../src/utils/logic/', import.meta.url)
  for (const filename of readdirSync(directory).filter((name) => name.endsWith('.js'))) {
    const text = readFileSync(new URL(filename, directory), 'utf8')
    for (const match of text.matchAll(/^\s*(?:import|export)\s+(?:[^'"\n]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
      assert.match(match[1], /^\.\/[a-zA-Z]+\.js$/)
    }
    assert.doesNotMatch(text, /\b(?:window|document|Neutralino|React|localStorage|fetch|process)\s*[.(]/)
  }
})

test('fragments détachés : ordre de rangement différent de l’imbrication syntaxique', () => {
  const source = program('m')
  node(source, 'm', 'childFirst', 'Literal', { value: 1 })
  node(source, 'm', 'detachedParent', 'VariableDeclaration', { name: 'kept' }, { initializer: 'childFirst' })
  const result = analyzeProgram(source)
  assert.equal(result.ast.modules[0].detachedNodes.length, 1)
  assert.equal(result.ast.modules[0].detachedNodes[0].children.initializer.sourceId, 'childFirst')
  assert.equal(result.diagnostics.filter((entry) => entry.code === codes.multipleParents).length, 0)
})

test('doublons d’identifiants et export inexistant ne font pas disparaître la source', () => {
  const source = program('m')
  root(source, 'm', 'same', 'VariableDeclaration', { name: 'first' })
  node(source, 'm', 'same', 'VariableDeclaration', { name: 'second' })
  source.modules.push({ ...source.modules[0] })
  source.modules[0].exports = [{ nodeId: 'absent', name: 'absent' }]
  const result = analyzeProgram(source)
  assert.equal(result.source.nodes.length, 2)
  assert.ok(result.diagnostics.some((entry) => entry.code === codes.duplicateId))
  assert.ok(result.diagnostics.some((entry) => entry.code === codes.invalidExport))
})

test('les paramètres et variables du corps partagent la portée de fonction', () => {
  const source = program('m')
  root(source, 'm', 'f', 'FunctionDeclaration', { name: 'f' }, { parameters: ['p'], body: 'body' })
  node(source, 'm', 'p', 'Parameter', { name: 'same', type: intType })
  node(source, 'm', 'body', 'Block', {}, { statements: ['local'] })
  node(source, 'm', 'local', 'VariableDeclaration', { name: 'same' })
  assert.ok(analyzeProgram(source).diagnostics.some((entry) => entry.code === codes.conflict && entry.location.nodeId === 'local'))
})

test('appel incorrect, type utilisé comme valeur et alias cycliques sont diagnostiqués', () => {
  const source = program('m')
  root(source, 'm', 'alias', 'TypeDeclaration', { name: 'Cycle', type: { kind: 'named', target: { kind: 'name', name: 'Cycle' } } })
  root(source, 'm', 'value', 'VariableDeclaration', { name: 'value' }, { initializer: 'aliasAsValue' })
  node(source, 'm', 'aliasAsValue', 'Reference', {}, {}, { target: { kind: 'name', name: 'Cycle' } })
  root(source, 'm', 'result', 'VariableDeclaration', { name: 'result' }, { initializer: 'call' })
  node(source, 'm', 'call', 'CallExpression', {}, { callee: 'number', arguments: [] })
  node(source, 'm', 'number', 'Literal', { value: 5, type: intType })
  const result = analyzeProgram(source)
  assert.ok(result.diagnostics.some((entry) => entry.code === codes.typeCycle && entry.location.nodeId === 'alias'))
  for (const id of ['aliasAsValue', 'call']) {
    assert.ok(result.diagnostics.some((entry) => entry.code === codes.typeMismatch && entry.location.nodeId === id))
  }
})

test('une profondeur syntaxique excessive donne un diagnostic plutôt qu’un dépassement de pile', () => {
  const source = program('m')
  for (let index = 0; index < 240; index += 1) {
    node(source, 'm', `b${index}`, 'Block', {}, { statements: index < 239 ? [`b${index + 1}`] : [] })
  }
  source.modules[0].rootNodeIds.push('b0')
  const result = analyzeProgram(source)
  assert.ok(result.diagnostics.some((entry) => entry.code === codes.depthExceeded))
  assert.equal(result.source.nodes.length, 240)
})

test('une longue chaîne de références de types ne déborde pas la pile', () => {
  const source = program('m')
  for (let index = 0; index < 240; index += 1) {
    root(source, 'm', `v${index}`, 'TypeDeclaration', { name: `v${index}`, type: index === 239 ? intType : { kind: 'named', target: { kind: 'node', nodeId: `v${index + 1}` } } })
  }
  assert.ok(analyzeProgram(source).diagnostics.some((entry) => entry.code === codes.depthExceeded))
})

test('JSON : tableaux creux, accesseurs et propriétés cachées sont refusés explicitement', () => {
  const hiddenArray = [1]
  Object.defineProperty(hiddenArray, 'hidden', { value: 2 })
  const accessor = { get value() { throw new Error('ne doit pas être exécuté') } }
  for (const value of [new Array(2), hiddenArray, accessor, { [Symbol('hidden')]: true }]) {
    assert.equal(serializeSource({ value }).json, null)
  }
  assert.equal(deserializeSource('[]').diagnostics[0].code, codes.invalidSource)
  assert.equal(deserializeSource(12).diagnostics[0].code, codes.invalidJson)
})

test('matrice déterministe de données JSON invalides sur les principaux champs', () => {
  const values = [null, false, 3, 'bad', [], {}, { toString: null }, ['absent']]
  const fields = ['kind', 'moduleId', 'properties', 'children', 'references']
  for (const field of fields) {
    for (const value of values) {
      const source = program('m')
      const declaration = root(source, 'm', 'd', 'FunctionDeclaration', { name: 'f' }, { parameters: [], body: 'body' })
      node(source, 'm', 'body', 'Block', {}, { statements: [] })
      declaration[field] = value
      assert.doesNotThrow(() => analyzeProgram(source), `${field} = ${JSON.stringify(value)}`)
    }
  }
  for (const value of values) {
    const source = program('m')
    root(source, 'm', 'f', 'FunctionDeclaration', { name: 'f' }, { parameters: value, body: value })
    source.modules[0].imports = [value]
    source.modules[0].exports = [value]
    assert.doesNotThrow(() => analyzeProgram(source))
  }
})
