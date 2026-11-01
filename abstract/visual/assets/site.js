// Pose les annotations HTML sur les captures reelles, a partir des rectangles enregistres dans shots-data.js.
(function () {
  'use strict'

  var SHOTS = window.SHOTS || {}

  // Retrouve un rectangle d'annotation, sur la capture ou sur un noud de l'arbre.
  function rectOf(scene, note) {
    var data = SHOTS[scene]
    if (!data) return null
    if (note.dataset.marker) return data.boxes[note.dataset.marker] || null
    if (note.dataset.node) return data.nodes[note.dataset.node] || null
    return null
  }

  // Marqueur note : chiffre pose au centre de la zone, avec son cadre de surbrillance.
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
    var marker = document.createElement('span')
    marker.className = 'marker'
    marker.textContent = number
    marker.style.left = (rect.x + rect.w / 2) + '%'
    marker.style.top = (rect.y + rect.h / 2) + '%'
    marker.setAttribute('aria-hidden', 'true')
    frame.appendChild(ring)
    frame.appendChild(marker)

    function setActive(on) {
      ring.classList.toggle('is-active', on)
      marker.classList.toggle('is-active', on)
      note.classList.toggle('is-active', on)
    }

    note.addEventListener('mouseenter', function () { setActive(true) })
    note.addEventListener('mouseleave', function () { if (!note.classList.contains('is-pinned')) setActive(false) })
    note.addEventListener('focusin', function () { setActive(true) })
    note.addEventListener('focusout', function () { if (!note.classList.contains('is-pinned')) setActive(false) })
    marker.addEventListener('click', function () {
      note.classList.toggle('is-pinned')
      setActive(note.classList.contains('is-pinned'))
      note.scrollIntoView({ block: 'nearest' })
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
})()
