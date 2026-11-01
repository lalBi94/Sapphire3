import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { resolveContext, getNodeSchema } from '../../utils/logic/index.js'
import { diagnosticLabel, kindLabel, nodeSummary, slotLabel } from '../LogicTree/logicLabels.js'
import { ancestorNodeIds } from '../../utils/nodeTree.js'
import NodeForm from '../NodeForm/NodeForm.jsx'
import ModuleNameForm from './ModuleNameForm.jsx'
import ModuleInterface from './ModuleInterface.jsx'
import NodeCodePreview from './NodeCodePreview.jsx'
import FloatingPanel from '../FloatingPanel/FloatingPanel.jsx'
import DeleteAction from '../DeleteAction/DeleteAction.jsx'
import { useTranslation } from '../../contexts/LanguageContext.jsx'
import './NodeProperties.css'

// Construit une étiquette courte pour un élément de la hiérarchie.
function hierarchyLabel(record, t) {
  const name = record?.properties?.name
  const kind = kindLabel(record?.kind ?? '', t)
  return name ? `${name} · ${kind}` : kind
}

// Compose le fil d'Ariane du nœud : module, puis chaque ancêtre parlant jusqu'au nœud sélectionné.
function nodeTrail(index, nodeId, t) {
  const node = index.nodes.get(nodeId)
  if (!node) return []
  const module = index.modules.get(node.moduleId)
  const labels = ancestorNodeIds(index, nodeId)
    .filter((id) => id === nodeId || index.nodes.get(id)?.kind !== 'Block')
    .map((id) => {
      const record = index.nodes.get(id)
      return record?.properties?.name || kindLabel(record?.kind ?? '', t)
    })
  return [...(module ? [module.name || t('card.module')] : []), ...labels]
}

// Rend récursivement les descendants source sans laisser un cycle bloquer le panneau.
function HierarchyNode({ id, index, selected, onSelect, ancestors = [] }) {
  const { t } = useTranslation()
  const node = index.nodes.get(id)
  if (!node || ancestors.includes(id) || ancestors.length >= 60) return null
  const childIds = Object.values(node.children ?? {}).flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
  const summary = nodeSummary(node, index, getNodeSchema(node.kind), t)
  return <li>
    <button type="button" className={`node-properties__hierarchy-item${selected?.kind === 'node' && selected.id === id ? ' node-properties__hierarchy-item--selected' : ''}`} aria-current={selected?.kind === 'node' && selected.id === id ? 'true' : undefined} onClick={() => onSelect({ kind: 'node', id })}>
      <span><strong>{hierarchyLabel(node, t)}</strong>{summary && <small>{summary}</small>}</span>
      {childIds.length > 0 && <small>{childIds.length}</small>}
    </button>
    {childIds.length > 0 && <ul>{childIds.map((childId, position) => <HierarchyNode key={`${childId}:${position}`} id={childId} index={index} selected={selected} onSelect={onSelect} ancestors={[...ancestors, id]} />)}</ul>}
  </li>
}

// Affiche tous les modules et leurs blocs sous forme compacte et navigable.
function ProjectHierarchy({ project, index, selected, onSelect, t }) {
  return <section className="node-properties__hierarchy" aria-label={t('details.hierarchy')}>
    <h3>{t('details.hierarchy')}</h3>
    {project.modules.length === 0 ? <p>{t('details.noModules')}</p> : <ul>{project.modules.map((module) => <li key={module.id}>
      <button type="button" className={`node-properties__hierarchy-item node-properties__hierarchy-module${selected?.kind === 'module' && selected.id === module.id ? ' node-properties__hierarchy-item--selected' : ''}`} aria-current={selected?.kind === 'module' && selected.id === module.id ? 'true' : undefined} onClick={() => onSelect({ kind: 'module', id: module.id })}>
        <span>{module.name}</span>{module.rootNodeIds.length > 0 && <small>{module.rootNodeIds.length}</small>}
      </button>
      {module.rootNodeIds.length > 0 && <ul>{module.rootNodeIds.map((id, position) => <HierarchyNode key={`${id}:${position}`} id={id} index={index} selected={selected} onSelect={onSelect} />)}</ul>}
    </li>)}</ul>}
  </section>
}

