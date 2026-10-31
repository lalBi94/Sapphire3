import { useState } from 'react'
import { Copy, Download, X } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { failureLabel } from '../../utils/translations.js'
import './TranspilePanel.css'

// Affiche le code généré et les diagnostics sans modifier le document source.
export default function TranspilePanel({ result, exportError, onExport, onClose }) {
  const { t } = useTranslation()
  const [copyState, setCopyState] = useState('')
  if (!result) return null

  // Copie uniquement le texte déjà produit par le backend sélectionné.
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.code)
      setCopyState('transpile.copied')
    } catch {
      setCopyState('transpile.copyFailed')
    }
  }

  return (
    <aside className="transpile-panel" data-canvas-ui data-canvas-scroll aria-label={t('transpile.title')} onPointerDown={(event) => event.stopPropagation()}>
      <header>
        <h2>{t('transpile.title')}</h2>
        <button type="button" aria-label={t('transpile.close')} onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </header>
      <div className="transpile-panel__actions">
        <button type="button" onClick={handleCopy} disabled={!result.code}><Copy size={14} aria-hidden="true" />{t('transpile.copy')}</button>
        <button type="button" onClick={onExport} disabled={!result.ok}><Download size={14} aria-hidden="true" />{t('transpile.export')}</button>
        {copyState && <span role={copyState === 'transpile.copyFailed' ? 'alert' : 'status'}>{t(copyState)}</span>}
      </div>
      {exportError && <p className="transpile-panel__error" role="alert">{t('errors.couldNotExport')} {failureLabel(exportError, t)}</p>}
      {result.diagnostics.length > 0 && <section className="transpile-panel__diagnostics" aria-labelledby="transpile-diagnostics-title">
        <h3 id="transpile-diagnostics-title">{t('transpile.diagnostics')}</h3>
        {result.diagnostics.map((diagnostic, index) => <p key={`${diagnostic.code}:${index}`}><strong>{diagnostic.code}</strong> {failureLabel(diagnostic, t)}</p>)}
      </section>}
      <pre className="transpile-panel__code"><code>{result.code || t('transpile.noCode')}</code></pre>
    </aside>
  )
}
