import {useEffect, useMemo, useRef, useState} from 'react';
import type {NativeEditorReply} from '../../../../expressions-boundary/src/editor';
import {currentCompositionReply, currentNativeSceneReply, type NativeCompositionViewSource} from '../shell/compositionViews';
import type {NativeContentActions, NativeSceneAction} from '../shell/nativeContent';
import {Icon} from './Icon';
import {STAGE_TAKE_MODES, type StageTakeMode} from '@epilogos/expressions-boundary';
import {frameTakeReason, TAKE_MODE_LABELS, takeStart, takeStop, useFrameTakeLink, type FrameStageRun} from '../native/frameTakes';
import {STAGE_AUTOMATION_RESUME} from '../native/stageCommands';
import {clampSeek, scrubRequest, scrubStep, sceneFocused, sceneTransportModel, spaceTogglesPlayback} from './nativeScenePlayback';
import {saveNotice, saveState} from './nativeExpressionCommands';
import {NativeExpressionGuide} from './NativeExpressionGuide';
import {BarEngineLight, BarPointerGroup, BarTools, BarValue, type BarApply} from './NativeBarControls';
import {createLiveSession} from './nativeBarSession';
import {PinModeToggle} from './NativePinControls';
/** About 4 Hz: fast enough to watch a lane move, slow enough that a full reading read stays cheap. */
export const EFFECTIVE_POLL_MS = 250;
import {BarStrip} from './NativeBarStrip';
import {barParameter, barPlayRoute, barResume} from './nativeBarModel';
import './NativeTransportBar.css';

type Actions = NonNullable<NativeContentActions>;

/** The Expressions transport in the shell bar. It owns no clock and no playback
 * state: each control is one owner request on the captured basis, and each
 * readout is the owner's reading. The pure model is nativeScenePlayback.ts. */
