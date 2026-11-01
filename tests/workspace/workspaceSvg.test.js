import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorkspaceSvg, textWidth } from '../../src/utils/workspaceSvg.js'
import { examples } from '../../src/utils/examples.js'
import { analyzeProgram, createContextIndex, getModuleLinks } from '../../src/utils/logic/index.js'

test('vue SVG : document valide, modules, nœuds, liens et échappement XML', () => {
  const workspace = examples.find((example) => example.id === 'imports').build()
  const index = createContextIndex(workspace.project, analyzeProgram(workspace.project))
  const cards = [...workspace.presentation.cards, { id: 'note', type: 'comment', name: 'A & B <x>', text: 'hello', x: 0, y: 900, width: 220, height: 140 }]
  const svg = buildWorkspaceSvg({ cards, index, links: getModuleLinks(index), describe: (node) => node.kind })
  assert.ok(svg.startsWith('<svg '), 'ouvre la balise svg')
  assert.ok(svg.endsWith('</svg>'), 'ferme la balise svg')
  assert.match(svg, /viewBox="[-\d.]+ [-\d.]+ \d+ \d+"/, 'expose un viewBox pour le zoom')
  assert.ok(svg.includes('>Library<'), 'titre du module exportateur')
  assert.ok(svg.includes('>App<'), 'titre du module récepteur')
  assert.ok(svg.includes('FunctionDeclaration'), 'ligne déplie un nœud')
  assert.ok(svg.includes('marker-end="url(#ws-arrow)"'), 'trait relie les modules dépendants')
  assert.ok(svg.includes('A &amp; B &lt;x&gt;'), 'échappe les caractères réservés')
  assert.ok(!svg.includes('A & B <x>'), 'aucune balise non échappée')
})

test('largeur de texte : estimation sans DOM, idéogrammes comptés double', () => {
  assert.equal(Math.round(textWidth('', 12)), 0)
  assert.ok(textWidth('汉字段落', 12) > textWidth('abcdef', 12), 'le CJK est plus large que le latin à taille égale')
  assert.ok(textWidth('abc', 12) > 0)
})
