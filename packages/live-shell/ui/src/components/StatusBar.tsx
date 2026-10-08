import type { UseSet } from '../shell/useSet'
import type { HostedAppState } from '@epilogos/expressions-boundary'
import type { DetailMode } from './DeviceChainPanel'
import {Icon} from './Icon'
export function StatusBar({ state, documentError, viewport, selectedTrack, audio, reading, detailMode, changeDetailMode, agentInfo }: { state: UseSet; documentError: string | null; viewport: number[]; selectedTrack?: string; audio: boolean; reading: HostedAppState | null; detailMode: DetailMode; changeDetailMode: (mode: DetailMode) => void; agentInfo?: { label: string; fn: string } | null }) {
  const { set, path, error, loading } = state
  return <footer className="statusbar" data-region="status-bar" role="status" title={`Viewport ${viewport[0]} × ${viewport[1]} · ${audio ? documentError ?? 'Summary and deep document readings' : reading?.nativeScene?.expression_ref ?? 'Native Expressions owner'} `}>
    <span className="statusbar-info">i</span>{agentInfo && <span className="statusbar-agent-info" data-region="agent-status-info"><b>{agentInfo.label}</b>{agentInfo.fn}</span>}<span className="statusbar-path" title={audio ? path ?? undefined : reading?.nativeScene?.scene_ref}>{audio ? error ? <span className="statusbar-error">Open failed: {error}</span> : loading ? 'Opening…' : set ? set.path : 'No set open' : reading?.document?.name ?? 'Expressions'}</span>
    {audio && documentError && <span className="statusbar-error" title={documentError}>Document unavailable</span>}
    {audio && set && <span className="statusbar-counts">{set.tracks.length} tracks · {set.scene_count} scenes · {set.arrangement_clips} clips</span>}
    <span className="statusbar-track">{audio ? selectedTrack : reading?.sceneName}</span>
    {!audio && reading?.sceneState && <span className="statusbar-counts" title="Current Scene snapshot; file-save standing appears in the native Save control">Snapshot: {reading.sceneState === 'Edited since save' ? 'edited' : reading.sceneState === 'Draft' ? 'none' : 'saved'}{reading.nativeScene ? ` · revision ${reading.nativeScene.revision}` : ''}</span>}
    <nav className="status-detail-views" aria-label="Detail view"><button aria-label="Clip details" title="Clip details" aria-pressed={detailMode === 'clip'} onClick={() => changeDetailMode('clip')}><Icon name="set" size={12} /><span>Clip</span></button><button aria-label={audio ? 'Track effect chain' : 'Native device chain'} title={audio ? 'Track effect chain' : 'Native device chain'} aria-pressed={detailMode === 'device'} onClick={() => changeDetailMode('device')}><Icon name="device" size={12} /><span>Device</span></button></nav>
  </footer>
}
