import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './ArrayCells.css'

// Affiche les cases indexées d'un tableau du debug, avec le nombre d'éléments masqués.
export default function ArrayCells({ array }) {
  const { t } = useTranslation()
  if (!array) return null
  const hidden = array.length - array.cells.length
  return <div className="array-cells" role="list" aria-label={t('debug.arrayCells', { count: array.length })}>
    {array.cells.map((value, index) => <span className="array-cells__cell" role="listitem" key={index}>
      <small aria-hidden="true">{index}</small>
      <code>{String(value)}</code>
    </span>)}
    {hidden > 0 && <span className="array-cells__more">+{hidden}</span>}
  </div>
}
