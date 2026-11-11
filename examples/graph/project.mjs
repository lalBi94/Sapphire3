import {
  addClass,
  addConstructor,
  addFunction,
  addImport,
  addMethod,
  addModule,
  addVariable,
  createProject,
  drafts,
  setExport,
  types,
} from '@sapphire3/core'

// Construit un programme avec import, classe, méthodes, récursion et boucle.
export function buildGraphExampleProject() {
  let project = createProject('graph-example')
  project = addModule(project, { id: 'math', name: 'Math' }).project
  const double = addFunction(project, 'math', {
    name: 'double',
    returnType: types.int,
    parameters: [{ name: 'value', type: types.int }],
    body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.literal(types.int, 2)))],
  })
  project = setExport(double.project, 'math', double.nodeId, true).project

  project = addClass(project, { id: 'counter', name: 'Counter' }).project
  project = addVariable(project, 'counter', {
    name: 'value',
    type: types.int,
    initializer: drafts.literal(types.int, 0),
  }, { visibility: 'private' }).project
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
  project = addMethod(project, 'counter', {
    name: 'get',
    returnType: types.int,
    body: [drafts.returnStatement(drafts.member(drafts.thisExpression(), 'value'))],
  }).project

  project = addModule(project, { id: 'app', name: 'App' }).project
  project = addImport(project, 'app', {
    id: 'doubleImport',
    moduleId: 'math',
    nodeId: double.nodeId,
    localName: 'double',
  }).project
  project = addFunction(project, 'app', {
    name: 'factorial',
    returnType: types.int,
    parameters: [{ name: 'n', type: types.int }],
    body: [
      drafts.ifStatement(
        drafts.binary('<=', drafts.reference('n'), drafts.literal(types.int, 1)),
        [drafts.returnStatement(drafts.literal(types.int, 1))],
      ),
      drafts.returnStatement(drafts.binary(
        '*',
        drafts.reference('n'),
        drafts.call(drafts.reference('factorial'), [drafts.binary('-', drafts.reference('n'), drafts.literal(types.int, 1))]),
      )),
    ],
  }).project
  project = addFunction(project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
      drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
      drafts.print(drafts.call(drafts.member(drafts.reference('counter'), 'get'), [])),
      drafts.print(drafts.call(drafts.importReference('doubleImport'), [drafts.literal(types.int, 21)])),
      drafts.print(drafts.call(drafts.reference('factorial'), [drafts.literal(types.int, 4)])),
    ],
  }).project
  return project
}
