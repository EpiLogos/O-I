// Expressions' clip binding (manual §20.1 Clip view; §16.5's table: "Expressions — A scene — Sequence, Envelopes, Expression, Sound —
// Quantize, the next scene, Jump — The scene's automation"; lock §0.3.7: the pointer tools, the selected symbol's Formation, Force,
// Sound and Meaning, and the scene's Text, Blueprint and Arrange are in the scene's Clip view; Scene, Automation and Body & triggers
// are the scene clip's panels). The presented scene of the open Expression, on the owner the replaced bodies read — the retained
// native editor (shell/workspaceContext.tsx useWorkspace: its reading and its request door) — mapped onto the keys of the designed
// clip `clip:expressions` (inhabitants/catalogue/clips/expressions.tsx). It replaces the Expressions clip column
// (components/NativeWorldDetail.tsx clip mode: SceneControls, SceneStrip and the Sequence column) and hosts what DETAIL_CLIP_HOLDER
// declared (inhabitants/sdk/semantics.ts: expressions/scene, expressions/automation). Ported from:
//   - the scene's name, duration and transition (SceneControls.tsx :70-73, the inventory's working pacing; nativeSceneFace.scene.ts),
//     its start (Scene.entryOffset, "Absent = 0"), its body and triggers (reading.nativeScene; nativeSceneFace.body.ts labels), the
//     Expression's scenes for Jump (reading.scenes);
//   - the symbols and their steps (shell/nativeContent.ts readNativeExpressionsContent: each formation's glyph timing), the selected
//     symbol (reading.selection), each symbol's own Formation, Force and Sound (the entity, as nativeEntityFace.formation.ts and
//     nativeEntityFace.sound.ts read it);
//   - the scene's automation lanes (Scene.automation; nativeSceneFace.automation.ts), its text layers (Scene.text;
//     nativeSceneFace.text.ts), its blueprint (nativeSceneFace.blueprint.ts committedDisplay) and its last arrangement
//     (nativeSceneFace.arrange.ts recordedLayout).
// Writes go to the same owner requests those faces send: a scene edit (rename, pacing), a select, one `apply` of native changes
// (parameter targets, entity settings, force mode, entity sound, automation, text layers, the arrange plan, a duplicate), a blueprint
// transform, and `open` for a symbol's source. What the owner takes in a shape Clip view does not compose yet is refused naming that
// shape; what no owner op carries is refused naming the missing op. Pure, apart from the hook at the end.
import type {Entity, NativeEditorBasis, NativeEditorChange, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../../../expressions-boundary/src/editor'
import type {NativeSceneEditIntent} from '../../../../../../expressions-boundary/src/sceneEdits'
import type {Value, Values} from '../../../frame/devices/designed'
import {clipBinding, missingOp, useViewHoldsVersion, type ClipBinding, type ClipWiring} from '../../../frame/detail/clipBinding'
import {useSelectedClip} from '../../../frame/detail/ClipBox'
import {useDetailReading} from '../../../frame/detail/detailReading'
import {useTimelinePanePresentation} from '../../../projections/timelinePaneHost'
import {readNativeExpressionsContent} from '../../../shell/nativeContent'
import {useWorkspace} from '../../../shell/workspaceContext'
import {FORMATION_SHAPE_LABELS, formationObjectChange, formationSettingChange} from '../../nativeEntityFace.formation'
import {addedSound, carryFromValue, carryValue, resolvedSound, soundChange, soundWithField, voiceChoices} from '../../nativeEntityFace.sound'
import {useLiveModeCatalogue} from '../../../native/liveModeCatalogue'
import type {QlMusicModes} from '../../../live/modes'
import {ARRANGE_LAYOUTS, arrangePlan, blueprintMemberIds, recordedLayout, type ArrangeLayout, type Plane} from '../../nativeSceneFace.arrange'
import {blueprintRequest, committedDisplay, fieldValue, transformIntent, withField, type FieldKey} from '../../nativeSceneFace.blueprint'
import {CARRIER_LABELS, OCCASION_LABELS, OPERATION_LABELS, PLACEMENT_LABELS} from '../../nativeSceneFace.body'

type Obj = Record<string, Record<string, number | string | boolean>>
const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** The design's target words for a trigger (clips/expressions.tsx LaunchPanel). */
const TARGET_WORD: Readonly<Record<string, string>> = {expression_operation: 'Read this Expression', portal: 'Open a portal', native_action: 'Run a native Action', navigate: 'Jump to a scene'}
/** The design's waves for an automation lane (clips/expressions.tsx Envelopes' Wave chooser). */
const WAVE: Readonly<Record<string, string>> = {sine: 'sine', triangle: 'triangle', square: 'square', saw: 'saw', steps: 'random step', smooth: 'smooth random', morph: 'morph drive'}
const WAVE_BACK: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(WAVE).map(([owner, word]) => [word, owner]))
/** The design's arrange rules ("Align X") as the owner's layouts ("align-x"). */
const RULE_OF = (layout: string): string => layout.replace('-', ' ')
const LAYOUT_OF = (rule: string): ArrangeLayout | null => (ARRANGE_LAYOUTS as readonly string[]).includes(rule.replace(' ', '-')) ? rule.replace(' ', '-') as ArrangeLayout : null
/** The blueprint's design keys and the face's fields. */
const BP: Readonly<Record<string, FieldKey>> = {'bp.x': 'x', 'bp.y': 'y', 'bp.z': 'z', 'bp.rx': 'rx', 'bp.ry': 'ry', 'bp.rz': 'rz', 'bp.size': 'size'}

