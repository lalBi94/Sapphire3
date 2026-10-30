import { primitiveDefinitions } from '../../utils/logic/index.js'

// Réutilise le catalogue statique sans reconstruire une liste de types dans l'interface.
export default function NodeTypeInput({ label = 'Type', value, onChange, required, allowVoid = false, alias = false }) {
  return (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Choose a type</option>
        {alias && <option value="@alias">Declared alias (unchanged)</option>}
        {Object.entries(primitiveDefinitions).filter(([, type]) => allowVoid || type.category !== 'void').map(([name]) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  )
}
