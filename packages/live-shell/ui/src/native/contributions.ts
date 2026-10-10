import {hostedSurfaceFor} from '../../../../../desktop/cradle/src/contributions/registry'
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import {nativeHost, type NativeContributionReading} from './application'

export function contributionRegistrationFailure(descriptor: {contribution_ref: string; owner: string; revision: number; title: string}, contributions?: readonly NativeContributionReading[]): string | undefined {
  if (!contributions) return nativeHost() ? 'The installed host did not disclose native contribution admission. Keep the saved binding open.' : undefined
  const reading = contributions.find(item => item.contribution_ref === descriptor.contribution_ref)
  if (!reading || reading.owner !== descriptor.owner || reading.revision !== descriptor.revision || !reading.compiled || !reading.owner_selected || reading.registration !== 'registered')
    return reading?.failure || `${descriptor.title} has no matching native contribution registration. Its saved binding has been retained.`
}

/** Compiled identity and selected payload membership are admission inputs;
 * each native owner still establishes its current runtime and operation result. */
export function contributionUnavailable(binding: SurfaceBinding, productIds?: readonly string[], contributions?: readonly NativeContributionReading[]): string | undefined {
  const registered = hostedSurfaceFor(binding)
  if (binding.hosted && !registered) return 'This saved contribution is unavailable in this build. Its binding and descriptor identity have been retained.'
  if (!registered) return undefined
  if (!productIds) return 'The current native backing reading is unavailable; this compiled contribution binding has been retained.'
  const failure = contributionRegistrationFailure(registered.descriptor, contributions)
  if (failure) return failure
  if (binding.kind === 'epi-logos' && !productIds.includes('quaternal-logic')) return 'Epi-Logos is unavailable because its native Quaternal Logic owner is excluded from this backing.'
  const owner = registered.descriptor.owner
  if (owner !== 'oi' && !productIds.includes(owner)) return `${registered.descriptor.title} is unavailable because its native ${owner} owner is excluded from this backing.`
  return undefined
}

export function admitContribution(binding: SurfaceBinding, productIds?: readonly string[], contributions?: readonly NativeContributionReading[]): void {
  const unavailable = contributionUnavailable(binding, productIds, contributions)
  if (unavailable) throw Error(unavailable)
}