/** A lane's device: the symbol it moves, or the Field (`field.<key>`), or the target's own head. */
function laneDevice(entityId: string | undefined, target: string): string {
  if (entityId) return entityId
  if (target.startsWith('field.')) return 'Field'
  if (target.startsWith('entity:')) return decodeURIComponent(target.slice(7, target.lastIndexOf(':')))
  return target.split('.')[0] ?? target
}

/** One entity's own controls, as the design's Expression tab reads them: Formation, Force and Sound (Meaning is not read here yet). */
function objectOf(entity: Entity): Obj {
  const sound = entity.sound
  return {
    formation: {x: entity.position.x, y: entity.position.y, z: entity.position.z, w: entity.size.x, h: entity.size.y, scale: entity.scale ?? 1, rotation: entity.rotation,
      share: entity.share, tint: entity.tintWeight, enabled: entity.enabled !== false, locked: entity.locked, name: entity.name, shape: FORMATION_SHAPE_LABELS[entity.shape] ?? entity.shape},
    force: {kind: entity.force.kind, strength: entity.force.strength, spin: entity.force.spin, radius: entity.force.radius},
    // The voice as the owner resolves it (nativeEntityFace.sound.ts resolvedSound: the app validator's defaults for a field it omits). A symbol's voice
    // carries a name or a mode of the torus's sound and has no frequency, follow, waveform or pan: those keys are not reported, so the design draws them absent.
    sound: sound ? (({enabled, carry, gain, attack, release}) => ({voice: enabled, carry: carryValue(carry), gain, attack, release}))(resolvedSound(sound)) : {voice: false},
  }
}

