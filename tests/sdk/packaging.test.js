import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/core')

test('SDK : build, npm pack et import depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/core build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-core-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-core-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    const tarballPath = join(packDir, tarball)
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-core-consumer', private: true, type: 'module' }))
    execSync(`npm install "${tarballPath}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import { createProject, addModule, addFunction, analyze, drafts, types } from '@sapphire3/core'
      const empty = createProject('external')
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
      const analysis = analyze(withMain.project)
      const invalid = addModule(createProject('invalid'), { id: 'app', name: 'App' }).project
      invalid.modules[0].rootNodeIds.push('missing')
      const invalidAnalysis = analyze(invalid)
      console.log(JSON.stringify({
        ok: withMain.ok,
        canGenerate: analysis.canGenerate,
        diagnostics: analysis.diagnostics.length,
        symbols: analysis.symbols.map((symbol) => symbol.name),
        invalidDiagnostics: invalidAnalysis.diagnostics.map((diagnostic) => diagnostic.code),
      }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.deepEqual(parsed, {
      ok: true,
      canGenerate: true,
      diagnostics: 0,
      symbols: ['main', 'answer'],
      invalidDiagnostics: ['NODE_NOT_FOUND'],
    })
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
