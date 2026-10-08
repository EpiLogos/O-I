import {createContext, useContext, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react'
import {useDataIStatusInfo, type DataIStatusInfo} from './statusInfo'

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

export const EFFORT_STEPS: AgentEffort[] = ['low', 'medium', 'high', 'max']
export const QUANTIZE_STEPS: AgentQuantize[] = ['now', 'next tool', 'next turn']
export const TOKEN_SCOPES: AgentTokenScope[] = ['session', 'group', 'all']

export interface AgentShellState {
  centreView: AgentCentreView
  setCentreView: (view: AgentCentreView) => void
  selectedTrackId: string | null
  setSelectedTrackId: (id: string | null) => void
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

export function AgentShellProvider({children, frameRef}: {children: ReactNode; frameRef?: RefObject<HTMLElement | null>}) {
  const [centreView, setCentreView] = useState<AgentCentreView>('session')
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [threadTrackId, setThreadTrackId] = useState<string | null>(null)
  const [openTiles, setOpenTiles] = useState<AgentTileId[]>(['sessions'])
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
    toggleTile: id => setOpenTiles(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]),
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
  }), [centreView, selectedTrackId, threadTrackId, openTiles, dockWidth, dockFolded, effort, heartbeat, follow, steer, writeArm, handBackLit, loopOn, quantize, tokenScope, voiceArmed, capturing, tapNote, voiceNote, captureNote, captureLog, expandedDevice, telemetryOn, statusInfo])

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
