import { Puzzle, Trash2 } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import { typeLabel } from '../LogicTree/logicLabels.js'
import { formatPluginText, resolvePluginSource, resolvePluginWidgetInstance } from '../../utils/plugins/pluginWidgets.js'
import './PluginWidgetCard.css'

// Compare deux types sérialisés pour filtrer les callbacks proposés.
function samePluginType(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

// Affiche une valeur numérique avec une précision bornée, ou le texte fourni.
function displayValue(value, precision) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number' && Number.isInteger(precision)) return value.toFixed(precision)
  if (typeof value === 'number' && Number.isFinite(value)) return String(Number(value.toFixed(3)))
  return String(value)
}

// Rend l'arbre déclaratif d'un widget sans accepter de HTML ni de composant arbitraire.
function RendererNode({ node, context, onInteraction }) {
  if (!node) return null
  if (node.kind === 'stack') return <div className="plugin-widget-card__stack">{node.children.map((child, index) => <RendererNode key={index} node={child} context={context} onInteraction={onInteraction} />)}</div>
  if (node.kind === 'row') return <div className="plugin-widget-card__row">{node.children.map((child, index) => <RendererNode key={index} node={child} context={context} onInteraction={onInteraction} />)}</div>
  if (node.kind === 'text') return <p className="plugin-widget-card__text">{formatPluginText(node.text, context)}</p>
  if (node.kind === 'divider') return <hr className="plugin-widget-card__divider" />
  if (node.kind === 'spacer') return <span className="plugin-widget-card__spacer" aria-hidden="true" />
  if (node.kind === 'value') {
    const value = resolvePluginSource(node.source, context)
    return <div className="plugin-widget-card__value">
      {node.label && <span className="plugin-widget-card__label">{formatPluginText(node.label, context)}</span>}
      <strong className="plugin-widget-card__number">{displayValue(value, node.precision)}{node.suffix ? ` ${formatPluginText(node.suffix, context)}` : ''}</strong>
    </div>
  }
  if (node.kind === 'bar') {
    const value = Number(resolvePluginSource(node.source, context))
    const minimum = Number.isFinite(node.min) ? node.min : 0
    const maximum = Number.isFinite(node.max) && node.max > minimum ? node.max : 100
    const percent = Number.isFinite(value) ? Math.max(0, Math.min(100, ((value - minimum) / (maximum - minimum)) * 100)) : 0
    return <div className="plugin-widget-card__bar">
      {node.label && <span className="plugin-widget-card__label">{formatPluginText(node.label, context)}</span>}
      <span className="plugin-widget-card__bar-track" role="meter" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Number.isFinite(value) ? value : minimum}><span className="plugin-widget-card__bar-fill" style={{ width: `${percent}%` }} /></span>
    </div>
  }
  if (node.kind === 'led') {
    const value = resolvePluginSource(node.source, context)
    const active = typeof value === 'boolean' ? value : Number(value) > 0
    return <div className="plugin-widget-card__led-row">
      <span className={`plugin-widget-card__led${active ? ' plugin-widget-card__led--on' : ''}`} aria-hidden="true" />
      {node.label && <span className="plugin-widget-card__label">{formatPluginText(node.label, context)}</span>}
    </div>
  }
  if (node.kind === 'input' || node.kind === 'button') {
    const interaction = context.interactions.get(node.interaction)
    if (!interaction) return null
    if (node.kind === 'button') return <button type="button" className="plugin-widget-card__button" onClick={() => onInteraction(interaction, interaction.value ?? true)}>{interaction.label}</button>
    const stateKey = interaction.stateKey ?? interaction.id
    const current = Number(context.instance.state[stateKey] ?? interaction.min ?? 0)
    return <label className="plugin-widget-card__slider">
      <span className="plugin-widget-card__label">{interaction.label}<output>{displayValue(current, interaction.step < 1 ? 2 : 0)}</output></span>
      <input type="range" min={interaction.min} max={interaction.max} step={interaction.step} value={current} onChange={(event) => onInteraction(interaction, Number(event.target.value))} />
    </label>
  }
  return null
}

