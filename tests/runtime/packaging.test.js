import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/runtime')

test('Runtime : build, npm pack et exécution depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/runtime build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-runtime-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-runtime-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-runtime-consumer', private: true, type: 'module' }))
    execSync(`npm install "${join(packDir, tarball)}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    const assets = readdirSync(join(consumerDir, 'node_modules/@sapphire3/runtime/dist/assets'))
    assert.ok(assets.some((name) => name.startsWith('runtime.worker')), 'the worker asset must be packaged')
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import { createRuntime, loadProject } from '@sapphire3/runtime'
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
      const loaded = await loadProject(JSON.stringify(project))
      const runtime = createRuntime(project)
      const result = await runtime.run()
      runtime.dispose()
      console.log(JSON.stringify({ canGenerate: loaded.canGenerate, ok: result.ok, output: result.output, steps: result.steps }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.equal(parsed.canGenerate, true)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.output, ['42'])
    assert.ok(parsed.steps > 0)
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
