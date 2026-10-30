import { useEffect, useRef } from 'react'
import { ChevronDown, Download, Upload, X } from 'lucide-react'
import './ProjectNavigation.css'

// Bloque le remplacement du document tant qu'il n'a pas été confirmé explicitement.
function ImportConfirmation({ path, onConfirm, onCancel }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  return <dialog ref={dialogRef} className="project-navigation__confirmation" aria-labelledby="import-title" onCancel={onCancel}>
    <h2 id="import-title">Replace this workspace?</h2>
    <p>This will replace your modules, notes and layout. Export first if you want to keep them.</p>
    <p className="project-navigation__path">{path}</p>
    <div><button type="button" autoFocus onClick={onCancel}>Cancel</button><button type="button" className="project-navigation__primary" onClick={onConfirm}>Replace and import</button></div>
  </dialog>
}

// Réserve les menus futurs et expose les opérations de fichier sans connaître le canvas ni les API natives.
export default function ProjectNavigation({ busy, message, error, pendingImport, onExport, onImport, onConfirmImport, onCancelImport, onDismiss }) {
  const navigationRef = useRef(null)

  useEffect(() => {
    // Ferme les volets lorsque l'utilisateur interagit ailleurs dans l'application.
    function handleOutside(event) {
      if (!navigationRef.current.contains(event.target)) closeMenus()
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [])

  // Garde un seul volet ouvert, y compris dans les moteurs sans prise en charge de details[name].
  function handleToggle(event) {
    if (!event.currentTarget.open) return
    for (const menu of navigationRef.current.querySelectorAll('details')) {
      if (menu !== event.currentTarget) menu.open = false
    }
  }

  // Referme les menus sans modifier la sélection ou la vue du document.
  function closeMenus() {
    for (const menu of navigationRef.current.querySelectorAll('details')) menu.open = false
  }

  // Rend le focus au déclencheur du volet fermé au clavier.
  function handleKeyDown(event) {
    if (event.key !== 'Escape') return
    const openMenu = navigationRef.current.querySelector('details[open]')
    closeMenus()
    openMenu?.querySelector('summary').focus()
  }

  // Ferme le volet avant l'ouverture du dialogue de fichier.
  function handleExport(extension) {
    closeMenus()
    onExport(extension)
  }

  // Lance l'import sans laisser de volet flottant sous le dialogue de confirmation.
  function handleImport() {
    closeMenus()
    onImport()
  }

  return <>
    <nav ref={navigationRef} className="project-navigation" aria-label="Workspace navigation" onKeyDown={handleKeyDown}>
      <span className="project-navigation__brand">Sapphire 3</span>
      {['Edit', 'View'].map((label) => <details key={label} name="workspace-menu" onToggle={handleToggle}>
        <summary>{label}<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu"><p>Nothing here yet.</p></div>
      </details>)}
      <details name="workspace-menu" onToggle={handleToggle}>
        <summary>Settings<ChevronDown size={12} aria-hidden="true" /></summary>
        <div className="project-navigation__menu">
          <button type="button" disabled={busy || !!pendingImport} onClick={handleImport}><Upload size={14} aria-hidden="true" />Import .sp3 / .json</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleExport('sp3')}><Download size={14} aria-hidden="true" />Export .sp3</button>
          <button type="button" disabled={busy || !!pendingImport} onClick={() => handleExport('json')}><Download size={14} aria-hidden="true" />Export JSON</button>
        </div>
      </details>
      <span className="project-navigation__status" role="status">{busy ? 'Working…' : message}</span>
      {error && <div className="project-navigation__error" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={onDismiss}><X size={14} aria-hidden="true" /></button></div>}
    </nav>
    {pendingImport && <ImportConfirmation path={pendingImport.path} onConfirm={onConfirmImport} onCancel={onCancelImport} />}
  </>
}
