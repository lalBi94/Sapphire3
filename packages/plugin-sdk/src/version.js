// Compare deux versions sémantiques simples sans dépendance externe.
export function compareVersions(left, right) {
  const parse = (value) => String(value ?? '0.0.0').split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0)
  const first = parse(left)
  const second = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (first[index] !== second[index]) return first[index] < second[index] ? -1 : 1
  }
  return 0
}

// Vérifie qu'une version respecte une plage documentée : exacte, `*`, `^`, `~`, `>=`, `>`.
export function satisfiesVersionRange(version, range) {
  const text = String(range ?? '*').trim()
  if (!text || text === '*') return true
  if (text.startsWith('^')) {
    const base = text.slice(1)
    if (compareVersions(version, base) < 0) return false
    const major = Number.parseInt(base.split('.')[0], 10) || 0
    return compareVersions(version, `${major + 1}.0.0`) < 0
  }
  if (text.startsWith('~')) {
    const base = text.slice(1)
    if (compareVersions(version, base) < 0) return false
    const parts = base.split('.')
    const major = Number.parseInt(parts[0], 10) || 0
    const minor = Number.parseInt(parts[1], 10) || 0
    return compareVersions(version, `${major}.${minor + 1}.0`) < 0
  }
  if (text.startsWith('>=')) return compareVersions(version, text.slice(2)) >= 0
  if (text.startsWith('>')) return compareVersions(version, text.slice(1)) > 0
  return compareVersions(version, text) === 0
}
