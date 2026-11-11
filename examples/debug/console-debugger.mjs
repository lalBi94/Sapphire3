import { createDebugSession } from '@sapphire3/debug'
import { buildDebugExampleProject } from './project.mjs'

const project = buildDebugExampleProject()
const add = project.nodes.find((node) => node.kind === 'FunctionDeclaration' && node.properties.name === 'add')
const session = createDebugSession(project, {
  breakpoints: [add.id],
  onEvent: (event) => {
    if (event.type === 'created') console.log(`created: ${event.frameCount} frames`)
  },
})

session.on('stop', (event) => console.log(`stop: ${event.reason} at ${event.nodeId}`))
session.on('breakpoint', (event) => console.log(`breakpoint: ${event.nodeId}`))
session.on('finished', (event) => console.log(`finished: ${event.ok ? 'ok' : 'error'}`))

const atBreakpoint = session.continue()
console.log(`function: ${atBreakpoint.currentFunction.name}`)
console.log(`call stack: ${atBreakpoint.callStack.map((entry) => entry.name).join(' -> ')}`)
console.log(`parameters: ${atBreakpoint.parameters.map((entry) => `${entry.name}=${entry.value}`).join(', ')}`)

const afterCall = session.stepOut()
console.log(`after step out: ${afterCall.nodeId}, output=${JSON.stringify(afterCall.output)}`)

const finished = session.continue()
console.log(`status: ${finished.status}`)
console.log(`output: ${finished.output.join(', ')}`)
console.log(`instructions executed: ${finished.instructionCount}`)

session.dispose()
