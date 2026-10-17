import {useCallback, useEffect, useRef, useState} from 'react'
import {sameEditorBasis,type NativeEditorBasis,type NativeEditorReply,type NativeEditorRequest} from '@epilogos/expressions-boundary/editor'
import {useWorkspace} from '../shell/workspace'
import {GlyphSequenceEditor, type RetainedGlyphInput} from './GlyphSequenceEditor'
import {NativeDeviceRack} from './NativeDeviceRack'
import {readNativeRacks} from '../../../../expressions-boundary/src/nativeRacks'
import {NativeRackEditor} from './NativeRackEditor'
import {NativeChosenControls} from './NativeChosenControls'
import {NativeSceneEditor} from './NativeSceneEditor'
import {NativeSceneTransport} from './NativeSceneTransport'
import {NativeInputRecovery} from './NativeInputRetention'
import {NativeTakes} from './NativeTakes'
import {SceneSequenceEditor} from './SceneSequenceEditor'
import {dispatchOpenDevice} from './nativeDrag'
import {createNativeContentActions, readNativeExpressionsContent} from '../shell/nativeContent'
import type {DetailMode} from './DeviceChainPanel'
import {openDetailSettings, toggleDetailSettings, type NativeCompositionViewSource, type NativeDetailConfigurationFamily} from '../shell/compositionViews'
import {SceneControls} from './expressions/clip/SceneControls'
import {SceneStrip} from './expressions/clip/SceneStrip'
import {ExpressionsStudio} from './expressions/studio/ExpressionsStudio'
import type {PlateSection} from '../frame/devices/InstrumentPlate'
import {Icon} from '../inhabitants/sdk/Icon'
import {PopOut} from '../inhabitants/sdk/marks'
import './NativeWorldDetail.css'

interface NativeDetailDestinationBasis {
  id: number;
  workspaceId: string;
  accessEpoch: number;
  expression_ref: string;
  scene_ref: string;
}
export type NativeDetailConfigurationIntent = NativeDetailDestinationBasis &
  ({mode:'clip';material:'glyph'|'scene'}|{mode:'device';family:NativeDetailConfigurationFamily});

/** Persistent presentation of the retained application's actual editor owner. `sceneControls`: the clip is an Expressions Scene, so the
 * Scene's own controls stand beside it (components/expressions/clip/SceneControls.tsx); only the Expressions clip entry asks for them. */
