import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {KernelProvider} from '../../../../../desktop/cradle/src/kernel/KernelProvider'
import {VisualsProvider} from '../../../../../desktop/cradle/src/visuals/ParticleExpression'
import {ExpressionStageProvider} from '../../../../../desktop/cradle/src/stage/ExpressionStage'
import {ExpressionProvider} from '../../../../../desktop/cradle/src/shared/Expression'
import {GroundChooser} from '../../../../../desktop/cradle/src/workspace/GroundChooser'
import {configureFileResourceHost} from '../../../../../desktop/cradle/src/files/resources'
import {configureWikiProjectionAccess, retireWikiProjectionAccess} from '../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import type {KernelEventReplay, KernelReceipt, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readShellConfig, shellTransport, invalidateSet, type ShellConfig} from './application'
import {connectNativeSettings} from './configuration'
import {configureSettingsHost} from '../settings/host'
import {unavailableSettingsAdapter} from '../settings/adapter'
import {useWorkspace} from '../shell/workspace'
import {ShellConfigContext} from '../shell/useSet'

function qualifiedWorld(reading: ShellConfig | null): reading is ShellConfig & {world_scope: NonNullable<ShellConfig['world_scope']> & {workcell_ref: string}} {
  const world = reading?.world_scope
  return world?.owner === 'central' && world.world === 'control:root'
    && typeof world.personal_ground === 'string' && !!world.personal_ground
    && typeof world.workcell_ref === 'string' && !!world.workcell_ref
}

/** The imported kernel model owns the single event subscription, buffers and
 * native surface lifecycle. Resource and settings consumers qualify that same
 * connection above disposable panes. */
