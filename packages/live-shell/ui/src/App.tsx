import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type RefObject } from 'react'
import {useContinuity} from './continuity/workspace'
import { ArrangementView } from './components/ArrangementView'
import { BrowserPane } from './components/BrowserPane'
import { WorldBrowser } from './components/WorldBrowser'
import { OPEN_DEVICE_EVENT, PARAMETER_BROWSE_EVENT } from './components/nativeDrag'
import { NativeWorldDetail, type NativeDetailConfigurationIntent } from './components/NativeWorldDetail'
import {NativeInputRetentionProvider,nativeInputBinding} from './components/NativeInputRetention'
import { useWorkspace } from './shell/workspace'
import { DeviceChainPanel, type DetailMode } from './components/DeviceChainPanel'
import { RightDock } from './components/RightDock'
import { SessionView, type SetSelection } from './components/SessionView'
import { StatusBar } from './components/StatusBar'
import { TransportBar } from './components/TransportBar'
import {AgentShellProvider, useAgentShell} from './agent/AgentShellContext'
import {useAgentMetrics} from './agent/useAgentMetrics'
import {useHarnessBinding} from './agent/useHarnessBinding'
import {harnessAgentControl} from './agent/harnessAgentControl'
import {AgentShellTransport} from './agent/AgentShellTransport'
import {AgentShellBrowser} from './agent/AgentShellBrowser'
import {AgentContextDock} from './agent/AgentContextDock'
import {useAgencySessions, type AgentSessionTrack} from './agent/useAgencySessions'
import {trackKey} from './agent/agentRunModel'
import type {KernelTransportStatus} from '../../../../desktop/cradle/src/kernel/types'
import {AgentShellDeviceDetail} from './agent/AgentShellDeviceDetail'
import './agent/agentShell.css'
import { useSetSummary, useShellConfig } from './shell/useSet'
import { useSetDocument } from './shell/document'
import { getPanels, type PanelContext } from './shell/panels'
import { configureSettingsHost, openSettings, useSettingsHost } from './settings/host'
import {createNativeContentActions, readNativeExpressionsContent} from './shell/nativeContent'
import type {NativeCompositionViewSource} from './shell/compositionViews'
import {NATIVE_PRESENT_EXPRESSIONS} from './native/openStudio'
import {sameEditorBasis,type NativeEditorBasis,type NativeEditorController} from '@epilogos/expressions-boundary/editor'
import './NativeCompositionResidence.css'
const PALETTE = ['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9']
export function App() {
  const frameRef = useRef<HTMLDivElement>(null)
  return <AgentShellProvider frameRef={frameRef}><AgentShellFrameInner frameRef={frameRef} /></AgentShellProvider>
}

