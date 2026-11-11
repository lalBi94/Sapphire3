import {
  analyzeGraph,
  exportGraph,
  getAstGraph,
  getCallGraph,
  getControlFlowGraph,
  getDependencyGraph,
} from '@sapphire3/graph'
import { buildGraphExampleProject } from './project.mjs'

const project = buildGraphExampleProject()
const main = project.nodes.find((node) => node.kind === 'FunctionDeclaration' && node.properties.name === 'main')

const dependency = getDependencyGraph(project)
const calls = getCallGraph(project)
const cfg = getControlFlowGraph(project, main.id)
const ast = getAstGraph(project)

console.log(`dependency: ${dependency.nodes.length} nodes, ${dependency.edges.length} edges`)
console.log(`call: ${calls.nodes.length} nodes, ${calls.edges.length} edges`)
console.log(`cfg: ${cfg.nodes.length} nodes, ${cfg.edges.length} edges`)
console.log(`ast: ${ast.nodes.length} nodes, ${ast.edges.length} edges`)

const dependencyAnalysis = analyzeGraph(dependency)
const callAnalysis = analyzeGraph(calls)
console.log(`dependency acyclic: ${dependencyAnalysis.acyclic}`)
console.log(`call cycles: ${JSON.stringify(callAnalysis.cycles)}`)
console.log(`call topological order: ${callAnalysis.topologicalOrder}`)
console.log(`call dependencies from main: ${JSON.stringify(analyzeGraph(calls, { from: main.id }).transitiveDependencies)}`)

console.log('\nDOT excerpt:\n' + exportGraph(calls, 'dot').split('\n').slice(0, 12).join('\n'))
console.log('\nMermaid:\n' + exportGraph(calls, 'mermaid'))
