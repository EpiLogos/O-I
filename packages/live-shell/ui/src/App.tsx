import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type RefObject } from 'react'
import {useContinuity} from './continuity/workspace'
import { PARAMETER_BROWSE_EVENT } from './components/nativeDrag'
import type { NativeDetailConfigurationIntent } from './components/NativeWorldDetail'
import {NativeInputRetentionProvider,nativeInputBinding} from './components/NativeInputRetention'
import { useWorkspace } from './shell/workspace'
import type { DetailMode } from './components/DeviceChainPanel'
import { carrierOf } from './shell/runContext'
import type { SetSelection } from './shell/liveSelection'
import { StatusBar } from './components/StatusBar'
import { TransportBar } from './components/TransportBar'
import {AgentShellProvider, useAgentShell} from './agent/AgentShellContext'
import {useAgencySessions} from './agent/useAgencySessions'
import {workspaceModeDetail} from '../../../../desktop/cradle/src/library/workspaceModeRelay'
import './agent/agentShell.css'
import './shell/modeSurface.css'
import { useSetSummary, useShellConfig } from './shell/useSet'
import { useSetDocument } from './shell/document'
import { getPanels, type PanelContext } from './shell/panels'
import { configureSettingsHost, openSettings, useSettingsHost } from './settings/host'
import {createNativeContentActions, readNativeExpressionsContent} from './shell/nativeContent'
import type {NativeCompositionViewSource} from './shell/compositionViews'
import {useWorldTemporalReading, type WorldTimelineView} from './projections/useWorldTemporalReading'
import {surfModeOf, type SurfMode} from './shell/modeGrammar'
import {MODE_FRAMES, MODE_TRACK_SOURCES} from './shell/modeFrames'
import {centralSubjectOfClip} from './timeline/centralTrackAdapter'
import {registerDocumentLayoutWriter} from './central/documents/documentDoor'
import {Browser} from './frame/browser/Browser'
import {FrameKeys} from './frame/keys/FrameKeys'
import {WidgetRail} from './frame/widgets/WidgetRail'
import {useChatRailDrop} from './agent/factoryChatsRail'
import type {WidgetRailBook} from './frame/widgets/widgets'
import {worldWidgets, WidgetReadingProvider} from './shell/widgets'
import {RailDevices} from './widgets/railDevices'
import {DEFAULT_WIDGETS} from './shell/widgetDefaults'
import {BrowserReadingProvider, MODE_POOL_FACES, browserSourcesOf, type BrowserReading} from './shell/modeBrowsers'
import {TracksPane} from './frame/tracks/TracksPane'
import {showMainView, tabMainView, togglePaneView, useMainView, type MainView} from './shell/mainView'
import {openInstrument, publishStageLensDriver} from './frame/instrumentDoor'
import {captureTechneInstrumentOpen, TECHNE_INSTRUMENT_OPEN, type TechneInstrumentEvent} from './native/techneInstrumentOpen'
import {liveWorldSelection, setSelectionOf} from './shell/liveSelection'
import type {WorldSelection} from '../../../../desktop/cradle/src/workspace/store'
import type {ModeTransportReadouts} from './shell/ModeTransportBar'
import {worldNowReadout} from './shell/ModeDetail'
import {DetailHost} from './frame/detail/DetailHost'
import {expandsClip, shownSidesNow, toggleSide, type DetailSide} from './frame/detail/detailSides'
import {DetailContext, type DetailReading} from './frame/detail/detailReading'
import type {CentralSubjectSelection} from './inhabitants/CentralSubjectDetail'
import {NATIVE_PRESENT_EXPRESSIONS} from './native/openStudio'
import {SOURCE_PRESENT} from './native/hostedSummons'
import {PLACED_RESIDENCE_STYLE, useFramePlacement} from './projections/expressionsPaneHost'
import {sameEditorBasis,type NativeEditorBasis,type NativeEditorController} from '@epilogos/expressions-boundary/editor'
import './NativeCompositionResidence.css'
import './live/liveCentre.css'
import './live/LiveInstrumentSection'
import './live/LivePresets'
import {registerAtlasHost} from './projections/atlas/registerAtlasHost'
import {registerTimelineHost} from './projections/timelinePane'
import {registerCentralDocumentPane} from './central/documents/CentralDocumentPane'
import {registerDevicePane} from './frame/devices/devicePane'
import {createSpineEncounterBridge} from './projections/encounterBridge'
import {createEncounterLink, type EncounterLink} from './projections/encounterLink'
import {setTimelinePanePresentation, useTimelinePanePresentation, usePublishTimelineReading} from './projections/timelinePaneHost'
import {useAtlasHandle, useAtlasView} from './projections/atlas/AtlasProjectionPanel'
import {deviceInstrumentFor, factoryFocusedPane, type HostedLens} from './shell/paneInstrument'
import {focusedSurfaceKind, isFactoryMode} from './agent/factoryCentre'
import {subjectWords} from './central/daySurface'
import {worldSubjectOf} from './techne/subject/worldRows'
import {clampBrowserWidth, clampDetailHeight, clampRailWidth, collapseDetail, drawnSizes, draggedSize, enteredDetailHeight, expandDetail,
  expandedDetailHeight, focusKeyOf, frameToggleOf, keptDetailHeight, RESIZE_STEP, switchesDetailSide, type AreaDrag, type DetailExpansions, type FocusTarget, type FrameToggle} from './shell/workspaceAreas'
import {DeviceFlipHost} from './frame/devices/DeviceFlip'
registerAtlasHost()
/** Your system's readings (T-WORLDS §5 W3 phase B), loaded with the Earth: they read Central's worlds, today's set, what plays and what is
 * to hand, and bind the acts that open them and land worlds (projections/atlas/system/SystemReadings.tsx). */
const SystemReadings = lazy(() => import('./projections/atlas/system/SystemReadings').then(module => ({default: module.SystemReadings})))
registerTimelineHost()
registerCentralDocumentPane()
registerDevicePane()
const PALETTE =['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9']
/** The ground material kinds the Document detail opens (CentralSubjectSelection). */
const CENTRAL_SUBJECT_KINDS = new Set(['day', 'note', 'folder'])
export function App() {
  const frameRef = useRef<HTMLDivElement>(null)
  return <AgentShellProvider frameRef={frameRef}><AgentShellFrameInner frameRef={frameRef} /></AgentShellProvider>
}