// Rend un widget de plugin ou un diagnostic de dépendance manquante, sans détruire la carte.
export default function PluginWidgetCard({ card, entry, inputs = {}, variables = [], callbackFunctions = [], readOnly = false, onStateChange, onPropertyChange, onBindInput, onBindOutput, onTrigger, onRemove }) {
  const { t } = useTranslation()
  if (!entry) {
    return <div className="plugin-widget-card plugin-widget-card--missing" role="status">
      <div className="plugin-widget-card__missing-head"><Puzzle size={18} aria-hidden="true" /><strong>{t('plugins.widgetMissing')}</strong></div>
      <p>{t('plugins.widgetMissingHint')}</p>
      <code>{card.pluginId}/{card.widgetId}</code>
      {!readOnly && <button type="button" className="plugin-widget-card__remove" onClick={() => onRemove?.(card.id)}><Trash2 size={13} aria-hidden="true" />{t('plugins.removeCard')}</button>}
    </div>
  }
  const widget = entry.widget
  const instance = resolvePluginWidgetInstance(card, widget)
  const interactions = new Map((widget.interactions ?? []).map((interaction) => [interaction.id, interaction]))
  const context = { widget, card, instance, inputs, interactions }
  const variableNames = [...new Set(variables.map((variable) => variable.name))].sort((left, right) => left.localeCompare(right))
  const outputCallbacks = (widget.outputs ?? []).map((port) => ({
    port,
    options: callbackFunctions.filter((callback) => callback.type?.kind === 'function' && callback.type.parameters?.length === 1 && callback.type.returnType?.name === 'void' && samePluginType(callback.type.parameters[0], port.type)),
  }))
  const hasConfiguration = (widget.properties?.length ?? 0) > 0 || (widget.inputs?.length ?? 0) > 0 || (widget.outputs?.length ?? 0) > 0

  // Met à jour l'état du widget puis émet la valeur de sortie déclarée.
  function handleInteraction(interaction, value) {
    if (readOnly) return
    const stateKey = interaction.stateKey ?? interaction.id
    onStateChange?.(card.id, { ...instance.state, [stateKey]: value })
    if (interaction.output) onTrigger?.(card.id, interaction.output, value)
  }

  return <div className="plugin-widget-card">
    <div className="plugin-widget-card__body">
      <RendererNode node={widget.renderer} context={context} onInteraction={handleInteraction} />
    </div>
    {!readOnly && hasConfiguration && <details className="plugin-widget-card__configuration">
      <summary>{t('plugins.configuration')}</summary>
      {(widget.properties?.length ?? 0) > 0 && <div className="plugin-widget-card__fields">
        {widget.properties.map((property) => {
          const value = instance.properties[property.id]
          if (property.type === 'boolean') return <label key={property.id} className="plugin-widget-card__check"><input type="checkbox" checked={value === true} onChange={(event) => onPropertyChange?.(card.id, { ...instance.properties, [property.id]: event.target.checked })} />{property.label}</label>
          if (property.type === 'select') return <label key={property.id} className="plugin-widget-card__field"><span>{property.label}</span><select value={value} onChange={(event) => onPropertyChange?.(card.id, { ...instance.properties, [property.id]: event.target.value })}>{property.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          if (property.type === 'color') return <label key={property.id} className="plugin-widget-card__field"><span>{property.label}</span><input type="color" value={value} onChange={(event) => onPropertyChange?.(card.id, { ...instance.properties, [property.id]: event.target.value })} /></label>
          return <label key={property.id} className="plugin-widget-card__field"><span>{property.label}</span><input type={property.type === 'string' ? 'text' : 'number'} step={property.type === 'int' ? 1 : 'any'} value={value} onChange={(event) => onPropertyChange?.(card.id, { ...instance.properties, [property.id]: property.type === 'string' ? event.target.value : Number(event.target.value) })} /></label>
        })}
      </div>}
      {(widget.inputs?.length ?? 0) > 0 && <div className="plugin-widget-card__bindings">
        <p className="plugin-widget-card__section">{t('plugins.inputs')}</p>
        {widget.inputs.map((port) => <label key={port.id} className="plugin-widget-card__binding">
          <span>{port.name}<small>{typeLabel(port.type, t)}</small></span>
          <select value={instance.bindings.inputs[port.id] ?? ''} onChange={(event) => onBindInput?.(card.id, port.id, event.target.value)}>
            <option value="">{t('plugins.noBinding')}</option>
            {variableNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>)}
      </div>}
      {(widget.outputs?.length ?? 0) > 0 && <div className="plugin-widget-card__bindings">
        <p className="plugin-widget-card__section">{t('plugins.outputs')}</p>
        {outputCallbacks.map(({ port, options }) => <label key={port.id} className="plugin-widget-card__binding">
          <span>{port.name}<small>{typeLabel(port.type, t)}</small></span>
          <select value={instance.bindings.outputs[port.id] ?? ''} onChange={(event) => onBindOutput?.(card.id, port.id, event.target.value)}>
            <option value="">{t('plugins.noBinding')}</option>
            {options.map((callback) => <option key={callback.id} value={callback.id}>{callback.label}</option>)}
          </select>
        </label>)}
      </div>}
      <button type="button" className="plugin-widget-card__remove" onClick={() => onRemove?.(card.id)}><Trash2 size={13} aria-hidden="true" />{t('plugins.removeCard')}</button>
    </details>}
  </div>
}
