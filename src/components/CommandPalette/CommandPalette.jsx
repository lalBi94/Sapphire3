import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { filterCommands } from '../../utils/commandPalette.js'
import './CommandPalette.css'

// Palette de commandes : recherche, groupes et navigation clavier vers les actions existantes.
export default function CommandPalette({ commands, onClose }) {
  const { t } = useTranslation()
  const [term, setTerm] = useState('')
  const [activePosition, setActivePosition] = useState(0)
  const inputRef = useRef(null)
  const restoreRef = useRef(null)
  const optionRefs = useRef(new Map())
  const results = useMemo(() => filterCommands(commands, term), [commands, term])
  const active = results.length > 0 ? Math.min(activePosition, results.length - 1) : -1
  const groups = []
  for (const command of results) {
    const last = groups[groups.length - 1]
    if (last && last.id === command.group) last.commands.push(command)
    else groups.push({ id: command.group, label: command.groupLabel, commands: [command] })
  }

  // Rend le focus au champ à l'ouverture, puis au déclencheur à la fermeture.
  useEffect(() => {
    restoreRef.current = document.activeElement
    inputRef.current?.focus({ preventScroll: true })
    return () => {
      const target = restoreRef.current
      if (!(target instanceof HTMLElement) || !document.contains(target)) return
      if (document.querySelector('dialog[open]')) return
      const current = document.activeElement
      if (current && current !== document.body && current !== document.documentElement) return
      target.focus({ preventScroll: true })
    }
  }, [])

  // Place la sélection sur une position et l'amène dans la zone visible.
  function selectPosition(position) {
    setActivePosition(position)
    optionRefs.current.get(results[position]?.id)?.scrollIntoView({ block: 'nearest' })
  }

  // Ferme la palette avant d'exécuter la commande choisie.
  function runCommand(command) {
    if (!command) return
    onClose()
    command.run()
  }

  // Flèches pour parcourir, Entrée pour exécuter, Échap ou Ctrl+K pour fermer.
  function handleKeyDown(event) {
    if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      const next = event.key === 'ArrowDown'
        ? (active + 1) % results.length
        : (active - 1 + results.length) % results.length
      selectPosition(next)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(results[active])
    }
  }

  return createPortal(<div className="command-palette" onPointerDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose() }} onKeyDown={(event) => event.stopPropagation()}>
    <div className="command-palette__dialog" role="dialog" aria-modal="true" aria-label={t('commandPalette.title')}>
      <h2 className="visually-hidden">{t('commandPalette.title')}</h2>
      <div className="command-palette__field">
        <Search size={15} aria-hidden="true" />
        <input ref={inputRef} data-keybind-capture className="glow" type="search" value={term}
          placeholder={t('commandPalette.placeholder')} aria-label={t('commandPalette.placeholder')}
          role="combobox" aria-expanded={results.length > 0} aria-controls="command-palette-results" aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `command-palette-option-${active}` : undefined}
          onChange={(event) => { setTerm(event.target.value); setActivePosition(0) }} onKeyDown={handleKeyDown} />
        <button type="button" className="command-palette__close" aria-label={t('commandPalette.close')} onClick={onClose}><X size={15} aria-hidden="true" /></button>
      </div>
      {results.length === 0
        ? <p className="command-palette__empty" role="status">{t('commandPalette.empty', { term })}</p>
        : <div className="command-palette__list" id="command-palette-results" role="listbox" aria-label={t('commandPalette.title')}>
          {groups.map((group) => <div className="command-palette__group" role="group" aria-label={group.label} key={group.id}>
            <p className="command-palette__group-title" aria-hidden="true">{group.label}</p>
            {group.commands.map((command) => {
              const position = results.indexOf(command)
              const selected = position === active
              return <div key={command.id} id={`command-palette-option-${position}`} role="option" aria-selected={selected}
                ref={(node) => { if (node) optionRefs.current.set(command.id, node); else optionRefs.current.delete(command.id) }}
                className={`command-palette__option${selected ? ' command-palette__option--active' : ''}`}
                onPointerEnter={() => setActivePosition(position)} onClick={() => runCommand(command)}>
                <span className="command-palette__label">{command.label}</span>
              </div>
            })}
          </div>)}
        </div>}
      <p className="command-palette__hint">{t('commandPalette.hint')}</p>
    </div>
  </div>, document.body)
}
