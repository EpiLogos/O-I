import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { HostedAppState } from '@epilogos/expressions-boundary'
import type { KernelReceipt, KernelTransportStatus, NativeFileReading } from '@epilogos/expressions-boundary/cradle'
import type { NativeEditorController, NativeEditorReading } from '@epilogos/expressions-boundary/editor'
import { ContinuityResources, ContinuityResidency, useContinuity, type FileResourceAccess, type ResourceIntent } from '../continuity'
import { groupsOf, openBinding } from '../../../../../desktop/cradle/src/surface/engine'
import type { CentralLocation } from '../../../../../desktop/cradle/src/kernel/location'
import { CANDIDATE_WARM_WORKSPACE_LIMIT, retainSourceReading } from '../continuity/resources'
import { Workspace } from './workspaceContext'
import type { FileResourceScope } from '../../../../../desktop/cradle/src/files/resources'
import type { WorkspaceMode, WorkspaceReading } from './workspaceTypes'
import type { SurfaceBinding } from '../../../../../desktop/cradle/src/surface/types'
export type { WorkspaceMode, WorkspaceReading } from './workspaceTypes'
export { useWorkspace, StubWorkspaceProvider } from './workspaceContext'
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const continuity = useContinuity()
  const current = useRef(continuity)
  current.current = continuity
  const [resources] = useState(() => new ContinuityResources())
  const [residency] = useState(() => new ContinuityResidency())
  const accessGeneration = useRef(0)
  const [accessEpoch, setAccessEpoch] = useState(0)
  const [accessReady, setAccessReady] = useState(false)
  const [nativeScope, setNativeScope] = useState<Readonly<FileResourceScope> | null>(null)
  const accessReadyRef = useRef(false)
  const heldNativeAccess = useRef<FileResourceAccess | null>(null)
  const nativeAccessCurrent = useCallback((epoch: number) => accessReadyRef.current && epoch === accessGeneration.current && resources.hasAccess(), [resources])
  const [sourceErrors, setSourceErrors] = useState<ReadonlyMap<string, string>>(() => new Map())
  const sourceError = sourceErrors.get(continuity.current.id) ?? null
  const setSourceError = useCallback((workspaceId: string, reason: string | null) => {
    setSourceErrors(previous => {
      const next = new Map(previous)
      next.delete(workspaceId)
      if (reason) next.set(workspaceId, reason)
      while (next.size > CANDIDATE_WARM_WORKSPACE_LIMIT) next.delete(next.keys().next().value!)
      return next
    })
  }, [])
  const [nativeWorks, publishWorks] = useState<WorkspaceReading['nativeWorks']>([])
  const [expressionToOpen, openExpression] = useState<WorkspaceReading['expressionToOpen']>(null)
  const requestExpression = (ref: string) => openExpression(current => ({ ref, request: (current?.request ?? 0) + 1 }))
  // The spine's cut reading (see workspaceTypes): the continuity ShellMode
  // is the Rev-5 mode; Base·Central stands on the audio cut, Factory's
  // agency surface stands on the Expressions cut (as the agent surface
  // always has).
  const mode: WorkspaceMode = continuity.mode === 'expressions' || continuity.mode === 'techne'
    ? continuity.mode
    : continuity.mode === 'factory' ? 'expressions' : 'audio'
  const setMode = (next: WorkspaceMode) => continuity.setMode(next)
  const [transport, setTransport] = useState<KernelTransportStatus>({kind:'unavailable',reason:'Native owner configuration is loading'})
  const transportRef = useRef(transport)
  const [reading, publishReading] = useState<HostedAppState | null>(null)
  const [editor, attachEditor] = useState<NativeEditorController | null>(null)
  const [editorReading, publishEditorReading] = useState<NativeEditorReading | null>(null)
  const [receipts, setReceipts] = useState<readonly KernelReceipt[]>([])
  const [sources, setSources] = useState<ReadonlyMap<string, NativeFileReading>>(() => new Map())
  const sourceReadings = useRef(sources)
  sourceReadings.current = sources
  const sourceRequests = useRef(new Map<string, number>())
  const clearedSources = useRef(new Set<string>())
  const openingBindings = useRef(new Map<string, SurfaceBinding>())
  const [recoveredScopes, setRecoveredScopes] = useState<ReadonlySet<string>>(() => new Set())
  const [settledScopes, setSettledScopes] = useState<ReadonlySet<string>>(() => new Set())
  const selectedSource = sources.get(continuity.current.id) ?? null
  const attachNativeAccess = useCallback((access: FileResourceAccess | null) => {
    heldNativeAccess.current = access ? {transport: {...access.transport}, scope: {...access.scope}} : null
    ++accessGeneration.current; resources.retire()
    setAccessEpoch(accessGeneration.current); openingBindings.current.clear(); setRecoveredScopes(new Set()); setSettledScopes(new Set()); setSourceErrors(new Map())
    accessReadyRef.current = false
    setAccessReady(false)
    if (access) {
      resources.attach(access)
      setNativeScope(Object.freeze({...access.scope}))
      transportRef.current = access.transport; setTransport(access.transport)
      accessReadyRef.current = true
      setAccessReady(true)
    }
  }, [resources])
  const attachTransport = useCallback((next: KernelTransportStatus) => {
    if (JSON.stringify(transportRef.current) !== JSON.stringify(next)) {
      heldNativeAccess.current = null
      ++accessGeneration.current; resources.retire()
      setAccessEpoch(accessGeneration.current); setAccessReady(false); accessReadyRef.current = false; setRecoveredScopes(new Set()); setSettledScopes(new Set())
    }
    transportRef.current = next; setTransport(next)
  }, [resources])
  const prepareSource = (location: CentralLocation) => {
    if (!location.ref || !accessReady) throw Error('Opening a source requires its current native address and access')
    const book = current.current
    const held = Object.values(book.current.layout.surfaces).find(binding => binding.kind === 'file' && binding.ref === location.ref)
    const binding = held ?? {id: crypto.randomUUID(), kind: 'file', ref: location.ref, location, title: location.path.split('/').pop() ?? location.path}
    openingBindings.current.set(binding.id, binding)
    sourceRequests.current.set(book.current.id,(sourceRequests.current.get(book.current.id) ?? 0) + 1)
    book.setLayout(layout => openBinding(layout, binding))
    return binding.id
  }
  const publishSource = (source: NativeFileReading, intent: ResourceIntent) => {
    if (!intent.isCurrent() || intent.workspaceId !== current.current.current.id) return
    if (!source.location.ref || !source.revision) throw Error('The native source has no qualified subject or revision')
    const binding = openingBindings.current.get(intent.viewId)
    if (!binding || binding.ref !== source.location.ref || binding.location?.root !== source.location.root || binding.location.path !== source.location.path) throw Error('The reading does not qualify its originating file binding')
    clearedSources.current.delete(intent.workspaceId)
    setSources(previous => retainSourceReading(previous,intent.workspaceId,source)); setSourceError(intent.workspaceId,null)
    setRecoveredScopes(previous => new Set(previous).add(`${accessGeneration.current}:${intent.workspaceId}`))
    setSettledScopes(previous => new Set(previous).add(`${accessGeneration.current}:${intent.workspaceId}`))
    const book = current.current
    // Native writer targets this binding even after its mode becomes inactive.
    book.replaceSurface(intent.workspaceId, {...binding, location: source.location})
    openingBindings.current.delete(intent.viewId)
    book.rememberPlace({kind: 'file', label: source.location.path.split('/').pop() ?? source.location.path, path: source.location.path, ref: source.location.ref, location: source.location}, intent.workspaceId)
  }
  const selectSource = (source: NativeFileReading | null) => {
    const workspaceId = current.current.current.id
    if (!source) {setSourceError(workspaceId,null); clearedSources.current.add(workspaceId); sourceRequests.current.set(workspaceId,(sourceRequests.current.get(workspaceId) ?? 0) + 1); setSources(previous => {const next = new Map(previous); next.delete(workspaceId); return next}); return}
    const generation = accessGeneration.current
    publishSource(source, {workspaceId, viewId: prepareSource(source.location), generation, isCurrent: () => generation === accessGeneration.current && workspaceId === current.current.current.id})
  }
  const currentLayout = continuity.current.layout
  const focusedId = currentLayout.focusedTabId ?? groupsOf(currentLayout.root).find(group => group.id === currentLayout.focusedGroupId)?.active
  const focusedSource = focusedId ? currentLayout.surfaces[focusedId] : undefined
  const recentSource = continuity.current.recentPlaces?.find(place => place.kind === 'file' && place.location?.ref)
  const recoveryLocation = selectedSource?.location ?? (focusedSource?.kind === 'file' ? focusedSource.location : recentSource?.location)
  const recoveryKey = `${accessEpoch}:${continuity.current.id}`
  const settledProjection = settledScopes.has(recoveryKey) && (!!selectedSource || !recoveredScopes.has(recoveryKey))
  const sourceRecoveryReady = !recoveryLocation?.ref || openingBindings.current.has(focusedSource?.id ?? '') || clearedSources.current.has(continuity.current.id) || settledProjection
  const sourceReadingCurrent = !!selectedSource && accessReady && recoveredScopes.has(recoveryKey)
  const revalidateSource = useCallback(async (invalidate = true): Promise<boolean> => {
    const book = current.current
    const workspaceId = book.current.id
    const source = sourceReadings.current.get(workspaceId)
    if (!source?.location.ref || !accessReadyRef.current || clearedSources.current.has(workspaceId)) return false
    const epoch = accessGeneration.current
    const scope = `${epoch}:${workspaceId}`
    setRecoveredScopes(previous => {const next = new Set(previous); next.delete(scope); return next})
    const request = (sourceRequests.current.get(workspaceId) ?? 0) + 1
    sourceRequests.current.set(workspaceId,request)
    const layouts = [book.current.layout,...Object.values(book.current.modeLayouts ?? {})]
    const binding = layouts.flatMap(layout => Object.values(layout.surfaces)).find(binding => binding.kind === 'file' && binding.ref === source.location.ref && binding.location?.root === source.location.root && binding.location.path === source.location.path)
    const isCurrent = () => {
      if (epoch !== accessGeneration.current || request !== sourceRequests.current.get(workspaceId) || workspaceId !== current.current.current.id || clearedSources.current.has(workspaceId)) return false
      const selected = sourceReadings.current.get(workspaceId)
      if (selected?.location.ref !== source.location.ref || selected.location.root !== source.location.root || selected.location.path !== source.location.path) return false
      if (!binding) return true
      return [current.current.current.layout,...Object.values(current.current.current.modeLayouts ?? {})].some(layout => {
        const held = layout.surfaces[binding.id]
        return held?.ref === source.location.ref && held.location?.root === source.location.root && held.location.path === source.location.path
      })
    }
    const intent: ResourceIntent = {workspaceId,viewId:binding?.id ?? 'source-recovery',generation:epoch,isCurrent}
    try {
      const reading = await (invalidate ? resources.revalidate(source.location,intent) : resources.read(source.location,intent))
      if (!isCurrent()) return false
      setSources(previous => retainSourceReading(previous,workspaceId,reading)); setSourceError(workspaceId,null)
      setRecoveredScopes(previous => new Set(previous).add(`${epoch}:${workspaceId}`))
      setSettledScopes(previous => new Set(previous).add(scope))
      return true
    } catch (reason) {
      if (isCurrent()) {setSourceError(workspaceId,reason instanceof Error ? reason.message : String(reason)); setSettledScopes(previous => new Set(previous).add(scope))}
      return false
    }
  }, [resources, setSourceError])
  useEffect(() => {
    if (!accessReady || sourceRecoveryReady) return
    const workspaceId = continuity.current.id
    const epoch = accessGeneration.current
    const location = recoveryLocation
    if (!location?.ref) return
    // An admitted reading whose disposable projection was released must
    // reconstruct from its retained native address before directory work.
    setRecoveredScopes(previous => {const next = new Set(previous); next.delete(recoveryKey); return next})
    setSettledScopes(previous => {const next = new Set(previous); next.delete(recoveryKey); return next})
    let live = true
    const request = (sourceRequests.current.get(workspaceId) ?? 0) + 1
    sourceRequests.current.set(workspaceId,request)
    const intent: ResourceIntent = {workspaceId, viewId: focusedSource?.id ?? 'source-recovery', generation: epoch, isCurrent: () => live && request === sourceRequests.current.get(workspaceId) && epoch === accessGeneration.current && workspaceId === current.current.current.id && !clearedSources.current.has(workspaceId)}
    // Stored native addresses recover without a listing or invented path ref.
    void resources.read(location, intent).then(source => {
      if (intent.isCurrent()) {
        setSources(previous => retainSourceReading(previous,workspaceId,source)); setSourceError(workspaceId,null)
        setRecoveredScopes(previous => new Set(previous).add(recoveryKey))
        setSettledScopes(previous => new Set(previous).add(recoveryKey))
      }
    }).catch(reason => {if (intent.isCurrent()) {setSourceError(workspaceId,reason instanceof Error ? reason.message : String(reason)); setSettledScopes(previous => new Set(previous).add(recoveryKey))}})
    return () => {live = false}
  }, [continuity.current.id, accessEpoch, accessReady, resources, sourceRecoveryReady, recoveryLocation, recoveryKey, focusedSource?.id, setSourceError])
  useEffect(() => {
    // A disposable presentation refresh can preserve this resource owner.
    // Rejoin only its exact held admission, after retiring all prior intents.
    const access = heldNativeAccess.current
    if (access && !resources.hasAccess()) {
      resources.attach(access); accessReadyRef.current = true
      setAccessEpoch(accessGeneration.current); setAccessReady(true)
    }
    return () => {++accessGeneration.current; accessReadyRef.current = false; resources.retire()}
  }, [resources])
  const publishReceipts = (rows: readonly KernelReceipt[]) => {
    let refresh = false
    const selected = sourceReadings.current.get(current.current.current.id)
    for (const receipt of rows) if (resources.receipt(receipt) && receipt.path === selected?.location.path) refresh = true
    setReceipts(current => [...current, ...rows].slice(-64))
    if (refresh) void revalidateSource(false)
  }
  const browserPath = continuity.current.projectNavigation?.['control:root']?.locationPath ?? ''
  const navigateFiles = (path: string) => continuity.setProjectNavigation('control:root', {mode: 'files', locationPath: path}, continuity.current.id)
  return <Workspace.Provider value={{ workspaceId: continuity.current.id, resources, residency, accessEpoch, accessReady, nativeScope, nativeAccessCurrent, attachNativeAccess, sourceError, sourceRecoveryReady, sourceReadingCurrent, prepareSource, publishSource, browserPath, navigateFiles, nativeWorks, publishWorks, expressionToOpen, requestExpression, mode, setMode, transport, attachTransport, reading, publishReading, editor, attachEditor, editorReading, publishEditorReading, receipts, publishReceipts, revalidateSource, selectedSource, selectedRef: selectedSource?.location.ref ?? null, selectSource }}>{children}</Workspace.Provider>
}