/** The presented scene's readings on the design's keys. A key the owner does not report is left out. Pure. */
export function expressionsClipValues(reading: NativeEditorReading, colour?: string | null, modes: QlMusicModes | null = null): Values {
  const values: Record<string, Value> = {}
  const scene = reading.scene
  const row = reading.scenes?.scenes.find(item => item.scene_ref === reading.basis.scene_ref)
  put(values, 'name', row?.title ?? scene.name)
  // The scene as a clip (model.ts SceneClip): its own colour over the track's, and its own settings, each the scene's default when unset.
  put(values, 'colour', scene.clip?.colour ?? colour)
  values.active = scene.clip?.enabled !== false
  values.locked = scene.clip?.locked === true
  values.quantize = scene.clip?.quantize ?? 'global'
  put(values, 'signature', scene.clip?.signature)
  put(values, 'duration', row?.working?.duration ?? scene.duration)
  put(values, 'transition', row?.working?.transition ?? scene.transition)
  // The owner's own law: "Absent = 0" (field-studies-journeys model.ts Scene.entryOffset).
  values.start = scene.entryOffset ?? 0
  const native = reading.nativeScene
  if (native) {
    // The live engine composition is the body when the owner holds none (kernelDocumentBridge validateSceneBody: "Absent … means
    // the live engine composition, the current default").
    const body = native.body
    values.carrier = (body ? CARRIER_LABELS[body.carrier] ?? body.carrier : CARRIER_LABELS.engine_composition).toLowerCase()
    if (body) {
      values.presentation = body.presentation
      values.reference = body.subject_ref
      if (body.span) { values['span.from'] = body.span.start; values['span.to'] = body.span.end }
    }
    values.triggers = JSON.stringify(native.triggers.map(trigger => ({name: trigger.trigger_ref, occasion: OCCASION_LABELS[trigger.occasion] ?? trigger.occasion,
      target: TARGET_WORD[trigger.target.kind] ?? trigger.target.kind,
      placement: trigger.target.kind === 'portal' ? PLACEMENT_LABELS[trigger.target.placement] ?? trigger.target.placement : '',
      operation: trigger.target.kind === 'expression_operation' ? OPERATION_LABELS[trigger.target.operation as keyof typeof OPERATION_LABELS] ?? trigger.target.operation : ''})))
    // Live's follow action Jump is the scene's "Scene leaves → Jump to a scene" trigger (manual §20.1).
    const jump = native.triggers.find(trigger => trigger.occasion === 'scene_leave' && trigger.target.kind === 'navigate' && trigger.target.scene_ref)
    if (jump && jump.target.kind === 'navigate') { values.follow = 'jump'; values.jumpTo = jump.target.scene_ref! }
    const display = committedDisplay(native.blueprint)
    if (native.blueprint !== undefined) values['bp.bound'] = !!native.blueprint
    if (display) for (const [key, field] of Object.entries(BP)) values[key] = fieldValue(display, field)
  }
  if (reading.scenes) values.scenes = JSON.stringify(reading.scenes.scenes.map(item => ({id: item.scene_ref, name: item.title})))
  let timing: ReturnType<typeof readNativeExpressionsContent>['clip_sources'] = []
  try { timing = readNativeExpressionsContent(reading).clip_sources } catch { timing = [] }
  values.symbols = JSON.stringify(scene.entities.map(entity => {
    const source = timing.find(item => item.scope.view_entity_id === entity.id)
    const steps = source ? source.timing.states.map((state, i) => ({at: state.start_seconds, hold: state.hold_seconds, glide: state.transition_seconds,
      state: entity.sequence.steps[i]?.name || entity.sequence.steps[i]?.text || String(i + 1)})) : []
    return {id: entity.id, name: entity.name, steps}
  }))
  values.objects = JSON.stringify(Object.fromEntries(scene.entities.map(entity => [entity.id, objectOf(entity)])))
  if (reading.selection.entity_ids.length === 1) values.symbol = reading.selection.entity_ids[0]!
  // The "Name or mode" row's choices for the selected symbol (nativeEntityFace.sound.ts voiceChoices): the owner's modes, then the store's names.
  const held = scene.entities.find(entity => entity.id === values.symbol)?.sound?.carry ?? null
  values.carryOptions = JSON.stringify(voiceChoices(modes, held).flatMap(group => group.options))
  values.lanes = JSON.stringify(scene.automation.map(lane => ({id: lane.id, device: laneDevice(lane.entityId, lane.target), target: lane.target,
    type: lane.type === 'lfo' ? 'oscillator' : 'ramp', wave: WAVE[lane.wave] ?? lane.wave, rate: lane.rate, phase: lane.phase, min: lane.min, max: lane.max,
    blend: lane.blend, duration: lane.duration, delay: lane.delay, loop: lane.loop, ...(lane.easing ? {easing: lane.easing} : {}), enabled: lane.enabled,
    ...(lane.syncWith ? {follows: lane.syncWith} : {})})))
  values.layers = JSON.stringify(scene.text.map(layer => ({id: layer.id, visible: layer.visible, heading: layer.kicker, title: layer.title, italic: layer.italic,
    body: layer.body, size: layer.size, width: layer.width, x: layer.x, y: layer.y, align: layer.align})))
  return values
}

/** The view's starting arrangement: the scene's last applied rule and its plane (nativeSceneFace.arrange.ts recordedLayout). */
function arrangeDefaults(reading: NativeEditorReading): Record<string, Value> {
  const layout = recordedLayout(reading.scene)
  return {...(layout ? {'ar.rule': RULE_OF(layout)} : {}), 'ar.plane': reading.scene.composition.plane}
}

// ---------------------------------------------------------------------------------------------------------------- the writes

