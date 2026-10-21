// The torus's effects on Live's chain, after the torus (manual §21.5, and the Resonator bank §22.7; DLW §21.1: the instrument, then its effects): the ones the owner's
// chain names, in the order they sound, each through the device runtime at the chain's compact size and published with its binding so
// the pool, a pane, a pop-out and the rail draw its catalogue design (inhabitants/catalogue/panels/live__<effect>.tsx) on the same owner.
// The Resonator bank is Quaternal Logic's design on three owners (ql/devices/qlResonatorBank.ts: the M3 clock's cut, the mode in force's root,
// the stage's own bank) and the chain keeps the stage to the cut and the root while the bank stands on it.
// After them stands the place to put the others on: each of the five, pressed while it is on the chain; a press puts it on at the end
// or takes it off (it keeps its settings), and an effect's ◂ moves it one place earlier — the chain's owner's own acts, until Live's
// browser drag and the head's Delete reach this chain. The Delay's tempo is kept on the set's (`tempoBpm`, the transport's reading).
// After the effects stands the Sky modulator when it is put on (skyModulation.ts: the shell's plan, run on the Sky's reading), and a
// parameter a planet moves names the planet on its effect.
// The owner and its law are torusEffects.ts's (this folder). The chain places this after TorusOnChain.
import {useEffect, useMemo, useState} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import {openInstrument} from '../../frame/instrumentDoor'
import {EFFECT_TITLES} from '@epilogos/expressions-boundary'
import {TORUS_EFFECTS, followSetTempo, moveTorusEffect, placeTorusEffect, removeTorusEffect, torusEffectBinding, torusEffectDevice, torusEffectId,
  torusEffectsChain, type TorusEffect} from './torusEffects'
import {QL_RESONATOR_CHAIN_ID, QL_RESONATOR_EFFECT, qlBankBinding, qlBankDevice, useQlBankFollow, useQlBankReadings} from '../../inhabitants/ql/devices/qlResonatorBank'
import {placeSkyModulation, runSkyModulation, skyHeldKeys, skyModulationBinding, SKY_MODULATION_FACE, SKY_MODULATION_FAMILY, SKY_MODULATION_ID,
  useSkyModulationPlan, type SkyModulationPlan} from './skyModulation'
import {useQlSky, type QlSkyState} from '../../inhabitants/ql/devices/qlSky'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {DeviceDeclaration} from '../../inhabitants/sdk/define'
import type {LiveTorusState} from '../torusInstrument'
import './torusEffects.css'

/** What can be put on the chain, in the order the buttons stand: the four, then the Resonator bank. */
const ADDABLE = [...TORUS_EFFECTS, QL_RESONATOR_EFFECT] as const
const ADD_NOTE: Readonly<Record<(typeof ADDABLE)[number], string>> = {
  filter: 'Press to put it on the chain, after the others.', dynamics: 'Press to put it on the chain, after the others.',
  delay: 'Press to put it on the chain, after the others.', reverb: 'Press to put it on the chain, after the others.',
  resonator: 'Press to put it on the chain, after the others: one tuned body rings at each part of the M3 clock\'s cut.',
}

function TorusEffectOnChain({effect, state, first, refused, plan}: {effect: TorusEffect; state: LiveTorusState | null; first: boolean; refused: (error: unknown) => void; plan: SkyModulationPlan}) {
  const id = torusEffectId(effect), title = EFFECT_TITLES[effect]
  const device = useMemo(() => torusEffectDevice(effect, state), [effect, state])
  const held = useMemo(() => skyHeldKeys(effect, plan), [effect, plan])
  const binding = useMemo(() => torusEffectBinding(effect, state, held), [effect, state, held])
  useEffect(() => { publishDevice(id, {device, binding}) }, [id, device, binding])
  useEffect(() => () => publishDevice(id, null), [id])
  return <div className="chain-side" data-chain-effect={id}>
    <DeviceView device={device} binding={binding} size="compact" actions={[
      {icon: 'detail', label: `Show every ${title} setting in the pool`, onPress: () => selectDevice(id)},
      {icon: 'pane', label: `Open the ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title})},
      ...(first ? [] : [{icon: 'back' as const, label: `Move the ${title} one place earlier`, onPress: () => { moveTorusEffect(state, effect, -1).catch(refused) }}]),
    ]} />
  </div>
}

/** The Resonator bank (manual §22.7) as the chain's own: the catalogue's `quaternal-logic:resonator-bank` design on the stage's bank, the M3
 * clock's cut and the mode in force's root (inhabitants/ql/devices/qlResonatorBank.ts). The chain places, orders and takes it off as it does
 * the others; the stage is kept to the clock's cut and the mode's root by the follower in TorusEffectsOnChain. */
function ResonatorBankOnChain({state, first, refused, plan}: {state: LiveTorusState | null; first: boolean; refused: (error: unknown) => void; plan: SkyModulationPlan}) {
  const id = QL_RESONATOR_CHAIN_ID, title = EFFECT_TITLES[QL_RESONATOR_EFFECT]
  const {clock, mode} = useQlBankReadings()
  const held = useMemo(() => skyHeldKeys(QL_RESONATOR_EFFECT, plan), [plan])
  const device = useMemo(() => qlBankDevice(id, state, clock, mode), [id, state, clock, mode])
  const binding = useMemo(() => qlBankBinding(id, state, clock, mode, held), [id, state, clock, mode, held])
  useEffect(() => { publishDevice(id, {device, binding}) }, [id, device, binding])
  useEffect(() => () => publishDevice(id, null), [id])
  return <div className="chain-side" data-chain-effect={id}>
    <DeviceView device={device} binding={binding} size="compact" actions={[
      {icon: 'detail', label: `Show every ${title} setting in the pool`, onPress: () => selectDevice(id)},
      {icon: 'pane', label: `Open the ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title})},
      ...(first ? [] : [{icon: 'back' as const, label: `Move the ${title} one place earlier`, onPress: () => { moveTorusEffect(state, QL_RESONATOR_EFFECT, -1).catch(refused) }}]),
    ]} />
  </div>
}

