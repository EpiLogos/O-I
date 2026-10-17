// The Scene's controls on the Clip side (manual §3: "Clip view shows the thing itself, with everything you can do to it"; lock
// §9.1: a scene is a clip). They stood on the Expressions bar (components/NativeTransportBar.tsx, retired) because they have no
// slot in manual §10.5; each is ported unchanged with its owner call and sits as one row of the mockup's clip properties
// (world-shell-mockup.html .cprops: a header with the clip's name, then key and value rows — subject, expression, duration,
// transition, state, edition as the mockup lists them, each the owner's reading or "—" where it discloses none):
//   • Scene ‹ name ›        previous and next Scene: `scene focus`; the pressed Scene also becomes THE selection
//   • sequence · Saved scenes   play or stop the saved Scene sequence: `scene play-saved` / `stop-saved`
//   • time                  Expression time across the saved sequence: the owner's reading
//   • state · Save          the owner's standing, and Save (`save`, gated by saveState; Ctrl or ⌘ S is the same Save, mounted
//                           with Expressions' bindings, sceneKeepers.ts); the owner's notice and refusals show under it
//   • help · Guide          the quick guide, About and the shortcuts this shell binds
//   • Pinned controls       the pins strip (components/NativeBarStrip.tsx); Map, on the bar, pins into it
// Owns no clock, no playback state and no document value: each press is one owner request on the captured source.
import {useEffect, useRef, useState, type CSSProperties} from 'react'
import {useTimelineReading} from '../../../projections/timelinePaneHost'
import {useSelectedClip} from '../../../frame/detail/ClipBox'
import type {NativeCompositionViewSource} from '../../../shell/compositionViews'
import type {NativeSceneAction} from '../../../shell/nativeContent'
import {useFrameTakeLink} from '../../../native/frameTakes'
import {sceneFocused, sceneTransportModel} from '../../nativeScenePlayback'
import {saveState} from '../../nativeExpressionCommands'
import {NativeExpressionGuide} from '../../NativeExpressionGuide'
import {BarStrip} from '../../NativeBarStrip'
import type {BarApply} from '../../NativeBarControls'
import {focusScene, sendSave, sendScene} from './sceneCalls'
import {standingWord} from './sceneClip'
import {sayScene, useSceneBusy, useSceneLine} from './sceneState'
import '../../NativeTransportBar.css'
import './sceneControls.css'

const seconds = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `${Number(value.toFixed(2))} s` : '—'

