import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/transpiler')

test('Transpiler : build, npm pack et compilation depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/Transpiler build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-transpiler-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-transpiler-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-transpiler-consumer', private: true, type: 'module' }))
    execSync(`npm install "${join(packDir, tarball)}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    const packageFiles = readdirSync(join(consumerDir, 'node_modules/@sapphire3/Transpiler/dist'))
    assert.ok(packageFiles.includes('index.js'))
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import { compile, getTargets } from '@sapphire3/Transpiler'
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
      const javascript = compile(project, { target: 'javascript' })
      const python = compile(project, { target: 'python' })
      console.log(JSON.stringify({
        targets: getTargets().map((target) => target.id),
        jsOk: javascript.ok,
        jsCode: javascript.code.includes('console.log'),
        jsEntry: javascript.metadata?.entryPoint?.nodeId ?? null,
        pyOk: python.ok,
        pyCode: python.code.includes('print('),
      }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.deepEqual(parsed.targets, ['javascript', 'python', 'c', 'cpp', 'java'])
    assert.equal(parsed.jsOk, true)
    assert.equal(parsed.jsCode, true)
    assert.equal(parsed.jsEntry, 'main')
    assert.equal(parsed.pyOk, true)
    assert.equal(parsed.pyCode, true)
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
