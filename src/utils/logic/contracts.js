// Contraintes vérifiables attachées à un nœud, évaluées pendant la simulation locale.

const numberArgument = Object.freeze({ name: 'value', type: 'number' })
const textArgument = Object.freeze({ name: 'text', type: 'text' })
const countArgument = Object.freeze({ name: 'count', type: 'number' })

// Catalogue ordonné des contrats proposés et des arguments qu'ils attendent.
export const contractDefinitions = Object.freeze([
  // Nombres entiers et flottants.
  Object.freeze({ kind: 'positive', arguments: [] }),
  Object.freeze({ kind: 'nonNegative', arguments: [] }),
  Object.freeze({ kind: 'nonZero', arguments: [] }),
  Object.freeze({ kind: 'even', arguments: [] }),
  Object.freeze({ kind: 'odd', arguments: [] }),
  Object.freeze({ kind: 'greaterThan', arguments: [numberArgument] }),
  Object.freeze({ kind: 'lessThan', arguments: [numberArgument] }),
  Object.freeze({ kind: 'between', arguments: [Object.freeze({ name: 'min', type: 'number' }), Object.freeze({ name: 'max', type: 'number' })] }),
  // Chaînes.
  Object.freeze({ kind: 'nonEmpty', arguments: [] }),
  Object.freeze({ kind: 'nonBlank', arguments: [] }),
  Object.freeze({ kind: 'singleLine', arguments: [] }),
  Object.freeze({ kind: 'startsWith', arguments: [textArgument] }),
  Object.freeze({ kind: 'endsWith', arguments: [textArgument] }),
  Object.freeze({ kind: 'contains', arguments: [textArgument] }),
  Object.freeze({ kind: 'minLength', arguments: [countArgument] }),
  Object.freeze({ kind: 'maxLength', arguments: [countArgument] }),
  // Tableaux.
  Object.freeze({ kind: 'uniqueElements', arguments: [] }),
  Object.freeze({ kind: 'sortedAscending', arguments: [] }),
  // Booléens.
  Object.freeze({ kind: 'isTrue', arguments: [] }),
  Object.freeze({ kind: 'isFalse', arguments: [] }),
])

export const contractKinds = Object.freeze(contractDefinitions.map((definition) => definition.kind))

// Retrouve la définition d'un genre de contrat.
export function getContractDefinition(kind) {
  return contractDefinitions.find((definition) => definition.kind === kind) ?? null
}

const integerTypes = ['short int', 'short uint', 'int', 'uint']
const floatTypes = ['float', 'double']
const textTypes = ['string', 'char']

// Indique si un type est numérique, entier ou flottant.
function numericKind(type) {
  if (type?.kind !== 'primitive') return null
  if (integerTypes.includes(type.name)) return 'integer'
  if (floatTypes.includes(type.name)) return 'float'
  return null
}

// Liste les contrats réellement applicables au type déclaré d'un symbole.
export function contractKindsForType(type) {
  let allowed = []
  const numeric = numericKind(type)
  if (numeric === 'integer') allowed = ['positive', 'nonNegative', 'nonZero', 'even', 'odd', 'greaterThan', 'lessThan', 'between']
  else if (numeric === 'float') allowed = ['positive', 'nonNegative', 'nonZero', 'greaterThan', 'lessThan', 'between']
  else if (type?.kind === 'primitive' && textTypes.includes(type.name)) allowed = ['nonEmpty', 'nonBlank', 'singleLine', 'startsWith', 'endsWith', 'contains', 'minLength', 'maxLength']
  else if (type?.kind === 'primitive' && type.name === 'boolean') allowed = ['isTrue', 'isFalse']
  else if (type?.kind === 'array') {
    const element = numericKind(type.elementType) ? 'number' : type.elementType?.kind === 'primitive' && textTypes.includes(type.elementType.name) ? 'text' : null
    allowed = ['nonEmpty', 'minLength', 'maxLength', 'uniqueElements', ...(element ? ['sortedAscending'] : [])]
  }
  const set = new Set(allowed)
  return contractDefinitions.filter((definition) => set.has(definition.kind)).map((definition) => definition.kind)
}

// Vérifie qu'un genre de contrainte est connu.
export function isContractKind(kind) {
  return getContractDefinition(kind) !== null
}

