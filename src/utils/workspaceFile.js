import { isId, isRecord, sourceFormatVersion, moduleKinds, createProject } from './logic/model.js'
import { isContract } from './logic/contracts.js'
import { serializeSource } from './logic/serialization.js'
import { screenLimits } from './logic/mathNatives.js'
import { barChartViews, colorPickerViews, heatmapViews, logicalCardTypes, moduleCardTypes, gaugeViews, inputButtonViews, inputNumberViews, ledViews, oscilloscopeViews, pluginWidgetViews, rgbLedViews, moduleTypes, minimumModuleSize, progressViews, screenViews, xyPlotViews } from './moduleTypes.js'
import { heatmapMaximumDimension } from './logic/heatmapState.js'
import { isEmbeddedImage, isImageReference } from './embeddedImage.js'
import { validateExercise } from './exercise.js'
import { assertDashboardConfig } from './dashboardConfig.js'
import { colorPickerDefaults } from './logic/colorPickerState.js'

export const workspaceFileVersion = 3

// Migrations versionnées : chaque entrée transforme la version N vers N+1 sans perdre de données.
// La version 1 reste lisible ; les champs historiques sont normalisés avant la validation finale.
const workspaceMigrations = new Map([
  [1, (data) => {
    const project = isRecord(data.project) ? data.project : null
    const nodes = project && Array.isArray(project.nodes)
      ? project.nodes.map((node) => {
        if (!isRecord(node) || node.kind !== 'FunctionDeclaration' || !isRecord(node.properties)) return node
        const properties = { ...node.properties }
        if (properties.generic === true && !Array.isArray(properties.typeParameters)) properties.typeParameters = [{ name: 'T' }]
        delete properties.generic
        return { ...node, properties }
      })
      : null
    const presentation = isRecord(data.presentation) ? data.presentation : null
    const cards = presentation && Array.isArray(presentation.cards)
      ? presentation.cards.map((card) => {
        if (!isRecord(card) || !Object.hasOwn(card, 'screenScale')) return card
        const { screenScale: _screenScale, ...rest } = card
        return rest
      })
      : null
    return {
      ...data,
      workspaceVersion: 2,
      ...(project && nodes ? { project: { ...project, nodes } } : {}),
      ...(presentation && cards ? { presentation: { ...presentation, cards } } : {}),
    }
  }],
  // La version 3 accepte les images liées au dossier du workspace ; les anciennes cartes
  // conservent leur image intégrée, aucune transformation de données n'est nécessaire.
  [2, (data) => ({ ...data, workspaceVersion: 3 })],
])

// Applique les migrations dans l'ordre jusqu'à la version courante, sans inventer de version de secours.
function migrateWorkspace(data) {
  let current = data
  let version = current.workspaceVersion
  while (version < workspaceFileVersion) {
    const migrate = workspaceMigrations.get(version)
    if (!migrate) throw workspaceError('Unsupported Sapphire workspace version.', 'WORKSPACE_VERSION_UNSUPPORTED')
    current = migrate(current)
    if (current.workspaceVersion !== version + 1) throw workspaceError('The workspace migration did not advance the version.', 'WORKSPACE_VERSION_UNSUPPORTED')
    version += 1
  }
  return current
}

// Conserve le message technique pour les tests et expose un code stable à l'interface traduite.
function workspaceError(message, code = 'WORKSPACE_INVALID') {
  return Object.assign(new Error(message), { code })
}

// Ne laisse entrer que des identifiants ou des trous dans les relations syntaxiques affichées.
function validNodeLink(value) {
  return value === null || isId(value)
}

// Vérifie une couleur persistée : exactement 3 ou 4 entiers entre 0 et 255.
function validColorValue(value, channels) {
  return Array.isArray(value) && value.length === channels && value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 255)
}

