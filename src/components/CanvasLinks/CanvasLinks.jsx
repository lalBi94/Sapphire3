import { useId, useState } from 'react'
import { buildLinkLayer } from '../../utils/canvasLinks.js'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './CanvasLinks.css'

// Résumé textuel d'un lien : ce que le module récepteur utilise vraiment chez l'exportateur.
function linkSummary(link, t) {
  const items = link.exports.map((entry) => (entry.localName && entry.localName !== entry.name ? `${entry.name} → ${entry.localName}` : entry.name)).join(', ')
  return `${link.fromName} → ${link.toName} · ${t('link.usedBy', { module: link.toName })} : ${items}`
}

// Trace les dépendances réelles entre modules : une flèche part de l'exportateur et entre dans le récepteur.
export default function CanvasLinks({ cards, links, camera, zoom }) {
  const { t } = useTranslation()
  const markerId = useId().replace(/:/g, '')
  const [hoveredId, setHoveredId] = useState(null)
  const layer = buildLinkLayer(cards, links)
  if (!layer) return null
  const hovered = layer.edges.find((edge) => edge.link.id === hoveredId) ?? null

  return <>
    <div className="canvas-links" data-canvas-ui aria-hidden="true" style={{
      left: `calc(50% + ${(layer.left - camera.x) * zoom}px)`,
      top: `calc(50% + ${(layer.top - camera.y) * zoom}px)`,
      width: layer.width,
      height: layer.height,
      transform: `scale(${zoom})`,
    }}>
      <svg className="canvas-links__surface" width={layer.width} height={layer.height} viewBox={`0 0 ${layer.width} ${layer.height}`}>
        <defs>
          <marker id={markerId} markerWidth="12" markerHeight="12" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse">
            <path className="canvas-links__head" d="M0 1.5L11 6L0 10.5Z" />
          </marker>
          <marker id={`${markerId}-hover`} markerWidth="12" markerHeight="12" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse">
            <path className="canvas-links__head canvas-links__head--hover" d="M0 1.5L11 6L0 10.5Z" />
          </marker>
        </defs>
        <g transform={`translate(${-layer.left} ${-layer.top})`}>
          {layer.edges.map(({ link, d }) => <g key={link.id} className={`canvas-links__link${hoveredId === link.id ? ' canvas-links__link--hovered' : ''}`}>
            <path className="canvas-links__line" d={d} vectorEffect="non-scaling-stroke" markerEnd={`url(#${hoveredId === link.id ? `${markerId}-hover` : markerId})`} />
            <path className="canvas-links__hit" d={d} vectorEffect="non-scaling-stroke" onPointerEnter={() => setHoveredId(link.id)} onPointerLeave={() => setHoveredId((current) => current === link.id ? null : current)} />
          </g>)}
        </g>
      </svg>
    </div>
    {hovered && <div className="canvas-links__tip" style={{
      left: `calc(50% + ${(hovered.x - camera.x) * zoom}px)`,
      top: `calc(50% + ${(hovered.y - camera.y) * zoom}px)`,
    }}>
      <p className="canvas-links__route">{hovered.link.fromName} <span aria-hidden="true">→</span> {hovered.link.toName}</p>
      <p className="canvas-links__hint">{t('link.usedBy', { module: hovered.link.toName })}</p>
      <ul>{hovered.link.exports.map((entry) => <li key={entry.nodeId}>
        <strong>{entry.name}</strong>
        {entry.localName && entry.localName !== entry.name && <span>{t('link.alias', { name: entry.localName })}</span>}
        <span>{t(entry.uses === 1 ? 'link.use' : 'link.uses', { count: entry.uses })}</span>
      </li>)}
      </ul>
    </div>}
    <ul className="canvas-links__list">{layer.edges.map(({ link }) => <li key={link.id}>{linkSummary(link, t)}</li>)}</ul>
  </>
}
