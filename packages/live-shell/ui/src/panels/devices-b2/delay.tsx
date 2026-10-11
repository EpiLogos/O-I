import {
  DevicePortFrame,
  Knob,
  ParamSpec,
  Readout,
  Section,
  Segmented,
  StoredExtras,
  Switch,
  useDeviceState,
} from './kit'

/** Delay port — Left/Right sync columns with division grids, feedback and
 * filter block, modulation row, Mode buttons and Ping Pong right
 * (capture: evidence/ui/device-panels/Delay.png).
 * Control inventory: live-dynamics params.rs DELAY. */

const SPECS: ParamSpec[] = [
  { id: 'DelayLine_Link', label: 'link', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'DelayLine_PingPong', label: 'ping pong', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'DelayLine_SyncL', label: 'sync L', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'DelayLine_SyncR', label: 'sync R', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'DelayLine_TimeL', label: 'time L', min: 0.001, max: 5, unit: 's', kind: 'continuous', def: 0.25 },
  { id: 'DelayLine_TimeR', label: 'time R', min: 0.001, max: 5, unit: 's', kind: 'continuous', def: 0.25 },
  { id: 'DelayLine_SyncedSixteenthL', label: 'div L', min: 0, max: 3, kind: 'discrete', labels: ['?', '?', '?', '?'], def: 1 },
  { id: 'DelayLine_SyncedSixteenthR', label: 'div R', min: 0, max: 3, kind: 'discrete', labels: ['?', '?', '?', '?'], def: 1 },
  { id: 'DelayLine_SmoothingMode', label: 'mode', min: 0, max: 1, kind: 'discrete', labels: ['Fade', 'Jump'], def: 0 },
  { id: 'Feedback', label: 'feedback', min: 0, max: 0.95, kind: 'continuous', def: 0.5 },
  { id: 'Freeze', label: 'freeze', min: 0, max: 1, kind: 'toggle', def: 0 },
  { id: 'Filter_On', label: 'filter', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'Filter_Frequency', label: 'filter freq', min: 50, max: 18000, unit: 'Hz', kind: 'continuous', def: 1000 },
  { id: 'Filter_Bandwidth', label: 'bandwidth', min: 0.5, max: 9, kind: 'continuous', def: 8 },
  { id: 'Modulation_Frequency', label: 'mod rate', min: 0.01, max: 40, unit: 'Hz', kind: 'continuous', def: 0.5 },
  { id: 'Modulation_AmountTime', label: 'time mod', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'Modulation_AmountFilter', label: 'filter mod', min: 0, max: 1, kind: 'continuous', def: 0 },
  { id: 'DryWet', label: 'dry/wet', min: 0, max: 1, kind: 'continuous', def: 0.5 },
]

const EXTRAS: ParamSpec[] = [
  { id: 'On', label: 'on', min: 0, max: 1, kind: 'toggle', def: 1 },
  { id: 'DelayLine_SimpleDelayTimeL', label: 'simple time L', min: 1, max: 300, unit: 'ms', kind: 'continuous', def: 100 },
  { id: 'DelayLine_SimpleDelayTimeR', label: 'simple time R', min: 1, max: 300, unit: 'ms', kind: 'continuous', def: 100 },
  { id: 'DelayLine_PingPongDelayTimeL', label: 'pp time L', min: 1, max: 999, unit: 'ms', kind: 'continuous', def: 250 },
  { id: 'DelayLine_PingPongDelayTimeR', label: 'pp time R', min: 1, max: 999, unit: 'ms', kind: 'continuous', def: 250 },
  { id: 'DelayLine_OffsetL', label: 'offset L', min: -0.33, max: 0.33, kind: 'continuous', def: 0 },
  { id: 'DelayLine_OffsetR', label: 'offset R', min: -0.33, max: 0.33, kind: 'continuous', def: 0 },
  { id: 'DelayLine_CompatibilityMode', label: 'compat', min: 0, max: 0, kind: 'discrete', labels: ['?'] },
  { id: 'DryWetMode', label: 'dry/wet mode', min: 0, max: 1, kind: 'discrete', labels: ['?', '?'] },
  { id: 'EcoProcessing', label: 'eco', min: 0, max: 1, kind: 'toggle', def: 0 },
]