// Refuse les structures que l'interface ne peut pas restaurer, sans exiger un programme sémantiquement complet.
function validateProject(project) {
  if (!isRecord(project) || project.formatVersion !== sourceFormatVersion || !isId(project.id) || !Array.isArray(project.modules) || !Array.isArray(project.nodes)) {
    throw workspaceError('Invalid or unsupported logical project format.')
  }
  const moduleIds = new Set()
  const screenIndices = new Set()
  const gaugeIndices = new Set()
  const progressIndices = new Set()
  const barChartIndices = new Set()
  const xyPlotIndices = new Set()
  const oscilloscopeIndices = new Set()
  const heatmapIndices = new Set()
  const ledIndices = new Set()
  const rgbLedIndices = new Set()
  const inputButtonIndices = new Set()
  const inputNumberIndices = new Set()
  const colorPickerIndices = new Set()
  for (const module of project.modules) {
    if (!isRecord(module) || !isId(module.id) || moduleIds.has(module.id) || !Object.values(moduleKinds).includes(module.kind) || !isId(module.name) || !['rootNodeIds', 'imports', 'exports'].every((field) => Array.isArray(module[field]))) {
      throw workspaceError('Invalid module data. Legacy Main modules are not supported.')
    }
    moduleIds.add(module.id)
    if (!module.rootNodeIds.every(validNodeLink)) throw workspaceError('Invalid module root identifiers.')
    if (module.screen !== undefined && (!isRecord(module.screen) || !Number.isInteger(module.screen.index) || !Number.isInteger(module.screen.width) || !Number.isInteger(module.screen.height) || module.screen.index < 1 || module.screen.width < 1 || module.screen.height < 1 || module.screen.width > screenLimits.maximumDimension || module.screen.height > screenLimits.maximumDimension || screenIndices.has(module.screen.index))) throw workspaceError('Invalid screen module data.')
    if (module.screen) screenIndices.add(module.screen.index)
    if (module.gauge !== undefined && (!isRecord(module.gauge) || !Number.isInteger(module.gauge.index) || module.gauge.index < 1 || !Number.isFinite(module.gauge.min) || !Number.isFinite(module.gauge.max) || module.gauge.max <= module.gauge.min || gaugeIndices.has(module.gauge.index))) throw workspaceError('Invalid gauge module data.')
    if (module.gauge) gaugeIndices.add(module.gauge.index)
    if (module.progress !== undefined && (!isRecord(module.progress) || !Number.isInteger(module.progress.index) || module.progress.index < 1 || !Number.isFinite(module.progress.min) || !Number.isFinite(module.progress.max) || module.progress.max <= module.progress.min || progressIndices.has(module.progress.index))) throw workspaceError('Invalid progress module data.')
    if (module.progress) progressIndices.add(module.progress.index)
    if (module.barChart !== undefined && (!isRecord(module.barChart) || !Number.isInteger(module.barChart.index) || module.barChart.index < 1 || barChartIndices.has(module.barChart.index))) throw workspaceError('Invalid bar chart module data.')
    if (module.barChart) barChartIndices.add(module.barChart.index)
    if (module.xyPlot !== undefined && (!isRecord(module.xyPlot) || !Number.isInteger(module.xyPlot.index) || module.xyPlot.index < 1 || !Number.isInteger(module.xyPlot.samples) || module.xyPlot.samples < 1 || module.xyPlot.samples > 512 || xyPlotIndices.has(module.xyPlot.index))) throw workspaceError('Invalid XY plot module data.')
    if (module.xyPlot) xyPlotIndices.add(module.xyPlot.index)
    if (module.oscilloscope !== undefined && (!isRecord(module.oscilloscope) || !Number.isInteger(module.oscilloscope.index) || module.oscilloscope.index < 1 || !Number.isInteger(module.oscilloscope.samples) || module.oscilloscope.samples < 16 || module.oscilloscope.samples > 256 || oscilloscopeIndices.has(module.oscilloscope.index))) throw workspaceError('Invalid oscilloscope module data.')
    if (module.oscilloscope) oscilloscopeIndices.add(module.oscilloscope.index)
    if (module.heatmap !== undefined && (!isRecord(module.heatmap) || !Number.isInteger(module.heatmap.index) || module.heatmap.index < 1 || heatmapIndices.has(module.heatmap.index) || !['width', 'height'].every((key) => Number.isInteger(module.heatmap[key]) && module.heatmap[key] > 0 && module.heatmap[key] <= heatmapMaximumDimension))) throw workspaceError('Invalid heatmap module data.')
    if (module.heatmap) heatmapIndices.add(module.heatmap.index)
    if (module.led !== undefined && (!isRecord(module.led) || !Number.isInteger(module.led.index) || module.led.index < 1 || ledIndices.has(module.led.index))) throw workspaceError('Invalid LED module data.')
    if (module.led) ledIndices.add(module.led.index)
    if (module.rgbLed !== undefined && (!isRecord(module.rgbLed) || !Number.isInteger(module.rgbLed.index) || module.rgbLed.index < 1 || rgbLedIndices.has(module.rgbLed.index))) throw workspaceError('Invalid RGB LED module data.')
    if (module.rgbLed) rgbLedIndices.add(module.rgbLed.index)
    if (module.inputButton !== undefined && (!isRecord(module.inputButton) || !Number.isInteger(module.inputButton.index) || module.inputButton.index < 1 || !['toggle', 'hold'].includes(module.inputButton.mode) || inputButtonIndices.has(module.inputButton.index))) throw workspaceError('Invalid input button module data.')
    if (module.inputButton) inputButtonIndices.add(module.inputButton.index)
    if (module.inputNumber !== undefined && (!isRecord(module.inputNumber) || !Number.isInteger(module.inputNumber.index) || module.inputNumber.index < 1 || (module.inputNumber.valueType !== undefined && !['int', 'float', 'string'].includes(module.inputNumber.valueType)) || inputNumberIndices.has(module.inputNumber.index))) throw workspaceError('Invalid input number module data.')
    if (module.inputNumber) inputNumberIndices.add(module.inputNumber.index)
    if (module.colorPicker !== undefined && (!isRecord(module.colorPicker) || !Number.isInteger(module.colorPicker.index) || module.colorPicker.index < 1 || ![3, 4].includes(module.colorPicker.channels) || colorPickerIndices.has(`${module.colorPicker.channels}:${module.colorPicker.index}`))) throw workspaceError('Invalid color picker module data.')
    if (module.colorPicker) colorPickerIndices.add(`${module.colorPicker.channels}:${module.colorPicker.index}`)
  }
  const nodeIds = new Set()
  for (const node of project.nodes) {
    if (!isRecord(node) || !isId(node.id) || nodeIds.has(node.id) || !moduleIds.has(node.moduleId) || !isId(node.kind) || !['properties', 'children', 'references'].every((field) => isRecord(node[field]))) {
      throw workspaceError('Invalid node data or duplicate node identifiers.')
    }
    nodeIds.add(node.id)
    if (node.properties.name !== undefined && typeof node.properties.name !== 'string') throw workspaceError('Invalid declaration name.')
    if (node.properties.operator !== undefined && typeof node.properties.operator !== 'string') throw workspaceError('Invalid operator data.')
    if (node.properties.type?.name !== undefined && typeof node.properties.type.name !== 'string') throw workspaceError('Invalid type name.')
    if (node.properties.generic !== undefined && typeof node.properties.generic !== 'boolean') throw workspaceError('Invalid generic declaration flag.')
    if (node.properties.value !== null && typeof node.properties.value === 'object') throw workspaceError('Invalid literal value.')
    if (!Object.values(node.children).every((value) => Array.isArray(value) ? value.every(validNodeLink) : validNodeLink(value))) throw workspaceError('Invalid child identifiers.')
    if (node.contracts !== undefined && (!Array.isArray(node.contracts) || node.contracts.some((contract) => !isRecord(contract) || !isContract(contract)))) throw workspaceError('Invalid node contracts.')
  }
}