export function NativeFoundation({children}: {children: ReactNode}) {
  const workspace = useWorkspace()
  const currentWorkspace = useRef(workspace)
  currentWorkspace.current = workspace
  const live = useRef(false)
  const accessGeneration = useRef(0)
  const [config, setConfig] = useState<ShellConfig | null>(null)
  const [attempt, retry] = useState(0)
  const [pending, setPending] = useState(true)
  const [fault, setFault] = useState<string | null>(null)
  const [replayFault, setReplayFault] = useState<string | null>(null)
  // The qualified host can disclose state and recognise a personal ground
  // before a World is selected. World-bound resources remain retired below.
  const transportKey = JSON.stringify(config ? shellTransport(config) : {kind: 'unavailable', reason: 'The native host connection has not been read.'})
  const transport = useMemo<KernelTransportStatus>(() => JSON.parse(transportKey), [transportKey])
  const showFailure = useCallback((cause: unknown) => {if (live.current) setFault(cause instanceof Error ? cause.message : String(cause))}, [])
  const showReplayFailure = useCallback((error: string) => {if (live.current) setReplayFault(error)}, [])
  const replayHealthy = useCallback(() => {if (live.current) setReplayFault(null)}, [])
  const retire = useCallback(() => {
    ++accessGeneration.current
    retireWikiProjectionAccess()
    configureFileResourceHost(null)
    currentWorkspace.current.attachNativeAccess(null)
    currentWorkspace.current.attachTransport({kind: 'unavailable', reason: 'The native access reading has retired.'})
  }, [])
  const qualify = useCallback(async (reading: ShellConfig, ownerGeneration: string) => {
    const generation = ++accessGeneration.current
    const access = shellTransport(reading)
    if (access.kind === 'unavailable') {
      retire(); currentWorkspace.current.attachTransport(access)
      configureSettingsHost(unavailableSettingsAdapter(access.reason))
      showFailure(access.reason)
      throw Error(access.reason)
    }
    if (!qualifiedWorld(reading)) {
      retire()
      const reason = reading.world_error ?? (reading.onboarding ? 'Choose the native personal ground to open its work.' : 'The host has not disclosed its native World and physical Workcell binding.')
      currentWorkspace.current.attachTransport(access)
      configureSettingsHost(unavailableSettingsAdapter(reason))
      setFault(reading.onboarding ? null : reason)
      return
    }
    const world = reading.world_scope
    const ownerEpoch = `${reading.kernel_epoch ?? reading.kernel_bridge}|${ownerGeneration}|${generation}`
    const isCurrent = () => live.current && generation === accessGeneration.current
    try {
      currentWorkspace.current.attachTransport(access)
      configureWikiProjectionAccess(JSON.stringify([world.owner, world.world, world.personal_ground, world.workcell_ref, reading.backing_id]), ownerEpoch, isCurrent)
      configureFileResourceHost({transport: access, scope: {owner: world.owner, world: world.world, workcell: world.workcell_ref, accessEpoch: ownerEpoch}}, isCurrent)
      currentWorkspace.current.attachNativeAccess({transport: access, scope: {
        owner: world.owner, world: world.world, workcell: world.workcell_ref, accessEpoch: ownerEpoch,
      }})
      const adapter = await connectNativeSettings(access, {ownerEpoch, isCurrent,
      scopeChoices: [
        {address: {scope_kind: 'world', scope_ref: null}, title: 'Current World'},
        {address: {scope_kind: 'ground', scope_ref: null}, title: 'Personal ground'},
        {address: {scope_kind: 'machine', scope_ref: null}, title: 'This machine'},
        {address: {scope_kind: 'workcell', scope_ref: world.workcell_ref}, title: world.workcell_ref},
      ],
      })
      if (!isCurrent()) return
      configureSettingsHost(adapter)
      setFault(null)
    } catch (cause) {
      if (!isCurrent()) return
      showFailure(cause)
      configureSettingsHost(unavailableSettingsAdapter(cause instanceof Error ? cause.message : String(cause)))
      throw cause
    }
  }, [retire, showFailure])
  useEffect(() => {
    live.current = true
    let cancelled = false
    setPending(true)
    const request = ++accessGeneration.current
    void readShellConfig(attempt > 0).then(async reading => {
      if (cancelled || !live.current || request !== accessGeneration.current) return
      setConfig(reading)
      try {
        await qualify(reading, '')
      } catch { /* Qualification publishes its failure under the captured owner epoch. */ }
    }, cause => {
      if (cancelled || !live.current || request !== accessGeneration.current) return
      showFailure(cause)
      configureSettingsHost(unavailableSettingsAdapter(cause instanceof Error ? cause.message : String(cause)))
    }).finally(() => {if (!cancelled && live.current) setPending(false)})
    return () => {cancelled = true; live.current = false; retire()}
  }, [attempt, qualify, retire, showFailure])
  const receive = useCallback((receipts: KernelReceipt[]) => {
    if (!live.current) return
    currentWorkspace.current.publishReceipts(receipts)
    const changed = new Set(receipts.filter(row => row.event === 'file_changed' && typeof row.path === 'string').map(row => row.path as string))
    for (const path of changed) invalidateSet(path)
  }, [])
  const resync = useCallback(async (page: KernelEventReplay, lifetime: {signal: AbortSignal; isCurrent: () => boolean}) => {
    if (!live.current || !lifetime.isCurrent()) return
    // KernelProvider retired access before its targeted native World reread.
    const reading = await readShellConfig(true)
    if (!live.current || !lifetime.isCurrent()) return
    setConfig(reading)
    await qualify(reading, page.generation)
    if (!live.current || !lifetime.isCurrent()) return
    invalidateSet()
  }, [qualify])
  const failure = fault ?? replayFault
  const error = failure && <div className="native-foundation-fault" role="alert">{failure} {fault && <button type="button" disabled={pending} onClick={() => {
    retire(); currentWorkspace.current.attachTransport({kind: 'unavailable', reason: 'Reading the native World…'})
    setConfig(null); setFault(null); retry(value => value + 1)
  }}>Retry native read</button>}</div>
  const operationEpoch = JSON.stringify([config?.kernel_epoch, config?.runtime_scope, config?.world_scope, config?.backing_id, config?.kernel_bridge])
  return <ShellConfigContext.Provider value={config}><KernelProvider transport={transport} operationEpoch={operationEpoch} onReceipts={receive}
    onAccessRetired={retire} onResync={resync} onSubscriptionError={showReplayFailure} onSubscriptionHealthy={replayHealthy}>
    <VisualsProvider><ExpressionStageProvider><ExpressionProvider>
      {error}{pending && <div className="native-foundation-pending" role="status">Reading the native World…</div>}{config?.onboarding && <GroundChooser/>}{children}
    </ExpressionProvider></ExpressionStageProvider></VisualsProvider>
  </KernelProvider></ShellConfigContext.Provider>
}