function SyncColumn({ side, v, set, specs }: { side: 'L' | 'R'; v: Record<string, number>; set: (id: string, x: number) => void; specs: ParamSpec[] }) {
  const sync = (v[`DelayLine_Sync${side}`] ?? 1) === 1
  const divSpec = specs[6 + (side === 'R' ? 1 : 0)]
  return (
    <div className="b2-col">
      <span className="b2-col-label">{side === 'L' ? 'Left' : 'Right'}</span>
      <Switch label={`sync ${side}`} value={sync} onChange={(on) => set(`DelayLine_Sync${side}`, on ? 1 : 0)} />
      {sync ? (
        <Segmented
          label={`division ${side}`}
          value={v[`DelayLine_SyncedSixteenth${side}`] ?? 1}
          labels={divSpec.labels ?? []}
          columns={2}
          onChange={(x) => set(`DelayLine_SyncedSixteenth${side}`, x)}
          title="synced sixteenth — stored index 0..3; menu labels not in evidence"
        />
      ) : (
        <Knob label="time" value={v[`DelayLine_Time${side}`] ?? 0.25} min={0.001} max={5} unit="s" curve={2} onChange={(x) => set(`DelayLine_Time${side}`, x)} />
      )}
      <Readout wide value={sync ? 'sync' : `${(v[`DelayLine_Time${side}`] ?? 0.25).toFixed(2)} s`} label="delay time" />
    </div>
  )
}

export function DelayPort() {
  const { values, set } = useDeviceState([...SPECS, ...EXTRAS])
  const v = values

  return (
    <DevicePortFrame name="Delay (port)" element="Delay">
      <div className="b2-flow">
        <Section label="delay line">
          <div className="b2-row">
            <SyncColumn side="L" v={v} set={set} specs={SPECS} />
            <SyncColumn side="R" v={v} set={set} specs={SPECS} />
          </div>
          <div className="b2-row">
            <Switch label="link" value={(v['DelayLine_Link'] ?? 1) === 1} onChange={(on) => set('DelayLine_Link', on ? 1 : 0)} />
            <Switch label="ping pong" value={(v['DelayLine_PingPong'] ?? 0) === 1} onChange={(on) => set('DelayLine_PingPong', on ? 1 : 0)} />
            <Switch label="freeze" value={(v['Freeze'] ?? 0) === 1} onChange={(on) => set('Freeze', on ? 1 : 0)} />
          </div>
        </Section>
        <Section label="feedback / filter">
          <div className="b2-row">
            <Knob label="feedback" value={v['Feedback'] ?? 0.5} min={0} max={0.95} onChange={(x) => set('Feedback', x)} />
            <Switch label="filter" value={(v['Filter_On'] ?? 1) === 1} onChange={(on) => set('Filter_On', on ? 1 : 0)} />
            <Knob label="freq" value={v['Filter_Frequency'] ?? 1000} min={50} max={18000} unit="Hz" curve={2.6} onChange={(x) => set('Filter_Frequency', x)} />
            <Knob label="bandwidth" value={v['Filter_Bandwidth'] ?? 8} min={0.5} max={9} size={28} onChange={(x) => set('Filter_Bandwidth', x)} />
          </div>
        </Section>
        <Section label="modulation">
          <div className="b2-row">
            <Knob label="rate" value={v['Modulation_Frequency'] ?? 0.5} min={0.01} max={40} unit="Hz" curve={2} onChange={(x) => set('Modulation_Frequency', x)} />
            <Knob label="time" value={v['Modulation_AmountTime'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Modulation_AmountTime', x)} />
            <Knob label="filter" value={v['Modulation_AmountFilter'] ?? 0} min={0} max={1} size={28} onChange={(x) => set('Modulation_AmountFilter', x)} />
          </div>
        </Section>
        <Section label="mode">
          <div className="b2-col">
            <Segmented label="mode" value={v['DelayLine_SmoothingMode'] ?? 0} labels={SPECS[8].labels ?? []} columns={2} onChange={(x) => set('DelayLine_SmoothingMode', x)} title="smoothing mode — stored 0/1" />
            <Knob label="dry/wet" value={v['DryWet'] ?? 0.5} min={0} max={1} onChange={(x) => set('DryWet', x)} />
          </div>
        </Section>
      </div>
      <StoredExtras specs={EXTRAS} values={v} set={set} />
    </DevicePortFrame>
  )
}
