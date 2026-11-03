import { useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { diagnosticLabel, nodeLine, slotLabel } from '../LogicTree/logicLabels.js'
import { failureLabel } from '../../utils/translations.js'
import InfoHint from '../InfoHint/InfoHint.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Prépare et applique un renommage sémantique après affichage des changements résolus.
export default function RenameSymbol({ record, index, onPreview, onApply }) {
  const { t } = useTranslation()
  const [name, setName] = useState(record.properties?.name ?? '')
  const [preview, setPreview] = useState(null)
  const currentName = record.properties?.name ?? ''
  const changed = name.trim() !== currentName

  // Toute nouvelle saisie invalide l'aperçu précédent : on ne peut appliquer qu'un aperçu courant.
  function handleNameChange(event) {
    setName(event.target.value)
    setPreview(null)
  }

  // Demande au moteur le plan complet sans modifier la source.
  function handlePreview(event) {
    event.preventDefault()
    setPreview(onPreview(record.id, name))
  }

  // Recalcule puis applique le renommage sur la source courante.
  function handleApply() {
    const result = onApply(record.id, name)
    if (!result.ok) setPreview(result)
  }

  // Décrit un changement par son module et son nœud source, sans texte inventé.
  function changeLabel(change) {
    const moduleName = index.modules.get(change.moduleId)?.name ?? change.moduleId
    const node = change.nodeId ? index.nodes.get(change.nodeId) : null
    return node ? `${moduleName} · ${nodeLine(node, index, t)}` : moduleName
  }

  return <section className="node-properties__rename" aria-label={t('rename.title')}>
    <h3>{t('rename.title')} <InfoHint text={t('rename.hint')} /></h3>
    <form onSubmit={handlePreview}>
      <label>{t('rename.newName')}<input aria-label={t('rename.newName')} value={name} onChange={handleNameChange} autoComplete="off" required /></label>
      <div className="node-properties__rename-actions">
        <button type="submit" disabled={!changed || !name.trim()}><Pencil size={13} aria-hidden="true" />{t('rename.preview')}</button>
        {preview?.ok && preview.changes.length > 0 && <button type="button" onClick={handleApply}><Check size={13} aria-hidden="true" />{t('rename.apply')}</button>}
      </div>
    </form>
    {preview && <div className="node-properties__rename-result">
      {!preview.ok && !preview.reboundNodeIds?.length && <p className="node-properties__rename-error" role="alert">{failureLabel({ code: preview.code }, t)}</p>}
      {preview.reboundNodeIds?.length > 0 && <p className="node-properties__rename-error" role="alert">{t('rename.rebound', { count: preview.reboundNodeIds.length })}</p>}
      {preview.diagnostics?.length > 0 && <ul className="node-properties__rename-diagnostics" aria-label={t('details.issues')}>
        {preview.diagnostics.map((diagnostic, position) => <li key={`${diagnostic.code}:${position}`}><strong>{diagnosticLabel(diagnostic.code, t)}</strong><small>{diagnostic.location?.field ? slotLabel(diagnostic.location.field, t) : ''}</small></li>)}
      </ul>}
      {preview.ok && preview.changes.length === 0 && <p className="node-properties__rename-summary" role="status">{t('rename.noChanges')}</p>}
      {preview.changes.length > 0 && <>
        <p className="node-properties__rename-summary" role="status">{t('rename.summary', { count: preview.changes.length })}</p>
        <ul className="node-properties__rename-changes">
          {preview.changes.map((change, position) => <li key={`${change.kind}:${change.moduleId}:${change.nodeId ?? change.importId}:${change.field}:${position}`}>
            <span className={`node-properties__rename-kind node-properties__rename-kind--${change.kind}`}>{t(`rename.kind.${change.kind}`)}</span>
            <span>{changeLabel(change)}</span>
            <small>{change.from || '∅'} → {change.to}</small>
          </li>)}
        </ul>
      </>}
    </div>}
  </section>
}
