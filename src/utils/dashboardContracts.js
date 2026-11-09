// Extrait les contrats déclarés, groupés par module, pour les panneaux du dashboard.

// Construit un panneau de contrats par module qui en déclare au moins un.
export function dashboardContractPanels(project) {
  const modules = new Map((project?.modules ?? []).map((module) => [module.id, module]))
  const groups = new Map()
  for (const node of Array.isArray(project?.nodes) ? project.nodes : []) {
    const contracts = Array.isArray(node?.contracts) ? node.contracts : []
    if (contracts.length === 0 || typeof node?.moduleId !== 'string') continue
    const module = modules.get(node.moduleId)
    const panel = groups.get(node.moduleId) ?? {
      id: `contracts:${node.moduleId}`,
      type: 'contracts',
      moduleId: node.moduleId,
      name: module?.name ?? '',
      contracts: [],
    }
    for (const contract of contracts) {
      if (!contract || typeof contract.kind !== 'string') continue
      panel.contracts.push({
        nodeId: node.id,
        nodeName: node.properties?.name ?? '',
        nodeKind: node.kind,
        kind: contract.kind,
        arguments: Array.isArray(contract.arguments) ? contract.arguments : [],
      })
    }
    if (panel.contracts.length > 0) groups.set(node.moduleId, panel)
  }
  return [...groups.values()]
}
