import { registerPanel } from '../../shell/panels'
import type { PanelContext } from '../../shell/panels'
import { DevicePanel } from './DevicePanel'
import { installDeviceStyles } from './device-styles'

/**
 * Device panels (M3 — device hosting, parameter editing surface): the
 * devices whose parameter tables live-dynamics carries and whose stored
 * parameters are edited against the open set. Every panel renders the one
 * generic DevicePanel, generated from that device's parameter table
 * (`GET /api/device-descriptors`) and editing stored values through
 * `POST /api/document/device-param` — one control per table row, lossless
 * values, per-control saved/error state (the editor standard).
 *
 * The UI round added the first three of the previously faceless
 * live-dynamics devices: Compressor, Overdrive and Redux (the third
 * face-queue slot went to Redux because Gate's document surface has no
 * unpacked preset evidence — see the UI round's return).
 *
 * Slot: the live-mode detail host (`bottom` — beside the device chain in
 * the device detail row, the one mounted panel host in live mode). The
 * integration map leaves the full faces' host open (frame right-dock vs the
 * live detail host) and the UI round chose the live detail host: the frame's
 * dock residence is the Rev 4 per-mode context dock, so re-mounting the
 * legacy right dock there would collide with the mode system's furniture.
 */

installDeviceStyles()

function devicePanel(elementName: string, displayTitle: string) {
  return function DevicePanelFor({ set, loading, error }: PanelContext) {
    return (
      <DevicePanel
        elementName={elementName}
        displayTitle={displayTitle}
        set={set}
        loading={loading}
        error={error}
      />
    )
  }
}

registerPanel({
  id: 'devices.glue-compressor',
  title: 'Glue Compressor',
  icon: 'device',
  slot: 'bottom',
  component: devicePanel('GlueCompressor', 'Glue Compressor'),
  order: 30,
  note: 'Glue Compressor stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.echo',
  title: 'Echo',
  icon: 'device',
  slot: 'bottom',
  component: devicePanel('Echo', 'Echo'),
  order: 31,
  note: 'Echo stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.reverb',
  title: 'Reverb',
  icon: 'device',
  slot: 'bottom',
  component: devicePanel('Reverb', 'Reverb'),
  order: 32,
  note: 'Reverb stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.compressor',
  title: 'Compressor',
  icon: 'device',
  slot: 'bottom',
  component: devicePanel('Compressor2', 'Compressor'),
  order: 33,
  note: 'Compressor (element Compressor2) stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.overdrive',
  title: 'Overdrive',
  icon: 'device',
  slot: 'bottom',
  component: devicePanel('Overdrive', 'Overdrive'),
  order: 34,
  note: 'Overdrive stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.redux',
  title: 'Redux',
  icon: 'device',
  slot: 'bottom',
  component: devicePanel('Redux2', 'Redux'),
  order: 35,
  note: 'Redux (element Redux2) stored parameters — live editing against the set (M3)',
})
