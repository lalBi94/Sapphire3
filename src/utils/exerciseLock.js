const algorithm = 'PBKDF2-SHA256'
const iterations = 150000
const keyLength = 32

// Erreur stable pour l'interface, sans exposer de détail cryptographique.
function lockError(code) {
  return Object.assign(new Error(code), { code })
}

// Convertit des octets en base64 standard, seul format stocké dans le manifeste.
function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// Relit le base64 stocké, en refusant une valeur mal formée.
function base64ToBytes(text) {
  if (typeof text !== 'string' || text.length === 0) throw lockError('EXERCISE_LOCK_INVALID')
  const binary = atob(text)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

// Dérive une clé PBKDF2-SHA256 ; le sel et le nombre d'itérations sont stockés avec l'empreinte.
async function derive(password, salt, rounds) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, material, keyLength * 8)
  return new Uint8Array(bits)
}

// Prépare un verrou à partir d'un mot de passe ; aucun mot de passe en clair n'est conservé.
export async function createExerciseLock(password) {
  if (typeof password !== 'string' || password.length < 4) throw lockError('EXERCISE_PASSWORD_TOO_SHORT')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, iterations)
  return { algorithm, iterations, salt: bytesToBase64(salt), hash: bytesToBase64(hash) }
}

// Vérifie un mot de passe en temps constant sur l'empreinte dérivée.
export async function verifyExerciseLock(password, lock) {
  if (!lock || lock.algorithm !== algorithm || !Number.isInteger(lock.iterations) || lock.iterations < 1 || lock.iterations > 1000000) return false
  try {
    const expected = base64ToBytes(lock.hash)
    const actual = await derive(String(password ?? ''), base64ToBytes(lock.salt), lock.iterations)
    if (actual.length !== expected.length) return false
    let difference = 0
    for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index]
    return difference === 0
  } catch {
    return false
  }
}
