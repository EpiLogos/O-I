import {createContext, useContext, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react'
import {useDataIStatusInfo, type DataIStatusInfo} from './statusInfo'
import {useOptionalContinuity} from '../continuity/workspace'
import {parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {DEFAULT_WIDGETS} from '../shell/widgetDefaults'
import type {WorldSelection} from '../../../../../desktop/cradle/src/workspace/store'

export type AgentCentreView = 'session' | 'arrangement' | 'thread'
export type AgentEffort = 'low' | 'medium' | 'high' | 'max'
export type AgentQuantize = 'now' | 'next tool' | 'next turn'
export type AgentTokenScope = 'session' | 'group' | 'all'
export type AgentDeviceId = 'gateway' | 'agent' | 'skillset' | 'world' | 'git'

export type AgentTileId =
  | 'sessions'
  | 'terminal'
  | 'files'
  | 'web'
  | 'graph'
  | 'diff'
  | 'frames'
  | 'ledger'
  | 'approvals'
  | 'agents'

const AGENT_TILE_IDS: readonly AgentTileId[] = ['sessions', 'terminal', 'files', 'web', 'graph', 'diff', 'frames', 'ledger', 'approvals', 'agents']

export const EFFORT_STEPS: AgentEffort[] = ['low', 'medium', 'high', 'max']
export const QUANTIZE_STEPS: AgentQuantize[] = ['now', 'next tool', 'next turn']
export const TOKEN_SCOPES: AgentTokenScope[] = ['session', 'group', 'all']

export interface AgentShellState {
  centreView: AgentCentreView
  setCentreView: (view: AgentCentreView) => void
  selectedTrackId: string | null
  /** Moves THE selection (WorldContext.selection) to an agent session — never a store of this context's own. */
  setSelectedTrackId: (id: string | null, title?: string) => void
  threadTrackId: string | null
  openThread: (trackId: string | null) => void
  openTiles: AgentTileId[]
  toggleTile: (id: AgentTileId) => void
  dockWidth: number
  setDockWidth: (px: number) => void
  dockFolded: boolean
  setDockFolded: (v: boolean) => void
  effort: AgentEffort
  setEffort: (v: AgentEffort) => void
  heartbeat: boolean
  setHeartbeat: (v: boolean) => void
  follow: boolean
  setFollow: (v: boolean) => void
  steer: boolean
  setSteer: (v: boolean) => void
  writeArm: boolean
  setWriteArm: (v: boolean) => void
  handBackLit: boolean
  setHandBackLit: (v: boolean) => void
  loopOn: boolean
  setLoopOn: (v: boolean) => void
  quantize: AgentQuantize
  /** The direct setter (the interrupt-timing row's armed shell path —
   * `shell.setQuantize`); the transport's cycle routes through the
   * setter bridge, which dispatches the value to its carrier. */
  setQuantize: (v: AgentQuantize) => void
  cycleQuantize: () => void
  tokenScope: AgentTokenScope
  cycleTokenScope: () => void
  voiceArmed: boolean
  setVoiceArmed: (v: boolean) => void
  capturing: boolean
  setCapturing: (v: boolean) => void
  tapNote: string | null
  setTapNote: (v: string | null) => void
  voiceNote: string | null
  setVoiceNote: (v: string | null) => void
  captureNote: string | null
  setCaptureNote: (v: string | null) => void
  captureLog: string[]
  recordCapture: (label: string) => void
  expandedDevice: AgentDeviceId
  setExpandedDevice: (id: AgentDeviceId) => void
  telemetryOn: Record<string, boolean>
  toggleTelemetry: (trackId: string) => void
  /** Latest `data-i` pair the pointer entered inside the frame (status-bar info). */
  statusInfo: DataIStatusInfo | null
}

const Ctx = createContext<AgentShellState | null>(null)

const sessionOfSelection = (selection: WorldSelection | null | undefined): string | null => {
  if (!selection) return null
  if (selection.kind === 'agent-session') return selection.ref
  if (selection.mode !== 'factory') return null
  if (selection.kind === 'track') return selection.ref
  return selection.kind === 'clip' ? parseFactoryTaskRef(selection.ref)?.trackId ?? null : null
}

export function AgentShellProvider({children, frameRef}: {children: ReactNode; frameRef?: RefObject<HTMLElement | null>}) {
  const [centreView, setCentreView] = useState<AgentCentreView>('session')
  // The selected session is THE selection when it is one (FOUNDATION F1): read from the world context, written through
  // the book's one select, and so on the trail.
  // With no book mounted (a render test, a detached view) there is no world selection: the session choice is held here only.
  const continuity = useOptionalContinuity()
  const [unbooked, holdUnbooked] = useState<string | null>(null)
  const worldSelection = continuity?.current.context?.selection
  // The shared Session and Arrangement select Factory's sessions as tracks and their tasks as clips (frame/tracks): a task
  // selects its session, so the task log opens on it.
  const selectedTrackId = continuity ? sessionOfSelection(worldSelection) : unbooked
  const select = continuity?.select
  const setSelectedTrackId = (id: string | null, title?: string) => select
    ? select(id ? {mode: 'factory', kind: 'agent-session', ref: id, title: title ?? id} : null)
    : holdUnbooked(id)
  const [threadTrackId, setThreadTrackId] = useState<string | null>(null)
  // The tiles are widgets of the one rail (F8): open in the book's one open set for the whole world, so a terminal opened
  // here is still open in Central. With no book mounted the choice is held here only.
  const [unbookedTiles, setOpenTiles] = useState<AgentTileId[]>(['sessions'])
  const bookTiles = continuity?.current.widgets?.open ?? DEFAULT_WIDGETS
  const openTiles = continuity ? bookTiles.filter((id): id is AgentTileId => AGENT_TILE_IDS.includes(id as AgentTileId)) : unbookedTiles
  const [dockWidth, setDockWidth] = useState(300)
  const [dockFolded, setDockFolded] = useState(false)
  const [effort, setEffort] = useState<AgentEffort>('high')
  const [heartbeat, setHeartbeat] = useState(true)
  const [follow, setFollow] = useState(true)
  const [steer, setSteer] = useState(true)
  const [writeArm, setWriteArm] = useState(false)
  const [handBackLit, setHandBackLit] = useState(false)
  const [loopOn, setLoopOn] = useState(false)
  const [quantize, setQuantize] = useState<AgentQuantize>('next tool')
  const [tokenScope, setTokenScope] = useState<AgentTokenScope>('session')
  const [voiceArmed, setVoiceArmed] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [tapNote, setTapNote] = useState<string | null>(null)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const [captureNote, setCaptureNote] = useState<string | null>(null)
  const [captureLog, setCaptureLog] = useState<string[]>([])
  const [expandedDevice, setExpandedDevice] = useState<AgentDeviceId>('gateway')
  const [telemetryOn, setTelemetryOn] = useState<Record<string, boolean>>({})
  const nullFrameRef = useRef<HTMLElement | null>(null)
  const statusInfo = useDataIStatusInfo(frameRef ?? nullFrameRef)

  const value = useMemo<AgentShellState>(() => ({
    centreView, setCentreView,
    selectedTrackId, setSelectedTrackId,
    threadTrackId,
    openThread: id => { setThreadTrackId(id); if (id) setCentreView('thread') },
    openTiles,
    toggleTile: id => continuity ? continuity.toggleWidgetOpen(id, DEFAULT_WIDGETS) : setOpenTiles(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]),
    dockWidth, setDockWidth,
    dockFolded, setDockFolded,
    effort, setEffort,
    heartbeat, setHeartbeat,
    follow, setFollow,
    steer, setSteer,
    writeArm, setWriteArm,
    handBackLit, setHandBackLit,
    loopOn, setLoopOn,
    quantize,
    setQuantize,
    cycleQuantize: () => setQuantize(current => QUANTIZE_STEPS[(QUANTIZE_STEPS.indexOf(current) + 1) % QUANTIZE_STEPS.length]),
    tokenScope,
    cycleTokenScope: () => setTokenScope(current => TOKEN_SCOPES[(TOKEN_SCOPES.indexOf(current) + 1) % TOKEN_SCOPES.length]),
    voiceArmed, setVoiceArmed,
    capturing, setCapturing,
    tapNote, setTapNote,
    voiceNote, setVoiceNote,
    captureNote, setCaptureNote,
    captureLog,
    recordCapture: label => setCaptureLog(current => [...current, label].slice(-64)),
    expandedDevice, setExpandedDevice,
    telemetryOn,
    toggleTelemetry: trackId => setTelemetryOn(current => ({...current, [trackId]: !(current[trackId] !== false)})),
    statusInfo,
  }), [centreView, selectedTrackId, worldSelection, unbooked, threadTrackId, openTiles, dockWidth, dockFolded, effort, heartbeat, follow, steer, writeArm, handBackLit, loopOn, quantize, tokenScope, voiceArmed, capturing, tapNote, voiceNote, captureNote, captureLog, expandedDevice, telemetryOn, statusInfo])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAgentShell(): AgentShellState {
  const value = useContext(Ctx)
  if (!value) throw new Error('Agent shell context is unavailable outside native.agent.')
  return value
}

export function useAgentShellOptional(): AgentShellState | null {
  return useContext(Ctx)
}
