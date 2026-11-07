import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { appVersion } from '../../utils/appInfo.js'
import './CanvasHud.css'

// Réduit une chaîne en un code hexadécimal court, stable pour un même état.
function artifactCode(seed) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4)
}

// Formate une coordonnée sans dépasser la largeur du HUD.
function formatCoordinate(value) {
  const rounded = Math.round(value)
  return Math.abs(rounded) >= 10000 ? `${Math.round(rounded / 1000)}k` : String(rounded)
}

// Affiche les artefacts texte du HUD : version, télémétrie de vue, état du thème et astuces.
export default function CanvasHud({ camera, zoom, semanticLevel = 'detail', moduleCount = 0, nodeCount = 0, gridVisible = true, magnetEnabled = true }) {
  const { t } = useTranslation()
  const { theme, themeMode } = useTheme()
  const tips = ['hud.tip.create', 'hud.tip.save', 'hud.tip.search', 'hud.tip.undo', 'hud.tip.pan', 'hud.tip.theme']
  const tip = tips[(moduleCount * 7 + nodeCount * 13 + (gridVisible ? 1 : 0)) % tips.length]
  const zoomPercent = Math.round(zoom * 100)
  const liveSignal = artifactCode(`${formatCoordinate(camera.x)}:${formatCoordinate(camera.y)}:${zoomPercent}`)
  const buildSignal = artifactCode(`${appVersion}:${moduleCount}:${nodeCount}`)
  const themeLabel = theme.custom ? theme.name : t(theme.labelKey)
  const modeLabel = t(themeMode === 'light' ? 'theme.modeLight' : 'theme.modeDark')
  const stateLabel = (enabled) => t(enabled ? 'hud.on' : 'hud.off')

  return (
    <div className="canvas-hud" aria-hidden="true">
      <span className="canvas-hud__watermark">SAPPHIRE</span>
      <span className="canvas-hud__rail canvas-hud__rail--left">SP3 // AST // v{appVersion} // 0x{buildSignal}</span>
      <span className="canvas-hud__rail canvas-hud__rail--right">0x{liveSignal} // {semanticLevel.toUpperCase()} // {zoomPercent}%</span>

      <div className="canvas-hud__corner canvas-hud__corner--tl">
        <span className="canvas-hud__eyebrow">SP3 // {t('hud.surface')}</span>
        <span>{t('hud.build')} v{appVersion}</span>
        <span className="canvas-hud__online"><i className="canvas-hud__dot" />{t('hud.online')}</span>
      </div>

      <div className="canvas-hud__corner canvas-hud__corner--tr">
        <span>{t('settings.info.modules')} {String(moduleCount).padStart(2, '0')}</span>
        <span>{t('settings.info.nodes')} {String(nodeCount).padStart(2, '0')}</span>
        <span>{t('nav.zoom')} {zoomPercent}%</span>
        <span>{t('hud.mode')} {t(`canvas.semantic.${semanticLevel}`)}</span>
      </div>

      <div className="canvas-hud__corner canvas-hud__corner--ml">
        <span className="canvas-hud__eyebrow">{t('hud.tip')}</span>
        <span>{t(tip)}</span>
        <span className="canvas-hud__signal">{t('hud.signal')} 0x{liveSignal}</span>
      </div>

      <div className="canvas-hud__corner canvas-hud__corner--mr">
        <span>{t('nav.theme')} {themeLabel}</span>
        <span>{modeLabel}</span>
        <span>{t('hud.grid')} {stateLabel(gridVisible)}</span>
        <span>{t('hud.snap')} {stateLabel(magnetEnabled)}</span>
        <span>SCHEMA v3</span>
      </div>
    </div>
  )
}
