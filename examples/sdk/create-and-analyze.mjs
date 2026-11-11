import { addFunction, addModule, analyze, createProject, drafts, summarize, types } from '@sapphire3/core'

// Crée un projet, un module et une fonction d'entrée minimale.
const empty = createProject('sdk-example')
const withModule = addModule(empty, { id: 'app', name: 'App' })
if (!withModule.ok) throw new Error(withModule.code)

const withMain = addFunction(withModule.project, 'app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [
    drafts.variable('answer', types.int, drafts.literal(types.int, 42)),
    drafts.print(drafts.reference('answer')),
  ],
})
if (!withMain.ok) throw new Error(withMain.code)

const analysis = analyze(withMain.project)
console.log('canGenerate:', analysis.canGenerate)
console.log('symbols:', analysis.symbols.map((symbol) => symbol.name))
console.log('diagnostics:', analysis.diagnostics)
console.log('summary:', summarize(withMain.project))
