import { primitiveDefinitions } from '../../utils/logic/index.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Réutilise le catalogue statique sans reconstruire une liste de types dans l'interface.
export default function NodeTypeInput({ label, value, onChange, required, allowVoid = false, alias = false }) {
  const { t } = useTranslation()
  return (
    <label>{label ?? t('form.type')}
      <select aria-label={label ?? t('form.type')} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">{t('form.type')}</option>
        {alias && <option value="@alias">{t('form.keepLink')}</option>}
        {Object.entries(primitiveDefinitions).filter(([, type]) => allowVoid || type.category !== 'void').map(([name]) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  )
}
