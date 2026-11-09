// Classement local déterministe : accents, mots partiels, synonymes et fautes simples.
(() => {
  // Uniformise les accents et la ponctuation sans dépendre d'une langue globale.
  function normalize(text) {
    return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  }

  // Reconnaît une seule insertion, suppression, substitution ou inversion adjacente.
  function nearWord(left, right) {
    if (Math.abs(left.length - right.length) > 1 || left.length < 4) return false
    if (left.length === right.length) {
      const differences = []
      for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) differences.push(i)
      if (differences.length <= 1) return true
      const [a, b] = differences
      return differences.length === 2 && b === a + 1 && left[a] === right[b] && left[b] === right[a]
    }
    const shorter = left.length < right.length ? left : right
    const longer = left.length < right.length ? right : left
    let i = 0
    let j = 0
    while (i < shorter.length && j < longer.length) {
      if (shorter[i] === longer[j]) { i += 1; j += 1 }
      else { j += 1; if (j - i > 1) return false }
    }
    return true
  }

  const aliases = {
    debug: 'debogage', deboguer: 'debogage', debugger: 'debogage', run: 'simulation',
    sauvegarde: 'fichier', enregistrer: 'fichier', telecharger: 'telechargement', download: 'telechargement',
    lambda: 'lambdas', pointer: 'pointeurs', class: 'classes', generic: 'generiques',
    theme: 'themes', shortcut: 'raccourcis',
  }

  // Prépare les textes une seule fois au chargement du catalogue local.
  function prepare(entries) {
    return entries.map((entry) => {
      const title = normalize(entry.title)
      const keywords = normalize(entry.keywords)
      return { ...entry, titleText: title, keywordText: keywords, bodyText: normalize(entry.text), words: [...new Set(`${title} ${keywords}`.split(' '))] }
    })
  }

  // Exige tous les termes et privilégie les titres plutôt que les occurrences dans le texte.
  function rank(entries, query, limit = 10) {
    const normalized = normalize(query).slice(0, 120)
    const terms = normalized.split(' ').filter(Boolean).slice(0, 8)
    if (!terms.length) return entries.filter((entry) => entry.featured).slice(0, limit)
    const results = []
    for (const entry of entries) {
      let score = entry.titleText.includes(normalized) ? 35 : 0
      let matches = true
      for (const term of terms) {
        const variants = [term, aliases[term]].filter(Boolean)
        if (variants.some((word) => entry.titleText.includes(word))) score += 15
        else if (variants.some((word) => entry.keywordText.includes(word))) score += 11
        else if (variants.some((word) => entry.bodyText.includes(word))) score += 3
        else if (entry.words.some((word) => nearWord(term, word))) score += 4
        else { matches = false; break }
      }
      if (matches) results.push({ ...entry, score })
    }
    return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'fr')).slice(0, limit)
  }
  globalThis.SapphireSearch = Object.freeze({ normalize, nearWord, prepare, rank })
})()
