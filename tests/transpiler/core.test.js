import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { simulateProgram } from '../../src/utils/logic/index.js'
import { examples } from '../../src/utils/examples.js'
import { workspaceTemplates } from '../../src/utils/workspaceTemplates.js'
import {
  TRANSPILER_API_VERSION,
  TRANSPILER_ERROR_CODES,
  TRANSPILER_VERSION,
  TranspilerError,
  compile,
  compileModule,
  compileSelection,
  getTargetCapabilities,
  getTargets,
} from '../../packages/transpiler/src/index.js'
import { addFunction, addModule, createProject, drafts, types } from '../../packages/core/src/index.js'

// Exécute le JavaScript généré dans Node.
function runJavaScript(code) {
  return execFileSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 15000 })
}

// Exécute le Python généré.
function runPython(code) {
  return execFileSync('python', ['-c', code], { encoding: 'utf8', timeout: 15000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
}

// Découpe une sortie en lignes non vides.
function outputLines(output) {
  const trimmed = output.trim()
  return trimmed ? trimmed.split(/\r?\n/) : []
}

// Compare la sortie du code généré à celle du simulateur.
function compareExecution(project, target) {
  const simulation = simulateProgram(project)
  assert.equal(simulation.ok, true, simulation.errorCode)
  const result = compile(project, { target })
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
  const output = target === 'python' ? runPython(result.code) : runJavaScript(result.code)
  assert.deepEqual(outputLines(output), simulation.output)
  return result
}

// Construit un projet minimal qui imprime 42.
function printProject() {
  const empty = createProject('transpiler-test')
  const withModule = addModule(empty, { id: 'app', name: 'App' })
  return addFunction(withModule.project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [drafts.print(drafts.literal(types.int, 42))],
  }).project
}

test('Transpiler : version, cibles et capacités', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../packages/transpiler/package.json', import.meta.url), 'utf8'))
  assert.equal(TRANSPILER_VERSION, packageJson.version)
  assert.equal(TRANSPILER_API_VERSION, 1)

  const targets = getTargets()
  assert.deepEqual(targets.map((target) => target.id), ['javascript', 'python', 'c', 'cpp', 'java'])
  const javascript = targets.find((target) => target.id === 'javascript')
  const python = targets.find((target) => target.id === 'python')
  const c = targets.find((target) => target.id === 'c')
  assert.equal(javascript.status, 'stable')
  assert.equal(javascript.operational, true)
  assert.equal(javascript.capabilities.classes, true)
  assert.equal(python.status, 'stable')
  assert.equal(python.capabilities.arrays, true)
  assert.equal(c.status, 'experimental')
  assert.equal(c.operational, false)
  assert.equal(c.experimental, true)
  assert.equal(c.capabilities.classes, false)
  assert.equal(targets.find((target) => target.id === 'cpp').available, false)
  assert.equal(getTargetCapabilities('javascript').capabilities.lambdas, true)
  assert.equal(getTargetCapabilities('unknown'), null)
})

