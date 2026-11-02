import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNodeImage } from '../../src/utils/nodeImage.js'

test('image de nœud : carte SVG autonome avec dimensions, accent et parties', () => {
  const image = buildNodeImage({
    kind: 'Variable',
    name: 'count',
    type: 'int',
    summary: 'int · 1 step',
    footer: 'Module · 0 Issues',
    parts: [{ label: 'Value', value: '1' }, { label: 'Type', value: 'int' }],
    accent: '#6f9ff5',
  })
  assert.equal(image.width, 720)
  assert.equal(image.height, 168 + 2 * 26)
  assert.match(image.svg, /^<svg /)
  assert.match(image.svg, /width="720"/)
  assert.match(image.svg, /#6f9ff5/)
  assert.match(image.svg, />count</)
  assert.match(image.svg, />Variable · int</)
  assert.match(image.svg, />Module · 0 Issues</)
  assert.match(image.svg, />Value</)
})

test('image de nœud : échappe le texte et borne le nombre de parties', () => {
  const parts = Array.from({ length: 20 }, (_, index) => ({ label: `Part ${index}`, value: `<x & "${index}">` }))
  const image = buildNodeImage({ kind: 'Literal', name: '<b>&"', parts })
  assert.ok(image.svg.includes('&lt;b&gt;&amp;&quot;'))
  assert.ok(image.svg.includes('&lt;x &amp; &quot;'))
  assert.equal(image.height, 168 + 12 * 26)
  assert.ok(!image.svg.includes('Part 12'))
})