// Une carte Image porte soit une image intégrée, soit une référence relative au dossier `images/`.
function isImageCardValid(card) {
  if (typeof card.caption !== 'string') return false
  if (typeof card.imageRef === 'string' && card.imageRef.length > 0) {
    return isImageReference(card.imageRef) && (card.image === undefined || card.image === '')
  }
  return isEmbeddedImage(card.image ?? '')
}

// Une carte de plugin conserve son identité et ses données même si le plugin est absent.
function isPluginWidgetCardValid(card) {
  if (typeof card.pluginId !== 'string' || card.pluginId.length === 0 || card.pluginId.length > 128) return false
  if (typeof card.widgetId !== 'string' || card.widgetId.length === 0 || card.widgetId.length > 128) return false
  if (card.pluginVersion !== undefined && typeof card.pluginVersion !== 'string') return false
  if (!isRecord(card.properties) || !isRecord(card.state)) return false
  if (card.bindings !== undefined && !isRecord(card.bindings)) return false
  for (const field of ['inputs', 'outputs']) {
    const bindings = card.bindings?.[field]
    if (bindings !== undefined && (!isRecord(bindings) || Object.values(bindings).some((value) => typeof value !== 'string'))) return false
  }
  if (card.minWidth !== undefined && (!Number.isFinite(card.minWidth) || card.minWidth < minimumModuleSize.width)) return false
  if (card.minHeight !== undefined && (!Number.isFinite(card.minHeight) || card.minHeight < minimumModuleSize.height)) return false
  if (card.minWidth !== undefined && card.width < card.minWidth) return false
  if (card.minHeight !== undefined && card.height < card.minHeight) return false
  return true
}

