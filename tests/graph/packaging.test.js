import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/graph')

test('graph : build, npm pack et extraction depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/graph build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-graph-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-graph-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-graph-consumer', private: true, type: 'module' }))
    execSync(`npm install "${join(packDir, tarball)}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    const packageFiles = readdirSync(join(consumerDir, 'node_modules/@sapphire3/graph/dist'))
    assert.ok(packageFiles.includes('index.js'))
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import {
        GRAPH_API_VERSION,
        analyzeGraph,
        exportGraph,
        getAstGraph,
        getCallGraph,
        getControlFlowGraph,
        getDependencyGraph,
      } from '@sapphire3/graph'
      const project = {
        formatVersion: 1,
        id: 'external',
        modules: [{ id: 'app', name: 'App', kind: 'module', rootNodeIds: ['main'], imports: [], exports: [] }],
        nodes: [
          { id: 'main', moduleId: 'app', kind: 'FunctionDeclaration', properties: { name: 'main', type: { kind: 'primitive', name: 'void' }, entryPoint: true }, children: { parameters: [], body: 'body' }, references: {} },
          { id: 'body', moduleId: 'app', kind: 'Block', properties: {}, children: { statements: ['print'] }, references: {} },
          { id: 'print', moduleId: 'app', kind: 'PrintStatement', properties: {}, children: { value: 'literal' }, references: {} },
          { id: 'literal', moduleId: 'app', kind: 'Literal', properties: { type: { kind: 'primitive', name: 'int' }, value: 42 }, children: {}, references: {} },
        ],
      }
      const dependency = getDependencyGraph(project)
      const calls = getCallGraph(project)
      const cfg = getControlFlowGraph(project, 'main')
      const ast = getAstGraph(project)
      const analysis = analyzeGraph(calls)
      console.log(JSON.stringify({
        api: GRAPH_API_VERSION,
        dependency: dependency.ok && dependency.nodes.some((node) => node.id === 'module:app'),
        call: calls.ok && calls.nodes.some((node) => node.id === 'main'),
        cfg: cfg.ok && cfg.nodes.some((node) => node.id === 'cfg:entry'),
        ast: ast.ok && ast.nodes.some((node) => node.id === 'main'),
        acyclic: analysis.acyclic,
        dot: exportGraph(calls, 'dot').startsWith('digraph'),
        mermaid: exportGraph(calls, 'mermaid').startsWith('flowchart'),
        json: JSON.parse(exportGraph(calls, 'json')).kind === 'call',
      }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.equal(parsed.api, 1)
    assert.equal(parsed.dependency, true)
    assert.equal(parsed.call, true)
    assert.equal(parsed.cfg, true)
    assert.equal(parsed.ast, true)
    assert.equal(parsed.acyclic, true)
    assert.equal(parsed.dot, true)
    assert.equal(parsed.mermaid, true)
    assert.equal(parsed.json, true)
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
