import { moduleCardTypes, moduleTypes } from './moduleTypes.js'

const wiki = 'https://github.com/lalBi94/Sapphire3/wiki'

// Pages en ligne vérifiées pour chaque carte ; l'ancre reste facultative quand la page ne détaille pas le sujet.
const cardPages = Object.freeze({
  module: `${wiki}/Interface#cartes`,
  class: `${wiki}/Langage#classes`,
  screen: `${wiki}/Widgets#screen`,
  gauge: `${wiki}/Widgets#gauge`,
  progress: `${wiki}/Widgets#progressbar`,
  barChart: `${wiki}/Widgets#barchart`,
  xyPlot: `${wiki}/Widgets#xy-plot`,
  oscilloscope: `${wiki}/Widgets#oscilloscope`,
  heatmap: `${wiki}/Widgets#heatmap`,
  led: `${wiki}/Widgets#led`,
  rgbLed: `${wiki}/Widgets#rgb-led`,
  toggleButton: `${wiki}/Widgets#boutons-dentrée`,
  holdButton: `${wiki}/Widgets#boutons-dentrée`,
  numberInput: `${wiki}/Widgets#entrée-numérique`,
  floatInput: `${wiki}/Widgets#entrée-numérique`,
  stringInput: `${wiki}/Widgets#entrée-numérique`,
  rgbPicker: `${wiki}/Widgets`,
  rgbaPicker: `${wiki}/Widgets`,
  comment: `${wiki}/Concepts#ce-qui-reste-hors-du-modèle-logique`,
  image: `${wiki}/Concepts#ce-qui-reste-hors-du-modèle-logique`,
})

// Choisit le résumé local selon la famille de carte, sans dupliquer la documentation en ligne.
function cardSummaryKey(type) {
  if (type === 'comment' || type === 'image') return 'help.summary.annotation'
  if (!moduleCardTypes.includes(type)) return 'help.summary.widget'
  return type === 'class' ? 'help.summary.class' : 'help.summary.card'
}

// Décrit une carte : libellé déjà traduit, résumé local et page en ligne.
export function cardHelpTopic(type) {
  const definition = moduleTypes[type]
  return {
    titleKey: definition?.labelKey ?? 'card.module',
    summaryKey: cardSummaryKey(type),
    url: cardPages[type] ?? `${wiki}/Interface#cartes`,
  }
}

// Décrit le module ou la classe sélectionné dans le panneau de propriétés.
export function moduleHelpTopic(record) {
  return cardHelpTopic(record?.kind === 'class' ? 'class' : 'module')
}

// Décrit une opération ou une construction logique sélectionnée.
export function nodeHelpTopic(node) {
  const kind = node?.kind
  if (kind === 'MathCall' || kind === 'PrintStatement' || kind === 'ForEachStatement') return { summaryKey: 'help.summary.native', url: `${wiki}/Langage#opérations-natives` }
  if (kind === 'NewExpression' || kind === 'ThisExpression' || kind === 'MemberExpression') return { summaryKey: 'help.summary.class', url: `${wiki}/Langage#classes` }
  if (kind === 'LambdaExpression') return { summaryKey: 'help.summary.function', url: `${wiki}/Langage#lambdas-et-fermetures` }
  if (kind === 'TypeDeclaration') return { summaryKey: 'help.summary.type', url: `${wiki}/Langage#types` }
  if (kind === 'ArrayLiteral' || kind === 'ArrayCreation' || kind === 'ArrayAccess') return { summaryKey: 'help.summary.array', url: `${wiki}/Langage#types` }
  if (kind === 'Hole') return { summaryKey: 'help.summary.incomplete', url: `${wiki}/Langage#constructions` }
  if (kind === 'BinaryExpression' || kind === 'UnaryExpression' || kind === 'CastExpression' || kind === 'Literal' || kind === 'Reference' || kind === 'CallExpression') return { summaryKey: 'help.summary.expression', url: `${wiki}/Langage#règles-dexpression` }
  if (kind === 'FunctionDeclaration') return { summaryKey: 'help.summary.function', url: `${wiki}/Langage#constructions` }
  if (kind === 'VariableDeclaration' || kind === 'ConstantDeclaration' || kind === 'Parameter') return { summaryKey: 'help.summary.declaration', url: `${wiki}/Langage#constructions` }
  return { summaryKey: 'help.summary.control', url: `${wiki}/Langage#constructions` }
}
