import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronUp, Eye, EyeOff, Power, PowerOff, RotateCcw, SlidersHorizontal } from 'lucide-react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { screenPlaybackFrameDelay } from '../../utils/screenPlayback.js'
import { oscilloscopeColor } from '../../utils/oscilloscopeColors.js'
import './OscilloscopeCard.css'

const defaultChannelSettings = Object.freeze({ visible: true, enabled: true, amplitude: 1, offset: 0 })
const minimumSpan = 1e-9

// Construit le domaine X commun à partir de la fenêtre et du nombre d'échantillons.
function buildXValues(xMin, xMax, samples) {
  const count = Math.max(2, Math.trunc(samples) || 2)
  const values = new Array(count)
  const span = xMax - xMin
  for (let index = 0; index < count; index += 1) {
    values[index] = xMin + (span * index) / (count - 1)
  }
  return values
}

// Applique l'amplitude, l'offset et le gain global à un canal, sans toucher aux données du moteur.
function displayValues(values, setting, stretch) {
  const amplitude = Number.isFinite(setting?.amplitude) ? setting.amplitude : 1
  const offset = Number.isFinite(setting?.offset) ? setting.offset : 0
  return values.map((value) => value == null || !Number.isFinite(value) ? null : value * amplitude * stretch + offset)
}

// Vérifie qu'un canal doit être tracé à l'écran.
function isChannelVisible(setting) {
  return (setting?.visible ?? defaultChannelSettings.visible) !== false && (setting?.enabled ?? defaultChannelSettings.enabled) !== false
}

// Affiche un nombre lisible dans le curseur de lecture.
function formatNumber(value) {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 1000) / 1000)
}

