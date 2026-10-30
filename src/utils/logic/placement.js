// Partage les restrictions lexicales entre validation et suggestions, sans règle de rendu.
export function getPlacementIssue(kind, context) {
  if (['FunctionDeclaration', 'TypeDeclaration'].includes(kind) && !context.isModuleRoot) return 'Cette déclaration est réservée aux racines du module.'
  if (kind === 'Parameter' && !context.parameterList) return 'Paramètre en dehors de la liste d’une fonction.'
  if (kind === 'ReturnStatement' && !context.functionId) return 'Retour en dehors d’une fonction.'
  if (['BreakStatement', 'ContinueStatement'].includes(kind) && context.loopDepth === 0) return 'Instruction de boucle en dehors d’une boucle.'
  return null
}
