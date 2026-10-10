import { registerPanel } from '../../shell/panels'
import type { PanelContext } from '../../shell/panels'
import { DevicePanel } from './DevicePanel'
import { installDeviceStyles } from './device-styles'

/**
 * Device panels (M3 — device hosting, parameter editing surface): the three
 * devices whose DSP is modeled and gated in live-dynamics. All three render
 * the one generic DevicePanel, generated from that device's parameter table
 * (`GET /api/device-descriptors`) and editing stored values through
 * `POST /api/document/device-param`.
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
  slot: 'right-dock',
  component: devicePanel('GlueCompressor', 'Glue Compressor'),
  order: 30,
  note: 'Glue Compressor stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.echo',
  title: 'Echo',
  icon: 'device',
  slot: 'right-dock',
  component: devicePanel('Echo', 'Echo'),
  order: 31,
  note: 'Echo stored parameters — live editing against the set (M3)',
})

registerPanel({
  id: 'devices.reverb',
  title: 'Reverb',
  icon: 'device',
  slot: 'right-dock',
  component: devicePanel('Reverb', 'Reverb'),
  order: 32,
  note: 'Reverb stored parameters — live editing against the set (M3)',
})