/** The Sky modulator as a device of the runtime: its design is the whole of it (every setting is a route the design draws). */
const SKY_FACE = {id: SKY_MODULATION_FACE, title: 'Sky modulation', icon: 'live', liveSemantic: 'device-audio-fx',
  invariant: {transforms: 'the part\'s parameters, moved by the planets overhead'}, note: 'Hands the torus\'s and its effects\' parameters to the planets.'} as DeviceDeclaration

function SkyModulationOnChain({state, sky}: {state: LiveTorusState | null; sky: QlSkyState}) {
  const plan = useSkyModulationPlan()
  const device = useMemo((): DeviceInstance => ({id: SKY_MODULATION_ID, family: SKY_MODULATION_FAMILY, face: SKY_FACE, rows: [], values: {}}), [])
  const binding = useMemo(() => skyModulationBinding(state, sky), [state, sky, plan])
  useEffect(() => { publishDevice(SKY_MODULATION_ID, {device, binding}) }, [device, binding])
  useEffect(() => () => publishDevice(SKY_MODULATION_ID, null), [])
  return <div className="chain-side" data-chain-effect={SKY_MODULATION_ID}>
    <DeviceView device={device} binding={binding} size="compact" actions={[
      {icon: 'detail', label: 'Show every Sky modulation setting in the pool', onPress: () => selectDevice(SKY_MODULATION_ID)},
      {icon: 'pane', label: 'Open the Sky modulation full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: SKY_MODULATION_ID, title: 'Sky modulation'})},
    ]} />
  </div>
}

/** The effects the owner's chain names, in the order they sound, the Sky modulator when it is put on, and the place to put them on. */
export function TorusEffectsOnChain({state, tempoBpm = null}: {state: LiveTorusState | null; tempoBpm?: number | null}) {
  const chain = torusEffectsChain(state)
  const sky = useQlSky(), plan = useSkyModulationPlan()
  const [refusal, setRefusal] = useState<string | null>(null)
  const refused = (error: unknown) => setRefusal(error instanceof Error ? error.message : String(error))
  useEffect(() => { followSetTempo(state, tempoBpm).catch(refused) }, [state, tempoBpm])
  // The stage rings the clock's cut on the mode's root: told them while the bank stands on the chain (qlResonatorBank.ts qlBankFollow).
  useQlBankFollow(state, chain?.includes(QL_RESONATOR_EFFECT) ?? false, refused)
  // The sky moves what the plan routes, whenever the sky, the part's parameters or the plan change; a refusal is named below.
  useEffect(() => { runSkyModulation(state, sky).catch(refused) }, [state, sky, plan.placed, plan.on, plan.routes])
  if (chain === null) return null
  return <>
    {chain.map((effect, index) => effect === QL_RESONATOR_EFFECT
      ? <ResonatorBankOnChain key={effect} state={state} first={index === 0} refused={refused} plan={plan} />
      : <TorusEffectOnChain key={effect} effect={effect} state={state} first={index === 0} refused={refused} plan={plan} />)}
    {plan.placed && <SkyModulationOnChain state={state} sky={sky} />}
    <div className="torus-effects-add" role="group" aria-label="The torus's effects" data-chain-effects-add="">
      {ADDABLE.map(effect => {
        const on = chain.includes(effect), title = EFFECT_TITLES[effect]
        return <button key={effect} type="button" aria-pressed={on} data-i={`${title}|${on ? 'On the chain: press to take it off (it keeps its settings).' : ADD_NOTE[effect]}`}
          onClick={() => { setRefusal(null); (on ? removeTorusEffect(state, effect) : placeTorusEffect(state, effect)).catch(refused) }}>{title}</button>
      })}
      <button type="button" aria-pressed={plan.placed} data-i={`Sky modulation|${plan.placed ? 'On the chain: press to take it off; every parameter a planet moves goes back to its base.' : 'Press to put the Sky modulator on the chain: the planets overhead move the parameters you assign.'}`}
        onClick={() => { setRefusal(null); placeSkyModulation(!plan.placed) }}>Sky</button>
      {(refusal ?? plan.refusal) && <span role="alert" className="torus-effects-refusal">{refusal ?? plan.refusal}</span>}
    </div>
  </>
}