function AgentShellFrameInner({frameRef}: {frameRef: RefObject<HTMLDivElement>}) {
  const workspace = useWorkspace()
  const currentEditorReading=useRef(workspace.editorReading)
  // The qualified owner publishes its reply before React presents that reading.
  // Detail return must compare with that exact publisher, including the same
  // acknowledgement turn, rather than a previous render's selection basis.
  useEffect(()=>{currentEditorReading.current=workspace.editorReading;return workspace.editor?.subscribe(reading=>{currentEditorReading.current=reading})},[workspace.editor])
  const continuity = useContinuity()
  const currentContinuity=useRef(continuity);currentContinuity.current=continuity
  const restored = continuity.applicationView
  const [frameWorkspace, setFrameWorkspace] = useState(workspace.workspaceId)
  const [restoration, restorePath] = useState({workspaceId: workspace.workspaceId, path: restored?.alsPath})
  const config = useShellConfig()
  const rememberedPath = restoration.workspaceId === workspace.workspaceId ? restoration.path : restored?.alsPath
  const initialPath = rememberedPath === undefined ? config?.default_set : rememberedPath ?? undefined
  const state = useSetSummary(initialPath, workspace.workspaceId)
  const deep = useSetDocument(state.set)
  const [detailMode, changeDetailMode] = useState<DetailMode>(restored?.detailMode ?? 'clip')
  const [browserWidth, resizeBrowser] = useState<number | null>(restored?.browserWidth ?? null)
  const [detailHeight, resizeDetail] = useState<number | null>(restored?.detailHeight ?? null)
  const [nativeEditorReturn,setNativeEditorReturn]=useState<{workspaceId:string;accessEpoch:number;bindingId:string;expression_ref:string;scene_ref:string;centerPanel:string;detail:boolean;detailMode:DetailMode;editor:'source'|'layers'|'placement';owner:NativeEditorController|null;mode:'expressions'|'techne';focus:HTMLElement|null}|null>(null)
  useEffect(()=>setNativeEditorReturn(null),[workspace.workspaceId,workspace.accessEpoch])
  const detailExpansionReturn=useRef<{height:number|null;workspaceId:string;accessEpoch:number}|null>(null)
  useEffect(()=>{detailExpansionReturn.current=null},[workspace.workspaceId,workspace.accessEpoch])
  const [viewport, setViewport] = useState([window.innerWidth, window.innerHeight])
  useEffect(() => { const read = () => setViewport([window.innerWidth, window.innerHeight]); window.addEventListener('resize', read); return () => window.removeEventListener('resize', read) }, [])
  const [tab, setTab] = useState(restored?.tab ?? 'session')
  const [centerPanel, setCenterPanel] = useState((restored?.centerPanel === 'world.knowledge' ? 'native.workbench' : restored?.centerPanel) ?? 'world.expressions')
  const [knowledgeIntent, setKnowledgeIntent] = useState<{workspaceId: string; bindingId: string} | null>(null)
  useEffect(() => {
    const presentKnowledge = (event: Event) => {
      const input = (event as CustomEvent<{workspaceId?: string; bindingId?: string}>).detail
      if (input?.workspaceId !== workspace.workspaceId || !input.bindingId) return
      setKnowledgeIntent({workspaceId: input.workspaceId, bindingId: input.bindingId})
    }
    const returnCanvas = (event: Event) => {
      const input = (event as CustomEvent<{workspaceId?: string; bindingId?: string; complete?: (error?: string) => void}>).detail
      if (input?.workspaceId !== workspace.workspaceId || !input.bindingId
        || continuity.current.layout.surfaces[input.bindingId]?.view?.nativeKnowledge?.origin !== 'canvas') {
        input?.complete?.('The originating Canvas workspace is no longer current'); return
      }
      const basis = continuity.current.layout.surfaces[input.bindingId].view?.nativeKnowledge?.source_basis
      const retained = continuity.current.layout.surfaces[input.bindingId].view?.nativeKnowledge?.returnTo
      const reading = workspace.editorReading, current = reading?.basis
      const selected = reading?.entityOccurrences[reading.selection.entity_ids[0]] ?? null
      if (!basis || !current || current.expression_ref !== basis.expression_ref || current.scene_ref !== basis.scene_ref
        || current.revision !== basis.revision || basis.entity_ref !== undefined && selected !== basis.entity_ref
        || retained?.bindingId !== 'world.expressions') {
        input.complete?.('The Canvas native location changed while Knowledge was open; its current work is retained'); return
      }
      // Expressions remains mounted while its Graph is presented. Returning
      // reveals that exact owner and camera without reopening or replacing it.
      presentSettings(false); setCenterPanel('world.expressions')
      if (retained.mode === 'expressions' || retained.mode === 'techne') workspace.setMode(retained.mode)
      input.complete?.()
    }
    window.addEventListener('oi:candidate-knowledge-present', presentKnowledge)
    window.addEventListener('oi:candidate-canvas-return', returnCanvas)
    return () => {
      window.removeEventListener('oi:candidate-knowledge-present', presentKnowledge)
      window.removeEventListener('oi:candidate-canvas-return', returnCanvas)
    }
  }, [workspace.workspaceId, workspace.mode, workspace.setMode, workspace.editorReading, continuity.current.layout.surfaces])
  useEffect(() => {
    if (!knowledgeIntent) return
    if (knowledgeIntent.workspaceId !== workspace.workspaceId) {setKnowledgeIntent(null); return}
    if (continuity.current.layout.surfaces[knowledgeIntent.bindingId]?.kind !== 'knowledge') return
    presentSettings(false); setCenterPanel('native.workbench'); setKnowledgeIntent(null)
  }, [knowledgeIntent, workspace.workspaceId, workspace.mode, workspace.setMode, continuity.current.layout.surfaces])
  useEffect(() => {
    // Only the Expressions panel requests this, and only with native work
    // mounted: the centre shows that body in the cut the workspace stands in.
    const reveal = () => {presentSettings(false); setCenterPanel('world.expressions'); workspace.setMode(workspace.mode === 'techne' ? 'techne' : 'expressions')}
    window.addEventListener(NATIVE_PRESENT_EXPRESSIONS, reveal)
    return () => window.removeEventListener(NATIVE_PRESENT_EXPRESSIONS, reveal)
  }, [workspace.mode, workspace.setMode])
  const settingsHost = useSettingsHost()
  const [settingsPresented, presentSettings] = useState(restored?.settingsPresented ?? false)
  const settingsOrigin = useRef<HTMLElement | null>(null)
  const returnFromSettings = useCallback(() => {
    presentSettings(false)
    openSettings(null)
    requestAnimationFrame(() => settingsOrigin.current?.focus())
  }, [])
  useEffect(() => { configureSettingsHost(settingsHost.adapter, returnFromSettings) }, [settingsHost.adapter, returnFromSettings])
  useEffect(() => {
    if (!settingsHost.request) return
    if (!settingsPresented) settingsOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    presentSettings(true)
  }, [settingsHost.request])
  const [browser, setBrowser] = useState(restored?.browser ?? true)
  // An open device request shows the Browser: the expanded panel lives in its pool, not on the bottom rack.
  useEffect(() => {const openDevice = () => {if (workspace.mode !== 'audio') setBrowser(true)}; window.addEventListener(OPEN_DEVICE_EVENT, openDevice); return () => window.removeEventListener(OPEN_DEVICE_EVENT, openDevice)}, [workspace.mode])
  useEffect(() => {
    const browseParameters = () => {
      if (workspace.mode === 'audio') return
      setBrowser(true)
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.world-browser-search input')?.focus())
    }
    window.addEventListener(PARAMETER_BROWSE_EVENT, browseParameters)
    return () => window.removeEventListener(PARAMETER_BROWSE_EVENT, browseParameters)
  }, [workspace.mode])
  const [detail, setDetail] = useState(restored?.detail ?? true)
  const [detailConfiguration, configureDetail] = useState<NativeDetailConfigurationIntent | null>(null)
  const nativeComposition = workspace.mode !== 'audio' && (centerPanel === 'native.session' || centerPanel === 'native.arrangement')
  const nativeProjection = useMemo(() => {
    if (!workspace.editorReading) return {content: null, error: null}
    try {return {content: readNativeExpressionsContent(workspace.editorReading), error: null}}
    catch (cause) {return {content: null, error: cause instanceof Error ? cause.message : String(cause)}}
  }, [workspace.editorReading])
  // CSS-hidden residents remain mounted. Retire their presentation callbacks
  // whenever the actual workspace, owner lease, mode or visible cut changes.
  const presentation = useRef({workspaceId: workspace.workspaceId, accessEpoch: workspace.accessEpoch,
    editor: workspace.editor, mode: workspace.mode, centerPanel, settingsPresented, epoch: 0})
  const previous = presentation.current
  if (previous.workspaceId !== workspace.workspaceId || previous.accessEpoch !== workspace.accessEpoch
    || previous.editor !== workspace.editor || previous.mode !== workspace.mode
    || previous.centerPanel !== centerPanel || previous.settingsPresented !== settingsPresented) {
    presentation.current = {workspaceId: workspace.workspaceId, accessEpoch: workspace.accessEpoch,
      editor: workspace.editor, mode: workspace.mode, centerPanel, settingsPresented, epoch: previous.epoch + 1}
  }
  const presentNativeEditor=(editor:'source'|'layers'|'placement',basis:NativeEditorBasis)=>{
    const current=presentation.current,reading=currentEditorReading.current,bindingId=nativeInputBinding(continuity.current),mode=current.mode
    if(!bindingId||!reading||!sameEditorBasis(basis,reading.basis)||!workspace.nativeAccessCurrent(current.accessEpoch)||current.settingsPresented||mode==='audio')return
    setNativeEditorReturn(previous=>previous?{...previous,editor}:{workspaceId:current.workspaceId,accessEpoch:current.accessEpoch,bindingId,expression_ref:basis.expression_ref,scene_ref:basis.scene_ref,centerPanel:current.centerPanel,detail,detailMode,editor,owner:current.editor,mode,focus:document.activeElement instanceof HTMLElement?document.activeElement:null})
    setDetail(false);setCenterPanel('world.expressions')
  }
  const returnNativeEditor=()=>{
    const previous=nativeEditorReturn,reading=currentEditorReading.current
    if(!previous)return
    setNativeEditorReturn(null)
    if(settingsPresented||centerPanel!=='world.expressions'||workspace.mode!==previous.mode||workspace.editor!==previous.owner
      ||previous.workspaceId!==workspace.workspaceId||previous.accessEpoch!==workspace.accessEpoch||!workspace.nativeAccessCurrent(previous.accessEpoch)
      ||nativeInputBinding(continuity.current)!==previous.bindingId||reading?.basis.expression_ref!==previous.expression_ref||reading.basis.scene_ref!==previous.scene_ref)return
    setCenterPanel(previous.centerPanel);setDetail(previous.detail);changeDetailMode(previous.detailMode)
    requestAnimationFrame(()=>{if(previous.workspaceId===presentation.current.workspaceId&&previous.accessEpoch===presentation.current.accessEpoch
      &&presentation.current.centerPanel===previous.centerPanel&&nativeInputBinding(currentContinuity.current.current)===previous.bindingId
      &&presentation.current.editor===previous.owner&&presentation.current.mode===previous.mode&&!presentation.current.settingsPresented
      &&workspace.nativeAccessCurrent(previous.accessEpoch)&&currentEditorReading.current?.basis.expression_ref===previous.expression_ref
      &&currentEditorReading.current.basis.scene_ref===previous.scene_ref&&previous.focus?.isConnected)previous.focus.focus({preventScroll:true})})
  }
  const nativeEditorPresented=!!nativeEditorReturn&&!settingsPresented&&centerPanel==='world.expressions'&&workspace.mode===nativeEditorReturn.mode&&workspace.editor===nativeEditorReturn.owner
  useEffect(()=>{if(nativeEditorReturn&&!nativeEditorPresented)setNativeEditorReturn(null)},[nativeEditorReturn,nativeEditorPresented])
  const nativeView = (view: 'session' | 'arrangement' | 'expressions'): NativeCompositionViewSource | undefined => {
    if (workspace.mode === 'audio') return undefined
    const epoch = presentation.current.epoch
    const isPresented = () => {
      const current = presentation.current
      return current.epoch === epoch && !current.settingsPresented && current.mode !== 'audio'
        && current.centerPanel === (view === 'expressions' ? 'world.expressions' : `native.${view}`) && workspace.nativeAccessCurrent(current.accessEpoch)
    }
    const actions = nativeProjection.content && workspace.editor ? createNativeContentActions(nativeProjection.content, {
      request: request => isPresented() ? workspace.editor!.request(request)
        : Promise.resolve({ok: false, error: 'The originating composition view is no longer presented'}),
    }) : null
    return {owner: 'expressions', content: nativeProjection.content, actions, isPresented,
      currentReading:()=>currentEditorReading.current,
      revealNativeEditor:(editor,basis)=>{if(isPresented())presentNativeEditor(editor,basis)},
      revealDetail: (mode, family, acknowledgedBasis) => {
        const current = presentation.current
        const reading=currentEditorReading.current
        if (!isPresented() || !reading || reading.basis.expression_ref!==nativeProjection.content?.basis.expression_ref
          || !sameEditorBasis(acknowledgedBasis ?? nativeProjection.content.basis,reading.basis)) return
        changeDetailMode(mode); setDetail(true)
        configureDetail(previous => ({id: (previous?.id ?? 0) + 1,
          workspaceId: current.workspaceId, accessEpoch: current.accessEpoch,
          expression_ref: reading.basis.expression_ref, scene_ref: reading.basis.scene_ref,
          ...(mode==='clip'?{mode,material:family==='scene'?'scene' as const:'glyph' as const}:{mode,family:family??'controls'})}))
      }}
  }
  const chooseView = (view: string) => {
    if (view !== 'session' && view !== 'arrangement') return
    presentSettings(false); setTab(view)
    setCenterPanel(workspace.mode === 'audio' ? 'world.expressions' : `native.${view}`)
  }
  const [dock, setDock] = useState(restored?.dock ?? false)
  const [selection, select] = useState<SetSelection>(restored?.selection ?? { track: 0, scene: null })
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const colorKey = `live-shell.track-display/v1:${state.set?.path ?? ''}`
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(colorKey) ?? '{}')
      setOverrides(value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([key, color]) => /^\d+$/.test(key) && typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) : {})
    } catch { setOverrides({}) }
  }, [colorKey])
  const selectedSet = useRef(restored?.alsPath ?? null)
  useEffect(() => {
    if (!state.set) return
    if (selectedSet.current && selectedSet.current !== state.set.path) select({track: 0, scene: null})
    selectedSet.current = state.set.path
  }, [state.set?.path])
  useEffect(() => {
    if (frameWorkspace === workspace.workspaceId) return
    const view = continuity.applicationView
    restorePath({workspaceId: workspace.workspaceId, path: view?.alsPath})
    setTab(view?.tab ?? 'session'); setCenterPanel((view?.centerPanel === 'world.knowledge' ? 'native.workbench' : view?.centerPanel) ?? 'world.expressions')
    changeDetailMode(view?.detailMode ?? 'clip'); resizeBrowser(view?.browserWidth ?? null); resizeDetail(view?.detailHeight ?? null)
    setBrowser(view?.browser ?? true); setDetail(view?.detail ?? true); setDock(view?.dock ?? false)
    select(view?.selection ?? {track: 0, scene: null}); presentSettings(view?.settingsPresented ?? false)
    selectedSet.current = view?.alsPath ?? null
    setFrameWorkspace(workspace.workspaceId)
  }, [workspace.workspaceId, frameWorkspace, continuity.applicationView])
  useEffect(() => {
    if (frameWorkspace !== workspace.workspaceId) return
    continuity.checkpointApplicationView({alsPath: state.path ?? restored?.alsPath ?? null, tab, selection,
      browser, detail:nativeEditorPresented?nativeEditorReturn!.detail:detail, dock, browserWidth, detailHeight:detailExpansionReturn.current?detailExpansionReturn.current.height:detailHeight, centerPanel:nativeEditorPresented?nativeEditorReturn!.centerPanel:centerPanel, detailMode:nativeEditorPresented?nativeEditorReturn!.detailMode:detailMode, settingsPresented, settingsReturn: workspace.mode})
  }, [frameWorkspace, workspace.workspaceId, state.path, tab, selection, browser, detail, dock, browserWidth, detailHeight, centerPanel, detailMode, nativeEditorReturn, nativeEditorPresented, settingsPresented, workspace.mode, continuity.checkpointApplicationView])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault()
        settingsOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        presentSettings(true)
        return
      }
      const target = event.target as HTMLElement
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && !settingsPresented
        && (workspace.mode === 'audio' || centerPanel === 'world.expressions' || centerPanel === 'native.session' || centerPanel === 'native.arrangement')) {
        event.preventDefault(); chooseView(tab === 'session' ? 'arrangement' : 'session')
      }
      if (event.key.toLowerCase() === 'l' && event.metaKey && event.altKey) { event.preventDefault(); setDetail(current => !current) }
      if (event.key.toLowerCase() === 'b' && event.metaKey && event.altKey) { event.preventDefault(); setBrowser(current => !current) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspace.mode, centerPanel, tab, settingsPresented])
  const setColor = (track: number, value: string) => {
    const next = { ...overrides, [track]: value }
    setOverrides(next)
    try { localStorage.setItem(colorKey, JSON.stringify(next)) } catch { /* the display still works without storage */ }
  }
  const ctx = { set: state.set, loading: state.loading, error: state.error, openSet: state.open } satisfies PanelContext
  const colors = (state.set?.tracks ?? []).map((track, i) => overrides[i] ?? (track.kind === 'master' ? '#a2b6c2' : track.kind === 'return' ? '#76c0b7' : PALETTE[i % PALETTE.length]))
  const panels = getPanels('center')
  const choose = (value: SetSelection) => { select(value); changeDetailMode(value.scene !== null || value.clip !== undefined ? 'clip' : 'device') }
  const agentShell = centerPanel === 'native.agent' && !settingsPresented
  const agency = useAgencySessions(workspace.transport)
  const shellCtx = useAgentShell()
  const openCenterPanel = (id: string) => {
    if (id === 'world.settings') {
      settingsOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      presentSettings(true)
    } else {
      presentSettings(false)
      setCenterPanel(id)
      if (id === 'native.agent') setDock(true)
      // native.agent is a centre panel like the others: the workspace leaves
      // the audio surface, or the centre residence stays hidden in mode audio.
      workspace.setMode('expressions')
    }
  }
  const frameBody = (<>
    {agentShell ? <AgentShellTransportBridge
      title={workspace.reading?.document?.name ?? 'Agent sessions'}
      browser={browser} detail={detail} dock={dock}
      toggleBrowser={() => setBrowser(!browser)} toggleDetail={() => setDetail(!detail)} toggleDock={() => setDock(!dock)}
      onLeaveAgent={() => openCenterPanel('world.expressions')}
      tracks={agency.tracks}
      transport={workspace.transport}
    /> : <TransportBar tempoBpm={state.set?.tempo_bpm ?? null} name={state.set?.path.split('/').pop()?.replace(/\.als$/i, '') ?? ''} mode={workspace.mode} view={tab} setView={chooseView} setMode={mode => {presentSettings(false); setCenterPanel('world.expressions'); workspace.setMode(mode)}} centerPanels={panels.filter(panel => panel.id !== 'world.expressions' && panel.navigation !== false)} activeCenter={settingsPresented ? 'world.settings' : workspace.mode === 'audio' ? null : centerPanel} openCenter={openCenterPanel} workName={workspace.reading?.document?.name} sceneName={workspace.reading?.sceneName} nativeTransport={nativeView('expressions')} browser={browser} detail={detail} dock={dock} toggleBrowser={() => setBrowser(!browser)} toggleDetail={() => setDetail(!detail)} toggleDock={() => setDock(!dock)} />}
    <NativeInputRetentionProvider><div className="browser-residence" hidden={!browser || workspace.mode !== 'audio' || agentShell}><BrowserPane defaultSet={config?.default_set ?? ''} ctx={ctx} /></div>
    <div className="browser-residence" hidden={!browser || workspace.mode === 'audio' || agentShell}><WorldBrowser /></div>
    <div className="browser-residence" hidden={!browser || !agentShell}><AgentShellBrowser rows={agency.rows} error={agency.error} loading={agency.loading} /></div>
    {browser && <div className="browser-resizer" role="separator" aria-label="Resize browser" aria-orientation="vertical" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); resizeBrowser(Math.max(120, Math.min(viewport[0] - 320, (browserWidth ?? document.querySelector('.browser-residence:not([hidden]) .browser,.browser-residence:not([hidden]) .world-browser')?.getBoundingClientRect().width ?? 430) + (event.key === 'ArrowRight' ? 10 : -10))))} }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeBrowser(Math.max(120, Math.min(viewport[0] - 320, event.clientX))) }} />}
    <main className="center"><div className={`center-body${nativeComposition && !settingsPresented ? ' native-composition-residence' : ''}${nativeEditorReturn&&centerPanel==='world.expressions'&&!settingsPresented?' native-editor-residence':''}`}>
      {nativeEditorReturn&&centerPanel==='world.expressions'&&!settingsPresented&&<div className="native-editor-return"><span>{nativeEditorReturn.editor==='source'?'Source':nativeEditorReturn.editor==='layers'?'Layers':'State placement'}</span><button onClick={returnNativeEditor}>Return to {nativeEditorReturn.centerPanel==='native.arrangement'?'Arrangement':nativeEditorReturn.centerPanel==='native.session'?'Session':'Glyph editor'}</button></div>}
      {nativeComposition && !settingsPresented && nativeProjection.error && <div className="native-composition-fault" role="alert">{nativeProjection.error}</div>}
      <div className="inhabitant composition-view" hidden={settingsPresented || (workspace.mode === 'audio' ? tab !== 'session' : centerPanel !== 'native.session')}><SessionView set={state.set} document={deep.document} selection={selection} select={choose} colors={colors} setColor={setColor} native={nativeView('session')} compactTransport={workspace.mode === 'expressions'} /></div>
      <div className="inhabitant composition-view" hidden={settingsPresented || (workspace.mode === 'audio' ? tab !== 'arrangement' : centerPanel !== 'native.arrangement')}><ArrangementView set={state.set} document={deep.document} selection={selection} select={choose} colors={colors} native={nativeView('arrangement')} compactTransport={workspace.mode === 'expressions'} /></div>
      {panels.map(panel => { const Panel = panel.component; return <div className={`inhabitant${panel.id === 'world.expressions' ? ' native-stage-residence' : ''}`} hidden={panel.id === 'world.settings' ? !settingsPresented : settingsPresented || workspace.mode === 'audio' && panel.id !== 'world.knowledge' || (centerPanel !== panel.id && !(nativeComposition && panel.id === 'world.expressions'))} key={panel.id}><Panel {...ctx} /></div> })}
    </div></main>
    <div className="dock-residence" hidden={!dock || agentShell}><RightDock ctx={ctx} /></div>
    <div className="dock-residence" hidden={!dock || !agentShell}><AgentContextDock /></div>
    {detail && <div className="detail-resizer" role="separator" aria-label="Resize detail" aria-orientation="horizontal" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {event.preventDefault(); resizeDetail(Math.max(120, Math.min(viewport[1] - 240, (detailHeight ?? document.querySelector('.detail-residence:not([hidden]) .chain,.detail-residence:not([hidden]) .native-world-detail')?.getBoundingClientRect().height ?? 330) + (event.key === 'ArrowUp' ? 10 : -10))))} }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeDetail(Math.max(120, Math.min(viewport[1] - 240, viewport[1] - 28 - event.clientY))) }} />}
    <div className="detail-residence" hidden={!detail || workspace.mode !== 'audio'}><DeviceChainPanel ctx={ctx} document={deep.document} selection={selection} mode={detailMode}/></div>
    <div className="detail-residence" hidden={!detail || workspace.mode === 'audio' || agentShell}><NativeWorldDetail mode={detailMode} configurationIntent={detailConfiguration} presentMode={mode=>{changeDetailMode(mode);setDetail(true)}} presentNativeEditor={presentNativeEditor} expand={() => {if(!detailExpansionReturn.current)detailExpansionReturn.current={height:detailHeight,workspaceId:workspace.workspaceId,accessEpoch:workspace.accessEpoch};resizeDetail(Math.max(120,viewport[1]-156))}} collapse={() => {const previous=detailExpansionReturn.current;detailExpansionReturn.current=null;if(previous&&previous.workspaceId===workspace.workspaceId&&previous.accessEpoch===workspace.accessEpoch)resizeDetail(previous.height)}}/></div>
    <div className="detail-residence" hidden={!detail || !agentShell}><AgentShellDeviceDetail tracks={agency.tracks} /></div></NativeInputRetentionProvider>
    {agentShell ? <AgentStatusBarBridge detailMode={detailMode} changeDetailMode={mode => {changeDetailMode(mode); setDetail(true)}} audio={workspace.mode === 'audio'} reading={workspace.reading} state={state} documentError={deep.error} viewport={viewport} selectedTrack={agency.tracks[0]?.purpose ?? undefined} /> : <StatusBar detailMode={detailMode} changeDetailMode={mode => {changeDetailMode(mode); setDetail(true)}} audio={workspace.mode === 'audio'} reading={workspace.reading} state={state} documentError={deep.error} viewport={viewport} selectedTrack={state.set?.tracks[selection.track]?.name} />}
  </>)
  return <div ref={frameRef} style={{ ...(browserWidth === null ? {} : { '--browser-w': `${browserWidth}px` }), ...(detailHeight === null ? {} : { '--detail-h': `${detailHeight}px` }), ...(agentShell ? {'--dock-w': `${shellCtx.dockWidth}px`} : {}) } as CSSProperties} className={`frame mode-${workspace.mode}${browser ? '' : ' browser-hidden'}${detail ? '' : ' detail-hidden'}${dock ? ' dock-open' : ''}${agentShell ? ' agent-shell-frame' : ''}`} data-agent-shell={agentShell ? 'true' : undefined}>{frameBody}</div>
}

