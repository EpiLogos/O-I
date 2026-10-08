import type { FunctionComponent } from 'react'

import { registerPanel } from '../../shell/panels'

import { installB2Styles } from './styles'
import { AutoFilterPort } from './autofilter'
import { AutoPanPort } from './autopan'
import { ChorusEnsemblePort } from './chorus'
import { DelayPort } from './delay'
import { DriftPort } from './drift'
import { DrumBussPort } from './drumbuss'
import { Eq8Port } from './eq8'
import { HybridReverbPort } from './hybridreverb'
import { MultibandDynamicsPort } from './multiband'
import { SaturatorPort } from './saturator'
import { UtilityPort } from './utility'
import { WavetablePort } from './wavetable'

/**
 * Device panel ports (batch 2) — faithful visual ports of twelve real Live
 * device panels, built from captured running-app screenshots
 * (`evidence/ui/device-panels/*.png`) and the live-dynamics parameter
 * tables (every ParamDesc = a control). Interactivity is local: controls
 * update the port's stored-value state and display it; persistence wires
 * in with the per-device M3 edit API (the corner badge says so).
 */

installB2Styles()

const ICON_CURVES =
  'M3 17 C 7 17, 8 7, 12 7 S 17 17, 21 17'

function port(id: string, title: string, component: FunctionComponent, order: number, note: string) {
  registerPanel({
    id,
    title,
    icon: ICON_CURVES,
    slot: 'right-dock',
    component,
    order,
    note,
  })
}

port('devicesb2.eq8', 'EQ Eight (port)', Eq8Port, 40, 'EQ Eight visual port — band graph + full stored parameter set (local state, M3 wiring pending)')
port('devicesb2.autofilter', 'Auto Filter (port)', AutoFilterPort, 41, 'Auto Filter visual port — envelope, filter curve, LFO/S&H (local state)')
port('devicesb2.autopan', 'Auto Pan (port)', AutoPanPort, 42, 'Auto Pan visual port — LFO display and hub parameters (local state)')
port('devicesb2.saturator', 'Saturator (port)', SaturatorPort, 43, 'Saturator visual port — drive curve, color section, output (local state)')
port('devicesb2.drumbuss', 'Drum Buss (port)', DrumBussPort, 44, 'Drum Buss visual port — drive/crunch, boom, Bass/Out faders (local state)')
port('devicesb2.chorus-ensemble', 'Chorus-Ensemble (port)', ChorusEnsemblePort, 45, 'Chorus-Ensemble visual port — wave display, modes, output (local state)')
port('devicesb2.delay', 'Delay (port)', DelayPort, 46, 'Delay visual port — sync grids, feedback/filter, modulation (local state)')
port('devicesb2.hybrid-reverb', 'Hybrid Reverb (port)', HybridReverbPort, 47, 'Hybrid Reverb visual port — Reverb/EQ tabs, convolution display (local state)')
port('devicesb2.multiband-dynamics', 'Multiband Dynamics (port)', MultibandDynamicsPort, 48, 'Multiband Dynamics visual port — splits, three band rows, output (local state)')
port('devicesb2.utility', 'Utility (port)', UtilityPort, 49, 'Utility visual port — input/output columns (local state)')
port('devicesb2.drift', 'Drift (port)', DriftPort, 50, 'Drift visual port — oscillators, filter, envelopes, LFO, matrix, global (local state)')
port('devicesb2.wavetable', 'Wavetable (port)', WavetablePort, 51, 'Wavetable visual port — Osc1/Osc2/Sub/Filters/Envelopes/LFOs/Voice tabs (local state)')