export function SceneControls({source}: {source: NativeCompositionViewSource}) {
  const latest = useRef(source); latest.current = source
  const busy = useSceneBusy(), line = useSceneLine()
  const link = useFrameTakeLink()
  const timeline = useTimelineReading()
  // The clip's colour on its head, as the Clip view wears it (frame/detail/ClipView.tsx `--cph`): its track's, when the tracks give one.
  const colour = useSelectedClip().track?.color ?? null
  const [guideOpen, setGuideOpen] = useState(false)
  const identity = source.content?.basis.scene_ref
  // A new Scene starts with no answer from the last one (the retired bar cleared its fault and notice the same way).
  useEffect(() => { sayScene(null) }, [identity])
  const content = source.content, scenes = content?.scenes, playback = content?.playback
  if (!content || !scenes || !playback) return null
  const current = scenes.scenes.find(row => row.scene_ref === content.basis.scene_ref)
  const ready = !!source.actions && !content.standing.pending && !busy
  const model = sceneTransportModel({
    ready, focused: sceneFocused(content.native_selection, content.basis.scene_ref),
    scene: {scene_ref: content.basis.scene_ref, available: !!current?.material.available,
      reason: current ? current.material.reason : 'This Scene is not in the native inventory.', duration: current?.working?.duration ?? null},
    rows: scenes.scenes.map(row => ({scene_ref: row.scene_ref, available: row.material.available})),
    playback, savedAvailable: scenes.timing.saved.available, loop: scenes.loop,
  })
  const send = (action: NativeSceneAction) => sendScene(source, () => latest.current, action)
  const neighbour = (ref: string | null) => { if (ref) void focusScene(source, () => latest.current, ref, timeline) }
  // Save is the owner's save request on the captured basis. "Saved" is shown only from the owner's reply reading.
  const saveModel = saveState({attached: !!source.actions, busy, standing: content.standing})
  const reading = source.currentReading?.() ?? null
  const barApply: BarApply = changes => source.actions ? source.actions.applyChanges(changes) : Promise.resolve({ok: false, error: 'The native editor is not attached.'})
  return <aside className="scene-props" aria-label="Scene" data-scene-controls>
    <div className="scene-head cph" role="group" aria-label="Scene selection" style={colour ? {'--cph': colour, '--cph-ink': 'var(--bg-0)'} as CSSProperties : undefined}>
      <button type="button" aria-label="Previous Scene" title={model.previous ? 'Focus the previous Scene' : 'No earlier Scene has material'}
        disabled={!ready || !model.previous} onClick={() => neighbour(model.previous)}>‹</button>
      <output className="scene-name" aria-label="Native Scene" title="The presented Scene">{current?.title ?? content.scene.name}</output>
      <button type="button" aria-label="Next Scene" title={model.next ? 'Focus the next Scene' : 'No later Scene has material'}
        disabled={!ready || !model.next} onClick={() => neighbour(model.next)}>›</button>
    </div>
    {/* The clip's properties (the mockup's .kvs rows, world-shell-mockup.html:1678): each the owner's reading, "—" where it discloses none. */}
    <div className="kvs" title="The subject the Expression is made of: the native owner discloses none here"><span>subject</span><span>—</span></div>
    <div className="kvs" title="The Expression this Scene belongs to"><span>expression</span><span><output aria-label="Expression">{scenes.title || '—'}</output></span></div>
    <div className="kvs" title="The Scene's working duration"><span>duration</span><span><output aria-label="Scene duration">{seconds(current?.working?.duration)}</output></span></div>
    <div className="kvs" title="How long the Scene takes to arrive from the one before"><span>transition</span><span><output aria-label="Scene transition">{seconds(current?.working?.transition)}</output></span></div>
    <div className="kvs scene-state-row"><span>state</span><span>
      <output className="scene-standing" aria-label="Expression standing" data-dirty={content.standing.dirty || undefined}>{standingWord(content.standing)}</output>
      <button type="button" className="scene-save" aria-label="Save Expression" disabled={saveModel.disabled}
        title={saveModel.reason ?? 'Save: commit the working edit to the native Expression (Ctrl or ⌘ S)'}
        onClick={() => void sendSave(source, () => latest.current)}>Save</button></span></div>
    <div className="kvs" title="The published edition this Scene stands in: the native owner discloses none here"><span>edition</span><span>—</span></div>
    <div className="kvs"><span>sequence</span><span>
      <button type="button" className="scene-saved" aria-pressed={model.saved.pressed} disabled={model.saved.disabled}
        title={model.saved.reason ?? (model.saved.pressed ? 'Stop the saved Scene sequence' : 'Play the saved Scene sequence')}
        onClick={() => void send({action: model.saved.action})}>Saved scenes</button></span></div>
    <div className="kvs" title="Expression time: position across the whole sequence"><span>time</span>
      <span><output aria-label="Expression time">{playback.expression_time_seconds.toFixed(2)} s</output></span></div>
    <div className="kvs"><span>help</span><span>
      <button type="button" className="scene-guide" aria-label="Expressions guide" aria-haspopup="dialog" aria-expanded={guideOpen}
        title="Quick guide, About and the shortcuts this shell binds" onClick={() => setGuideOpen(open => !open)}>Guide</button></span></div>
    {line?.kind === 'fault' && <p role="alert" className="scene-fault">{line.text}</p>}
    {line?.kind === 'notice' && <output className="scene-notice" role="status">{line.text}</output>}
    {reading && <><div className="sec">Pinned controls</div>
      <div className="scene-pins"><BarStrip reading={reading} apply={barApply} run={link.run} disabled={!ready} /></div></>}
    {guideOpen && <NativeExpressionGuide onClose={() => setGuideOpen(false)} />}
  </aside>
}
