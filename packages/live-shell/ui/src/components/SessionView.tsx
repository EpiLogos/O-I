import {useEffect, useRef, useState, type CSSProperties} from 'react'
import type { SetSummary } from '../shell/useSet'
import type { SetDocument } from '../shell/document'
import { TrackRouting, MixerStrip } from './MixerStrip'
import {createNativeCompositionPresentationGuard, nativeSourceLanes, selectNativeSource, type CompositionViewSource, type NativeCompositionViewSource} from '../shell/compositionViews'
import type {NativeSceneAction} from '../shell/nativeContent'
import {NativeSceneTransport} from './NativeSceneTransport'
import {playingState, sceneDuration, stopRequest} from './nativeScenePlayback'
import {sceneStanding} from './nativeSceneList'
import {WorldTimelinePresentation} from '../projections/worldTimelinePresentation'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {LiveSessionEmpty} from '../shell/live/LiveEmptyStates'
import './NativeCompositionViews.css'
export type SetSelection = { track: number; scene: number | null; clip?: number }
export function SessionView({ set, document, selection, select, colors, setColor, native, compactTransport, world }: {
  set: SetSummary | null; document: SetDocument | null; selection: SetSelection; select: (value: SetSelection) => void
  colors: string[]; setColor: (track: number, value: string) => void
  native?: NativeCompositionViewSource
  /** The header transport bar is present: the in-view Scene transport keeps only what the bar lacks. */
  compactTransport?: boolean
  /** The World cut (seam 5): the Timeline projection presenting World
   * material — day, run and conversation tracks over the kernel's temporal
   * read. Additive on the L1 pattern; the native cut keeps absolute
   * precedence and the audio props are untouched. */
  world?: WorldTimelineView
}) {
  const source: CompositionViewSource = native ?? {owner: 'live-set', set, document}
  if (source.owner === 'expressions') return <NativeSessionContent source={source} compactTransport={compactTransport}/>
  if (world) return <WorldTimelinePresentation view={world} presentation="session" />
  if (!set) return <LiveSessionEmpty />
  const indexed = set.tracks.map((track, index) => ({ track, index }))
  const master = indexed.find(({ track }) => track.kind === 'master')
  const returns = indexed.filter(({ track }) => track.kind === 'return')
  const trackColumn = ({ track, index }: typeof indexed[number]) => <section className={'session-track' + (selection.track === index ? ' is-selected' : '')} key={index} style={{ '--track-color': colors[index] } as CSSProperties}>
    <div className="track-header"><button className="track-name" onClick={() => select({ track: index, scene: null })} title={`${track.name} · ${track.kind}`}>{track.name}</button>
      <input type="color" aria-label={`Color for ${track.name}`} title="Track display color · saved on this device" value={colors[index]} onChange={e => setColor(index, e.target.value)} /></div>
    <div className="track-slots">{Array.from({ length: set.scene_count }, (_, scene) => {
      const name = document?.tracks[index].sessionSlots[String(scene)]
      return <button key={scene} className={'clip-slot' + (name ? ' occupied-slot' : '') + (selection.track === index && selection.scene === scene ? ' selected-slot' : '')} aria-label={`${track.name}, scene ${scene + 1}${name ? `, ${name}` : ''}`} aria-pressed={selection.track === index && selection.scene === scene} title={document ? name ?? 'Empty clip slot' : 'Clip contents await the document owner'} onClick={() => select({ track: index, scene })}><span className="slot-glyph">{name ? '▷' : '■'}</span><span>{name}</span></button>
    })}</div><div className="track-stop-row"><button className="track-stop" disabled title="Native clip transport unavailable">■</button><span className="track-stop-color" /></div>
    <TrackRouting track={track} /><MixerStrip number={track.kind === 'return' ? track.name.split('-')[0] : String(index + 1)} onSelect={() => select({ track: index, scene: null })} />
  </section>
  return <div className="session-view" onScrollCapture={event => {
    const source = event.target as HTMLElement
    if (!source.classList.contains('track-slots')) return
    const top = source.scrollTop
    for (const column of event.currentTarget.querySelectorAll<HTMLElement>('.track-slots')) {
      if (column !== source && Math.abs(column.scrollTop - top) > 1) column.scrollTop = top
    }
  }}><div className="session-work-tracks"><div className="session-tracks">{indexed.filter(({ track }) => track.kind === 'audio' || track.kind === 'midi').map(trackColumn)}</div></div>
    <div className="session-return-tracks">{returns.map(trackColumn)}</div>
    <section className="session-main" style={{ '--track-color': master ? colors[master.index] : '#7ec3e6' } as CSSProperties}><button className="track-header" onClick={() => master && select({ track: master.index, scene: null })}>Main</button><div className="track-slots">{Array.from({ length: set.scene_count }, (_, scene) => <button key={scene} className={'scene-label' + (selection.scene === scene ? ' selected-scene' : '')} onClick={() => select({ ...selection, scene })} title="Select scene · launch requires native transport"><span>▷</span>{scene + 1}</button>)}</div>
      <div className="track-stop-row"><button disabled title="Stop all requires native transport">■</button><button disabled title="Launch scene requires native transport">▷</button></div>
      <TrackRouting track={master?.track ?? { kind: 'master', name: 'Main', devices: [] }} /><MixerStrip number="Main" master onSelect={() => master && select({ track: master.index, scene: null })} />
    </section>
  </div>
}

