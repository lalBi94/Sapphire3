import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/debug')

test('debug : build, npm pack et session depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/debug build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-debug-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-debug-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-debug-consumer', private: true, type: 'module' }))
    execSync(`npm install "${join(packDir, tarball)}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    const packageFiles = readdirSync(join(consumerDir, 'node_modules/@sapphire3/debug/dist'))
    assert.ok(packageFiles.includes('index.js'))
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import { createDebugSession, DEBUG_API_VERSION } from '@sapphire3/debug'
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
      const session = createDebugSession(project)
      const created = session.state()
      const stepped = session.stepInto()
      const printed = session.continue()
      console.log(JSON.stringify({
        api: DEBUG_API_VERSION,
        created: { status: created.status, nodeId: created.nodeId },
        stepped: { nodeId: stepped.nodeId, function: stepped.currentFunction?.name ?? null },
        printed: { status: printed.status, output: printed.output },
        frames: session.frameCount,
        exportFormat: session.exportTrace().format,
      }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.equal(parsed.api, 1)
    assert.deepEqual(parsed.created, { status: 'paused', nodeId: 'main' })
    assert.deepEqual(parsed.stepped, { nodeId: 'print', function: 'main' })
    assert.deepEqual(parsed.printed, { status: 'completed', output: ['42'] })
    assert.equal(parsed.frames, 3)
    assert.equal(parsed.exportFormat, 'sapphire3-debug-trace')
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
