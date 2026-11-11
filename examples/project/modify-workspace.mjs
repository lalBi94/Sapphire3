import {
  assertWorkspaceResult,
  createMemoryStorage,
  createWorkspaceBuilder,
  drafts,
  loadWorkspaceFromStorage,
  saveWorkspaceToStorage,
  types,
} from '@sapphire3/project'

// Part d'un workspace minimal, comme un projet existant chargé depuis un dossier.
const builder = createWorkspaceBuilder({ id: 'existing-workspace' })
builder.addModule('app', { name: 'App', x: 80, y: 80 })
builder.addFunction('app', {
  name: 'main',
  returnType: types.void,
  entryPoint: true,
  body: [drafts.print(drafts.literal(types.int, 1))],
})
let workspace = builder.build().workspace

// Ajoute un module, une fonction, un export, un import et une annotation.
let result = assertWorkspaceResult(workspace.addModule({ id: 'library', name: 'Library', x: 520, y: 80 }))
workspace = result.workspace
result = assertWorkspaceResult(workspace.addFunction('library', {
  name: 'answer',
  returnType: types.int,
  body: [drafts.returnStatement(drafts.literal(types.int, 42))],
}))
workspace = result.workspace
const answerId = result.nodeId
workspace = assertWorkspaceResult(workspace.setExport('library', answerId, true)).workspace
workspace = assertWorkspaceResult(workspace.addImport('app', {
  id: 'answerImport',
  moduleId: 'library',
  nodeId: answerId,
  localName: 'answer',
})).workspace

// Renomme, déplace et annote sans toucher aux relations logiques.
workspace = assertWorkspaceResult(workspace.renameModule('app', 'Application')).workspace
workspace = assertWorkspaceResult(workspace.moveModule('app', { x: 120, y: 180, width: 360 })).workspace
workspace = assertWorkspaceResult(workspace.addComment({
  id: 'migration-note',
  name: 'Migration',
  text: 'Module Library ajouté par un agent.',
  x: 120,
  y: 460,
})).workspace

console.log(`modules: ${workspace.moduleCount}`)
console.log(`cards: ${workspace.cardCount}`)
console.log(`app card: ${JSON.stringify(workspace.getCard('app'))}`)
console.log(`imports: ${JSON.stringify(workspace.getModule('app').imports)}`)
console.log(`exports: ${JSON.stringify(workspace.getModule('library').exports)}`)

// Sauvegarde et recharge le document modifié par un adaptateur neutre.
const storage = createMemoryStorage()
await saveWorkspaceToStorage(storage, workspace)
const reloaded = await loadWorkspaceFromStorage(storage)
console.log(`round-trip: ${reloaded.toJSON() === workspace.toJSON()}`)
console.log(`valid: ${reloaded.validate().ok}`)
console.log(reloaded.toJSON())
