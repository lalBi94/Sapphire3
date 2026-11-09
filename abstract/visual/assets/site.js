// Interactions du site de présentation : annotations, progression, sommaire, copie et agrandissement.
(function () {
  'use strict'

  var SHOTS = window.SHOTS || {}
  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  document.documentElement.classList.add('js')

  // Sélectionne un élément dans le document ou dans un conteneur précis.
  function select(selector, root) { return (root || document).querySelector(selector) }
  // Retourne les éléments correspondants sous forme de tableau.
  function selectAll(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)) }

  // Rend les tableaux défilables au clavier sur les écrans étroits.
  selectAll('table').forEach(function (table) { table.tabIndex = 0 })

  // Retrouve un rectangle d'annotation, sur la capture ou sur un nœud de l'arbre.
  function rectOf(scene, note) {
    var data = SHOTS[scene]
    if (!data) return null
    if (note.dataset.marker) return data.boxes[note.dataset.marker] || null
    if (note.dataset.node) return data.nodes[note.dataset.node] || null
    return null
  }

  // Marqueur note : chiffre posé au centre de la zone, avec son cadre de surbrillance.
  function attach(scene, frame, note, number) {
    var rect = rectOf(scene, note)
    if (!rect) {
      note.classList.add('is-missing')
      return
    }
    var ring = document.createElement('div')
    ring.className = 'ring'
    ring.style.left = rect.x + '%'
    ring.style.top = rect.y + '%'
    ring.style.width = rect.w + '%'
    ring.style.height = rect.h + '%'
    var marker = document.createElement('button')
    marker.type = 'button'
    marker.className = 'marker'
    marker.textContent = number
    marker.style.left = (rect.x + rect.w / 2) + '%'
    marker.style.top = (rect.y + rect.h / 2) + '%'
    marker.setAttribute('aria-label', 'Figer le repère ' + number)
    marker.setAttribute('aria-pressed', 'false')
    frame.appendChild(ring)
    frame.appendChild(marker)

    // Synchronise la note et la zone mise en évidence.
    function setActive(on) {
      ring.classList.toggle('is-active', on)
      marker.classList.toggle('is-active', on)
      note.classList.toggle('is-active', on)
    }

    note.addEventListener('mouseenter', function () { setActive(true) })
    note.addEventListener('mouseleave', function () { if (!note.classList.contains('is-pinned')) setActive(false) })
    note.addEventListener('focusin', function () { setActive(true) })
    note.addEventListener('focusout', function () { if (!note.classList.contains('is-pinned')) setActive(false) })
    // Conserve ou libère la surbrillance du repère choisi.
    function togglePin() {
      note.classList.toggle('is-pinned')
      setActive(note.classList.contains('is-pinned'))
      marker.setAttribute('aria-pressed', String(note.classList.contains('is-pinned')))
    }
    marker.addEventListener('click', function () {
      togglePin()
      note.scrollIntoView({ block: 'nearest' })
    })
    note.addEventListener('click', function (event) {
      if (!event.target.closest('a')) togglePin()
    })
    note.addEventListener('keydown', function (event) {
      if (event.target === note && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        togglePin()
      }
    })
  }

  Array.prototype.forEach.call(document.querySelectorAll('figure.shot'), function (figure) {
    var scene = figure.dataset.shot
    var frame = figure.querySelector('.shot-frame')
    var notes = figure.querySelectorAll('.notes li')
    if (!frame || !notes.length) return
    if (!SHOTS[scene]) frame.classList.add('no-data')
    Array.prototype.forEach.call(notes, function (note, index) {
      note.setAttribute('tabindex', '0')
      note.title = 'Survolez pour localiser sur la capture'
      attach(scene, frame, note, index + 1)
    })
  })

  // Notifications discrètes pour les actions du site.
  var toastStack = document.createElement('div')
  toastStack.className = 'toast-stack'
  toastStack.setAttribute('aria-live', 'polite')
  document.body.appendChild(toastStack)

  // Annonce le résultat d'une action sans interrompre la lecture.
  function toast(message) {
    var item = document.createElement('div')
    item.className = 'toast'
    item.textContent = message
    toastStack.appendChild(item)
    window.setTimeout(function () { item.remove() }, 2600)
  }

  // Barre de progression, en-tête compact et retour en haut.
  var header = select('.site-header')
  var progress = document.createElement('span')
  progress.className = 'reading-progress'
  progress.setAttribute('aria-hidden', 'true')
  if (header) header.appendChild(progress)

  var backToTop = document.createElement('button')
  backToTop.type = 'button'
  backToTop.className = 'back-to-top'
  backToTop.setAttribute('aria-label', 'Revenir en haut de la page')
  backToTop.textContent = '↑'
  document.body.appendChild(backToTop)
  backToTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }) })

  // Sommaire latéral des pages longues, alimenté par le sommaire existant.
  var rail = select('.doc-rail')
  var railItems = []
  var railProgress = null
  var railList = document.createElement('ol')

  if (rail) {
    var tocLinks = selectAll('.toc a')
    if (tocLinks.length) {
      var title = document.createElement('p')
      title.className = 'doc-rail__title'
      title.textContent = 'Sur cette page'
      rail.appendChild(title)

      var progressTrack = document.createElement('div')
      progressTrack.className = 'doc-rail__progress'
      railProgress = document.createElement('span')
      progressTrack.appendChild(railProgress)
      rail.appendChild(progressTrack)

      tocLinks.forEach(function (source) {
        var href = source.getAttribute('href')
        if (!href || href.charAt(0) !== '#') return
        var target = document.getElementById(href.slice(1))
        if (!target) return
        var item = document.createElement('li')
        var link = document.createElement('a')
        link.href = href
        link.textContent = source.textContent
        item.appendChild(link)
        railList.appendChild(item)
        railItems.push({ link: link, target: target })
      })
      rail.appendChild(railList)
    } else {
      rail.hidden = true
    }
  }

  // Indique la section actuellement atteinte dans le sommaire latéral.
  function updateRail() {
    if (!railItems.length) return
    var current = railItems[0]
    var sectionOffset = (header ? header.getBoundingClientRect().height : 96) + 48
    railItems.forEach(function (item) {
      if (item.target.getBoundingClientRect().top <= sectionOffset) current = item
    })
    railItems.forEach(function (item) {
      var active = item === current
      item.link.classList.toggle('is-active', active)
      if (active) item.link.setAttribute('aria-current', 'location')
      else item.link.removeAttribute('aria-current')
    })
  }

  // Actualise les indicateurs de lecture et les contrôles de navigation.
  function updateScroll() {
    var maximum = document.documentElement.scrollHeight - window.innerHeight
    var ratio = maximum > 0 ? Math.min(1, window.scrollY / maximum) : 0
    progress.style.width = (ratio * 100).toFixed(3) + '%'
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8)
    backToTop.classList.toggle('is-visible', window.scrollY > 620)
    backToTop.tabIndex = window.scrollY > 620 ? 0 : -1
    if (railProgress) railProgress.style.width = (ratio * 100).toFixed(3) + '%'
    updateRail()
  }

  window.addEventListener('scroll', updateScroll, { passive: true })
  window.addEventListener('resize', updateScroll)
  updateScroll()

  // Les apparitions sont gérées par motion.js ; sans bibliothèque, tout reste visible.

  // Copie des blocs de code, avec retour visible.
  selectAll('pre').forEach(function (pre) {
    if (!pre.querySelector('code')) return
    var button = document.createElement('button')
    button.type = 'button'
    button.className = 'code-copy'
    button.textContent = 'Copier'
    button.setAttribute('aria-label', 'Copier ce bloc de code')
    button.addEventListener('click', function () {
      var code = pre.querySelector('code')
      var text = code ? code.textContent : pre.textContent
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        toast('Copie indisponible dans ce navigateur')
        return
      }
      navigator.clipboard.writeText(text).then(function () {
        button.textContent = 'Copié'
        toast('Code copié dans le presse-papiers')
        window.setTimeout(function () { button.textContent = 'Copier' }, 2200)
      }).catch(function () {
        toast('Impossible de copier le code')
      })
    })
    pre.appendChild(button)
  })

  // Agrandissement des captures dans une boîte de dialogue native.
  var lightbox = document.createElement('dialog')
  lightbox.className = 'lightbox'
  lightbox.setAttribute('aria-label', 'Capture agrandie')
  var lightboxClose = document.createElement('button')
  lightboxClose.type = 'button'
  lightboxClose.className = 'lightbox__close'
  lightboxClose.setAttribute('aria-label', 'Fermer l’image agrandie')
  lightboxClose.textContent = '×'
  var lightboxImage = document.createElement('img')
  lightboxImage.alt = ''
  var lightboxCaption = document.createElement('p')
  lightboxCaption.className = 'lightbox__caption'
  lightbox.appendChild(lightboxClose)
  lightbox.appendChild(lightboxImage)
  lightbox.appendChild(lightboxCaption)
  document.body.appendChild(lightbox)

  var lightboxOpen = false
  // Présente la capture sélectionnée sans quitter la page.
  function openLightbox(image, caption) {
    lightboxImage.src = image.currentSrc || image.src
    lightboxImage.alt = image.alt || ''
    lightboxCaption.textContent = caption
    if (typeof lightbox.showModal === 'function') lightbox.showModal()
    else lightbox.setAttribute('open', '')
    lightboxOpen = true
  }

  // Ferme l'aperçu et laisse le dialogue restaurer le focus.
  function closeLightbox() {
    if (typeof lightbox.close === 'function') lightbox.close()
    else lightbox.removeAttribute('open')
    lightboxOpen = false
  }

  lightboxClose.addEventListener('click', closeLightbox)
  lightbox.addEventListener('click', function (event) {
    if (event.target === lightbox) closeLightbox()
  })
  lightbox.addEventListener('close', function () { lightboxOpen = false })

  selectAll('.shot-frame img').forEach(function (image) {
    image.setAttribute('tabindex', '0')
    image.setAttribute('role', 'button')
    if (!image.title) image.title = 'Cliquer pour agrandir'
    var figure = image.closest('figure')
    var captionNode = figure ? figure.querySelector('figcaption') : null
    var caption = captionNode ? captionNode.textContent.trim() : image.alt
    // Ouvre l'aperçu associé à cette capture.
    function open() { openLightbox(image, caption) }
    image.addEventListener('click', open)
    image.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open()
      }
    })
  })

  // Estimation de lecture affichée dans l'en-tête des pages documentaires.
  var readingLabel = select('[data-reading-time]')
  var main = select('main')
  if (readingLabel && main) {
    var words = main.innerText.trim().split(/\s+/).length
    var minutes = Math.max(1, Math.round(words / 220))
    readingLabel.textContent = '≈ ' + minutes + ' min de lecture'
  }

  // Évite de laisser une boîte de dialogue ouverte après un changement de page.
  window.addEventListener('pagehide', function () { if (lightboxOpen) closeLightbox() })
})()
