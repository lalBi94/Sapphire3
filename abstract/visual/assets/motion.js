// Mouvements de la vitrine et de la documentation, sans aucune dépendance de l'application.
(() => {
  const { gsap, ScrollTrigger, Lenis, SplitType } = window
  if (!gsap || !ScrollTrigger || !Lenis) return
  gsap.registerPlugin(ScrollTrigger)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = matchMedia('(pointer: fine)')
  const home = Boolean(document.querySelector('.nav-shell'))
  if (home) {
    const progress = document.createElement('span')
    progress.className = 'motion-progress'
    progress.setAttribute('aria-hidden', 'true')
    document.querySelector('.nav-shell')?.append(progress)
  }
  let context
  let lenis
  let tick
  let splits = []
  let stopped = false

  // Remet le DOM et le défilement dans leur état natif, notamment pour le mode mouvement réduit.
  function cleanup() {
    context?.revert()
    context = null
    for (const split of splits) {
      split.revert()
      split.elements.forEach((element) => element.removeAttribute('aria-label'))
    }
    splits = []
    if (tick) gsap.ticker.remove(tick)
    tick = null
    lenis?.destroy()
    lenis = null
    document.documentElement.classList.remove('site-smooth')
  }

  // Découpe uniquement les grands titres et conserve un nom accessible complet.
  function splitHeading(element) {
    if (!SplitType) return []
    const label = element.innerText.replace(/\s+/g, ' ').trim()
    const split = new SplitType(element, { types: 'words, chars', tagName: 'span' })
    element.setAttribute('aria-label', label)
    split.words.forEach((word) => word.setAttribute('aria-hidden', 'true'))
    splits.push(split)
    return split.chars
  }

  // Crée une apparition liée au défilement sans masquer durablement les contenus.
  function reveal(elements, trigger, options = {}) {
    if (!elements || (elements.length !== undefined && !elements.length)) return
    gsap.from(elements, {
      y: 26, opacity: 0, duration: 0.65, stagger: 0.07, ease: 'power2.out',
      scrollTrigger: { trigger, start: 'top 90%', once: true },
      ...options,
    })
  }

  // Installe les scènes bornées et la seule horloge GSAP/Lenis de la page.
  function mount() {
    cleanup()
    if (stopped || reduced.matches) return
    lenis = new Lenis({
      autoRaf: false, lerp: home ? 0.1 : 0.16, smoothWheel: true, syncTouch: false,
      anchors: true,
      prevent: (element) => Boolean(element.closest('dialog, .doc-rail, pre, table, [data-lenis-prevent]')),
    })
    lenis.on('scroll', ScrollTrigger.update)
    tick = (time) => lenis?.raf(time * 1000)
    gsap.ticker.add(tick)
    document.documentElement.classList.add('site-smooth')
    context = gsap.context(() => {
      if (!home) {
        reveal('.page-intro h1', '.page-intro', { y: 16, stagger: 0, duration: 0.5 })
        gsap.utils.toArray('.doc-content > section > .section-title, .doc-content > section > h2:first-child')
          .forEach((heading) => reveal(heading, heading, { y: 10, stagger: 0, duration: 0.4 }))
        return
      }
      const introChars = splitHeading(document.querySelector('.hero h1'))
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro.from('.hero-meta, .hero-copy .eyebrow', { y: 10, opacity: 0, duration: 0.45, stagger: 0.08 })
      if (introChars.length) intro.from(introChars, { yPercent: 85, opacity: 0, rotation: 3, stagger: 0.013, duration: 0.65 }, '-=0.2')
      intro.from('.hero-line, .hero-description, .cta-row, .platforms', { y: 18, opacity: 0, duration: 0.55, stagger: 0.08 }, '-=0.4')
        .from('.model-console', { x: 24, opacity: 0, duration: 0.8 }, 0.3)
        .from('.model-node', { y: 16, opacity: 0, stagger: 0.12, duration: 0.55 }, 0.6)
        .from('.console-top, .console-bottom, .hero-bottom', { opacity: 0, duration: 0.5 }, 0.8)
      document.querySelectorAll('.model-wires path').forEach((wire) => {
        const length = wire.getTotalLength()
        intro.fromTo(wire, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.2 }, 0.8)
      })
      gsap.fromTo('.motion-progress', { scaleX: 0 }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true },
      })

      gsap.utils.toArray('.section-heading h2, .doc-gateway h2, .closing h2').forEach((heading) => {
        const chars = splitHeading(heading)
        reveal(chars.length ? chars : heading, heading, { y: 0, yPercent: 55, stagger: 0.008, duration: 0.5 })
      })
      reveal('.proof-strip p', '.proof-strip', { y: 12 })
      reveal('.feature-grid article', '.feature-grid', { y: 32, stagger: 0.12 })
      reveal('.doc-links a', '.doc-links', { x: 18, y: 0, stagger: 0.12 })
      reveal('.closing .cta, .closing .eyebrow', '.closing')
      reveal('.home-footer > *', '.home-footer', { y: 12, duration: 0.4 })
      if (finePointer.matches && innerWidth >= 900) {
        gsap.to('.model-console', {
          y: -40, rotation: 1, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 },
        })
        gsap.fromTo('.app-preview', { scale: 0.96, y: 35 }, {
          scale: 1, y: 0, ease: 'none',
          scrollTrigger: { trigger: '.showcase', start: 'top 85%', end: 'top 15%', scrub: 0.5 },
        })
      }
      gsap.utils.toArray('.feature-grid, .doc-gateway, .closing').forEach((section) => {
        gsap.from(section, { borderTopColor: 'transparent', duration: 0.7, scrollTrigger: { trigger: section, start: 'top 85%', once: true } })
      })
    })
    ScrollTrigger.refresh()
  }

  // Arrête les interpolations pendant une modale et laisse ses zones internes défiler nativement.
  function syncDialogs() {
    if (!lenis) return
    if (document.querySelector('dialog[open]')) lenis.stop()
    else lenis.start()
  }

  // Libère les animations quand le navigateur quitte la page, y compris dans le cache retour.
  function suspend() { stopped = true; cleanup() }
  // Réinstalle uniquement les scènes d'une page restaurée par le navigateur.
  function resume(event) { if (event.persisted) { stopped = false; mount() } }

  reduced.addEventListener('change', mount)
  window.addEventListener('pagehide', suspend)
  window.addEventListener('pageshow', resume)
  document.addEventListener('visibilitychange', () => {
    if (!tick) return
    if (document.hidden) gsap.ticker.remove(tick)
    else gsap.ticker.add(tick)
  })
  new MutationObserver(syncDialogs).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true })
  document.fonts.ready.then(() => {
    try { mount() } catch (error) { cleanup(); console.warn('Animations indisponibles : affichage natif conservé.', error) }
  })
})()
