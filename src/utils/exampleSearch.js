import { normalizeSearchText } from './searchText.js'

// Filtre les exemples sur un ou plusieurs mots-clés, sans dépendre de React ni de la langue active.
export function searchExamples(entries, query, labels = {}) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return entries
  return entries.filter((example) => {
    const name = labels.example?.(example) ?? example.labelKey
    const category = labels.category?.(example.category) ?? example.category
    const subcategory = labels.subcategory?.(example.subcategory) ?? example.subcategory
    const haystack = normalizeSearchText([example.id, name, category, subcategory].filter(Boolean).join(' '))
    return terms.every((term) => haystack.includes(term))
  })
}
