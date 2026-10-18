// The torus's effects on Live's chain, after the torus (manual §21.5; DLW §21.1: the instrument, then its effects): the ones the owner's
// chain names, in the order they sound, each through the device runtime at the chain's compact size and published with its binding so
// the pool, a pane, a pop-out and the rail draw its catalogue design (inhabitants/catalogue/panels/live__<effect>.tsx) on the same owner.
// After them stands the place to put the others on: each of the four, pressed while it is on the chain; a press puts it on at the end
// or takes it off (it keeps its settings), and an effect's ◂ moves it one place earlier — the chain's owner's own acts, until Live's
// browser drag and the head's Delete reach this chain. The Delay's tempo is kept on the set's (`tempoBpm`, the transport's reading).
// The owner and its law are torusEffects.ts's (this folder). The chain places this after TorusOnChain.
import {useEffect, useMemo, useState} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import {openInstrument} from '../../frame/instrumentDoor'
import {EFFECT_TITLES} from '@epilogos/expressions-boundary'
import {TORUS_EFFECTS, followSetTempo, moveTorusEffect, placeTorusEffect, removeTorusEffect, torusEffectBinding, torusEffectDevice, torusEffectId,
  torusEffectsChain, type TorusEffect} from './torusEffects'
import type {LiveTorusState} from '../torusInstrument'
import './torusEffects.css'

function TorusEffectOnChain({effect, state, first, refused}: {effect: TorusEffect; state: LiveTorusState | null; first: boolean; refused: (error: unknown) => void}) {
  const id = torusEffectId(effect), title = EFFECT_TITLES[effect]
  const device = useMemo(() => torusEffectDevice(effect, state), [effect, state])
  const binding = useMemo(() => torusEffectBinding(effect, state), [effect, state])
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

/** The effects the owner's chain names, in the order they sound, and the place to put the others on. */
export function TorusEffectsOnChain({state, tempoBpm = null}: {state: LiveTorusState | null; tempoBpm?: number | null}) {
  const chain = torusEffectsChain(state)
  const [refusal, setRefusal] = useState<string | null>(null)
  const refused = (error: unknown) => setRefusal(error instanceof Error ? error.message : String(error))
  useEffect(() => { followSetTempo(state, tempoBpm).catch(refused) }, [state, tempoBpm])
  if (chain === null) return null
  return <>
    {chain.map((effect, index) => <TorusEffectOnChain key={effect} effect={effect} state={state} first={index === 0} refused={refused} />)}
    <div className="torus-effects-add" role="group" aria-label="The torus's effects" data-chain-effects-add="">
      {TORUS_EFFECTS.map(effect => {
        const on = chain.includes(effect), title = EFFECT_TITLES[effect]
        return <button key={effect} type="button" aria-pressed={on} data-i={`${title}|${on ? 'On the chain: press to take it off (it keeps its settings).' : 'Press to put it on the chain, after the others.'}`}
          onClick={() => { setRefusal(null); (on ? removeTorusEffect(state, effect) : placeTorusEffect(state, effect)).catch(refused) }}>{title}</button>
      })}
      {refusal && <span role="alert" className="torus-effects-refusal">{refusal}</span>}
    </div>
  </>
}
