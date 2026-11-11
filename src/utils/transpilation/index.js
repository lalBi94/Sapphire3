import { analyzeProgram } from '../logic/analysis.js'
import { hasBlockingDiagnostics } from '../logic/diagnostics.js'
import { generateJavaScript } from './javascript.js'
import { generatePython } from './python.js'

const backends = Object.freeze({ javascript: generateJavaScript, python: generatePython })
export { transpilationLanguages } from './languages.js'

// Un écran SP3 dépend de l'interface et ne possède aucune cible portable.
function hasScreen(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.screen)
}

// Une jauge SP3 est un widget d'interface : même refus explicite qu'un écran.
function hasGauge(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.gauge)
}

// Produit le refus stable opposé à toute transpilation contenant une jauge.
function gaugeFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_GAUGE_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_GAUGE_UNSUPPORTED', severity: 'error', message: 'Une jauge SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Une LED SP3 est un widget d'interface : même refus explicite qu'une jauge.
function hasLed(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.led)
}

// Une LED RVB SP3 est aussi un widget d'interface, avec trois canaux.
function hasRgbLed(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.rgbLed)
}

// Une barre de progression SP3 est un widget d'interface : même refus explicite qu'une jauge.
function hasProgress(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.progress)
}

// Un graphique à barres SP3 est un widget d'interface : même refus explicite qu'une jauge.
function hasBarChart(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.barChart)
}

// Un traceur XY SP3 dépend de Mafs : même refus explicite qu'une jauge.
function hasXyPlot(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.xyPlot)
}

// Un oscilloscope SP3 dépend d'uPlot : même refus explicite qu'un traceur XY.
function hasOscilloscope(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.oscilloscope)
}

// Produit le refus stable opposé à toute transpilation contenant un oscilloscope.
function oscilloscopeFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_OSCILLOSCOPE_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_OSCILLOSCOPE_UNSUPPORTED', severity: 'error', message: 'Un oscilloscope SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit le refus stable opposé à toute transpilation contenant un traceur XY.
function xyPlotFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_XY_PLOT_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_XY_PLOT_UNSUPPORTED', severity: 'error', message: 'Un traceur XY SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit le refus stable opposé à toute transpilation contenant un graphique à barres.
function barChartFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_BAR_CHART_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_BAR_CHART_UNSUPPORTED', severity: 'error', message: 'Un graphique à barres SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Signale qu'une grille thermique n'a pas de rendu portable dans les cibles texte.
function heatmapFailure(source, target, analysis) {
  const code = 'TRANSPILE_HEATMAP_UNSUPPORTED'
  return { ok: false, target, code, diagnostics: [{ code, severity: 'error', message: 'Une Heatmap SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }], analysis }
}

// Produit le refus stable opposé à toute transpilation contenant une barre de progression.
function progressFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_PROGRESS_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_PROGRESS_UNSUPPORTED', severity: 'error', message: 'Une barre de progression SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit le refus stable opposé à toute transpilation contenant une LED.
function ledFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_LED_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_LED_UNSUPPORTED', severity: 'error', message: 'Une LED SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit le refus stable opposé à toute transpilation contenant une LED RVB.
function rgbLedFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_RGB_LED_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_RGB_LED_UNSUPPORTED', severity: 'error', message: 'Une LED RVB SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit le refus stable opposé à toute transpilation contenant un écran.
function screenFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_SCREEN_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_SCREEN_UNSUPPORTED', severity: 'error', message: 'Un écran SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Un bouton d'entrée dépend de l'interface : même refus explicite qu'une LED.
function hasInputButton(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.inputButton)
}

// Produit le refus stable opposé à toute transpilation contenant un bouton d'entrée.
function inputButtonFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_INPUT_BUTTON_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_INPUT_BUTTON_UNSUPPORTED', severity: 'error', message: 'Un bouton d’entrée SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Une entrée numérique dépend aussi de l'interface : même refus explicite.
function hasInputNumber(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.inputNumber)
}

// Une entrée texte dépend de l'interface : refus spécifique.
function hasInputString(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.inputNumber?.valueType === 'string')
}

