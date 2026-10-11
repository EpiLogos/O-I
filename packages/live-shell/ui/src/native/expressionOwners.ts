import {createCradleOwners} from '@epilogos/expressions-boundary/cradle'
import type {ChannelContext, ExpressionsOwners} from '@epilogos/expressions-boundary'
import type {WorkspaceReading} from '../shell/workspace'
import {readShellConfig, type ShellConfig} from './application'
import {createNativeTimeWindowOwner,type NativeTimeWindowBasis} from '@epilogos/expressions-boundary/time-window'
import {disclosureSession} from '../../../../../desktop/cradle/src/techne/session'
import {object,type TechneReading} from '@epilogos/expressions-boundary'

const identity = (config: ShellConfig) => JSON.stringify([config.world_scope, config.backing_id, config.profile_scope ?? null])

/** Retain the application and its dirty work. Qualify each owner acquisition
 * independently; reconnect changes access without changing document identity. */
export function qualifiedExpressionOwners(initial: ShellConfig, current: () => WorkspaceReading, live: () => boolean): ExpressionsOwners {
  const boundIdentity = identity(initial)
  const base = createCradleOwners(current().transport, {project: 'O-I', personal: false})
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
    const owners = createCradleOwners(origin.transport, {project: 'O-I', personal: false, isCurrent,
      onReceipts: rows => {if (isCurrent()) current().publishReceipts(rows)},
    })
    return {owners, context: {...context, current: isCurrent}, isCurrent}
  }
  return {
    channels: {...Object.fromEntries(Object.keys(base.channels).map(channel => [channel, async (request: unknown, context: ChannelContext) => {
      const access = await qualify(context)
      const result = await access.owners.channels[channel](request, access.context)
      if (!access.isCurrent()) throw Error('The owner reply belongs to a retired native access; reread this work')
      if(channel==='techne-reading'&&object(request)&&request.facet===undefined)time.admit(request as unknown as NativeTimeWindowBasis,result as TechneReading,access.context)
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
