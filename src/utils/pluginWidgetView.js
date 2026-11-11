// Résolution pure des sources du renderer déclaratif des widgets de plugin.
// Ce module est partagé par la carte React et le client autonome du dashboard.

// Résout une valeur de rendu depuis l'état, les propriétés ou une entrée liée.
export function resolvePluginSource(source, { instance, inputs = {} }) {
  if (typeof source !== 'string') return null
  const separator = source.indexOf('.')
  if (separator <= 0) return null
  const scope = source.slice(0, separator)
  const id = source.slice(separator + 1)
  if (scope === 'state') return instance?.state?.[id] ?? null
  if (scope === 'property') return instance?.properties?.[id] ?? null
  if (scope === 'input') {
    if (Object.hasOwn(inputs, id)) return inputs[id]
    return instance?.state?.[id] ?? null
  }
  return null
}

// Remplace les jetons `{property.x}`, `{state.x}` et `{input.x}` sans interpréter de HTML.
export function formatPluginText(template, context) {
  if (typeof template !== 'string') return ''
  return template.replace(/\{(property|state|input)\.([A-Za-z0-9._-]+)\}/g, (match, scope, id) => {
    const value = resolvePluginSource(`${scope}.${id}`, context)
    return value === null || value === undefined ? match : String(value)
  })
}