// Contrôle la géométrie et les liens de présentation avant tout remplacement du document courant.
function validatePresentation(project, presentation) {
  if (!isRecord(presentation) || !Array.isArray(presentation.cards)) throw workspaceError('Invalid workspace presentation.')
  const camera = presentation.camera
  if (!isRecord(camera) || !['x', 'y', 'zoomLevel'].every((key) => Number.isFinite(camera[key])) || camera.zoomLevel > 2 || !Number.isFinite(2 ** camera.zoomLevel) || 2 ** camera.zoomLevel === 0) {
    throw workspaceError('Invalid canvas position or zoom.')
  }
  const modules = new Map(project.modules.map((module) => [module.id, module]))
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const ids = new Set()
  for (const card of presentation.cards) {
    if (!isRecord(card) || !isId(card.id) || ids.has(card.id) || !Object.hasOwn(moduleTypes, card.type) || typeof card.name !== 'string' || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(card[key])) || card.width < minimumModuleSize.width || card.height < minimumModuleSize.height) {
      throw workspaceError('Invalid card data or geometry.')
    }
    const linkedModule = moduleCardTypes.includes(card.type) ? modules.get(card.id) : null
    if (moduleCardTypes.includes(card.type)
      ? !linkedModule || linkedModule.name !== card.name || linkedModule.kind !== (card.type === 'class' ? moduleKinds.class : moduleKinds.module)
      : card.type === 'pluginWidget'
        ? !isPluginWidgetCardValid(card)
      : card.type === 'screen'
        ? !modules.has(card.id) || !modules.get(card.id).screen || !Number.isInteger(card.screenWidth) || !Number.isInteger(card.screenHeight) || card.screenWidth < 1 || card.screenHeight < 1 || card.screenWidth > screenLimits.maximumDimension || card.screenHeight > screenLimits.maximumDimension || (card.screenScale !== undefined && (!Number.isFinite(card.screenScale) || card.screenScale < 0.25 || card.screenScale > 4))
        : card.type === 'gauge'
          ? !modules.has(card.id) || !modules.get(card.id).gauge
          : card.type === 'progress'
            ? !modules.has(card.id) || !modules.get(card.id).progress
            : card.type === 'barChart'
              ? !modules.has(card.id) || !modules.get(card.id).barChart
              : card.type === 'xyPlot'
                ? !modules.has(card.id) || !modules.get(card.id).xyPlot
              : card.type === 'oscilloscope'
                ? !modules.has(card.id) || !modules.get(card.id).oscilloscope
              : card.type === 'heatmap'
                ? !modules.has(card.id) || !modules.get(card.id).heatmap
                : card.type === 'toggleButton' || card.type === 'holdButton'
                  ? !modules.has(card.id) || !modules.get(card.id).inputButton || !Number.isInteger(modules.get(card.id).inputButton.index) || modules.get(card.id).inputButton.mode !== (card.type === 'holdButton' ? 'hold' : 'toggle') || (card.pressed !== undefined && typeof card.pressed !== 'boolean')
                  : card.type === 'numberInput' || card.type === 'floatInput' || card.type === 'stringInput'
                    ? !modules.has(card.id) || !modules.get(card.id).inputNumber || (() => {
                      const valueType = modules.get(card.id).inputNumber.valueType ?? 'int'
                      const expectedType = card.type === 'floatInput' ? 'float' : card.type === 'stringInput' ? 'string' : 'int'
                      if (valueType !== expectedType) return true
                      if (valueType === 'string') return card.value !== undefined && typeof card.value !== 'string'
                      if (valueType === 'float') return card.value !== undefined && (!Number.isFinite(card.value) || Math.abs(card.value) > 3.4028234663852886e38)
                      return card.value !== undefined && (!Number.isInteger(card.value) || card.value < -2147483648 || card.value > 2147483647)
                    })()
                  : card.type === 'rgbPicker' || card.type === 'rgbaPicker'
                    ? !modules.has(card.id) || !modules.get(card.id).colorPicker || (() => {
                      const channels = card.type === 'rgbaPicker' ? 4 : 3
                      if (modules.get(card.id).colorPicker.channels !== channels) return true
                      return card.value !== undefined && !validColorValue(card.value, channels)
                    })()
                  : card.type === 'led'
                  ? !modules.has(card.id) || !modules.get(card.id).led
                  : card.type === 'rgbLed'
                    ? !modules.has(card.id) || !modules.get(card.id).rgbLed
                    : modules.has(card.id) || (card.type === 'comment' && typeof card.text !== 'string') || (card.type === 'image' && !isImageCardValid(card))) {
      throw workspaceError('Cards do not match the logical project.')
    }
    if (!Array.isArray(card.expandedNodeIds) || new Set(card.expandedNodeIds).size !== card.expandedNodeIds.length || card.expandedNodeIds.some((id) => !isId(id) || nodes.get(id)?.moduleId !== card.id || !logicalCardTypes.includes(card.type))) {
      throw workspaceError('Invalid expanded node data.')
    }
    if (card.hidden !== undefined && typeof card.hidden !== 'boolean') throw workspaceError('Invalid card visibility.')
    if (card.locked !== undefined && typeof card.locked !== 'boolean') throw workspaceError('Invalid card lock.')
    if (card.emoji !== undefined && (typeof card.emoji !== 'string' || card.emoji.length > 16)) throw workspaceError('Invalid card emoji.')
    if (card.screenView !== undefined && !screenViews.includes(card.screenView)) throw workspaceError('Invalid screen view.')
    if (card.gaugeView !== undefined && !gaugeViews.includes(card.gaugeView)) throw workspaceError('Invalid gauge view.')
    if (card.progressView !== undefined && !progressViews.includes(card.progressView)) throw workspaceError('Invalid progress view.')
    if (card.barChartView !== undefined && !barChartViews.includes(card.barChartView)) throw workspaceError('Invalid bar chart view.')
    if (card.xyPlotView !== undefined && !xyPlotViews.includes(card.xyPlotView)) throw workspaceError('Invalid XY plot view.')
    if (card.oscilloscopeView !== undefined && !oscilloscopeViews.includes(card.oscilloscopeView)) throw workspaceError('Invalid oscilloscope view.')
    if (card.heatmapView !== undefined && !heatmapViews.includes(card.heatmapView)) throw workspaceError('Invalid heatmap view.')
    if (card.ledView !== undefined && !ledViews.includes(card.ledView)) throw workspaceError('Invalid LED view.')
    if (card.rgbLedView !== undefined && !rgbLedViews.includes(card.rgbLedView)) throw workspaceError('Invalid RGB LED view.')
    if (card.inputButtonView !== undefined && !inputButtonViews.includes(card.inputButtonView)) throw workspaceError('Invalid input button view.')
    if (card.inputNumberView !== undefined && !inputNumberViews.includes(card.inputNumberView)) throw workspaceError('Invalid input number view.')
    if (card.colorPickerView !== undefined && !colorPickerViews.includes(card.colorPickerView)) throw workspaceError('Invalid color picker view.')
    if (card.pluginWidgetView !== undefined && !pluginWidgetViews.includes(card.pluginWidgetView)) throw workspaceError('Invalid plugin widget view.')
    ids.add(card.id)
  }
  if (project.modules.some((module) => !ids.has(module.id))) throw workspaceError('A module is missing its visual card.')
  const selected = presentation.selected
  if (selected !== null && (!isRecord(selected) || (selected.kind === 'module' ? !modules.has(selected.id) : selected.kind === 'node' ? !nodes.has(selected.id) : selected.kind !== 'pluginWidget' || !presentation.cards.some((card) => card.id === selected.id && card.type === 'pluginWidget')))) {
    throw workspaceError('Invalid workspace selection.')
  }
}

