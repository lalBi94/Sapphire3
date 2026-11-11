import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/project')

test('project : build, npm pack et génération depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/project build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-project-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-project-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-project-consumer', private: true, type: 'module' }))
    execSync(`npm install "${join(packDir, tarball)}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    const packageFiles = readdirSync(join(consumerDir, 'node_modules/@sapphire3/project/dist'))
    assert.ok(packageFiles.includes('index.js'))
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import {
        PROJECT_API_VERSION,
        createWorkspaceBuilder,
        drafts,
        loadWorkspace,
        types,
      } from '@sapphire3/project'
      const builder = createWorkspaceBuilder({ id: 'external-project' })
      builder.addModule('app', { name: 'App', x: 40, y: 60 })
      builder.addClass('counter', { name: 'Counter', x: 480, y: 60 })
      builder.addVariable('counter', { name: 'value', type: types.int, initializer: drafts.literal(types.int, 0) })
      builder.addFunction('app', {
        name: 'main',
        returnType: types.void,
        entryPoint: true,
        body: [drafts.print(drafts.literal(types.int, 42))],
      })
      const built = builder.build()
      if (!built.ok) throw new Error(JSON.stringify(built.diagnostics))
      const text = built.workspace.toJSON()
      const reopened = loadWorkspace(text)
      console.log(JSON.stringify({
        api: PROJECT_API_VERSION,
        modules: reopened.moduleCount,
        cards: reopened.cardCount,
        project: reopened.projectId,
        valid: reopened.validate().ok,
        roundTrip: reopened.toJSON() === text,
        node: reopened.getNodeId('app', 'main') !== null,
      }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.equal(parsed.api, 1)
    assert.equal(parsed.modules, 2)
    assert.equal(parsed.cards, 2)
    assert.equal(parsed.project, 'external-project')
    assert.equal(parsed.valid, true)
    assert.equal(parsed.roundTrip, true)
    assert.equal(parsed.node, true)
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