test('Transpiler : compilation complète JavaScript et Python', () => {
  const project = printProject()
  const javascript = compile(project, { target: 'javascript' })
  assert.equal(javascript.ok, true)
  assert.equal(javascript.kind, 'program')
  assert.equal(javascript.standalone, true)
  assert.match(javascript.code, /console\.log/)
  assert.deepEqual(javascript.diagnostics, [])
  assert.equal(javascript.metadata.mode, 'program')
  assert.equal(javascript.metadata.fragments[0].end, javascript.code.length)
  assert.equal(javascript.metadata.entryPoint.nodeId, project.nodes.find((node) => node.properties.entryPoint === true).id)
  assert.ok(javascript.metadata.declarations.some((entry) => entry.name === 'main' && entry.generatedName))

  const python = compile(project, { target: 'python' })
  assert.equal(python.ok, true)
  assert.match(python.code, /print\(/)
  assert.equal(python.metadata.entryPoint.generatedName, 'App_main')

  const unsupported = compile(project, { target: 'cpp' })
  assert.equal(unsupported.ok, false)
  assert.equal(unsupported.diagnostics[0].code, 'TRANSPILE_TARGET_UNSUPPORTED')
  assert.equal(unsupported.metadata, null)
})

test('Transpiler : classes et méthodes conformes en JavaScript et Python', () => {
  const workspace = workspaceTemplates.find((template) => template.id === 'classInstance').build()
  const simulation = simulateProgram(workspace.project)
  assert.deepEqual(simulation.output, ['3'])
  const javascript = compareExecution(workspace.project, 'javascript')
  const python = compareExecution(workspace.project, 'python')
  assert.ok(javascript.metadata.classes.some((entry) => entry.classId === 'templateCounterClass'))
  assert.ok(python.metadata.classes.some((entry) => entry.classId === 'templateCounterClass'))
  assert.equal(javascript.metadata.declarations.find((entry) => entry.name === 'constructor').generatedName, 'constructor')
  assert.equal(python.metadata.declarations.find((entry) => entry.name === 'constructor').generatedName, '__init__')

  const moduleResult = compileModule(workspace.project, 'templateCounterClass', { target: 'python' })
  assert.equal(moduleResult.ok, true)
  assert.equal(moduleResult.kind, 'module')
  assert.equal(moduleResult.standalone, false)
  assert.match(moduleResult.code, /class Counter/)
  assert.deepEqual(moduleResult.metadata.selection, { kind: 'module', id: 'templateCounterClass' })
  assert.equal(moduleResult.metadata.fragments[0].sourceId, 'templateCounterClass')
  assert.ok(moduleResult.metadata.classes.some((entry) => entry.classId === 'templateCounterClass'))

  const main = workspace.project.nodes.find((node) => node.properties?.name === 'main' && node.kind === 'FunctionDeclaration')
  const selection = compileSelection(workspace.project, { kind: 'node', id: main.id }, { target: 'javascript' })
  assert.equal(selection.ok, true)
  assert.equal(selection.kind, 'selection')
  assert.equal(selection.standalone, false)
  assert.deepEqual(selection.metadata.selection, { kind: 'node', id: main.id })
  assert.equal(selection.metadata.fragments[0].sourceId, main.id)
  assert.ok(selection.metadata.declarations.some((entry) => entry.name === 'main'))

  const member = workspace.project.nodes.find((node) => node.properties?.name === 'add' && node.kind === 'FunctionDeclaration')
  const memberSelection = compileSelection(workspace.project, { kind: 'node', id: member.id }, { target: 'javascript' })
  assert.equal(memberSelection.ok, true)
  assert.deepEqual(memberSelection.metadata.expandedTo, { kind: 'module', id: 'templateCounterClass' })
  assert.equal(memberSelection.metadata.fragments[0].kind, 'module')
})

test('Transpiler : tableaux, pointeurs et lambdas conformes', () => {
  for (const id of ['arrays', 'pointers', 'higherOrder']) {
    const workspace = examples.find((example) => example.id === id).build()
    compareExecution(workspace.project, 'javascript')
    compareExecution(workspace.project, 'python')
  }
})

test('Transpiler : diagnostics, widgets et erreurs d’API', () => {
  const widgetWorkspace = workspaceTemplates.find((template) => template.id === 'widgetDashboard').build()
  const widgetResult = compile(widgetWorkspace.project, { target: 'javascript' })
  assert.equal(widgetResult.ok, false)
  assert.equal(widgetResult.code, '')
  assert.equal(widgetResult.metadata, null)
  assert.ok(widgetResult.diagnostics.some((diagnostic) => diagnostic.code === 'TRANSPILE_SCREEN_UNSUPPORTED'))
  assert.ok(widgetResult.diagnostics.every((diagnostic) => 'nodeId' in diagnostic && 'location' in diagnostic))

  const classWorkspace = workspaceTemplates.find((template) => template.id === 'classInstance').build()
  const cResult = compile(classWorkspace.project, { target: 'c' })
  assert.equal(cResult.ok, false)
  assert.ok(cResult.diagnostics.some((diagnostic) => diagnostic.code === 'TRANSPILE_C_UNSUPPORTED'))
  const nodeDiagnostic = cResult.diagnostics.find((diagnostic) => diagnostic.location.nodeId)
  assert.equal(nodeDiagnostic.nodeId, nodeDiagnostic.location.nodeId)

  const noEntry = createProject('no-entry')
  const noEntryResult = compile(noEntry, { target: 'javascript' })
  assert.equal(noEntryResult.ok, false)
  assert.ok(noEntryResult.diagnostics.some((diagnostic) => diagnostic.code === 'TRANSPILE_ENTRY_POINT_REQUIRED'))

  assert.throws(() => compile(null), (error) => error instanceof TranspilerError && error.code === TRANSPILER_ERROR_CODES.invalidProject)
  assert.throws(() => compileSelection(printProject(), { kind: 'bad', id: 'x' }), (error) => error instanceof TranspilerError && error.code === TRANSPILER_ERROR_CODES.invalidArgument)
  const missingModule = compileModule(printProject(), 'missing', { target: 'javascript' })
  assert.equal(missingModule.ok, false)
  assert.equal(missingModule.diagnostics[0].code, 'TARGET_MISSING')
  assert.equal(missingModule.metadata, null)
})

test('Transpiler : C expérimental reste limité et non opérationnel', () => {
  const workspace = examples.find((example) => example.id === 'pointers').build()
  const result = compile(workspace.project, { target: 'c' })
  assert.equal(result.ok, true)
  assert.equal(result.metadata.targetStatus, 'experimental')
  assert.equal(result.metadata.operational, false)
  assert.equal(result.metadata.experimental, true)
  assert.ok(result.metadata.helpers.compileFlags.includes('-lm'))
  assert.equal(getTargetCapabilities('c').operational, false)
})
