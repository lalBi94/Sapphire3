import { useState } from 'react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Édite le nom d'un module sans transformer son identité ou ses racines.
export default function ModuleNameForm({ module, onRename }) {
  const [name, setName] = useState(module.name)
  const { t } = useTranslation()
  return <form className="node-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onRename(module.id, name.trim()) }}>
    <label>{t('form.name')}<input aria-label={t('form.name')} value={name} required onChange={(event) => setName(event.target.value)} /></label>
    <button type="submit">{t('details.saveName')}</button>
  </form>
}