// N'écrit l'emoji ou les drapeaux de carte que lorsqu'ils sont définis, pour garder les fichiers habituels inchangés.
function exportableCard(card, nodes) {
  // `screenScale` n'est plus produit : l'écran se dimensionne avec la carte, mais reste toléré à la relecture.
  const { hidden, locked, emoji, screenView, gaugeView, progressView, barChartView, xyPlotView, oscilloscopeView, heatmapView, ledView, rgbLedView, inputButtonView, inputNumberView, colorPickerView, pluginWidgetView, screenScale, imageRef, ...rest } = card
  return { ...rest, ...(typeof imageRef === 'string' && imageRef.length > 0 ? { imageRef } : {}), ...(hidden ? { hidden: true } : {}), ...(locked ? { locked: true } : {}), ...(emoji ? { emoji } : {}), ...(screenView && screenView !== 'screen' ? { screenView } : {}), ...(gaugeView && gaugeView !== 'gauge' ? { gaugeView } : {}), ...(progressView && progressView !== 'progress' ? { progressView } : {}), ...(barChartView && barChartView !== 'barChart' ? { barChartView } : {}), ...(xyPlotView && xyPlotView !== 'xyPlot' ? { xyPlotView } : {}), ...(oscilloscopeView && oscilloscopeView !== 'oscilloscope' ? { oscilloscopeView } : {}), ...(heatmapView && heatmapView !== 'heatmap' ? { heatmapView } : {}), ...(ledView && ledView !== 'led' ? { ledView } : {}), ...(rgbLedView && rgbLedView !== 'rgbLed' ? { rgbLedView } : {}), ...(inputButtonView && inputButtonView !== 'button' ? { inputButtonView } : {}), ...(inputNumberView && inputNumberView !== 'input' ? { inputNumberView } : {}), ...(colorPickerView && colorPickerView !== 'picker' ? { colorPickerView } : {}), ...(pluginWidgetView && pluginWidgetView !== 'widget' ? { pluginWidgetView } : {}), expandedNodeIds: (card.expandedNodeIds ?? []).filter((id) => nodes.get(id)?.moduleId === card.id) }
}

