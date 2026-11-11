// Vérifications locales des liens et du classement de recherche, sans navigateur ni réseau.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const sandbox = { window: {} }
vm.createContext(sandbox)
vm.runInContext(readFileSync(path.join(root, 'assets/search-core.js'), 'utf8'), sandbox)
vm.runInContext(readFileSync(path.join(root, 'assets/search-index.js'), 'utf8'), sandbox)
const search = sandbox.SapphireSearch
const entries = search.prepare(sandbox.window.SapphireSearchEntries)

test('recherche : accents, synonymes, faute et inversion retrouvent les concepts', () => {
  assert.equal(search.normalize('DÉBOGAGE / Types'), 'debogage types')
  for (const query of ['debug', 'debogage', 'simluation']) {
    assert.ok(search.rank(entries, query).some((entry) => /#(executer|execution|simulation)$/.test(entry.url)), query)
  }
  assert.ok(search.rank(entries, 'telecharger')[0].url.endsWith('/releases'))
  assert.ok(search.rank(entries, 'pointeur').some((entry) => entry.url.includes('#types') || entry.url.includes('#typage')))
  assert.equal(search.rank(entries, 'zzzzaucuntermeici').length, 0)
})

test('recherche : tous les termes, bornage et requêtes hostiles sans interprétation', () => {
  const prepared = search.prepare([
    { title: 'Fonction et type', keywords: 'lambda', text: 'portée locale', url: 'a' },
    { title: 'Autre fonction', keywords: '', text: 'nombres', url: 'b' },
  ])
  assert.equal(search.rank(prepared, 'fonction type').length, 1)
  assert.equal(search.rank(prepared, '<script>alert(1)</script>').length, 0)
  assert.ok(search.rank(entries, 'type', 3).length <= 3)
  assert.ok(search.rank(entries, '').length > 0)
  assert.ok(search.nearWord('classe', 'clase'))
  assert.equal(search.nearWord('types', 'autre'), false)
})

test('site : liens, scripts et ancres de recherche pointent vers des fichiers réels', () => {
  for (const page of ['index', 'documentation', 'ast', 'transpilation', 'project', 'dashboards']) {
    const html = readFileSync(path.join(root, `${page}.html`), 'utf8')
    assert.ok(html.includes('assets/motion.js'))
    assert.ok(html.includes('assets/search.js'))
    for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const file = match[1].split(/[?#]/)[0]
      if (!file || /^(https?:|mailto:|data:)/.test(file)) continue
      assert.ok(existsSync(path.resolve(root, file)), `${page}: ${file}`)
    }
  }
  for (const entry of entries) {
    if (entry.url.startsWith('https://')) continue
    const [file, anchor] = entry.url.split('#')
    const html = readFileSync(path.join(root, file), 'utf8')
    if (anchor) assert.ok(html.includes(`id="${anchor}"`), entry.url)
  }
})
