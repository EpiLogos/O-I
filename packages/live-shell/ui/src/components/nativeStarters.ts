/** Native starters: the app's sequence presets (nativeFeatures.ts applyChain, applyKundaliniSequence) as admitted native
 * changes, and the Semantic Chakra Body merge (app.ts chakra-add) as far as the admitted changes reach.
 *
 * The target sequence is produced by the app's own helper on a clone of the live formation; each builder then emits
 * only admitted changes that reproduce that target. A state the boundary cannot place is never guessed: a second
 * step addresses new states by the ids in the reply's reading. Pure apart from the injected request. No DOM. */
import {applyChain, applyKundaliniSequence, CHAIN_PRESETS} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeFeatures'
import {clone, uid, type Entity, type Vec3} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model'
import {makeChakraSemanticField, makeSemanticChakraEntities} from '../../../../../desktop/cradle/expressions-app/src/engine/semantics/chakraPresets'
import type {NativeEditorBasis, NativeEditorChange, NativeEditorReading, NativeEditorReply, NativeSequenceSettings} from '../../../../expressions-boundary/src/editor'
import {FORMATION_SCENE_LIMIT, validateFormationAdd} from '../../../../expressions-boundary/src/nativeFormations'

/** A formation holds up to 32 states (formationAuthoring.ts appendFormationState; the boundary's step-insert law). */
export const STATE_LIMIT = 32

export type StarterRequest = (changes: NativeEditorChange[], basis?: NativeEditorBasis) => Promise<NativeEditorReply>
export type StarterResult = {ok: true} | {ok: false; error: string}

function refuse(reason: string): never {throw Error(reason)}

/** The live formation this starter acts on, or the legible reason it cannot. Pending owner work refuses first. */
export function formationFor(reading: NativeEditorReading | null, entityId: string | undefined): Entity {
  if (!reading) refuse('Open a native Expression to add a starter.')
  if (reading.standing.pending) refuse('Waiting for the native owner to acknowledge the last change.')
  if (!entityId) refuse('Select a formation first.')
  const live = reading.scene.entities.find(entity => entity.id === entityId)
  if (!live) refuse('The selected formation is no longer in this Scene.')
  if (live.kind !== 'formation') refuse('A starter takes a formation; a pin carries no sequence.')
  if (live.locked) refuse('Unlock this formation before changing its sequence.')
  if (new Set(live.sequence.steps.map(step => step.id)).size !== live.sequence.steps.length)
    refuse('This sequence contains ambiguous state identities; repair its source before editing.')
  return live
}

/** One batch that sets the sequence settings, inserts the new states at the front (last first, so they read in order),
 * then removes the old states. Insert-at-front needs no id of a state the batch itself creates. */
function replaceStates(entity: Entity, settings: NativeSequenceSettings, texts: readonly string[]): NativeEditorChange[] {
  const old = entity.sequence.steps.map(step => step.id)
  if (old.length + texts.length > STATE_LIMIT) refuse('A formation holds up to 32 states; remove some before this starter.')
  const changes: NativeEditorChange[] = [{kind: 'sequence-settings', entity_id: entity.id, values: settings}]
  for (const text of [...texts].reverse()) changes.push({kind: 'step-insert', entity_id: entity.id, after_step_id: null, shape: 'text', text})
  if (old.length) changes.push({kind: 'step-remove', entity_id: entity.id, step_ids: old})
  return changes
}

/** Chain preset on the selected formation: one batch. Settings carry the preset's hold, transition and easing. */
export function chainStepChanges(reading: NativeEditorReading | null, entityId: string | undefined, presetId: string): NativeEditorChange[] {
  const live = formationFor(reading, entityId)
  if (!CHAIN_PRESETS.some(preset => preset.id === presetId)) refuse('Unknown native sequence preset')
  const target = clone(live)
  applyChain(target, presetId)
  const {hold, transition, easing} = target.sequence
  const settings: NativeSequenceSettings = {enabled: true, clock: 'seconds', order: 'loop', hold, transition, ...(easing ? {easing} : {})}
  return replaceStates(live, settings, target.sequence.steps.map(step => step.text))
}

/** Kundalini rising sequence on the selected formation, first step: the seven seed syllables replace its states. */
export function kundaliniSequenceChanges(reading: NativeEditorReading | null, entityId: string | undefined): NativeEditorChange[] {
  const live = formationFor(reading, entityId)
  const target = clone(live)
  applyKundaliniSequence(target)
  const settings: NativeSequenceSettings = {enabled: true, clock: 'seconds', order: 'loop'}
  return replaceStates(live, settings, target.sequence.steps.map(step => step.text))
}

/** Kundalini, second step: the seven new states take their spatial positions. Ids come from the reply's reading;
 * each state is checked against the app's own target glyph before its position is written. */
export function kundaliniPlacementChanges(reading: NativeEditorReading | null, entityId: string | undefined): NativeEditorChange[] {
  const live = formationFor(reading, entityId)
  const target = clone(live)
  applyKundaliniSequence(target)
  const steps = live.sequence.steps, want = target.sequence.steps
  if (steps.length !== want.length || steps.some((step, index) => step.text !== want[index].text))
    refuse('The rising sequence is not in place; read the Scene again before placing it.')
  return steps.map((step, index) => ({kind: 'step-position', entity_id: live.id, step_id: step.id, position: clone(want[index].position as Vec3)}))
}