// Contrôle aussi le snapshot de départ d'un exercice, avec les mêmes règles que le document courant.
function validateExerciseStarter(exercise) {
  if (!exercise?.starter) return
  validateProject(exercise.starter.project)
  validatePresentation(exercise.starter.project, exercise.starter.presentation)
}

// Produit le même instantané JSON versionné pour les extensions .sp3 et .json.
export function serializeWorkspace(project, cards, camera, selected = null, exercise = null, dashboard = null) {
  validateProject(project)
  if (exercise !== null) {
    validateExercise(exercise)
    validateExerciseStarter(exercise)
  }
  if (dashboard !== null && dashboard !== undefined) assertDashboardConfig(dashboard)
  // Les identifiants de nœuds supprimés ne doivent pas survivre dans l'état de pliage exporté.
  const nodes = new Map(project.nodes.map((node) => [node.id, node]))
  const presentation = {
    cards: cards.map((card) => exportableCard(card, nodes)),
    camera, selected,
  }
  validatePresentation(project, presentation)
  const payload = { application: 'Sapphire 3', workspaceVersion: workspaceFileVersion, project, presentation, ...(exercise === null ? {} : { exercise }), ...(dashboard === null || dashboard === undefined ? {} : { dashboard }) }
  const result = serializeSource(payload)
  if (result.json === null) throw workspaceError('The workspace contains data that cannot be exported as JSON.', 'WORKSPACE_NOT_SERIALIZABLE')
  return result.json
}

