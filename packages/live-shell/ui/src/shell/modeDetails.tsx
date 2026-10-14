// Each mode's detail bodies (FOUNDATION F4): the clip editor its clips open in, and the chain on its Device side. A table
// read by the one detail host (frame/detail/DetailHost.tsx), never a branch in the frame. The bodies are the ones each mode
// already had; they move here unchanged, and the host gives every mode the same clip box and the same Clip | Device pair.
import type {ComponentType} from 'react'
import type {SurfMode} from './modeGrammar'
import {useDetailReading} from '../frame/detail/detailReading'
import {DeviceChainPanel} from '../components/DeviceChainPanel'
import {NativeWorldDetail} from '../components/NativeWorldDetail'
import {CentralClipChooser} from '../central/CentralClipChooser'
import {BaseDevicesDetail, FactoryTaskLogDetail, TechneClipDetail, TechneInstrumentsDetail} from './ModeDetail'
import {AgentShellDeviceDetail} from '../agent/AgentShellDeviceDetail'

export interface ModeDetail {
  clip: ComponentType
  device: ComponentType
  /** The mode's own devices lead a focused instrument's chain (Central's ground devices are never removed by the ruling). */
  devicesLeadInstrument?: boolean
  /** The mode keeps its own Device side whatever pane is focused (Live: the instrument's chain is the mode). */
  ownsDeviceSide?: boolean
  /** The chain's end: what can be dropped onto it (Live's "Drop Instruments or Samples Here"; the mockup's .dropz). */
  dropHint: string
}

function LiveClip() { const {live} = useDetailReading(); return <DeviceChainPanel ctx={live.ctx} document={live.document} selection={live.selection} mode="clip" /> }
function LiveChain() { const {live} = useDetailReading(); return <DeviceChainPanel ctx={live.ctx} document={live.document} selection={live.selection} mode="device" /> }
function CentralClip() { const {transport, centralSubject, world} = useDetailReading(); return <CentralClipChooser transport={transport} subject={centralSubject} world={world} /> }
function CentralChain() { const {transport, centralSubject, world} = useDetailReading(); return <BaseDevicesDetail transport={transport} world={world} subject={centralSubject} /> }
function FactoryClip() { const {factory} = useDetailReading(); return <FactoryTaskLogDetail {...factory.task} /> }
function FactoryChain() { const {factory} = useDetailReading(); return <AgentShellDeviceDetail tracks={factory.tracks} /> }
function ExpressionsClip() { const {native} = useDetailReading(); return <NativeWorldDetail mode="clip" {...native} /> }
function ExpressionsChain() { const {native} = useDetailReading(); return <NativeWorldDetail mode="device" {...native} /> }
// Technē's clips are World cut events while the tracks pane stands over the World cut, else the open work's native clip.
function TechneClip() { const {worldCut, world, native} = useDetailReading(); return worldCut ? <TechneClipDetail world={world} /> : <NativeWorldDetail mode="clip" {...native} /> }
function TechneChain() { const {transport} = useDetailReading(); return <TechneInstrumentsDetail transport={transport} /> }

export const MODE_DETAILS: Readonly<Record<SurfMode, ModeDetail>> = {
  live: {clip: LiveClip, device: LiveChain, ownsDeviceSide: true, dropHint: 'Drop an instrument or effect here'},
  base: {clip: CentralClip, device: CentralChain, devicesLeadInstrument: true, dropHint: 'Add a document device'},
  factory: {clip: FactoryClip, device: FactoryChain, dropHint: 'Drop agents, skillsets, worlds or git here'},
  expressions: {clip: ExpressionsClip, device: ExpressionsChain, dropHint: 'Drop a field device here'},
  techne: {clip: TechneClip, device: TechneChain, dropHint: 'Drop a device here'},
}