/** The request door the binding writes through: the retained native editor's own (useWorkspace().editor.request). */
export type EditorRequest = (request: NativeEditorRequest) => Promise<NativeEditorReply>

const answered = async (request: EditorRequest | null, sent: NativeEditorRequest): Promise<NativeEditorReply & {ok: true}> => {
  if (!request) throw new Error('The retained native editor is unavailable: open an Expression first.')
  const reply = await request(sent)
  if (!reply.ok) throw new Error(reply.error)
  return reply
}

/** One scene edit on the presented scene's captured basis (as NativeSceneEditor builds it; nativeSceneFace.scene.ts expressionEditRequest). */
function sceneEdit(reading: NativeEditorReading, intent: NativeSceneEditIntent): NativeEditorRequest {
  if (!reading.playback || !reading.nativeSelection) throw new Error('The owner has not disclosed the Scene\'s playback and selection that a scene edit needs.')
  return {operation: 'scene-edit', basis: structuredClone(reading.basis), intent_epoch: reading.playback.intent_epoch,
    native_selection: structuredClone(reading.nativeSelection), intent}
}
const apply = (basis: NativeEditorBasis, changes: readonly NativeEditorChange[]): NativeEditorRequest => ({operation: 'apply', basis: structuredClone(basis), changes: [...changes]})

/** The parameter target of one entity field (nativeParameters.ts entityTargets: `entity:<id>:<suffix>`). */
const target = (id: string, suffix: string) => `entity:${encodeURIComponent(id)}:${suffix}`
const FORMATION_TARGET: Readonly<Record<string, string>> = {x: 'x', y: 'y', z: 'z', w: 'size.x', h: 'size.y', scale: 'scale', rotation: 'rotation', share: 'share', tint: 'tintWeight'}
const FORCE_TARGET: Readonly<Record<string, string>> = {strength: 'forces.strength', spin: 'forces.spin', radius: 'forces.radius'}
const SOUND_FIELD: Readonly<Record<string, 'gain' | 'attack' | 'release'>> = {gain: 'gain', attack: 'attack', release: 'release'}

/** The native changes one edit of the `objects` value asks for: each field the hand moved, as the owner's own change. Throws the
 * refusal for a field the owner takes in a shape Clip view does not compose yet. Pure. */
export function objectChanges(reading: NativeEditorReading, next: Record<string, Obj>): NativeEditorChange[] {
  const changes: NativeEditorChange[] = []
  for (const entity of reading.scene.entities) {
    const was = objectOf(entity), now = next[entity.id]
    if (!now) continue
    for (const page of Object.keys(now)) {
      for (const [field, value] of Object.entries(now[page] ?? {})) {
        if (was[page]?.[field] === value) continue
        if (page === 'formation' && FORMATION_TARGET[field] && typeof value === 'number') changes.push({kind: 'parameter', target: target(entity.id, FORMATION_TARGET[field]!), value})
        else if (page === 'formation' && (field === 'name' || field === 'locked' || field === 'enabled')) changes.push(field === 'name' ? formationSettingChange(entity, 'name', String(value)) : formationSettingChange(entity, field, value === true))
        else if (page === 'force' && field === 'kind') changes.push({kind: 'force-mode', entity_id: entity.id, value: value as Entity['force']['kind']})
        else if (page === 'force' && FORCE_TARGET[field] && typeof value === 'number') changes.push({kind: 'parameter', target: target(entity.id, FORCE_TARGET[field]!), value})
        else if (page === 'sound' && field === 'voice') changes.push(soundChange(entity.id, value === true ? (entity.sound ?? addedSound()) : null))
        else if (page === 'sound' && (SOUND_FIELD[field] || field === 'carry')) {
          if (!entity.sound) throw new Error('The symbol has no voice: turn Voice on first.')
          changes.push(soundChange(entity.id, field === 'carry'
            ? soundWithField(entity.sound, 'carry', carryFromValue(String(value)))
            : soundWithField(entity.sound, SOUND_FIELD[field]!, value as number)))
        } else throw new Error(page === 'meaning' ? NOT_COMPOSED('Meaning', 'one entity-semantic change (nativeEntityFace.meaning.ts meaningChange)')
          : page === 'force' ? NOT_COMPOSED('The force\'s centre', 'its parameter target') : `${field}: the owner reports it; nothing in Clip view changes it.`)
      }
    }
  }
  return changes
}

