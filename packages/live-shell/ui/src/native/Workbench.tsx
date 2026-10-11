import {contributionUnavailable} from './contributions'
import {nativeDetachedBodySupported} from './detachedKinds'
/** Receiving frame over the original native Workbench and the one continuity book. */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Workbench, GroupPane, type WorkbenchProps} from '../../../../../desktop/cradle/src/surface/Workbench'
import {ProjectionEncounterProvider} from '../../../../../desktop/cradle/src/surface/projectionPane'
import {createSpineEncounterBridge} from '../projections/encounterBridge'
import {ContextMenu, type MenuState} from '../../../../../desktop/cradle/src/surface/ContextMenu'
import {bindingDisclosures, frameDisclosures, executeFrameAction} from '../../../../../desktop/cradle/src/surface/registry'
import {activeBindingId, detachBinding, groupsOf, makeSourceBinding, openBinding} from '../../../../../desktop/cradle/src/surface/engine'
import {frameActionForKey} from '../../../../../desktop/cradle/src/surface/keys'
import type {ActionArg, LayoutState, RestorePoint, SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import {useKernel} from '../../../../../desktop/cradle/src/kernel/KernelProvider'
import type {ListedSource, CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'
import {acquireFileReading, acquireFileBytes} from '../../../../../desktop/cradle/src/files/resources'
import {fileOperation, type FileMutation} from '../../../../../desktop/cradle/src/files/client'
import {detectFormat} from '../../../../../desktop/cradle/src/material/detect'
import {encounter, encounterProvision} from '../../../../../desktop/cradle/src/encounter/client'
import type {EncounterRow} from '../../../../../desktop/cradle/src/encounter/EncounterList'
import {checkpointDocuments} from '../../../../../desktop/cradle/src/document/frame'
import {readDraft} from '../../../../../desktop/cradle/src/workspace/drafts'
import {bindScopeWriter, publishScope, publishFocusedProject, scopeFromWorkspace, scopeProject} from '../../../../../desktop/cradle/src/workspace/scope'
import {FactoryLiveProvider} from '../../../../../desktop/cradle/src/contributions/factory/FactoryLive'
import {publishCentreView} from '../../../../../desktop/cradle/src/contributions/factory/desk/deskModel'
import {registeredHostedSurfaces} from '../../../../../desktop/cradle/src/contributions/generated'
import {withHostedDescriptor} from '../../../../../desktop/cradle/src/contributions/registry'
import {DOCUMENT_FORMS} from '../../../../../desktop/cradle/src/flow/documentForms'
import {createFormInPlace} from '../../../../../desktop/cradle/src/flow/createInPlace'
import {userFlowsArea} from '../../../../../desktop/cradle/src/flow/instances'
import {mintBlankInstance, mintInstance, instanceFileName, parseInstance} from '../../../../../desktop/cradle/src/flow/instance'
import {personParticipant} from '../../../../../desktop/cradle/src/flow/identity'
import {DRAFT_KEY, readUnplacedDraft} from '../../../../../desktop/cradle/src/flow/unplacedDrafts'
import {navigateExplore} from '../../../../../desktop/cradle/src/explore/navigate'
import {useContinuity, type CandidateWorkspace} from '../continuity'
import {useWorkspace} from '../shell/workspace'
import {readShellConfig, type ShellConfig} from './application'
import {createKnowledgeBinding,sameKnowledgeDestination,type KnowledgeBinding} from './knowledgeOpen'
import {NativeAgencyParticipation} from '../components/NativeAgencyParticipation'
import {preparedContextScopeKey,type NativePreparedContextScope} from './preparedContextBinding'
import {workbenchContextScope} from './workbenchContext'
import type {AgentSubject,AgentAccompanying} from '../../../../../desktop/cradle/src/agent/AgentLayer'
import {isRetainedCentreKind, WARM_WORKSPACES, type WarmTreeRef} from '../../../../../desktop/cradle/src/surface/warmTrees'
import {RETAINED_VIEW_BUDGET} from '../../../../../desktop/cradle/src/surface/runtime'
import './workbench.css'

const OMIT_BODY_KINDS = ['expressions'] as const
const unowned = new Set(['draft', 'blank'])
const identity = (binding: SurfaceBinding) => JSON.stringify([binding.kind, binding.ref, binding.project, binding.location, binding.address, binding.encounter, binding.hosted, binding.view?.nativeKnowledge, worldView(binding)?.sourceWorldRef])
const worldView = (binding: SurfaceBinding) => binding.view as (NonNullable<SurfaceBinding['view']> & {sourceWorldRef?: string}) | undefined
const hostedWorld = (binding: SurfaceBinding) => worldView(binding)?.sourceWorldRef
const checkpoint = (state: LayoutState): RestorePoint => ({root: state.root, surfaces: state.surfaces, closedStack: state.closedStack, focusedGroupId: state.focusedGroupId})
const layoutsOf = (book: CandidateWorkspace) => book.workspaces.flatMap(workspace => [...Object.values(workspace.modeLayouts ?? {}), workspace.layout])
/** Membership includes every logical placement; closed-stack bindings are not open. */
export function workbenchMembership(book: CandidateWorkspace): Map<string, SurfaceBinding> {
  const found = new Map<string, SurfaceBinding>()
  for (const layout of layoutsOf(book)) for (const id of [...groupsOf(layout.root).flatMap(group => group.tabs), ...(layout.sidePane?.tabs ?? []), ...(layout.detached ?? []).map(item => item.surfaceId)]) {
    const binding = layout.surfaces[id]
    if (binding) found.set(id, binding)
  }
  return found
}

export function NativeWorkbench({sourceWorldRef}: {sourceWorldRef?: string} = {}) {
  const book = useContinuity(), workspace = useWorkspace(), kernel = useKernel()
  const latest = useRef({book, workspace, kernel})
  latest.current = {book, workspace, kernel}
  // The encounter spine for projection panes (seam 3): one subscriber/router
  // over this book's WorldContext + the workspace access epoch. It owns no
  // state; the render effect below is the publication.
  const encounterBridge = useMemo(() => createSpineEncounterBridge(latest), [])
  const encounterSource = useMemo(() => ({bridge: encounterBridge, publish: () => encounterBridge.publish()}), [encounterBridge])
  useEffect(() => {encounterBridge.publish()})
  const mounted = useRef(false)
  const host = useRef<HTMLElement>(null)
  const [presented, setPresented] = useState(false)
  const everPresented = useRef(false)
  if (presented) everPresented.current = true
  const [backingRetry, setBackingRetry] = useState(0)
  const [configReading, setConfig] = useState<{epoch: number; value: ShellConfig} | null>(null)
  const config = configReading?.epoch === workspace.accessEpoch && workspace.accessReady ? configReading.value : null
  const [fault, setFault] = useState<string>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [menu, setMenu] = useState<MenuState | null>(null)
  const menuSide = useRef(false)
  const menuRef = useRef(menu)
  menuRef.current = menu
  const attempts = useRef(new Set<string>())
  const pending = useRef(new Map<string, Promise<void>>())
  const closing = useRef(new Set<string>())
  const windowQueue = useRef<{running:boolean; request:{epoch:number;current:()=>void}|null}>({running:false,request:null})
  const intent = useRef(0)
  const visitedTrees = useRef(new Set<string>())
  const retainedTrees = useRef<WarmTreeRef[]>([])
  const workspaceCopies = useRef(new Map<string, CandidateWorkspace['current']>())
  for (const owner of book.workspaces) workspaceCopies.current.set(owner.id, owner)
  const failedReleases = useRef(new Set<string>())
  const releasing = useRef(false)
  const [releaseRetry, setReleaseRetry] = useState(0)
  const bookListeners=useRef(new Set<()=>void>())
  useEffect(()=>{for(const listener of bookListeners.current)listener()},[book.workspaces,book.current.id,book.current.layout.mode,workspace.accessEpoch,workspace.accessReady,presented])
  const awaitBook=(predicate:()=>boolean,current:()=>void)=>new Promise<void>((resolve,reject)=>{
    const finish=(error?:unknown)=>{clearTimeout(timer);bookListeners.current.delete(observe);error?reject(error):resolve()}
    const observe=()=>{try{current();if(predicate())finish()}catch(error){finish(error)}}
    const timer=setTimeout(()=>finish(Error('The native workspace book did not publish this navigation within 30 seconds.')),30000)
    bookListeners.current.add(observe);observe()
  })
  const [returning, setReturning] = useState(false)
  const restore = useRef(checkpoint(book.current.layout))
  const report = useCallback((cause: unknown) => {if (mounted.current) setFault(cause instanceof Error ? cause.message : String(cause))}, [])
  useEffect(() => {mounted.current = true; return () => {mounted.current = false}}, [])
  useEffect(() => {
    const container = host.current?.closest<HTMLElement>('.inhabitant') ?? host.current
    if (!container) return
    const sync = () => setPresented(!container.hidden)
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(container, {attributes: true, attributeFilter: ['hidden']})
    return () => observer.disconnect()
  }, [])
  useEffect(() => {restore.current = checkpoint(book.current.layout); setMenu(null)}, [book.current.id, book.current.layout.mode])
  useEffect(() => {
    let live = true
    const epoch = workspace.accessEpoch
    attempts.current.clear()
    setConfig(null)
    if (!workspace.accessReady || !everPresented.current) return
    void readShellConfig(backingRetry > 0).then(reading => {if (live && latest.current.workspace.nativeAccessCurrent(epoch)) setConfig({epoch, value: reading})}).catch(cause => {if (live && latest.current.workspace.nativeAccessCurrent(epoch)) report(cause)})
    return () => {live = false}
  }, [workspace.accessEpoch, workspace.accessReady, everPresented.current, backingRetry, report])

  const unavailable: NonNullable<WorkbenchProps['bodyUnavailable']> = binding => contributionUnavailable(binding,config?.product_ids,config?.contributions)

  const capture = (binding?: SurfaceBinding, requirePresented = false) => {
    const origin = latest.current, epoch = origin.workspace.accessEpoch
    if (!origin.workspace.accessReady || !origin.workspace.nativeScope || !origin.workspace.nativeAccessCurrent(epoch)) throw Error('The native Workbench access is unavailable; retained work remains open.')
    const generation = requirePresented ? ++intent.current : intent.current
    const workspaceId = origin.book.current.id, mode = origin.book.current.layout.mode, subject = binding ? identity(binding) : undefined
    const current = () => {
      if (!mounted.current || !latest.current.workspace.nativeAccessCurrent(epoch)) throw Error('The originating native World/access epoch has retired.')
      if (binding && identity(workbenchMembership(latest.current.book).get(binding.id) ?? {id: '', kind: '', title: ''}) !== subject) throw Error('The originating Workbench subject has closed or changed.')
      if (requirePresented && (intent.current !== generation || latest.current.book.current.id !== workspaceId || latest.current.book.current.layout.mode !== mode || latest.current.book.current.project !== origin.book.current.project || latest.current.book.current.allProjects !== origin.book.current.allProjects || host.current?.closest<HTMLElement>('.inhabitant')?.hidden)) throw Error('The originating Workbench presentation has changed.')
    }
    current()
    return {origin, current, epoch, workspaceId, mode}
  }
  const ownerIO = async <T,>(current: () => void, call: () => Promise<T>) => {current(); const value = await call(); current(); return value}
  const admit = async (binding: SurfaceBinding) => {
    if (binding.pending || unowned.has(binding.kind) || unavailable(binding) || OMIT_BODY_KINDS.includes(binding.kind as typeof OMIT_BODY_KINDS[number])) return
    const {origin, current} = capture(binding)
    const token = `${origin.workspace.accessEpoch}:${binding.id}:${identity(binding)}`
    const waiting = pending.current.get(token)
    if (waiting) return waiting
    const task = (async () => {
      let admissionRef = binding.ref
      try {
        if ((binding.kind === 'file' || binding.kind === 'flow') && binding.location) {
          const format = detectFormat({path: binding.location.path})
          const reading = await ownerIO<{location: CentralLocation}>(current, () => format === 'image' || format === 'pdf' || format === 'unsupported'
            ? acquireFileBytes(origin.kernel.transport, binding.location!, origin.workspace.nativeScope!)
            : acquireFileReading(origin.kernel.transport, binding.location!, origin.workspace.nativeScope!))
          admissionRef = reading.location.ref
        }
        if (binding.kind === 'encounter' && binding.ref && binding.project !== undefined) {
          if(binding.hosted&&!hostedWorld(binding))throw Error('This hosted conversation has no disclosed native World address.')
          await ownerIO(current, () => encounter(origin.kernel.transport, binding.project!, {action: 'start'}, hostedWorld(binding)))
          await ownerIO(current, () => encounter(origin.kernel.transport, binding.project!, {action: 'read', agent_session: binding.ref!, after: 0, limit: 1}, hostedWorld(binding)))
        }
        const opened = await ownerIO(current, () => origin.kernel.apply({op: 'surface_open', surface_id: binding.id, kind: binding.kind, ...(admissionRef ? {source_ref: admissionRef} : {}), title: binding.title}))
        if (opened?.result !== 'surface_opened') throw Error(origin.kernel.lastOpError() ?? 'The native owner refused this surface.')
        if (binding.kind === 'source' && binding.ref) {
          const source = await ownerIO(current, () => origin.kernel.apply({op: 'source_open', source_ref: binding.ref!, project: binding.project}))
          if (source?.result !== 'source_opened') throw Error(origin.kernel.lastOpError() ?? 'The native source reading is unavailable.')
          const draft = readDraft(binding.ref)
          if (draft) {
            const restored = await ownerIO(current, () => origin.kernel.apply({op: 'source_restore', source_ref: binding.ref!, ...draft}))
            if (!restored) throw Error(origin.kernel.lastOpError() ?? 'The native source draft could not be restored.')
          }
        }
        if (activeBindingId(latest.current.book.current.layout) === binding.id && (origin.kernel.transport.kind !== 'tauri' || document.hasFocus())) await ownerIO(current, () => origin.kernel.surfaceFocus(binding.id))
        current()
        setErrors(previous => {const next = {...previous}; delete next[binding.id]; return next})
      } catch (cause) {
        try {current(); setErrors(previous => ({...previous, [binding.id]: String(cause)}))} catch { /* A retired result cannot replace the new owner/subject. */ }
        throw cause
      }
    })()
    pending.current.set(token, task)
    try {await task} finally {if (pending.current.get(token) === task) pending.current.delete(token)}
  }

  useEffect(() => {
    if (!workspace.accessReady || !config) return
    const membership = workbenchMembership(book)
    const demanded = new Set<string>()
    if (presented) for (const group of [...groupsOf(book.current.layout.root), ...(book.current.layout.sidePane ? [book.current.layout.sidePane] : [])]) if (group.active) demanded.add(group.active)
    for (const layout of layoutsOf(book)) for (const detached of layout.detached ?? []) demanded.add(detached.surfaceId)
    for (const id of demanded) {
      const binding = membership.get(id)
      if (!binding || binding.pending || unowned.has(binding.kind) || unavailable(binding)) continue
      const token = `${workspace.accessEpoch}:${id}:${identity(binding)}`
      const native = kernel.snapshot.surfaces[id]
      if (native?.kind === binding.kind && native.source_ref === binding.ref || attempts.current.has(token)) continue
      attempts.current.add(token)
      void admit(binding).catch(() => {})
    }
    for (const id of Object.keys(kernel.snapshot.surfaces)) {
      const ticket=workspace.accessEpoch+':'+id
      if (membership.has(id) || retainedTrees.current.some(tree=>[...groupsOf(tree.layout.root).flatMap(group=>group.tabs),...(tree.layout.sidePane?.tabs??[])].includes(id)) || closing.current.has(ticket)) continue
      closing.current.add(ticket)
      const origin = latest.current, epoch = workspace.accessEpoch
      void (async () => {
        if (!origin.workspace.nativeAccessCurrent(epoch) || retainedMembership().has(id)) return
        await origin.kernel.surfaceClose(id)
      })().catch(report).finally(() => closing.current.delete(ticket))
    }
  }, [book.workspaces, book.current.layout, workspace.accessEpoch, workspace.accessReady, kernel.snapshot.surfaces, config, presented, releaseRetry])

  const retainedMembership=()=>{
    const live=workbenchMembership(latest.current.book);
    for(const tree of retainedTrees.current)for(const id of [...groupsOf(tree.layout.root).flatMap(group=>group.tabs),...(tree.layout.sidePane?.tabs??[])])if(!live.has(id)&&tree.layout.surfaces[id])live.set(id,tree.layout.surfaces[id]);
    return live;
  }

  const insert = (binding: SurfaceBinding, replaceId?: string) => {
    const origin = latest.current
    if (replaceId && workbenchMembership(origin.book).has(replaceId)) origin.book.replaceSurface(origin.book.current.id, {...binding, id: replaceId})
    else origin.book.setLayout(layout => openBinding(layout, withHostedDescriptor(binding)))
  }
  const openSource: WorkbenchProps['openSource'] = (source: ListedSource) => {
    capture(undefined, true)
    const existing = Object.values(latest.current.book.current.layout.surfaces).find(binding => binding.kind === 'source' && binding.ref === source.ref && binding.project === latest.current.book.current.project)
    const binding = existing ?? makeSourceBinding(latest.current.book.current.layout, source.ref, source.path, latest.current.book.current.project)
    insert({...binding, project: latest.current.book.current.project})
  }
  const openKnowledge: WorkbenchProps['openKnowledge'] = (address, title, project, placement = 'tab', graphOrigin) => {
    capture(undefined, true)
    if (placement === 'window') return Promise.reject(Error('Detached Knowledge is not admitted by this receiving navigation route. Open the source as a tab or page.'))
    const focused = activeBindingId(latest.current.book.current.layout)
    const held = focused ? latest.current.book.current.layout.surfaces[focused] as KnowledgeBinding | undefined : undefined
    const native = held?.view?.nativeKnowledge
    return new Promise<void>((resolve, reject) => {
      let settled = false
      const complete = (reason?: string) => {if (settled) return; settled = true; clearTimeout(deadline); reason ? reject(Error(reason)) : resolve()}
      const deadline = setTimeout(() => complete('The native Knowledge navigation receiver did not acknowledge this open.'), 30000)
      window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {address, title, project, plane: placement === 'page' ? 'page' : address.kind === 'wiki' ? 'graph' : 'page', ...(native?.origin === 'canvas' ? native : {}), graphOrigin, complete}}))
    })
  }
  const openEncounter = async (row: EncounterRow) => {
    const {origin, current} = capture(undefined, true)
    await ownerIO(current, () => encounter(origin.kernel.transport, row.project, {action: 'start'}, sourceWorldRef))
    await ownerIO(current, () => encounter(origin.kernel.transport, row.project, {action: 'read', agent_session: row.ref, after: 0, limit: 1}, sourceWorldRef))
    const existing = Object.values(origin.book.current.layout.surfaces).find(binding => binding.kind === 'encounter' && binding.ref === row.ref && binding.project === row.project && binding.encounter?.space === row.space && hostedWorld(binding) === sourceWorldRef)
    insert(existing ?? {id: crypto.randomUUID(), kind: 'encounter', title: row.title, project: row.project, ref: row.ref, encounter: {space: row.space}, ...(sourceWorldRef ? {view: {sourceWorldRef} as NonNullable<SurfaceBinding['view']> & {sourceWorldRef: string}} : {})})
  }
  const chooseConversation = async (row: EncounterRow,receivingCurrent?:()=>boolean,world:string|undefined=sourceWorldRef) => {
    const {origin, current:ownerCurrent} = capture(undefined, true)
    const current=()=>{ownerCurrent();if(receivingCurrent&&!receivingCurrent())throw Error('The originating conversation or human setup changed.')}
    await ownerIO(current, () => encounter(origin.kernel.transport, row.project, {action: 'start'}, world))
    await ownerIO(current, () => encounter(origin.kernel.transport, row.project, {action: 'read', agent_session: row.ref, after: 0, limit: 1}, world))
    current()
    const existing=Object.values(origin.book.current.layout.surfaces).find(binding=>binding.kind==='encounter'&&binding.ref===row.ref&&binding.project===row.project&&binding.encounter?.space===row.space&&hostedWorld(binding)===world)
    const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:'encounter',title:row.title,project:row.project,ref:row.ref,encounter:{space:row.space},...(world?{view:{sourceWorldRef:world} as NonNullable<SurfaceBinding['view']>&{sourceWorldRef:string}}:{})}
    origin.book.setLayout(layout => openBinding({...layout, accompanying: {ref: row.ref, project: row.project, space: row.space}},binding))
  }
  const chooseFactory = async (row:EncounterRow) => {
    await chooseConversation(row)
    publishCentreView('tasks')
  }
  const detach = async (id: string) => {
    const binding = workbenchMembership(latest.current.book).get(id)
    if (!binding) return
    if(!nativeDetachedBodySupported(binding.kind))throw Error('This surface has no admitted native detached body. Keep it in its workspace pane.')
    const {origin, current, workspaceId} = capture(binding, true)
    if (origin.kernel.transport.kind !== 'tauri') throw Error('Detached native windows are unavailable in the development browser.')
    await checkpointDocuments([id])
    current()
    await admit(binding)
    current()
    const {invoke} = await import('@tauri-apps/api/core')
    current()
    await ownerIO(current, () => invoke('window_detach', {workspaceId, binding, bounds: origin.book.current.layout.windowBounds?.[id] ?? null}))
    origin.book.setLayout(layout => detachBinding(layout, id))
  }
  const execute = (ref: string, arg?: ActionArg) => {
    if (host.current?.closest<HTMLElement>('.inhabitant')?.hidden) return
    if (ref === 'surface.detach') {void detach(arg?.surfaceId ?? activeBindingId(latest.current.book.current.layout) ?? '').catch(report); return}
    if (ref === 'surface.open') {insert({id: crypto.randomUUID(), kind: 'blank', title: 'New tab', project: latest.current.book.current.project}); return}
    if (ref === 'surface.open-sources' || ref === 'frame.world') {insert({id: crypto.randomUUID(), kind: 'sources', title: 'Sources', project: latest.current.book.current.project}); return}
    const mayRelease = ['surface.close', 'surface.split-right', 'surface.split-down', 'surface.tile', 'surface.restore-layout', 'surface.drop', 'surface.move'].includes(ref) || ref.startsWith('surface.move-to:')
    if (mayRelease) {
      const origin = latest.current.book, workspaceId = origin.current.id, mode = origin.current.layout.mode, token = ++intent.current
      const ids = [...groupsOf(origin.current.layout.root).flatMap(group => group.tabs), ...(origin.current.layout.sidePane?.tabs ?? [])]
      void checkpointDocuments(ids).then(() => {
        if (!mounted.current || intent.current !== token || latest.current.book.current.id !== workspaceId || latest.current.book.current.layout.mode !== mode) return
        if (!latest.current.book.flushCheckpoint()) throw Error('The native book checkpoint failed; its views remain open.')
        latest.current.book.setLayout(layout => executeFrameAction(layout, ref, arg, restore.current))
      }).catch(report)
      return
    }
    latest.current.book.setLayout(layout => executeFrameAction(layout, ref, arg, restore.current))
  }
  const executeSide = (ref: string, arg?: ActionArg) => {
    if (host.current?.closest<HTMLElement>('.inhabitant')?.hidden) return
    const held = latest.current.book.current.layout.sidePane
    if (!held) return
    if (ref === 'surface.detach' || ['surface.split-right', 'surface.split-down', 'surface.tile'].includes(ref)) {report('Move this binding to a centre pane before splitting or detaching it.'); return}
    if (ref === 'surface.open') {
      const id = crypto.randomUUID()
      latest.current.book.setLayout(layout => layout.sidePane ? {...layout, sidePane: {...layout.sidePane, tabs: [...layout.sidePane.tabs, id], active: id}, surfaces: {...layout.surfaces, [id]: {id, kind: 'blank', title: 'New tab', project: latest.current.book.current.project}}} : layout)
      return
    }
    const apply = () => latest.current.book.setLayout(layout => {
      if (!layout.sidePane) return layout
      const virtual = {...layout, root: layout.sidePane, sidePane: undefined, focusedGroupId: layout.sidePane.id}
      const next = executeFrameAction(virtual, ref, arg, checkpoint(virtual))
      if (next.root && next.root.type !== 'group') return layout
      return {...layout, sidePane: next.root ?? undefined, surfaces: next.surfaces, closedStack: next.closedStack, focusedTabId: next.root?.active ?? undefined}
    })
    if (['surface.close', 'surface.drop', 'surface.move', 'surface.restore-layout'].includes(ref) || ref.startsWith('surface.move-to:')) {
      const origin = latest.current.book, workspaceId = origin.current.id, mode = origin.current.layout.mode, token = ++intent.current
      void checkpointDocuments(held.tabs).then(() => {
        if (!mounted.current || intent.current !== token || latest.current.book.current.id !== workspaceId || latest.current.book.current.layout.mode !== mode) return
        if (!latest.current.book.flushCheckpoint()) throw Error('The native book checkpoint failed; its side views remain open.')
        apply()
      }).catch(report)
    } else apply()
  }
  const menuFor = (id: string | undefined, x: number, y: number, side = false) => {
    menuSide.current = side
    const layout = latest.current.book.current.layout
    const state = side && layout.sidePane ? {...layout, root: layout.sidePane, sidePane: undefined, focusedGroupId: layout.sidePane.id} : layout
    const context = {state, snapshot: side ? checkpoint(state) : restore.current}
    const items = id ? bindingDisclosures(context, id) : frameDisclosures(context)
    if (side) for (const item of items) if (['surface.split-right', 'surface.split-down', 'surface.tile'].includes(item.action_ref)) item.enabled = false
    if (!side && id && kernel.transport.kind === 'tauri') items.push({action_ref: 'surface.detach', title: 'Detach into native window', enabled: !!book.current.layout.surfaces[id] && nativeDetachedBodySupported(book.current.layout.surfaces[id].kind)})
    if (items.length) setMenu({x, y, items, surfaceId: id})
  }
  const openKind = (kind: string, id?: string, project = latest.current.book.current.project) => {
    const held = registeredHostedSurfaces.some(entry => entry.descriptor.kind === kind) ? Object.values(latest.current.book.current.layout.surfaces).find(binding => binding.kind === kind && binding.project === project) : undefined
    if (held && held.id !== id) {
      latest.current.book.setLayout(layout => openBinding(id ? executeFrameAction(layout, 'surface.close', {surfaceId: id}) : layout, held))
      return
    }
    if (kind === 'terminal' || kind === 'browser') {
      if (kernel.transport.kind !== 'tauri') throw Error(`The real native ${kind} requires the desktop host.`)
      const root = kernel.snapshot.navigator?.root?.root ?? config?.world_scope?.personal_ground
      const path = kernel.snapshot.navigator?.root?.work.projects.find(entry => entry.name === project)?.path
      const cwd = path?.startsWith('/') ? path : root && path ? `${root.replace(/\/$/, '')}/${path}` : root
      insert({id: id ?? crypto.randomUUID(), kind, title: kind === 'terminal' ? 'Terminal' : 'Browser', project, ...(kind === 'terminal' ? {terminal: {cwd}} : {browser: {url: ''}})}, id)
    } else insert(withHostedDescriptor({id: id ?? crypto.randomUUID(), kind, title: registeredHostedSurfaces.find(entry => entry.descriptor.kind === kind)?.descriptor.title ?? kind, project}), id)
  }

  const createFlow = async (id: string, content?: string) => {
    const binding = workbenchMembership(latest.current.book).get(id)
    if (!binding) throw Error('The destination draft has closed.')
    const {origin, current, workspaceId} = capture(binding, true)
    const area = await ownerIO(current, () => userFlowsArea(origin.kernel.transport))
    const date = new Date(), pad = (value: number) => String(value).padStart(2, '0')
    const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
    const html = content === undefined ? mintBlankInstance([personParticipant()], date) : mintInstance(content, [personParticipant()], date)
    for (let index = 0; index < 8; index++) {
      const name = instanceFileName(stamp, index)
      const location: CentralLocation = {schema: 'central.path-ref/v1', ref: `${area.baseRef}/flows/${name}`, root: area.root, path: `${area.basePath}/flows/${name}`}
      let result: FileMutation
      try {result = await ownerIO(current, () => fileOperation<FileMutation>(origin.kernel.transport, location, {action: 'write', expected_revision: '', content: html}))}
      catch (cause) {if (/already exists|conflict/i.test(String(cause))) continue; throw cause}
      if (result.outcome !== 'created') {if (result.outcome === 'conflict') continue; throw Error(`The native owner did not create the Flow (${result.outcome}).`)}
      const next: SurfaceBinding = {id, kind: 'flow', ref: location.ref, location, title: name, flow: {flowRef: parseInstance(html).meta.documentId ?? name, path: location.path}}
      current()
      if (content !== undefined && readUnplacedDraft(id)?.text !== content) origin.book.setLayout(layout => openBinding(layout, {...next, id: crypto.randomUUID()}))
      else origin.book.replaceSurface(workspaceId, next)
      if (content !== undefined && readUnplacedDraft(id)?.text === content) {try {localStorage.removeItem(DRAFT_KEY(id))} catch { /* The owner holds the placed content. */ }}
      return
    }
    throw Error('The native owner refused all eight collision-safe Flow filenames. Your device draft remains intact.')
  }
  const freshChoice = async (id: string, kind: string, project?: string) => {
    const binding = workbenchMembership(latest.current.book).get(id)
    if (!binding || binding.kind !== 'blank') return
    const {origin, current, workspaceId} = capture(binding, true)
    const form = DOCUMENT_FORMS.find(entry => entry.kind === kind)
    if (form) {
      const copy = await ownerIO(current, () => createFormInPlace(origin.kernel.transport, form, {project, projects: origin.kernel.snapshot.navigator?.root?.work.projects}))
      current(); origin.book.replaceSurface(workspaceId, {id, kind: 'file', ref: copy.location.ref, location: copy.location, title: copy.location.path.split('/').pop() ?? form.label, project})
    } else if (kind === 'flow') await createFlow(id)
    else if (kind === 'search') {current(); origin.book.replaceSurface(workspaceId, {id, kind: 'sources', title: 'Sources', project})}
    else if (['library', 'terminal', 'browser'].includes(kind)) openKind(kind, id, project)
    else throw Error('The native opener does not offer this document kind.')
  }

  useEffect(() => bindScopeWriter(scope => {
    const current = latest.current.book
    if (scope.kind === 'all') current.browseAll()
    else current.browse(scopeProject(scope))
  }), [])
  useEffect(() => {
    publishScope(scopeFromWorkspace(book.current.project, book.current.allProjects))
    const id = activeBindingId(book.current.layout)
    publishFocusedProject(id ? book.current.layout.surfaces[id]?.project : undefined)
  }, [book.current.project, book.current.allProjects, book.current.layout])

  // Native window membership is the complete logical book, including concealed
  // modes, side panes and detached windows. Concealment never closes a view.
  useEffect(() => {
    if (kernel.transport.kind !== 'tauri' || !workspace.accessReady) return
    let live = true
    const epoch = workspace.accessEpoch
    const current = () => {if (!live || !latest.current.workspace.nativeAccessCurrent(epoch)) throw Error('The native window owner access retired.')}
    const reconcile = () => {
      const queue=windowQueue.current;queue.request={epoch,current};
      if(queue.running)return;queue.running=true;
      void(async()=>{
        try{
          const {invoke}=await import('@tauri-apps/api/core');
          while(queue.request){
            const request=queue.request;queue.request=null;
            try{
              request.current();
              await ownerIO(request.current,()=>invoke('browser_reconcile',{live:[...retainedMembership().keys()]}));
              await ownerIO(request.current,()=>invoke('terminal_reconcile',{live:[...retainedMembership().keys()]}));
            }catch(cause){
              let originatingRequestCurrent=true
              try{request.current()}catch{originatingRequestCurrent=false}
              if(originatingRequestCurrent)report(cause)
            }
          }
        }catch(cause){if(live)report(cause);}
        finally{queue.running=false;}
      })();
    }
    const title = (event: Event) => {
      try {
        current()
        const reading = (event as CustomEvent<{id: string; title: string; url: string}>).detail
        const binding = workbenchMembership(latest.current.book).get(reading?.id)
        if (!binding || binding.kind !== 'browser' || typeof reading.url !== 'string') return
        const owner = latest.current.book.workspaces.find(value => [value.layout, ...Object.values(value.modeLayouts ?? {})].some(layout => layout.surfaces[binding.id] === binding))
        if (owner) latest.current.book.replaceSurface(owner.id, {...binding, title: reading.title || 'Browser', browser: {url: reading.url}})
      } catch { /* The retired native window cannot publish into a new World. */ }
    }
    const focus = (event: Event) => {
      try {current(); if (!presented) return; const id = (event as CustomEvent<string>).detail; if (latest.current.book.current.layout.surfaces[id]) execute('surface.activate', {surfaceId: id})} catch { /* Native focus from a retired owner. */ }
    }
    reconcile()
    window.addEventListener('oi:terminal-attached', reconcile)
    window.addEventListener('oi:browser-attached', reconcile)
    window.addEventListener('oi:browser-title', title)
    window.addEventListener('oi:browser-pane-focus', focus)
    return () => {live = false; window.removeEventListener('oi:terminal-attached', reconcile); window.removeEventListener('oi:browser-attached', reconcile); window.removeEventListener('oi:browser-title', title); window.removeEventListener('oi:browser-pane-focus', focus)}
  }, [book.workspaces, kernel.transport.kind, workspace.accessReady, workspace.accessEpoch, presented, releaseRetry, report])

  useEffect(() => {
    if (kernel.transport.kind !== 'tauri' || !workspace.accessReady) return
    let live = true
    const epoch = workspace.accessEpoch, unlisten: (() => void)[] = []
    const current = () => {if (!live || !latest.current.workspace.nativeAccessCurrent(epoch)) throw Error('The originating native window owner retired.')}
    void import('@tauri-apps/api/event').then(async ({listen,emitTo}) => {
      current()
      const {invoke}=await import('@tauri-apps/api/core');current()
      const retain=(stop:()=>void)=>{if(!live)stop();else unlisten.push(stop)}
      const lookup=async(origin:string,workspaceId:string,surfaceId?:string)=>{
        if(typeof origin!=='string'||!origin||origin.length>128)throw Error('The detached origin label is unavailable.')
        const registered=await ownerIO<{workspace_id:string;binding:SurfaceBinding}>(current,()=>invoke('window_binding',{label:origin}))
        if(registered.workspace_id!==workspaceId||surfaceId&&registered.binding.id!==surfaceId)throw Error('The native registered window belongs to a different workspace or binding.')
        const owner=latest.current.book.workspaces.find(value=>value.id===workspaceId)
        const layout=owner&&[owner.layout,...Object.values(owner.modeLayouts??{})].find(value=>value.detached?.some(item=>item.surfaceId===registered.binding.id)&&value.surfaces[registered.binding.id])
        const binding=layout?.surfaces[registered.binding.id]
        if(!owner||!layout||!binding||identity(binding)!==identity(registered.binding))throw Error('The detached native binding is absent or its owner identity changed.')
        const subject=identity(binding),id=binding.id
        const admittedCurrent=()=>{current();const held=workbenchMembership(latest.current.book).get(id);if(!held||identity(held)!==subject)throw Error('The originating detached subject closed or changed.')}
        return {owner,layout,binding,current:admittedCurrent}
      }
      retain(await listen<{workspace_id:string;surface_id:string;view:NonNullable<SurfaceBinding['view']>;origin:string}>('oi:surface-view',event=>{
        void(async()=>{const value=event.payload,registered=await lookup(value.origin,value.workspace_id,value.surface_id);registered.current();latest.current.book.surfaceView(value.workspace_id,value.surface_id,value.view)})().catch(cause=>{if(live)report(cause)})
      }))
      retain(await listen<{workspace_id:string;origin:string;bindingId:string;[key:string]:unknown}>('oi:detached-context',event=>{
        void(async()=>{
          const {origin,workspace_id,...detail}=event.payload;
          const registered=await lookup(origin,workspace_id,detail.bindingId);registered.current();
          window.dispatchEvent(new CustomEvent('oi:context-candidate',{detail}));
        })().catch(cause=>{if(live)report(cause)})
      }))
      retain(await listen<{workspace_id:string;surface_id:string;bounds:{x:number;y:number;width:number;height:number}}>('oi:window-bounds',event=>{
        try{current();const value=event.payload,owner=latest.current.book.workspaces.find(entry=>entry.id===value.workspace_id);if(!owner||![owner.layout,...Object.values(owner.modeLayouts??{})].some(layout=>layout.detached?.some(item=>item.surfaceId===value.surface_id)))return;if(!Object.values(value.bounds).every(Number.isFinite)||value.bounds.width<=0||value.bounds.height<=0)throw Error('The native window bounds are invalid.');latest.current.book.windowBounds(value.workspace_id,value.surface_id,value.bounds)}catch(cause){if(live)report(cause)}
      }))
      retain(await listen<{workspace_id:string;address:Parameters<NonNullable<WorkbenchProps['openKnowledge']>>[0];title:string;project?:string;placement?:'tab'|'page'|'window';graphOrigin?:string;request_id:string;origin:string}>('oi:window-navigate',event=>{
        void(async()=>{
          const value=event.payload;if(typeof value.request_id!=='string'||!value.request_id||value.request_id.length>128)return
          let failure:string|undefined,registered:Awaited<ReturnType<typeof lookup>>|undefined
          try{
            registered=await lookup(value.origin,value.workspace_id);registered.current()
            latest.current.book.activate(registered.owner.id)
            await awaitBook(()=>latest.current.book.current.id===registered!.owner.id,registered.current)
            if(latest.current.book.current.layout.mode!==registered.layout.mode){latest.current.book.switchMode(registered.layout.mode??'base');await awaitBook(()=>latest.current.book.current.layout.mode===registered!.layout.mode,registered.current)}
            const native=(registered.binding as KnowledgeBinding).view?.nativeKnowledge
            const request={address:value.address,title:value.title,project:value.project,plane:value.placement==='page'?'page' as const:value.address.kind==='wiki'?'graph' as const:'page' as const,...(native?.origin==='canvas'?native:{}),graphOrigin:value.graphOrigin}
            const target=createKnowledgeBinding(request,crypto.randomUUID())
            await new Promise<void>((resolve,reject)=>{let settled=false;const finish=(reason?:string)=>{if(settled)return;settled=true;clearTimeout(timer);try{registered!.current();reason?reject(Error(reason)):resolve()}catch(error){reject(error)}};const timer=setTimeout(()=>finish('Native Knowledge did not acknowledge detached navigation within 30 seconds.'),30000);window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge',{detail:{...request,complete:finish}}))})
            if(value.placement==='window'){
              const targetBinding=()=>Object.values(latest.current.book.current.layout.surfaces).find(binding=>sameKnowledgeDestination(binding,target))
              await awaitBook(()=>!!targetBinding(),registered.current)
              const id=targetBinding()!.id
              if(!latest.current.book.current.layout.detached?.some(item=>item.surfaceId===id)){
                await awaitBook(()=>!host.current?.closest<HTMLElement>('.inhabitant')?.hidden,registered.current)
                await detach(id);registered.current()
              }
            }
          }catch(cause){failure=String(cause instanceof Error?cause.message:cause)}
          if(registered&&live&&latest.current.workspace.nativeAccessCurrent(epoch))await emitTo(value.origin,'oi:window-navigate-result',{request_id:value.request_id,...(failure?{error:failure}:{})})
          else if(failure&&live)report(failure)
        })().catch(cause=>{if(live)report(cause)})
      }))
      const stop = await listen<{workspace_id: string; binding: {id: string}}>('oi:window-redock', event => {
        void (async () => {
          current()
          const {workspace_id: id, binding} = event.payload
          const owner = latest.current.book.workspaces.find(value => value.id === id)
          if (!owner || ![owner.layout, ...Object.values(owner.modeLayouts ?? {})].some(layout => layout.detached?.some(item => item.surfaceId === binding.id))) return
          await ownerIO(current, () => latest.current.kernel.apply({op: 'state'}))
          current(); latest.current.book.redock(id, binding.id)
        })().catch(cause => {if (live) report(cause)})
      })
      if (!live) stop(); else unlisten.push(stop)
    }).catch(cause => {if (live) report(cause)})
    return () => {live = false; unlisten.forEach(stop => stop())}
  }, [kernel.transport.kind, workspace.accessReady, workspace.accessEpoch, report])

  const callbacks = useRef({freshChoice, createFlow, openEncounter, execute, report, insert, capture})
  callbacks.current = {freshChoice, createFlow, openEncounter, execute, report, insert, capture}
  useEffect(() => {
    const ownsPresented = (id?: string) => {
      if (host.current?.closest<HTMLElement>('.inhabitant')?.hidden) return false
      const layout = latest.current.book.current.layout
      return !id || [...groupsOf(layout.root).flatMap(group => group.tabs), ...(layout.sidePane?.tabs ?? [])].includes(id)
    }
    const fresh = (event: Event) => {
      const request = (event as CustomEvent<{id: string; kind: string; project?: string}>).detail
      if (!request || !ownsPresented(request.id)) return
      void callbacks.current.freshChoice(request.id, request.kind, request.project).then(() => window.dispatchEvent(new CustomEvent('oi:fresh-result', {detail: {id: request.id}}))).catch(cause => window.dispatchEvent(new CustomEvent('oi:fresh-result', {detail: {id: request.id, error: String(cause)}})))
    }
    const place = (event: Event) => {
      const request = (event as CustomEvent<{id: string; content: string}>).detail
      if (!request || !ownsPresented(request.id) || typeof request.content !== 'string') return
      if (!request.content.trim()) {window.dispatchEvent(new CustomEvent('oi:place-draft-result', {detail: {id: request.id, error: 'Write something before placing this draft.'}})); return}
      void callbacks.current.createFlow(request.id, request.content).then(() => window.dispatchEvent(new CustomEvent('oi:place-draft-result', {detail: {id: request.id}}))).catch(cause => window.dispatchEvent(new CustomEvent('oi:place-draft-result', {detail: {id: request.id, error: String(cause)}})))
    }
    const newTab = (event: Event) => {if (!ownsPresented()) return; const groupId = (event as CustomEvent<{groupId?: string}>).detail?.groupId; if (groupId) callbacks.current.execute('surface.focus-group', {groupId}); callbacks.current.execute('surface.open')}
    const encounterOpen = (event: Event) => {if (!ownsPresented()) return; const row = (event as CustomEvent<EncounterRow>).detail; if (row && typeof row.ref === 'string' && typeof row.project === 'string') void callbacks.current.openEncounter(row).catch(callbacks.current.report)}
    const sourceOpen = (event: Event) => {
      const request = (event as CustomEvent<{location?: CentralLocation; project?: string}>).detail
      if (!ownsPresented() || !request?.location || request.location.schema !== 'central.path-ref/v1' || typeof request.location.ref !== 'string' || typeof request.location.path !== 'string') return
      try {
        callbacks.current.capture(undefined, true)
        const held = Object.values(latest.current.book.current.layout.surfaces).find(binding => binding.kind === 'file' && binding.location?.ref === request.location!.ref && binding.project === request.project)
        callbacks.current.insert(held ?? {id: crypto.randomUUID(), kind: 'file', title: request.location.path.split('/').pop() ?? request.location.ref, ref: request.location.ref, location: request.location, project: request.project})
      } catch (cause) {callbacks.current.report(cause)}
    }
    const message = (event: Event) => {if (ownsPresented()) callbacks.current.report((event as CustomEvent<{message?: string}>).detail?.message ?? 'The native workspace operation was refused.')}
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !ownsPresented()) return
      if (event.key === 'Escape') {setMenu(null); return}
      const action = frameActionForKey(event, !!menuRef.current)
      if (!action) return
      event.preventDefault(); callbacks.current.execute(action.ref, action.arg)
    }
    const recovery = (event: Event) => {
      const id = (event as CustomEvent<{id?: string}>).detail?.id
      if (!ownsPresented() || !id || !/^device-recovery:[a-zA-Z0-9-]{1,80}$/.test(id) || !readUnplacedDraft(id)?.unverified_recovery) return
      latest.current.book.setLayout(layout => openBinding(layout, {id, kind: 'draft', title: 'Recovered device draft', project: latest.current.book.current.project}))
    }
    const pairs: [string, EventListener][] = [['oi:fresh-choice', fresh], ['oi:place-draft', place], ['oi:new-tab', newTab], ['oi:open-encounter', encounterOpen], ['oi:recover-device-copy', recovery], ['oi:epi-open-source', sourceOpen], ['oi:workspace-message', message]]
    pairs.forEach(([name, receive]) => window.addEventListener(name, receive)); window.addEventListener('keydown', key)
    return () => {pairs.forEach(([name, receive]) => window.removeEventListener(name, receive)); window.removeEventListener('keydown', key)}
  }, [])

  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => {if (!(event.target as Element | null)?.closest('.ctx-menu')) setMenu(null)}
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [menu])

  const openExplore: WorkbenchProps['openExplore'] = async selection => {
    capture(undefined, true)
    if (selection) navigateExplore({ref: selection.ref})
    const held = Object.values(latest.current.book.current.layout.surfaces).find(binding => binding.kind === 'explore')
    insert(held ?? {id: crypto.randomUUID(), kind: 'explore', title: 'Explore', project: latest.current.book.current.project})
  }
  const openPresentation: WorkbenchProps['openPresentation'] = async (ref, title, meta) => {
    capture(undefined, true)
    const held = Object.values(latest.current.book.current.layout.surfaces).find(binding => binding.kind === 'presentation' && binding.ref === ref)
    insert({...held, id: held?.id ?? crypto.randomUUID(), kind: 'presentation', ref, title, presentation: meta})
  }
  const focusedId = book.current.layout.focusedTabId ?? activeBindingId(book.current.layout)
  const selected = focusedId ? book.current.layout.surfaces[focusedId] as KnowledgeBinding | undefined : undefined
  const returnContext = selected?.kind === 'knowledge' ? selected.view?.nativeKnowledge : undefined
  const returnCanvas = () => {
    if (!selected || returnContext?.origin !== 'canvas' || !returnContext.returnTo || returning) return
    const {current, workspaceId, epoch} = capture(selected, true), bindingId = selected.id
    setReturning(true)
    let settled = false
    const complete = (reason?: string) => {
      if (settled) return; settled = true; clearTimeout(deadline)
      if (!mounted.current) return
      setReturning(false)
      try {current(); if (reason) report(reason)} catch { /* Return cannot change a retired selection. */ }
    }
    const deadline = setTimeout(() => complete('The retained Canvas owner did not acknowledge Return.'), 30000)
    if (latest.current.workspace.nativeAccessCurrent(epoch)) window.dispatchEvent(new CustomEvent('oi:candidate-canvas-return', {detail: {workspaceId, bindingId, ...returnContext, complete}}))
  }

  // The original shelf delegates mode centres to separate stage hosts. This
  // receiving frame owns them in panes, so visited centre/side trees join the
  // SAME keyed shelf and the SAME workspace/view budgets, from actual layouts.
  if (presented) visitedTrees.current.add(book.current.id + ':' + (book.current.layout.mode ?? 'base'))
  const warmWorkspaces = new Set([book.current.id, ...book.workspaces.filter(value => value.id !== book.current.id && (value.lastVisitedAt ?? 0) > 0).sort((a, b) => (b.lastVisitedAt ?? 0) - (a.lastVisitedAt ?? 0)).slice(0, WARM_WORKSPACES).map(value => value.id)])
  const desired = new Map(book.warmTrees.map(tree => [tree.key, tree]))
  let budget = Math.max(0, RETAINED_VIEW_BUDGET - book.warmTrees.filter(tree => !tree.presented).reduce((count, tree) => count + groupsOf(tree.layout.root).flatMap(group => group.tabs).length, 0))
  for (const value of book.workspaces) {
    if (!warmWorkspaces.has(value.id)) continue
    for (const layout of [value.layout, ...Object.values(value.modeLayouts ?? {})]) {
      const key = value.id + ':' + (layout.mode ?? 'base')
      if (desired.has(key) || !visitedTrees.current.has(key)) continue
      const ids = [...groupsOf(layout.root).flatMap(group => group.tabs), ...(layout.sidePane?.tabs ?? [])]
      const reasons = ids.filter(id => !!layout.surfaces[id] && (isRetainedCentreKind(layout.surfaces[id].kind) && !OMIT_BODY_KINDS.includes(layout.surfaces[id].kind as 'expressions') || layout.sidePane?.tabs.includes(id)))
      if (!reasons.length || reasons.length > budget) continue
      budget -= reasons.length; desired.set(key, {key, workspaceId: value.id, layout, presented: false})
    }
  }
  const wanted = [...desired.values()].sort((a, b) => a.key.localeCompare(b.key))
  const [treeKeys, setTreeKeys] = useState<string[]>(() => wanted.map(tree => tree.key))
  const wantedKeys = wanted.map(tree => tree.key).join('|')
  const latestWanted = useRef(wanted)
  latestWanted.current = wanted
  useEffect(() => {
    const expected = latestWanted.current, expectedMap = new Map(expected.map(tree => [tree.key, tree]))
    const outgoing = treeKeys.filter(key => !expectedMap.has(key) && !failedReleases.current.has(key))
    // Incoming trees can present while old frames await their local checkpoint.
    setTreeKeys(previous => [...new Set([...previous, ...expected.map(tree => tree.key)])].sort())
    if (!outgoing.length || releasing.current) return
    releasing.current = true
    const ids = [...new Set(retainedTrees.current.filter(tree => outgoing.includes(tree.key)).flatMap(tree => [...groupsOf(tree.layout.root).flatMap(group => group.tabs), ...(tree.layout.sidePane?.tabs ?? [])]))]
    void checkpointDocuments(ids).then(() => {
      if (!mounted.current) return
      if (!latest.current.book.flushCheckpoint()) throw Error('The native book checkpoint failed; retained document views remain mounted.')
      const current = new Map(latestWanted.current.map(tree => [tree.key, tree]))
      // A workspace/mode that returned during the await cannot be released.
      setTreeKeys(previous => [...new Set([...previous.filter(key => !outgoing.includes(key) || current.has(key)), ...current.keys()])].sort())
    }).catch(cause => {
      if (!mounted.current) return
      const current = new Set(latestWanted.current.map(tree => tree.key))
      outgoing.filter(key => !current.has(key)).forEach(key => failedReleases.current.add(key))
      report(cause)
    }).finally(() => {releasing.current = false; if (mounted.current) setReleaseRetry(value => value + 1)})
  }, [wantedKeys, treeKeys.join('|'), releaseRetry, report])
  const activeKey = book.current.id + ':' + (book.current.layout.mode ?? 'base')
  const treeMap = new Map(retainedTrees.current.map(tree => [tree.key, tree]))
  for (const tree of wanted) treeMap.set(tree.key, tree)
  const trees = [...new Set([...treeKeys, activeKey])].flatMap(key => {
    const old = treeMap.get(key)
    const owner = book.workspaces.find(value => value.id === old?.workspaceId) ?? (old ? workspaceCopies.current.get(old.workspaceId) : undefined)
    if (!old || !owner) return []
    const layout = [owner.layout, ...Object.values(owner.modeLayouts ?? {})].find(value => owner.id + ':' + (value.mode ?? 'base') === key) ?? old.layout
    return layout ? [{...old, layout, presented: key === activeKey && presented}] : []
  }).sort((a, b) => a.key.localeCompare(b.key))
  retainedTrees.current = trees
  const retainedOwners = new Set([...book.workspaces.map(owner => owner.id), ...trees.map(tree => tree.workspaceId)])
  for (const id of workspaceCopies.current.keys()) if (!retainedOwners.has(id)) workspaceCopies.current.delete(id)
  for (const key of visitedTrees.current) if (!retainedOwners.has(key.split(':')[0])) visitedTrees.current.delete(key)
  const activeErrors = Object.entries(errors).filter(([id]) => workbenchMembership(book).has(id)).slice(-16)

  return <FactoryLiveProvider><section ref={host} className="candidate-workbench" aria-label="Native Workbench">
    <div className="candidate-workbench-toolbar">
      <span>{book.current.name}</span>
      <button type="button" onClick={() => execute('surface.open')}>New tab</button>
      <button type="button" onClick={() => execute('surface.open-sources')}>Sources</button>
      {registeredHostedSurfaces.filter(entry => entry.descriptor.kind !== 'expressions').map(entry => <button key={entry.descriptor.descriptor_ref} type="button" onClick={() => {try {capture(undefined, true); openKind(entry.descriptor.kind)} catch (cause) {report(cause)}}}>{entry.descriptor.title}</button>)}
      {kernel.transport.kind === 'tauri' && <><button type="button" onClick={() => {try {capture(undefined, true); openKind('terminal')} catch (cause) {report(cause)}}}>Terminal</button><button type="button" onClick={() => {try {capture(undefined, true); openKind('browser')} catch (cause) {report(cause)}}}>Browser</button></>}
    </div>
    {fault && <p role="alert" className="candidate-workbench-fault">{fault}{!config && <button type="button" disabled={!workspace.accessReady} onClick={() => setBackingRetry(value => value + 1)}>Retry backing read</button>}<button type="button" onClick={() => setFault(undefined)}>Dismiss</button></p>}
    {!!failedReleases.current.size && <p role="alert" className="candidate-workbench-fault">Some document views remain mounted because their local checkpoint failed; the normal warm budget may be exceeded.<button type="button" onClick={() => {failedReleases.current.clear(); setReleaseRetry(value => value + 1)}}>Retry local checkpoints</button></p>}
    {returnContext?.origin === 'canvas' && <div className="candidate-workbench-return"><button type="button" disabled={returning || !workspace.accessReady} onClick={returnCanvas}>{returning ? 'Returning…' : 'Return to Canvas'}</button><span>{selected?.title}</span></div>}
    {activeErrors.map(([id, error]) => <p role="alert" key={id} className="candidate-workbench-fault">{book.current.layout.surfaces[id]?.title ?? id}: {error}<button type="button" disabled={!workspace.accessReady} onClick={() => {const binding = workbenchMembership(latest.current.book).get(id); if (!binding) return; attempts.current.delete(workspace.accessEpoch + ':' + id + ':' + identity(binding)); void admit(binding).catch(report)}}>Retry owner read</button></p>)}
    <div className="candidate-workbench-rest" hidden={!!book.current.layout.root}>Open a tab or native contribution to work in this workspace.</div>
    {trees.map(tree => {
      const owner = book.workspaces.find(value => value.id === tree.workspaceId) ?? workspaceCopies.current.get(tree.workspaceId)!
      const allowed = () => tree.presented && latest.current.book.current.id === tree.workspaceId && latest.current.book.current.layout.mode === tree.layout.mode
      const dispatch = (ref: string, arg?: ActionArg) => {if (allowed()) execute(ref, arg)}
      const receivingEpoch = workspace.accessEpoch
      const subjects = new Map(Object.values(tree.layout.surfaces).map(binding => [binding.id, identity(binding)]))
      const receivingCurrent = (id: string) => latest.current.workspace.nativeAccessCurrent(receivingEpoch) && identity(workbenchMembership(latest.current.book).get(id) ?? {id: '', kind: '', title: ''}) === subjects.get(id)
      let factoryScope:NativePreparedContextScope|undefined,factoryUnavailable:string|undefined
      try{factoryScope=workbenchContextScope(tree.layout,tree.workspaceId,receivingEpoch,owner.project,sourceWorldRef)}catch(cause){factoryUnavailable=String(cause instanceof Error?cause.message:cause)}
      const factoryCurrent=()=>{
        if(!factoryScope||!allowed()||!latest.current.workspace.nativeAccessCurrent(receivingEpoch)||host.current?.closest<HTMLElement>('.inhabitant')?.hidden)return false
        try{return preparedContextScopeKey(factoryScope)===preparedContextScopeKey(workbenchContextScope(latest.current.book.current.layout,tree.workspaceId,receivingEpoch,latest.current.book.current.project,sourceWorldRef))}catch{return false}
      }
      const props: WorkbenchProps = {
        state: tree.layout, workspaceName: owner.name, presented: tree.presented, centreBodiesInPanes: true, omitBodyKinds: OMIT_BODY_KINDS, sourceWorldRef, bodyUnavailable: unavailable,
        onView: (id, view) => {if (receivingCurrent(id)) latest.current.book.surfaceView(tree.workspaceId, id, view)},
        onHostedState: (id, reading) => {
          const scene = reading.nativeScene
          if (!receivingCurrent(id) || !scene?.expression_ref) return
          const revision = String(scene.revision), documentId = reading.document?.id
          const saved = workbenchMembership(latest.current.book).get(id)?.engine
          if (saved?.expressionRef === scene.expression_ref && saved.revision === revision && saved.documentId === documentId) return
          latest.current.book.surfaceEngine(tree.workspaceId, id, {expressionRef: scene.expression_ref, revision, ...(documentId ? {documentId} : {})})
        },
        execute: dispatch, openBindingMenu: (id, x, y) => {if (allowed()) menuFor(id, x, y)}, openFrameMenu: (x, y) => {if (allowed()) menuFor(undefined, x, y)}, menuOpen: !!menu,
        nativeWindows: kernel.transport.kind === 'tauri', openSource: source => {if (allowed()) openSource(source)}, openKnowledge, openExplore, openPresentation,
        openEncounter: row => allowed() ? openEncounter(row) : Promise.reject(Error('The originating Workbench tree is concealed.')),
        conversation: <FactoryChat layout={tree.layout} project={owner.project} sourceWorldRef={sourceWorldRef} workspaceId={tree.workspaceId} accessEpoch={receivingEpoch}
          current={scope=>{
            if(!allowed()||!latest.current.workspace.nativeAccessCurrent(receivingEpoch)||host.current?.closest<HTMLElement>('.inhabitant')?.hidden)return false
            try{return preparedContextScopeKey(scope)===preparedContextScopeKey(workbenchContextScope(latest.current.book.current.layout,tree.workspaceId,receivingEpoch,latest.current.book.current.project,sourceWorldRef))}catch{return false}
          }} openSubject={subject=>{
            try{
              capture(undefined,true)
              if(subject.location){insert({id:crypto.randomUUID(),kind:'file',ref:subject.location.ref,location:subject.location,title:subject.title,project:subject.project});return}
              const held=Object.values(latest.current.book.current.layout.surfaces).find(binding=>!!subject.ref&&binding.ref===subject.ref&&binding.project===subject.project)
              if(!held)throw Error('This context item has no disclosed native source-opening address.')
              insert(held)
            }catch(cause){report(cause)}
          }} choose={(row,current,world)=>allowed()?chooseConversation(row,current,world):Promise.reject(Error('The originating conversation is concealed.'))} accompany={(value,world)=>{
            if(!allowed()||!latest.current.workspace.nativeAccessCurrent(receivingEpoch))return
            if(!value){latest.current.book.setLayout(layout=>({...layout,accompanying:undefined}));return}
            const existing=Object.values(latest.current.book.current.layout.surfaces).find(binding=>binding.kind==='encounter'&&binding.ref===value.ref&&binding.project===value.project&&binding.encounter?.space===value.space&&hostedWorld(binding)===world)
            const binding:SurfaceBinding=existing??{id:crypto.randomUUID(),kind:'encounter',title:'Conversation',project:value.project,ref:value.ref,encounter:{space:value.space},...(world?{view:{sourceWorldRef:world} as NonNullable<SurfaceBinding['view']>&{sourceWorldRef:string}}:{})}
            latest.current.book.setLayout(layout=>openBinding({...layout,accompanying:value},binding))
          }} provision={async (project,preferredBodyRef) => {
          if (!allowed()) throw Error('The originating Factory tree is concealed.')
          if (sourceWorldRef) throw Error('This hosted World does not disclose a qualified new-conversation provision operation.')
          const {origin, current} = capture(undefined, true)
          const reading = await ownerIO(current, () => encounterProvision(origin.kernel.transport, project,preferredBodyRef))
          current()
          return {ref:reading.agent_session,project:reading.project,space:reading.space}
        }} report={report}/>,
        host: {project:factoryScope?.project,sourceWorldRef:factoryScope?.sourceWorldRef,current:factoryCurrent,unavailable:factoryUnavailable,accompanying:tree.layout.accompanying,openEncounter:row=>factoryCurrent()?chooseFactory(row):Promise.reject(Error(factoryUnavailable??'The originating Factory owner is concealed or retired.')),onMessage:report}, subject: owner.context?.subject,
      }
      const side = tree.layout.sidePane
      return <div className="candidate-workbench-tree" key={tree.key} hidden={!tree.presented}>
        <ProjectionEncounterProvider source={encounterSource}><Workbench {...props}/></ProjectionEncounterProvider>
        {side && <aside className="candidate-workbench-side"><GroupPane {...props} pane={side} group={side} state={{...tree.layout, root: side, focusedGroupId: side.id, sidePane: undefined}} kernelDirty={ref => !!ref && !!kernel.snapshot.buffers[ref]?.dirty} openBindingMenu={(id, x, y) => {if (allowed()) menuFor(id, x, y, true)}} openFrameMenu={(x, y) => {if (allowed()) menuFor(undefined, x, y, true)}}
          insertMenu={close => <button type="button" onClick={() => {if (allowed()) executeSide('surface.open'); close()}}>New tab</button>}
          stripTools={<button type="button" disabled={!side.active} onClick={() => {if (!allowed() || !side.active) return; const id = side.active; void checkpointDocuments([id]).then(() => {if (allowed()) latest.current.book.moveSurface(id, 'tree')}).catch(report)}}>Move to centre</button>}
          execute={(ref, arg) => {if (allowed()) executeSide(ref, arg)}}/></aside>}
      </div>
    })}
    {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} onInvoke={(item, surfaceId) => {setMenu(null); (menuSide.current ? executeSide : execute)(item.action_ref, {surfaceId})}}/>}
  </section></FactoryLiveProvider>
}

