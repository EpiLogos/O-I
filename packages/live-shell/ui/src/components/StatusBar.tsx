import { useEffect, useState } from 'react'
import type { UseSet } from '../shell/useSet'
import type { HostedAppState } from '@epilogos/expressions-boundary'
import type { DetailMode } from './DeviceChainPanel'
import { detailPairOf, surfModeOf } from '../shell/modeGrammar'
import { MODE_STATUS } from '../shell/modeStatus'
import {Icon} from './Icon'
import {RunContextReading} from '../shell/runContext'
import {parseDataI, type DataIStatusInfo} from '../agent/statusInfo'
import {useFoundationPending} from '../native/foundationDoor'
import {apertureWords, useWorkbenchAperture} from '../native/workbenchDoor'

/** The Info line's words with nothing read yet (Live's Info view; the mockup's `#info`). */
export const INFO_IDLE = 'Hover anything to read what it does.'
/** …and while the native foundation reads the World (native/foundationDoor.ts): the sentence stands in the line, never over it. */
export const INFO_READING_WORLD = 'Reading the native World…'

/** What the Info line reads for the element the pointer entered: the nearest `data-i="label|function"` (the shell's one info
 * law, agent/statusInfo.ts `parseDataI`) or, failing one, the nearest title — its name before " — " in bold, the rest after.
 * Null where neither stands, so the last reading stays (the mockup's `#info` never clears). */
export function infoOf(element: Element): DataIStatusInfo | null {
  const holder = element.closest('[data-i]:not([data-i=""]),[title]:not([title=""])')
  if (!holder) return null
  const pair = parseDataI(holder.getAttribute('data-i'))
  if (pair) return pair
  const title = (holder.getAttribute('title') ?? '').trim()
  const cut = title.indexOf(' — ')
  if (cut > 0 && cut <= 48) return {label: title.slice(0, cut), fn: title.slice(cut + 3)}
  return {label: holder.getAttribute('aria-label') ?? '', fn: title}
}

/** Live's Info view over the whole window: one delegated `mouseover` reads what the pointer enters, at any depth. */
export function useInfoView(): DataIStatusInfo | null {
  const [info, setInfo] = useState<DataIStatusInfo | null>(null)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const over = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const read = infoOf(event.target)
      if (read) setInfo(read)
    }
    document.addEventListener('mouseover', over)
    return () => document.removeEventListener('mouseover', over)
  }, [])
  return info
}

