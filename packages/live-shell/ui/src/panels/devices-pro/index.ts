import type { ComponentType } from 'react'

import { registerPanel } from '../../shell/panels'
import type { PanelContext } from '../../shell/panels'

import { loadWhenDrawn } from '../../shell/loadWhenDrawn'
import { installProStyles } from './styles'

// Each face's code loads when Live's chain first shows it (O-I #740: a device loads when first placed or shown); until then its
// place shows the shell's waiting line (shell/loadWhenDrawn.ts). The registrations — ids, titles, slots, order — stand at once.
const face = (name: string, load: () => Promise<ComponentType<PanelContext>>) => loadWhenDrawn<PanelContext>(name, load)
const GlueCompressorPro = face('Glue Compressor (pro)', () => import('./glue').then(module => module.GlueCompressorPro))
const GlueCompressorRack = face('Glue (rack)', () => import('./glue').then(module => module.GlueCompressorRack))
const EchoPro = face('Echo (pro)', () => import('./echo').then(module => module.EchoPro))
const EchoRack = face('Echo (rack)', () => import('./echo').then(module => module.EchoRack))
const ReverbPro = face('Reverb (pro)', () => import('./reverb').then(module => module.ReverbPro))
const ReverbRack = face('Reverb (rack)', () => import('./reverb').then(module => module.ReverbRack))
const WavetablePro = face('Wavetable (pro)', () => import('./wavetable').then(module => module.WavetablePro))
const WavetableRack = face('Wavetable (rack)', () => import('./wavetable').then(module => module.WavetableRack))
const OperatorPro = face('Operator (pro)', () => import('./operator').then(module => module.OperatorPro))
const OperatorRack = face('Operator (rack)', () => import('./operator').then(module => module.OperatorRack))

/**
 * Device panel ports (pro) — the faithful device-face family that EDITS:
 * each face is a port of its captured panel (capture → layout, dossier →
 * tooltips) bound to the M3 editing API (descriptors → stored values →
 * debounced POST with saved/error marks). Full faces and compact rack
 * faces both dock in the live-mode detail host (`bottom` — inside the
 * device detail row's DeviceChainPanel, the one mounted panel host in live
 * mode; the integration map's host decision, see ../devices/index.tsx):
 * the racks first in the strip, the full faces after them.
 *
 * Operator is the family's one local-state face: its M6 voice model is
 * landed but no parameter table exists yet, so it is badged model-arriving
 * and runs on the document's stored defaults.
 */

installProStyles()

const ICON_DEVICE =
  'M4 9 h16 v10 h-16 z M4 13 h16 M9 9 v4 M15 9 v4'

function pro(
  id: string,
  title: string,
  component: ComponentType<PanelContext>,
  order: number,
  note: string,
) {
  registerPanel({ id, title, icon: ICON_DEVICE, slot: 'bottom', component, order, note })
}

function rack(
  id: string,
  title: string,
  component: ComponentType<PanelContext>,
  order: number,
  note: string,
) {
  registerPanel({ id, title, icon: ICON_DEVICE, slot: 'bottom', component, order, note })
}

// the full editing faces (live detail host, after the racks)
pro('devicespro.glue-compressor', 'Glue Compressor (pro)', GlueCompressorPro, 60,
  'Glue Compressor device face — live stored-parameter editing (GR meter stub lands with the realtime model)')
pro('devicespro.echo', 'Echo (pro)', EchoPro, 61,
  'Echo device face — L/R delay grid, filter, reverb send; live stored-parameter editing (seconds stored, ms shown)')
pro('devicespro.reverb', 'Reverb (pro)', ReverbPro, 62,
  'Reverb device face — time/character/shelving; DecayTime stored ms = RT60; live editing')
pro('devicespro.wavetable', 'Wavetable (pro)', WavetablePro, 63,
  'Wavetable device face (element InstrumentVector) — Osc1/Osc2/Sub/Filter/Envelope/Mod tabs; live stored-parameter editing')
pro('devicespro.operator', 'Operator (pro)', OperatorPro, 64,
  'Operator device face from the preset XML — Osc A + amp envelope + globals; model arriving (local state, no table yet)')

// bottom: the compact rack faces in the device-chain strip
rack('devicespro.rack.glue-compressor', 'Glue (rack)', GlueCompressorRack, 10,
  'Glue Compressor rack face — identity controls, live editing (full face in the right dock)')
rack('devicespro.rack.echo', 'Echo (rack)', EchoRack, 11,
  'Echo rack face — L/R times, feedback, filter gate, dry/wet (full face in the right dock)')
rack('devicespro.rack.reverb', 'Reverb (rack)', ReverbRack, 12,
  'Reverb rack face — time + character + shelf gates (full face in the right dock)')
rack('devicespro.rack.wavetable', 'Wavetable (rack)', WavetableRack, 13,
  'Wavetable rack face — osc 1 core + amp env + out (full face in the right dock)')
rack('devicespro.rack.operator', 'Operator (rack)', OperatorRack, 14,
  'Operator rack face — Osc A + envelope times + Volume; model arriving (full face in the right dock)')