// Construit un contrat valide à partir de son genre et d'arguments bruts, ou null.
export function createContract(kind, rawArguments = []) {
  const definition = getContractDefinition(kind)
  if (!definition) return null
  const args = []
  for (let position = 0; position < definition.arguments.length; position += 1) {
    const spec = definition.arguments[position]
    const raw = Array.isArray(rawArguments) ? rawArguments[position] : undefined
    if (spec.type === 'number') {
      if (typeof raw === 'string' && raw.trim() === '') return null
      const value = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(value)) return null
      args.push(value)
    } else {
      if (typeof raw !== 'string' || raw.length === 0) return null
      args.push(raw)
    }
  }
  if (kind === 'between' && args[0] > args[1]) return null
  if (['minLength', 'maxLength'].includes(kind) && args[0] < 0) return null
  return args.length === 0 ? { kind } : { kind, arguments: args }
}

// Vérifie qu'un contrat stocké est complet et valide.
export function isContract(contract) {
  if (!contract || typeof contract !== 'object') return false
  return createContract(contract.kind, contract.arguments) !== null
}

// Normalise la liste de contraintes d'un nœud en ne gardant que les contrats valides.
export function normalizeContracts(contracts) {
  if (!Array.isArray(contracts)) return []
  return contracts.map((contract) => contract && typeof contract === 'object' ? createContract(contract.kind, contract.arguments) : null).filter(Boolean)
}

// Transforme une valeur observée en nombre comparable, ou null si ce n'est pas un nombre.
function numericValue(value) {
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

// Évalue une contrainte sur la valeur observée ; `null` signifie « non applicable ».
export function satisfiesContract(kind, value, args = []) {
  const number = numericValue(value)
  const length = typeof value === 'string' || Array.isArray(value) ? value.length : null
  if (kind === 'positive') return number === null ? null : number > 0
  if (kind === 'nonNegative') return number === null ? null : number >= 0
  if (kind === 'nonZero') return number === null ? null : number !== 0
  if (kind === 'even') return number === null || !Number.isInteger(number) ? null : number % 2 === 0
  if (kind === 'odd') return number === null || !Number.isInteger(number) ? null : Math.abs(number % 2) === 1
  if (kind === 'greaterThan') return number === null ? null : number > args[0]
  if (kind === 'lessThan') return number === null ? null : number < args[0]
  if (kind === 'between') return number === null ? null : number >= args[0] && number <= args[1]
  if (kind === 'nonEmpty') return length === null ? null : length > 0
  if (kind === 'nonBlank') return typeof value === 'string' ? value.trim().length > 0 : null
  if (kind === 'singleLine') return typeof value === 'string' ? !/[\r\n]/.test(value) : null
  if (kind === 'startsWith') return typeof value === 'string' ? value.startsWith(args[0]) : null
  if (kind === 'endsWith') return typeof value === 'string' ? value.endsWith(args[0]) : null
  if (kind === 'contains') return typeof value === 'string' ? value.includes(args[0]) : null
  if (kind === 'minLength') return length === null ? null : length >= args[0]
  if (kind === 'maxLength') return length === null ? null : length <= args[0]
  if (kind === 'uniqueElements') return Array.isArray(value) ? new Set(value.map((entry) => String(entry))).size === value.length : null
  if (kind === 'sortedAscending') {
    if (!Array.isArray(value)) return null
    for (let position = 1; position < value.length; position += 1) {
      const previous = value[position - 1]
      const current = value[position]
      if (typeof previous === 'string' && typeof current === 'string') {
        if (previous > current) return false
      } else {
        const left = numericValue(previous)
        const right = numericValue(current)
        if (left === null || right === null) return null
        if (left > right) return false
      }
    }
    return true
  }
  if (kind === 'isTrue') return typeof value === 'boolean' ? value === true : null
  if (kind === 'isFalse') return typeof value === 'boolean' ? value === false : null
  return null
}

// Traduit un contrat avec ses arguments, sans dépendre du rendu.
export function contractLabel(contract, t) {
  const definition = getContractDefinition(contract?.kind)
  if (!definition) return contract?.kind ?? ''
  const values = {}
  definition.arguments.forEach((argument, position) => {
    values[argument.name] = contract.arguments?.[position] ?? ''
  })
  return t(`contract.${contract.kind}`, values)
}