// Affiche les propriétés et l'extrait de code dans le cadre flottant commun aux analyses.
export default function NodeProperties({ selected, project, index, onConfigure, onRename, onSelect, onDelete, onDeleteModule, onExport, onImport, onRemoveImport, onClose, mutationError }) {
  const { t } = useTranslation()
  const context = resolveContext(project, selected, undefined, index)
  const record = context.record
  const schema = selected.kind === 'node' && record ? getNodeSchema(record.kind) : null
  const diagnostics = index.analysis.diagnostics.filter((entry) => selected.kind === 'module' ? entry.location.moduleId === selected.id : entry.location.nodeId === selected.id)
  const configurable = schema && (schema.named || schema.declaresType || schema.declaresElementType || ['BinaryExpression', 'UnaryExpression', 'Reference'].includes(record.kind))
  const title = selected.kind === 'module' ? t('details.module') : record ? kindLabel(record.kind, t) : t('details.block')
  const trail = selected.kind === 'node' ? nodeTrail(index, selected.id, t) : []

  return <FloatingPanel className="node-properties" title={title} label={t('details.title')} onClose={onClose}>
    {trail.length > 1 && <nav className="node-properties__breadcrumb" aria-label={t('details.breadcrumb')}>
      {trail.map((label, position) => <Fragment key={position}>
        {position > 0 && <ChevronRight size={12} strokeWidth={2} aria-hidden="true" />}
        <span className={position === trail.length - 1 ? 'node-properties__breadcrumb-current' : undefined}>{label}</span>
      </Fragment>)}
    </nav>}
    {!context.ok ? <p>{t('details.missingBlock')}</p> : <>
      {selected.kind === 'module' ? <ModuleNameForm key={`${record.id}:${record.name}`} module={record} onRename={onRename} /> : configurable ? <NodeForm key={`${record.id}:${JSON.stringify([record.properties, record.references])}`} kind={record.kind} initialNode={record} context={context} onSubmit={(patch) => onConfigure(record.id, patch)} /> : <p>{t('details.addParts')}</p>}
      {selected.kind === 'module' && <ModuleInterface key={record.id} module={record} project={project} analysis={index.analysis} index={index} onExport={onExport} onImport={onImport} onRemoveImport={onRemoveImport} />}
      <h3>{selected.kind === 'module' ? t('details.topBlocks') : t('details.parts')}</h3>
      {(selected.kind === 'module' ? [['rootNodeIds', record.rootNodeIds]] : Object.entries(record.children ?? {})).map(([slot, value]) => <div className="node-properties__children" key={slot}><span>{slotLabel(slot, t)}</span>
        {(Array.isArray(value) ? value : value ? [value] : []).map((id, position) => <button type="button" key={`${id}:${position}`} onClick={() => onSelect({ kind: 'node', id })}>{index.nodes.get(id)?.properties?.name || (index.nodes.get(id) ? kindLabel(index.nodes.get(id).kind, t) : t('details.missingBlock'))}<ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" /></button>)}
        {(value === null || (Array.isArray(value) && value.length === 0)) && <small>{t('details.nothingAdded')}</small>}
      </div>)}
      <NodeCodePreview project={project} selected={selected} analysis={index.analysis} />
    </>}
    <h3>{t('details.issues')} · {diagnostics.length}</h3>
    {mutationError && <p role="alert">{diagnosticLabel(mutationError, t)}</p>}
    {diagnostics.length === 0 ? <p>{t('details.noIssues')}</p> : <ul className="node-properties__diagnostics">{diagnostics.map((entry, position) => <li key={position}><strong>{diagnosticLabel(entry.code, t)}</strong>{entry.location.field && <small>{slotLabel(entry.location.field, t)}</small>}</li>)}</ul>}
    {context.ok && record && <div className="node-properties__danger"><DeleteAction key={`${selected.kind}:${record.id}`} targetId={record.id} kind={selected.kind} onDelete={selected.kind === 'module' ? onDeleteModule : onDelete} /></div>}
    <ProjectHierarchy project={project} index={index} selected={selected} onSelect={onSelect} t={t} />
  </FloatingPanel>
}
