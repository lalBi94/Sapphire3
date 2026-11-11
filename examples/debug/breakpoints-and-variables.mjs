import { createDebugSession } from '@sapphire3/debug'
import { buildDebugExampleProject } from './project.mjs'

const project = buildDebugExampleProject()
const print = project.nodes.find((node) => node.kind === 'PrintStatement')
const session = createDebugSession(project)

session.on('breakpoints', (event) => console.log(`breakpoints: ${JSON.stringify(event.breakpoints)}`))
session.addBreakpoint(print.id)

const atPrint = session.continue()
console.log(`position: ${atPrint.nodeId} (${atPrint.currentNode.kind})`)
console.log(`function: ${atPrint.currentFunction.name}`)
console.log(`globals: ${JSON.stringify(atPrint.globals.map((entry) => ({ name: entry.name, value: entry.value })))}`)
console.log(`locals: ${JSON.stringify(atPrint.locals.map((entry) => ({ name: entry.name, value: entry.value, scope: entry.scopeKind })))}`)
console.log(`parameters: ${JSON.stringify(atPrint.parameters)}`)
console.log(`output before print: ${JSON.stringify(atPrint.output)}`)

const history = session.getInstructionHistory({ from: 0, limit: 10 })
console.log(`history: ${history.entries.map((entry) => `${entry.nodeId}@${entry.frameIndex}`).join(' -> ')}`)

session.clearBreakpoints()
const finished = session.continue()
console.log(`output after print: ${JSON.stringify(finished.output)}`)
console.log(`trace frames: ${session.exportTrace({ maxFrames: 5 }).frames.length}`)

session.dispose()
