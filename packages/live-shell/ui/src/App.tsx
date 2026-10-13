import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type RefObject } from 'react'
import {useContinuity} from './continuity/workspace'
import { BrowserPane } from './components/BrowserPane'
import { WorldBrowser } from './components/WorldBrowser'
import { OPEN_DEVICE_EVENT, PARAMETER_BROWSE_EVENT } from './components/nativeDrag'
import { NativeWorldDetail, type NativeDetailConfigurationIntent } from './components/NativeWorldDetail'
import {NativeInputRetentionProvider,nativeInputBinding} from './components/NativeInputRetention'
import { useWorkspace } from './shell/workspace'
import { DeviceChainPanel, type DetailMode } from './components/DeviceChainPanel'
import { ModeContextDock } from './shell/ModeContextDock'
import { carrierOf } from './shell/runContext'
import type { SetSelection } from './components/SessionView'
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
import './shell/modeSurface.css'
import { useSetSummary, useShellConfig } from './shell/useSet'
import { useSetDocument } from './shell/document'
import { getPanels, type PanelContext } from './shell/panels'
import { configureSettingsHost, openSettings, useSettingsHost } from './settings/host'
import {createNativeContentActions, readNativeExpressionsContent} from './shell/nativeContent'
import type {NativeCompositionViewSource} from './shell/compositionViews'
import {TimelineProjectionResidence, timelinePresentation} from './projections/timelineResidence'
import {useWorldTemporalReading} from './projections/useWorldTemporalReading'
import {surfModeOf, type SurfMode} from './shell/modeGrammar'
import type {ModeTransportReadouts} from './shell/ModeTransportBar'
import {BaseDevicesDetail, BaseDocumentDetail, TechneInstrumentsDetail, InstrumentDeviceDetail, TechneClipDetail, FactoryTaskLogDetail, TechneLensBar, factoryLensPane, worldNowReadout} from './shell/ModeDetail'
import {ModeBrowser} from './shell/ModeBrowser'
import {ModeCentreFrame} from './shell/ModeCentre'
import type {CentralSubjectSelection} from './inhabitants/CentralSubjectDetail'
import {NATIVE_PRESENT_EXPRESSIONS} from './native/openStudio'
import {sameEditorBasis,type NativeEditorBasis,type NativeEditorController} from '@epilogos/expressions-boundary/editor'
import './NativeCompositionResidence.css'
import './live/liveCentre.css'
import './live/LiveInstrumentSection'
import './live/LivePresets'
import {registerAtlasHost} from './projections/atlas/registerAtlasHost'
import {registerTimelineHost} from './projections/timelinePane'
import {setTimelinePanePresentation, useTimelinePanePresentation, usePublishTimelineReading} from './projections/timelinePaneHost'
import {presentAtlasView, useAtlasView} from './projections/atlas/AtlasProjectionPanel'
import {deviceInstrumentFor, factoryFocusedPane, hostedLensOfBarId, showsLensBar, type HostedLens} from './shell/paneInstrument'
import {focusedSurfaceKind, isFactoryMode, openFactoryInstrumentPane} from './agent/factoryCentre'
import {captureTechneInstrumentOpen, TECHNE_INSTRUMENT_OPEN, type TechneInstrumentEvent} from './native/techneInstrumentOpen'
registerAtlasHost()
registerTimelineHost()
const PALETTE =['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9']
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
  // The World cut's one temporal read (L4): the civil field the Base and
  // Technē presentations stand on — one poller per shell frame.
  const worldView = useWorldTemporalReading(workspace.transport)
  // The frame's Rev-5 mode (the continuity ShellMode): Live · Base·Central ·
  // Factory · Expressions · Technē. The spine's narrow cut rides beneath it
  // (workspace.mode); the frame's regions compose on this reading.
  const frameMode: 'live' | 'base' | 'factory' | 'expressions' | 'techne' = surfModeOf(continuity.mode) ?? 'live'
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
  // A refusal of the hosted lens press, named in one status sentence under the lens bar (the hosted pane only).
  const [lensFault, setLensFault] = useState<string | null>(null)
  // The Factory centre is the Workbench's pane tree (agent/factoryCentre.ts); the retired agent centre and the knowledge
  // centre both restore to the Workbench, so no saved centre names a panel the mode does not stand.
  const workbenchCentre = (panel: string | undefined): string | undefined => frameMode === 'factory' || panel === 'native.agent' || panel === 'world.knowledge' ? 'native.workbench' : panel
  const [centerPanel, setCenterPanel] = useState(workbenchCentre(restored?.centerPanel) ?? 'world.expressions')
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
  // The Base mode's selected ground subject (the browser's Days/Files rows
  // select it): the Document detail's aperture. The selection rides the
  // frame's own state — the spine keeps the encounter, not a second store.
  const [centralSubject, selectCentralSubject] = useState<CentralSubjectSelection | null>(null)
  const nativeComposition = (workspace.mode === 'expressions' || workspace.mode === 'techne') && (centerPanel === 'native.session' || centerPanel === 'native.arrangement')
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
    // The native composition sources belong to the Expressions and Technē
    // cuts; Live, Base·Central and Factory present through their own
    // content (the audio cut, the World cut, the agency surface).
    if (workspace.mode !== 'expressions' && workspace.mode !== 'techne') return undefined
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
  const shellCtx = useAgentShell()
  const chooseView = (view: string) => {
    if (view !== 'session' && view !== 'arrangement') return
    // Session and Arrangement are presentations of ONE Timeline projection
    // over the current work — never a mode switch (the recorded fault: these
    // controls used to couple the presentation to the audio workspace). The
    // audio cut presents through `tab` alone and keeps its existing props;
    // the native cut keeps the established native.session /
    // native.arrangement identity the receiving joins are bound to; Base
    // and Technē ground cuts present the World cut through `tab` beside the
    // `world.ground` identity; Factory drives the agency centre's own view.
    // Neither presentation rewrites the application-view identity of another.
    presentSettings(false); setTab(view)
    // Live's centre: the instrument (world.expressions, the torus) or the Timeline. A view press shows the Timeline; Live's mode press returns to the instrument.
    if (frameMode === 'live') { setCenterPanel(`native.${view}`); return }
    if (frameMode === 'factory') { shellCtx.setCentreView(view); return }
    if (frameMode === 'base' || frameMode === 'techne') { if (centerPanel !== 'world.ground') setCenterPanel('world.ground'); return }
    setCenterPanel(`native.${view}`)
  }
  /** Enter a surf mode (Rev 5): one encounter transition over the spine —
   * mode and world context ride the one book (the bridge publishes both);
   * no surface closes, every resident stays mounted-concealed. The right
   * dock is part of the frame in every mode (Rev 4): entering a ground or
   * agency mode opens it — an opening, never a closing. */
  const chooseMode = (next: SurfMode) => {
    presentSettings(false)
    continuity.setContext(context => ({...context, world: next === 'base' ? 'central' : undefined}))
    continuity.setMode(next === 'live' ? 'audio' : next)
    if (next === 'live' || next === 'expressions') { setCenterPanel('world.expressions'); return }
    if (next === 'base' || next === 'techne') { setCenterPanel('world.ground'); setDock(true); return }
    setCenterPanel('native.workbench'); setDock(true)
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
    setTab(view?.tab ?? 'session'); setCenterPanel(workbenchCentre(view?.centerPanel) ?? 'world.expressions')
    changeDetailMode(view?.detailMode ?? 'clip'); resizeBrowser(view?.browserWidth ?? null); resizeDetail(view?.detailHeight ?? null)
    setBrowser(view?.browser ?? true); setDetail(view?.detail ?? true); setDock(view?.dock ?? false)
    select(view?.selection ?? {track: 0, scene: null}); presentSettings(view?.settingsPresented ?? false)
    selectedSet.current = view?.alsPath ?? null
    setFrameWorkspace(workspace.workspaceId)
  }, [workspace.workspaceId, frameWorkspace, continuity.applicationView])
  useEffect(() => {
    if (frameWorkspace !== workspace.workspaceId) return
    continuity.checkpointApplicationView({alsPath: state.path ?? restored?.alsPath ?? null, tab, selection,
      browser, detail:nativeEditorPresented?nativeEditorReturn!.detail:detail, dock, browserWidth, detailHeight:detailExpansionReturn.current?detailExpansionReturn.current.height:detailHeight, centerPanel:nativeEditorPresented?nativeEditorReturn!.centerPanel:centerPanel, detailMode:nativeEditorPresented?nativeEditorReturn!.detailMode:detailMode, settingsPresented, settingsReturn: workspace.mode === 'expressions' || workspace.mode === 'techne' ? workspace.mode : undefined})
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
        && (frameMode === 'live' || centerPanel === 'world.expressions' || centerPanel === 'world.ground' || centerPanel === 'native.session' || centerPanel === 'native.arrangement' || frameMode === 'factory')) {
        event.preventDefault(); chooseView(tab === 'session' ? 'arrangement' : 'session')
      }
      if (event.key.toLowerCase() === 'l' && event.metaKey && event.altKey) { event.preventDefault(); setDetail(current => !current) }
      if (event.key.toLowerCase() === 'b' && event.metaKey && event.altKey) { event.preventDefault(); setBrowser(current => !current) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frameMode, centerPanel, tab, settingsPresented])
  const setColor = (track: number, value: string) => {
    const next = { ...overrides, [track]: value }
    setOverrides(next)
    try { localStorage.setItem(colorKey, JSON.stringify(next)) } catch { /* the display still works without storage */ }
  }
  const ctx = { set: state.set, loading: state.loading, error: state.error, openSet: state.open } satisfies PanelContext
  const colors = (state.set?.tracks ?? []).map((track, i) => overrides[i] ?? (track.kind === 'master' ? '#a2b6c2' : track.kind === 'return' ? '#76c0b7' : PALETTE[i % PALETTE.length]))
  const panels = getPanels('center')
  const choose = (value: SetSelection) => { select(value); changeDetailMode(value.scene !== null || value.clip !== undefined ? 'clip' : 'device') }
  const agency = useAgencySessions(workspace.transport)
  const openCenterPanel = (id: string) => {
    if (id === 'world.settings') {
      settingsOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      presentSettings(true)
    } else {
      presentSettings(false)
      if (id === 'native.agent') { setCenterPanel('native.workbench'); setDock(true); continuity.setMode('factory'); return }
      setCenterPanel(id)
      // The other centre panels belong to the Expressions side: the
      // workspace leaves the audio surface, or the centre residence stays
      // hidden in mode audio.
      continuity.setMode('expressions')
    }
  }
  // The mode system's frame readings (Rev 5): which presentation stands
  // (the encounter's, never a second store), what the World cut shows, and
  // the real readings the mode transport may wear.
  // Factory is the agent shell's mode: its chrome (dock, status, transport, task log, agent Device side) stands over the Workbench
  // tree whose default tab is the agent surface (agent/factoryCentre.ts). The centre is that tree, not a separate panel.
  const agentShell = isFactoryMode(frameMode) && !settingsPresented
  // The World cut is the ground pane itself: it stands only while the centre
  // holds world.ground (in Central as in Technē), so the Earth atlas focused
  // from the lens bar is not drawn over by the Timeline.
  const worldCut = (frameMode === 'base' || frameMode === 'techne') && centerPanel === 'world.ground'
  const presented = worldCut ? (tab === 'arrangement' ? 'arrangement' as const : 'session' as const) : timelinePresentation(workspace.mode, tab, centerPanel)
  const presentedView = agentShell ? (shellCtx.centreView === 'arrangement' ? 'arrangement' as const : shellCtx.centreView === 'session' ? 'session' as const : null) : presented
  // The focused centre pane's instrument (owner ruling, 13 Oct 2026): the
  // Device side follows it in every mode but Live; the lens bar stands over
  // the centre whenever it holds an instrument pane (paneInstrument.ts).
  const atlasView = useAtlasView()
  // The Timeline pane's own presentation (Session = Journey, Arrangement = Timeline): pane state, never the World cut's `tab`.
  const timelinePane = useTimelinePanePresentation()
  // A Factory tree's focused tab names its pane (factoryFocusedPane): the agent tab keeps its own Device side, an instrument tab
  // takes its instrument through the same deviceInstrumentFor every mode uses.
  const factoryFocus = frameMode === 'factory' ? factoryFocusedPane(focusedSurfaceKind(continuity.current.layout), timelinePane) : null
  const focusedPane = settingsPresented ? 'world.settings' : factoryFocus ? factoryFocus.pane : centerPanel
  // The hosted Expressions lens the frame reports (publishReading, via the panel's onState). Null until it reports one.
  const hostedLens = workspace.reading?.lens ?? null
  const focusedInstrument = deviceInstrumentFor(frameMode, focusedPane, factoryFocus ? factoryFocus.presentation : presented, atlasView, hostedLens)
  const instrumentLensBar = showsLensBar(frameMode, focusedPane)
  // The hosted pane's lens press: the retained-instrument event the Technē browser already sends. The expressions panel's receiver
  // validates it against the current native Scene and calls the hosted host's selectInstrument; nothing here holds the host.
  const driveHostedLens = (lens: HostedLens) => {
    setLensFault(null);
    try {
      const detail: TechneInstrumentEvent = {...captureTechneInstrumentOpen({workspaceId: workspace.workspaceId, accessEpoch: workspace.accessEpoch, accessReady: workspace.accessReady, nativeAccessCurrent: workspace.nativeAccessCurrent, mode: workspace.mode, editorReading: workspace.editorReading}, lens),
        complete: result => {if (result.state === 'refused') setLensFault(result.reason)}};
      window.dispatchEvent(new CustomEvent(TECHNE_INSTRUMENT_OPEN, {detail}));
      if (!detail.handled) setLensFault('The Expressions application is not mounted in this shell.');
    } catch (cause) {setLensFault(cause instanceof Error ? cause.message : String(cause));}
  };
  // The centre's designed frame stands while the World cut's civil reading
  // is absent or in flight (the empty-state law: a designed surface inside
  // the frame, never a bare sentence in a void). The L4 presentations stay
  // mounted beneath — residents are concealed, never closed.
  const centreFrameUp = worldCut && worldView.source.status !== 'live' && !settingsPresented
  const modeReadouts: ModeTransportReadouts | undefined = worldCut ? {
    position: worldNowReadout(worldView),
    link: workspace.transport.kind === 'unavailable'
      ? {value: '—', title: `The kernel carrier is unavailable: ${workspace.transport.reason}`}
      : {value: carrierOf(workspace.transport), title: `The kernel carrier (${carrierOf(workspace.transport)}) serves the ground`},
  } : undefined
  const factoryTask = agency.tracks.find(item => trackKey(item) === shellCtx.selectedTrackId) ?? agency.tracks[0] ?? null
  // The Timeline pane's reading (T-FACTORY-TIMELINE-PANE): the props the World cut's residence reads, published through the host door
  // (projections/timelinePaneHost.ts). The pane body renders them; nothing here is copied into a second store.
  usePublishTimelineReading({set: state.set, document: deep.document, selection, select: choose, colors, setColor, world: worldView, journey: {openExpression: workspace.requestExpression}})
  const frameBody = (<>
    {agentShell ? <AgentShellTransportBridge
      title={workspace.reading?.document?.name ?? 'Agent sessions'}
      browser={browser} detail={detail} dock={dock}
      toggleBrowser={() => setBrowser(!browser)} toggleDetail={() => setDetail(!detail)} toggleDock={() => setDock(!dock)}
      onLeaveAgent={() => openCenterPanel('world.expressions')}
      tracks={agency.tracks}
      transport={workspace.transport}
      mode={frameMode}
      onMode={chooseMode}
    /> : <TransportBar tempoBpm={state.set?.tempo_bpm ?? null} name={state.set?.path.split('/').pop()?.replace(/\.als$/i, '') ?? ''} mode={frameMode} view={tab} setView={chooseView} chooseMode={chooseMode} presentedView={presentedView} modeReadouts={modeReadouts} centerPanels={panels.filter(panel => panel.id !== 'world.expressions' && panel.id !== 'native.agent' && panel.navigation !== false)} activeCenter={settingsPresented ? 'world.settings' : frameMode === 'live' ? null : centerPanel} openCenter={openCenterPanel} workName={workspace.reading?.document?.name} sceneName={workspace.reading?.sceneName} nativeTransport={nativeView('expressions')} browser={browser} detail={detail} dock={dock} toggleBrowser={() => setBrowser(!browser)} toggleDetail={() => setDetail(!detail)} toggleDock={() => setDock(!dock)} />}
    <NativeInputRetentionProvider><div className="browser-residence" hidden={!browser || frameMode !== 'live' || agentShell}><BrowserPane defaultSet={config?.default_set ?? ''} ctx={ctx} /></div>
    {/* The browser is per mode (Rev 3's left column): Live keeps the audio
      pane, Expressions keeps the retained app's library (the parent's own
      browser — correct per the audit); Base·Central and Technē wear the
      grammar's categories over the families' declared entries. */}
    <div className="browser-residence" hidden={!browser || frameMode === 'live' || agentShell}>
      {frameMode === 'expressions'
        ? <WorldBrowser />
        : <ModeBrowser mode={frameMode} onSelectSubject={selectCentralSubject} selectedSubject={centralSubject} />}
    </div>
    <div className="browser-residence" hidden={!browser || !agentShell}><AgentShellBrowser rows={agency.rows} error={agency.error} loading={agency.loading} /></div>
    {browser && <div className="browser-resizer" role="separator" aria-label="Resize browser" aria-orientation="vertical" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); resizeBrowser(Math.max(120, Math.min(viewport[0] - 320, (browserWidth ?? document.querySelector('.browser-residence:not([hidden]) .browser,.browser-residence:not([hidden]) .world-browser')?.getBoundingClientRect().width ?? 430) + (event.key === 'ArrowRight' ? 10 : -10))))} }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeBrowser(Math.max(120, Math.min(viewport[0] - 320, event.clientX))) }} />}
    <main className="center"><div className={`center-body${nativeComposition && !settingsPresented ? ' native-composition-residence' : ''}${nativeEditorReturn&&centerPanel==='world.expressions'&&!settingsPresented?' native-editor-residence':''}`} data-lens-bar={instrumentLensBar ? 'true' : undefined}>
      {/* The Technē lens bar (Rev 3): its own axis above the centre — the
        six lenses by their plain names; the World cut's two presentations
        and the Earth atlas's two views are the cut lenses, the rest hold
        their places, named. It stands over any centre that holds an
        instrument pane, in every mode but Live (owner ruling, 13 Oct 2026).
        A World cut lens reached from a mode without the cut enters Technē's
        ground, as the mode transport does. */}
      {instrumentLensBar && <TechneLensBar presentation={factoryFocus ? factoryFocus.presentation : presented ?? 'session'} atlasOpen={centerPanel === 'projection.earth' || factoryFocus?.pane === 'projection.earth'} factory={isFactoryMode(frameMode)} hosted={focusedPane === 'world.expressions' ? {lens: hostedLens} : null} onLens={lens => {
        // The hosted pane's lens: a press drives the hosted application's lens through its retained-instrument receiver.
        if (focusedPane === 'world.expressions') {const hosted = hostedLensOfBarId(lens.id); if (hosted) driveHostedLens(hosted); return}
        if (lens.state !== 'cut') return
        presentSettings(false)
        // In Factory the lens opens its instrument pane inside the Workbench tree beside the agent tab, never by leaving the centre.
        if (agentShell) {
          // Only the admitted panes open here (the Earth atlas, the Timeline pane); a disabled lens (Canvas, Palace) opens nothing.
          // Timeline and Journey open the one Timeline pane, and the lens's presentation is that pane's own presentation.
          const paneKind = factoryLensPane(lens)
          if (paneKind) {
            if (paneKind === 'projection.timeline') setTimelinePanePresentation(lens.presentation ?? 'arrangement')
            continuity.setLayout(layout => openFactoryInstrumentPane(layout, paneKind))
          }
          return
        }
        if (lens.atlas) { presentAtlasView(lens.atlas); setCenterPanel('projection.earth'); return }
        if (lens.presentation) { if (frameMode !== 'base' && frameMode !== 'techne') chooseMode('techne'); setTab(lens.presentation); setCenterPanel('world.ground') }
      }} />}
      {instrumentLensBar && focusedPane === 'world.expressions' && lensFault && <p className="techne-lens-fault" role="status">{lensFault}</p>}
      {nativeEditorReturn&&centerPanel==='world.expressions'&&!settingsPresented&&<div className="native-editor-return"><span>{nativeEditorReturn.editor==='source'?'Source':nativeEditorReturn.editor==='layers'?'Layers':'State placement'}</span><button onClick={returnNativeEditor}>Return to {nativeEditorReturn.centerPanel==='native.arrangement'?'Arrangement':nativeEditorReturn.centerPanel==='native.session'?'Session':'Glyph editor'}</button></div>}
      {nativeComposition && !settingsPresented && nativeProjection.error && <div className="native-composition-fault" role="alert">{nativeProjection.error}</div>}
      {/* One Timeline projection over the current work; Session and
        Arrangement are its two presentations (both mount retained; which
        stands is the encounter's, read by timelinePresentation — and, in
        Base and the Technē ground cut, by the tab over the World cut). The
        native prop grammar and the audio props pass through untouched; the
        World cut rides L4's additive `world` prop only where it presents. */}
      <TimelineProjectionResidence set={state.set} document={deep.document} selection={selection} select={choose} colors={colors} setColor={setColor}
        session={worldCut ? undefined : nativeView('session')} arrangement={worldCut ? undefined : nativeView('arrangement')} compactTransport={frameMode === 'expressions'}
        presented={settingsPresented || centreFrameUp ? null : presented}
        world={worldCut ? worldView : undefined}
        journey={worldCut && frameMode === 'techne' ? {openExpression: workspace.requestExpression} : undefined} />
      {/* The centre's designed frame while the civil reading is absent or in
        flight (the empty-state law): the mode's day-as-clips / Relation
        Field / Journey surface with the disclosure INSIDE it — the L4
        presentations stay mounted beneath, concealed, never closed. */}
      <div className="mode-centre-residence" hidden={!centreFrameUp} data-mode-centre-residence={frameMode}>
        {(frameMode === 'base' || frameMode === 'techne') && <ModeCentreFrame mode={frameMode} presentation={presented ?? 'session'} world={worldView} />}
      </div>
      {panels.map(panel => { const Panel = panel.component; return <div className={`inhabitant${panel.id === 'world.expressions' ? ' native-stage-residence' : ''}${frameMode === 'live' && panel.id === 'world.expressions' ? ' live-centre-torus' : ''}`} hidden={panel.id === 'world.settings' ? !settingsPresented : settingsPresented || workspace.mode === 'audio' && panel.id !== 'world.knowledge' && panel.id !== 'world.expressions' || (centerPanel !== panel.id && !(nativeComposition && panel.id === 'world.expressions'))} key={panel.id}><Panel {...ctx} /></div> })}
    </div></main>
    {/* Rev 4's dock per mode: the mode context dock (tiles above, launcher
      below, the wedge that dies with the toggle) carries the non-agency
      modes; the agency surface keeps its own dock. */}
    <div className="dock-residence" hidden={!dock || agentShell}><ModeContextDock mode={frameMode} world={worldView} transport={workspace.transport} subject={centralSubject} /></div>
    <div className="dock-residence" hidden={!dock || !agentShell}><AgentContextDock /></div>
    {detail && <div className="detail-resizer" role="separator" aria-label="Resize detail" aria-orientation="horizontal" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {event.preventDefault(); resizeDetail(Math.max(120, Math.min(viewport[1] - 240, (detailHeight ?? document.querySelector('.detail-residence:not([hidden]) .chain,.detail-residence:not([hidden]) .native-world-detail')?.getBoundingClientRect().height ?? 330) + (event.key === 'ArrowUp' ? 10 : -10))))} }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeDetail(Math.max(120, Math.min(viewport[1] - 240, viewport[1] - 28 - event.clientY))) }} />}
    {/* The detail row (Rev 4's table; owner ruling, 13 Oct 2026). The Clip
      side is each mode's own craft, unchanged. The Device side follows the
      focused centre pane's instrument in every mode but Live: when the pane
      holds one (paneInstrument.ts), its device face stands — the instrument
      rack with that instrument's faces expanded and the others folded. In
      Central the ground's own Devices lead that chain — the mode supplies the
      material, so its devices are never removed. The
      Device side of a mode without an instrument pane is its own: Live the
      audio chain, Expressions its native rack, Base the ground's Devices,
      Technē the instruments rack, Factory the agent chain's device. */}
    <div className="detail-residence" hidden={!detail || frameMode !== 'live'}><DeviceChainPanel ctx={ctx} document={deep.document} selection={selection} mode={detailMode}/></div>
    {/* Expressions keeps its native detail on both sides (its device rack is
      the pane's own; the native cut's Clip stays native). A focused
      instrument's Device side is handled by the instrument residence below. */}
    <div className="detail-residence" hidden={!detail || agentShell || !(frameMode === 'expressions' || (frameMode === 'techne' && detailMode === 'clip' && !worldCut)) || (detailMode === 'device' && focusedInstrument !== null)}><NativeWorldDetail mode={detailMode} configurationIntent={detailConfiguration} presentMode={mode=>{changeDetailMode(mode);setDetail(true)}} presentNativeEditor={presentNativeEditor} expand={() => {if(!detailExpansionReturn.current)detailExpansionReturn.current={height:detailHeight,workspaceId:workspace.workspaceId,accessEpoch:workspace.accessEpoch};resizeDetail(Math.max(120,viewport[1]-156))}} collapse={() => {const previous=detailExpansionReturn.current;detailExpansionReturn.current=null;if(previous&&previous.workspaceId===workspace.workspaceId&&previous.accessEpoch===workspace.accessEpoch)resizeDetail(previous.height)}}/></div>
    <div className="detail-residence" hidden={!detail || !(frameMode === 'base' || (frameMode === 'techne' && (detailMode === 'device' || (detailMode === 'clip' && worldCut)))) || (detailMode === 'device' && focusedInstrument !== null)}>{frameMode === 'base' ? (detailMode === 'clip' ? <BaseDocumentDetail transport={workspace.transport} subject={centralSubject} /> : <BaseDevicesDetail transport={workspace.transport} />) : (worldCut && detailMode === 'clip' ? <TechneClipDetail world={worldView} /> : <TechneInstrumentsDetail transport={workspace.transport} />)}</div>
    {/* The instrument residence: the focused pane's instrument as the Device side, in any mode but Live. */}
    <div className="detail-residence" hidden={!detail || focusedInstrument === null || detailMode !== 'device'} data-instrument-device={focusedInstrument ?? undefined}>{focusedInstrument !== null && <InstrumentDeviceDetail transport={workspace.transport} instrument={focusedInstrument} centralDevices={frameMode === 'base'} />}</div>
    <div className="detail-residence" hidden={!detail || !agentShell || detailMode !== 'clip'}><FactoryTaskLogDetail taskLabel={factoryTask?.purpose ?? null} task={factoryTask ? {sessionRef: factoryTask.sessionRef, purpose: factoryTask.purpose, agentName: factoryTask.agentName, needleState: factoryTask.needle?.state ?? null, tasks: factoryTask.tasks, budget: factoryTask.budget} : null} /></div>
    <div className="detail-residence" hidden={!detail || !agentShell || detailMode !== 'device' || focusedInstrument !== null}><AgentShellDeviceDetail tracks={agency.tracks} /></div></NativeInputRetentionProvider>
    {agentShell ? <AgentStatusBarBridge detailMode={detailMode} changeDetailMode={mode => {changeDetailMode(mode); setDetail(true)}} audio={frameMode === 'live'} mode={frameMode} reading={workspace.reading} state={state} documentError={deep.error} viewport={viewport} selectedTrack={agency.tracks[0]?.purpose ?? undefined} presentedView={presentedView} subjectLabel={frameMode === 'base' && centralSubject ? centralSubject.path : undefined} /> : <StatusBar detailMode={detailMode} changeDetailMode={mode => {changeDetailMode(mode); setDetail(true)}} audio={frameMode === 'live'} mode={frameMode} reading={workspace.reading} state={state} documentError={deep.error} viewport={viewport} selectedTrack={state.set?.tracks[selection.track]?.name} presentedView={presentedView} subjectLabel={frameMode === 'base' && centralSubject ? centralSubject.path : undefined} />}
  </>)
  return <div ref={frameRef} style={{ ...(browserWidth === null ? {} : { '--browser-w': `${browserWidth}px` }), ...(detailHeight === null ? {} : { '--detail-h': `${detailHeight}px` }), ...(agentShell ? {'--dock-w': `${shellCtx.dockWidth}px`} : {}) } as CSSProperties} className={`frame mode-${workspace.mode}${browser ? '' : ' browser-hidden'}${detail ? '' : ' detail-hidden'}${dock ? ' dock-open' : agentShell ? ' no-dock' : ''}${agentShell ? ' agent-shell-frame' : ''}`} data-agent-shell={agentShell ? 'true' : undefined}>{frameBody}</div>
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
  /** The mode rail (Rev 5): the frame's mode reading and its transition. */
  mode: string
  onMode: (mode: SurfMode) => void
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
      onMode={props.onMode}
      mode={props.mode}
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
