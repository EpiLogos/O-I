import {useEffect, useRef, useState} from 'react'
import type {Entity, NativeEditorReading, NativeEntitySettingChange} from '../../../../expressions-boundary/src/editor'
import type {EntityFaceContext, EntityFaceView} from './nativeEntityFaceViews.tsx'
import {
  FORMATION_SHAPE_LABELS, formationGate, formationNameDraft, formationObjectChange, formationObjectGate, formationSettingChange, formationShareRows, isBlueprintMember, planLayout,
} from './nativeEntityFace.formation.ts'
import './NativeEntityFace.formation.css'

/** The one commit path for Name, Lock and Enabled: the admitted object-setting change, through the editor's apply. */
export function commitFormationSetting(apply: EntityFaceContext['apply'], change: NativeEntitySettingChange): Promise<unknown> {
  return apply([change])
}
/** Commits a typed name when it is a real change; null (nothing sent) otherwise. */
export function commitFormationName(apply: EntityFaceContext['apply'], entity: Entity, draft: string): Promise<unknown> | null {
  const change = formationNameDraft(entity, draft)
  return change ? commitFormationSetting(apply, change) : null
}

function NameField({entity, disabled, apply}: {entity: Entity; disabled: boolean; apply: EntityFaceContext['apply']}) {
  const [draft, setDraft] = useState(entity.name)
  const cancelled = useRef(false)
  useEffect(() => setDraft(entity.name), [entity.name])
  const commit = () => {
    const reverted = cancelled.current
    cancelled.current = false
    // Escape restores the stored name; an empty or unchanged draft sends nothing and shows the stored name again.
    if (reverted || commitFormationName(apply, entity, draft) === null) setDraft(entity.name)
  }
  return <label className="native-formation-name"><span>Name</span>
    <input type="text" aria-label="Name" value={draft} maxLength={160} disabled={disabled}
      onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') { cancelled.current = true; event.currentTarget.blur() }
      }} /></label>
}

function Identity({ctx}: {ctx: EntityFaceContext}) {
  const {entity, disabled, apply} = ctx
  // ctx.disabled already includes the lock (NativeDeviceEditors passes disabled || entity.locked); formationGate separates the Lock row.
  const gate = formationGate(entity, disabled)
  return <section className="native-formation-section native-formation-identity" aria-label="Identity">
    <h4>Identity</h4>
    <NameField entity={entity} disabled={gate.name} apply={apply} />
    <label className="native-formation-switch"><input type="checkbox" checked={entity.locked} disabled={gate.lock}
      onChange={event => void commitFormationSetting(apply, formationSettingChange(entity, 'locked', event.target.checked))} /><span>Lock editing</span></label>
    <p className="native-formation-note">Does not pause the sequence or remove its forces</p>
    <label className="native-formation-switch"><input type="checkbox" checked={entity.enabled !== false} disabled={gate.enabled}
      onChange={event => void commitFormationSetting(apply, formationSettingChange(entity, 'enabled', event.target.checked))} /><span>Enabled in the field</span></label>
    <p className="native-formation-note">A deliberate runtime change, unlike locking editing</p>
    {gate.reason && <p className="native-formation-reason" role="note">{gate.reason}</p>}
  </section>
}

/** Duplicate and Delete for this formation. Delete asks once inline before the admitted remove is sent. */
function ObjectActions({ctx}: {ctx: EntityFaceContext}) {
  const {reading, entity, disabled, apply} = ctx
  const [confirming, setConfirming] = useState(false)
  const gate = formationObjectGate(reading.scene, entity, disabled)
  useEffect(() => setConfirming(false), [entity.id])
  return <section className="native-formation-section native-formation-objects" aria-label="Object">
    <h4>Object</h4>
    <div className="native-formation-actions">
      <button type="button" disabled={gate.duplicate !== null} title={gate.duplicate ?? undefined}
        onClick={() => void apply([formationObjectChange('entity-duplicate', entity)])}>Duplicate</button>
      {confirming ? <span className="native-formation-confirm" role="group" aria-label="Confirm removal">
        <span>Remove {entity.name} from this Scene?</span>
        <button type="button" onClick={() => { setConfirming(false); void apply([formationObjectChange('entity-remove', entity)]) }}>Remove</button>
        <button type="button" onClick={() => setConfirming(false)}>Keep</button>
      </span> : <button type="button" disabled={gate.remove !== null} title={gate.remove ?? undefined}
        onClick={() => setConfirming(true)}>Delete</button>}
    </div>
    {gate.remove && <p className="native-formation-reason" role="note">{gate.remove}</p>}
    <p className="native-formation-note">Duplicate adds a copy beside it. Delete takes it out of this Scene; Undo restores it, and a saved version of the Scene keeps its copy.</p>
  </section>
}

