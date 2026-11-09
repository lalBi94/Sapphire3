import { createModule, createNode } from './logic/model.js'
import { colorPickerDefaults, colorPickerNoopName, colorPickerOnChangeName } from './logic/colorPickerState.js'

export { colorPickerDefaults, colorPickerNoopName, colorPickerOnChangeName } from './logic/colorPickerState.js'

const intType = { kind: 'primitive', name: 'int' }
const voidType = { kind: 'primitive', name: 'void' }

// Crée le module caché d'un sélecteur de couleur : une fonction `onChange(int[])` liée par la carte.
export function createColorPickerModule(moduleId, name, index, options = {}) {
  const channels = options.channels === 4 ? 4 : 3
  const arrayType = { kind: 'array', elementType: intType }
  const callbackType = { kind: 'function', parameters: [arrayType], returnType: voidType }
  const module = createModule(moduleId, name)
  module.colorPicker = { index, channels }
  const nodes = []
  const node = (suffix, kind, properties = {}, children = {}, references = {}) => {
    const id = `colorPicker:${moduleId}:${suffix}`
    nodes.push(createNode(id, moduleId, kind, { properties, children, references }))
    return id
  }

  const noopName = colorPickerNoopName(index, channels)
  const noopParameter = node('noopParameter', 'Parameter', { name: 'value', type: arrayType })
  const noopBody = node('noopBody', 'Block', {}, { statements: [] })
  const noop = node('noop', 'FunctionDeclaration', { name: noopName, type: voidType }, { parameters: [noopParameter], body: noopBody })

  const onChangeName = colorPickerOnChangeName(index, channels)
  const onChangeInitializer = node('onChangeInitializer', 'Reference', {}, {}, { target: { kind: 'name', name: noopName } })
  const onChange = node('onChange', 'VariableDeclaration', { name: onChangeName, type: callbackType }, { initializer: onChangeInitializer })

  module.rootNodeIds.push(noop, onChange)
  return { module, nodes, defaults: colorPickerDefaults(channels) }
}
