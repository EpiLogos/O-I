/** The device-SDK harness: the face kit rendered live — the visual reference
 * for the loop's verify step (DEVICE-SDK.md §5–6). The demo family is
 * declared through the kit exactly as an owner would; its aperture is a
 * labelled fixture (apply acknowledges after a tick; captureCurrent is
 * true). Harness only: nothing here is the shell build, and the fixture
 * writes no real owner. */

import {createRoot} from 'react-dom/client'
import {createElement as h, useCallback, useEffect, useMemo, useState} from 'react'
import {admitFamily, numberParam, enumParam, boolParam, reading, facePresentation, sdkParamRows} from '../define.ts'
import type {DeviceFaceAperture, ParamChange} from '../controls.tsx'
import {BoolParam, Disclosure, EnumParam, FacePlate, Lamp, ReadingRow, ScalarParam, WaitingFace, useFaceDrafts} from '../controls.tsx'

// The demo family — declared through the kit, gate-passing, honest.
admitFamily({
  id: 'device-sdk-demo',
  owner: 'Device SDK (fixture)',
  browser: ['device-sdk-demo'],
  paramsGrammar: 'device-sdk-demo/parameter-address/v1',
  // The fixture arms its own write paths (the writers law): these are the
  // fixture's own setters — echoed by the fixture aperture, never the
  // shell's, and never presented as a real owner's writer.
  writers: ['shell.setDemoGain', 'shell.setDemoTrim', 'shell.setDemoCurve', 'shell.setDemoArm'],
  writerAuthority: 'the SDK harness fixture — the aperture echoes these; no real owner',
  devices: [
    {
      id: 'probe',
      title: 'Probe',
      icon: 'form',
      note: 'The kit demonstration face: fixture-applied rows (the fixture arms its own writers), an enumerated, a boolean, and honest readings.',
      params: [
        numberParam({key: 'gain', title: 'Gain', type: 'number', range: {min: 0, max: 2, unit: 'x'}, writePath: 'shell.setDemoGain', icon: 'form'}),
        numberParam({key: 'trim', title: 'Trim', type: 'number', range: {min: -12, max: 12, unit: 'dB'}, writePath: 'shell.setDemoTrim', icon: 'metro'}),
        enumParam({key: 'curve', title: 'Curve', type: 'enumerated', values: ['linear', 'log', 'exp'], writePath: 'shell.setDemoCurve', icon: 'live'}),
        boolParam({key: 'arm', title: 'Arm', type: 'boolean', writePath: 'shell.setDemoArm', icon: 'rec'}),
        reading({key: 'readiness', title: 'Readiness', type: 'string', disclosure: 'Fixture: the owner reading arrives when the harness mounts.'}),
        reading({key: 'spend', title: 'Spend', type: 'number', disclosure: 'No writer for spend in the demo world — the row discloses absence.', icon: 'cap'}),
      ],
    },
    {
      id: 'later',
      title: 'Later',
      icon: 'orbit',
      admission: 'waiting',
      note: 'Waits for the demo owner\'s second device op (fixture of the waiting law).',
    },
  ],
})

/** The fixture aperture: apply acknowledges the changes after a tick and
 * echoes the acknowledged values through the reading; captureCurrent is
 * honest true. Labelled as a fixture — it writes no real owner (the apply
 * cast is the fixture boundary; a real face maps ParamChanges onto ITS
 * aperture's native apply). */
function useFixtureAperture(): {aperture: DeviceFaceAperture; reading: Record<string, string | number | boolean>} {
  const [reading, setReading] = useState<Record<string, string | number | boolean>>({})
  const apply = useCallback(async (changes: readonly ParamChange[]) => {
    await new Promise(resolve => setTimeout(resolve, 120))
    setReading(previous => ({...previous, ...Object.fromEntries(changes.map(change => [change.key, change.value]))}))
  }, [])
  const aperture = useMemo<DeviceFaceAperture>(() => ({
    reading,
    disabled: false,
    apply: apply as unknown as DeviceFaceAperture['apply'],
    captureCurrent: () => () => true,
  }), [reading, apply])
  useEffect(() => {
    setReading(previous => ({...previous, readiness: 'fixture:ready'}))
  }, [])
  return {aperture, reading}
}

