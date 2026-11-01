import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { searchNodes } from '../../utils/nodeSearch.js'
import './NodeSearchPanel.css'

// Le panneau n'affiche qu'un début de liste : le reste se dégage en affinant le terme.
const MAX_RESULTS = 60

// Recherche de blocs au clavier : champ, liste d'options et saut vers le bloc choisi.
export default function NodeSearchPanel({ index, cards, selectedId, focusToken, onReveal, onClose }) {
  const { t } = useTranslation()
  const [term, setTerm] = useState('')
  const [activePosition, setActivePosition] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const results = useMemo(() => {
    const visibleCards = new Set(cards.map((card) => card.id))
    return searchNodes(term, index, t).filter((entry) => visibleCards.has(entry.moduleId)).slice(0, MAX_RESULTS)
  }, [cards, index, term, t])
  const active = results.length > 0 ? Math.min(activePosition, results.length - 1) : -1

  // L'ouverture, comme un second Ctrl+F, doit rendre le curseur au champ de recherche.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [focusToken])

  // Choisit un résultat puis rend le focus au champ : la recherche reste enchaînable.
  function handlePick(entry) {
    if (!entry) return
    onReveal(entry.nodeId)
    inputRef.current?.focus({ preventScroll: true })
  }

  // Flèches pour parcourir, Entrée pour atteindre le bloc, Échap pour fermer.
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      const next = event.key === 'ArrowDown' ? Math.min(active + 1, results.length - 1) : Math.max(active - 1, 0)
      setActivePosition(next)
      listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      handlePick(results[active])
    }
  }

  return <div className="node-search" data-node-search data-canvas-ui data-canvas-scroll role="dialog" aria-label={t('search.title')}
    onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <div className="node-search__field">
      <Search size={14} aria-hidden="true" />
      <input ref={inputRef} className="glow" type="search" value={term} placeholder={t('search.placeholder')} aria-label={t('search.placeholder')}
        role="combobox" aria-expanded={results.length > 0} aria-controls={results.length > 0 ? 'node-search-results' : undefined} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `node-search-${results[active].nodeId}` : undefined}
        onChange={(event) => { setTerm(event.target.value); setActivePosition(0) }} onKeyDown={handleKeyDown} />
      <button type="button" className="node-search__close" aria-label={t('search.close')} onClick={onClose}><X size={14} aria-hidden="true" /></button>
    </div>
    <p className="node-search__count" role="status">{term.trim()
      ? t(results.length === 1 ? 'search.resultsOne' : 'search.results', { count: results.length })
      : t('search.type')}</p>
    {results.length === 0 && term.trim() ? <p className="node-search__empty">{t('search.none', { term })}</p>
      : <ul className="node-search__results" id="node-search-results" role="listbox" ref={listRef} aria-label={t('search.title')}>
        {results.map((entry, position) => <li key={entry.nodeId} id={`node-search-${entry.nodeId}`} role="option" aria-selected={position === active}
          className={`${position === active ? 'node-search__result--active' : ''}${selectedId === entry.nodeId ? ' node-search__result--selected' : ''}`}
          onClick={() => handlePick(entry)}>
          <span className="node-search__name">{entry.name}</span>
          <span className="node-search__kind">{entry.kindLabel}</span>
          <span className="node-search__trail">{entry.trail}{entry.summary ? ` · ${entry.summary}` : ''}</span>
        </li>)}
      </ul>}
    <p className="node-search__hint">{t('search.hint')}</p>
  </div>
}
