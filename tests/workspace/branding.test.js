import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const branding = new URL('src/assets/branding/', root)

test('branding : les icônes natives et les favicons viennent des ressources locales', async () => {
  const config = JSON.parse(await readFile(new URL('neutralino.config.json', root), 'utf8'))
  for (const file of [config.applicationIcon, config.modes.window.icon.replace(/^\//, '')]) {
    const png = await readFile(new URL(file, root))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(png.readUInt32BE(16), png.readUInt32BE(20))
  }
  for (const file of ['03_DESKTOP/Windows/sapphire3-windows.ico', '02_FAVICON_PWA/favicon.ico']) {
    const ico = await readFile(new URL(file, branding))
    assert.equal(ico.readUInt16LE(0), 0)
    assert.equal(ico.readUInt16LE(2), 1)
    assert.ok(ico.readUInt16LE(4) > 1, 'ICO multirésolution')
  }
  const icns = await readFile(new URL('03_DESKTOP/macOS/sapphire3.icns', branding))
  assert.equal(icns.subarray(0, 4).toString(), 'icns')
  assert.equal(icns.readUInt32BE(4), icns.length)
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
    const png = await readFile(new URL(`03_DESKTOP/Linux/hicolor/${size}x${size}/apps/sapphire3.png`, branding))
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
})