function AgentStatusBarBridge(props: ComponentProps<typeof StatusBar>) {
  const {statusInfo} = useAgentShell()
  return <StatusBar {...props} agentInfo={statusInfo} />
}


function AgentShellTransportBridge(props: {
  title: string
  browser: boolean
  detail: boolean
  dock: boolean
  toggleBrowser: () => void
  toggleDetail: () => void
  toggleDock: () => void
  onLeaveAgent: () => void
  tracks: AgentSessionTrack[]
  transport: KernelTransportStatus
}) {
  const shell = useAgentShell()
  const track = props.tracks.find(item => trackKey(item) === shell.selectedTrackId) ?? props.tracks[0]
  const metrics = useAgentMetrics(props.transport, track?.sessionRef ?? null)
  const {binding} = useHarnessBinding(props.transport)
  const [running, setRunning] = useState(true)
  const [controlBusy, setControlBusy] = useState(false)
  const runControl = async (control: 'resume' | 'stop' | 'restart') => {
    setControlBusy(true)
    const outcome = await harnessAgentControl(props.transport, binding, control)
    setControlBusy(false)
    if (outcome.ok) {
      if (control === 'stop') setRunning(false)
      if (control === 'resume' || control === 'restart') setRunning(true)
    } else {
      console.warn(outcome.error)
    }
  }
  return (
    <AgentShellTransport
      title={props.title}
      browser={props.browser}
      detail={props.detail}
      dock={props.dock}
      toggleBrowser={props.toggleBrowser}
      toggleDetail={props.toggleDetail}
      toggleDock={props.toggleDock}
      centreView={shell.centreView}
      onCentreView={view => shell.setCentreView(view)}
      tokensIn={metrics.tokensIn}
      tokensOut={metrics.tokensOut}
      spendFill={metrics.spend}
      running={running}
      controlBusy={controlBusy}
      onRun={() => void runControl('resume')}
      onStop={() => void runControl('stop')}
      budgetLabel={metrics.budgetUsed === null && metrics.budgetCap === null ? '— / —' : `${metrics.budgetUsed ?? '—'} / ${metrics.budgetCap ?? '—'}`}
      positionLabel={metrics.position}
      transport={props.transport}
    />
  )
}
