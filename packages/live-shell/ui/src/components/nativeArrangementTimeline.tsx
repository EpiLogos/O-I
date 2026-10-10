import {useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent} from 'react'
import {editNativeSourceTiming, selectNativeSource, type NativeCompositionViewSource, type NativeSourceLane} from '../shell/compositionViews'
import type {NativeExpressionsContent, NativeGlyphClipSource} from '../shell/nativeContent'
import type {NativeEditorReply, NativeGlyphChange} from '../../../../expressions-boundary/src/editor'
import {
  arrangementSpans, clampRange, clampTiming, describeSpan, dropSlot, duplicateTarget, edgeDragToTiming, fitRange, formatSeconds,
  insertionTime, moveStepOrder, NO_SELECTION, panBy, percentOf, pruneSelection, rangeBounds, retimeLane, revealRange, rulerTicks,
  selectSpan, shiftStepOrder, zoomAround, type ArrangementClock, type ArrangementSpan, type SnapMode, type SpanSelection, type TimeRange,
  type TimingEdge, type TimingHandle,
} from './nativeArrangementModel'

/** Every edit is one existing owner request, performed by the parent. */
export type ArrangementEdit =
  | {kind: 'select'; stepId?: string; reveal: boolean}
  | {kind: 'timing'; stepId: string; timing: {hold: number} | {transition: number}}
  | {kind: 'order'; ids: string[]}
  | {kind: 'remove'; ids: string[]}
  | {kind: 'duplicate'; stepId: string}
  | {kind: 'open'; stepId: string; editor: 'source' | 'layers' | 'placement'};

/** The one request each edit sends, on the captured basis. Timing goes through
 * the same editNativeSourceTiming path as the Alt+arrow keys. */
export function arrangementEditEffect(source: NativeCompositionViewSource, clip: NativeGlyphClipSource, edit: ArrangementEdit):
  {effect: () => Promise<NativeEditorReply>; reveal: boolean | 'source' | 'layers' | 'placement'} {
  const entity = clip.scope.view_entity_id;
  const unavailable = (): Promise<NativeEditorReply> => Promise.resolve({ok: false, error: 'The native composition owner is unavailable'});
  const clipEdit = (changes: NativeGlyphChange[]) => source.actions ? source.actions.editClip(clip.id, changes) : unavailable();
  switch (edit.kind) {
    case 'select': return {effect: () => selectNativeSource(source, clip.id, edit.stepId), reveal: edit.reveal};
    case 'timing': return {effect: () => editNativeSourceTiming(source, clip.id, edit.stepId, edit.timing), reveal: false};
    case 'order': return {effect: () => clipEdit([{kind: 'step-order', entity_id: entity, step_ids: edit.ids}]), reveal: false};
    case 'remove': return {effect: () => clipEdit([{kind: 'step-remove', entity_id: entity, step_ids: edit.ids}]), reveal: false};
    case 'duplicate': return {effect: () => clipEdit([{kind: 'step-duplicate', entity_id: entity, step_id: edit.stepId}]), reveal: false};
    case 'open': return {effect: () => source.actions ? source.actions.openClip(clip.id, edit.stepId, edit.editor) : unavailable(), reveal: edit.editor};
  }
}

export interface NativeArrangementTimelineProps {
  content: NativeExpressionsContent;
  clock: ArrangementClock;
  unit: string;
  duration: number;
  lanes: readonly NativeSourceLane[];
  ready: boolean;
  perform: (clip: NativeGlyphClipSource, edit: ArrangementEdit) => Promise<void>;
  /** The saved-sequence loop flag read from the owner, and its one toggle request. */
  loop: {on: boolean; reason: string | null; toggle: () => void};
}

type Gesture =
  | {kind: 'pan'; pointer: number; startX: number; start: TimeRange; scale: number}
  | {kind: 'handle'; pointer: number; startX: number; lane: string; clip: NativeGlyphClipSource; stepId: string; key: TimingHandle;
      base: {hold: number; transition: number}; scale: number; moved: boolean; last: TimingEdge | null}
  | {kind: 'move'; pointer: number; startX: number; lane: string; clip: NativeGlyphClipSource; stepId: string; spans: ArrangementSpan[];
      box: {left: number; width: number}; window: TimeRange; moved: boolean; insertAt: number};
type DragView = {kind: 'handle'; lane: string; stepId: string; key: TimingHandle; value: number} | {kind: 'move'; lane: string; stepId: string; time: number};

