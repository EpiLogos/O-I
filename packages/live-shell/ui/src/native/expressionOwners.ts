import {createCradleOwners} from '@epilogos/expressions-boundary/cradle'
import type {ChannelContext, ExpressionsOwners} from '@epilogos/expressions-boundary'
import type {WorkspaceReading} from '../shell/workspace'
import {readShellConfig, type ShellConfig} from './application'
import {createNativeTimeWindowOwner,type NativeTimeWindowBasis} from '@epilogos/expressions-boundary/time-window'
import {disclosureSession} from '../../../../../desktop/cradle/src/techne/session'
import {object,type TechneReading} from '@epilogos/expressions-boundary'
import {NARA_CHANNEL_REGISTER} from '../agent/worldScope'

const identity = (config: ShellConfig) => JSON.stringify([config.world_scope, config.backing_id, config.profile_scope ?? null])

/** Retain the application and its dirty work. Qualify each owner acquisition
 * independently; reconnect changes access without changing document identity. */
export function qualifiedExpressionOwners(initial: ShellConfig, current: () => WorkspaceReading, live: () => boolean): ExpressionsOwners {
  const boundIdentity = identity(initial)
  const base = createCradleOwners(current().transport, {project: NARA_CHANNEL_REGISTER, personal: false})
  // This canonical host session survives fresh per-request native facades.
  // The retained iframe receives readings only, never another session store.
  const time = createNativeTimeWindowOwner({store:disclosureSession})
  const leases = new Map<string, ExpressionsOwners>()
  const qualify = async (context: ChannelContext) => {
    const origin = current(), epoch = origin.accessEpoch
    if (!live() || !origin.accessReady || !context.current()) throw Error('The native owner is reconnecting; this work remains open')
    const config = await readShellConfig()
    const isCurrent = () => live() && context.current() && current().accessReady && current().nativeAccessCurrent(epoch)
    if (!isCurrent()) throw Error('This request belongs to a retired native access')
    if (identity(config) !== boundIdentity) throw Error('This open work belongs to another native ground or installation profile')
    const owners = createCradleOwners(origin.transport, {project: NARA_CHANNEL_REGISTER, personal: false, isCurrent,
      onReceipts: rows => {if (isCurrent()) current().publishReceipts(rows)},
    })
    return {owners, context: {...context, current: isCurrent}, isCurrent}
  }
  const presentsBasis=(context:ChannelContext,request:Record<string,unknown>)=>{
    const scene=(context as {state?:{nativeScene?:NativeTimeWindowBasis}}).state?.nativeScene
    return !!scene&&scene.expression_ref===request.expression_ref&&scene.revision===request.revision&&scene.scene_ref===request.scene_ref
  }
  return {
    channels: {...Object.fromEntries(Object.keys(base.channels).map(channel => [channel, async (request: unknown, context: ChannelContext) => {
      const access = await qualify(context)
      const result = await access.owners.channels[channel](request, access.context)
      if (!access.isCurrent()) throw Error('The owner reply belongs to a retired native access; reread this work')
      // The shared-time slot holds the presented Scene's own reading: admit only an unscoped, facet-less read of exactly
      // that Scene. A Journey's per-card scene reads are not the presented reading.
      if(channel==='techne-reading'&&object(request)&&request.facet===undefined&&request.scope===undefined&&presentsBasis(access.context,request))time.admit(request as unknown as NativeTimeWindowBasis,result as TechneReading,access.context)
      // Lane-5 T10/T11: the Journey's whole-Expression reading at the presented Scene is its own admission, the only authority
      // a crossing targets and a return restores by ref. An admission it cannot take is simply not admitted: the crossing refuses by name.
      if(channel==='techne-reading'&&object(request)&&request.facet===undefined&&request.scope==='expression'&&presentsBasis(access.context,request))
       try{time.admitJourney({expression_ref:request.expression_ref,revision:request.revision,scene_ref:request.scene_ref} as unknown as NativeTimeWindowBasis,result as TechneReading,access.context)}catch{/* not admitted */}
      return result
    }])), 'techne-time-window':async(request,context)=>{
      const access=await qualify(context)
      return time.handle(request,access.context)
    }},
    native: async (request, context) => {
      const message = request as {operation?: string; lease?: string}
      if (message.operation === 'close' && message.lease && leases.has(message.lease)) {
        const owner = leases.get(message.lease)!
        const result = await owner.native!(request, context)
        leases.delete(message.lease)
        return result
      }
      const access = await qualify(context)
      const result = await access.owners.native!(request, access.context)
      const lease = (result as {lease?: unknown} | null)?.lease
      if (!access.isCurrent()) {
        if (message.operation === 'open' && typeof lease === 'string') await access.owners.native!({operation: 'close', lease}, context)
        throw Error('The native Expression reply belongs to retired access')
      }
      if (message.operation === 'open' && typeof lease === 'string') leases.set(lease, access.owners)
      return result
    },
  }
}
