// Contraintes vérifiables attachées à un nœud, évaluées pendant la simulation locale.

// Genres de contraintes proposés ; un genre inconnu est refusé à l'import.
export const contractKinds = ['positive', 'nonNegative', 'nonEmpty']

// Vérifie qu'un genre de contrainte est connu.
export function isContractKind(kind) {
  return typeof kind === 'string' && contractKinds.includes(kind)
}

// Évalue une contrainte sur la valeur observée ; `null` signifie « non applicable ».
export function satisfiesContract(kind, value) {
  if (kind === 'positive') return typeof value === 'bigint' ? value > 0n : typeof value === 'number' ? value > 0 : null
  if (kind === 'nonNegative') return typeof value === 'bigint' ? value >= 0n : typeof value === 'number' ? value >= 0 : null
  if (kind === 'nonEmpty') return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.length > 0 : null
  return null
}

// Normalise la liste de contraintes d'un nœud en ne gardant que les genres connus.
export function normalizeContracts(contracts) {
  if (!Array.isArray(contracts)) return []
  return contracts.filter((contract) => isContractKind(contract?.kind)).map((contract) => ({ kind: contract.kind }))
}
