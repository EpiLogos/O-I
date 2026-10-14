// The M1 torus as a device of the runtime (FOUNDATION F5, the reference device; lock §0.2.3: "the compact rack widget
// (mini torus + ≤4 macros), the expanded instrument in the browser pool, the full torus in the centre pane"). Its four
// macros are the owner's determinants, each an enumerated row whose choices are the owner's own; a change is the owner's
// own instrument edit through the hosted stage channel (torusInstrument.ts), and a refusal comes back in the owner's words.
// Its light reads the owner's standing: on while the instrument follows or is held, off otherwise, dark with no reading.
import type {DeviceDeclaration, SdkParamRow} from '../inhabitants/sdk/define'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {commitLiveInstrumentEdit, liveInstrumentWritable, liveTorusMacroRows, type LiveTorusState} from './torusInstrument'

export const TORUS_DEVICE_ID = 'live:m1-torus'

export const TORUS_DEVICE: DeviceDeclaration = {
  id: 'm1-torus', title: 'M1 torus', icon: 'live', liveSemantic: 'device-instrument',
  invariant: {generates: 'stage:instrument'}, note: 'The one instrument: the bi-phasal oscillator on the torus, played from the keyboard.',
} as DeviceDeclaration

const WRITE_PATH = 'stage:instrument'

/** The torus as the runtime draws it, over the owner's current reading. */
export function torusDevice(state: LiveTorusState | null): DeviceInstance {
  const macros = liveTorusMacroRows(state)
  const rows: SdkParamRow[] = macros.map(row => ({
    family: 'live', deviceInstance: TORUS_DEVICE_ID, key: row.macro.id, type: 'enumerated', title: row.macro.label,
    values: row.options.map(option => option.label), compact: true, group: 'Determinants',
    ...(liveInstrumentWritable(state) ? {writePath: WRITE_PATH} : {disclosure: 'The owner takes edits only while the instrument follows or is held.'}),
  }) as SdkParamRow)
  const values: Record<string, string | boolean> = {}
  for (const row of macros) {
    const option = row.options.find(choice => choice.value === row.selected)
    if (option) values[row.macro.id] = option.label
  }
  if (state?.ok) values.enabled = state.value.standing === 'following' || state.value.standing === 'held'
  return {
    id: TORUS_DEVICE_ID, family: 'live', face: TORUS_DEVICE, rows, values, enabledKey: state?.ok ? 'enabled' : undefined,
    submit: async changes => {
      for (const change of changes) {
        const row = macros.find(item => item.macro.id === change.key)
        const option = row?.options.find(choice => choice.label === change.value)
        if (!row || !option) throw Error(`${change.key}: not one of the owner's choices`)
        const result = await commitLiveInstrumentEdit(row.edit(option.value))
        if (!result.ok) throw Error(result.error)
      }
    },
  }
}