function FactoryChat({layout, project, sourceWorldRef, workspaceId,accessEpoch,current,openSubject,choose,accompany, provision, report}: {
  layout: LayoutState; project?: string; sourceWorldRef?: string;
  workspaceId:string;accessEpoch:number;current:(scope:NativePreparedContextScope)=>boolean;openSubject:(subject:AgentSubject)=>void;
  accompany:(value:AgentAccompanying|undefined,world?:string)=>void;provision:(project:string,preferredBodyRef?:string)=>Promise<AgentAccompanying>;report:(cause:unknown)=>void;
  choose:(row:EncounterRow,current?:()=>boolean,world?:string)=>Promise<void>;
}) {
  let scope:NativePreparedContextScope|undefined,scopeError:string|undefined
  try{scope=workbenchContextScope(layout,workspaceId,accessEpoch,project,sourceWorldRef)}catch(cause){scopeError=String(cause instanceof Error?cause.message:cause)}
  const focused = activeBindingId(layout), subject = focused ? layout.surfaces[focused] : undefined
  return <>
    {scopeError&&<p className="native-error" role="alert">{scopeError}</p>}
    {scope&&<NativeAgencyParticipation scope={scope} current={()=>current(scope!)} mode={layout.mode}
      subject={{ref:subject?.ref,kind:subject?.kind,title:subject?.title??'Workspace',project:subject?.project,location:subject?.location}}
      onAccompanying={value=>{if(current(scope!))accompany(value,scope!.sourceWorldRef)}}
      onChoose={(row,original)=>choose(row,()=>current(scope!)&&(!original||original()),scope!.sourceWorldRef)}
      onProvision={async(project,preferredBodyRef)=>{if(!current(scope!))throw Error('The original conversation owner has retired.');if(scope!.sourceWorldRef)throw Error('This hosted World does not disclose a qualified new-conversation provision operation.');return await provision(project,preferredBodyRef)}}
      onOpenSubject={openSubject} onError={report} resolveSurface={id=>layout.surfaces[id]}/>}
  </>
}
