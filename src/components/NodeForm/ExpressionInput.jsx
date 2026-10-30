import { sameType } from '../../utils/logic/index.js'
import NodeValueInput from './NodeValueInput.jsx'

// Configure un initialiseur ou une condition simple ; les expressions composées restent éditables par slots.
export default function ExpressionInput({ label, value, onChange, type, symbols, required, allowIncomplete = false }) {
  const matching = symbols.filter((symbol) => sameType(type, symbol.type))
  return (
    <fieldset>
      <legend>{label}</legend>
      <label>Expression
        <select aria-label={`${label} expression`} value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value })} required={required} disabled={!type}>
          <option value="">{required ? 'Choose an expression' : 'None / configure later'}</option>
          <option value="literal">Literal</option><option value="reference">Reference</option>
        </select>
      </label>
      {value.mode === 'literal' && <NodeValueInput label={`${label} value`} typeName={type?.name} value={value.value} empty={value.empty} onEmptyChange={(empty) => onChange({ ...value, empty })} required={!allowIncomplete} onChange={(next) => onChange({ ...value, value: next })} />}
      {value.mode === 'reference' && <label>Symbol
        <select aria-label={`${label} symbol`} value={value.symbolId} required={!allowIncomplete} onChange={(event) => onChange({ ...value, symbolId: event.target.value })}>
          <option value="">Choose a matching symbol</option>
          {matching.map((symbol) => <option key={symbol.id} value={symbol.id}>{symbol.name}</option>)}
        </select>
      </label>}
    </fieldset>
  )
}