const ProbeFace = () => {
  const {aperture, reading} = useFixtureAperture()
  const presentation = facePresentation('device-sdk-demo', 'probe')!
  const rows = sdkParamRows('device-sdk-demo').filter(row => row.deviceInstance === 'probe')
  const scalarRows = rows.filter(row => row.type === 'number')
  const enumRow = rows.find(row => row.key === 'curve')!
  const boolRow = rows.find(row => row.key === 'arm')!
  const readyRow = rows.find(row => row.key === 'readiness')!
  const spendRow = rows.find(row => row.key === 'spend')!

  const drafts = useFaceDrafts(async changes => {
    // Fixture boundary: a real face MAPS its ParamChanges onto its native
    // apply; the fixture echoes them verbatim.
    await aperture.apply(changes as unknown as Parameters<DeviceFaceAperture['apply']>[0])
  })
  useEffect(() => {
    drafts.adopt({gain: 0.75, trim: -3.5, curve: 'log', arm: false})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    drafts.adopt(reading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading])

  const scalarProps = (row: typeof scalarRows[number]) => ({
    param: row,
    base: typeof drafts.base[row.key] === 'number' ? drafts.base[row.key] as number : undefined,
    draft: typeof drafts.drafts[row.key] === 'number' ? drafts.drafts[row.key] as number : undefined,
    onDraft: (value: number) => drafts.setDraft(row.key, value),
    onCommit: () => void drafts.commit(),
    onCancel: () => drafts.cancel(row.key),
  })

  const standing = drafts.standing
  return h(FacePlate, {
    presentation,
    power: 'on',
    actions: [{icon: 'detail', label: 'Settings', onPress: () => {}}, {icon: 'dock', label: 'Pop-out', onPress: () => {}}],
  },
    h('div', {style: {display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end'}},
      h(ScalarParam, {...scalarProps(scalarRows[0]!)}),
      h(ScalarParam, {...scalarProps(scalarRows[1]!), presentation: 'fader'}),
      h(EnumParam, {
        param: enumRow,
        base: drafts.base.curve as string | undefined,
        draft: drafts.drafts.curve as string | undefined,
        onDraft: value => drafts.setDraft('curve', value),
        onCommit: () => void drafts.commit(),
        onCancel: () => drafts.cancel('curve'),
      }),
      h(BoolParam, {
        param: boolRow,
        base: drafts.base.arm as boolean | undefined,
        draft: drafts.drafts.arm as boolean | undefined,
        onDraft: value => drafts.setDraft('arm', value),
        onCommit: () => void drafts.commit(),
        onCancel: () => drafts.cancel('arm'),
      }),
    ),
    h('div', {style: {display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center'}},
      h(ReadingRow, {param: readyRow, value: reading.readiness}),
      h(ReadingRow, {param: spendRow, value: reading.spend}),
      h('span', {'data-standing': standing, style: {color: standing === 'refused' ? 'var(--rec)' : 'var(--text-faint)', fontSize: 10}},
        standing === 'pending' ? 'pending…' : standing === 'refused' ? 'refused — drafts retained' : 'acknowledged'),
      h(Lamp, {state: 'admit', label: 'fixture admit reading'}),
    ),
    h(Disclosure, {title: 'Probe', instanceRef: 'device-sdk-demo:probe', owner: presentation.owner, revision: 'fixture:r1'}),
  )
}

const WaitingCard = () => h(WaitingFace, {
  presentation: facePresentation('device-sdk-demo', 'later')!,
  note: 'Waits for the demo owner\'s second device op (fixture of the waiting law).',
})

const plates = document.getElementById('plates')!
const bar = document.getElementById('reading')!
createRoot(plates).render(
  h('div', {style: {display: 'contents'}},
    h(ProbeFace),
    h(WaitingCard),
  ),
)
bar.textContent = 'kit loaded — fixture aperture (writes are echoed, labelled, not real)'
