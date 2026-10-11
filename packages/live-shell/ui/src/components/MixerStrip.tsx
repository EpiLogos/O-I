import type { TrackSummary } from '../shell/useSet'
const awaiting = 'This value is not disclosed by the document owner'
export function RouteReading({ label }: { label: string }) {
  return <label className="route-reading"><span>{label}</span><select aria-label={label} disabled title={awaiting}><option>—</option></select></label>
}
export function TrackRouting({ track }: { track: TrackSummary }) {
  return <div className="track-routing">
    {track.kind !== 'return' && track.kind !== 'master' && <><RouteReading label={track.kind === 'midi' ? 'MIDI From' : 'Audio From'} /><select className="route-channel" disabled aria-label="Input channel" title={awaiting}><option>—</option></select><span>Monitor</span><div className="monitor-options">{['In', 'Auto', 'Off'].map(label => <button key={label} disabled title={awaiting}>{label}</button>)}</div></>}
    <RouteReading label={track.kind === 'master' ? 'Main Out' : 'Audio To'} />
    {track.kind === 'master' && <RouteReading label="Cue Out" />}
  </div>
}
function Dial({ label }: { label: string }) {
  return <div className="dial-reading" title={awaiting}><div className="dial-track" aria-label={`${label} · unavailable`} /><span>{label}</span></div>
}
export function MixerStrip({ number, master = false, onSelect }: { number: string; master?: boolean; onSelect: () => void }) {
  return <div className="mixer-strip">
    <div className="track-sends"><Dial label="A" /><span>Sends</span><Dial label="B" /></div>
    <div className="track-volume"><div className="mixer-controls"><output className="mixer-value" title={awaiting}>—</output><Dial label="Pan" />
      <button className="track-number" onClick={onSelect} title="Select track">{number}</button>
      <button className="solo-button" disabled title="Solo requires native mixer">S</button><button className="arm-button" disabled title="Arm requires native transport">●</button>
    </div><div className="fader-column" title={awaiting}><div className="fader-rail" /><div className="meter-rail" /><div className="db-scale"><span>6</span><span>0</span><span>12</span><span>24</span><span>36</span><span>48</span><span>−∞</span></div></div></div>
    {master && <span className="master-label">Main</span>}
  </div>
}
