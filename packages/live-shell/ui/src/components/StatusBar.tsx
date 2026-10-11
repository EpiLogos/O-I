import type { UseSet } from '../shell/useSet'
import type { HostedAppState } from '@epilogos/expressions-boundary'
import type { DetailMode } from './DeviceChainPanel'
import { detailPairOf, MODE_GRAMMAR, surfModeOf } from '../shell/modeGrammar'
import {Icon} from './Icon'
export function StatusBar({ state, documentError, viewport, selectedTrack, audio, mode, reading, detailMode, changeDetailMode, agentInfo, presentedView, subjectLabel }: { state: UseSet; documentError: string | null; viewport: number[]; selectedTrack?: string; audio: boolean; mode: string; reading: HostedAppState | null; detailMode: DetailMode; changeDetailMode: (mode: DetailMode) => void; agentInfo?: { label: string; fn: string } | null; /** The presentation that stands — the status identity is per presented view (the mockup's status line). */ presentedView?: 'session' | 'arrangement' | null; /** The Base mode's selected ground subject — the Document detail's aperture. */ subjectLabel?: string }) {
  const { set, path, error, loading } = state
  // The detail row's pair is per mode (WORLD-SHELL-DESIGN Rev 4): Clip |
  // Device in Live, Document | Devices in Base·Central, Task log | Agent
  // chain in Factory, Scene | Studio in Expressions, Clip | Instruments in
  // Technē. The switch is still the only "tab" over the detail area.
  const pair = detailPairOf(mode) ?? detailPairOf('audio')!
  // The status identity is per mode (the audit's finding: Base·Central must
  // not say "Expressions"): the presented centre composition names what the
  // frame holds — Live keeps the audio set line, Expressions the open work.
  const surf = surfModeOf(mode)
  const centreIdentity = !audio && surf && surf !== 'expressions'
    ? MODE_GRAMMAR[surf].centre[presentedView ?? 'session']
    : null
  return <footer className="statusbar" data-region="status-bar" role="status" title={`Viewport ${viewport[0]} × ${viewport[1]} · ${audio ? documentError ?? 'Summary and deep document readings' : reading?.nativeScene?.expression_ref ?? 'Native Expressions owner'} `}>
    <span className="statusbar-info">i</span>{agentInfo && <span className="statusbar-agent-info" data-region="agent-status-info"><b>{agentInfo.label}</b>{agentInfo.fn}</span>}<span className="statusbar-path" title={audio ? path ?? undefined : reading?.nativeScene?.scene_ref}>{audio ? error ? <span className="statusbar-error">Open failed: {error}</span> : loading ? 'Opening…' : set ? set.path : 'No set open' : centreIdentity ? <><b>{centreIdentity.label}</b>{` — ${centreIdentity.meaning}`}{subjectLabel ? <span className="statusbar-subject" title={subjectLabel}>{` · ${subjectLabel}`}</span> : null}</> : reading?.document?.name ?? 'Expressions'}</span>
    {audio && documentError && <span className="statusbar-error" title={documentError}>Document unavailable</span>}
    {audio && set && <span className="statusbar-counts">{set.tracks.length} tracks · {set.scene_count} scenes · {set.arrangement_clips} clips</span>}
    {/* The track slot: the armed audio track in Live, the selected ground subject in Base·Central —
      the Expressions reading's scene name stays Expressions' own (never another mode's identity). */}
    <span className="statusbar-track">{audio ? selectedTrack : centreIdentity ? (subjectLabel ?? '') : reading?.sceneName}</span>
    {!audio && surf === 'expressions' && reading?.sceneState && <span className="statusbar-counts" title="Current Scene snapshot; file-save standing appears in the native Save control">Snapshot: {reading.sceneState === 'Edited since save' ? 'edited' : reading.sceneState === 'Draft' ? 'none' : 'saved'}{reading.nativeScene ? ` · revision ${reading.nativeScene.revision}` : ''}</span>}
    <nav className="status-detail-views" aria-label="Detail view">
      <button aria-label={pair.clip.label} data-i={`${pair.clip.label}|${pair.clip.meaning}`} title={`${pair.clip.label} — ${pair.clip.meaning}`} aria-pressed={detailMode === 'clip'} onClick={() => changeDetailMode('clip')}><Icon name="set" size={12} /><span>{pair.clip.label}</span></button>
      <button aria-label={pair.device.label} data-i={`${pair.device.label}|${pair.device.meaning}`} title={`${pair.device.label} — ${pair.device.meaning}`} aria-pressed={detailMode === 'device'} onClick={() => changeDetailMode('device')}><Icon name="device" size={12} /><span>{pair.device.label}</span></button>
    </nav>
  </footer>
}