export function NativeWorldDetail({mode, expand, collapse, presentMode, presentNativeEditor, configurationIntent, sceneControls = false}: {mode: DetailMode; expand: () => void; collapse: () => void; presentMode:(mode:DetailMode)=>void; presentNativeEditor?:(editor:'source'|'layers'|'placement',basis:NativeEditorBasis)=>void; configurationIntent?: NativeDetailConfigurationIntent | null; sceneControls?: boolean}) {
  const workspace = useWorkspace()
  const currentWorkspace=useRef(workspace);currentWorkspace.current=workspace
  const publishedReading=useRef(workspace.editorReading)
  useEffect(()=>{publishedReading.current=workspace.editorReading;return workspace.editor?.subscribe(next=>{publishedReading.current=next})},[workspace.editor])
  const lifetime=useRef(0);useEffect(()=>{lifetime.current++;return()=>{lifetime.current++}},[])
  const residence = useRef<HTMLElement>(null)
  const drafts = useRef(new Map<string, RetainedGlyphInput>())
  const requestResidence=useRef({mode,workspaceId:workspace.workspaceId,accessEpoch:workspace.accessEpoch,editor:workspace.editor,expression:workspace.editorReading?.basis.expression_ref});
  requestResidence.current={mode,workspaceId:workspace.workspaceId,accessEpoch:workspace.accessEpoch,editor:workspace.editor,expression:workspace.editorReading?.basis.expression_ref};
  const [fault, setFault] = useState<string | null>(null)
  const [configure, setConfigure] = useState(false), [configuration, setConfiguration] = useState<NativeDetailConfigurationFamily>('device')
  const [fullscreen, setFullscreen] = useState(false)
  const acknowledgedFullscreen=useRef(false)
  const [expanded,setExpanded]=useState(false)
  const [clipSurface,setClipSurface] = useState<'scene' | 'glyph' | 'takes'>('glyph')
  const deepReturn = useRef<{mode:DetailMode;configure: boolean; configuration: NativeDetailConfigurationFamily; focus: HTMLElement | null; scroll: number} | null>(null)
  useEffect(()=>{deepReturn.current=null;setExpanded(false)},[workspace.workspaceId,workspace.accessEpoch])
  const restoreDepth = () => {
    const previous = deepReturn.current
    if (!previous) return
    const captured={...requestResidence.current,scene:currentWorkspace.current.editorReading?.basis.scene_ref,epoch:lifetime.current}
    deepReturn.current = null
    setExpanded(false);collapse()
    presentMode(previous.mode)
    setConfigure(previous.configure); setConfiguration(previous.configuration)
    requestAnimationFrame(() => {
      const now=requestResidence.current
      if(lifetime.current!==captured.epoch||now.workspaceId!==captured.workspaceId||now.accessEpoch!==captured.accessEpoch
        ||now.editor!==captured.editor||now.expression!==captured.expression||currentWorkspace.current.editorReading?.basis.scene_ref!==captured.scene
        ||!currentWorkspace.current.nativeAccessCurrent(captured.accessEpoch)||!residence.current?.getClientRects().length)return
      const view = residence.current?.querySelector('.native-device-view')
      if (view) view.scrollLeft = previous.scroll
      if (previous.focus?.isConnected) previous.focus.focus({preventScroll: true})
    })
  }
  useEffect(() => {
    const changed = () => {const active = document.fullscreenElement === residence.current;const wasOwn=acknowledgedFullscreen.current;acknowledgedFullscreen.current=active;setFullscreen(active);if(wasOwn&&!active)restoreDepth()}
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])
  // `quiet`: the caller says the owner's refusal in its own place (the Scene's controls do), so this header does not say it twice.
  const request = useCallback(async (operation: NativeEditorRequest, quiet = false): Promise<NativeEditorReply> => {
    const epoch=lifetime.current;
    const captured={...requestResidence.current};
    const restoredMode=deepReturn.current?.mode??captured.mode;let depthExit=false;
    const current=()=>{const now=requestResidence.current;return (now.mode===captured.mode||depthExit&&now.mode===restoredMode)&&now.workspaceId===captured.workspaceId&&now.accessEpoch===captured.accessEpoch&&now.editor===captured.editor&&now.expression===captured.expression&&workspace.nativeAccessCurrent(captured.accessEpoch)};
    // Source/layers/placement still belong to the retained app's Studio bridge.
    // Leave fullscreen before routing there so its actual owner surface is visible.
    if (operation.operation === 'open' && document.fullscreenElement === residence.current) {
      depthExit=true;
      try {await document.exitFullscreen()} catch (cause) {
        const error = cause instanceof Error ? cause.message : String(cause)
        if(current())setFault(error); return {ok: false, error}
      }
    }
    if(!current()||epoch!==lifetime.current||!residence.current?.getClientRects().length)return {ok:false,error:'The native editor residence changed before dispatch; current work was retained'}
    const result = workspace.editor ? await workspace.editor.request(operation) : {ok: false as const, error: 'The retained native editor is unavailable'}
    const readingNow=publishedReading.current;
    if(!quiet&&current()&&epoch===lifetime.current&&residence.current?.getClientRects().length
      &&(operation.operation==='read'||readingNow&&sameEditorBasis(result.ok?result.reading.basis:operation.basis,readingNow.basis)))setFault(result.ok ? null : result.error)
    if(operation.operation==='open'&&result.ok&&current()&&epoch===lifetime.current&&residence.current?.getClientRects().length
      &&readingNow&&sameEditorBasis(result.reading.basis,readingNow.basis))presentNativeEditor?.(operation.editor,result.reading.basis)
    return result
  }, [workspace.editor,presentNativeEditor])
  const reading = workspace.editorReading
  const scenePresentation=useRef({mode,configure,configuration,clipSurface,workspaceId:workspace.workspaceId,accessEpoch:workspace.accessEpoch});
  scenePresentation.current={mode,configure,configuration,clipSurface,workspaceId:workspace.workspaceId,accessEpoch:workspace.accessEpoch};
  let sceneContent:ReturnType<typeof readNativeExpressionsContent>|null=null,sceneProjectionFault:string|null=null;
  try{if(reading)sceneContent=readNativeExpressionsContent(reading)}catch(cause){sceneProjectionFault=cause instanceof Error?cause.message:String(cause)}
  const sceneAccessEpoch=workspace.accessEpoch,sceneWorkspaceId=workspace.workspaceId;
  const glyphPresented=()=>{const current=scenePresentation.current;return current.mode==='clip'&&current.clipSurface==='glyph'
    &&current.workspaceId===sceneWorkspaceId&&current.accessEpoch===sceneAccessEpoch&&workspace.nativeAccessCurrent(sceneAccessEpoch)
    &&!!residence.current?.getClientRects().length;};
  const scenePresented=()=>{const current=scenePresentation.current;return current.mode==='device'&&current.configure&&current.configuration==='scene'
    &&current.workspaceId===sceneWorkspaceId&&current.accessEpoch===sceneAccessEpoch&&workspace.nativeAccessCurrent(sceneAccessEpoch);};
  const devicePresented=()=>{const current=scenePresentation.current;return current.mode==='device'&&current.configure&&current.configuration==='device'
    &&current.workspaceId===sceneWorkspaceId&&current.accessEpoch===sceneAccessEpoch&&workspace.nativeAccessCurrent(sceneAccessEpoch)
    &&!!residence.current?.getClientRects().length;};
  const compactGlyphPresented=()=>{const current=scenePresentation.current;return current.mode==='device'
    &&current.workspaceId===sceneWorkspaceId&&current.accessEpoch===sceneAccessEpoch&&workspace.nativeAccessCurrent(sceneAccessEpoch)
    &&!!residence.current?.getClientRects().length;};
  const sceneSource={owner:'expressions' as const,content:sceneContent,actions:sceneContent?createNativeContentActions(sceneContent,{request:operation=>scenePresented()?request(operation):Promise.resolve({ok:false as const,error:'The Scene editor is no longer presented'})}):null,
    isPresented:scenePresented,revealDetail:()=>{}};
  // The Scene's controls on the clip side: the same owner, presented while this clip body is the one shown.
  const clipPresented=()=>{const current=scenePresentation.current;return current.mode==='clip'
    &&current.workspaceId===sceneWorkspaceId&&current.accessEpoch===sceneAccessEpoch&&workspace.nativeAccessCurrent(sceneAccessEpoch)
    &&!!residence.current?.getClientRects().length;};
  const clipSource:NativeCompositionViewSource={owner:'expressions',content:sceneContent,actions:sceneContent?createNativeContentActions(sceneContent,{request:operation=>clipPresented()?request(operation,true):Promise.resolve({ok:false as const,error:'The Scene controls are no longer presented'})}):null,
    isPresented:clipPresented,currentReading:()=>publishedReading.current,revealDetail:()=>{}};
  const showSceneControls=sceneControls&&mode==='clip';
  const selectEntity = (id: string) => {
    if (reading) void request({operation: 'select', basis: reading.basis, entity_id: id})
  }
  const chooseConfiguration = (next: NativeDetailConfigurationFamily) => {
    setConfiguration(next)
    requestAnimationFrame(() => residence.current?.querySelector(next === 'controls' ? '[data-section="controls"]' : next === 'rack' ? '[data-section="macros"]' : '[data-section="settings"]')?.scrollIntoView({block: 'nearest', inline: 'nearest'}))
  }
  const consumedConfiguration = useRef<number | null>(null)
  useEffect(() => {
    if (!configurationIntent || consumedConfiguration.current === configurationIntent.id) return
    if(configurationIntent.mode!==mode)return
    consumedConfiguration.current = configurationIntent.id
    if (workspace.mode === 'audio' || workspace.workspaceId !== configurationIntent.workspaceId
      || workspace.accessEpoch !== configurationIntent.accessEpoch || reading?.basis.expression_ref !== configurationIntent.expression_ref
      || reading.basis.scene_ref !== configurationIntent.scene_ref || !residence.current?.getClientRects().length) return
    if(configurationIntent.mode==='clip'){setClipSurface(configurationIntent.material);return}
    setConfigure(true);chooseConfiguration(configurationIntent.family)
  }, [configurationIntent, mode, workspace.mode, workspace.workspaceId, workspace.accessEpoch, reading?.basis.expression_ref, reading?.basis.scene_ref])
  const deep = async () => {
    if (!residence.current) return
    if (expanded || fullscreen) {
      if(fullscreen){try {await document.exitFullscreen()} catch (cause) {setFault(cause instanceof Error ? cause.message : String(cause))}}
      else restoreDepth()
      return
    }
    deepReturn.current = {mode,configure, configuration, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scroll: residence.current.querySelector('.native-device-view')?.scrollLeft ?? 0}
    // Deep edit is the Studio's door: the same plate at full height, its sections as they stand (the settings stay one press away).
    // Expand through the host layout. Browser fullscreen events can arrive
    // after a refused request and must not undo this ordinary editor placement.
    // The same mounted owner and input drafts stay throughout.
    expand();setExpanded(true)
  }
  const expandClip = () => {expand(); void deep()}
  const expandGlyphDevice=()=>{setClipSurface('glyph');presentMode('clip');if(!expanded&&!fullscreen)void deep()}
  const settingsFamily=(next:NativeDetailConfigurationFamily)=>{const chosen=openDetailSettings(next);setConfigure(chosen.open);chooseConfiguration(chosen.family)}
  // Configure: the Studio's settings — your rack, the chosen controls, the macros, then the family the settings edit (each as before).
  const settings:PlateSection[]=[
    {id:'rack',title:'Your rack',children:<div className="native-chain-strip studio-settings-rack"><NativeDeviceRack reading={reading} request={request} onOpen={dispatchOpenDevice}/></div>},
    {id:'controls',title:'Chosen controls',children:<div className="native-chain-controls"><NativeChosenControls reading={reading} request={request} configure={configure && configuration === 'controls'}/></div>},
    {id:'macros',title:'Macros',children:<div className="native-chain-rack"><NativeRackEditor reading={reading} request={request} configure={configure && configuration === 'rack'}/></div>},
    {id:'settings',title:'Settings',children:<div className="native-chain-configuration">
      <nav className="studio-settings-nav" aria-label="Native device settings"><button aria-pressed={configuration === 'controls'} onClick={() => settingsFamily('controls')}>Chosen controls</button><button aria-pressed={configuration === 'device'} onClick={() => settingsFamily('device')}>Devices</button><button aria-pressed={configuration === 'rack'} onClick={() => settingsFamily('rack')}>Macros</button><button aria-pressed={configuration === 'scene'} onClick={() => settingsFamily('scene')}>Scene</button></nav>
      <div className="native-settings-note" hidden={configuration !== 'controls'}>Choose properties in the browser. Reorder, bind or remove them in the chosen-control rack.</div>
      <div className="native-settings-editor native-settings-handoff" hidden={configuration !== 'device'}><p className="native-settings-note">Device settings open in the Browser pool beside the rack, so changing them never adds a widget to the rack.</p><button type="button" disabled={!reading || !devicePresented()} onClick={() => {const selected = (reading?.selection.entity_ids.length ?? 0) > 0; dispatchOpenDevice({scope: selected ? 'entity' : 'field', family: selected ? 'force' : 'physics'})}}>Open device settings</button></div>
      <div className="native-settings-editor" hidden={configuration !== 'scene'}><NativeSceneTransport source={sceneSource}/>{sceneProjectionFault&&<p role="alert">{sceneProjectionFault}</p>}</div>
      <div className="native-settings-note" hidden={configuration !== 'rack'}>Map parameters, set recall exclusions and capture variations in the macro rack.</div>
    </div>},
  ]
  // The person's own controls stand in the Studio too while they hold any: the chosen controls they picked and the macros of their racks
  // (and the macro rack keeps listening for the browser's Map to macro…).
  let racksHeld=false;try{racksHeld=!!reading&&readNativeRacks(reading.scene,reading.entityOccurrences).racks.length>0}catch{racksHeld=false}
  const own:PlateSection[]=[
    ...(reading?.chosenControls.entries.length?[{id:'chosen',title:'Your controls',children:<div className="native-chain-controls"><NativeChosenControls reading={reading} request={request} configure={false}/></div>}]:[]),
    ...(racksHeld?[{id:'macros',title:'Macros',children:<div className="native-chain-rack"><NativeRackEditor reading={reading} request={request} configure={false}/></div>}]:[]),
  ]
  const clipSurfaceChoice=(next:'scene'|'glyph'|'takes')=>setClipSurface(next)
  return <section ref={residence} className={`native-world-detail${configure ? ' is-configuring' : ''}${fullscreen ? ' is-fullscreen' : ''}`} data-detail-side={mode} aria-label={mode === 'clip' ? 'Native clip editor' : 'Native device chain'}>
    <div className="native-detail-body">
      <div className={`clipv native-detail-view native-clip-view${showSceneControls ? ' has-scene-controls' : ''}`} hidden={mode !== 'clip'}>{showSceneControls&&<SceneControls source={clipSource}/>}{showSceneControls&&<SceneStrip source={clipSource}/>}
        <div className="ccol native-clip-sequence" aria-label="Sequence">
          <h5 className="native-clip-head"><span>Sequence</span>
            <span className="native-clip-tools">
              <span className="native-clip-surface-choice" role="group" aria-label="Clip editor"><button type="button" aria-pressed={clipSurface==='scene'} onClick={()=>clipSurfaceChoice('scene')}>Scene</button><button type="button" aria-pressed={clipSurface==='glyph'} onClick={()=>clipSurfaceChoice('glyph')}>States</button><button type="button" aria-pressed={clipSurface==='takes'} onClick={()=>clipSurfaceChoice('takes')}>Takes</button></span>
              <select aria-label="Native editor selection" value={reading?.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : ''} disabled={!reading || reading.standing.pending} onChange={event => selectEntity(event.target.value)}>
                <option value="">{reading ? 'Choose an object' : 'Native owner loading'}</option>
                {reading?.scene.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
              </select>
              <button type="button" className="native-clip-mark" disabled={!reading} aria-label={expanded || fullscreen ? 'Return' : 'Deep edit'} title={expanded || fullscreen ? 'Return the editor to its place' : 'Deep edit: expand this editor; Return restores its previous placement'} onClick={() => void deep()}><PopOut size={10}/></button>
              <button type="button" className="native-clip-mark" disabled={!workspace.editor} title="Read the retained editor owner" aria-label="Refresh native editor" onClick={() => void request({operation: 'read'})}><Icon name="orbit" size={12}/></button>
            </span>
          </h5>
          {fault && mode==='clip' && <p className="native-clip-fault" role="alert">{fault}</p>}
          <div className="native-clip-surfaces"><div className="native-clip-surface" hidden={clipSurface!=='scene'}><NativeSceneEditor reading={reading} request={request}/></div><div className="native-clip-surface" hidden={clipSurface!=='glyph'}>{workspace.mode==='expressions'&&<SceneSequenceEditor reading={reading} request={request}/>}<GlyphSequenceEditor reading={reading} request={request} drafts={drafts.current} onExpand={expandClip} isPresented={glyphPresented}/></div><div className="native-clip-surface" hidden={clipSurface!=='takes'}><NativeTakes reading={reading} request={request}/></div></div>
        </div>
      </div>
      <div className="native-detail-view native-studio-view" hidden={mode !== 'device'}>
        <ExpressionsStudio reading={reading} request={request} selectEntity={selectEntity} drafts={drafts.current} onExpandGlyph={expandGlyphDevice} glyphPresented={compactGlyphPresented}
          configure={configure} onConfigure={() => {const next = toggleDetailSettings(configure, configuration); setConfigure(next.open); if (next.open) chooseConfiguration(next.family)}}
          settings={settings} own={own}
          deep={{open: expanded || fullscreen, available: !!reading, onPress: () => void deep()}}
          refresh={{available: !!workspace.editor, onPress: () => void request({operation: 'read'})}}
          fault={mode === 'device' ? fault : null}/>
      </div>
    </div>
    <NativeInputRecovery reading={reading} request={request} isPresented={()=>workspace.mode!=='audio'&&!!residence.current?.getClientRects().length}/>
  </section>
}