/** Semantic Chakra Body: the app's chakra_body starter is seven yantra formations (makeSemanticChakraEntities).
 * The admitted formation add refuses yantra (nativeFormations.ts), so the first step cannot be expressed. */
export function chakraAddChanges(reading: NativeEditorReading | null): NativeEditorChange[] {
  if (!reading) refuse('Open a native Expression to add a starter.')
  if (reading.scene.entities.length + makeSemanticChakraEntities('yantra').length > FORMATION_SCENE_LIMIT)
    refuse('A scene holds up to 32 formations and pins.')
  const shape = makeSemanticChakraEntities('yantra')[0].shape.kind
  try {validateFormationAdd({kind: 'formation-add', shape})}
  catch (cause) {refuse(`The Semantic Chakra Body centres are ${shape} formations, which the add form does not carry. ${cause instanceof Error ? cause.message : String(cause)}`)}
  refuse('The starter add is not built: the boundary admits this shape now, but no builder carries it yet.')
}

/** Semantic Chakra Body, meaning step: each new centre (in the starter's order) takes its binding, and the field its
 * global gain. Ids name the centres just created; the binding identities are fresh so the Scene never repeats one. */
export function chakraBindChanges(reading: NativeEditorReading | null, newEntityIds: readonly string[]): NativeEditorChange[] {
  if (!reading) refuse('Open a native Expression to add a starter.')
  const centres = makeSemanticChakraEntities('yantra'), source = makeChakraSemanticField(centres, 'constant')
  if (newEntityIds.length !== centres.length) refuse('The starter centres are not all in place; read the Scene again.')
  const byStarter = new Map(centres.map((centre, index) => [centre.id, newEntityIds[index]]))
  for (const id of newEntityIds) if (!reading.scene.entities.some(entity => entity.id === id)) refuse('A new centre is missing from the Scene.')
  const changes: NativeEditorChange[] = []
  for (const binding of source.bindings) {
    const carrier = binding.carriers.find(item => item.kind === 'entity')
    const entityId = carrier && byStarter.get(carrier.id)
    if (!entityId) refuse('A starter meaning names no centre of the starter.')
    changes.push({kind: 'entity-semantic', entity_id: entityId, semantic: {...clone(binding), id: uid('semantic'), carriers: [{kind: 'entity', id: entityId}]}})
  }
  changes.push({kind: 'semantic-field-setting', key: 'globalColorGain', value: source.globalColorGain})
  return changes
}

/** The Starters the Browser lists, in order: the kundalini rising sequence, then one chain per app preset. */
export const STARTER_IDS = ['kundalini', ...CHAIN_PRESETS.map(preset => `chain:${preset.id}`)] as const
export type StarterId = (typeof STARTER_IDS)[number]

/** The batches a Starter sends, in order. Each step reads the reading the previous reply left. */
export function starterSteps(id: string, entityId: string | undefined): ((reading: NativeEditorReading) => NativeEditorChange[])[] {
  if (id === 'kundalini') return [r => kundaliniSequenceChanges(r, entityId), r => kundaliniPlacementChanges(r, entityId)]
  const preset = id.startsWith('chain:') ? id.slice('chain:'.length) : refuse('Unknown starter.')
  return [r => chainStepChanges(r, entityId, preset)]
}

/** The Starter's label, from the app's own preset names. */
export function starterName(id: string): string {
  if (id === 'kundalini') return 'Kundalini sequence (on selected formation)'
  const preset = CHAIN_PRESETS.find(item => `chain:${item.id}` === id)
  return preset ? `Chain: ${preset.name}` : 'Unknown starter'
}

export interface StarterRow {id: string; name: string; summary: string; reason: string | null}
/** The Starters rows. A row is disabled with its reason when its first batch would be refused now (no selection, a pin,
 * a lock, pending owner work, the 32-state budget). The first batch is built, not sent, so the reason is the builder's. */
export function starterRows(reading: NativeEditorReading | null): StarterRow[] {
  const entityId = reading?.selection?.entity_ids?.[0]
  return STARTER_IDS.map(id => {
    const summary = id === 'kundalini' ? 'Seven seed syllables rise Root to Crown on this formation; the second step places them.'
      : CHAIN_PRESETS.find(preset => `chain:${preset.id}` === id)?.description ?? ''
    let reason: string | null = null
    if (!reading) reason = 'Open a native Expression to add a starter.'
    else {try {starterSteps(id, entityId)[0](reading)} catch (cause) {reason = cause instanceof Error ? cause.message : String(cause)}}
    return {id, name: starterName(id), summary, reason}
  })
}

/** Runs one starter through the retained owner. Two-step flows send the second batch on the reply's own basis. */
export async function runStarter(steps: readonly ((reading: NativeEditorReading) => NativeEditorChange[])[], reading: NativeEditorReading,
  request: StarterRequest, onProgress: (line: string) => void = () => undefined): Promise<StarterResult> {
  let current = reading
  for (const [index, step] of steps.entries()) {
    onProgress(index === 0 ? 'Writing the first step…' : 'Placing the states from the reply…')
    let changes: NativeEditorChange[]
    try {changes = step(current)} catch (cause) {return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}}
    let reply: NativeEditorReply
    try {reply = await request(changes, current.basis)} catch (cause) {return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}}
    if (!reply.ok) return {ok: false, error: reply.error}
    current = reply.reading
  }
  return {ok: true}
}
