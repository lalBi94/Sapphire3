import { exportGraph, getCallGraph } from '@sapphire3/graph'
import { buildGraphExampleProject } from './project.mjs'

const project = buildGraphExampleProject()
const calls = getCallGraph(project)

const json = exportGraph(calls, 'json')
const dot = exportGraph(calls, 'dot', { direction: 'LR', graphName: 'Sapphire call graph' })
const mermaid = exportGraph(calls, 'mermaid', { direction: 'LR' })

console.log(`JSON: ${json.length} characters`)
console.log(`DOT: ${dot.length} characters`)
console.log(`Mermaid: ${mermaid.length} characters`)
console.log(`JSON kind: ${JSON.parse(json).kind}`)
console.log(`DOT first line: ${dot.split('\n')[0]}`)
console.log(`Mermaid first line: ${mermaid.split('\n')[0]}`)
console.log('\n' + mermaid)
