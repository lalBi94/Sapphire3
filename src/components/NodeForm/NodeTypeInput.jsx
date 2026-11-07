import { primitiveDefinitions } from '../../utils/logic/index.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'

// Réutilise le catalogue statique sans reconstruire une liste de types dans l'interface.
export default function NodeTypeInput({ label, value, onChange, required, allowVoid = false, allowArray = false, allowPointer = false, allowFunction = false, allowNewFunctionType = false, genericNames = [], functionTypes = [], classTypes = [], alias = false, emptyLabel = null }) {
  const { t } = useTranslation()
  const scalars = Object.entries(primitiveDefinitions).filter(([, type]) => allowVoid || type.category !== 'void')
  const elements = Object.entries(primitiveDefinitions).filter(([, type]) => type.category !== 'void')
  const pointees = Object.entries(primitiveDefinitions).filter(([, type]) => type.category !== 'void')
  const generics = genericNames
  return (
    <label>{label ?? t('form.type')}
      <select aria-label={label ?? t('form.type')} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">{emptyLabel ?? t('form.type')}</option>
        {alias && <option value="@alias">{t('form.keepLink')}</option>}
        {scalars.map(([name]) => <option key={name} value={name}>{name}</option>)}
        {generics.map((name) => <option key={name} value={name}>{name}</option>)}
        {classTypes.length > 0 && <optgroup label={t('form.classType')}>
          {classTypes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </optgroup>}
        {allowArray && elements.map(([name]) => <option key={`${name}[]`} value={`${name}[]`}>{name}[]</option>)}
        {allowArray && generics.map((name) => <option key={`${name}[]`} value={`${name}[]`}>{name}[]</option>)}
        {allowPointer && pointees.map(([name]) => <option key={`${name}*`} value={`${name}*`}>{name}*</option>)}
        {allowFunction && functionTypes.length > 0 && <optgroup label={t('form.functionType')}>
          {functionTypes.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </optgroup>}
        {allowNewFunctionType && <option value="@function:new">{t('form.newFunctionType')}</option>}
      </select>
    </label>
  )
}
