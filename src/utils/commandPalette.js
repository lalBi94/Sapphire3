import { normalizeFuzzyText } from './searchText.js'

// Filtre et ordonne les commandes : mots saisis présents dans le libellé, le groupe ou les mots-clés.
export function filterCommands(commands, term) {
  const query = normalizeFuzzyText(term)
  if (!query) return commands
  const tokens = query.split(' ').filter(Boolean)
  const scored = []
  commands.forEach((command, index) => {
    const label = normalizeFuzzyText(command.label)
    const group = normalizeFuzzyText(command.groupLabel ?? command.group)
    const keywords = normalizeFuzzyText((command.keywords ?? []).join(' '))
    const haystack = `${label} ${group} ${keywords}`
    if (!tokens.every((token) => haystack.includes(token))) return
    let score = 0
    if (label.startsWith(query)) score += 100
    else if (label.includes(query)) score += 50
    if (tokens.every((token) => label.includes(token))) score += 20
    scored.push({ command, score, index })
  })
  scored.sort((left, right) => right.score - left.score || left.index - right.index)
  return scored.map((entry) => entry.command)
}