// Oscilloscope multicanal : uPlot trace le signal, la carte fournit les commandes de l'instrument.
export default function OscilloscopeCard({ card, state = null, frames = null, playing = false }) {
  const { t } = useTranslation()
  const [frameIndex, setFrameIndex] = useState(0)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [settings, setSettings] = useState({})
  const [collapsed, setCollapsed] = useState(false)
  const [stretch, setStretch] = useState(1)
  const playbackRef = useRef(0)
  const chartRef = useRef(null)
  const cursorRef = useRef(null)
  const uplotRef = useRef(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const lastRevisionRef = useRef(-1)

  // Une nouvelle série d'images repart de la première.
  useEffect(() => {
    playbackRef.current = 0
    setFrameIndex(0)
  }, [frames])

  // Suit les images d'écran au même rythme que les autres widgets.
  useEffect(() => {
    if (!frames?.length || !playing) return undefined
    const timer = window.setInterval(() => {
      playbackRef.current = (playbackRef.current + 1) % frames.length
      setFrameIndex(playbackRef.current)
    }, screenPlaybackFrameDelay)
    return () => window.clearInterval(timer)
  }, [frames, playing])

  // Mesure la zone centrale pour redimensionner uPlot sans recréer le graphique.
  useEffect(() => {
    const node = chartRef.current
    if (!node) return undefined
    // Mesure immédiate puis suivi des changements : la carte peut être montée avant sa mise en page.
    const measure = () => {
      const rect = node.getBoundingClientRect()
      const next = { width: Math.max(0, Math.round(rect.width)), height: Math.max(0, Math.round(rect.height)) }
      sizeRef.current = next
      setSize(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const animated = frames?.length ? frames[Math.min(frameIndex, frames.length - 1)]?.[card.id] ?? null : null
  const current = animated ?? state
  const channels = current?.channels ?? []
  const channelKey = channels.map((channel) => channel.id).join(',')
  const samples = Math.max(2, Math.trunc(Number(current?.samples) || Number(card.oscilloscope?.samples) || 64))
  const xMin = Number.isFinite(current?.xMin) ? current.xMin : -10
  const xMax = Number.isFinite(current?.xMax) && current.xMax > xMin ? current.xMax : xMin + 1
  const revision = current?.revision ?? 0
  const label = card.name || t('card.oscilloscope')
  const ready = size.width > 0 && size.height > 0
  const xValues = useMemo(() => buildXValues(xMin, xMax, samples), [xMin, xMax, samples])
  const series = useMemo(() => channels.map((channel) => displayValues(channel.values, settings[channel.id], stretch)), [channels, settings, stretch])
  const data = useMemo(() => [xValues, ...series], [xValues, series])

  // Ajoute les réglages par défaut des nouveaux canaux et oublie les canaux retirés.
  useEffect(() => {
    setSettings((previous) => {
      const next = {}
      for (const channel of channels) next[channel.id] = previous[channel.id] ?? { ...defaultChannelSettings }
      return next
    })
  }, [channelKey])

  // Calcule les bornes Y visibles, avec une marge, pour la remise à zéro de la vue.
  function dataBounds() {
    let minimum = Infinity
    let maximum = -Infinity
    for (const [index, channel] of channels.entries()) {
      if (!isChannelVisible(settings[channel.id])) continue
      const values = series[index] ?? []
      for (const value of values) {
        if (value == null || !Number.isFinite(value)) continue
        if (value < minimum) minimum = value
        if (value > maximum) maximum = value
      }
    }
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return { min: -1, max: 1 }
    if (maximum - minimum < minimumSpan) return { min: minimum - 1, max: maximum + 1 }
    const padding = (maximum - minimum) * 0.1
    return { min: minimum - padding, max: maximum + padding }
  }

  // Remet la fenêtre X et les bornes Y visibles à leur valeur naturelle.
  function resetView() {
    const plot = uplotRef.current
    if (!plot) return
    const bounds = dataBounds()
    plot.setScale('x', { min: xMin, max: xMax })
    plot.setScale('y', bounds)
  }

  // Zoome un axe autour de son centre, indépendamment de l'autre.
  function zoomAxis(axis, factor) {
    const plot = uplotRef.current
    if (!plot) return
    const scale = plot.scales[axis]
    if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return
    const span = scale.max - scale.min
    if (!(span > minimumSpan)) return
    const center = (scale.min + scale.max) / 2
    const next = (span * factor) / 2
    plot.setScale(axis, { min: center - next, max: center + next })
  }

  // Déplace la fenêtre d'un axe sans modifier son étendue.
  function panAxis(axis, fraction) {
    const plot = uplotRef.current
    if (!plot) return
    const scale = plot.scales[axis]
    if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return
    const span = scale.max - scale.min
    if (!(span > minimumSpan)) return
    const delta = span * fraction
    plot.setScale(axis, { min: scale.min + delta, max: scale.max + delta })
  }

  // Met à jour un réglage purement visuel d'un canal.
  function updateSetting(id, key, value) {
    setSettings((previous) => ({
      ...previous,
      [id]: { ...(previous[id] ?? defaultChannelSettings), [key]: value },
    }))
  }

  // Met à jour le curseur de lecture sans provoquer de rendu React à chaque mouvement.
  function updateCursor(plot) {
    const node = cursorRef.current
    if (!node) return
    const index = plot.cursor?.idx
    if (!Number.isInteger(index) || !Array.isArray(plot.data?.[0])) {
      node.textContent = t('oscilloscope.cursorHint')
      return
    }
    const x = plot.data[0][index]
    const parts = [`x ${formatNumber(x)}`]
    for (let position = 1; position < plot.series.length; position += 1) {
      if (plot.series[position]?.show === false) continue
      parts.push(`${t('oscilloscope.channel', { index: position })} ${formatNumber(plot.data[position]?.[index])}`)
    }
    node.textContent = parts.join(' · ')
  }

  // Crée uPlot une seule fois par liste de canaux, puis le laisse gérer son zoom interne.
  useEffect(() => {
    const container = chartRef.current
    if (!container || !ready || channels.length === 0) return undefined
    const computed = getComputedStyle(container)
    const textColor = computed.getPropertyValue('--color-text-muted').trim() || '#b5b2c2'
    const gridColor = computed.getPropertyValue('--color-grid').trim() || '#ffffff14'
    const borderColor = computed.getPropertyValue('--color-border').trim() || '#ffffff24'
    const bounds = dataBounds()
    const plot = new uPlot({
      width: Math.max(1, sizeRef.current.width),
      height: Math.max(1, sizeRef.current.height),
      padding: [8, 8, 0, 0],
      cursor: {
        drag: { x: true, y: true, setScale: true },
        points: { show: false },
        focus: { prox: 16 },
      },
      legend: { show: false },
      scales: {
        x: { time: false, min: xMin, max: xMax },
        y: { min: bounds.min, max: bounds.max },
      },
      axes: [
        { stroke: textColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: borderColor, width: 1 } },
        { stroke: textColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: borderColor, width: 1 } },
      ],
      series: [
        {},
        ...channels.map((channel, index) => ({
          label: t('oscilloscope.channel', { index: index + 1 }),
          stroke: oscilloscopeColor(channel.id),
          width: 2,
          show: isChannelVisible(settings[channel.id]),
        })),
      ],
      hooks: {
        setCursor: [(self) => updateCursor(self)],
      },
    }, data, container)
    uplotRef.current = plot
    lastRevisionRef.current = revision
    updateCursor(plot)

    let pan = null
    // Molette : zoom X, ou zoom Y avec Maj.
    function handleWheel(event) {
      event.preventDefault()
      const axis = event.shiftKey ? 'y' : 'x'
      const scale = plot.scales[axis]
      if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max)) return
      const rect = plot.over.getBoundingClientRect()
      const position = axis === 'x' ? event.clientX - rect.left : event.clientY - rect.top
      const value = plot.posToVal(position, axis)
      const span = scale.max - scale.min
      if (!(span > minimumSpan)) return
      const ratio = (value - scale.min) / span
      const next = span * (event.deltaY > 0 ? 1.2 : 0.8)
      const min = value - ratio * next
      plot.setScale(axis, { min, max: min + next })
    }
    // Maj + glisser : déplacement horizontal et vertical du signal.
    function handlePointerDown(event) {
      if (!event.shiftKey || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      pan = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        xMin: plot.scales.x.min,
        xMax: plot.scales.x.max,
        yMin: plot.scales.y.min,
        yMax: plot.scales.y.max,
      }
      plot.over.setPointerCapture(event.pointerId)
    }
    function handlePointerMove(event) {
      if (!pan || pan.pointerId !== event.pointerId) return
      const rect = plot.over.getBoundingClientRect()
      const dx = ((event.clientX - pan.x) / Math.max(1, rect.width)) * (pan.xMax - pan.xMin)
      const dy = ((event.clientY - pan.y) / Math.max(1, rect.height)) * (pan.yMax - pan.yMin)
      plot.setScale('x', { min: pan.xMin - dx, max: pan.xMax - dx })
      plot.setScale('y', { min: pan.yMin + dy, max: pan.yMax + dy })
    }
    function handlePointerUp(event) {
      if (!pan || pan.pointerId !== event.pointerId) return
      pan = null
      if (plot.over.hasPointerCapture(event.pointerId)) plot.over.releasePointerCapture(event.pointerId)
    }
    plot.over.addEventListener('wheel', handleWheel, { passive: false })
    plot.over.addEventListener('pointerdown', handlePointerDown, true)
    plot.over.addEventListener('pointermove', handlePointerMove, true)
    plot.over.addEventListener('pointerup', handlePointerUp, true)
    plot.over.addEventListener('pointercancel', handlePointerUp, true)

    return () => {
      plot.over.removeEventListener('wheel', handleWheel)
      plot.over.removeEventListener('pointerdown', handlePointerDown, true)
      plot.over.removeEventListener('pointermove', handlePointerMove, true)
      plot.over.removeEventListener('pointerup', handlePointerUp, true)
      plot.over.removeEventListener('pointercancel', handlePointerUp, true)
      plot.destroy()
      if (uplotRef.current === plot) uplotRef.current = null
    }
  }, [channelKey, ready])

  // Met à jour les données et la visibilité sans réinitialiser le zoom de l'utilisateur.
  useEffect(() => {
    const plot = uplotRef.current
    if (!plot) return
    plot.setData(data, false)
    channels.forEach((channel, index) => plot.setSeries(index + 1, { show: isChannelVisible(settings[channel.id]) }))
    if (revision !== lastRevisionRef.current) {
      lastRevisionRef.current = revision
      plot.setScale('x', { min: xMin, max: xMax })
      plot.setScale('y', dataBounds())
    }
  }, [data, settings, revision, xMin, xMax, channelKey])

  // Applique les nouvelles dimensions sans recréer le graphique.
  useEffect(() => {
    const plot = uplotRef.current
    if (!plot || size.width <= 0 || size.height <= 0) return
    plot.setSize({ width: size.width, height: size.height })
  }, [size])

  const stopPointer = (event) => event.stopPropagation()

  return <div className={`oscilloscope-card${collapsed ? ' oscilloscope-card--collapsed' : ''}`} role="group" aria-label={t('oscilloscope.summary', { name: label, count: channels.length })}>
    {!collapsed && <div className="oscilloscope-card__toolbar" onPointerDown={stopPointer} onClick={stopPointer}>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.resetView')} title={t('oscilloscope.resetView')} onClick={resetView}>
        <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.zoomOutX')} title={t('oscilloscope.zoomOutX')} onClick={() => zoomAxis('x', 1.25)}>X−</button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.zoomInX')} title={t('oscilloscope.zoomInX')} onClick={() => zoomAxis('x', 0.8)}>X+</button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.zoomOutY')} title={t('oscilloscope.zoomOutY')} onClick={() => zoomAxis('y', 1.25)}>Y−</button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.zoomInY')} title={t('oscilloscope.zoomInY')} onClick={() => zoomAxis('y', 0.8)}>Y+</button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.panLeft')} title={t('oscilloscope.panLeft')} onClick={() => panAxis('x', -0.15)}><ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.panRight')} title={t('oscilloscope.panRight')} onClick={() => panAxis('x', 0.15)}><ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.panUp')} title={t('oscilloscope.panUp')} onClick={() => panAxis('y', 0.15)}><ArrowUp size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      <button type="button" className="oscilloscope-card__icon" aria-label={t('oscilloscope.panDown')} title={t('oscilloscope.panDown')} onClick={() => panAxis('y', -0.15)}><ArrowDown size={14} strokeWidth={1.8} aria-hidden="true" /></button>
      <label className="oscilloscope-card__stretch">
        <span>{t('oscilloscope.stretch')}</span>
        <input type="range" min="0.25" max="4" step="0.25" value={stretch} aria-label={t('oscilloscope.stretch')} onChange={(event) => setStretch(Number(event.target.value))} />
      </label>
      <button type="button" className="oscilloscope-card__icon oscilloscope-card__icon--end" aria-label={t('oscilloscope.hideControls')} title={t('oscilloscope.hideControls')} onClick={() => setCollapsed(true)}>
        <ChevronUp size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>}
    <div className="oscilloscope-card__body">
      {!collapsed && <div className="oscilloscope-card__channels" onPointerDown={stopPointer} onClick={stopPointer}>
        {channels.length === 0
          ? <p className="oscilloscope-card__empty-note">{t('oscilloscope.empty')}</p>
          : channels.map((channel, index) => {
            const setting = settings[channel.id] ?? defaultChannelSettings
            return <div className={`oscilloscope-card__channel${isChannelVisible(setting) ? '' : ' oscilloscope-card__channel--off'}`} key={channel.id}>
              <span className="oscilloscope-card__swatch" style={{ background: oscilloscopeColor(channel.id) }} aria-hidden="true" />
              <span className="oscilloscope-card__channel-name">{t('oscilloscope.channel', { index: index + 1 })}</span>
              <button type="button" className="oscilloscope-card__toggle" aria-pressed={setting.visible} aria-label={t(setting.visible ? 'oscilloscope.hideChannel' : 'oscilloscope.showChannel', { index: index + 1 })} title={t(setting.visible ? 'oscilloscope.hideChannel' : 'oscilloscope.showChannel', { index: index + 1 })} onClick={() => updateSetting(channel.id, 'visible', !setting.visible)}>
                {setting.visible ? <Eye size={13} strokeWidth={1.8} aria-hidden="true" /> : <EyeOff size={13} strokeWidth={1.8} aria-hidden="true" />}
              </button>
              <button type="button" className="oscilloscope-card__toggle" aria-pressed={setting.enabled} aria-label={t(setting.enabled ? 'oscilloscope.disableChannel' : 'oscilloscope.enableChannel', { index: index + 1 })} title={t(setting.enabled ? 'oscilloscope.disableChannel' : 'oscilloscope.enableChannel', { index: index + 1 })} onClick={() => updateSetting(channel.id, 'enabled', !setting.enabled)}>
                {setting.enabled ? <Power size={13} strokeWidth={1.8} aria-hidden="true" /> : <PowerOff size={13} strokeWidth={1.8} aria-hidden="true" />}
              </button>
              <label className="oscilloscope-card__range">
                <span>{t('oscilloscope.amplitude')}</span>
                <input type="range" min="0.1" max="3" step="0.1" value={setting.amplitude} aria-label={`${t('oscilloscope.amplitude')} ${index + 1}`} onChange={(event) => updateSetting(channel.id, 'amplitude', Number(event.target.value))} />
                <b>{setting.amplitude.toFixed(1)}</b>
              </label>
              <label className="oscilloscope-card__range">
                <span>{t('oscilloscope.offset')}</span>
                <input type="range" min="-5" max="5" step="0.1" value={setting.offset} aria-label={`${t('oscilloscope.offset')} ${index + 1}`} onChange={(event) => updateSetting(channel.id, 'offset', Number(event.target.value))} />
                <b>{setting.offset.toFixed(1)}</b>
              </label>
            </div>
          })}
      </div>}
      <div className="oscilloscope-card__chart-wrap">
        <div className="oscilloscope-card__chart" ref={chartRef} role="img" aria-label={t('oscilloscope.summary', { name: label, count: channels.length })} />
        {collapsed && <button type="button" className="oscilloscope-card__expand" aria-label={t('oscilloscope.showControls')} title={t('oscilloscope.showControls')} onClick={() => setCollapsed(false)}>
          <SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>}
        {channels.length === 0 && <p className="oscilloscope-card__empty">{t('oscilloscope.empty')}</p>}
      </div>
    </div>
    {!collapsed && <p className="oscilloscope-card__cursor" ref={cursorRef}>{t('oscilloscope.cursorHint')}</p>}
  </div>
}
