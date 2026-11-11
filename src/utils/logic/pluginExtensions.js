// Registre local des extensions fournies par le gestionnaire de plugins.
// Ce module ne dépend ni de React, ni du SDK, ni d'une API native : le moteur
// reçoit uniquement des définitions déjà validées par l'hôte.
let nativeDefinitions = []
let compositeActions = []

// Remplace les opérations natives et les composites disponibles.
export function setPluginExtensions({ natives = [], composites = [] } = {}) {
  nativeDefinitions = Array.isArray(natives) ? natives : []
  compositeActions = Array.isArray(composites) ? composites : []
}

// Liste les définitions natives ajoutées par les plugins actifs.
export function getPluginNativeDefinitions() {
  return nativeDefinitions
}

// Liste les composites actifs proposés dans le menu des nœuds.
export function getPluginCompositeActions() {
  return compositeActions
}

// Vide le registre, notamment entre deux tests ou après désinstallation.
export function clearPluginExtensions() {
  nativeDefinitions = []
  compositeActions = []
}
