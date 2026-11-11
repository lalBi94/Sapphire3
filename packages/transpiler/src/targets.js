import { getTranspilationTargets, transpilationLanguages } from '../../../src/utils/transpilation/index.js'

// Capacités réelles des backends JavaScript et Python.
const scriptCapabilities = Object.freeze({
  primitives: true,
  strings: true,
  chars: true,
  variables: true,
  functions: true,
  controlFlow: true,
  print: true,
  arrays: true,
  pointers: true,
  functionReferences: true,
  lambdas: true,
  closures: true,
  forEach: true,
  classes: true,
  generics: true,
  nativeMath: 'partial',
  explicitCasts: true,
  contracts: false,
  widgets: false,
  traceability: true,
  standalone: true,
})

// Sous-ensemble réellement accepté par le backend C expérimental.
const cCapabilities = Object.freeze({
  primitives: true,
  strings: true,
  chars: false,
  variables: true,
  functions: true,
  controlFlow: true,
  print: true,
  arrays: false,
  pointers: true,
  functionReferences: 'named',
  lambdas: 'nonCapturing',
  closures: false,
  forEach: false,
  classes: false,
  generics: false,
  nativeMath: false,
  explicitCasts: false,
  contracts: false,
  widgets: false,
  traceability: true,
  standalone: true,
})

// Cible non installée : aucune capacité annoncée.
const unavailableCapabilities = Object.freeze({
  primitives: false,
  strings: false,
  chars: false,
  variables: false,
  functions: false,
  controlFlow: false,
  print: false,
  arrays: false,
  pointers: false,
  functionReferences: false,
  lambdas: false,
  closures: false,
  forEach: false,
  classes: false,
  generics: false,
  nativeMath: false,
  explicitCasts: false,
  contracts: false,
  widgets: false,
  traceability: false,
  standalone: false,
})

const targetCapabilities = Object.freeze({
  javascript: scriptCapabilities,
  python: scriptCapabilities,
  c: cCapabilities,
  cpp: unavailableCapabilities,
  java: unavailableCapabilities,
})

// Décrit une cible avec son statut réel et ses capacités.
function describeTarget(language, installed) {
  const status = language.id === 'c' ? 'experimental' : language.available && installed ? 'stable' : 'unavailable'
  const capabilities = targetCapabilities[language.id] ?? unavailableCapabilities
  return Object.freeze({
    ...language,
    installed,
    available: Boolean(language.available && installed),
    status,
    operational: status === 'stable',
    experimental: status === 'experimental',
    capabilities,
  })
}

// Retourne toutes les cibles connues, y compris celles non installées.
export function getTargets() {
  const installed = new Set(getTranspilationTargets())
  return transpilationLanguages.map((language) => describeTarget(language, installed.has(language.id)))
}

// Retourne les capacités d'une cible, ou null si elle est inconnue.
export function getTargetCapabilities(target) {
  return getTargets().find((entry) => entry.id === target) ?? null
}
