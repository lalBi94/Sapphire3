import { normalizeFuzzyText } from './searchText.js'

// Tolérance de fautes selon la longueur du terme : deux lettres restent strictes,
// les termes longs acceptent davantage d'erreurs de frappe.
function editLimit(length) {
  if (length <= 2) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  return 3
}

// Distance de Damerau-Levenshtein bornée : insertion, suppression, remplacement
// et inversion de deux lettres voisines, pour accepter « pritn » pour « print ».
function boundedDistance(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1
  let previousPrevious = null
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    const current = new Array(right.length + 1)
    current[0] = row
    let rowMinimum = current[0]
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      )
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        current[column] = Math.min(current[column], previousPrevious[column - 2] + 1)
      }
      rowMinimum = Math.min(rowMinimum, current[column])
    }
    if (rowMinimum > limit) return limit + 1
    previousPrevious = previous
    previous = current
  }
  return previous[right.length]
}

// Vérifie que toutes les lettres du terme apparaissent dans l'ordre.
function isSubsequence(term, target) {
  let cursor = 0
  for (let index = 0; index < target.length && cursor < term.length; index += 1) {
    if (term[cursor] === target[index]) cursor += 1
  }
  return cursor === term.length
}

// Donne un score à un terme face à une chaîne : exact, préfixe, contenu,
// sous-séquence puis tolérance aux fautes, du plus sûr au plus approximatif.
function scoreTerm(term, target) {
  if (!term || !target) return 0
  if (term === target) return 1
  if (target.startsWith(term)) return 0.9 + 0.1 * (term.length / target.length)
  if (target.includes(term)) return 0.76 + 0.1 * (term.length / target.length)
  const limit = editLimit(term.length)
  if (limit > 0) {
    const distance = boundedDistance(term, target, limit)
    if (distance <= limit) return 0.5 + 0.32 * (1 - distance / (term.length + 1))
  }
  const ratio = term.length / target.length
  if (term.length >= 3 && ratio >= 0.3 && isSubsequence(term, target)) return 0.52 + 0.14 * ratio
  return 0
}

// Compare un terme à plusieurs libellés pondérés : chaque mot saisi doit trouver
// une correspondance, et le meilleur score de chaque mot est moyenné.
export function scoreFuzzyMatch(query, candidates) {
  const normalizedQuery = normalizeFuzzyText(query)
  if (!normalizedQuery) return 0
  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  if (queryTokens.length === 0) return 0

  const targets = new Map()
  function addTarget(text, weight) {
    if (!text) return
    const current = targets.get(text)
    if (current === undefined || weight > current) targets.set(text, weight)
  }

  for (const candidate of candidates ?? []) {
    const text = typeof candidate === 'string' ? candidate : candidate?.text
    const weight = typeof candidate === 'string' ? 1 : Number(candidate?.weight ?? 1)
    const normalized = normalizeFuzzyText(text)
    if (!normalized) continue
    addTarget(normalized, weight)
    for (const token of normalized.split(' ')) addTarget(token, weight)
    const joined = normalized.replace(/ /g, '')
    if (joined !== normalized) addTarget(joined, weight)
  }

  if (targets.size === 0) return 0

  let total = 0
  for (const token of queryTokens) {
    let best = 0
    for (const [target, weight] of targets) {
      const score = scoreTerm(token, target) * weight
      if (score > best) best = score
    }
    if (best === 0) return 0
    total += best
  }
  return total / queryTokens.length
}
