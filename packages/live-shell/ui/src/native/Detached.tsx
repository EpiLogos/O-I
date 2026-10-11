import {useCallback, useRef} from 'react'
import {DetachedFrame} from '../../../../../desktop/cradle/src/workspace/DetachedFrame'
import {checkpointDocuments} from '../../../../../desktop/cradle/src/document/frame'
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import {CANDIDATE_WORKSPACE_KEY} from '../continuity/workspace'
import {useWorkspace} from '../shell/workspace'
import {readShellConfig} from './application'
import {admitContribution} from './contributions'
import {nativeDetachedBodySupported} from './detachedKinds'

/** Receives the original Windows owner's existing binding; no surface/session
 * is opened again and the original frame owns redock and navigation contracts. */
export function NativeDetached() {
  const workspace = useWorkspace()
  const latest = useRef(workspace)
  latest.current = workspace
  const current = (epoch: number) => {
    if (!latest.current.accessReady || !latest.current.nativeAccessCurrent(epoch)) throw Error('The detached native World/access epoch is unavailable or has retired.')
  }
  const admitBinding = useCallback(async (binding: SurfaceBinding) => {
    const epoch = latest.current.accessEpoch
    current(epoch)
    if (!nativeDetachedBodySupported(binding.kind)) throw Error('This surface has no native detached receiving body. Its binding has been retained.')
    const config = await readShellConfig()
    current(epoch)
    admitContribution(binding, config.product_ids, config.contributions)
  }, [])
  const beforeRelease = useCallback(async (binding: SurfaceBinding) => {
    const epoch = latest.current.accessEpoch
    current(epoch)
    await checkpointDocuments([binding.id])
    current(epoch)
  }, [])
  return <DetachedFrame workspaceStorageKey={CANDIDATE_WORKSPACE_KEY} admitBinding={admitBinding}
    beforeRelease={beforeRelease} ownerEpoch={`${workspace.accessEpoch}:${workspace.accessReady}`} />
}
