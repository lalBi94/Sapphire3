// Palette de recherche locale : aucun service distant, historique ou télémétrie.
(() => {
  if (!window.SapphireSearch || !window.SapphireSearchEntries) return
  const catalog = SapphireSearch.prepare(window.SapphireSearchEntries)
  const header = document.querySelector('.nav-shell, .site-header')
  if (!header) return
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'search-trigger'
  trigger.setAttribute('aria-label', 'Rechercher dans le site (Ctrl ou Commande K)')
  trigger.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg><span>Rechercher</span><kbd>Ctrl K</kbd>'
  header.append(trigger)

  const dialog = document.createElement('dialog')
  dialog.className = 'site-search'
  dialog.setAttribute('aria-label', 'Rechercher dans Sapphire 3')
  dialog.setAttribute('data-lenis-prevent', '')
  // Le balisage est constant ; les textes de résultats sont ensuite insérés par textContent.
  dialog.innerHTML = `<div class="search-bar"><label class="visually-hidden" for="site-search-input">Votre recherche</label><input id="site-search-input" type="search" autocomplete="off" spellcheck="false" maxlength="120" placeholder="Fonction, débogage, pointeurs…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="site-search-results"><button type="button" data-search-clear>Effacer</button><button type="button" data-search-close aria-label="Fermer la recherche">×</button></div><p class="search-count" role="status" aria-live="polite"></p><ul class="search-results" id="site-search-results" role="listbox" aria-label="Résultats"></ul><footer class="search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Parcourir</span><span><kbd>Entrée</kbd> Ouvrir</span><span><kbd>Échap</kbd> Fermer</span><b>LOCAL / SANS TRACKING</b></footer>`
  document.body.append(dialog)
  const input = dialog.querySelector('input')
  const list = dialog.querySelector('.search-results')
  const count = dialog.querySelector('.search-count')
  let results = []
  let selected = 0
  let inputTimer
  let returnFocus

  // Met en avant un résultat tout en gardant le focus dans le champ de saisie.
  function selectResult(index, scroll = true) {
    selected = Math.max(0, Math.min(results.length - 1, index))
    const options = [...list.children]
    options.forEach((option, position) => option.setAttribute('aria-selected', String(position === selected)))
    input.setAttribute('aria-expanded', String(results.length > 0))
    if (options[selected]) {
      input.setAttribute('aria-activedescendant', options[selected].id)
      if (scroll) options[selected].scrollIntoView({ block: 'nearest', behavior: 'instant' })
    } else input.removeAttribute('aria-activedescendant')
  }

  // Actualise les résultats avec un budget borné et des nœuds DOM sûrs.
  function render() {
    clearTimeout(inputTimer)
    inputTimer = null
    results = SapphireSearch.rank(catalog, input.value)
    list.replaceChildren()
    results.forEach((result, index) => {
      const option = document.createElement('li')
      option.id = `site-search-result-${index}`
      option.setAttribute('role', 'option')
      const category = document.createElement('span')
      category.className = 'search-category'
      category.textContent = result.category
      const title = document.createElement('strong')
      title.textContent = result.title
      const excerpt = document.createElement('small')
      excerpt.textContent = result.excerpt || result.text
      option.append(category, title, excerpt)
      option.addEventListener('pointermove', () => selectResult(index, false))
      option.addEventListener('click', () => openResult(index))
      list.append(option)
    })
    count.textContent = input.value.trim()
      ? results.length ? `${results.length} résultat${results.length > 1 ? 's' : ''}.` : 'Aucun résultat. Essayez « débogage », « classes » ou « sauvegarde ».'
      : 'Accès rapides — ou cherchez un concept dans la documentation.'
    list.scrollTop = 0
    selectResult(0, false)
  }

  // Ferme la palette ; le navigateur restitue le focus au déclencheur.
  function close() { dialog.close() }

  // Ouvre la destination indexée, jamais une URL fournie par la requête du visiteur.
  function openResult(index) {
    const result = results[index]
    if (!result) return
    const destination = new URL(result.url, location.href)
    const trustedExternal = destination.origin === 'https://github.com'
      && (destination.pathname === '/lalBi94/Sapphire3' || destination.pathname.startsWith('/lalBi94/Sapphire3/'))
    if (destination.origin !== location.origin && !trustedExternal) return
    close()
    if (destination.pathname === location.pathname && destination.hash) {
      location.hash = destination.hash
      const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)))
      if (target) {
        target.setAttribute('tabindex', '-1')
        target.focus({ preventScroll: true })
      }
    } else location.assign(destination.href)
  }

  // Ouvre la recherche sans modifier le défilement courant.
  function open() {
    if (dialog.open) return
    returnFocus = document.activeElement
    render()
    dialog.showModal()
    input.focus({ preventScroll: true })
  }

  trigger.addEventListener('click', open)
  dialog.querySelector('[data-search-close]').addEventListener('click', close)
  dialog.querySelector('[data-search-clear]').addEventListener('click', () => { input.value = ''; render(); input.focus() })
  input.addEventListener('input', () => { clearTimeout(inputTimer); inputTimer = setTimeout(render, 65) })
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectResult((selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % (results.length || 1))
    } else if (event.key === 'Enter') { event.preventDefault(); renderIfPending(); openResult(selected) }
  })
  // Termine une saisie encore différée avant la validation clavier.
  function renderIfPending() { if (inputTimer) { render(); inputTimer = null } }
  dialog.addEventListener('close', () => { clearTimeout(inputTimer); returnFocus?.focus({ preventScroll: true }) })
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close()
  })
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      if (dialog.open) close()
      else if (!document.querySelector('dialog[open]')) open()
    }
  })
})()
