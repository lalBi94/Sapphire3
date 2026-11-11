import { addFunction, addModule, createProject, drafts, types } from '@sapphire3/core'

// Construit un petit programme avec un appel imbriqué et une sortie déterministe.
export function buildDebugExampleProject() {
  let project = createProject('debug-example')
  project = addModule(project, { id: 'app', name: 'App' }).project
  project = addFunction(project, 'app', {
    name: 'add',
    returnType: types.int,
    parameters: [
      { name: 'a', type: types.int },
      { name: 'b', type: types.int },
    ],
    body: [drafts.returnStatement(drafts.binary('+', drafts.reference('a'), drafts.reference('b')))],
  }).project
  project = addFunction(project, 'app', {
    name: 'main',
    returnType: types.void,
    entryPoint: true,
    body: [
      drafts.variable('total', types.int, drafts.call(drafts.reference('add'), [drafts.literal(types.int, 2), drafts.literal(types.int, 3)])),
      drafts.print(drafts.reference('total')),
    ],
  }).project
  return project
}