const fmt = formatSeconds;

/** Arrangement lanes for Expressions: a ruler and zoomable window over the
 * authored source axis, span selection, and direct edits that each commit
 * one existing native glyph request. Window, selection and drafts stay local. */
export function NativeArrangementTimeline({content, clock, unit, duration, lanes, ready, perform, loop}: NativeArrangementTimelineProps) {
  const bounds = rangeBounds(duration, clock);
  const [view, setView] = useState<TimeRange | null>(null);
  const [selection, setSelection] = useState<SpanSelection>(NO_SELECTION);
  const [notice, setNotice] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const [pending, setPending] = useState(false);
  const [width, setWidth] = useState(0);
  const rulerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const escape = useRef<((event: KeyboardEvent) => void) | null>(null);
  const range = clampRange(view ?? fitRange(bounds), bounds);
  const span = range.end - range.start;
  const latest = useRef({range, bounds, scale: 1});
  latest.current = {range, bounds, scale: (width || 640) / span};

  useEffect(() => {
    const node = rulerRef.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const apply = (next: TimeRange) => {latest.current = {...latest.current, range: next}; setView(next)};
    const onWheel = (event: WheelEvent) => {
      const current = latest.current;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const box = rulerRef.current?.getBoundingClientRect();
        if (!box || box.width <= 0) return;
        const anchor = current.range.start + (event.clientX - box.left) / box.width * (current.range.end - current.range.start);
        apply(zoomAround(current.range, anchor, Math.pow(2, -event.deltaY / 240), current.bounds));
      } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        apply(panBy(current.range, (event.deltaX || event.deltaY) / current.scale, current.bounds));
      }
    };
    root.addEventListener('wheel', onWheel, {passive: false});
    return () => root.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => () => disarm(), []);

  const commit = (next: TimeRange) => {latest.current = {...latest.current, range: next}; setView(next)};
  // The draft stays on screen until the owner settles, so a committed drag does
  // not snap back to its old width while the request is in flight.
  const run = (clip: NativeGlyphClipSource, edit: ArrangementEdit) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    void perform(clip, edit).finally(() => {busy.current = false; setPending(false); setDrag(null)});
  };
  const arm = () => {
    disarm();
    const listener = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); cancelGesture()}};
    escape.current = listener;
    window.addEventListener('keydown', listener, true);
  };
  function disarm() {
    if (escape.current) window.removeEventListener('keydown', escape.current, true);
    escape.current = null;
  }
  function cancelGesture() {
    gesture.current = null;
    setDrag(null);
    disarm();
  }
  const editable = (clip: NativeGlyphClipSource) => ready && !pending && clip.capabilities.edit && clock === 'seconds';
  const reorderable = (clip: NativeGlyphClipSource) => ready && !pending && clip.capabilities.edit;

  const startPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || gesture.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    gesture.current = {kind: 'pan', pointer: event.pointerId, startX: event.clientX, start: range, scale: box.width / span};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const startHandle = (event: ReactPointerEvent<HTMLSpanElement>, lane: NativeSourceLane, state: ArrangementSpan, key: TimingHandle) => {
    if (event.button !== 0 || !editable(lane.source) || busy.current) return;
    event.stopPropagation();
    const track = event.currentTarget.closest('[role="listbox"]') as HTMLElement | null;
    const box = track?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    suppressClick.current = false;
    gesture.current = {kind: 'handle', pointer: event.pointerId, startX: event.clientX, lane: lane.source.id, clip: lane.source,
      stepId: state.stepId, key, base: {hold: state.hold, transition: state.transition}, scale: box.width / span, moved: false, last: null};
    event.currentTarget.setPointerCapture(event.pointerId);
    arm();
  };
  const startMove = (event: ReactPointerEvent<HTMLButtonElement>, lane: NativeSourceLane, state: ArrangementSpan, spans: ArrangementSpan[]) => {
    if (event.button !== 0 || !reorderable(lane.source) || busy.current) return;
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    suppressClick.current = false;
    gesture.current = {kind: 'move', pointer: event.pointerId, startX: event.clientX, lane: lane.source.id, clip: lane.source,
      stepId: state.stepId, spans, box: {left: box.left, width: box.width}, window: range, moved: false, insertAt: state.index};
    event.currentTarget.setPointerCapture(event.pointerId);
    arm();
  };

  // One pointer path for every gesture: captured targets bubble to the root.
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointer) return;
    const dx = event.clientX - active.startX;
    if (active.kind === 'pan') {
      commit(panBy(active.start, -dx / active.scale, bounds));
    } else if (active.kind === 'handle') {
      if (dx !== 0) active.moved = true;
      const snap: SnapMode = event.shiftKey ? 'free' : event.altKey ? 'coarse' : 'grid';
      const edge = edgeDragToTiming(active.base, dx, active.scale, snap, active.key);
      active.last = edge;
      setDrag({kind: 'handle', lane: active.lane, stepId: active.stepId, key: active.key, value: edge.value});
    } else {
      if (!active.moved && Math.abs(dx) <= 4) return;
      active.moved = true;
      const pointerTime = active.window.start + (event.clientX - active.box.left) / active.box.width * (active.window.end - active.window.start);
      active.insertAt = dropSlot(active.spans, active.stepId, pointerTime);
      setDrag({kind: 'move', lane: active.lane, stepId: active.stepId, time: insertionTime(active.spans, active.stepId, active.insertAt)});
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointer) return;
    gesture.current = null;
    disarm();
    if (active.kind === 'pan') {setDrag(null); return}
    if (active.kind === 'handle') {
      if (active.moved) suppressClick.current = true;
      const last = active.last;
      if (last?.changed && !busy.current) {
        run(active.clip, {kind: 'timing', stepId: active.stepId, timing: active.key === 'hold' ? {hold: last.value} : {transition: last.value}});
      } else setDrag(null);
      return;
    }
    setDrag(null);
    if (active.moved) {
      suppressClick.current = true;
      const ids = moveStepOrder(active.spans.map(state => state.stepId), active.stepId, active.insertAt);
      if (ids) run(active.clip, {kind: 'order', ids});
    }
  };
  const onPointerCancel = () => cancelGesture();

  const zoomBy = (factor: number, anchor = (range.start + range.end) / 2) => commit(zoomAround(range, anchor, factor, bounds));
  const onRulerKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); commit(panBy(range, -span / 10, bounds)); break;
      case 'ArrowRight': event.preventDefault(); commit(panBy(range, span / 10, bounds)); break;
      case 'ArrowUp': case '+': case '=': event.preventDefault(); zoomBy(2); break;
      case 'ArrowDown': case '-': event.preventDefault(); zoomBy(.5); break;
      case 'Home': event.preventDefault(); commit(panBy(range, bounds.start - range.start, bounds)); break;
      case 'End': event.preventDefault(); commit(panBy(range, bounds.end - range.end, bounds)); break;
    }
  };

  const onSpanKey = (event: ReactKeyboardEvent<HTMLButtonElement>, lane: NativeSourceLane, spans: ArrangementSpan[], state: ArrangementSpan) => {
    const clip = lane.source, key = event.key, laneId = clip.id;
    if (key === 'Escape') {
      if (selection.ids.length || notice) {event.stopPropagation(); setSelection(NO_SELECTION); setNotice(null)}
      return;
    }
    const current = pruneSelection(selection, laneId, spans);
    const targets = current.ids.length ? current : selectSpan(NO_SELECTION, laneId, spans, state.stepId, 'replace');
    if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'd') {
      event.preventDefault();
      if (!reorderable(clip)) return;
      const target = duplicateTarget(targets, laneId);
      if (!target.ok) {setNotice(target.reason); return}
      setNotice(null);
      run(clip, {kind: 'duplicate', stepId: target.stepId});
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      if (!reorderable(clip)) return;
      setNotice(null);
      run(clip, {kind: 'remove', ids: [...targets.ids]});
      return;
    }
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return;
    if (event.altKey && event.shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      event.preventDefault();
      if (event.repeat || !reorderable(clip)) return;
      const ids = shiftStepOrder(spans.map(item => item.stepId), state.stepId, key === 'ArrowLeft' ? -1 : 1);
      if (ids) run(clip, {kind: 'order', ids});
      return;
    }
    if (event.altKey) {
      // Same keys and 0.1 s steps as the existing native timing edit.
      if (event.repeat || !editable(clip)) return;
      const hold = key === 'ArrowLeft' || key === 'ArrowRight';
      const value = clampTiming(Number(((hold ? state.hold : state.transition) + (key === 'ArrowLeft' || key === 'ArrowDown' ? -.1 : .1)).toFixed(3)));
      event.preventDefault();
      run(clip, {kind: 'timing', stepId: state.stepId, timing: hold ? {hold: value} : {transition: value}});
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const options = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
      const next = options[options.indexOf(event.currentTarget) + (key === 'ArrowRight' ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      const target = spans.find(item => item.stepId === next.dataset.stepId);
      if (target) commit(revealRange(range, target.axisStart, target.axisEnd, bounds));
      next.focus({preventScroll: true});
    }
  };

  const ticks = rulerTicks(range.start, range.end, width || 640, clock);
  const playback = content.playback;
  const playhead = clock === 'seconds' && playback && playback.scene_ref === content.basis.scene_ref ? playback.scene_elapsed_seconds : null;
  const playPct = playhead !== null && playhead >= range.start && playhead <= range.end ? percentOf(playhead, range) : null;

  const selectedLane = lanes.find(lane => lane.source.id === selection.lane);
  const selectedSpans = selectedLane ? arrangementSpans(selectedLane.states) : [];
  const shownSelection = selectedLane ? pruneSelection(selection, selectedLane.source.id, selectedSpans) : NO_SELECTION;
  const primary = selectedSpans.find(item => item.stepId === shownSelection.primary);
  const primaryName = selectedLane?.source.sequence.steps.find(step => step.id === primary?.stepId);
  const inspector = notice ?? (primary && selectedLane
    ? `${primaryName?.name || primaryName?.text || `State ${primary.index + 1}`} · ${describeSpan(primary, unit)}${shownSelection.ids.length > 1 ? ` · ${shownSelection.ids.length} states selected` : ''}`
    : 'Select a state to inspect its exact hold and transition.');
  const draftNote = drag?.kind === 'handle' ? ` · draft ${drag.key} ${fmt(drag.value)} s` : '';

  return <div className="nar-timeline" ref={rootRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
    <div className="nar-ruler-row">
      <div className="nar-ruler" ref={rulerRef} role="slider" tabIndex={0} aria-label={`Authored source time in ${unit}, visible window`}
        aria-valuemin={bounds.start} aria-valuemax={Math.max(bounds.start, bounds.end - span)} aria-valuenow={range.start}
        aria-valuetext={`${fmt(range.start)} to ${fmt(range.end)} ${unit}`}
        title="Drag or scroll to pan · Ctrl/⌘+wheel or ↑↓ to zoom · ←→ to pan · Home or End to go to the ends"
        onPointerDown={startPan}
        onKeyDown={onRulerKey}>
        <div className="nar-ticks">{ticks.map(tick => {
          const pct = percentOf(tick.time, range);
          return <span key={tick.time} className={pct > 92 ? 'nar-tick-end' : undefined} style={{left: `${pct}%`}}>{tick.label}</span>;
        })}</div>
        {playPct !== null && <i className="nar-playhead" aria-hidden="true" style={{left: `${playPct}%`}} />}
      </div>
      <div className="nar-ruler-controls">
        <button type="button" aria-label="Zoom out" title="Zoom out" disabled={span >= bounds.end - bounds.start} onClick={() => zoomBy(.5)}>−</button>
        <button type="button" aria-label="Zoom in" title="Zoom in" disabled={span <= bounds.minSpan} onClick={() => zoomBy(2)}>+</button>
        <button type="button" aria-label="Fit whole source time" title="Fit the whole Scene span" onClick={() => commit(fitRange(bounds))}>Fit</button>
        <button type="button" className="nar-chip nar-loop" aria-label="Loop saved sequence" aria-pressed={loop.on} disabled={!!loop.reason}
          title={loop.reason ?? 'Loop the saved Scene sequence back to its first Scene at the end'} onClick={loop.toggle}>Loop</button>
      </div>
    </div>
    <div className="native-source-lanes">{lanes.map(lane => {
      const base = arrangementSpans(lane.states);
      const laneId = lane.source.id;
      const here = drag?.lane === laneId ? drag : null;
      const shown = here?.kind === 'handle' ? retimeLane(base, here.stepId, here.key === 'hold' ? {hold: here.value} : {transition: here.value}) : base;
      const current = pruneSelection(selection, laneId, base);
      const canEdit = editable(lane.source);
      const insertPct = here?.kind === 'move' ? percentOf(here.time, range) : null;
      return <div className="arrange-row native-source-row nar-row" key={lane.member.id} data-native-member={lane.member.id} data-native-source={laneId}>
        <div className="nar-lane">
          <div className="nar-track" role="listbox" aria-label={`${lane.source.name} states, ${unit}`} aria-multiselectable="true" aria-orientation="horizontal"
            onPointerDown={event => {if (event.target === event.currentTarget) startPan(event)}}>
            {shown.map(state => {
              const step = lane.source.sequence.steps.find(item => item.id === state.stepId);
              const name = step?.name || step?.text || `State ${state.index + 1}`;
              const native = lane.source.selected_step_id === state.stepId;
              const extent = state.axisEnd - state.axisStart;
              const holdPct = extent > 0 ? state.axisHold / extent * 100 : 0;
              const transitionPct = extent > 0 ? state.axisTransition / extent * 100 : 0;
              const drafting = here?.kind === 'handle' && here.stepId === state.stepId;
              const original = base[state.index];
              return <button key={state.stepId} type="button" role="option" className="arrange-clip native-state-span"
                data-step-id={state.stepId} data-native-selected={native ? 'true' : undefined} data-draft={drafting ? 'true' : undefined}
                aria-selected={current.ids.includes(state.stepId)} aria-current={native ? 'true' : undefined}
                disabled={!ready || !lane.source.capabilities.select}
                aria-label={`${lane.source.name}, state ${state.index + 1}, ${step?.name || step?.text || step?.shape}`}
                title={clock === 'seconds' ? 'Click selects and opens Clip detail · Shift+click extends · Ctrl/⌘+click toggles · drag to reorder · Alt+←/→ hold ±0.1 s · Alt+↑/↓ transition ±0.1 s · Alt+Shift+←/→ moves · Ctrl/⌘+D duplicates · Delete removes' : 'Select state and edit in Clip detail · morph dwell belongs to the shared Field'}
                style={{left: `${percentOf(state.axisStart, range)}%`, width: `${extent / span * 100}%`}}
                onPointerDown={event => startMove(event, lane, original, base)}
                onClick={event => {
                  if (suppressClick.current) {suppressClick.current = false; return}
                  const mode = event.metaKey || event.ctrlKey ? 'toggle' : event.shiftKey ? 'extend' : 'replace';
                  setSelection(selectSpan(selection.lane === laneId ? selection : NO_SELECTION, laneId, base, state.stepId, mode));
                  setNotice(null);
                  if (mode !== 'toggle') run(lane.source, {kind: 'select', stepId: state.stepId, reveal: mode === 'replace'});
                }}
                onKeyDown={event => onSpanKey(event, lane, base, original)}>
                <span className="native-state-transition" style={{width: `${transitionPct}%`}} />
                <span className="nar-name">{name}</span><small>{fmt(state.axisStart)}–{fmt(state.axisEnd)}</small>
                {canEdit && <>
                  <span className="nar-handle" aria-hidden="true" data-handle="hold" style={{left: `${holdPct}%`}}
                    onPointerDown={event => startHandle(event, lane, original, 'hold')} />
                  <span className="nar-handle" aria-hidden="true" data-handle="transition" style={{left: '100%'}}
                    onPointerDown={event => startHandle(event, lane, original, 'transition')} />
                </>}
              </button>;
            })}
            {insertPct !== null && <i className="nar-insert" aria-hidden="true" style={{left: `${insertPct}%`}} />}
            {playPct !== null && <i className="nar-playhead" aria-hidden="true" style={{left: `${playPct}%`}} />}
          </div>
          {clock === 'morph' && <span className="nar-note">Morph dwell is edited in the shared Field</span>}
        </div>
        <div className="arrange-lane-label native-source-label">
          <button disabled={!ready || !lane.source.capabilities.select} onClick={() => run(lane.source, {kind: 'select', reveal: true})}>{lane.source.name}</button>
          <small>{lane.states.length} authored states · {unit}</small>
          <div className="native-source-controls">{(['source', 'layers', 'placement'] as const).map(editor => <button key={editor} disabled={!ready || !lane.source.capabilities.open || !lane.states.length}
            onClick={() => run(lane.source, {kind: 'open', stepId: lane.source.selected_step_id ?? lane.states[0].step_id, editor})}>{editor === 'source' ? 'Source' : editor === 'layers' ? 'Layers' : 'Placement'}</button>)}</div>
        </div>
      </div>;
    })}</div>
    <div className="nar-inspector" role="status" aria-live="polite">{inspector}{draftNote}{playhead !== null && !draftNote ? ` · playhead ${fmt(playhead)} s` : ''}</div>
  </div>;
}
