import { useState } from 'react'
import { getImportCandidates, getModuleFunctions, getUnusedImportIds } from '../../utils/logic/index.js'
import { typeLabel } from '../LogicTree/logicLabels.js'
import { failureLabel } from '../../utils/translations.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Expose les fonctions réellement partageables et les imports explicites du module.
export default function ModuleInterface({ module, project, analysis, index, onExport, onImport, onRemoveImport }) {
  const { t } = useTranslation()
  const [candidateKey, setCandidateKey] = useState('')
  const [localName, setLocalName] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const functions = getModuleFunctions(project, module.id, analysis)
  const candidates = getImportCandidates(project, module.id, analysis)
  const unusedImports = new Set(getUnusedImportIds(project, module.id, analysis))
  const exports = Array.isArray(module.exports) ? module.exports : []
  const imports = Array.isArray(module.imports) ? module.imports : []
  const candidate = candidates.find((entry) => `${entry.moduleId}:${entry.nodeId}` === candidateKey) ?? null

  // Retrouve le nom affiché d'un module sans supposer qu'il existe encore.
  function moduleName(moduleId) {
    return project.modules.find((entry) => entry.id === moduleId)?.name ?? moduleId
  }

  // Préremplit le nom local avec celui de la fonction choisie, sans le figer.
  function handleCandidateChange(event) {
    const key = event.target.value
    const next = candidates.find((entry) => `${entry.moduleId}:${entry.nodeId}` === key)
    setCandidateKey(key)
    setLocalName(next?.name ?? '')
  }

  // Laisse le moteur valider l'import ; le formulaire reste rempli en cas de refus.
  function handleImport(event) {
    event.preventDefault()
    if (!candidate || !localName.trim()) return
    const result = onImport(module.id, candidate, localName.trim())
    setErrorCode(result?.ok ? '' : result.code)
    if (result?.ok) {
      setCandidateKey('')
      setLocalName('')
    }
  }

  // Applique le changement d'export et garde le code d'échec visible.
  function handleExport(nodeId, exported) {
    const result = onExport(module.id, nodeId, exported)
    setErrorCode(result?.ok ? '' : result.code)
  }

  // Retire une liaison d'import et signale un refus éventuel.
  function handleRemoveImport(importId) {
    const result = onRemoveImport(module.id, importId)
    setErrorCode(result?.ok ? '' : result.code)
  }

  return <>
    <section className="node-properties__interface" aria-label={t('details.exports')}>
      <h3>{t('details.exports')}</h3>
      <p>{t('details.exportsHint')}</p>
      {functions.length === 0 ? <p>{t('details.noExports')}</p> : <ul className="node-properties__interface-list">
        {functions.map((symbol) => {
          const exported = exports.some((entry) => entry?.nodeId === symbol.nodeId)
          return <li className="node-properties__interface-item" key={symbol.nodeId}>
            <span><strong>{symbol.name}</strong><small>{typeLabel(index.nodeTypes.get(symbol.nodeId), t)}</small></span>
            <button type="button" aria-pressed={exported} onClick={() => handleExport(symbol.nodeId, !exported)}>{exported ? t('details.unexport') : t('details.export')}</button>
          </li>
        })}
      </ul>}
    </section>
    <section className="node-properties__interface" aria-label={t('details.imports')}>
      <h3>{t('details.imports')}</h3>
      <p>{t('details.importsHint')}</p>
      {imports.length === 0 ? <p>{t('details.noImports')}</p> : <ul className="node-properties__interface-list">
        {imports.map((entry) => {
          const unused = unusedImports.has(entry.id)
          return <li className={`node-properties__interface-item${unused ? ' node-properties__interface-item--unused' : ''}`} key={entry.id}>
            <span><strong>{entry.localName}</strong><small>{index.nodes.get(entry.nodeId)?.properties.name ?? entry.nodeId} · {t('details.importedFrom', { module: moduleName(entry.moduleId) })}</small></span>
            {unused && <span className="node-properties__interface-unused" title={t('details.unusedImportHint')}>{t('details.unusedImport')}</span>}
            <button type="button" title={t('details.removeImport')} onClick={() => handleRemoveImport(entry.id)}>{t('details.removeImport')}</button>
          </li>
        })}
      </ul>}
      {candidates.length > 0 && <form className="node-properties__interface-form" onSubmit={handleImport}>
        <label>{t('details.chooseImport')}<select value={candidateKey} onChange={handleCandidateChange}>
          <option value="">{t('details.chooseImport')}</option>
          {candidates.map((entry) => <option key={`${entry.moduleId}:${entry.nodeId}`} value={`${entry.moduleId}:${entry.nodeId}`}>{moduleName(entry.moduleId)} · {entry.name}</option>)}
        </select></label>
        <label>{t('details.localName')}<input value={localName} onChange={(event) => setLocalName(event.target.value)} disabled={!candidate} /></label>
        <button type="submit" disabled={!candidate || !localName.trim()}>{t('details.import')}</button>
      </form>}
      {candidates.length === 0 && <p>{t('details.noImportCandidates')}</p>}
    </section>
    {errorCode && <p className="node-properties__interface-error" role="alert">{failureLabel({ code: errorCode }, t)}</p>}
  </>
}