// Lit un instantané complet ou une source logique JSON v1 avec disposition initiale explicite.
export function deserializeWorkspace(text) {
  let data
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw workspaceError('The selected file is not valid JSON.', 'WORKSPACE_JSON_INVALID')
  }
  if (!isRecord(data)) throw workspaceError('The selected file must contain a workspace or logical project.')
  if (Object.hasOwn(data, 'workspaceVersion')) {
    if (data.application !== 'Sapphire 3' || !Number.isInteger(data.workspaceVersion) || data.workspaceVersion < 1 || data.workspaceVersion > workspaceFileVersion) throw workspaceError('Unsupported Sapphire workspace version.', 'WORKSPACE_VERSION_UNSUPPORTED')
    const migrated = migrateWorkspace(data)
    validateProject(migrated.project)
    validatePresentation(migrated.project, migrated.presentation)
    if (migrated.exercise !== undefined) {
      validateExercise(migrated.exercise)
      validateExerciseStarter(migrated.exercise)
    }
    if (migrated.dashboard !== undefined) assertDashboardConfig(migrated.dashboard)
    if (serializeSource(migrated).json === null) throw workspaceError('The file contains unsupported JSON values.', 'WORKSPACE_NOT_SERIALIZABLE')
    return migrated
  }
  validateProject(data)
  const definition = moduleTypes.module
  const cards = data.modules.map((module, position) => module.screen
    ? { id: module.id, type: 'screen', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.screen.width, height: moduleTypes.screen.height, screenWidth: module.screen.width, screenHeight: module.screen.height, expandedNodeIds: [] }
    : module.gauge
      ? { id: module.id, type: 'gauge', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.gauge.width, height: moduleTypes.gauge.height, expandedNodeIds: [] }
      : module.progress
        ? { id: module.id, type: 'progress', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.progress.width, height: moduleTypes.progress.height, expandedNodeIds: [] }
        : module.heatmap
          ? { id: module.id, type: 'heatmap', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.heatmap.width, height: moduleTypes.heatmap.height, expandedNodeIds: [] }
        : module.barChart
          ? { id: module.id, type: 'barChart', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.barChart.width, height: moduleTypes.barChart.height, expandedNodeIds: [] }
          : module.xyPlot
            ? { id: module.id, type: 'xyPlot', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.xyPlot.width, height: moduleTypes.xyPlot.height, expandedNodeIds: [] }
            : module.oscilloscope
              ? { id: module.id, type: 'oscilloscope', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.oscilloscope.width, height: moduleTypes.oscilloscope.height, expandedNodeIds: [] }
            : module.inputButton
              ? { id: module.id, type: module.inputButton.mode === 'hold' ? 'holdButton' : 'toggleButton', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes[module.inputButton.mode === 'hold' ? 'holdButton' : 'toggleButton'].width, height: moduleTypes[module.inputButton.mode === 'hold' ? 'holdButton' : 'toggleButton'].height, expandedNodeIds: [], pressed: false }
            : module.inputNumber
              ? (() => {
                const valueType = module.inputNumber.valueType ?? 'int'
                const type = valueType === 'float' ? 'floatInput' : valueType === 'string' ? 'stringInput' : 'numberInput'
                return { id: module.id, type, name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes[type].width, height: moduleTypes[type].height, expandedNodeIds: [], value: valueType === 'string' ? '' : 0 }
              })()
            : module.colorPicker
              ? (() => {
                const channels = module.colorPicker.channels === 4 ? 4 : 3
                const type = channels === 4 ? 'rgbaPicker' : 'rgbPicker'
                return { id: module.id, type, name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes[type].width, height: moduleTypes[type].height, expandedNodeIds: [], value: colorPickerDefaults(channels) }
              })()
            : module.led
            ? { id: module.id, type: 'led', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.led.width, height: moduleTypes.led.height, expandedNodeIds: [] }
            : module.rgbLed
              ? { id: module.id, type: 'rgbLed', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: moduleTypes.rgbLed.width, height: moduleTypes.rgbLed.height, expandedNodeIds: [] }
              : { id: module.id, type: 'module', name: module.name, x: (position % 3) * 380, y: Math.floor(position / 3) * 280, width: definition.width, height: definition.height, expandedNodeIds: [] })
  return JSON.parse(serializeWorkspace(data, cards, { x: 0, y: 0, zoomLevel: 0 }))
}

// Produit un document vierge explicite pour repartir d'un workspace neuf, sans fichier associé.
export function emptyWorkspace() {
  return { project: createProject('workspace'), presentation: { cards: [], camera: { x: 0, y: 0, zoomLevel: 0 }, selected: null } }
}
