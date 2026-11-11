import { execFileSync } from 'node:child_process'
import { compile } from '@sapphire3/Transpiler'
import {
  addClass,
  addConstructor,
  addFunction,
  addMethod,
  addModule,
  addVariable,
  createProject,
  drafts,
  types,
} from '@sapphire3/core'

// Construit une classe Counter avec un constructeur et une méthode.
let project = createProject('transpiler-python-example')
project = addClass(project, { id: 'counter', name: 'Counter' }).project
project = addVariable(project, 'counter', {
  name: 'value',
  type: types.int,
  initializer: drafts.literal(types.int, 0),
}, { visibility: 'public' }).project
project = addConstructor(project, 'counter', {
  parameters: [{ name: 'start', type: types.int }],
  body: [drafts.assignment(drafts.member(drafts.thisExpression(), 'value'), drafts.reference('start'))],
}).project
project = addMethod(project, 'counter', {
  name: 'increment',
  returnType: types.void,
  body: [drafts.assignment(
    drafts.member(drafts.thisExpression(), 'value'),
    drafts.binary('+', drafts.member(drafts.thisExpression(), 'value'), drafts.literal(types.int, 1)),
  )],
}).project
project = addModule(project, { id: 'app', name: 'App' }).project
project = addFunction(project, 'app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [
    drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
    drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
    drafts.print(drafts.member(drafts.reference('counter'), 'value')),
  ],
}).project

const result = compile(project, { target: 'python' })
if (!result.ok) throw new Error(result.diagnostics.map((entry) => entry.code).join(', '))
console.log(result.code)
console.log('classes:', result.metadata.classes)
console.log('entry:', result.metadata.entryPoint)
console.log('output:', execFileSync('python', ['-c', result.code], { encoding: 'utf8', timeout: 10000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).trim())
