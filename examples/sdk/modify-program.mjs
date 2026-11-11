import {
  addClass,
  addConstructor,
  addFunction,
  addMethod,
  addModule,
  addVariable,
  createProject,
  deserializeProject,
  drafts,
  getModuleInfo,
  inspectNode,
  renameSymbol,
  serializeProject,
  types,
} from '@sapphire3/core'

// Construit une classe Counter avec un champ, un constructeur et une méthode.
const empty = createProject()
const withClass = addClass(empty, { id: 'counter', name: 'Counter' })
const withField = addVariable(withClass.project, 'counter', {
  name: 'value',
  type: types.int,
  initializer: drafts.literal(types.int, 0),
}, { visibility: 'public' })
const withConstructor = addConstructor(withField.project, 'counter', {
  parameters: [{ name: 'start', type: types.int }],
  body: [drafts.assignment(drafts.member(drafts.thisExpression(), 'value'), drafts.reference('start'))],
})
const withMethod = addMethod(withConstructor.project, 'counter', {
  name: 'increment',
  returnType: types.void,
  body: [drafts.assignment(
    drafts.member(drafts.thisExpression(), 'value'),
    drafts.binary('+', drafts.member(drafts.thisExpression(), 'value'), drafts.literal(types.int, 1)),
  )],
})

// Ajoute une application qui instancie la classe et affiche son champ.
const withApp = addModule(withMethod.project, { id: 'app', name: 'App' })
const withMain = addFunction(withApp.project, 'app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [
    drafts.variable('counter', types.classOf('counter'), drafts.newExpression('counter', [drafts.literal(types.int, 5)])),
    drafts.expressionStatement(drafts.call(drafts.member(drafts.reference('counter'), 'increment'), [])),
    drafts.print(drafts.member(drafts.reference('counter'), 'value')),
  ],
})

// Renomme le paramètre du constructeur et vérifie ses références.
const constructor = withMain.project.nodes.find((node) => node.kind === 'FunctionDeclaration' && node.properties.constructor === true)
const renamed = renameSymbol(withMain.project, constructor.children.parameters[0], 'initial')
console.log('rename:', renamed.ok, renamed.changes)

// Inspecte la classe et fait un aller-retour JSON.
const info = getModuleInfo(renamed.project, 'counter')
console.log('class members:', info.members.map((member) => `${member.visibility}:${member.name}`))
const field = renamed.project.nodes.find((node) => node.kind === 'VariableDeclaration' && node.properties.name === 'value')
console.log('field inspection:', inspectNode(renamed.project, field.id).type)
const serialized = serializeProject(renamed.project)
const restored = deserializeProject(serialized.json)
console.log('round-trip:', restored.ok, restored.analysis.canGenerate)
