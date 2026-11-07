import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkspaceZip, readWorkspaceZip } from '../../src/utils/workspaceArchive.js'
import { isImageReference, imageMimeType, imageExtension, bytesToDataUrl, dataUrlToBytes } from '../../src/utils/embeddedImage.js'

test('archive : conserve les noms, l’ordre et les octets des entrées', () => {
  const entries = [
    { name: 'workspace.sp3', data: new TextEncoder().encode('{"ok":true}') },
    { name: 'images/blackhole.png', data: new Uint8Array([0, 1, 2, 255]) },
    { name: 'images/été.svg', data: new TextEncoder().encode('<svg/>') },
  ]
  const read = readWorkspaceZip(buildWorkspaceZip(entries))
  assert.deepEqual(read.map((entry) => entry.name), ['workspace.sp3', 'images/blackhole.png', 'images/été.svg'])
  assert.equal(new TextDecoder().decode(read[0].data), '{"ok":true}')
  assert.deepEqual([...read[1].data], [0, 1, 2, 255])
  assert.equal(new TextDecoder().decode(read[2].data), '<svg/>')
})

test('archive : accepte une archive vide et normalise les séparateurs', () => {
  assert.deepEqual(readWorkspaceZip(buildWorkspaceZip([])), [])
  const read = readWorkspaceZip(buildWorkspaceZip([{ name: 'images\\a.png', data: new Uint8Array([7]) }]))
  assert.equal(read[0].name, 'images/a.png')
})

test('images : une référence reste limitée au sous-dossier images/', () => {
  for (const value of ['images/a.png', 'images/black-hole_2.jpg', 'images/été.webp', 'images/icon.ico']) {
    assert.equal(isImageReference(value), true, value)
  }
  for (const value of ['', 'a.png', '../a.png', 'images/../a.png', 'images//a.png', 'images/a.exe', 'images/a', 'C:/images/a.png', 'https://x/a.png', 'images/a.png/..']) {
    assert.equal(isImageReference(value), false, value)
  }
})

test('images : conversions data URL et types MIME', () => {
  const bytes = new Uint8Array([1, 2, 3, 250])
  const dataUrl = bytesToDataUrl(bytes, 'image/png')
  assert.equal(dataUrl, 'data:image/png;base64,AQID+g==')
  assert.deepEqual([...dataUrlToBytes(dataUrl)], [...bytes])
  assert.equal(dataUrlToBytes('data:image/png;base64,%%%'), null)
  assert.equal(imageMimeType('images/a.svg'), 'image/svg+xml')
  assert.equal(imageMimeType('images/a.jpeg'), 'image/jpeg')
  assert.equal(imageExtension('image/webp'), 'webp')
  assert.equal(imageExtension('image/unknown'), 'png')
})
