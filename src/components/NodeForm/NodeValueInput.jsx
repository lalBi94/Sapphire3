import { useTranslation } from '../../i18n.jsx'

// Saisit un littéral sans convertir les nombres via la précision de l'interface JavaScript.
export default function NodeValueInput({ label = 'Value', typeName, value, onChange, required, empty = false, onEmptyChange }) {
  const { language } = useTranslation()
  const booleanLabel = language === 'fr' ? 'Choisir vrai ou faux' : 'Choose true or false'
  return (
    <>
      <label>{label}
        {typeName === 'boolean' ? (
          <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
            <option value="">{booleanLabel}</option><option value="true">true</option><option value="false">false</option>
          </select>
        ) : (
          <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} required={required && !empty} disabled={!typeName || empty} autoComplete="off" />
        )}
      </label>
      {typeName === 'string' && onEmptyChange && <label className="node-form__check"><input type="checkbox" checked={empty} onChange={(event) => onEmptyChange(event.target.checked)} />{language === 'fr' ? 'Sans texte' : 'Use no text'}</label>}
    </>
  )
}