/** The words for an owner write that exists in a shape Clip view does not compose yet (an open gap of this binding, named). */
const NOT_COMPOSED = (what: string, shape: string) => `${what}: the owner takes it as ${shape}; Clip view does not compose it yet.`

type Lane = {id: string; type: string; wave: string; rate: number; phase: number; min: number; max: number; blend: string; duration: number; delay: number; loop: string; easing?: string; enabled: boolean}

/** The automation changes one edit of the `lanes` value asks for: `automation-set` with the fields the hand moved. Pure. */
export function laneChanges(reading: NativeEditorReading, next: readonly Lane[]): NativeEditorChange[] {
  const changes: NativeEditorChange[] = []
  for (const lane of next) {
    const was = reading.scene.automation.find(item => item.id === lane.id)
    if (!was) continue
    const values: Record<string, unknown> = {}
    const type = lane.type === 'oscillator' ? 'lfo' : 'ramp'
    if (type !== was.type) values.type = type
    const wave = WAVE_BACK[lane.wave] ?? lane.wave
    if (wave !== was.wave) values.wave = wave
    for (const key of ['rate', 'phase', 'min', 'max', 'blend', 'duration', 'delay', 'loop', 'enabled'] as const) if (lane[key] !== was[key]) values[key] = lane[key]
    if (lane.easing !== undefined && lane.easing !== was.easing) values.easing = lane.easing
    if (Object.keys(values).length) changes.push({kind: 'automation-set', lane_id: lane.id, values} as NativeEditorChange)
  }
  return changes
}

type Layer = {id: string; visible: boolean; heading: string; title: string; italic: string; body: string; size: number; width: number; x: number; y: number; align: string}
const LAYER_FIELD: Readonly<Record<string, string>> = {visible: 'visible', heading: 'kicker', title: 'title', italic: 'italic', body: 'body', size: 'size', width: 'width', x: 'x', y: 'y', align: 'align'}

/** The text changes one edit of the `layers` value asks for: `text-layer-set` with the fields the hand moved. Pure. */
export function layerChanges(reading: NativeEditorReading, next: readonly Layer[]): NativeEditorChange[] {
  const changes: NativeEditorChange[] = []
  for (const layer of next) {
    const was = reading.scene.text.find(item => item.id === layer.id) as Record<string, unknown> | undefined
    if (!was) continue
    const values: Record<string, unknown> = {}
    for (const [field, owner] of Object.entries(LAYER_FIELD)) if ((layer as Record<string, unknown>)[field] !== was[owner]) values[owner] = (layer as Record<string, unknown>)[field]
    if (Object.keys(values).length) changes.push({kind: 'text-layer-set', layer_id: layer.id, values} as NativeEditorChange)
  }
  return changes
}

const parsed = <T,>(value: Value): T => JSON.parse(String(value)) as T
const EXPRESSIONS = 'Expressions (the retained native editor, expressions-app hostEditor)'

