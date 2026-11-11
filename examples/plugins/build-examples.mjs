import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { definePlugin, defineWidget, defineNativeOperation, defineComposite, stringifyPluginDocument } from '../../packages/plugin-sdk/src/index.js'

const int = { kind: 'primitive', name: 'int' }
const double = { kind: 'primitive', name: 'double' }
const param = (name) => ({ kind: 'param', name })
const literal = (type, value) => ({ kind: 'literal', type, value })
const binary = (operator, left, right) => ({ kind: 'binary', operator, left, right })

// Widget d'exemple : voltmètre numérique alimenté par une variable Sapphire liée.
const voltmeter = definePlugin({
  pluginFormatVersion: 1,
  apiVersion: 1,
  id: 'org.sapphire3.examples.voltmeter',
  name: 'Digital voltmeter',
  version: '1.0.0',
  author: 'Sapphire 3 examples',
  description: 'A local digital voltmeter widget with a typed input and a slider output.',
  permissions: ['ui.widgets', 'workspace.widget-state'],
  dependencies: [],
  widgets: [defineWidget({
    id: 'voltmeter',
    name: 'Digital voltmeter',
    version: '1.0.0',
    author: 'Sapphire 3 examples',
    description: 'Shows a numeric measurement and emits a setpoint when the slider changes.',
    category: 'Instruments',
    icon: 'gauge',
    defaultSize: { width: 360, height: 250 },
    minSize: { width: 240, height: 170 },
    properties: [
      { id: 'unit', label: 'Unit', type: 'select', default: 'V', options: ['V', 'mV', 'kV'] },
      { id: 'maximum', label: 'Maximum', type: 'float', default: 10 },
    ],
    inputs: [
      { id: 'value', name: 'Voltage', type: double, description: 'Bound from a Sapphire variable.' },
    ],
    outputs: [
      { id: 'setpoint', name: 'Setpoint', type: double },
    ],
    interactions: [
      { id: 'setpoint', kind: 'slider', label: 'Setpoint', min: 0, max: 10, step: 0.1, stateKey: 'setpoint', output: 'setpoint' },
    ],
    initialState: { value: 0, setpoint: 5 },
    renderer: {
      kind: 'stack',
      children: [
        { kind: 'text', text: 'LIVE MEASUREMENT' },
        { kind: 'value', source: 'input.value', label: 'Voltage', suffix: '{property.unit}', precision: 2 },
        { kind: 'bar', source: 'input.value', min: 0, max: 10 },
        { kind: 'divider' },
        { kind: 'input', interaction: 'setpoint' },
      ],
    },
  })],
})

// Opération native d'exemple : CLAMP typé, pur, avec implémentation et émetteurs JS/Python.
const clamp = definePlugin({
  pluginFormatVersion: 1,
  apiVersion: 1,
  id: 'org.sapphire3.examples.clamp',
  name: 'Typed clamp operation',
  version: '1.0.0',
  author: 'Sapphire 3 examples',
  description: 'Adds a typed CLAMP(value, min, max) native operation to the Sapphire engine.',
  permissions: ['engine.native-operations'],
  dependencies: [],
  nativeOperations: [defineNativeOperation({
    id: 'pluginClamp',
    name: 'CLAMP',
    description: 'Clamps an integer between inclusive bounds.',
    parameters: [
      { name: 'value', type: int },
      { name: 'min', type: int },
      { name: 'max', type: int },
    ],
    returnType: int,
    purity: 'pure',
    effects: [],
    validation: binary('<=', param('min'), param('max')),
    implementation: {
      kind: 'conditional',
      test: binary('<', param('value'), param('min')),
      consequent: param('min'),
      alternate: {
        kind: 'conditional',
        test: binary('>', param('value'), param('max')),
        consequent: param('max'),
        alternate: param('value'),
      },
    },
    transpilers: {
      javascript: {
        kind: 'conditional',
        test: binary('<', param('value'), param('min')),
        consequent: param('min'),
        alternate: {
          kind: 'conditional',
          test: binary('>', param('value'), param('max')),
          consequent: param('max'),
          alternate: param('value'),
        },
      },
      python: {
        kind: 'conditional',
        test: binary('<', param('value'), param('min')),
        consequent: param('min'),
        alternate: {
          kind: 'conditional',
          test: binary('>', param('value'), param('max')),
          consequent: param('max'),
          alternate: param('value'),
        },
      },
    },
  })],
})

// Nœud composite d'exemple : « valeur comprise entre deux bornes ».
const between = definePlugin({
  pluginFormatVersion: 1,
  apiVersion: 1,
  id: 'org.sapphire3.examples.between',
  name: 'Between composite node',
  version: '1.0.0',
  author: 'Sapphire 3 examples',
  description: 'Adds a high-level comparison node that expands to native Sapphire comparison and boolean nodes.',
  permissions: ['engine.composites'],
  dependencies: [],
  composites: [defineComposite({
    id: 'between',
    name: 'Value between bounds',
    description: 'Expands to (value >= lower) and (value <= upper). Fill the three holes after insertion.',
    expansion: {
      kind: 'BinaryExpression',
      properties: { operator: 'and' },
      children: {
        left: {
          kind: 'BinaryExpression',
          properties: { operator: '>=' },
          children: { left: { kind: 'Hole' }, right: { kind: 'Hole' } },
        },
        right: {
          kind: 'BinaryExpression',
          properties: { operator: '<=' },
          children: { left: { kind: 'Hole' }, right: { kind: 'Hole' } },
        },
      },
    },
  })],
})

const destination = resolve(import.meta.dirname)
mkdirSync(destination, { recursive: true })
for (const [name, plugin] of [['voltmeter', voltmeter], ['clamp', clamp], ['between', between]]) {
  writeFileSync(resolve(destination, `${name}.sp3plugin`), `${stringifyPluginDocument(plugin)}\n`)
}
console.log(`Wrote ${destination}/voltmeter.sp3plugin`)
console.log(`Wrote ${destination}/clamp.sp3plugin`)
console.log(`Wrote ${destination}/between.sp3plugin`)
