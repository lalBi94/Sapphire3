// Retours locaux de la vitrine : inspection illustrative et sélection de captures réelles.
const feedback = document.querySelector('[data-feedback-status]')
let feedbackTimer

// Retourne un texte traduit, avec un repli local si le module de langues est absent.
function text(key, fallback) {
  return window.SiteI18n ? window.SiteI18n.t(key) : fallback
}

// Confirme une interaction sans déplacer le focus ni bloquer la navigation.
function announce(message) {
  clearTimeout(feedbackTimer)
  feedback.textContent = message
  feedback.classList.add('is-visible')
  feedbackTimer = setTimeout(() => feedback.classList.remove('is-visible'), 3500)
}

// Duplique la bande de preuves pour une boucle continue, sans doublon vocal.
const proofTrack = document.querySelector('[data-proof-track]')
const proofGroup = proofTrack?.querySelector('.proof-strip__group')
if (proofTrack && proofGroup && !proofTrack.dataset.cloned) {
  const clone = proofGroup.cloneNode(true)
  clone.setAttribute('aria-hidden', 'true')
  proofTrack.append(clone)
  proofTrack.dataset.cloned = 'true'
}

const nodes = {
  function: {
    typeKey: 'inspect.type.function',
    typeFallback: 'FUNCTION',
    textKey: 'inspect.function',
    textFallback: 'A typed function. Its parameters, body and return are part of the tree.',
    feedbackKey: 'feedback.node.function',
    feedbackFallback: 'fibonacci selected — int → int function.',
  },
  variable: {
    typeKey: 'inspect.type.variable',
    typeFallback: 'VARIABLE',
    textKey: 'inspect.variable',
    textFallback: 'A stored value, an explicit type. result receives the return of fibonacci(10).',
    feedbackKey: 'feedback.node.variable',
    feedbackFallback: 'result selected — int variable.',
  },
  output: {
    typeKey: 'inspect.type.native',
    typeFallback: 'NATIVE / PRINT',
    textKey: 'inspect.output',
    textFallback: 'A native SP3 statement prints the value of result. The output comes from the program, not the drawing.',
    feedbackKey: 'feedback.node.output',
    feedbackFallback: 'Print selected — output statement.',
  },
}

const previews = {
  canvas: {
    file: 'overview.png',
    altKey: 'preview.canvas.alt',
    altFallback: 'Sapphire 3 canvas with the Library and App modules linked by an arrow.',
    captionKey: 'preview.canvas.caption',
    captionFallback: 'Two modules, one dependency, one note. The program in one view.',
  },
  read: {
    file: 'module-library.png',
    altKey: 'preview.read.alt',
    altFallback: 'Library Module card with the square function, its input and its return.',
    captionKey: 'preview.read.caption',
    captionFallback: 'A Module card, its inputs, its steps and its return. The code stays readable.',
  },
  export: {
    file: 'transpile.png',
    altKey: 'preview.export.alt',
    altFallback: 'Transpilation panel with the generated JavaScript code.',
    captionKey: 'preview.export.caption',
    captionFallback: 'The same model, another representation. JavaScript and Python export on the supported subset.',
  },
}

let activeNode = 'function'
let activePreview = 'canvas'

// Affiche l'inspection du bloc courant et confirme la sélection.
function selectNode(name) {
  const node = nodes[name]
  if (!node) return
  activeNode = name
  for (const button of document.querySelectorAll('[data-node]')) button.setAttribute('aria-pressed', String(button.dataset.node === name))
  document.querySelector('[data-inspect-type]').textContent = text(node.typeKey, node.typeFallback)
  document.querySelector('[data-inspect-text]').textContent = text(node.textKey, node.textFallback)
  announce(text(node.feedbackKey, node.feedbackFallback))
}

// Affiche la capture courante et confirme la sélection.
function selectPreview(name) {
  const preview = previews[name]
  if (!preview) return
  activePreview = name
  for (const button of document.querySelectorAll('[data-preview]')) button.setAttribute('aria-pressed', String(button.dataset.preview === name))
  const image = document.querySelector('[data-preview-image]')
  image.src = `assets/shots/${preview.file}`
  image.alt = text(preview.altKey, preview.altFallback)
  document.querySelector('[data-preview-caption]').textContent = text(preview.captionKey, preview.captionFallback)
  announce(text(preview.captionKey, preview.captionFallback))
}

for (const button of document.querySelectorAll('[data-node]')) {
  button.addEventListener('click', () => selectNode(button.dataset.node))
}

for (const button of document.querySelectorAll('[data-preview]')) {
  button.addEventListener('click', () => selectPreview(button.dataset.preview))
}

// Réapplique les textes des aperçus sans relancer de retour vocal après un changement de langue.
function refreshTexts() {
  const node = nodes[activeNode]
  document.querySelector('[data-inspect-type]').textContent = text(node.typeKey, node.typeFallback)
  document.querySelector('[data-inspect-text]').textContent = text(node.textKey, node.textFallback)
  const preview = previews[activePreview]
  document.querySelector('[data-preview-image]').alt = text(preview.altKey, preview.altFallback)
  document.querySelector('[data-preview-caption]').textContent = text(preview.captionKey, preview.captionFallback)
}

document.addEventListener('site-language-change', refreshTexts)
refreshTexts()

for (const link of document.querySelectorAll('[data-feedback-key]')) {
  link.addEventListener('click', () => announce(text(link.dataset.feedbackKey, '')))
}

// Ferme les choix de téléchargement concurrents et ceux ouverts hors du groupe.
const downloadGroups = [...document.querySelectorAll('.download')]
for (const group of downloadGroups) {
  group.addEventListener('toggle', () => {
    if (!group.open) return
    for (const other of downloadGroups) if (other !== group) other.open = false
  })
}
document.addEventListener('click', (event) => {
  if (event.target.closest('.download')) return
  for (const group of downloadGroups) group.open = false
})