// Produit le refus stable opposé à toute transpilation contenant une entrée texte.
function inputStringFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_INPUT_STRING_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_INPUT_STRING_UNSUPPORTED', severity: 'error', message: 'Une entrée texte SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit le refus stable opposé à toute transpilation contenant une entrée numérique.
function inputNumberFailure(source, target, analysis = null) {
  return {
    ok: false,
    target,
    code: 'TRANSPILE_INPUT_NUMBER_UNSUPPORTED',
    diagnostics: [{ code: 'TRANSPILE_INPUT_NUMBER_UNSUPPORTED', severity: 'error', message: 'Une entrée numérique SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Un sélecteur de couleur dépend de l'interface : refus explicite selon ses canaux.
function hasRgbaPicker(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.colorPicker?.channels === 4)
}

// Un sélecteur RGB reste distinct du sélecteur RGBA.
function hasRgbPicker(source) {
  return Array.isArray(source?.modules) && source.modules.some((module) => module?.colorPicker && module.colorPicker.channels !== 4)
}

// Produit le refus stable opposé à toute transpilation contenant un sélecteur de couleur.
function colorPickerFailure(source, target, analysis = null, channels = 3) {
  const code = channels === 4 ? 'TRANSPILE_RGBA_PICKER_UNSUPPORTED' : 'TRANSPILE_RGB_PICKER_UNSUPPORTED'
  return {
    ok: false,
    target,
    code,
    diagnostics: [{ code, severity: 'error', message: 'Un sélecteur de couleur SP3 rend le programme non transpilable.', location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }],
    ...(analysis ? { analysis } : {}),
  }
}

// Produit un extrait de consultation avec les mêmes noms et règles que le fichier complet.
export function transpileSelection(source, selection, { target = 'javascript', analysis = analyzeProgram(source) } = {}) {
  if (!Object.hasOwn(backends, target)) return { ok: false, code: '', diagnostics: [{ code: 'TRANSPILE_TARGET_UNSUPPORTED' }] }
  if (hasScreen(source)) return screenFailure(source, target, analysis)
  if (hasGauge(source)) return gaugeFailure(source, target, analysis)
  if (hasProgress(source)) return progressFailure(source, target, analysis)
  if (hasBarChart(source)) return barChartFailure(source, target, analysis)
  if (hasXyPlot(source)) return xyPlotFailure(source, target, analysis)
  if (hasOscilloscope(source)) return oscilloscopeFailure(source, target, analysis)
  if (Array.isArray(source?.modules) && source.modules.some((module) => module?.heatmap)) return heatmapFailure(source, target, analysis)
  if (hasLed(source)) return ledFailure(source, target, analysis)
  if (hasRgbLed(source)) return rgbLedFailure(source, target, analysis)
  if (hasRgbaPicker(source)) return colorPickerFailure(source, target, analysis, 4)
  if (hasRgbPicker(source)) return colorPickerFailure(source, target, analysis, 3)
  if (hasInputString(source)) return inputStringFailure(source, target, analysis)
  if (hasInputNumber(source)) return inputNumberFailure(source, target, analysis)
  if (hasInputButton(source)) return inputButtonFailure(source, target, analysis)
  return backends[target](analysis, { selection })
}

// Transpile un programme Sapphire vers une cible enregistrée sans coupler l'AST à cette cible.
export function transpileProgram(source, options = {}) {
  const target = options.target ?? 'javascript'
  const analysis = options.analysis ?? analyzeProgram(source, { onProgress: options.onProgress })
  const backend = Object.hasOwn(backends, target) ? backends[target] : null
  if (!backend) {
    return { ok: false, target, code: '', diagnostics: [{ code: 'TRANSPILE_TARGET_UNSUPPORTED', severity: 'error', message: `Cible non prise en charge : ${target}.`, location: { projectId: source?.id ?? null, moduleId: null, nodeId: null, field: null } }], analysis }
  }
  if (hasScreen(source)) return screenFailure(source, target, analysis)
  if (hasGauge(source)) return gaugeFailure(source, target, analysis)
  if (hasProgress(source)) return progressFailure(source, target, analysis)
  if (hasBarChart(source)) return barChartFailure(source, target, analysis)
  if (hasXyPlot(source)) return xyPlotFailure(source, target, analysis)
  if (hasOscilloscope(source)) return oscilloscopeFailure(source, target, analysis)
  if (Array.isArray(source?.modules) && source.modules.some((module) => module?.heatmap)) return heatmapFailure(source, target, analysis)
  if (hasLed(source)) return ledFailure(source, target, analysis)
  if (hasRgbLed(source)) return rgbLedFailure(source, target, analysis)
  if (hasRgbaPicker(source)) return colorPickerFailure(source, target, analysis, 4)
  if (hasRgbPicker(source)) return colorPickerFailure(source, target, analysis, 3)
  if (hasInputString(source)) return inputStringFailure(source, target, analysis)
  if (hasInputNumber(source)) return inputNumberFailure(source, target, analysis)
  if (hasInputButton(source)) return inputButtonFailure(source, target, analysis)
  if (hasBlockingDiagnostics(analysis.diagnostics)) return { ok: false, target, code: '', diagnostics: analysis.diagnostics, analysis }
  options.onProgress?.({ phase: 'generate', target, current: 1, total: 1 })
  const generated = backend(analysis)
  const diagnostics = [...analysis.diagnostics, ...generated.diagnostics]
  return { ok: !hasBlockingDiagnostics(diagnostics), target, code: generated.code, diagnostics, analysis }
}

// Retourne les cibles effectivement installées pour alimenter l'interface sans dupliquer la liste.
export function getTranspilationTargets() {
  return Object.keys(backends)
}
