import test from 'node:test'
import assert from 'node:assert/strict'
import { createProject, createModule, createNode, analyzeProgram, createContextIndex, getModuleLinks, getPureIds, getUnusedDeclarationIds, simulateProgram } from '../../src/utils/logic/index.js'

const voidType = { kind: 'primitive', name: 'void' }
const intType = { kind: 'primitive', name: 'int' }
// Analyse large : douze modules indépendants, chacun avec une fonction et 45 impressions.
const moduleCount = 12
const statementCount = 45

// Construit un projet valide de plus de mille nœuds, sans dépendance entre modules.
function stressProject() {
  const project = createProject('stress')
  for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex += 1) {
    const moduleId = `stress-module-${moduleIndex}`
    const module = createModule(moduleId, `Stress ${moduleIndex + 1}`)
    project.modules.push(module)
    const make = (id, kind, properties = {}, children = {}) => {
      project.nodes.push(createNode(id, moduleId, kind, { properties, children }))
      return id
    }
    const functionId = `stress:${moduleIndex}:function`
    const bodyId = `stress:${moduleIndex}:body`
    module.rootNodeIds.push(functionId)
    make(functionId, 'FunctionDeclaration', {
      name: moduleIndex === 0 ? 'main' : `work${moduleIndex}`,
      type: voidType,
      ...(moduleIndex === 0 ? { entryPoint: true } : {}),
    }, { parameters: [], body: bodyId })
    const statements = []
    for (let statement = 0; statement < statementCount; statement += 1) {
      const printId = `stress:${moduleIndex}:print:${statement}`
      const valueId = `stress:${moduleIndex}:value:${statement}`
      make(printId, 'PrintStatement', {}, { value: valueId })
      make(valueId, 'Literal', { type: intType, value: String(statement) })
      statements.push(printId)
    }
    make(bodyId, 'Block', {}, { statements })
  }
  return project
}

test('stress : analyse, index et simulation d’un projet de plus de mille nœuds', () => {
  const project = stressProject()
  assert.ok(project.nodes.length >= 1000, `${project.nodes.length} nœuds attendus`)
  const started = performance.now()
  const analysis = analyzeProgram(project)
  const index = createContextIndex(project, analysis)
  const unused = getUnusedDeclarationIds(project, analysis)
  const pure = getPureIds(project, analysis)
  const links = getModuleLinks(index)
  const elapsed = performance.now() - started
  assert.deepEqual(analysis.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), [])
  assert.equal(index.nodes.size, project.nodes.length)
  // Chaque nœud est rangé une seule fois dans son module, sans reparcours au rendu.
  assert.equal([...index.nodeIdsByModule.values()].reduce((total, ids) => total + ids.length, 0), project.nodes.length)
  assert.equal(index.nodeIdsByModule.get(`stress-module-${moduleCount - 1}`).length, 2 + statementCount * 2)
  assert.deepEqual(links, [])
  assert.ok(Array.isArray(unused))
  assert.ok(pure.functions instanceof Set && pure.modules instanceof Set)
  // Borne volontairement large : elle détecte une régression majeure, pas une variation machine.
  assert.ok(elapsed < 5000, `analyse trop lente : ${Math.round(elapsed)} ms`)
  const result = simulateProgram(project)
  assert.equal(result.ok, true, result.errorCode)
  assert.equal(result.output.length, statementCount)
  assert.equal(result.output[0], '0')
  assert.equal(result.output[statementCount - 1], String(statementCount - 1))
})