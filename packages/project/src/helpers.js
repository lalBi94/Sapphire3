import { ProjectError, PROJECT_ERROR_CODES } from './errors.js'

// Reconnaît un objet simple, sans prototype exotique.
export function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// Copie récursivement une valeur JSON sans partager les objets mutables.
export function cloneJson(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const copy = []
    seen.set(value, copy)
    for (const entry of value) copy.push(cloneJson(entry, seen))
    return copy
  }
  const copy = {}
  seen.set(value, copy)
  for (const [key, entry] of Object.entries(value)) copy[key] = cloneJson(entry, seen)
  return copy
}

// Gèle récursivement les objets simples et les tableaux exposés en lecture seule.
export function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value) || isRecord(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key], seen)
    Object.freeze(value)
  }
  return value
}

// Décode un texte UTF-8 depuis une chaîne ou des octets.
export function decodeText(input) {
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (input instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(input))
  if (ArrayBuffer.isView(input)) return new TextDecoder().decode(new Uint8Array(input.buffer, input.byteOffset, input.byteLength))
  return null
}

// Encode un texte en octets UTF-8.
export function encodeText(text) {
  return new TextEncoder().encode(String(text))
}

// Copie des octets sans conserver une vue mutable de l'appelant.
export function copyBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0))
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
  return null
}

// Copie une Map de ressources binaires en conservant des copies indépendantes.
export function copyByteMap(value) {
  const result = new Map()
  if (!value) return result
  const entries = value instanceof Map ? value.entries() : Object.entries(value)
  for (const [name, bytes] of entries) {
    const copy = copyBytes(bytes)
    if (!copy) throw new ProjectError(PROJECT_ERROR_CODES.invalidArgument, `Expected binary data for ${name}.`)
    result.set(String(name), copy)
  }
  return result
}

// Vérifie qu'un nom d'entrée d'archive reste relatif et sans remontée de dossier.
export function isSafeArchiveName(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return false
  if (value.includes('\\') || value.startsWith('/') || /^[A-Za-z]:/.test(value)) return false
  if (/[\u0000-\u001f]/.test(value)) return false
  return !value.split('/').some((part) => part === '' || part === '.' || part === '..')
}

// Normalise un nom d'entrée pour la lecture d'une archive.
export function normalizeArchiveName(value) {
  return String(value).replace(/\\/g, '/')
}

// Vérifie qu'un nom de fichier d'image reste simple et sûr.
export function safeImageBaseName(value) {
  const base = String(value ?? '').replace(/^.*[\\/]/, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '')
  return base.length > 0 ? base : 'image'
}
