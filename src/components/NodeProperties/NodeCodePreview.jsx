import { useState } from 'react'
import { transpilationLanguages, transpileSelection } from '../../utils/transpilation/index.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { diagnosticLabel } from '../LogicTree/logicLabels.js'

// Consulte le code du sous-arbre sélectionné sans l'exécuter ni modifier le document.
export default function NodeCodePreview({ project, selected, analysis }) {
  const [target, setTarget] = useState('javascript')
  const { t } = useTranslation()
  const result = transpileSelection(project, selected, { target, analysis })
  return <section className="node-properties__code">
    <h3>{t('transpile.nodeCode')}</h3>
    <label>{t('transpile.chooseLanguage')}<select value={target} onChange={(event) => setTarget(event.target.value)}>
      {transpilationLanguages.map((option) => <option key={option.id} value={option.id} disabled={!option.available}>{option.name}{!option.available && ` · ${t('transpile.unavailable')}`}</option>)}
    </select></label>
    <p>{t('transpile.snippetHint')}</p>
    {result.ok ? <pre tabIndex={0}><code>{result.code || t('transpile.noRuntimeCode', { language: transpilationLanguages.find((option) => option.id === target).name })}</code></pre> : <><p>{t('transpile.previewUnavailable')}</p><ul>{result.diagnostics.map((entry, index) => <li key={index}>{diagnosticLabel(entry.code, t)}</li>)}</ul></>}
  </section>
}