export function StatusBar({ state, documentError, viewport, selectedTrack, audio, mode, reading, detailMode, changeDetailMode, agentInfo }: { state: UseSet; documentError: string | null; viewport: number[]; selectedTrack?: string; audio: boolean; mode: string; reading: HostedAppState | null; detailMode: DetailMode; changeDetailMode: (mode: DetailMode) => void; agentInfo?: { label: string; fn: string } | null; /** The presentation that stands (kept for the callers; the title line now names the work). */ presentedView?: 'session' | 'arrangement' | null; /** The Base mode's selected ground subject (kept for the callers; THE selection now stands in the title line). */ subjectLabel?: string }) {
  const { set, path, error, loading } = state
  const aperture = useWorkbenchAperture()
  // The detail row's pair is per mode (WORLD-SHELL-DESIGN Rev 4): Clip |
  // Device in Live, Document | Devices in Base·Central, Task log | Agent
  // chain in Factory, Scene | Studio in Expressions, Clip | Instruments in
  // Technē. The switch is still the only "tab" over the detail area.
  const pair = detailPairOf(mode) ?? detailPairOf('audio')!
  // What the status bar carries beside the Info line is each mode's registration (shell/modeStatus.ts), never a branch here:
  // Live's open set (its counts, the armed track), Expressions' Scene snapshot. The work's identity is the title line's
  // (components/TransportBar.tsx), as in the mockup.
  const surf = surfModeOf(mode)
  const status = surf ? MODE_STATUS[surf] : null
  // The Info view (manual §10.1: "Read what any control does"): the left of the bar reads whatever the pointer enters; idle,
  // it says how to use it — or, while the native World is read, says that instead.
  const hovered = useInfoView()
  const pending = useFoundationPending()
  const info = hovered ?? agentInfo ?? null
  // A work's Scene, by name — only while a native work stands: with none open the frame's own scene is no work's (seen on screen
  // 15 Oct: "1 · Origin" beside the Info line with no work open), as the snapshot beside it already is.
  const track = audio ? selectedTrack : status?.line === 'work' && reading?.nativeScene ? reading.sceneName : undefined
  return <footer className="statusbar" data-region="status-bar" role="status" title={`Viewport ${viewport[0]} × ${viewport[1]} · ${audio ? documentError ?? 'Summary and deep document readings' : reading?.nativeScene?.expression_ref ?? 'Native Expressions owner'} `}>
    <span className="statusbar-info">i</span>
    <div className="statusbar-info-line" data-region="info-view" data-info={info ? 'reading' : pending ? 'reading-world' : 'idle'}>{info
      ? <><b>{info.label}</b>{info.fn}</>
      : <><b>Info</b>{pending ? INFO_READING_WORLD : INFO_IDLE}</>}</div>
    {audio && error && <span className="statusbar-error" title={path ?? undefined}>Open failed: {error}</span>}
    {audio && !error && loading && <span className="statusbar-counts">Opening…</span>}
    {audio && documentError && <span className="statusbar-error" title={documentError}>Document unavailable</span>}
    {audio && set && <span className="statusbar-counts" title={set.path}>{set.tracks.length} tracks · {set.scene_count} scenes · {set.arrangement_clips} clips</span>}
    {track && <span className="statusbar-track" title={track}>{track}</span>}
    {!audio && status?.snapshot && reading?.sceneState && reading.nativeScene && <span className="statusbar-counts" title="Current Scene snapshot; file-save standing appears in the native Save control">Snapshot: {reading.sceneState === 'Edited since save' ? 'edited' : reading.sceneState === 'Draft' ? 'none' : 'saved'}{reading.nativeScene ? ` · revision ${reading.nativeScene.revision}` : ''}</span>}
    {aperture && <span className="statusbar-counts statusbar-aperture" data-i={`Aperture|${aperture.pinned ? 'panes pinned to their own subject' : 'every pane follows the shared encounter'} — ${aperture.panes} pane${aperture.panes === 1 ? '' : 's'} in the centre`}>{apertureWords(aperture)}</span>}
    {/* The run context stands in every mode: which world this shell runs in, from the host's own disclosure. */}
    <RunContextReading />
    <nav className="status-detail-views" aria-label="Detail view">
      {/* Clip | Device in every mode (manual §10.1, FOUNDATION F4), each side named as the mode names it (the mockup's DVN, :1643):
        Document | Devices, Task log | Agent chain, Scene | Studio, Clip | Instruments, Clip | Device — the mode's own registration
        (shell/modeGrammar.ts `detail`, Rev 4's table), never a branch here. */}
      <button aria-label={pair.clip.label} data-detail-side="clip" data-i={`${pair.clip.label}|${pair.clip.meaning}`} title={`${pair.clip.label} — ${pair.clip.meaning}`} aria-pressed={detailMode === 'clip'} onClick={() => changeDetailMode('clip')}><Icon name="set" size={12} /><span>{pair.clip.label}</span></button>
      <button aria-label={pair.device.label} data-detail-side="device" data-i={`${pair.device.label}|${pair.device.meaning}`} title={`${pair.device.label} — ${pair.device.meaning}`} aria-pressed={detailMode === 'device'} onClick={() => changeDetailMode('device')}><Icon name="device" size={12} /><span>{pair.device.label}</span></button>
    </nav>
  </footer>
}
