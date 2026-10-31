import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Saisit un littéral sans convertir les nombres via la précision de l'interface JavaScript.
export default function NodeValueInput({ label, typeName, value, onChange, required, empty = false, onEmptyChange }) {
  const { t } = useTranslation()
  const valueLabel = label ?? t('form.value')
  return (
    <>
      <label>{valueLabel}
        {typeName === 'boolean' ? (
          <select aria-label={valueLabel} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
            <option value="">{t('form.booleanChoice')}</option><option value="true">{t('form.true')}</option><option value="false">{t('form.false')}</option>
          </select>
        ) : (
          <input aria-label={valueLabel} value={value} onChange={(event) => onChange(event.target.value)} required={required && !empty} disabled={!typeName || empty} autoComplete="off" />
        )}
      </label>
      {typeName === 'string' && onEmptyChange && <label className="node-form__check"><input type="checkbox" checked={empty} onChange={(event) => onEmptyChange(event.target.checked)} />{t('form.emptyText')}</label>}
    </>
  )
}
