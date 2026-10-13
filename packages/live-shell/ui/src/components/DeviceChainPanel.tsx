import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { displayDeviceName, type SetDocument } from '../shell/document'
import type { SetSelection } from './SessionView'
import { Icon } from './Icon'
import { MODE_GRAMMAR } from '../shell/modeGrammar'
import { LiveTorusWidget } from '../panels/devices/LiveTorusWidget'
import { useLiveTorusReading } from '../live/torusInstrument'
import '../shell/live/liveDetail.css'
export type DetailMode = 'clip' | 'device'
function Value({ label, value }: { label: string; value?: string }) {
  return <label className="clip-value"><span>{label}</span><input readOnly value={value ?? '—'} aria-label={label} title={value === undefined ? 'Value not disclosed by the document owner' : `${label} · read-only native document value`} /></label>
}
/** The detail row's designed empty state (the widget guide's law): a framed
 * face naming what docks here and the selection that fills it — never a
 * bare sentence in the chain's void. */
function DetailEmptyFrame({ kind, fill }: { kind: 'clip' | 'device'; fill: string }) {
  const pair = MODE_GRAMMAR.live.detail[kind]
  const chips = kind === 'clip'
    ? ['Clip — Start · End · Position · Length · Signature · Groove', 'Launch — launch mode', 'Pitch & Time — Transpose · Fit to Scale', 'Note editor — ruler · keyboard · velocity lane']
    : ['Device tiles — one per device on the selected track', 'Parameter faces — the document\'s own names, lossless values, disclosed ranges', 'Enable state — drawn dark until its owner discloses it']
  return <div className="detail-empty-frame" data-detail-empty={kind} role="status">
    <section className="mode-detail-frame">
      <header className="mode-detail-frame-head">
        <span className="mode-detail-frame-mark"><Icon name={kind === 'clip' ? 'set' : 'device'} size={14} /></span>
        <strong>{pair.label}</strong>
        <span className="mode-detail-frame-sub">{pair.meaning}</span>
      </header>
      <p className="mode-detail-frame-note">{fill}</p>
      <ul className="mode-detail-chips" aria-label={`What docks in the ${pair.label} detail`}>
        {chips.map(chip => <li key={chip} className="mode-detail-chip" data-i={`${chip}|docks here when the selection fills it`}>{chip}</li>)}
      </ul>
    </section>
  </div>
}
export function DeviceChainPanel({ ctx, document, selection, mode }: { ctx: PanelContext; document: SetDocument | null; selection: SetSelection; mode: DetailMode }) {
  // The one instrument mounts at the chain's head only once the owner has published a reading; until then the chain is unchanged.
  const torus = useLiveTorusReading()
  const track = ctx.set?.tracks[selection.track]
  const deep = document?.tracks[selection.track]
  const clip = selection.clip === undefined ? undefined : deep?.arrangementClips[selection.clip]
  const sessionClip = selection.scene === null ? null : deep?.sessionSlots[String(selection.scene)]
  const name = clip?.name ?? sessionClip
  return <section className="chain" aria-label="Detail panel" data-detail-density={mode}>
    {mode === 'clip' ? !name && !clip ? <DetailEmptyFrame kind="clip" fill="No clip is selected. Select a clip in Session (a clip slot) or Arrangement (a clip on a lane) — the clip's readings open here read-only; editing waits for the document owner." /> : <><aside className="clip-inspector"><div className="clip-section-title"><span className="clip-color-chip" />{name || 'Clip'}</div><details open><summary>Clip</summary><div className="clip-values-pair"><Value label="Start" value={clip?.start.toString()} /><Value label="End" value={clip?.end.toString()} /></div><button disabled title="Duplicate requires the document editing owner">Duplicate</button><button disabled title="Loop writing requires native document editing">▣ Loop</button><div className="clip-values-pair"><Value label="Position" value={clip?.start.toString()} /><Value label="Length" value={clip ? (clip.end - clip.start).toString() : undefined} /></div><div className="clip-values-pair"><Value label="Signature" /><Value label="Groove" /></div><span className="clip-subheading">Scale</span><div className="clip-values-pair"><Value label="Root" /><Value label="Mode" /></div></details><details><summary>Launch</summary><Value label="Launch mode" /></details><details open><summary>Pitch &amp; Time</summary><button disabled title="Note editing requires native clip notes">Fit to Scale</button><button disabled title="Note editing requires native clip notes">Invert</button><Value label="Transpose" /><div className="clip-values-pair"><button disabled>×2</button><button disabled>÷2</button></div></details></aside>
      <div className="note-editor"><div className="note-toolbar"><button disabled>Fold</button><button disabled>Scale</button><label><input type="checkbox" disabled />Highlight Scale</label><span>{clip?.kind === 'audio' ? 'Audio' : 'Notes'}</span><output>{track?.name}</output></div><div className="note-ruler">{Array.from({ length: 20 }, (_, i) => <span key={i}>{Math.floor((clip?.start ?? 0) / 4) + i + 1}</span>)}</div><div className="note-grid"><div className="note-keyboard">{['C5', 'C4', 'C3', 'C2', 'C1', 'C0', 'C−1', 'C−2'].map(note => <span key={note}>{note}</span>)}</div><div className="note-grid-body" title="Note and waveform contents are not yet disclosed by the document owner" /></div><div className="velocity-lane"><span>Velocity</span><div /></div></div></>
      : <>{torus !== null && <LiveTorusWidget />}{!track ? <DetailEmptyFrame kind="device" fill="No track is under the selection (no set is open, or the selection is out of range). A set's tracks bring their device chains here; each device reads its parameters losslessly, read-only, until the device lane's editing owner lands." /> : <><div className="device-chain-surface">{track.devices.length === 0 && <DetailEmptyFrame kind="device" fill={`No devices on ${track.name}. The chain fills from the set's own device listing; insertion awaits the device lane's owner.`} />}{track.devices.map((name, i) => { const device = deep?.devices[i]; return <section key={i} className="device-tile" data-device-tile={name}><div className="device-title"><span className="device-power" title="Device enable state not disclosed">●</span><Icon name="device" size={12} />{displayDeviceName(name)}<span>▾</span></div><div className="device-parameters">{device?.params.map(parameter => <label key={parameter.id} className="device-parameter" title={`${parameter.id} · lossless document reading${parameter.min === undefined ? '' : ` · disclosed range ${parameter.min} – ${parameter.max}`} · editing awaits the native device owner`}><span className="device-parameter-name">{parameter.id}</span><input aria-label={`${displayDeviceName(name)} ${parameter.id}`} value={parameter.value} readOnly title="Lossless document reading · parameter editing awaits native owner" />{parameter.min !== undefined && <span className="device-parameter-range">disclosed range {parameter.min} – {parameter.max}</span>}</label>)}{!device?.params.length && <div className="device-empty" title="No parameters disclosed by the native document">—</div>}</div></section> })}</div></>}</>}
    {getPanels('bottom').map(panel => { const Panel = panel.component; return <div className="chain-side" key={panel.id}><Panel {...ctx} /></div> })}
  </section>
}
