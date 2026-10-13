// Scene sequence editor: the Clip side of a selected Expressions scene, drawn as
// Live's Clip view (DEVICE-SEMANTICS-LOCK §9.4). Entity lanes run across the
// scene's sequence states; a state's hold is a note's length and its transition
// the note's glide. Each automation lane is a clip envelope that names the source
// moving its target (lock §14).
//
// Reads only the native editor's own reading (NativeEditorReading). Nothing is
// written here. A click sends the existing 'select' request; a double click sends
// the existing 'open' request, which the retained owner answers by presenting its
// native editor (NativeWorldDetail's request wrapper, presentNativeEditor).
//
// Timing: a note's length and glide come from the production bridge's reading
// (readNativeGlyphTiming, shell/nativeContent.ts), because the engine's effective
// hold is not always the step's own hold (nativeBridge.ts:54). The inside-of-one-
// scene projection is projectSceneSequence (timeline/expressionsSequenceEditor.ts).
//
// Pure helpers are exported for the SSR suite. No store, no fetch.
// Ports (path:line at HEAD 8bf279d3e): the projection, expressionsSequenceEditor.ts:127-164;
// the piano roll drawn at the mockup's Live clip view, desktop/cradle/docs/world-shell/world-shell-mockup.html:1759-1763.

import type {NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor';
import {projectSceneSequence, type ExpressionsGlyph, type ExpressionsTrackReading} from '../timeline/expressionsSequenceEditor';
import {readNativeGlyphTiming} from '../shell/nativeContent';
import {modulationOf} from './nativeModulation';
import './sceneSequenceEditor.css';

export type SceneUnit = 'seconds' | 'field cycles';

export interface SceneNote {
  id: string;
  entityId: string;
  stepId: string;
  label: string;
  start: number;
  length: number;
  glide: number;
  selected: boolean;
}

export interface SceneLane {
  id: string;
  entityId: string;
  name: string;
  glyph: string;
  /** False when the object has no native occurrence: its states are drawn but cannot be addressed. */
  bound: boolean;
  notes: SceneNote[];
}

export interface SceneEnvelope {
  id: string;
  target: string;
  enabled: boolean;
  /** The sources moving this target, as the reading names them (nativeModulation.ts); null when none. */
  modulatedBy: string | null;
}

export interface SceneSequenceModel {
  name: string;
  duration: number;
  unit: SceneUnit;
  /** The ruler's extent: the scene's duration, or the last note's end when the states run longer. */
  total: number;
  ticks: number[];
  lanes: SceneLane[];
  envelopes: SceneEnvelope[];
  takes: {id: string; name: string}[];
  noteCount: number;
  timingFault: string | null;
  selected: SceneNote | null;
}

type Operation = (operation: NativeEditorRequest) => Promise<NativeEditorReply>;

const glyphText = (glyph: ExpressionsGlyph | undefined): string => glyph?.text || glyph?.shape || '';
const fmt = (value: number): string => String(Number(value.toFixed(2)));
const pct = (value: number, total: number): string => `${total > 0 ? Number((value / total * 100).toFixed(4)) : 0}%`;

/** The scene as the projection reads it: formation states carry the engine's effective timing; other objects have no states. */
export function expressionsTrackReadingOf(reading: NativeEditorReading): {track: ExpressionsTrackReading; unit: SceneUnit; timingFault: string | null} {
  const scene = reading.scene;
  let timingFault: string | null = null;
  const unit: SceneUnit = scene.entities.some(entity => entity.kind === 'formation' && entity.sequence.clock === 'morph') ? 'field cycles' : 'seconds';
  const entities: ExpressionsTrackReading['presented']['entities'] = scene.entities.map(entity => {
    const glyph: ExpressionsGlyph = entity.text ? {text: entity.text} : {shape: entity.shape};
    if (entity.kind !== 'formation') return {id: entity.id, name: entity.name, glyph, sequence: []};
    let timed = new Map<string, {hold: number; transition: number}>();
    try {
      const timing = readNativeGlyphTiming(entity, scene.morph.dwell);
      timed = new Map(timing.states.map(state => [state.step_id, timing.clock === 'morph'
        ? {hold: state.axis_hold, transition: state.axis_transition}
        : {hold: state.hold_seconds, transition: state.transition_seconds}]));
    } catch (cause) {
      if (!timingFault) timingFault = cause instanceof Error ? cause.message : String(cause);
      timed = new Map(entity.sequence.steps.map(step => [step.id, {hold: step.hold, transition: step.transition}]));
    }
    return {id: entity.id, name: entity.name, glyph, sequence: entity.sequence.steps.map(step => {
      const timing = timed.get(step.id) ?? {hold: step.hold, transition: step.transition};
      const stepGlyph: ExpressionsGlyph = step.text ? {text: step.text} : {shape: step.shape};
      return {id: step.id, hold: timing.hold, transition: timing.transition, glyph: stepGlyph};
    })};
  });
  const track: ExpressionsTrackReading = {
    scenes: [{id: scene.id, name: scene.name, duration: scene.duration}],
    presentedSceneId: scene.id,
    presented: {
      entities,
      automationLanes: (scene.automation ?? []).map(lane => ({id: lane.id, target: lane.target, enabled: lane.enabled})),
      propertyTracks: (scene.propertyTracks ?? []).map(take => ({id: take.id, bind: take.bind})),
    },
  };
  return {track, unit, timingFault};
}

function tickStep(total: number): number {
  const steps = [.25, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  return steps.find(step => total / step <= 12) ?? 3600;
}

function ticksOf(total: number): number[] {
  const step = tickStep(total), out: number[] = [];
  for (let t = 0; t <= total + 1e-9 && out.length < 64; t += step) out.push(Number(t.toFixed(4)));
  return out;
}

function modulatorOf(reading: NativeEditorReading, target: string): string | null {
  try {
    const names = modulationOf(reading, target).sources.map(source => source.name);
    return names.length > 0 ? names.join('; ') : null;
  } catch {
    // A target the reading cannot resolve names no modulator here; it is not guessed.
    return null;
  }
}

/** The scene's clip model: lanes = objects, notes = states (start, hold as length, transition as glide), envelopes and takes. Pure. */
export function sceneSequenceModel(reading: NativeEditorReading): SceneSequenceModel {
  const {track, unit, timingFault} = expressionsTrackReadingOf(reading);
  const sequence = projectSceneSequence(track);
  const selectedStep = reading.selection.step_id;
  const glyphOf = new Map(track.presented.entities.map(entity => [entity.id, glyphText(entity.glyph)]));
  // The projection names each note `clip:<entity>:<step>` (expressionsSequenceEditor.ts:139).
  const addressOf = new Map<string, {entityId: string; stepId: string}>();
  for (const entity of track.presented.entities) {
    for (const step of entity.sequence ?? []) addressOf.set(`clip:${entity.id}:${step.id}`, {entityId: entity.id, stepId: step.id});
  }
  const lanes: SceneLane[] = sequence.lanes.map(lane => {
    const notes = sequence.notes.filter(note => note.laneId === lane.id).map((note): SceneNote => {
      const address = addressOf.get(note.id) ?? {entityId: lane.entityId, stepId: note.id};
      return {
        id: note.id, entityId: address.entityId, stepId: address.stepId, label: note.label,
        start: note.start, length: note.length, glide: note.glide,
        selected: selectedStep !== null && address.stepId === selectedStep && reading.selection.entity_ids.includes(address.entityId),
      };
    });
    return {id: lane.id, entityId: lane.entityId, name: lane.name, glyph: glyphOf.get(lane.entityId) ?? '',
      bound: Boolean(reading.entityOccurrences[lane.entityId]), notes};
  });
  const notes = lanes.flatMap(lane => lane.notes);
  const maxEnd = Math.max(0, ...notes.map(note => note.start + note.length + note.glide));
  const total = Math.max(reading.scene.duration, maxEnd);
  return {
    name: reading.scene.name,
    duration: reading.scene.duration,
    unit,
    total,
    ticks: ticksOf(total),
    lanes,
    envelopes: sequence.envelopes.map(envelope => ({
      id: envelope.id, target: envelope.target, enabled: envelope.enabled,
      modulatedBy: envelope.enabled ? modulatorOf(reading, envelope.target) : null,
    })),
    takes: sequence.takes.map(take => ({id: take.id, name: take.name})),
    noteCount: notes.length,
    timingFault,
    selected: notes.find(note => note.selected) ?? null,
  };
}

/** The existing selection request, addressed to one state. */
export function selectStateRequest(reading: NativeEditorReading, entityId: string, stepId: string): NativeEditorRequest {
  return {operation: 'select', basis: reading.basis, entity_id: entityId, step_id: stepId};
}

/** The existing open request: the retained owner presents its native source editor at this state. */
export function openStateRequest(reading: NativeEditorReading, entityId: string, stepId: string): NativeEditorRequest {
  return {operation: 'open', basis: reading.basis, entity_id: entityId, step_id: stepId, editor: 'source'};
}

export function SceneSequenceEditor({reading, request}: {reading: NativeEditorReading | null; request: Operation}) {
  if (!reading) {
    return <section className="scene-sequence" aria-label="Scene notes"><p className="scene-sequence-empty">Native owner loading</p></section>;
  }
  let model: SceneSequenceModel;
  try {
    model = sceneSequenceModel(reading);
  } catch (cause) {
    return <section className="scene-sequence" aria-label="Scene notes"><p role="alert" className="scene-sequence-empty">{cause instanceof Error ? cause.message : String(cause)}</p></section>;
  }
  const live = !reading.standing.pending;
  const select = (entityId: string, stepId: string) => void request(selectStateRequest(reading, entityId, stepId));
  const open = (entityId: string, stepId: string) => void request(openStateRequest(reading, entityId, stepId));
  const clipSelected = model.selected;
  const clipSelectedBound = clipSelected ? model.lanes.some(lane => lane.entityId === clipSelected.entityId && lane.bound) : false;
  return <section className="scene-sequence" aria-label="Scene notes">
    <aside className="scene-clip" aria-label="Scene clip">
      <div className="scene-clip-head">{model.name}</div>
      <dl className="scene-clip-facts">
        <dt>Length</dt><dd>{fmt(model.duration)} {model.unit}</dd>
        <dt>States</dt><dd>{model.noteCount}</dd>
        <dt>Objects</dt><dd>{model.lanes.length}</dd>
        <dt>Envelopes</dt><dd>{model.envelopes.length}</dd>
      </dl>
      <h5>Takes</h5>
      {model.takes.length > 0
        ? <ul className="scene-takes">{model.takes.map(take => <li key={take.id}>{take.name}</li>)}</ul>
        : <p className="scene-muted">No takes recorded</p>}
      <button type="button" className="scene-open" disabled={!live || !clipSelected || !clipSelectedBound}
        title="Open the selected state in the native editor" onClick={() => clipSelected && open(clipSelected.entityId, clipSelected.stepId)}>Open selected state</button>
      {model.timingFault && <p role="alert" className="scene-fault">Engine timing unreadable ({model.timingFault}); authored hold and transition are shown.</p>}
      {!live && <p className="scene-muted">Owner pending</p>}
    </aside>
    <div className="scene-notes">
      <h5>Notes</h5>
      {model.noteCount === 0 && <p className="scene-empty">This scene has no sequence states to draw. States are edited in the States editor below.</p>}
      <div className="scene-roll" role="group" aria-label={`Notes of ${model.name}, scale ${model.total} ${model.unit}`}>
        <div className="scene-roll-row scene-ruler"><span className="scene-ruler-cell">{model.unit}</span>
          <div className="scene-ruler-track">{model.ticks.map(tick => <span key={tick} className="scene-tick" style={{left: pct(tick, model.total)}}>{fmt(tick)}</span>)}</div></div>
        {model.lanes.map(lane => <div key={lane.id} className="scene-roll-row scene-lane" data-entity={lane.entityId}>
          <div className="scene-lane-head"><span className="scene-lane-glyph" aria-hidden="true">{lane.glyph}</span><span>{lane.name}</span></div>
          <div className="scene-lane-track">
            {model.ticks.map(tick => <span key={tick} className="scene-gridline" aria-hidden="true" style={{left: pct(tick, model.total)}}/>)}
            {lane.notes.map(note => <span key={note.id} className="scene-note-slot">
              <button type="button" className={`scene-note${note.selected ? ' is-selected' : ''}`} style={{left: pct(note.start, model.total), width: pct(note.length, model.total)}}
                aria-pressed={note.selected} disabled={!live || !lane.bound}
                aria-label={`${lane.name}, state ${note.label}, hold ${fmt(note.length)} ${model.unit}${note.glide > 0 ? `, glide ${fmt(note.glide)} ${model.unit}` : ''}`}
                title="Click to select this state. Double-click opens its source in the native editor."
                onClick={() => select(note.entityId, note.stepId)} onDoubleClick={() => open(note.entityId, note.stepId)}>
                <span>{note.label}</span>
              </button>
              {note.glide > 0 && <span className="scene-glide" aria-hidden="true" style={{left: pct(note.start + note.length, model.total), width: pct(note.glide, model.total)}}/>}
            </span>)}
          </div>
        </div>)}
      </div>
      <h5>Envelopes</h5>
      {model.envelopes.length === 0 && <p className="scene-muted">No automation lanes in this scene</p>}
      <ul className="scene-envelopes">{model.envelopes.map(envelope => <li key={envelope.id} className={`scene-envelope${envelope.enabled ? '' : ' is-off'}`}
        aria-label={`Envelope ${envelope.target}, ${envelope.enabled ? `modulated by ${envelope.modulatedBy ?? 'no named source'}` : 'off'}`}>
        <span className="scene-envelope-target">{envelope.target}</span>
        <span className="scene-envelope-lane" aria-hidden="true"/>
        <span className="scene-envelope-by">{envelope.enabled ? envelope.modulatedBy ?? 'no named source' : 'off'}</span>
      </li>)}</ul>
    </div>
  </section>;
}
