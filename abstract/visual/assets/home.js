// Retours locaux de la vitrine : inspection illustrative et sélection de captures réelles.
const feedback = document.querySelector('[data-feedback-status]')
let feedbackTimer

// Confirme une interaction sans déplacer le focus ni bloquer la navigation.
function announce(message) {
  clearTimeout(feedbackTimer)
  feedback.textContent = message
  feedback.classList.add('is-visible')
  feedbackTimer = setTimeout(() => feedback.classList.remove('is-visible'), 3500)
}

const nodes = {
  function: { type: 'FUNCTION', text: 'Une fonction typée. Ses paramètres, son corps et son retour font partie de l’arbre.', feedback: 'fibonacci sélectionnée — fonction int → int.' },
  variable: { type: 'VARIABLE', text: 'Une valeur stockée, un type explicite. result reçoit le retour de fibonacci(10).', feedback: 'result sélectionnée — variable de type int.' },
  output: { type: 'NATIVE / PRINT', text: 'Une instruction native SP3 affiche la valeur de result. La sortie vient du programme, pas du dessin.', feedback: 'Print sélectionné — instruction de sortie.' },
}

for (const button of document.querySelectorAll('[data-node]')) {
  button.addEventListener('click', () => {
    const node = nodes[button.dataset.node]
    for (const other of document.querySelectorAll('[data-node]')) other.setAttribute('aria-pressed', String(other === button))
    document.querySelector('[data-inspect-type]').textContent = node.type
    document.querySelector('[data-inspect-text]').textContent = node.text
    announce(node.feedback)
  })
}

const previews = {
  canvas: { file: 'overview.png', alt: 'Canvas Sapphire 3 avec les modules Library et App reliés par une flèche.', caption: 'Deux modules, une dépendance, une note. Le programme en une vue.' },
  read: { file: 'module-library.png', alt: 'Carte Module Library avec la fonction square, son entrée et son retour.', caption: 'Une carte Module, ses entrées, ses étapes et son retour. Le code reste lisible.' },
  export: { file: 'transpile.png', alt: 'Panneau de transpilation avec le code JavaScript généré.', caption: 'Le même modèle, une autre représentation. Export JavaScript et Python sur le sous-ensemble pris en charge.' },
}

for (const button of document.querySelectorAll('[data-preview]')) {
  button.addEventListener('click', () => {
    const preview = previews[button.dataset.preview]
    for (const other of document.querySelectorAll('[data-preview]')) other.setAttribute('aria-pressed', String(other === button))
    const image = document.querySelector('[data-preview-image]')
    image.src = `assets/shots/${preview.file}`
    image.alt = preview.alt
    document.querySelector('[data-preview-caption]').textContent = preview.caption
    announce(preview.caption)
  })
}

for (const link of document.querySelectorAll('[data-feedback]')) {
  link.addEventListener('click', () => announce(link.dataset.feedback))
}