/** Plan of every object from the reading. Derived only: the drafts of the exact-value grid do not move it in this version. */
function Plan({reading, entity}: {reading: NativeEditorReading; entity: Entity}) {
  const layout = planLayout(reading, entity.id)
  const label = `Plan of ${layout.marks.length} ${layout.marks.length === 1 ? 'object' : 'objects'} on the ${layout.plane} plane; ${entity.name} selected`
  return <section className="native-formation-section" aria-label="Plan">
    <h4>Plan</h4>
    <svg className="native-formation-plan" viewBox="0 0 360 180" role="img" aria-label={label}>
      <rect x="0.5" y="0.5" width="359" height="179" className="native-formation-frame" />
      <text x="10" y="174" className="native-formation-axis">{layout.horizontal} →</text>
      <text x="8" y="12" className="native-formation-axis">{layout.vertical} ↑</text>
      {layout.marks.map(mark => mark.kind === 'pin'
        ? <circle key={mark.id} cx={mark.cx} cy={mark.cy} r={4} className={`native-formation-pin${mark.selected ? ' is-selected' : ''}`}
          style={{strokeOpacity: mark.outlineOpacity}}><title>{`${mark.name} · Force centre`}</title></circle>
        : <rect key={mark.id} x={mark.cx - mark.width / 2} y={mark.cy - mark.height / 2} width={mark.width} height={mark.height}
          transform={`rotate(${mark.rotation} ${mark.cx} ${mark.cy})`}
          className={`native-formation-mark${mark.selected ? ' is-selected' : ''}${mark.enabled ? '' : ' is-disabled'}`}
          style={{fillOpacity: mark.fillOpacity, strokeOpacity: mark.outlineOpacity}}><title>{`${mark.name}${mark.enabled ? '' : ' · disabled'}`}</title></rect>)}
    </svg>
    <p className="native-formation-note">Configuration plan on the {layout.plane} plane, not the Stage. Position, size and rotation as stored; fill is the derived share (faint when disabled); outline is depth {layout.depth} (stronger = higher). Drag is not offered: use the exact values above.</p>
  </section>
}

function ShareList({entities, selectedId}: {entities: Entity[]; selectedId: string}) {
  const rows = formationShareRows(entities)
  const anyEnabled = rows.some(row => row.enabled)
  return <section className="native-formation-section" aria-label="Particle share">
    <h4>Particle share</h4>
    {rows.length
      ? <ol className="native-formation-shares">{rows.map(row => <li key={row.id} className={row.id === selectedId ? 'is-selected' : undefined}>
        <span>{row.name}</span>
        {row.fraction === null
          ? <em>Disabled · excluded</em>
          : <><meter min={0} max={1} value={row.fraction} aria-label={`${row.name} share of particles`} /><span>{Math.round(row.fraction * 100)}%</span></>}
      </li>)}</ol>
      : <p>No formations in this Scene.</p>}
    {rows.length > 0 && !anyEnabled && <p className="native-formation-reason" role="note">No formation is enabled, so the share has nothing to normalise over.</p>}
    <p className="native-formation-note">Derived, not stored: share ÷ the sum over enabled formations (inspector.ts). Pins own no share.</p>
  </section>
}

function ShapeAndTint({entity}: {entity: Entity}) {
  const shape = FORMATION_SHAPE_LABELS[entity.shape] ?? entity.shape
  const detail = entity.shape === 'text' ? `"${entity.text}"`
    : entity.shape === 'yantra' ? (entity.yantraId ?? 'no yantra recorded')
      : entity.shape === 'cymatic' ? `${entity.templateFrequency ?? 'no'} Hz template` : null
  const states = entity.sequence.steps.length
  return <section className="native-formation-section" aria-label="Shape and stored tint">
    <h4>Shape and tint</h4>
    <p>{shape}{detail ? ` · ${detail}` : ''}. Edit the shape in Glyph Sequence.{states > 1 ? ` This is the base shape; the sequence holds ${states} states.` : ''}</p>
    <p className="native-formation-tint"><span className="native-formation-swatch" style={{background: entity.tint}} aria-hidden="true" /><code>{entity.tint}</code></p>
    <p className="native-formation-note">Stored tint colour: read-only here, the shell has no change that writes it yet.</p>
  </section>
}

function FormationView({ctx}: {ctx: EntityFaceContext}) {
  const {reading, entity} = ctx
  if (entity.kind !== 'formation') return <section className="native-formation-view">
    <p className="native-formation-note">Select a formation. Pins have no formation panel; a pin's Force is edited in the Force device.</p>
  </section>
  return <div className="native-formation-view">
    <Identity ctx={ctx} />
    <ObjectActions ctx={ctx} />
    <Plan reading={reading} entity={entity} />
    <ShareList entities={reading.scene.entities} selectedId={entity.id} />
    <ShapeAndTint entity={entity} />
    {isBlueprintMember(reading.scene, entity) && <p className="native-formation-reason" role="note">
      Blueprint member: its position is held by the Blueprint. Use Blueprint to move the whole shape, or release it to edit individual centres. The boundary refuses the position rows until then.
    </p>}
  </div>
}

export const formationEntityView: EntityFaceView = {render: ctx => <FormationView ctx={ctx} />}
