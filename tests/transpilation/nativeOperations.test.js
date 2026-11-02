import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { transpileProgram } from '../../src/utils/transpilation/index.js'
import { program, root, node, intType } from '../logic/fixtures.js'

const voidType = { kind: 'primitive', name: 'void' }
const doubleType = { kind: 'primitive', name: 'double' }
const stringType = { kind: 'primitive', name: 'string' }

// Compose un programme qui imprime le résultat de chaque opération native demandée.
function callsProgram(calls) {
  const source = program('m')
  root(source, 'm', 'main', 'FunctionDeclaration', { name: 'main', type: voidType, entryPoint: true }, { parameters: [], body: 'body' })
  const statements = []
  let counter = 0

  // Ajoute un littéral typé et retourne son identifiant.
  function literal(type, value) {
    const id = `value${counter++}`
    node(source, 'm', id, 'Literal', { type, value })
    return id
  }

  // Ajoute un appel natif et l'instruction qui imprime son résultat.
  function printCall(name, args) {
    const argumentIds = args.map((argument) => {
      if (argument.array) {
        const elements = argument.array.map((value) => literal(intType, value))
        const id = `list${counter++}`
        node(source, 'm', id, 'ArrayLiteral', { elementType: intType }, { elements })
        return id
      }
      return literal(argument.type, argument.value)
    })
    const callId = `call${counter++}`
    const printId = `print${counter++}`
    node(source, 'm', callId, 'MathCall', { name }, { arguments: argumentIds })
    node(source, 'm', printId, 'PrintStatement', {}, { value: callId })
    statements.push(printId)
  }

  for (const call of calls) printCall(call.name, call.args)
  node(source, 'm', 'body', 'Block', {}, { statements })
  return source
}

const integer = (value) => ({ type: intType, value })
const floating = (value) => ({ type: doubleType, value })
const text = (value) => ({ type: stringType, value })

// Programme de référence couvrant toutes les familles d'opérations natives.
function fullProgram() {
  return callsProgram([
    { name: 'clamp', args: [integer(12), integer(0), integer(10)] },
    { name: 'sign', args: [integer(-7)] },
    { name: 'gcd', args: [integer(12), integer(18)] },
    { name: 'abs', args: [integer(-4)] },
    { name: 'min', args: [integer(-2), integer(3)] },
    { name: 'max', args: [integer(-2), integer(3)] },
    { name: 'lerp', args: [floating('0.0'), floating('10.0'), floating('0.5')] },
    { name: 'log', args: [floating('1.0')] },
    { name: 'sqrt', args: [floating('81.0')] },
    { name: 'pow', args: [floating('3.0'), floating('2.0')] },
    { name: 'floor', args: [floating('2.7')] },
    { name: 'ceil', args: [floating('2.1')] },
    { name: 'round', args: [floating('2.5')] },
    { name: 'sin', args: [floating('0.0')] },
    { name: 'cos', args: [floating('0.0')] },
    { name: 'tan', args: [floating('0.0')] },
    { name: 'length', args: [text('héllo')] },
    { name: 'charAt', args: [text('héllo'), integer(1)] },
    { name: 'substring', args: [text('héllo'), integer(1), integer(3)] },
    { name: 'contains', args: [text('hello'), text('ell')] },
    { name: 'arrayLength', args: [{ array: [1, 2, 3] }] },
  ])
}

// Compare la sortie d'un fichier généré à celle du simulateur.
function expectedOutput(project) {
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, simulation.errorCode)
  const generated = transpileProgram(project)
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  return { simulation, generated, expected: simulation.output.map((line) => `${line}\n`).join('') }
}

test('opérations natives : JavaScript généré reproduit le simulateur', () => {
  const project = fullProgram()
  const { generated, expected } = expectedOutput(project)
  assert.match(generated.code, /sapphireIntegerAbs/)
  assert.match(generated.code, /Math\.log/)
  assert.match(generated.code, /sapphireCharAt/)
  const output = execFileSync(process.execPath, ['-e', generated.code], { encoding: 'utf8', timeout: 3000 }).replace(/\r\n/g, '\n')
  assert.equal(output, expected)
})

test('opérations natives : Python généré reproduit le simulateur', () => {
  const project = fullProgram()
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, simulation.errorCode)
  const generated = transpileProgram(project, { target: 'python' })
  assert.equal(generated.ok, true, JSON.stringify(generated.diagnostics))
  assert.match(generated.code, /_sapphireMath\.log/)
  assert.match(generated.code, /sapphireSubstring/)
  const expected = simulation.output.map((line) => `${line}\n`).join('')
  const output = execFileSync('python', ['-c', generated.code], { encoding: 'utf8', timeout: 3000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).replace(/\r\n/g, '\n')
  assert.equal(output, expected)
})

test('opérations natives : domaine et bornes de texte conservés dans les fichiers générés', () => {
  const project = callsProgram([{ name: 'log', args: [floating('0.0')] }])
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, false)
  assert.equal(simulation.errorCode, 'SIMULATION_MATH_DOMAIN')
  const javascript = transpileProgram(project)
  assert.equal(javascript.ok, true)
  assert.throws(() => execFileSync(process.execPath, ['-e', javascript.code], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), (error) => error.stderr.includes('SIMULATION_MATH_DOMAIN'))
  const python = transpileProgram(project, { target: 'python' })
  assert.equal(python.ok, true)
  assert.throws(() => execFileSync('python', ['-c', python.code], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), (error) => error.stderr.includes('SIMULATION_MATH_DOMAIN'))

  const bounds = callsProgram([{ name: 'charAt', args: [text('abc'), integer(3)] }])
  assert.equal(simulateProgram(bounds).errorCode, 'SIMULATION_STRING_BOUNDS')
  const boundsJavaScript = transpileProgram(bounds)
  assert.throws(() => execFileSync(process.execPath, ['-e', boundsJavaScript.code], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), (error) => error.stderr.includes('SIMULATION_STRING_BOUNDS'))
  const boundsPython = transpileProgram(bounds, { target: 'python' })
  assert.throws(() => execFileSync('python', ['-c', boundsPython.code], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }), (error) => error.stderr.includes('SIMULATION_STRING_BOUNDS'))
})