/** clip:expressions's wiring on one reading and its request door. */
export function expressionsWiring(reading: NativeEditorReading, request: EditorRequest | null, present?: (editor: 'source' | 'layers' | 'placement', basis: NativeEditorBasis) => void,
  held: Readonly<Record<string, Value>> = {}): ClipWiring {
  const send = async (sent: NativeEditorRequest) => { await answered(request, sent) }
  const scene_ref = reading.basis.scene_ref
  const selectedSymbol = () => (reading.selection.entity_ids.length === 1 ? reading.scene.entities.find(entity => entity.id === reading.selection.entity_ids[0]) : undefined)
  const bp = (key: string) => async (value: Value) => {
    const display = committedDisplay(reading.nativeScene?.blueprint)
    if (!display) throw new Error('The figure is not bound: bind the six roles first.')
    await send(blueprintRequest(reading, transformIntent(withField(display, BP[key]!, Number(value)))))
  }
  return {
    reads: {
      name: 'the presented Scene\'s title (the native inventory), else the scene\'s name', colour: 'the scene\'s own colour (Scene.clip), else its track\'s colour (the tracks pane)',
      active: 'Scene.clip.enabled (absent: the scene plays)', locked: 'Scene.clip.locked (absent: unlocked)', quantize: 'Scene.clip.quantize (absent: Global)',
      signature: 'Scene.clip.signature, the scene\'s ratio of hold to change',
      duration: 'the Scene\'s working duration', transition: 'the Scene\'s working transition', start: 'Scene.entryOffset (absent is 0, the owner\'s law)',
      carrier: 'the native body\'s carrier (none: the live engine composition)', presentation: 'the native body\'s presentation', reference: 'the native body\'s subject ref',
      'span.from': 'the native body\'s span', 'span.to': 'the native body\'s span', triggers: 'the native Scene\'s triggers', scenes: 'the Expression\'s scenes',
      follow: 'a "Scene leaves → Jump to a scene" trigger is the follow action Jump', jumpTo: 'that trigger\'s scene',
      symbols: 'the Scene\'s entities and each formation\'s glyph timing', objects: 'each entity\'s Formation, Force and Sound', symbol: 'the owner\'s selection, when it is one entity',
      lanes: 'Scene.automation', layers: 'Scene.text', 'bp.bound': 'the native blueprint', 'bp.*': 'the native blueprint\'s transform',
    },
    acts: {
      colour: async value => send(sceneEdit(reading, {operation: 'clip', scene_ref, set: {colour: value === null || value === '' ? null : String(value)}})),
      active: async value => send(sceneEdit(reading, {operation: 'clip', scene_ref, set: {enabled: value === false ? false : null}})),
      locked: async value => send(sceneEdit(reading, {operation: 'clip', scene_ref, set: {locked: value === true ? true : null}})),
      signature: async value => send(sceneEdit(reading, {operation: 'clip', scene_ref, set: {signature: String(value) as '5:3'}})),
      quantize: async value => send(sceneEdit(reading, {operation: 'clip', scene_ref, set: {quantize: value === 'global' ? null : String(value) as 'now'}})),
      name: async value => send(sceneEdit(reading, {operation: 'rename', scene_ref, title: String(value)})),
      duration: async value => send(sceneEdit(reading, {operation: 'pacing', scene_ref, duration: Number(value)})),
      transition: async value => send(sceneEdit(reading, {operation: 'pacing', scene_ref, transition: Number(value)})),
      symbol: async value => send({operation: 'select', basis: structuredClone(reading.basis), entity_id: String(value)}),
      objects: async value => { const changes = objectChanges(reading, parsed<Record<string, Obj>>(value)); if (changes.length) await send(apply(reading.basis, changes)) },
      lanes: async value => { const changes = laneChanges(reading, parsed<Lane[]>(value)); if (changes.length) await send(apply(reading.basis, changes)) },
      layers: async value => { const changes = layerChanges(reading, parsed<Layer[]>(value)); if (changes.length) await send(apply(reading.basis, changes)) },
      'bp.x': bp('bp.x'), 'bp.y': bp('bp.y'), 'bp.z': bp('bp.z'), 'bp.rx': bp('bp.rx'), 'bp.ry': bp('bp.ry'), 'bp.rz': bp('bp.rz'), 'bp.size': bp('bp.size'),
      'ar.apply': async () => {
        const rule = typeof held['ar.rule'] === 'string' ? held['ar.rule'] : recordedLayout(reading.scene)
        const plan = arrangePlan(reading.scene.entities, new Set(String(held['ar.objects'] ?? '').split(',').filter(Boolean)), blueprintMemberIds(reading.scene),
          rule ? LAYOUT_OF(RULE_OF(rule)) : null, (held['ar.plane'] ?? reading.scene.composition.plane) as Plane)
        if (plan.problem) throw new Error(plan.problem)
        if (plan.changes.length) await send(apply(reading.basis, plan.changes))
      },
      'act.duplicate': async () => {
        const entity = selectedSymbol()
        if (!entity) throw new Error('Select exactly one symbol first.')
        await send(apply(reading.basis, [formationObjectChange('entity-duplicate', entity)]))
      },
      'act.source': async () => {
        const entity = selectedSymbol()
        const step = entity?.sequence.steps.find(item => item.id === reading.selection.step_id) ?? entity?.sequence.steps[0]
        if (!entity || !step) throw new Error('Select one symbol with a glyph state: its source opens in the glyph editor.')
        const reply = await answered(request, {operation: 'open', basis: structuredClone(reading.basis), entity_id: entity.id, step_id: step.id, editor: 'source'})
        present?.('source', reply.reading.basis)
      },
    },
    view: {
      tool: 'the pointer tool: what the pointer does in the field', layer: 'the text block whose settings show', trigger: 'the trigger whose settings show',
      objPage: 'the page of the selected symbol\'s controls', fold: 'Fold: only the symbols that change', highlight: 'Voices: tints the voiced symbols\' lanes',
      loopScene: 'Loop: loops the scene in the editor', 'env.device': 'the envelope editor\'s Device chooser', 'env.lane': 'the envelope editor\'s Control chooser',
      'ar.objects': 'the symbols Arrange moves on Apply', 'ar.rule': 'the rule Arrange applies', 'ar.plane': 'the plane Arrange works in',
    },
    refused: {
      start: 'Start is set by Slip on Arrangement view\'s ruler (Scene.entryOffset), not from Clip view.',
      follow: NOT_COMPOSED('The follow action', 'a scene-material trigger "Scene leaves → Jump to a scene" (nativeSceneFace.body.ts)'),
      jumpTo: NOT_COMPOSED('Jump to', 'a scene-material trigger "Scene leaves → Jump to a scene" (nativeSceneFace.body.ts)'),
      triggers: NOT_COMPOSED('A trigger', 'one scene-material intent (nativeSceneFace.body.ts)'),
      carrier: NOT_COMPOSED('The body', 'one scene-material intent (nativeSceneFace.body.ts)'), presentation: NOT_COMPOSED('The presentation', 'one scene-material intent'),
      reference: NOT_COMPOSED('The reference', 'one scene-material intent'), 'span.from': NOT_COMPOSED('The span', 'one scene-material intent'),
      'span.to': NOT_COMPOSED('The span', 'one scene-material intent'),
      'bp.bound': NOT_COMPOSED('Bind and Release', 'a blueprint bind or release intent with the six roles\' subjects (nativeSceneFace.blueprint.ts)'),
      'act.bind': NOT_COMPOSED('Bind', 'a step source change (step-source)'), 'act.follow': missingOp('Follow', 'entity_follow_set {expression, entity, follows}', EXPRESSIONS),
      'act.exact': NOT_COMPOSED('Exact', 'parameter changes on the entity\'s targets'),
      library: 'The Library opens from the browser\'s Library.',
    },
    absent: {
      signature: 'the scene has no ratio of hold to change of its own until one is chosen',
      plate: 'no reading of the plate\'s pitch over the scene reaches Clip view', 'objects.meaning': 'the Meaning page is not read into Clip view yet',
    },
  }
}

