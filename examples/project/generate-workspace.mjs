import {
  createMemoryStorage,
  createWorkspaceBuilder,
  drafts,
  loadWorkspaceBundle,
  saveWorkspaceBundle,
  types,
} from '@sapphire3/project'

// Construit un workspace avec un module mathématique, une classe et une application.
const builder = createWorkspaceBuilder({ id: 'generated-workspace' })
builder.addModule('math', { name: 'Math', x: 0, y: 0 })
builder.addFunction('math', {
  name: 'double',
  returnType: types.int,
  parameters: [{ name: 'value', type: types.int }],
  body: [drafts.returnStatement(drafts.binary('*', drafts.reference('value'), drafts.literal(types.int, 2)))],
})
builder.setExport('math', 'double')

builder.addClass('counter', { name: 'Counter', x: 420, y: 0, emoji: '🔢' })
builder.addVariable('counter', { name: 'value', type: types.int, initializer: drafts.literal(types.int, 0) }, { visibility: 'private' })
builder.addConstructor('counter', {
  parameters: [{ name: 'start', type: types.int }],
  body: [drafts.assignment(drafts.member(drafts.thisExpression(), 'value'), drafts.reference('start'))],
})
builder.addMethod('counter', {
  name: 'increment',
  returnType: types.void,
  body: [drafts.assignment(
    drafts.member(drafts.thisExpression(), 'value'),
    drafts.binary('+', drafts.member(drafts.thisExpression(), 'value'), drafts.literal(types.int, 1)),
  )],
})
builder.addMethod('counter', {
  name: 'get',
  returnType: types.int,
  body: [drafts.returnStatement(drafts.member(drafts.thisExpression(), 'value'))],
})

builder.addModule('app', { name: 'App', x: 840, y: 0 })
builder.addImport('app', { id: 'doubleImport', moduleId: 'math', nodeName: 'double', localName: 'double' })
builder.addFunction('app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [
    drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
    drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
    drafts.print(drafts.call(drafts.member(drafts.reference('counter'), 'get'), [])),
    drafts.print(drafts.call(drafts.importReference('doubleImport'), [drafts.literal(types.int, 21)])),
  ],
})
builder.addComment({ id: 'readme', name: 'Readme', text: 'Workspace généré par @sapphire3/project.', x: 0, y: 320 })

const built = builder.build()
if (!built.ok) throw new Error(JSON.stringify(built.diagnostics, null, 2))
const workspace = built.workspace
console.log(`modules: ${workspace.moduleCount}`)
console.log(`cards: ${workspace.cardCount}`)
console.log(`valid: ${workspace.validate().ok}`)
console.log(`main: ${workspace.getNodeId('app', 'main')}`)

// Un adaptateur mémoire montre la sauvegarde sans imposer le système de fichiers Node.js.
const storage = createMemoryStorage()
const saved = await saveWorkspaceBundle(storage, workspace)
const reopened = await loadWorkspaceBundle(storage, { strictImages: true })
console.log(`saved document: ${saved.path}`)
console.log(`written images: ${saved.writtenImages.length}`)
console.log(`reopened valid: ${reopened.workspace.validate().ok}`)
console.log(reopened.workspace.toJSON())