function AgentShellFrameInner({frameRef}: {frameRef: RefObject<HTMLDivElement>}) {
  const workspace = useWorkspace()
  const atlas = useAtlasHandle()
  const currentEditorReading=useRef(workspace.editorReading)
  // The qualified owner publishes its reply before React presents that reading.
  // Detail return must compare with that exact publisher, including the same
  // acknowledgement turn, rather than a previous render's selection basis.
  useEffect(()=>{currentEditorReading.current=workspace.editorReading;return workspace.editor?.subscribe(reading=>{currentEditorReading.current=reading})},[workspace.editor])
  const continuity = useContinuity()
  // A document pane renders in a root of its own: the links its page follows reach the pane tree through the book's writer.
  const continuityNow = useRef(continuity)
  continuityNow.current = continuity
  useEffect(() => registerDocumentLayoutWriter(update => continuityNow.current.setLayout(update)), [])
  const currentContinuity=useRef(continuity);currentContinuity.current=continuity
  // The encounter link (seam 3): the URL projects the spine's encounter, Back walks it, and the store stays the one writer.
  const encounterSpine = useRef({book: continuity, workspace})
  encounterSpine.current = {book: continuity, workspace}
  const [unlinkedSubject, setUnlinkedSubject] = useState<string | null>(null)
  const encounterLink = useRef<EncounterLink | null>(null)
  useEffect(() => {
    const bridge = createSpineEncounterBridge(encounterSpine)
    const link = createEncounterLink({
      snapshot: () => bridge.snapshot(),
      switchMode: next => encounterSpine.current.book.switchMode(next),
      setContext: change => encounterSpine.current.book.setContext(change),
    }, window, {onUnresolved: ref => setUnlinkedSubject(ref ?? null)})
    encounterLink.current = link
    link.start()
    return () => { link.dispose(); encounterLink.current = null }
  }, [])
  // The render is the publication: the link projects whatever the spine now holds.
  useEffect(() => { encounterLink.current?.publish() })
  // The World cut's one temporal read (L4): the civil field the Base and
  // Technē presentations stand on — one poller per shell frame.
  const worldView = useWorldTemporalReading(workspace.transport)
  // The frame's Rev-5 mode (the continuity ShellMode): Live · Base·Central ·
  // Factory · Expressions · Technē. The spine's narrow cut rides beneath it
  // (workspace.mode); the frame's regions compose on this reading.
  const frameMode: 'live' | 'base' | 'factory' | 'expressions' | 'techne' = surfModeOf(continuity.mode) ?? 'live'
  const restored = continuity.applicationView
  // The frame's state belongs to the mode it stands in (FOUNDATION F1): each book mode's layout carries its own
  // application view, restored whenever the workspace or the mode changes, and a mode never stood in opens on its
  // registered frame (shell/modeFrames.ts).
  const frameKey = `${workspace.workspaceId}|${continuity.current.layout.mode ?? 'base'}`
  // Applying a named set marks the layout, so the frame restores from it even within the same mode.
  const restoreKey = `${frameKey}|${continuity.current.layout.appliedSet ?? ''}`
  const opening = MODE_FRAMES[frameMode]
  const [restoredKey, setRestoredKey] = useState(restoreKey)
  // A move that changes mode AND asks for a centre (open Knowledge, reveal the stage, a lens press) names the frame it
  // is aimed at; the restore of that frame honours it instead of the mode's own centre.
  const centreIntent = useRef<{key: string; panel: string; tab?: 'session' | 'arrangement'} | null>(null)
  const [restoration, restorePath] = useState({workspaceId: workspace.workspaceId, path: restored?.alsPath})
  const config = useShellConfig()
  const rememberedPath = restoration.workspaceId === workspace.workspaceId ? restoration.path : restored?.alsPath
  const initialPath = rememberedPath === undefined ? config?.default_set : rememberedPath ?? undefined
  const state = useSetSummary(initialPath, workspace.workspaceId)
  const deep = useSetDocument(state.set)
  const [detailMode, changeDetailMode] = useState<DetailMode>(restored?.detailMode ?? opening.detailMode)
  // The detail area's sides (manual §16.4; frame/detail/detailSides.ts): `detailMode` is the front side (⇧Tab, a selection), these
  // are the sides hidden from the status bar's switches, and ⌥⌘E gives Clip view the main area. The front side always shows.
  const [hiddenSides, setHiddenSides] = useState<Readonly<Record<DetailSide, boolean>>>({clip: false, device: false})
  const [clipExpanded, setClipExpanded] = useState(false)
  useEffect(() => { setHiddenSides(hidden => hidden[detailMode] ? {...hidden, [detailMode]: false} : hidden) }, [detailMode])
  const toggleDetailSide = (side: DetailSide) => {
    const next = toggleSide({front: detailMode, hidden: hiddenSides}, side, shownSidesNow())
    changeDetailMode(next.front); setHiddenSides(next.hidden); setDetail(true)
  }
  const [browserWidth, resizeBrowser] = useState<number | null>(restored?.browserWidth ?? null)
  const [detailHeight, resizeDetail] = useState<number | null>(restored?.detailHeight ?? null)
  // The browser category each mode stands on, restored with its frame (F1).
  const [browserCategory, chooseBrowserCategory] = useState<string | undefined>(restored?.browserCategory)
  const [nativeEditorReturn,setNativeEditorReturn]=useState<{workspaceId:string;accessEpoch:number;bindingId:string;expression_ref:string;scene_ref:string;centerPanel:string;detail:boolean;detailMode:DetailMode;editor:'source'|'layers'|'placement';owner:NativeEditorController|null;mode:'expressions'|'techne';focus:HTMLElement|null}|null>(null)
  useEffect(()=>setNativeEditorReturn(null),[workspace.workspaceId,workspace.accessEpoch])
  // Each frame's detail expansion and the height it returns to (shell/workspaceAreas.ts), dropped with the workspace or lease.
  const detailExpansions=useRef<DetailExpansions>({})
  useEffect(()=>{detailExpansions.current={}},[workspace.workspaceId,workspace.accessEpoch])
  // A resizer under the hand: where the drag began, so the part keeps the offset at which it was taken.
  const areaDrag=useRef<AreaDrag|null>(null)
  const [viewport, setViewport] = useState([window.innerWidth, window.innerHeight])
  useEffect(() => { const read = () => setViewport([window.innerWidth, window.innerHeight]); window.addEventListener('resize', read); return () => window.removeEventListener('resize', read) }, [])
  const [tab, setTab] = useState(restored?.tab ?? opening.tab)
  // The main area's view (manual §10.2, shell/mainView.ts): Session view and Arrangement view of the mode's set, or Pane view. A
  // saved view names the set's views as the centre `world.set`; any other saved centre is Pane view.
  useState(() => { showMainView(restored ? (restored.centerPanel === 'world.set' ? restored.tab ?? 'session' : 'pane') : opening.view); return true })
  const mainView = useMainView()
  // The set's presentation (Session or Arrangement), the tracks' own (projections/timelinePaneHost.ts).
  const timelinePane = useTimelinePanePresentation()
  // Each track's mixer row and its sections (manual §16.6: ⌥⌘M, ⌥⌘I, ⌥⌘S, ⌥⌘R; Mixer at the bottom right).
  const [mixer, setMixer] = useState(restored?.mixer ?? true)
  const [mixerHidden, setMixerHidden] = useState<Readonly<{io: boolean; sends: boolean; returns: boolean}>>({io: false, sends: false, returns: false})
  // The Factory centre is the Workbench's pane tree (agent/factoryCentre.ts); the retired agent centre and the knowledge
  // centre both restore to the Workbench, so no saved centre names a panel the mode does not stand.
  // The centre is the pane tree in every mode (FOUNDATION F2). Only the knowledge panel, the stage's large native editor and
  // Settings stand over it, and none of them is restored: a returning frame always opens on its panes.
  const workbenchCentre = (_panel: string | undefined): string => 'native.workbench'
  const [centerPanel, setCenterPanel] = useState(workbenchCentre(restored?.centerPanel) ?? opening.centerPanel)
  const [knowledgeIntent, setKnowledgeIntent] = useState<{workspaceId: string; bindingId: string} | null>(null)
  // A resolved file source from the hosted frame: the Workbench is presented first, then asked to open it (it acts only while presented).
  const [sourceIntent, setSourceIntent] = useState<{location: unknown; passage?: unknown; note?: unknown} | null>(null)
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
      presentSettings(false); setCenterPanel('native.workbench')
      if (retained.mode === 'expressions' || retained.mode === 'techne') continuity.setMode(retained.mode)
      openInstrument('projection.expressions')
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
    const present = (event: Event) => {
      const detail = (event as CustomEvent<{location?: unknown; passage?: unknown; note?: unknown}>).detail
      if (!detail?.location) return
      presentSettings(false); setCenterPanel('native.workbench'); setSourceIntent({location: detail.location, passage: detail.passage, note: detail.note})
    }
    window.addEventListener(SOURCE_PRESENT, present)
    return () => window.removeEventListener(SOURCE_PRESENT, present)
  }, [])
  useEffect(() => {
    // After the commit that presents the Workbench, its receiver is live: hand it the source once.
    if (!sourceIntent || centerPanel !== 'native.workbench') return
    window.dispatchEvent(new CustomEvent('oi:epi-open-source', {detail: {location: sourceIntent.location, passage: sourceIntent.passage, note: sourceIntent.note}}))
    setSourceIntent(null)
  }, [sourceIntent, centerPanel])
  useEffect(() => {
    // Only the Expressions panel requests this, and only with native work
    // mounted: the centre shows that body in the cut the workspace stands in.
    const reveal = () => {presentSettings(false); setCenterPanel('native.workbench'); continuity.setMode(workspace.mode === 'techne' ? 'techne' : 'expressions'); openInstrument('projection.expressions')}
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
  const [browser, setBrowser] = useState(restored?.browser ?? opening.browser)
  // The pool under the browser (manual §16.7): your workspaces, and in Live the set's grooves. ⌥⌘6 shows or hides it. A device chosen
  // on a chain or in the browser never fills it, and never opens the browser: a device stands whole in its band above the chain.
  const [pool, setPool] = useState(true)
  useEffect(() => {
    const browseParameters = () => {
      if (workspace.mode === 'audio') return
      setBrowser(true)
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.world-browser-search input')?.focus())
    }
    window.addEventListener(PARAMETER_BROWSE_EVENT, browseParameters)
    return () => window.removeEventListener(PARAMETER_BROWSE_EVENT, browseParameters)
  }, [workspace.mode])
  const [detail, setDetail] = useState(restored?.detail ?? opening.detail)
  const [detailConfiguration, configureDetail] = useState<NativeDetailConfigurationIntent | null>(null)
  // The selected ground subject (the browser's Days/Files rows select it) is THE selection when it is ground material:
  // the Document detail's aperture reads it from the world context, and choosing one moves the one selection.
  const worldSelection = continuity.current.context?.selection
  const centralSubject: CentralSubjectSelection | null = worldSelection && CENTRAL_SUBJECT_KINDS.has(worldSelection.kind)
    ? {kind: worldSelection.kind as CentralSubjectSelection['kind'], path: worldSelection.ref} : null
  const selectCentralSubject = (subject: CentralSubjectSelection | null) => continuity.select(subject
    ? {mode: 'base', kind: subject.kind, ref: subject.path, title: subjectWords(subject.path)} : null)
  // The Session · Arrangement pane's material is the mode's registration (shell/modeFrames.ts), never a branch here.
  const tracks = MODE_TRACK_SOURCES[frameMode]
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
  const nativeView = (_view: 'session' | 'arrangement' | 'expressions'): NativeCompositionViewSource | undefined => {
    // The native composition sources belong to the Expressions and Technē
    // cuts; Live, Base·Central and Factory present through their own
    // content (the audio cut, the World cut, the agency surface).
    if (workspace.mode !== 'expressions' && workspace.mode !== 'techne') return undefined
    const epoch = presentation.current.epoch
    const isPresented = () => {
      const current = presentation.current
      return current.epoch === epoch && !current.settingsPresented && current.mode !== 'audio' && workspace.nativeAccessCurrent(current.accessEpoch)
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
  const chooseView = (view: MainView) => {
    // Session view and Arrangement view are two views of the mode's set, and Pane view holds the panes (manual §10.2). Switching
    // changes only what is seen: the selection and what runs stay as they are.
    if (view !== 'pane') setTab(view)
    showMainView(view)
  }
  /** Enter a surf mode (Rev 5): one encounter transition over the spine —
   * mode and world context ride the one book (the bridge publishes both);
   * no surface closes, every resident stays mounted-concealed. The right
   * dock is part of the frame in every mode (Rev 4): entering a ground or
   * agency mode opens it — an opening, never a closing. */
  const chooseMode = (next: SurfMode) => {
    presentSettings(false)
    continuity.setContext(context => ({...context, world: next === 'base' ? 'central' : undefined}))
    // The mode's own frame returns with its layout (the restore below); nothing here sets another mode's parts.
    continuity.setMode(next === 'live' ? 'audio' : next)
  }
  // The Library page's workspace-mode request, relayed by LibraryHost on oi:host-workspace-mode. The mode switch is the mode rail's
  // own (chooseMode). The one open door (workspace.expressionToOpen) carries two request kinds: a kernel ref (requestExpression), or,
  // for an id-only request (Open browser draft), a browser-local draft by its Library id (requestLocalDraft). A ref wins when both come.
  const chooseModeRef = useRef(chooseMode), requestExpressionRef = useRef(workspace.requestExpression), requestLocalDraftRef = useRef(workspace.requestLocalDraft)
  chooseModeRef.current = chooseMode
  requestExpressionRef.current = workspace.requestExpression
  requestLocalDraftRef.current = workspace.requestLocalDraft
  useEffect(() => {
    const onHostMode = (event: Event) => {
      const request = workspaceModeDetail((event as CustomEvent<unknown>).detail)
      if (!request) return
      chooseModeRef.current(request.mode)
      if (request.ref !== undefined) requestExpressionRef.current(request.ref)
      else if (request.id !== undefined && request.mode === 'expressions') requestLocalDraftRef.current(request.id)
    }
    window.addEventListener('oi:host-workspace-mode', onHostMode)
    return () => window.removeEventListener('oi:host-workspace-mode', onHostMode)
  }, [])
  const [dock, setDock] = useState(restored?.dock ?? opening.dock)
  // Live's selection is THE selection when it is a place in the open set; otherwise Live keeps the place it last held
  // (its view's remembered selection), so returning to Live returns to it.
  const [liveHeld, holdLive] = useState<SetSelection>(restored?.selection ?? { track: 0, scene: null })
  const selection: SetSelection = setSelectionOf(worldSelection, state.set?.path) ?? liveHeld
  const select = (value: SetSelection) => { holdLive(value); const next = liveWorldSelection(value, state.set); if (next) continuity.select(next) }
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
    if (selectedSet.current && selectedSet.current !== state.set.path) holdLive({track: 0, scene: null})
    selectedSet.current = state.set.path
  }, [state.set?.path])
  useEffect(() => {
    if (restoredKey === restoreKey) return
    const view = continuity.applicationView
    // The open set stays open across modes: a mode with no view of its own keeps the set in hand.
    restorePath({workspaceId: workspace.workspaceId, path: view && view.alsPath !== undefined ? view.alsPath : state.path ?? undefined})
    const intent = centreIntent.current?.key === frameKey ? centreIntent.current : null
    centreIntent.current = null
    // One presentation (R2 objection 2): the tracks pane presents what the mode's frame restores, so Tab, the transport and
    // the pane never disagree.
    const presentation = intent?.tab ?? view?.tab ?? opening.tab
    const standing: MainView = intent ? intent.tab ?? 'pane' : view ? (view.centerPanel === 'world.set' ? presentation : 'pane') : opening.view
    setTab(presentation); setTimelinePanePresentation(presentation); showMainView(standing); setCenterPanel(intent?.panel ?? workbenchCentre(view?.centerPanel) ?? opening.centerPanel)
    setMixer(view?.mixer ?? true)
    changeDetailMode(view?.detailMode ?? opening.detailMode); resizeBrowser(view?.browserWidth ?? null); resizeDetail(enteredDetailHeight(detailExpansions.current, frameKey, view?.detailHeight ?? null, viewport[1]))
    chooseBrowserCategory(view?.browserCategory)
    setBrowser(view?.browser ?? opening.browser); setDetail(view?.detail ?? opening.detail); setDock(view?.rail ? view.dock ?? opening.dock : opening.dock)
    holdLive(view?.selection ?? {track: 0, scene: null}); presentSettings(view?.settingsPresented ?? false)
    if (view?.alsPath !== undefined) selectedSet.current = view.alsPath ?? null
    setRestoredKey(restoreKey)
  }, [restoreKey, restoredKey, continuity.applicationView])
  useEffect(() => {
    if (restoredKey !== restoreKey) return
    continuity.checkpointApplicationView({alsPath: state.path ?? restored?.alsPath ?? undefined, rail: true, tab: timelinePane, selection: liveHeld, browserCategory,
      browser, detail:nativeEditorPresented?nativeEditorReturn!.detail:detail, dock, browserWidth, detailHeight:keptDetailHeight(detailExpansions.current,frameKey,detailHeight), centerPanel:mainView !== 'pane' ? 'world.set' : nativeEditorPresented?nativeEditorReturn!.centerPanel:centerPanel, detailMode:nativeEditorPresented?nativeEditorReturn!.detailMode:detailMode, settingsPresented, settingsReturn: workspace.mode === 'expressions' || workspace.mode === 'techne' ? workspace.mode : undefined, mixer})
  }, [restoredKey, restoreKey, state.path, timelinePane, mainView, mixer, liveHeld, browserCategory, browser, detail, dock, browserWidth, detailHeight, centerPanel, detailMode, nativeEditorReturn, nativeEditorPresented, settingsPresented, workspace.mode, continuity.checkpointApplicationView])
  // The view keys (manual §10.1, §10.8; shell/workspaceAreas.ts frameToggleOf, read by the key as well as its character — macOS
  // gives ⌥L as "¬"). They are the window's: taken before any pane's own keys (the Workbench's keymap binds ⌥⌘R to its layout
  // restore, desktop/cradle/src/surface/keys.ts:94; ⌥⌘R is Live's return tracks here), wherever the focus stands.
  const chord = useRef<(part: FrameToggle) => void>(() => {})
  chord.current = part => {
    if (part === 'detail') setDetail(current => !current)
    if (part === 'browser') setBrowser(current => !current)
    if (part === 'rail') setDock(current => !current)
    if (part === 'pool') setPool(current => { if (!current) setBrowser(true); return !current })
    if (part === 'clip' || part === 'device') {
      if (!detail) { changeDetailMode(part); setHiddenSides(hidden => ({...hidden, [part]: false})); setDetail(true) }
      else toggleDetailSide(part)
    }
    if (part === 'pane') { presentSettings(false); togglePaneView() }
    if (part === 'mixer') setMixer(current => !current)
    if (part === 'io' || part === 'sends' || part === 'returns') { setMixer(true); setMixerHidden(hidden => ({...hidden, [part]: !hidden[part]})) }
  }
  useEffect(() => {
    const onChord = (event: KeyboardEvent) => {
      const part = frameToggleOf(event)
      if (!part || event.repeat) return
      event.preventDefault(); event.stopPropagation()
      chord.current(part)
    }
    window.addEventListener('keydown', onChord, true)
    return () => window.removeEventListener('keydown', onChord, true)
  }, [])
  // The focus keys (Live 12's Move Focus, manual §10.2): ⌥ and a digit brings the part forward and gives it the keys.
  const focusPart = useRef<(target: FocusTarget) => void>(() => {})
  focusPart.current = target => {
    if (target === 'session' || target === 'arrangement' || target === 'pane') { presentSettings(false); chooseView(target) }
    if (target === 'clip' || target === 'device') { changeDetailMode(target); setHiddenSides(hidden => ({...hidden, [target]: false})); setDetail(true) }
    if (target === 'browser') setBrowser(true)
    if (target === 'pool') { setBrowser(true); setPool(true) }
    const region = target === 'session' || target === 'arrangement' ? 'set' : target
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-focus-region="${region}"]`)?.focus({preventScroll: true}))
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault()
        settingsOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        presentSettings(true)
        return
      }
      if (event.key === 'Escape' && settingsPresented && !event.defaultPrevented) { event.preventDefault(); returnFromSettings(); return }
      const target = event.target as HTMLElement
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return
      const focusTarget = focusKeyOf(event)
      if (focusTarget && !settingsPresented) { event.preventDefault(); focusPart.current(focusTarget); return }
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && !settingsPresented) {
        event.preventDefault(); tabMainView()
      }
      // ⇧Tab: Clip view ⇄ Device view (shell/workspaceAreas.ts), unless a control below already took it. While both stand it only
      // changes which side is kept in front if the area narrows (Live 12 cap 31); when one shows, the other takes its place.
      if (switchesDetailSide(event) && !event.defaultPrevented && !settingsPresented) { event.preventDefault(); changeDetailMode(side => side === 'clip' ? 'device' : 'clip'); setDetail(true) }
      // ⌥⌘E: Clip view in the main area, and back (Live's Expand Clip View, cap 29; frame/detail/detailSides.ts expandsClip).
      if (expandsClip(event) && !event.defaultPrevented && !settingsPresented) { event.preventDefault(); setClipExpanded(expanded => !expanded); setDetail(true) }
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
  // The mode system's frame readings (Rev 5): which presentation stands
  // (the encounter's, never a second store), what the World cut shows, and
  // the real readings the mode transport may wear.
  // Factory is the agent shell's mode: its chrome (dock, status, transport, task log, agent Device side) stands over the Workbench
  // tree whose default tab is the agent surface (agent/factoryCentre.ts). The centre is that tree, not a separate panel.
  const agentShell = isFactoryMode(frameMode) && !settingsPresented
  // The pane the detail follows is the focused tab of the mode's pane tree (every mode, FOUNDATION F2).
  // Session view and Arrangement view stand for the set's tracks, whatever pane Pane view has focused; the large native editor
  // takes the main area from either (manual §10.2: only an expanded editor does).
  const setStands = mainView !== 'pane' && centerPanel !== 'world.expressions'
  const paneFocus = setStands ? {pane: 'projection.timeline', presentation: timelinePane} : factoryFocusedPane(focusedSurfaceKind(continuity.current.layout), timelinePane)
  // The World cut stands when the set's views show the civil field.
  const worldCut = tracks === 'world' && paneFocus.pane === 'projection.timeline'
  // Central's selection route (Central vertical, WORLD-SHELL-DESIGN §17.2): a Timeline clip in Base selects the ONE spine's
  // occasion, and that selection clears the browser's subject, so exactly one selection stands in the Document row
  // (CentralClipChooser). Technē and the other modes keep the World cut's view unchanged.
  const centralWorld: WorldTimelineView = frameMode === 'base'
    ? {...worldView, selectOccasion: event => { worldView.selectOccasion(event); if (centralSubject) selectCentralSubject(null) }}
    : worldView
  const presented = timelinePane
  // One presentation in every mode (the tracks pane's), Factory included: its centre is the shared grid beside the thread.
  const presentedView = presented
  // The focused pane's instrument (owner ruling, 13 Oct 2026): the Device side follows it in every mode but Live
  // (paneInstrument.ts). The instruments themselves open from the browser's Instruments group (frame/InstrumentsSection.tsx).
  const atlasView = useAtlasView()
  const focusedPane = settingsPresented ? 'world.settings' : setStands ? paneFocus.pane : centerPanel !== 'native.workbench' ? centerPanel : paneFocus.pane
  // The hosted Expressions lens the frame reports (publishReading, via the panel's onState). Null until it reports one.
  const hostedLens = workspace.reading?.lens ?? null
  // The stage's lens rows in the browser turn the stage through the retained-instrument event the expressions panel's
  // receiver handles, captured from the current native scope (never a stale copy); nothing here holds the host.
  useEffect(() => {
    publishStageLensDriver((lens, refused) => {
      try {
        const now = encounterSpine.current.workspace
        const detail: TechneInstrumentEvent = {...captureTechneInstrumentOpen({workspaceId: now.workspaceId, accessEpoch: now.accessEpoch, accessReady: now.accessReady, nativeAccessCurrent: now.nativeAccessCurrent, mode: now.mode, editorReading: now.editorReading}, lens as HostedLens),
          complete: result => { if (result.state === 'refused') refused(result.reason) }}
        window.dispatchEvent(new CustomEvent(TECHNE_INSTRUMENT_OPEN, {detail}))
        if (!detail.handled) refused('The Expressions stage is not mounted in this shell.')
      } catch (cause) { refused(cause instanceof Error ? cause.message : String(cause)) }
    })
    return () => publishStageLensDriver(null)
  }, [])
  const focusedInstrument = deviceInstrumentFor(frameMode, focusedPane, paneFocus.presentation, atlasView, hostedLens)
  // The civil field's readouts the transport wears while a mode's tracks are the World cut.
  const modeReadouts: ModeTransportReadouts | undefined = tracks === 'world' ? {
    position: worldNowReadout(worldView),
    link: workspace.transport.kind === 'unavailable'
      ? {value: '—', title: `The kernel carrier is unavailable: ${workspace.transport.reason}`}
      : {value: carrierOf(workspace.transport), title: `The kernel carrier (${carrierOf(workspace.transport)}) serves the ground`},
  } : undefined
  // The Timeline pane's reading (T-FACTORY-TIMELINE-PANE): the props the World cut's residence reads, published through the host door
  // (projections/timelinePaneHost.ts). The pane body renders them; nothing here is copied into a second store.
  // The shared Session and Arrangement select through THE selection (F1): a Live place also moves Live's held selection, and
  // a World cut clip stands its event on the spine, as the World cut's own selection did.
  const selectTrackItem = (target: {kind: 'clip' | 'track'; ref: string; title: string; track?: string}) => {
    // A day record on Central's Day track is ground material: it opens as the browser's Days row does.
    const subject = target.kind === 'clip' ? centralSubjectOfClip(target.ref) : null
    if (subject) { selectCentralSubject(subject); return }
    const next = {mode: (continuity.current.layout.mode ?? 'base') as WorldSelection['mode'], kind: target.kind, ref: target.ref, title: target.title, track: target.track}
    const live = setSelectionOf(next, state.set?.path)
    if (live) { holdLive(live); changeDetailMode(target.kind === 'clip' ? 'clip' : 'device') }
    const event = worldView.source.eventByClipId.get(target.ref)
    if (event) centralWorld.selectOccasion(event)
    continuity.select(next)
  }
  // The widget rail's book: the world's one open set, pins, presets and width (desktop/cradle/src/workspace/store.ts).
  // What the window draws now, read where a resize starts or a part's bound depends on another (the parts' own boxes).
  const shownBox = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
  const shownBrowserWidth = () => shownBox('.browser-residence:not([hidden]) .one-browser')?.width ?? browserWidth ?? 430
  const shownRailWidth = () => shownBox('.dock-residence:not([hidden]) .widget-rail')?.width ?? 0
  const shownDetailHeight = () => shownBox('.detail-residence:not([hidden]) > .detail-host')?.height ?? detailHeight ?? 330
  // The rail widens and narrows by its edge within its bounds and what the browser and the panes leave (shell/workspaceAreas.ts).
  const widgetBook: WidgetRailBook = {rail: continuity.current.widgets ?? {open: DEFAULT_WIDGETS}, toggle: id => continuity.toggleWidgetOpen(id, DEFAULT_WIDGETS),
    pin: continuity.pinWidgetAt, savePreset: name => continuity.saveWidgets(name, DEFAULT_WIDGETS), applyPreset: continuity.applyWidgets, widen: width => continuity.widenWidgets(clampRailWidth(width, viewport[0], browser ? shownBrowserWidth() : 0))}
  // A chat dragged onto the rail reopens, and its agent's tile opens holding it (DLW §19.1; agent/factoryChatsRail.tsx).
  const chatRailDrop = useChatRailDrop(widgetBook)
  // The one browser's row sources (shell/modeBrowsers.tsx) and what their bodies read.
  const browserSources = useMemo(() => browserSourcesOf(frameMode), [frameMode])
  const browserReading: BrowserReading = {mode: frameMode, ctx, defaultSet: config?.default_set ?? '', selectSubject: selectCentralSubject,
    selectedSubject: centralSubject, agency: {rows: agency.rows, error: agency.error, loading: agency.loading}}
  usePublishTimelineReading({set: state.set, document: deep.document, selection, select: choose, colors, setColor, mode: frameMode,
    world: tracks === 'world' ? centralWorld : undefined, spine: worldView.spine, journey: tracks === 'world' ? {openExpression: workspace.requestExpression} : undefined,
    session: tracks === 'native' ? nativeView('session') : undefined, arrangement: tracks === 'native' ? nativeView('arrangement') : undefined,
    native: tracks === 'native' ? nativeProjection.content : undefined, workName: workspace.reading?.document?.name,
    selectedRef: worldSelection?.ref, selectTrackItem, transport: workspace.transport,
    waiting: tracks === 'native' ? (nativeProjection.error ?? 'Open an Expression to see it as a track, its scenes as clips.') : tracks === 'set' ? 'Open a Live set from the browser to see its tracks.' : (worldView.source.error ?? 'The day\'s tracks arrive when the kernel\'s temporal read answers.')})
  // The Factory pane holding the one Expressions frame, if any (T-EXPRESSIONS-PANE-LEASE): the centre residence is then placed, not hidden.
  const framePlacement = useFramePlacement()
  // The one stage frame is placed over the pane that holds it, in every mode — unless the large native editor holds the centre.
  const expressionsPlaced = framePlacement !== null && centerPanel !== 'world.expressions'
  // The stage placed over its pane shows only while Pane view stands; it stays mounted under the set's views, still playing.
  const stageShown = mainView === 'pane'
  const detailFrame = () => ({frame: frameKey, workspaceId: workspace.workspaceId, accessEpoch: workspace.accessEpoch})
  const detailReading: DetailReading = {
    mode: frameMode, transport: workspace.transport, world: worldView, worldCut, centralSubject, worldSubject: worldSubjectOf(worldSelection), focusedInstrument,
    live: {ctx, document: deep.document, selection},
    native: {configurationIntent: detailConfiguration, presentMode: mode => {changeDetailMode(mode); setDetail(true)}, presentNativeEditor,
      expand: () => {detailExpansions.current=expandDetail(detailExpansions.current,detailFrame(),detailHeight);resizeDetail(expandedDetailHeight(viewport[1]))},
      collapse: () => {const {held,restore}=collapseDetail(detailExpansions.current,detailFrame());detailExpansions.current=held;if(restore)resizeDetail(restore.height)}},
    factory: {tracks: agency.tracks},
  }
  // The bottom right (manual §10.1): Clip and Device bring their view forward, ▲ beside each shows or hides it, ⌥-click shows both;
  // Mixer shows or hides every track's mixer row. Each switch carries what its view holds: the selected clip, the selected track.
  // The track's name is read where it is drawn (the status bar reads the tracks the set's views publish): the frame never subscribes
  // to that publication, since the frame's own render republishes the reading those views draw from.
  const statusSwitches = {
    detailShown: detail, mixer, toggleMixer: () => setMixer(current => !current),
    clipName: worldSelection?.kind === 'clip' ? worldSelection.title : undefined,
    trackName: worldSelection?.kind === 'track' ? worldSelection.title : undefined,
    trackRef: worldSelection?.kind === 'track' ? worldSelection.ref : worldSelection?.track,
    clipRef: worldSelection?.kind === 'clip' ? worldSelection.ref : undefined,
    bringSide: (side: 'clip' | 'device', both: boolean) => {
      setDetail(true); changeDetailMode(side)
      setHiddenSides(hidden => both ? {clip: false, device: false} : {...hidden, [side]: false})
    },
    hideDetail: () => setDetail(false),
  }
  const frameBody = (<>
    {/* The frame's keys (F9): Space, Esc, ⌘F, the row and macro keys, Enter and ⌥Enter — through the controls' own doors. */}
    <FrameKeys paused={settingsPresented} focusedGroupId={continuity.current.layout.focusedGroupId} revealBrowser={() => setBrowser(true)} />
    {/* Your system's readings (T-WORLDS §5 W3): read while an Earth stands, whichever pane holds it. They stand here, in the shell's
        own tree, because the Earth's pane is a projection module drawn in a root of its own, without the workspace they read through
        (r18: the system was never read, so no world but yours was drawn and none could land). */}
    {atlas && <Suspense fallback={null}><SystemReadings /></Suspense>}
    {<TransportBar tempoBpm={state.set?.tempo_bpm ?? null} name={state.set?.path.split('/').pop()?.replace(/\.als$/i, '') ?? ''} mode={frameMode} view={mainView} setView={view => { presentSettings(false); chooseView(view) }} chooseMode={chooseMode} modeReadouts={modeReadouts} timeSpine={worldView.spine} focusedInstrument={focusedInstrument} workName={workspace.reading?.document?.name} sceneName={workspace.reading?.sceneName} nativeTransport={nativeView('expressions')} browser={browser} dock={dock} toggleBrowser={() => setBrowser(!browser)} toggleDock={() => setDock(!dock)} />}
    {/* The one browser (F6): the mode's row sources and the shared ones, under one search, grouped by the four kinds. */}
    <NativeInputRetentionProvider><div className="browser-residence" hidden={!browser}><BrowserReadingProvider value={browserReading}><Browser key={frameMode} sources={browserSources} category={browserCategory} onCategory={chooseBrowserCategory} pool={pool} poolFace={MODE_POOL_FACES[frameMode]?.({setPath: state.set?.path ?? null}) ?? null} /></BrowserReadingProvider></div>
    {browser && <div className="browser-resizer" role="separator" aria-label="Resize browser" aria-orientation="vertical" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); resizeBrowser(clampBrowserWidth(shownBrowserWidth() + (event.key === 'ArrowRight' ? RESIZE_STEP : -RESIZE_STEP), viewport[0], shownRailWidth()))} }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); areaDrag.current = {at: event.clientX, size: shownBrowserWidth()} }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId) && areaDrag.current) resizeBrowser(clampBrowserWidth(draggedSize(areaDrag.current, event.clientX, 1), viewport[0], shownRailWidth())) }} onPointerUp={() => { areaDrag.current = null }} />}
    <main className="center" data-main-view={mainView}><div className={`center-body${nativeEditorReturn&&centerPanel==='world.expressions'&&!settingsPresented?' native-editor-residence':''}`}>
      {nativeEditorReturn&&centerPanel==='world.expressions'&&!settingsPresented&&<div className="native-editor-return"><span>{nativeEditorReturn.editor==='source'?'Source':nativeEditorReturn.editor==='layers'?'Layers':'State placement'}</span><button onClick={returnNativeEditor}>Return to {nativeEditorReturn.centerPanel==='native.arrangement'?'Arrangement':nativeEditorReturn.centerPanel==='native.session'?'Session':'Glyph editor'}</button></div>}
      {tracks === 'native' && !settingsPresented && nativeProjection.error && <div className="native-composition-fault" role="alert">{nativeProjection.error}</div>}
      {/* Session view and Arrangement view (manual §10.2): the mode's set, drawn in the main area, never in a pane. */}
      <div className="set-view-residence" data-focus-region="set" tabIndex={-1} hidden={!setStands}><TracksPane /></div>
      {/* Pane view: the pane tree and what stands over it. The large native editor takes the main area from any view. */}
      {panels.filter(panel => panel.id !== 'world.settings').map(panel => { const Panel = panel.component; const placed = expressionsPlaced && panel.id === 'world.expressions'; const editor = panel.id === 'world.expressions' && centerPanel === 'world.expressions'
        return <div className={`inhabitant${panel.id === 'world.expressions' ? ' native-stage-residence' : ''}${frameMode === 'live' && panel.id === 'world.expressions' ? ' live-centre-torus' : ''}`} style={placed ? PLACED_RESIDENCE_STYLE : undefined} data-focus-region={panel.id === 'native.workbench' ? 'pane' : undefined} tabIndex={panel.id === 'native.workbench' ? -1 : undefined}
          hidden={placed ? !stageShown : centerPanel !== panel.id || (mainView !== 'pane' && !editor)} key={panel.id}><Panel {...ctx} /></div> })}
    </div></main>
    {/* Settings open in a window of their own (manual §10.1, ⌘, as Live's Preferences; panels/settings.tsx draws it over the frame);
      the main area keeps its view behind it. */}
    {panels.filter(panel => panel.id === 'world.settings').map(panel => { const Panel = panel.component
      return <div className="inhabitant settings-residence" hidden={!settingsPresented} key={panel.id}><Panel {...ctx} /></div> })}
    {/* Rev 4's dock per mode: the mode context dock (tiles above, launcher
      below, the wedge that dies with the toggle) carries the non-agency
      modes; the agency surface keeps its own dock. */}
    {/* The one widget rail (F8): every widget of the world, one open set in the book, pins and presets. */}
    <div className="dock-residence" hidden={!dock}><WidgetReadingProvider value={{mode: frameMode, world: worldView, transport: workspace.transport, subject: centralSubject, panel: ctx}}>
      <RailDevices /><WidgetRail widgets={worldWidgets()} book={widgetBook} selectionRef={worldSelection?.ref ?? null} drop={chatRailDrop} /></WidgetReadingProvider></div>
    {detail && <div className="detail-resizer" role="separator" aria-label="Resize detail" aria-orientation="horizontal" tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {event.preventDefault(); resizeDetail(clampDetailHeight(shownDetailHeight() + (event.key === 'ArrowUp' ? RESIZE_STEP : -RESIZE_STEP), viewport[1]))} }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); areaDrag.current = {at: event.clientY, size: shownDetailHeight()} }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId) && areaDrag.current) resizeDetail(clampDetailHeight(draggedSize(areaDrag.current, event.clientY, -1), viewport[1])) }} onPointerUp={() => { areaDrag.current = null }} />}
    {/* The detail row (manual §3, §10.1; FOUNDATION F4): one host for every mode. The mode's clip editor and chain come from
      its registration (shell/modeDetails.tsx); a pane holding an instrument takes the Device side in every mode but Live. */}
    <div className="detail-residence" hidden={!detail}><DetailContext.Provider value={detailReading}><DetailHost sides={{front: detailMode, hidden: hiddenSides}} expanded={clipExpanded} /></DetailContext.Provider></div></NativeInputRetentionProvider>
    {/* A device's expanded view: a band across the detail area above the chain (frame/devices/DeviceFlip.tsx). */}
    <DeviceFlipHost />
    {agentShell ? <AgentStatusBarBridge {...statusSwitches} detailMode={detailMode} changeDetailMode={mode => {changeDetailMode(mode); setDetail(true)}} toggleDetailSide={toggleDetailSide} audio={frameMode === 'live'} mode={frameMode} reading={workspace.reading} state={state} documentError={deep.error} viewport={viewport} selectedTrack={agency.tracks[0]?.purpose ?? undefined} presentedView={presentedView} subjectLabel={frameMode === 'base' && centralSubject ? centralSubject.path : undefined} /> : <StatusBar {...statusSwitches} detailMode={detailMode} changeDetailMode={mode => {changeDetailMode(mode); setDetail(true)}} toggleDetailSide={toggleDetailSide} audio={frameMode === 'live'} mode={frameMode} reading={workspace.reading} state={state} documentError={deep.error} viewport={viewport} selectedTrack={state.set?.tracks[selection.track]?.name} presentedView={presentedView} subjectLabel={frameMode === 'base' && centralSubject ? centralSubject.path : undefined} />}
  </>)
  // Each part at the size chosen for it, held inside the window as it stands (a smaller window never pushes the rail off its edge).
  const drawn = drawnSizes({browserW: browserWidth, railW: continuity.current.widgets?.width ?? null, detailH: detailHeight}, {browser, rail: dock}, [viewport[0], viewport[1]], 300)
  return <div ref={frameRef} style={{ ...(drawn.browserW === null ? {} : { '--browser-w': `${drawn.browserW}px` }), ...(drawn.detailH === null ? {} : { '--detail-h': `${drawn.detailH}px` }), ...(drawn.railW === null ? {} : {'--dock-w': `${drawn.railW}px`}) } as CSSProperties} className={`frame mode-${workspace.mode}${browser ? '' : ' browser-hidden'}${detail ? '' : ' detail-hidden'}${mixer ? '' : ' mixer-hidden'}${mixerHidden.io ? ' io-hidden' : ''}${mixerHidden.sends ? ' sends-hidden' : ''}${mixerHidden.returns ? ' returns-hidden' : ''}${dock ? ' dock-open' : agentShell ? ' no-dock' : ''}${agentShell ? ' agent-shell-frame' : ''}`} data-agent-shell={agentShell ? 'true' : undefined}>{frameBody}{unlinkedSubject && <p role="status" data-region="encounter-link" style={{position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10000, margin: 0, padding: '8px 16px', font: '13px system-ui, sans-serif', background: 'Canvas', color: 'CanvasText', borderTop: '1px solid GrayText'}}>The linked subject {unlinkedSubject} could not be opened here; the rest of the link is applied. <button type="button" onClick={() => setUnlinkedSubject(null)}>Dismiss</button></p>}</div>
}

function AgentStatusBarBridge(props: ComponentProps<typeof StatusBar>) {
  const {statusInfo} = useAgentShell()
  return <StatusBar {...props} agentInfo={statusInfo} />
}


