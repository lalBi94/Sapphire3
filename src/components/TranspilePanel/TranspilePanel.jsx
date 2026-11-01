import { useState } from 'react'
import { Copy, FileOutput, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import usePanelFront from '../../hooks/usePanelFront.jsx'
import { failureLabel } from '../../utils/translations.js'
import { transpilationLanguages } from '../../utils/transpilation/languages.js'
import './TranspilePanel.css'

// Affiche le code généré et les diagnostics sans modifier le document source.
export default function TranspilePanel({ result, exportError, onExport, onClose }) {
  const { t } = useTranslation()
  const front = usePanelFront()
  const [copyState, setCopyState] = useState(null)
  const target = transpilationLanguages.find((option) => option.id === result?.target)
  const values = { language: target?.name ?? result?.target ?? '', extension: target?.extension ?? '' }
  const copyMessage = copyState?.result === result ? copyState.message : ''
  if (!result) return null

  // Copie uniquement le texte déjà produit par le backend sélectionné.
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.code)
      setCopyState({ result, message: 'transpile.copied' })
    } catch {
      setCopyState({ result, message: 'transpile.copyFailed' })
    }
  }

  return (
    <aside className="transpile-panel" data-canvas-ui data-canvas-scroll aria-label={t('transpile.title', values)} style={front.zIndex ? { zIndex: front.zIndex } : undefined} onPointerDown={(event) => { front.bringToFront(); event.stopPropagation() }} onFocusCapture={front.bringToFront}>
      <header>
        <h2>{t('transpile.title', values)}</h2>
        <button type="button" aria-label={t('transpile.close', values)} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      <div className="transpile-panel__actions">
        <button type="button" onClick={handleCopy} disabled={!result.code}><Copy size={14} aria-hidden="true" />{t('transpile.copy')}</button>
        <button type="button" onClick={onExport} disabled={!result.ok}><FileOutput size={14} aria-hidden="true" />{t('transpile.export', values)}</button>
        {copyMessage && <span role={copyMessage === 'transpile.copyFailed' ? 'alert' : 'status'}>{t(copyMessage)}</span>}
      </div>
      {exportError && <p className="transpile-panel__error" role="alert">{t('errors.couldNotExport')} {failureLabel(exportError, t)}</p>}
      {result.diagnostics.length > 0 && <section className="transpile-panel__diagnostics" aria-labelledby="transpile-diagnostics-title">
        <h3 id="transpile-diagnostics-title">{t('transpile.diagnostics')}</h3>
        {result.diagnostics.map((diagnostic, index) => <p key={`${diagnostic.code}:${index}`}><strong>{diagnostic.code}</strong> {failureLabel(diagnostic, t)}</p>)}
      </section>}
      <pre className="transpile-panel__code"><code>{result.code || t('transpile.noCode', values)}</code></pre>
    </aside>
  )
}