export function NativeTransportBar({source}: {source: NativeCompositionViewSource}) {
  const latest = useRef(source); latest.current = source;
  const lifetime = useRef({mounted: false, epoch: 0});
  useEffect(() => {const own = ++lifetime.current.epoch; lifetime.current.mounted = true; return () => {if (lifetime.current.epoch === own) {lifetime.current.mounted = false; lifetime.current.epoch++}}}, []);
  const [fault, setFault] = useState<string | null>(null), [busy, setBusy] = useState(false), [moreOpen, setMoreOpen] = useState(false);
  // Save reports the owner's own reading only; the guide is a popover over the transport.
  const [saveNoticeText, setSaveNoticeText] = useState<string | null>(null), [guideOpen, setGuideOpen] = useState(false);
  const saveRef = useRef<(() => void) | null>(null);
  // The scrub draft is local presentation until release; it never reaches the owner.
  const [draft, setDraft] = useState<number | null>(null); const draftRef = useRef<number | null>(null);
  const identity = source.content?.basis.scene_ref;
  // The take control reads the frame's own readings and starts its take in the mode chosen here.
  const link = useFrameTakeLink();
  // Bar controls: each reads the owner's reading and sends one admitted request. Nothing here keeps a value of its own.
  const reading = source.currentReading?.() ?? null;
  const barApply: BarApply = changes => source.actions ? source.actions.applyChanges(changes) : Promise.resolve({ok: false, error: 'The native editor is not attached.'});
  const timeScale = reading ? barParameter(reading, 'fluid.timeScale') : null;
  // The session is one object per parameter, reading the latest runner and automation state at each call, so a re-render never strands a drag.
  const liveDeps = useRef<{run: typeof link.run; apply: (value: number) => Promise<boolean>; automated: boolean}>({run: null, apply: async () => false, automated: false});
  liveDeps.current = {run: link.run, automated: timeScale?.automated ?? false,
    apply: value => timeScale ? barApply([{kind: 'parameter', target: timeScale.target, value}]).then(reply => reply.ok, () => false) : Promise.resolve(false)};
  // Effective values come from engine telemetry and arrive only when the owner is read. While a lane runs or a take records, read at about 4 Hz,
  // never while the page is hidden and never over a pending edit, so base and effective stay separately current.
  const pollLatest = useRef(source); pollLatest.current = source;
  const polling = !!reading && !reading.standing.pending && (reading.scene.automation.some(lane => lane.enabled) || link.state?.propertyRecording === true);
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      const now = pollLatest.current;
      if (document.hidden || !now.actions || !now.isPresented()) return;
      void now.actions.readNow().catch(() => {});
    }, EFFECTIVE_POLL_MS);
    return () => clearInterval(id);
  }, [polling]);
  const timeScaleTarget = timeScale?.target ?? null;
  const timeScaleSession = useMemo(() => timeScaleTarget ? createLiveSession(timeScaleTarget, () => liveDeps.current) : null, [timeScaleTarget]);
  const [takeMode, setTakeMode] = useState<StageTakeMode>('replace'), [takeBusy, setTakeBusy] = useState(false), [takeFault, setTakeFault] = useState<string | null>(null);
  // Arm is shell presentation only: it decides what Play does. It is never a document value and survives Scene changes like a transport toggle.
  const [armed, setArmed] = useState(false);
  useEffect(() => {if (link.state?.takeMode) setTakeMode(link.state.takeMode)}, [link.state?.takeMode]);
  useEffect(() => {setFault(null); setSaveNoticeText(null); draftRef.current = null; setDraft(null)}, [identity]);
  // Space reaches the transport only through this ref, so it is retired with the content.
  const playRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const play = playRef.current;
      // Ctrl or Command S saves the open Expression, unless a field has focus (the shell's other chords skip fields too).
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && !event.repeat && event.key.toLowerCase() === 's' && saveRef.current
        && !(active instanceof HTMLElement && active.closest('input,textarea,select,[contenteditable="true"]'))) {
        event.preventDefault(); saveRef.current(); return;
      }
      if (!play || !spaceTogglesPlayback({key: event.key, repeat: event.repeat, altKey: event.altKey, ctrlKey: event.ctrlKey,
        metaKey: event.metaKey, shiftKey: event.shiftKey, focusIsBody: !active || active === document.body || active === document.documentElement})) return;
      event.preventDefault(); play();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const content = source.content, scenes = content?.scenes, playback = content?.playback;
  if (!content || !scenes || !playback) {playRef.current = null; saveRef.current = null; return null}
  const current = scenes.scenes.find(row => row.scene_ref === content.basis.scene_ref);
  const ready = !!source.actions && !content.standing.pending && !busy;
  const model = sceneTransportModel({
    ready, focused: sceneFocused(content.native_selection, content.basis.scene_ref),
    scene: {scene_ref: content.basis.scene_ref, available: !!current?.material.available,
      reason: current ? current.material.reason : 'This Scene is not in the native inventory.', duration: current?.working?.duration ?? null},
    rows: scenes.scenes.map(row => ({scene_ref: row.scene_ref, available: row.material.available})),
    playback, savedAvailable: scenes.timing.saved.available, loop: scenes.loop,
  });

  // One request per gesture. A reply is adopted only while its captured presentation is still current.
  const run = async (request: (actions: Actions) => Promise<NativeEditorReply>,
    accept: (captured: NativeCompositionViewSource, reply: NativeEditorReply) => boolean) => {
    if (!source.isPresented() || !source.actions) return;
    const captured = source, actions = source.actions, epoch = lifetime.current.epoch;
    const live = () => lifetime.current.mounted && epoch === lifetime.current.epoch;
    draftRef.current = null; setDraft(null);
    setBusy(true); setFault(null); setSaveNoticeText(null);
    try {
      const reply = await request(actions);
      if (live() && accept(captured, reply)) setFault(reply.ok ? null : reply.error);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      if (live() && accept(captured, {ok: false, error})) setFault(error);
    } finally {if (live()) setBusy(false)}
  };
  const settle = (action: NativeSceneAction) => run(actions => actions.scene(action),
    (captured, reply) => currentNativeSceneReply(captured, latest.current, reply, action));
  const toggleLoop = () => {if (!model.loop.reason) void run(actions => actions.setSceneLoop(!model.loop.on),
    (captured, reply) => currentCompositionReply(captured, latest.current, reply))};
  // Save is the owner's save request on the captured basis. "Saved" is shown only from the owner's reply reading.
  const saveModel = saveState({attached: !!source.actions, busy, standing: content.standing});
  const saveOpen = () => void run(actions => actions.history('save'),
    (captured, reply) => {const adopted = currentCompositionReply(captured, latest.current, reply); if (adopted && reply.ok) setSaveNoticeText(saveNotice(reply)); return adopted});
  saveRef.current = saveModel.disabled ? null : saveOpen;

  const duration = model.scrub.duration;
  const shown = duration === null ? playback.scene_elapsed_seconds : clampSeek(draft ?? playback.scene_elapsed_seconds, duration);
  // One released gesture is one seek. An unmoved press sends nothing.
  const commit = () => {
    const value = draftRef.current; draftRef.current = null; setDraft(null);
    if (value === null || duration === null || model.scrub.block) return;
    const request = scrubRequest(value, playback.scene_elapsed_seconds, content.basis.scene_ref, duration);
    if (request) void settle(request);
  };
  // Property take: start is refused for this Scene, stop is allowed from anywhere the frame stands. One request per gesture.
  const recording = link.state?.propertyRecording === true;
  const chosenCount = source.currentReading?.()?.chosenControls.entries.length ?? null;
  const toggleTake = () => {
    const run: FrameStageRun | null = link.run;
    if (!run || takeBusy || !lifetime.current.mounted) return;
    const command = recording ? takeStop : takeStart(takeMode);
    setTakeBusy(true); setTakeFault(null);
    let answer: ReturnType<FrameStageRun>;
    try {answer = run(command)} catch (cause) {setTakeBusy(false); setTakeFault(cause instanceof Error ? cause.message : String(cause)); return}
    void answer.then(result => {if (!result.ok) setTakeFault(result.error)}, cause => setTakeFault(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => {if (lifetime.current.mounted) setTakeBusy(false)});
  };
  // Play and Stop route through the arm state. Armed Play starts a take (the frame plays the Scene while it records); Stop finishes it.
  const startReason = frameTakeReason({link, busy: takeBusy || !ready, sceneRef: content.basis.scene_ref, want: 'start', chosen: chosenCount});
  const playRoute = barPlayRoute({armed, recording, startReason});
  const pressPlay = () => {
    if (playRoute.route === 'take-start') {setTakeFault(null); toggleTake(); return}
    if (armed && playRoute.blockedReason) setTakeFault(`Playing without a take: ${playRoute.blockedReason}`);
    void settle({action: model.play.action});
  };
  const pressStop = () => {
    if (recording) {toggleTake(); return}
    if (model.stop.request) void settle(model.stop.request);
  };
  playRef.current = model.play.disabled || recording ? null : pressPlay;
  const resume = barResume(link.state);
  const resumeAutomation = () => {
    const run: FrameStageRun | null = link.run;
    if (!run || takeBusy) return;
    setTakeFault(null);
    void run(STAGE_AUTOMATION_RESUME).then(result => {if (!result.ok && lifetime.current.mounted) setTakeFault(result.error)}, cause => {if (lifetime.current.mounted) setTakeFault(cause instanceof Error ? cause.message : String(cause))});
  };
  const neighbour = (ref: string | null) => {if (ref) void settle({action: 'focus', scene_ref: ref})};
  return <section className="native-transport" aria-label="Expressions transport">
    <div className="native-transport-row">
      <div className="native-transport-group">
        <button type="button" className="native-transport-play" aria-label={model.play.label} aria-pressed={playback.scene_playing}
          title={recording ? 'A take is recording. Press Stop to finish it.' : armed ? `${model.play.reason ?? model.play.label}: armed, so Play starts a take` : model.play.reason ?? model.play.label}
          disabled={model.play.disabled || recording} onClick={pressPlay}>
          {playback.scene_playing ? 'Ⅱ' : <Icon name="play" size={13} />}</button>
        <button type="button" className="native-transport-stop" aria-label="Stop Scene" title={model.stop.reason ?? 'Stop: rewind the working Scene to its start and pause'}
          disabled={recording ? takeBusy : model.stop.disabled} onClick={pressStop}><Icon name="stop" size={12} /></button>
      </div>
      {timeScale && timeScaleSession && <BarValue parameter={timeScale} session={timeScaleSession} disabled={!ready} reason={ready ? null : 'The native editor is busy or not attached.'} />}
      <span className="native-transport-take" role="group" aria-label="Automation recording">
        <button type="button" className="native-transport-arm" aria-label="Arm automation recording" aria-pressed={armed}
          title={armed ? 'Armed: Play records a take of the chosen properties; Stop keeps it. Click to disarm.' : 'Arm automation recording: then Play records a take of the chosen properties.'}
          onClick={() => setArmed(value => !value)}>A</button>
        <button type="button" className="native-transport-record" aria-label={recording ? 'Stop property take' : 'Property take'} aria-pressed={recording}
          disabled={!recording || takeBusy} title={recording ? 'Stop the property take and keep its keyframes' : 'A take records while armed Play runs. Arm automation, then press Play.'} onClick={toggleTake}>
          <Icon name="record" size={13} /></button>
        {resume.visible && <button type="button" className="native-transport-resume" aria-label="Re-enable automation" disabled={!link.run}
          title={`Re-enable automation: ${resume.count} parameter${resume.count === 1 ? ' is' : 's are'} held at a manual value`} onClick={resumeAutomation}>↩</button>}
      </span>
      <BarTools state={link.state} run={link.run} />
      <PinModeToggle />
      <BarPointerGroup reading={reading} state={link.state} apply={barApply} disabled={!ready} />
      <BarEngineLight state={link.state} playback={playback} />
      <div className="native-transport-overflow" data-open={moreOpen}>
        <button type="button" className="native-transport-more" aria-label="More transport controls" aria-haspopup="true" aria-expanded={moreOpen}
          title="Scenes, save, position and guide" onClick={() => setMoreOpen(open => !open)}>…</button>
        <div className="native-transport-more-panel" role="group" aria-label="More transport controls">
          <select aria-label="Take mode" className="native-transport-take-mode" value={takeMode} disabled={recording || takeBusy}
          title={recording ? 'Finish the take to change its mode' : TAKE_MODE_LABELS[takeMode]} onChange={event => setTakeMode(event.target.value as StageTakeMode)}>
          {STAGE_TAKE_MODES.map(mode => <option key={mode} value={mode}>{TAKE_MODE_LABELS[mode]}</option>)}
        </select>
      <div className="native-transport-group native-transport-scene" role="group" aria-label="Scene selection">
        <button type="button" aria-label="Previous Scene" title={model.previous ? 'Focus the previous Scene' : 'No earlier Scene has material'}
          disabled={!ready || !model.previous} onClick={() => neighbour(model.previous)}>‹</button>
        <output className="native-transport-name" aria-label="Native Scene" title="The presented Scene">{current?.title ?? content.scene.name}</output>
        <button type="button" aria-label="Next Scene" title={model.next ? 'Focus the next Scene' : 'No later Scene has material'}
          disabled={!ready || !model.next} onClick={() => neighbour(model.next)}>›</button>
      </div>
      <button type="button" className="native-transport-saved" aria-pressed={model.saved.pressed} disabled={model.saved.disabled}
        title={model.saved.reason ?? (model.saved.pressed ? 'Stop the saved Scene sequence' : 'Play the saved Scene sequence')}
        onClick={() => void settle({action: model.saved.action})}>Saved scenes</button>
      <button type="button" className="native-transport-loop" aria-label="Loop saved sequence" aria-pressed={model.loop.on} disabled={!!model.loop.reason}
        title={model.loop.reason ?? 'Loop the saved Scene sequence back to its first Scene at the end'} onClick={toggleLoop}><Icon name="loop" size={13} /></button>
      <button type="button" className="native-transport-save" aria-label="Save Expression" disabled={saveModel.disabled}
        title={saveModel.reason ?? 'Save: commit the working edit to the native Expression (Ctrl or ⌘ S)'} onClick={saveOpen}>Save</button>
      <input type="range" className="native-transport-scrub" aria-label="Scene position"
        aria-valuetext={duration === null ? 'No working duration' : `${shown.toFixed(2)} of ${duration.toFixed(2)} seconds of Scene time`}
        min={0} max={duration ?? 0} step={0.01} value={shown} disabled={model.scrub.block !== null}
        title={model.scrub.block ?? 'Drag, or use arrow keys (Shift for 1 s, Home and End for the ends). Release seeks the working Scene and pauses it.'}
        onChange={event => {const next = clampSeek(Number(event.target.value), duration ?? 0); draftRef.current = next; setDraft(next)}}
        onPointerUp={commit} onBlur={commit}
        onKeyDown={event => {if (duration === null) return; const next = scrubStep(draftRef.current ?? shown, duration, event.key, event.shiftKey); if (next === null) return; event.preventDefault(); draftRef.current = next; setDraft(next)}}
        onKeyUp={() => {if (draftRef.current !== null) commit()}} />
      <span className="native-transport-time" title="Scene time: position within the working Scene"><small>Scene time · working</small>
        <output aria-label="Scene time">{shown.toFixed(2)} / {duration === null ? '—' : duration.toFixed(2)} s</output></span>
      <span className="native-transport-time" title="Expression time: position across the whole sequence"><small>Expression time · sequence</small>
        <output aria-label="Expression time">{playback.expression_time_seconds.toFixed(2)} s</output></span>
      <button type="button" className="native-transport-guide" aria-label="Expressions guide" aria-haspopup="dialog" aria-expanded={guideOpen}
        title="Quick guide, About and the shortcuts this shell binds" onClick={() => setGuideOpen(open => !open)}>Guide</button>
        </div>
      </div>
    </div>
    {reading && <div className="native-transport-pins"><BarStrip reading={reading} apply={barApply} run={link.run} disabled={!ready} /></div>}
    {fault && <p role="alert" className="native-transport-fault">{fault}</p>}
    {takeFault && <p role="alert" className="native-transport-fault">{takeFault}</p>}
    {saveNoticeText && <output className="native-transport-notice" role="status">{saveNoticeText}</output>}
    {guideOpen && <NativeExpressionGuide onClose={() => setGuideOpen(false)} />}
  </section>;
}
