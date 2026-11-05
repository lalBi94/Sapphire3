import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { typeLabel } from '../LogicTree/logicLabels.js'
import './ModuleFunctions.css'

// Liste compacte des fonctions racines d'un module, utilisée par le zoom sémantique.
export default function ModuleFunctions({ module, index, pureIds = null, selectedIds = null, onSelect }) {
  const { t } = useTranslation()
  const functions = (module.rootNodeIds ?? []).map((id) => index.nodes.get(id)).filter((node) => node?.kind === 'FunctionDeclaration')
  return (
    <div className="module-functions">
      <p className="module-functions__count">{t(functions.length === 1 ? 'canvas.functionCountOne' : 'canvas.functionCount', { count: functions.length })}</p>
      {functions.length === 0
        ? <p className="module-functions__empty">{t('canvas.noFunctions')}</p>
        : functions.map((node) => {
          const type = index.nodeTypes.get(node.id)
          const selected = Boolean(selectedIds?.has(node.id))
          return <button
            type="button"
            key={node.id}
            className={`module-functions__row${selected ? ' module-functions__row--selected' : ''}`}
            aria-pressed={selected}
            title={typeLabel(type, t)}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onSelect?.({ kind: 'node', id: node.id }, { additive: event.ctrlKey || event.metaKey || event.shiftKey })
            }}
          >
            <span className="module-functions__name">{node.properties?.name || '—'}</span>
            <span className="module-functions__signature">{typeLabel(type, t)}</span>
            {node.properties?.entryPoint === true && <span className="module-functions__badge">{t('canvas.startHere')}</span>}
            {pureIds?.has(node.id) && <span className="module-functions__badge module-functions__badge--pure">{t('canvas.pure')}</span>}
          </button>
        })}
    </div>
  )
}
