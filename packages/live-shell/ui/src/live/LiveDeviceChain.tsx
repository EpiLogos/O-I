// Live's Device side (manual §3: "Device view shows what is working on it … left to right, in the order the material passes
// through them"; DLW §16.2 Live: "The note devices, the torus, then its effects"; lock §0.2: one instrument): a row of plates through
// the one device runtime — the note devices, the M1 torus, the effects its owner's chain names (manual §21.5; designBindings/
// TorusEffectsOnChain.tsx, the Delay kept on the set's tempo), then the selected track's own devices — after the part's input, which is no
// device (lock §0.3.6; R4 took the keyboard's plate off the chain: KeyboardOnChain.tsx PartInput keeps its MIDI path) —
// that the detail host ends in its drop zone (shell/modeDetails.tsx dropHint). While something is not there yet the row says
// what it waits for in one line, the host's waiting idiom; it carries no head of its own (the host draws the one head).
// Replaces components/DeviceChainPanel.tsx:64's device side (its read-only tiles, its DevicePanel faces and the empty card).
import type {PanelContext} from '../shell/panels'
import type {SetDocument} from '../shell/document'
import type {SetSelection} from '../shell/liveSelection'
import {useLiveTorusReading} from './torusInstrument'
import {PartInput} from './KeyboardOnChain'
import {NoteDeviceChain} from './noteDevices/NoteDeviceChain'
import {TorusOnChain} from './TorusOnChain'
import {TorusEffectsOnChain} from './designBindings/TorusEffectsOnChain'
import {SetDeviceOnChain} from './SetDeviceOnChain'
import {liveChainWaits} from './liveChainDevices'
import './liveSides.css'

export function LiveDeviceChain({ctx, document, selection}: {ctx: PanelContext; document: SetDocument | null; selection: SetSelection}) {
  // The one instrument mounts on the chain only once its owner has published a reading; the part's input and the note devices that
  // feed it stand with it.
  const torus = useLiveTorusReading()
  const track = ctx.set?.tracks[selection.track]
  const deep = document?.tracks[selection.track]
  const instrument = torus !== null
  const waits = liveChainWaits({instrument, set: {loading: ctx.loading, error: ctx.error, open: !!ctx.set}, track: !!track})
  const line = waits && <p className="live-chain-waits" role="status" data-live-chain-waits>{waits}</p>
  return <section className="chain" aria-label="Live device chain" data-detail-density="device" data-live-chain={track ? 'track' : 'instrument'}>
    {!instrument && track && line}
    {instrument && <PartInput />}
    {instrument && <NoteDeviceChain />}
    {instrument && <TorusOnChain state={torus} />}
    {instrument && <TorusEffectsOnChain state={torus} tempoBpm={ctx.set?.tempo_bpm ?? null} />}
    {track && ctx.set && track.devices.map((name, index) =>
      <SetDeviceOnChain key={`${ctx.set!.path}#${selection.track}/${index}/${name}`} set={ctx.set!} track={track.name} trackIndex={selection.track}
        index={index} elementName={name} params={deep?.devices[index]?.name === name ? deep.devices[index].params : undefined} />)}
    {!track && line}
  </section>
}
