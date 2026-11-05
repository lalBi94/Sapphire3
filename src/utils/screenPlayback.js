// Rejoue et détecte les cycles des images d'écran, sans dépendre de React.

// Cadence fixe de lecture d'un moniteur et des jauges associées : 24 images par seconde.
export const screenPlaybackFrameDelay = 1000 / 24

// Empreinte rapide d'une image, pour comparer sans parcourir tous les pixels à chaque essai.
function frameHash(frame, screenId) {
  const screen = frame?.[screenId]
  if (!screen) return 0
  let hash = 2166136261
  hash = (hash ^ screen.width) >>> 0
  hash = Math.imul(hash, 16777619) >>> 0
  hash = (hash ^ screen.height) >>> 0
  hash = Math.imul(hash, 16777619) >>> 0
  const pixels = screen.pixels
  for (let index = 0; index < pixels.length; index += 1) {
    hash = (hash ^ pixels[index]) >>> 0
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

// Compare deux images d'un même écran, pour confirmer une période après les empreintes.
function sameFrame(frames, screenId, left, right) {
  const first = frames[left]?.[screenId]
  const second = frames[right]?.[screenId]
  if (!first || !second) return first === second
  if (first.width !== second.width || first.height !== second.height || first.pixels.length !== second.pixels.length) return false
  for (let index = 0; index < first.pixels.length; index += 1) {
    if (first.pixels[index] !== second.pixels[index]) return false
  }
  return true
}

/**
 * Retourne la période d'une séquence d'images, ou 0 si elle ne se répète pas.
 * Une séquence « fermée » (dernière image identique à la première) est traitée comme
 * une période de `longueur − 1` : la lecture avant boucle alors sans aucun raccord.
 */
export function findFrameCycle(frames, screenId, maximumPeriod = 240) {
  if (!Array.isArray(frames) || !screenId) return 0
  const length = frames.length
  if (length < 3) return 0
  const hashes = frames.map((frame) => frameHash(frame, screenId))
  const limit = Math.min(maximumPeriod, Math.floor(length / 2))
  for (let period = 1; period <= limit; period += 1) {
    let matches = true
    for (let index = period; index < length; index += 1) {
      if (hashes[index] !== hashes[index - period]) { matches = false; break }
    }
    if (!matches) continue
    // Les empreintes concordent : on confirme sur tous les pixels avant de conclure.
    let confirmed = true
    for (let index = period; index < length; index += 1) {
      if (!sameFrame(frames, screenId, index, index - period)) { confirmed = false; break }
    }
    if (confirmed) return period
  }
  if (hashes[length - 1] === hashes[0] && sameFrame(frames, screenId, length - 1, 0)) return length - 1
  return 0
}
