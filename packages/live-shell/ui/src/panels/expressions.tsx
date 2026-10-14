import {useEffect, useRef, useState} from 'react'
import {externalHttpsUrl} from '../../../../../desktop/cradle/src/shared/externalLink'
import {mountExpressionsApplication, reopenConfiguredWorks,
  type ExpressionsHost, type HostedAppMode, type ChannelContext} from '@epilogos/expressions-boundary'
import {createCradleOwners, type KernelTransportStatus} from '@epilogos/expressions-boundary/cradle'
import {createNativeTechneNavigator} from '@epilogos/expressions-boundary/techne'
import {createNativeEditorClient} from '@epilogos/expressions-boundary/editor-host'
import type {NativeEditorController} from '@epilogos/expressions-boundary/editor'
import {registerPanel} from '../shell/panels'
import {useWorkspace} from '../shell/workspace'
import {readShellConfig, shellTransport} from '../native/application'
import {qualifiedExpressionOwners} from '../native/expressionOwners'
import {disclosureSession} from '../../../../../desktop/cradle/src/techne/session'
import {useContinuity, type Workspace} from '../continuity'
import {useKernel} from '../../../../../desktop/cradle/src/kernel/KernelProvider'
import {groupsOf, openBinding} from '../../../../../desktop/cradle/src/surface/engine'
import {withHostedDescriptor} from '../../../../../desktop/cradle/src/contributions/registry'
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import {registeredHostedSurfaces} from '../../../../../desktop/cradle/src/contributions/generated'
import {contributionRegistrationFailure} from '../native/contributions'
import {connectTechneInstrumentRequests} from '../native/techneInstrumentOpen'
import {NATIVE_OPEN_STUDIO, NATIVE_PRESENT_EXPRESSIONS, parseNativeOpenStudio} from '../native/openStudio'
import {NATIVE_ENGINE_COMMAND, parseNativeEngineCommand, setNativeEngineMounted} from '../native/engineCommand'
import {stageEngine} from '../native/stageCommands'
import {answerHostedSummon, sameSummonBasis, SOURCE_PRESENT, summonBasis} from '../native/hostedSummons'
import type {StudioSection} from '@epilogos/expressions-boundary'
import type {HostedAppState, StageCommand, StageResult} from '@epilogos/expressions-boundary'
import {NativeStageTools} from '../components/NativeStageTools'
import {publishFrameTakeLink} from '../native/frameTakes'
import {publishHostedChrome, publishHostedExpressions, useFramePlacement} from '../projections/expressionsPaneHost'
import {followFrame} from '../projections/framePlacement'
import {registerExpressionsPaneHost} from '../projections/expressionsPane'
import {liveTorusFromHost, publishLiveTorusState, setLiveInstrumentCommander} from '../live/torusInstrument'
import {setLivePerformanceChannel} from '../live/LivePresets'

interface NativeWork {expression_ref: string; title: string; revision: number}
const expressionDescriptor = registeredHostedSurfaces.find(row => row.descriptor.kind === 'expressions')?.descriptor

/** The one application body carries an ordinary native workbench binding.
 * Closed bindings remain recoverable, but never stand in for an open host. */
function expressionBinding(owner: Workspace): SurfaceBinding | undefined {
  for (const layout of [owner.layout, ...Object.values(owner.modeLayouts ?? {})]) {
    for (const id of [...groupsOf(layout.root).flatMap(group => group.tabs), ...(layout.sidePane?.tabs ?? []), ...(layout.detached ?? []).map(row => row.surfaceId)]) {
      const binding = layout.surfaces[id]
      if (binding?.kind === 'expressions') return binding
    }
  }
}
const checkpointRef = (binding?: SurfaceBinding) => binding?.engine?.expressionRef.startsWith('expression:') ? binding.engine.expressionRef : undefined

/** The real application is mounted once. The deep cut changes disclosure;
 * both cuts read/edit/save the same owner's document through the boundary. */
