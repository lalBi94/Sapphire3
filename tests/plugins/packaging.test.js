import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const packageDir = join(root, 'packages/plugin-sdk')

test('plugin SDK : build, npm pack et utilisation depuis un projet externe', () => {
  execSync('pnpm --filter @sapphire3/plugin-sdk build', { cwd: root, stdio: 'pipe', timeout: 120000 })
  const packDir = mkdtempSync(join(tmpdir(), 'sapphire-plugin-pack-'))
  const consumerDir = mkdtempSync(join(tmpdir(), 'sapphire-plugin-consumer-'))
  try {
    execSync(`npm pack --pack-destination "${packDir}"`, { cwd: packageDir, stdio: 'pipe', timeout: 120000 })
    const tarball = readdirSync(packDir).find((name) => name.endsWith('.tgz'))
    assert.ok(tarball, 'npm pack must produce a tarball')
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'sapphire-plugin-consumer', private: true, type: 'module' }))
    execSync(`npm install "${join(packDir, tarball)}" --ignore-scripts --no-audit --no-fund`, { cwd: consumerDir, stdio: 'pipe', timeout: 120000 })
    writeFileSync(join(consumerDir, 'verify.mjs'), `
      import {
        PLUGIN_API_VERSION,
        createNativeOperationDefinition,
        createWidgetInstance,
        validatePluginDocument,
      } from '@sapphire3/plugin-sdk'
      const int = { kind: 'primitive', name: 'int' }
      const manifest = {
        pluginFormatVersion: 1,
        apiVersion: 1,
        id: 'org.test.pack',
        name: 'Pack test',
        version: '1.0.0',
        author: 'Test',
        description: 'Pack test',
        permissions: ['ui.widgets', 'workspace.widget-state', 'engine.native-operations'],
        widgets: [{
          id: 'value', name: 'Value', description: 'Value', category: 'Test', icon: 'box',
          defaultSize: { width: 220, height: 140 }, minSize: { width: 180, height: 120 },
          properties: [], inputs: [], outputs: [], interactions: [],
          initialState: {},
          renderer: { kind: 'text', text: 'ok' },
        }],
        nativeOperations: [{
          id: 'packClamp', name: 'PACK_CLAMP', description: 'Clamp', parameters: [
            { name: 'value', type: int }, { name: 'min', type: int }, { name: 'max', type: int },
          ], returnType: int, purity: 'pure',
          implementation: { kind: 'conditional', test: { kind: 'binary', operator: '<', left: { kind: 'param', name: 'value' }, right: { kind: 'param', name: 'min' } }, consequent: { kind: 'param', name: 'min' }, alternate: { kind: 'conditional', test: { kind: 'binary', operator: '>', left: { kind: 'param', name: 'value' }, right: { kind: 'param', name: 'max' } }, consequent: { kind: 'param', name: 'max' }, alternate: { kind: 'param', name: 'value' } } },
          transpilers: { javascript: { kind: 'param', name: 'value' }, python: { kind: 'param', name: 'value' } },
        }],
      }
      const result = validatePluginDocument(manifest)
      const widget = createWidgetInstance(result.plugin.widgets[0])
      const operation = createNativeOperationDefinition(result.plugin, result.plugin.nativeOperations[0])
      console.log(JSON.stringify({ api: PLUGIN_API_VERSION, ok: result.ok, state: widget.state, run: operation.run([12n, 0n, 5n]).toString(), js: operation.emit('javascript', ['a', 'b', 'c']) }))
    `)
    const output = execSync('node verify.mjs', { cwd: consumerDir, encoding: 'utf8', timeout: 30000 })
    const parsed = JSON.parse(output.trim())
    assert.equal(parsed.api, 1)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.run, '5')
    assert.equal(typeof parsed.js, 'string')
  } finally {
    rmSync(packDir, { recursive: true, force: true })
    rmSync(consumerDir, { recursive: true, force: true })
  }
})
