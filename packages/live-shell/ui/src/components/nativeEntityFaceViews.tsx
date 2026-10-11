import {Fragment, type ReactNode} from 'react'
import type {Entity, NativeEditorChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {ENTITY_FACE_MODELS, entityFaceModel, type EntityFaceModel} from './nativeEntityFaceModel.ts'
import {formationEntityView} from './NativeEntityFace.formation.tsx'
import {soundFaceView} from './NativeEntityFace.sound.tsx'
import {meaningFaceView} from './NativeEntityFace.meaning.tsx'

/** What an entity family's view receives. renderControl(suffix, frozenReason) is the editor's exact-value control for one entity parameter;
 * a non-null frozenReason disables that one control and names why. */
export interface EntityFaceContext {
  reading: NativeEditorReading; entity: Entity; disabled: boolean
  apply: (changes: readonly NativeEditorChange[]) => Promise<unknown>
  renderControl: (suffix: string, frozenReason?: string | null) => ReactNode
}
/** The family's own drawing and non-numeric controls; the shared body keeps the article, header, groups and custody. */
export interface EntityFaceView {render: (ctx: EntityFaceContext) => ReactNode}

export const ENTITY_FACE_VIEWS: Record<keyof typeof ENTITY_FACE_MODELS, EntityFaceView> = {
  formation: formationEntityView,
  sound: soundFaceView,
  meaning: meaningFaceView,
}

/** The entity-scope device body for one registry family: the article shell, the grouped (or flat) exact-value controls, then the view's output.
 * Models and views are parameters so the same body renders the real registries and a fixture registry in tests. The model's frozen(reading, entity)
 * names the suffixes this object cannot change right now; those controls render disabled with the reason, the others stay enabled. */
export function EntityFaceBody({family, models, views, reading, entity, disabled, apply, renderControl}: {
  family: string; models: Readonly<Record<string, EntityFaceModel>>; views: Readonly<Record<string, EntityFaceView>>
  reading: NativeEditorReading; entity: Entity; disabled: boolean
  apply: EntityFaceContext['apply']; renderControl: (suffix: string, frozenReason?: string | null) => ReactNode
}) {
  const model = entityFaceModel(family, models)
  const view = Object.prototype.hasOwnProperty.call(views, family) ? views[family] : null
  if (!model || !view) return null
  const on = model.enabled(reading, entity)
  const frozen = model.frozen?.(reading, entity) ?? null
  const frozenReason = (suffix: string) => frozen && frozen.paths.includes(suffix) ? frozen.reason : null
  const control = (suffix: string) => <Fragment key={suffix}>{renderControl(suffix, frozenReason(suffix))}</Fragment>
  return <article className="native-device native-entity-device" aria-label={model.name}>
    <header><span className={`native-device-light${on === undefined ? ' is-unknown' : on ? '' : ' is-off'}`}
      title={on === undefined ? `No enable operation disclosed for ${model.name}` : on ? `${model.name} enabled` : `${model.name} disabled`} />
      <strong>{model.name}</strong><span>Entity · acts on the selected object</span></header>
    <div className="native-device-heading"><b>{entity.name}</b><code title={entity.id}>{reading.entityOccurrences[entity.id] ?? 'Unbound draft'}</code>{entity.locked && <span>Locked</span>}</div>
    {frozen && <p className="native-entity-frozen" role="note">{frozen.reason}</p>}
    {model.groups
      ? <div className="native-control-groups">{model.groups.map(group => <section key={group.title} className="native-control-group" aria-label={group.title}><h4>{group.title}</h4>{group.note && <p>{group.note}</p>}<div className="native-control-grid">{group.paths.map(control)}</div></section>)}</div>
      : <div className="native-control-grid">{model.paths.map(control)}</div>}
    {view.render({reading, entity, disabled, apply, renderControl})}
  </article>
}
