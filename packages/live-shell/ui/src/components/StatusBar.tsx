import {refusalWords} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
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
import {useShownSides, type DetailSide} from '../frame/detail/detailSides'
import {useShownTracks} from '../frame/tracks/tracksDoor'

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

/** The bottom right's switches (manual §10.1), as the frame feeds them: whether the detail area stands, the mixer's switch, what
 * each view holds now (the selected clip, the selected track), bringing a view forward (⌥-click: both), and hiding the area. */
export interface StatusSwitches {
  detailShown?: boolean
  mixer?: boolean
  toggleMixer?: () => void
  clipName?: string
  /** The selected track's name where the frame knows it (Live's set; a selected track's own title). */
  trackName?: string
  /** The selected track, or the selected clip, by ref: its name is read from the tracks the set's views draw. */
  trackRef?: string
  clipRef?: string
  bringSide?: (side: DetailSide, both: boolean) => void
  hideDetail?: () => void
}

export function StatusBar({ state, documentError, viewport, selectedTrack, audio, mode, reading, changeDetailMode, toggleDetailSide, agentInfo, detailShown = true, mixer, toggleMixer, clipName, trackName, trackRef, clipRef, bringSide, hideDetail }: StatusSwitches & { state: UseSet; documentError: string | null; viewport: number[]; selectedTrack?: string; audio: boolean; mode: string; reading: HostedAppState | null; detailMode: DetailMode; changeDetailMode: (mode: DetailMode) => void; /** Show or hide one side of the detail area (manual §16.4: "Hide either one … or the switches in the status bar"); absent, a switch brings its side to the front. */ toggleDetailSide?: (side: DetailSide) => void; agentInfo?: { label: string; fn: string } | null; /** The presentation that stands (kept for the callers; the title line now names the work). */ presentedView?: 'session' | 'arrangement' | null; /** The Base mode's selected ground subject (kept for the callers; THE selection now stands in the title line). */ subjectLabel?: string }) {
  const { set, path, error, loading } = state
  // The bar's open line says the place's words (shared/Refusal.tsx refusalWords); the raw cause goes to the console.
  useEffect(() => { if (audio && error) console.warn('The set did not open:', error) }, [audio, error])
  const aperture = useWorkbenchAperture()
  // The detail area's two switches read Clip | Device in every mode (FOUNDATION F4; manual §16.4); what each side holds in this mode
  // is the mode's own registration (WORLD-SHELL-DESIGN Rev 4's pair: Document | Devices, Task log | Agent chain, Scene | Studio,
  // Clip | Instruments), said on the Info line. Each switch shows or hides its side; both stand pressed while both stand.
  const pair = detailPairOf(mode) ?? detailPairOf('audio')!
  const shownSides = useShownSides()
  // The Device switch names the selected track (manual §10.1), read from the tracks the set's views publish (frame/tracks/tracksDoor.ts).
  const shownTracks = useShownTracks()
  const deviceTrackRef = trackRef ?? (clipRef ? shownTracks?.clips.find(clip => clip.id === clipRef)?.trackId : undefined)
  // Where the shown tracks hold no such track (Live's set, Factory's sessions), the mode's own name for the selected track stands.
  const deviceName = shownTracks?.tracks.find(track => track.id === deviceTrackRef)?.name ?? trackName ?? selectedTrack
  const other = (side: DetailSide): DetailSide => side === 'clip' ? 'device' : 'clip'
  const shown = (side: DetailSide) => detailShown && shownSides[side]
  // A switch brings its view forward (⌥-click shows both); ▲ beside it shows or hides that view, and hiding the last one standing
  // hides the area (Live's triangles beside its Clip View and Device View selectors).
  const bring = (side: DetailSide, both: boolean) => (bringSide ? bringSide(side, both) : changeDetailMode(side))
  const triangle = (side: DetailSide) => {
    if (!shown(side)) return bring(side, false)
    if (!shown(other(side)) && hideDetail) return hideDetail()
    if (toggleDetailSide) toggleDetailSide(side)
  }
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
    {audio && error && <span className="statusbar-error" title={path ?? undefined}>{refusalWords('The set did not open.', error)}</span>}
    {audio && !error && loading && <span className="statusbar-counts">Opening…</span>}
    {audio && documentError && <span className="statusbar-error" title={documentError}>Document unavailable</span>}
    {audio && set && <span className="statusbar-counts" title={set.path}>{set.tracks.length} tracks · {set.scene_count} scenes · {set.arrangement_clips} clips</span>}
    {track && <span className="statusbar-track" title={track}>{track}</span>}
    {!audio && status?.snapshot && reading?.sceneState && reading.nativeScene && <span className="statusbar-counts" title="Current Scene snapshot; file-save standing appears in the native Save control">Snapshot: {reading.sceneState === 'Edited since save' ? 'edited' : reading.sceneState === 'Draft' ? 'none' : 'saved'}{reading.nativeScene ? ` · revision ${reading.nativeScene.revision}` : ''}</span>}
    {aperture && <span className="statusbar-counts statusbar-aperture" data-i={`Aperture|${aperture.pinned ? 'panes pinned to their own subject' : 'every pane follows the shared encounter'} — ${aperture.panes} pane${aperture.panes === 1 ? '' : 's'} in the centre`}>{apertureWords(aperture)}</span>}
    {/* The run context stands in every mode: which world this shell runs in, from the host's own disclosure. */}
    <RunContextReading />
    <nav className="status-detail-views" aria-label="Detail view">
      {/* Clip | Device in every mode (manual §10.1, §16.4, FOUNDATION F4), where Live keeps its selectors: each carries what its
        view holds now; the mode's own name for that is said on the Info line, never a branch here. */}
      <button type="button" className="status-triangle" aria-label={shown('clip') ? 'Hide Clip view' : 'Show Clip view'} aria-pressed={shown('clip')} data-detail-toggle="clip"
        data-i={`Clip view|Shows or hides Clip view (⌥⌘3). ⌥⌘L hides Clip view and Device view together.`} onClick={() => triangle('clip')}>▲</button>
      <button type="button" className="status-switch" aria-label="Clip view" data-detail-side="clip" aria-pressed={shown('clip')}
        data-i={`Clip view|${pair.clip.label}: ${pair.clip.meaning}. Brings Clip view forward; ⌥-click shows Clip view and Device view together; ⇧Tab switches when only one shows; ⌥⌘E gives it the main area.`}
        onClick={event => bring('clip', event.altKey)}><Icon name="set" size={12} /><span>{clipName ?? 'Clip'}</span></button>
      <button type="button" className="status-triangle" aria-label={shown('device') ? 'Hide Device view' : 'Show Device view'} aria-pressed={shown('device')} data-detail-toggle="device"
        data-i={`Device view|Shows or hides Device view (⌥⌘4). ⌥⌘L hides Clip view and Device view together.`} onClick={() => triangle('device')}>▲</button>
      <button type="button" className="status-switch" aria-label="Device view" data-detail-side="device" aria-pressed={shown('device')}
        data-i={`Device view|${pair.device.label}: ${pair.device.meaning}. Brings Device view forward; ⌥-click shows Clip view and Device view together; ⇧Tab switches when only one shows.`}
        onClick={event => bring('device', event.altKey)}><Icon name="device" size={12} /><span>{deviceName ?? 'Device'}</span></button>
      {toggleMixer && <button type="button" className="status-switch status-mixer" aria-label="Mixer" aria-pressed={!!mixer}
        data-i="Mixer|Shows or hides every track's mixer row (⌥⌘M); ⌥⌘I its In/Out section." onClick={toggleMixer}><span aria-hidden="true">⫼</span><span>Mixer</span></button>}
    </nav>
  </footer>
}