export function ExpressionsPanel() {
  const container = useRef<HTMLDivElement>(null)
  const host = useRef<ExpressionsHost | null>(null)
  const navigator = useRef<ReturnType<typeof createNativeTechneNavigator> | null>(null)
  const stopSelection = useRef<(() => void) | null>(null)
  const pendingOpen = useRef<string | null>(null)
  const pendingStudio = useRef<StudioSection | null>(null)
  const workspace = useWorkspace()
  const book = useContinuity(), kernel = useKernel()
  const bookRef = useRef(book)
  bookRef.current = book
  const bindingRequests = useRef(new Set<string>())
  const selectionOwner = useRef({workspaceId: book.current.id, expected: checkpointRef(expressionBinding(book.current))})
  if (selectionOwner.current.workspaceId !== book.current.id) selectionOwner.current = {workspaceId: book.current.id, expected: checkpointRef(expressionBinding(book.current))}
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace
  const openRequest = useRef<((ref: string) => void) | null>(null)
  const requalify = useRef<(() => void) | null>(null)
  const qualified = !!workspace.nativeScope
  const starting = useRef(false)
  const [attempt, retry] = useState(0)
  // The Factory pane that holds the one frame, if any (T-EXPRESSIONS-PANE-LEASE): the container follows its slot; this panel's chrome moves to that pane.
  const placement = useFramePlacement()
  // The hosted cut for the shell's mode: Live (the 'audio' workspace) is the frame's 'live' cut, the native M1 body.
  const hostCut = (mode: typeof workspace.mode): HostedAppMode => mode === 'audio' ? 'live' : mode
  const modeRef = useRef<HostedAppMode>(hostCut(workspace.mode))
  const worldLens = useRef('generic')
  const [status, setStatus] = useState('Loading Expressions…')
  const [fault, setFault] = useState<string | null>(null)
  const [hostFault, setHostFault] = useState<string | null>(null)
  const [surfaceFault, setSurfaceFault] = useState<string | null>(null)
  const [stage, setStage] = useState<HostedAppState | null>(null)
  // Stage controls go through the mounted host only; the answer settles the toolbar's own refusal line.
  const stageRun = (command: StageCommand): Promise<StageResult> => {
    if (!host.current) throw Error('No Expressions application is mounted')
    return host.current.stageCommand(command)
  }
  // The Live instrument's writes reach the owner only through this mounted stage channel (torusInstrument.ts commitLiveInstrumentEdit).
  useEffect(() => {setLiveInstrumentCommander(command => stageRun(command)); return () => setLiveInstrumentCommander(null)}, [])
  // The presets' owner path (T-LIVE-TORUS-INSTRUMENT leg 6): one performance action on the presented Scene, through the host.
  useEffect(() => {setLivePerformanceChannel(action => host.current ? host.current.performance(action) : Promise.reject(new Error('No Expressions application is mounted'))); return () => setLivePerformanceChannel(null)}, [])
  // The shell's transport and Clip Takes tab reach the frame only through this link (native/frameTakes.ts).
  useEffect(() => {publishFrameTakeLink({state: stage, run: host.current ? stageRun : null})}, [stage])
  useEffect(() => () => publishFrameTakeLink({state: null, run: null}), [])

  useEffect(() => {
    if (!qualified || !workspaceRef.current.accessReady) return
    starting.current = true
    const target = container.current
    if (!target) return
    let live = true
    const abort = new AbortController()
    let mounted: ReturnType<typeof mountExpressionsApplication> | null = null
    let editor: NativeEditorController | null = null
    let stopEditor: (() => void) | null = null
    let stopFacade: (() => void) | null = null
    let stopInstruments: (() => void) | null = null
    let facadeGeneration = 0
    let facade: {frame: HTMLIFrameElement; state: () => ReturnType<ExpressionsHost['getState']>} | null = null
    let readingQueued = false
    const refreshEditor = () => {
      if (readingQueued || !editor || !presented()) return
      readingQueued = true
      queueMicrotask(() => {
        readingQueued = false
        if (live && presented()) void editor?.request({operation: 'read'})
      })
    }
    const fail = (cause: unknown) => {if (live) setFault(cause instanceof Error ? cause.message : String(cause))}
    const presented = () => !!target.getClientRects().length && !target.closest('[hidden],[inert]')
    const openNative = (ref: string) => {
      if (!presented() || !mounted) {pendingOpen.current = ref; return}
      selectionOwner.current = {workspaceId: bookRef.current.current.id, expected: ref}
      mounted.host.openExpression(ref, 'world.expressions')
    }
    openRequest.current = openNative
    void (async () => {
      const config = await readShellConfig()
      if (!expressionDescriptor) throw Error('This build has no compiled native Expressions contribution')
      const registrationFailure = contributionRegistrationFailure(expressionDescriptor, config.contributions)
      if (registrationFailure) throw Error(registrationFailure)
      worldLens.current = config.product_ids?.includes('quaternal-logic') ? 'epi-logos' : 'generic'
      const transport: KernelTransportStatus = shellTransport(config)
      const owners = qualifiedExpressionOwners(config, () => workspaceRef.current, () => live)
      const rebind = () => {
        const request = ++facadeGeneration
        stopFacade?.(); stopFacade = null
        stopInstruments?.(); stopInstruments = null
        stopSelection.current?.(); stopSelection.current = null
        navigator.current?.dispose(); navigator.current = null
        const access = workspaceRef.current, epoch = access.accessEpoch
        const isCurrent = () => live && request === facadeGeneration && workspaceRef.current.nativeAccessCurrent(epoch) && workspaceRef.current.accessReady && !!mounted
        if (!isCurrent()) return
        void readShellConfig().then(current => {
          if (!isCurrent() || !mounted) return
          const registrationFailure = contributionRegistrationFailure(expressionDescriptor, current.contributions)
          if (registrationFailure) throw Error(registrationFailure)
          if (JSON.stringify([current.world_scope, current.backing_id, current.profile_scope]) !== JSON.stringify([config.world_scope, config.backing_id, config.profile_scope])) throw Error('This retained Expression belongs to another native ground or installation profile')
          if (facade) stopFacade = createCradleOwners(access.transport, {project: 'O-I', retainSelectionOnDispose: true, isCurrent}).attach?.(facade.frame, facade.state) ?? null
          navigator.current = createNativeTechneNavigator({transport: access.transport, host: mounted.host,
            isPresented: () => isCurrent() && modeRef.current === 'techne' && presented(), onError: cause => {if (isCurrent()) fail(cause)}})
          stopInstruments = connectTechneInstrumentRequests({host:mounted.host,current:()=>workspaceRef.current,
            isPresented:()=>isCurrent()&&presented()})
          if (modeRef.current === 'techne' && presented()) stopSelection.current = navigator.current.connectSelectionRequests()
        }).catch(cause => {if (isCurrent()) fail(cause)})
      }
      requalify.current = rebind
      owners.attach = (frame, state) => {facade = {frame, state}; rebind(); return () => {stopFacade?.(); stopFacade = null; facade = null}}
      if (!live) return
      if (transport.kind === 'unavailable') {fail(transport.reason); return}
      const context = (): ChannelContext => ({mode: modeRef.current, bindingId: 'world.expressions', epoch: 0,
        signal: abort.signal, state: mounted?.host.getState() ?? null, current: () => live})
      const continued = config.saved_works !== undefined && !(Array.isArray(config.saved_works) && config.saved_works.length === 0)
        ? await reopenConfiguredWorks(owners, context(), config.saved_works) : null
      const knownRef = checkpointRef(expressionBinding(bookRef.current.current))
      const initial = (knownRef ? continued?.works.find(work => work.expression_ref === knownRef) : undefined)
        ?? (knownRef ? undefined : continued?.works.find(work => work.scope === modeRef.current) ?? continued?.works[0])
      if (knownRef && continued && !initial) throw Error('The selected Expression has no configured native recovery address; its workspace checkpoint has been retained')
      const enumerate = async () => {
        const epoch = workspaceRef.current.accessEpoch
        const inventory = await owners.channels['kernel-expression']({operation: 'list'}, context()) as {expressions?: NativeWork[]}
        if (!live || !workspaceRef.current.nativeAccessCurrent(epoch)) return []
        const existing = inventory.expressions ?? []
        workspaceRef.current.publishWorks(existing)
        return existing
      }
      // Known open work takes its owner's direct boot route. Enumeration is
      // only needed to choose a first work when there is no held address.
      const existing = knownRef || initial ? [] : await enumerate()
      if (!live) return
      const initialRef = knownRef ?? initial?.expression_ref ?? existing[0]?.expression_ref
      selectionOwner.current = {workspaceId: bookRef.current.current.id, expected: initialRef}
      // A new native owner lease must fetch the current hosted entry rather
      // than reuse a cached HTML page pointing at a previous build. Hidden
      // residents keep this same frame and lease; their reveal does not reload.
      const hostLoad = crypto.randomUUID()
      // The hosted frame's summons (native/hostedSummons.ts). Each answer binds to the frame basis it arrived on and speaks only while that basis stands.
      let summonToken = 0
      const hostedBasis = () => summonBasis(target.querySelector('iframe'), mounted?.host ?? null, mounted ? mounted.host.getState() : null)
      const answerSummon = (request: Readonly<Record<string, unknown>>) => {
        const token = ++summonToken, at = hostedBasis()
        void answerHostedSummon(request, {
          transport,
          current: () => live && token === summonToken && presented() && sameSummonBasis(hostedBasis(), at),
          project: () => bookRef.current.current.project,
          // The Workbench opens files only while it is presented, and the frame holds the centre now: App presents it first (SOURCE_PRESENT).
          openFile: location => window.dispatchEvent(new CustomEvent(SOURCE_PRESENT, {detail: {location}})),
          openKnowledge: input => window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: input})),
          fault: reason => {if (live) setFault(reason)},
          clear: () => {if (live) setFault(null)},
        })
      }
      mounted = mountExpressionsApplication(target, `${config.expressions_entry ?? '/__application/expressions/index.html'}?mode=${modeRef.current}&world=${worldLens.current}&host-load=${hostLoad}${initialRef ? `&expression=${encodeURIComponent(initialRef)}` : ''}`, {
        bindingId: 'world.expressions', owners, mode: modeRef.current, world: worldLens.current,
        recoveryBindings: continued?.works, initialRecoveryBinding: initial,
        isPresented: presented,
        // T-FRAME-TIME-PUSH: the session's shared window nudges the presented frame to re-read it (never a value carried).
        sharedWindow: disclosureSession,
        onState: state => {
          if (!live) return
          setStage(previous => JSON.stringify(previous) === JSON.stringify(state) ? previous : state)
          setNativeEngineMounted(!!state.nativeScene)
          workspaceRef.current.publishReading(state)
          // The Expressions pane body presents this one frame's reading by value (T-EXPRESSIONS-PANE-LEASE); it holds no frame.
          publishHostedExpressions({expression_ref: state.nativeScene?.expression_ref ?? null, title: state.document?.name ?? null})
          // The one instrument's reading (ticket T-LIVE-TORUS-INSTRUMENT): the frame's announced owner reading, or its withdrawal.
          publishLiveTorusState(liveTorusFromHost(state.instrument))
          if (state.nativeScene) {
            const owner = bookRef.current, selected = selectionOwner.current
            const binding = expressionBinding(owner.current), scene = state.nativeScene
            if (workspaceRef.current.accessReady && selected.workspaceId === owner.current.id && (!selected.expected || selected.expected === scene.expression_ref) && binding) {
              const engine = {expressionRef: scene.expression_ref, documentId: state.document?.id, revision: String(scene.revision)}
              if (JSON.stringify(binding.engine) !== JSON.stringify(engine)) owner.surfaceEngine(owner.current.id, binding.id, engine)
            }
            refreshEditor()
          } else workspaceRef.current.publishEditorReading(null)
        },
        onStatus: (value, reason) => {if (live) {
          setStatus(value === 'ready' ? 'Expressions' : value === 'loading' ? 'Loading Expressions…' : 'Expressions unavailable')
          setHostFault(value === 'ready' ? null : reason ?? null)
        }},
        onHostRequest: request => {
          if (request.request === 'workspace-mode' && (request.mode === 'expressions' || request.mode === 'techne')) workspace.setMode(request.mode)
          // An https link the hosted Expressions application asks to open (link cards): the one gate, then the Tauri opener.
          if (request.request === 'open-external') {
            const url = externalHttpsUrl((request as {url?: unknown}).url)
            if (url) void import('@tauri-apps/api/core').then(({invoke}) => invoke('plugin:opener|open_url', {url})).catch(() => {})
          }
          // The frame's source and graph summons (native/hostedSummons.ts); every other kind is named there as not handled.
          if (request.request === 'summon') answerSummon(request)
        },
        onStudioResult: result => {if (live && !result.ok) setFault(result.error)},
      })
      host.current = mounted.host
      editor = createNativeEditorClient(mounted.host)
      stopEditor = editor.subscribe(reading => {if (live) workspace.publishEditorReading(reading)})
      workspace.attachEditor(editor)
      refreshEditor()
      rebind()
      if (knownRef || initial) void enumerate().catch(fail)
      if (pendingOpen.current && presented()) {const ref = pendingOpen.current; pendingOpen.current = null; openNative(ref)}
      // The boot deep link opens this work after the native channel arrives.
      // Posting it again would retain a second copy during initial recovery.
    })().catch(fail).finally(() => {starting.current = false})
    // A device's open-studio request. Ignored unless native work is mounted.
    // Otherwise the centre is revealed first; the section opens once this
    // body is presented (visible() below flushes it).
    const flushStudio = () => {
      const section = pendingStudio.current
      if (!section || !mounted || !presented()) return
      pendingStudio.current = null
      try {mounted.host.openStudio(section)} catch (cause) {fail(cause)}
    }
    const openStudio = (event: Event) => {
      const section = parseNativeOpenStudio((event as CustomEvent<unknown>).detail)
      if (!live || !section || !mounted) return
      pendingStudio.current = section
      if (presented()) flushStudio()
      else window.dispatchEvent(new Event(NATIVE_PRESENT_EXPRESSIONS))
    }
    window.addEventListener(NATIVE_OPEN_STUDIO, openStudio)
    // A physics device's runtime action, run by the mounted host as one engine stage command. Refusals show in this panel.
    const engineCommand = (event: Event) => {
      const request = parseNativeEngineCommand((event as CustomEvent<unknown>).detail)
      if (!live || !request) return
      if (!mounted) {setFault('No native Expression is mounted.'); return}
      try {void mounted.host.stageCommand(stageEngine(request.action, request.confirmed)).then(result => {if (live && !result.ok) setFault(result.error)}, fail)}
      catch (cause) {fail(cause)}
    }
    window.addEventListener(NATIVE_ENGINE_COMMAND, engineCommand)
    const visible = () => {
      host.current?.setPresented()
      if (presented()) refreshEditor()
      const deepPresented = modeRef.current === 'techne' && presented()
      if (deepPresented && navigator.current && !stopSelection.current) stopSelection.current = navigator.current.connectSelectionRequests()
      else if (!deepPresented && stopSelection.current) {stopSelection.current(); stopSelection.current = null}
      if (pendingOpen.current && presented()) {const ref = pendingOpen.current; pendingOpen.current = null; openNative(ref)}
      flushStudio()
    }
    const examine = () => {if (live) workspace.setMode('techne')}
    window.addEventListener('oi:epi-examine', examine)
    const observer = new MutationObserver(visible)
    for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) observer.observe(parent, {attributes: true, attributeFilter: ['hidden', 'inert', 'style', 'class']})
    return () => {live = false; publishLiveTorusState(null); publishHostedExpressions(null); ++facadeGeneration; openRequest.current = null; requalify.current = null; abort.abort(); observer.disconnect(); window.removeEventListener('oi:epi-examine', examine); window.removeEventListener(NATIVE_OPEN_STUDIO, openStudio); window.removeEventListener(NATIVE_ENGINE_COMMAND, engineCommand);
      stopSelection.current?.(); stopSelection.current = null; navigator.current?.dispose(); navigator.current = null;
      stopInstruments?.(); stopInstruments = null;
      stopEditor?.(); editor?.dispose(); workspace.attachEditor(null); workspace.publishEditorReading(null);
      mounted?.dispose(); host.current = null; setNativeEngineMounted(false)}
  }, [qualified, attempt])
  useEffect(() => {
    if (!workspace.accessReady || !kernel.operationReady || (book.current.layout.mode !== 'expressions' && book.current.layout.mode !== 'techne')) return
    const owner = book.current, held = expressionBinding(owner)
    if (held) {
      if (!owner.layout.surfaces[held.id]) book.moveSurface(held.id, 'tree')
      const scene = host.current?.getState()?.nativeScene
      const expected = selectionOwner.current.expected
      if (scene && (!expected || expected === scene.expression_ref)) {
        const engine = {expressionRef: scene.expression_ref, documentId: host.current?.getState()?.document?.id, revision: String(scene.revision)}
        if (JSON.stringify(held.engine) !== JSON.stringify(engine)) book.surfaceEngine(owner.id, held.id, engine)
      }
      return
    }
    const epoch = workspace.accessEpoch, mode = owner.layout.mode, key = `${owner.id}:${epoch}:${mode}`
    if (bindingRequests.current.has(key)) return
    bindingRequests.current.add(key)
    const binding = withHostedDescriptor({id: crypto.randomUUID(), kind: 'expressions', title: 'Expressions', project: owner.project})
    void kernel.apply({op: 'surface_open', surface_id: binding.id, kind: binding.kind, title: binding.title}).then(receipt => {
      if (!workspaceRef.current.nativeAccessCurrent(epoch)) return
      if (receipt?.result !== 'surface_opened') throw Error(kernel.lastOpError() ?? `The native owner returned ${receipt?.result ?? 'no result'} while opening the Expressions presentation`)
      const current = bookRef.current
      if (current.current.id !== owner.id || current.current.layout.mode !== mode) {
        // This completed presentation admission owns no native work. Release
        // only that unused slot, while its originating owner is still current.
        void kernel.apply({op: 'surface_close', surface_id: binding.id}).catch(cause => setFault(String(cause)))
        return
      }
      current.setLayout(layout => openBinding(layout, binding))
      setSurfaceFault(null)
    }).catch(cause => {
      const current = bookRef.current.current
      if (workspaceRef.current.nativeAccessCurrent(epoch) && current.id === owner.id && current.layout.mode === mode)
        setSurfaceFault(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => bindingRequests.current.delete(key))
  }, [book.current.id, book.current.layout.mode, book.current.layout.surfaces, workspace.accessReady, workspace.accessEpoch, kernel.operationReady, attempt])
  useEffect(() => {
    const ref = checkpointRef(expressionBinding(book.current))
    if (!ref) return
    selectionOwner.current = {workspaceId: book.current.id, expected: ref}
    if (host.current?.getState()?.nativeScene?.expression_ref === ref) return
    try {if (openRequest.current) openRequest.current(ref); else pendingOpen.current = ref}
    catch (cause) {setFault(cause instanceof Error ? cause.message : String(cause))}
  }, [book.current.id])
  useEffect(() => {
    requalify.current?.()
    if (qualified && workspace.accessReady && !host.current && !starting.current) retry(value => value + 1)
  }, [qualified, workspace.accessEpoch, workspace.accessReady])
  useEffect(() => {
    stopSelection.current?.(); stopSelection.current = null
    modeRef.current = hostCut(workspace.mode)
    host.current?.setMode(modeRef.current, worldLens.current)
    host.current?.setPresented()
    if (workspace.mode === 'techne' && navigator.current) stopSelection.current = navigator.current.connectSelectionRequests()
  }, [workspace.mode])
  useEffect(() => {
    if (!workspace.expressionToOpen) return
    try { if (openRequest.current) openRequest.current(workspace.expressionToOpen.ref); else pendingOpen.current = workspace.expressionToOpen.ref; setFault(null) }
    catch (cause) { setFault(cause instanceof Error ? cause.message : String(cause)) }
  }, [workspace.expressionToOpen])
  // The pane body reads the frame only while the frame reports ready (T-EXPRESSIONS-PANE-LEASE): a status that is not ready clears it.
  useEffect(() => {if (status !== 'Expressions') publishHostedExpressions(null)}, [status])
  // The frame's chrome is published by value: a Factory pane that holds the frame shows the same toolbar and faults beside its header.
  useEffect(() => {publishHostedChrome({state: stage, run: stageRun, faults: [hostFault, surfaceFault, fault].filter((text): text is string => !!text)})}, [stage, hostFault, surfaceFault, fault, attempt])
  useEffect(() => () => publishHostedChrome(null), [])
  // While a Factory pane holds the frame, the container follows that pane's slot (its own place and state return on release).
  useEffect(() => {
    const frame = container.current
    if (!frame || !placement) return
    return followFrame(frame, placement.slot)
  }, [placement])
  return <div className="expressions-inhabitant" title={status}>
    {!placement && <>
      {hostFault && <div role="alert" className="inhabitant-fault">{hostFault}</div>}
      {surfaceFault && <div role="alert" className="inhabitant-fault">{surfaceFault}</div>}
      {fault && <div role="alert" className="inhabitant-fault">{fault}</div>}
      <NativeStageTools state={stage} run={host.current ? stageRun : null} />
      {!host.current && !starting.current && <button type="button" onClick={() => retry(value => value + 1)}>Reopen native work</button>}
    </>}
    <div ref={container} className="expressions-application" />
  </div>
}

registerPanel({id: 'world.expressions', title: 'Expressions', slot: 'center', component: ExpressionsPanel,
  order: 10, note: 'The native Expressions application and its deep instruments over one retained document'})
// The Factory pane body presents this one frame (T-EXPRESSIONS-PANE-LEASE); it never opens a second frame or lease.
registerExpressionsPaneHost()