function NativeSessionContent({source, compactTransport}: {source: NativeCompositionViewSource; compactTransport?: boolean}) {
  const [fault, setFault] = useState<string | null>(null)
  const latest = useRef(source); latest.current = source
  const presentation = useRef(createNativeCompositionPresentationGuard()).current
  useEffect(() => presentation.mount(), [presentation])
  const content = source.content
  useEffect(() => {setFault(null)}, [content?.basis.expression_ref, content?.basis.scene_ref])
  if (!content) return <div className="view-empty">The native composition reading is unavailable.</div>
  let lanes: ReturnType<typeof nativeSourceLanes>
  try {lanes = nativeSourceLanes(content)} catch (cause) {return <div className="view-empty" role="alert">{cause instanceof Error ? cause.message : String(cause)}</div>}
  const ready = !!source.actions && !content.standing.pending
  const settle = async (effect: () => ReturnType<typeof selectNativeSource>, reveal?: 'clip' | 'device', configuration?: 'device') => {
    const captured = source
    const current = presentation.capture(captured)
    try {
      const result = await effect()
      if (!current(latest.current, result)) return
      setFault(result.ok ? null : result.error)
      if (result.ok && reveal) captured.revealDetail(reveal, configuration, result.reading.basis)
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      if (current(latest.current, {ok: false, error})) setFault(error)
    }
  }
  const scenes=content.scenes
  const sceneAction=async(action:NativeSceneAction,reveal?:'clip'|'device',family?:'scene')=>{
    const captured=source,valid=presentation.captureScene(captured,action)
    // The guard retains the same mount; Scene acknowledgement may deliberately
    // change the exact Scene, unlike source edits.
    if(!source.isPresented()||!source.actions)return
    try{const reply=await source.actions.scene(action);if(!valid(latest.current,reply))return
      setFault(reply.ok?null:reply.error);if(reply.ok&&reveal)captured.revealDetail(reveal,family,reply.reading.basis)
    }catch(cause){const error=cause instanceof Error?cause.message:String(cause);if(valid(latest.current,{ok:false,error}))setFault(error)}
  }
  if(!scenes)return <div className="view-empty">Native Scene membership is unavailable.</div>
  const objectRefs=[...new Set(scenes.scenes.flatMap(row=>row.member_refs))]
  // Playing state comes from the owner's playback reading; Stop is one seek to 0 (see nativeScenePlayback).
  const playback=content.playback, playing=playback?playingState(playback):{playing:false,sceneRef:null}
  const presented=scenes.scenes.find(row=>row.scene_ref===content.basis.scene_ref)
  const stop=playback&&presented?stopRequest(playback,presented.scene_ref,sceneDuration(presented.working?.duration)):null
  const presentedStanding=presented?sceneStanding(presented):null
  return <div className="session-view native-composition" onScrollCapture={event=>{const column=event.target as HTMLElement;if(!column.classList.contains('track-slots'))return;for(const other of event.currentTarget.querySelectorAll<HTMLElement>('.track-slots'))if(other!==column&&Math.abs(other.scrollTop-column.scrollTop)>1)other.scrollTop=column.scrollTop}}><NativeSceneTransport source={source} compact={compactTransport}/>
    {fault&&<div className="native-composition-caption" role="alert">{fault}</div>}
    <div className="native-session-columns"><div className="session-work-tracks"><div className="session-tracks">
      {objectRefs.map(ref=>{
        const currentTrack=content.tracks.find(track=>track.kind!=='field'&&track.scope.entity_ref===ref)
        return <section className={`session-track${currentTrack?.selected?' is-selected':''}`} key={ref} data-native-object={ref}>
          <div className="track-header"><button className="track-name" disabled={!ready||!currentTrack||currentTrack.kind==='field'||!currentTrack.capabilities.select} onClick={()=>currentTrack&&void settle(()=>source.actions!.selectTrack(currentTrack.id),'device')}>{scenes.object_titles[ref]}</button></div>
          <div className="track-slots">{scenes.scenes.map(row=>{
            const member=row.members.find(member=>member.entity_ref===ref),loaded=member?.state==='loaded',active=row.scene_ref===content.basis.scene_ref&&currentTrack?.selected
            const lane=loaded&&row.scene_ref===content.basis.scene_ref?lanes.find(lane=>lane.source.scope.entity_ref===ref):undefined
            return <button key={row.scene_ref} className={`clip-slot${member?' occupied-slot':''}${active?' selected-slot':''}`} aria-pressed={!!active} disabled={!ready||!loaded||!row.material.available}
              aria-label={`${scenes.object_titles[ref]}, ${row.title}${member?`, ${member.state}`:', absent'}`} title={member?loaded?'Select this Scene occurrence':`${member.state} · retain native membership`:'Object absent from this Scene'}
              onClick={()=>void sceneAction({action:'focus-object',scene_ref:row.scene_ref,entity_ref:ref},lane||row.scene_ref!==content.basis.scene_ref?'clip':'device')}>
              <span className="slot-glyph">{loaded?'◇':member?'·':''}</span><span>{member?scenes.object_titles[ref]:''}{lane&&<small>{lane.states.length} states</small>}</span></button>
          })}</div>
          <div className="native-source-controls"><button disabled={!ready||!currentTrack||currentTrack.kind==='field'||!currentTrack.capabilities.select} onClick={()=>currentTrack&&void settle(()=>source.actions!.selectTrack(currentTrack.id),'device')}>Devices</button></div>
        </section>
      })}
    </div></div><section className="session-main native-scene-master">
      <div className="track-header"><span>Scenes</span><span className="native-play-state" role="status"><span aria-hidden="true" className={`native-play-dot${playing.playing?' is-playing':''}`}/>{playing.playing?'Playing':'Stopped'}</span>{presentedStanding&&presented&&<small className="native-standing" data-tone={presentedStanding.tone} title={presentedStanding.title}>{presentedStanding.label}</small>}</div><div className="track-slots">{scenes.scenes.map(row=><div key={row.scene_ref} className={`scene-label${row.scene_ref===content.basis.scene_ref?' selected-scene':''}${playing.sceneRef===row.scene_ref?' is-playing':''}`}>
        <button aria-label={`Play whole Scene: ${row.title}`} title={row.material.reason??'Play this whole Scene'} disabled={!ready||!row.material.available} onClick={()=>void sceneAction({action:'play-scene',scene_ref:row.scene_ref})}>▷</button>
        <button title={`${row.title} · ${sceneStanding(row).label} · Scene clip details`} disabled={!ready||!row.material.available} onClick={()=>void sceneAction({action:'focus',scene_ref:row.scene_ref},'clip','scene')}>{row.title}</button>
      </div>)}</div><div className="native-source-controls"><button aria-label="Stop Scene transport" title={stop?'Stop: pause and return the presented Scene to 0 s':'Nothing is playing or past 0 s'} disabled={!ready||!stop} onClick={()=>stop&&void sceneAction(stop)}>■ Stop</button><button disabled={!ready} onClick={()=>void settle(()=>source.actions!.selectField(),'device','device')}>Field</button></div>
    </section></div>
  </div>
}
