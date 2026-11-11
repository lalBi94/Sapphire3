import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCommands } from '../../src/utils/commandPalette.js'

const commands = [
  { id: 'create-module', label: 'Module', group: 'create', groupLabel: 'Créer', keywords: ['carte', 'module'] },
  { id: 'theme-light', label: 'Thème clair', group: 'theme', groupLabel: 'Thème', keywords: ['apparence'] },
  { id: 'export-svg', label: 'Exporter en SVG', group: 'file', groupLabel: 'Fichier', keywords: ['svg', 'export'] },
  { id: 'export-zip', label: 'Exporter le workspace', group: 'file', groupLabel: 'Fichier', keywords: ['zip', 'archive', 'export'] },
  { id: 'run-live', label: 'Exécuter en direct', group: 'run', groupLabel: 'Exécution', keywords: ['live', 'lancer'] },
]

test('palette de commandes : un terme vide conserve toutes les commandes dans l’ordre', () => {
  assert.deepEqual(filterCommands(commands, ''), commands)
  assert.deepEqual(filterCommands(commands, '   '), commands)
})

test('palette de commandes : recherche sans casse ni accents', () => {
  assert.deepEqual(filterCommands(commands, 'theme').map((command) => command.id), ['theme-light'])
  assert.deepEqual(filterCommands(commands, 'EXECUTER').map((command) => command.id), ['run-live'])
  assert.deepEqual(filterCommands(commands, 'creer').map((command) => command.id), ['create-module'])
})

test('palette de commandes : tous les mots doivent correspondre, y compris les mots-clés', () => {
  assert.deepEqual(filterCommands(commands, 'export svg').map((command) => command.id), ['export-svg'])
  assert.deepEqual(filterCommands(commands, 'fichier archive').map((command) => command.id), ['export-zip'])
  assert.deepEqual(filterCommands(commands, 'carte module').map((command) => command.id), ['create-module'])
  assert.deepEqual(filterCommands(commands, 'inconnue'), [])
})

test('palette de commandes : un libellé qui commence par le terme passe avant les correspondances partielles', () => {
  const ranked = filterCommands([
    { id: 'later', label: 'Réexporter', group: 'file', groupLabel: 'Fichier' },
    { id: 'first', label: 'Exporter', group: 'file', groupLabel: 'Fichier' },
    { id: 'group-only', label: 'Sauvegarder', group: 'file', groupLabel: 'Exporter' },
  ], 'export')
  assert.deepEqual(ranked.map((command) => command.id), ['first', 'later', 'group-only'])
})
