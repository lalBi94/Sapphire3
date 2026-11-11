import { createRuntime } from '@sapphire3/runtime'
import { addFunction, addModule, createProject, drafts, types } from '@sapphire3/core'

// Construit un petit projet avec @sapphire3/core, puis l'exécute hors de l'IDE.
const empty = createProject('runtime-node-example')
const withModule = addModule(empty, { id: 'app', name: 'App' })
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

const runtime = createRuntime(withMain.project)
runtime.on('output', ({ lines }) => console.log('output:', lines.join('\n')))
const result = await runtime.run()
console.log('ok:', result.ok)
console.log('steps:', result.steps)
console.log('diagnostics:', result.diagnostics.length)
runtime.dispose()