export interface ExpressionsClipInput {
  readonly reading: NativeEditorReading | null
  readonly request: EditorRequest | null
  readonly present?: (editor: 'source' | 'layers' | 'placement', basis: NativeEditorBasis) => void
  readonly colour?: string | null
  readonly placed?: boolean
  /** The owner's mode catalogue, for the voice's "Name or mode" row; null while it is not read. */
  readonly modes?: QlMusicModes | null
}

/** Expressions' clip binding: the presented scene of the open Expression, or null while none is read. Pure. */
export function expressionsClipBinding(input: ExpressionsClipInput): ClipBinding | null {
  const reading = input.reading
  if (!reading) return null
  const ref = `scene:${reading.basis.expression_ref}:${reading.basis.scene_ref}`
  const defaults = arrangeDefaults(reading)
  const first = clipBinding({mode: 'expressions', ref, values: {}, wiring: expressionsWiring(reading, input.request, input.present), viewDefaults: defaults})
  // The arrange plan reads the view's own choices (its rule, plane and objects), as held now.
  const wiring = expressionsWiring(reading, input.request, input.present, first.values)
  return clipBinding({mode: 'expressions', ref, values: expressionsClipValues(reading, input.colour, input.modes ?? null), wiring, placed: input.placed, viewDefaults: defaults})
}

/** The presented scene's clip binding, from the retained native editor. */
export function useExpressionsClip(): ClipBinding | null {
  const workspace = useWorkspace()
  const {native} = useDetailReading()
  const selected = useSelectedClip()
  const presentation = useTimelinePanePresentation()
  useViewHoldsVersion()
  const editor = workspace.editor
  const modes = useLiveModeCatalogue().reading
  return expressionsClipBinding({reading: workspace.editorReading ?? null, request: editor ? operation => editor.request(operation) : null,
    present: native.presentNativeEditor, colour: selected.track?.color, placed: presentation === 'arrangement',
    modes: modes.state === 'ready' ? modes.catalogue : null})
}
