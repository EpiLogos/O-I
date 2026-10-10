import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { NativeDirectory, NativeFileEntry } from '@epilogos/expressions-boundary/cradle'
import {createCradleOwners} from '@epilogos/expressions-boundary/cradle'
import {sameEditorBasis} from '@epilogos/expressions-boundary/editor'
import type {KernelExpressionDocument} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge'
import {createCanvasKnowledgeOpen} from '../native/knowledgeOpen'
import { useWorkspace } from '../shell/workspace'
import {NativeMaterialBrowser} from './NativeMaterialBrowser'
import {NativePropertyBrowser} from './NativePropertyBrowser'
import {NativeTechneBrowser} from './NativeTechneBrowser'
import {NativeDeviceBrowser} from './NativeDeviceBrowser'
import {NativeObjectBrowser} from './NativeObjectBrowser'
import {NativeExpressionCollections} from './NativeExpressionCollections'
import {applyDeviceChanges} from './NativeDevicePoolView'
import {NativeDevicePool, type DeviceRequest} from './NativeDevicePool'
import {countLabel, deviceRows, objectRows, rowAfter, type RowKey} from './nativeBrowserModel'
import {deviceCatalogue} from './nativeDeviceCatalogue.ts'
import {OPEN_DEVICE_EVENT, parseOpenDevice} from './nativeDrag'
import './WorldBrowser.css'

type BrowserCategory = 'works' | 'material' | 'objects' | 'properties' | 'devices' | 'files' | 'knowledge'
const CATEGORIES: {id: BrowserCategory; name: string; icon: string}[] = [
  {id: 'works', name: 'Expressions', icon: '◇'},
  {id: 'material', name: 'Material', icon: '▧'},
  {id: 'objects', name: 'Objects', icon: '+'},
  {id: 'properties', name: 'Parameters', icon: '○'},
  {id: 'devices', name: 'Devices', icon: '▤'},
  {id: 'files', name: 'Files', icon: '▸'},
  {id: 'knowledge', name: 'Knowledge', icon: '⌘'},
]

/** Navigation over the native Central listing. Locations and retrieval grants
 * come from that owner; this component holds only a displayed directory. */
export function WorldBrowser() {
  const workspace = useWorkspace()
  const { transport, nativeWorks, selectedRef, reading, resources, workspaceId, accessEpoch, accessReady, sourceRecoveryReady, browserPath: path } = workspace
  const origin = useRef(workspace)
  origin.current = workspace
  const [directory, setDirectory] = useState<NativeDirectory | null>(null)
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openingGraph, setOpeningGraph] = useState(false)
  const [category, setCategory] = useState<BrowserCategory>('works')
  const [poolOpen, setPoolOpen] = useState(true)
  // The pool's device role is independent of the category: closing it shows the category that was open.
  const [device, setDevice] = useState<DeviceRequest | null>(null)
  const deviceRef = useRef<DeviceRequest | null>(null)
  deviceRef.current = device
  const deviceOpener = useRef<HTMLElement | null>(null)
  const [materialHost, setMaterialHost] = useState<HTMLDivElement | null>(null)
  const [propertyHost, setPropertyHost] = useState<HTMLDivElement | null>(null)
  const fileEpoch = useRef(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [previewRef, setPreviewRef] = useState<string | null>(null)
  const reportCount = useCallback((id: string, count: number) => setCounts(before => before[id] === count ? before : {...before, [id]: count}), [])

  useEffect(() => {
    const browseParameters = () => {setCategory('properties'); setPoolOpen(true); setQuery('')}
    window.addEventListener('oi:expression-browse-parameters', browseParameters)
    return () => window.removeEventListener('oi:expression-browse-parameters', browseParameters)
  }, [])

  // One open request from the rack, the parameter browser or the Devices list. It never touches the bottom rack.
  useEffect(() => {
    const openDevice = (event: Event) => {
      const request = parseOpenDevice((event as CustomEvent<unknown>).detail)
      if (!request) return
      if (!deviceRef.current) deviceOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setPoolOpen(true)
      setDevice(previous => ({...request, nonce: (previous?.nonce ?? 0) + 1}))
    }
    window.addEventListener(OPEN_DEVICE_EVENT, openDevice)
    return () => window.removeEventListener(OPEN_DEVICE_EVENT, openDevice)
  }, [])

  useEffect(() => {
    ++fileEpoch.current
    setDirectory(null)
    setOpening(null)
    setError(null)
    if (transport.kind === 'unavailable' || !accessReady || !sourceRecoveryReady
      || origin.current.workspaceId !== workspaceId || !workspace.nativeAccessCurrent(accessEpoch)) { setLoading(false); return }
    let live = true
    const listing = resources.directory(workspaceId)
    const listingKey = listing.activeWorkspaceKey
    const sync = () => {
      if (!live || listing.activeWorkspaceKey !== listingKey || origin.current.workspaceId !== workspaceId || !workspace.nativeAccessCurrent(accessEpoch)) return
      const entry = listing.entry(path)
      setDirectory(entry.reading ?? null); setError(entry.error ?? null); setLoading(entry.status === 'pending')
      if (entry.status === 'pending') resources.ensureDirectory(workspaceId, path)
    }
    const unsubscribe = listing.subscribe(sync)
    if (workspace.nativeAccessCurrent(accessEpoch)) resources.ensureDirectory(workspaceId, path)
    sync()
    return () => {live = false; unsubscribe(); ++fileEpoch.current}
  }, [transport, path, workspaceId, accessEpoch, accessReady, sourceRecoveryReady, resources])

  /** Closing the device role shows the category again; focus returns to the element that opened the panel. */
  function closeDevice() {
    const back = deviceOpener.current
    deviceOpener.current = null
    setDevice(null)
    requestAnimationFrame(() => {if (back?.isConnected) back.focus({preventScroll: true})})
  }
  function navigate(nextPath: string) { ++fileEpoch.current; setOpening(null); setQuery(''); workspace.navigateFiles(nextPath) }
  async function selectFile(entry: NativeFileEntry) {
    if (!entry.retrieval_allowed || entry.kind !== 'file' || transport.kind === 'unavailable' || !accessReady) return
    const epoch = ++fileEpoch.current
    setOpening(entry.location.ref)
    setError(null)
    try {
      const intent = {workspaceId, viewId: workspace.prepareSource(entry.location), generation: epoch,
        isCurrent: () => fileEpoch.current === epoch && origin.current.workspaceId === workspaceId && workspace.nativeAccessCurrent(accessEpoch)}
      const source = await resources.read(entry.location, intent)
      if (source.location.ref !== entry.location.ref) throw Error('The native reading belongs to another subject')
      workspace.publishSource(source, intent)
    } catch (reason) {
      if (fileEpoch.current === epoch) setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      if (fileEpoch.current === epoch) setOpening(null)
    }
  }
  const parts = (directory?.location.path ?? path).split('/').filter(Boolean)
  const needle = query.trim().toLocaleLowerCase()
  const entries = (directory?.entries ?? []).filter(entry => (showHidden || !entry.name.startsWith('.')) && (!needle || entry.name.toLocaleLowerCase().includes(needle))).sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name))
  const works = nativeWorks.filter(work => !needle || work.title.toLocaleLowerCase().includes(needle))
  const deviceList = deviceRows(deviceCatalogue(), workspace.editorReading, category === 'devices' ? query : '')
  const objectList = objectRows(workspace.editorReading, category === 'objects' ? query : '')
  const previewWork = nativeWorks.find(work => work.expression_ref === previewRef)
  const countText = category === 'works' ? countLabel(works.length, 'expression') : category === 'files' ? countLabel(entries.length, 'entry')
    : category === 'devices' ? countLabel(deviceList.length, 'device')
    : category === 'material' && counts.material !== undefined ? countLabel(counts.material, 'material')
    : category === 'properties' && counts.properties !== undefined ? countLabel(counts.properties, 'parameter') : ''
  /** Rows are the visible [data-browser-row] buttons of every category. Esc clears the search; arrows walk the rows; Space previews. */
  function onBrowserKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement, rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-browser-row]')].filter(row => !row.closest('[hidden]'))
    if (target === searchRef.current) {
      if (event.key === 'Escape' && query) {event.preventDefault(); setQuery('')}
      else if (event.key === 'ArrowDown' && rows.length) {event.preventDefault(); rows[0].focus()}
      return
    }
    const index = rows.indexOf(target)
    if (index < 0 || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = rowAfter(rows.length, index, event.key as RowKey)
    if (next < 0) searchRef.current?.focus()
    else {rows[next].focus(); rows[next].scrollIntoView({block: 'nearest'})}
  }
  function openWork(ref: string) {
    if (workspace.mode === 'audio') workspace.setMode('expressions')
    workspace.requestExpression(ref)
  }
  async function openSelectedGraph() {
    const editor = workspace.editorReading, mode = workspace.mode
    if (!editor || mode === 'audio' || openingGraph || !accessReady || editor.standing.pending) return
    const captured = structuredClone(editor), epoch = accessEpoch, id = workspaceId
    const valid = () => origin.current.workspaceId === id && origin.current.nativeAccessCurrent(epoch)
      && !!origin.current.editorReading && sameEditorBasis(captured.basis, origin.current.editorReading.basis)
      && JSON.stringify(captured.selection) === JSON.stringify(origin.current.editorReading.selection)
    setOpeningGraph(true); setError(null)
    try {
      const owners = createCradleOwners(transport, {project: '', isCurrent: valid})
      const result = await owners.channels['kernel-expression']({operation: 'inspect', expression_ref: captured.basis.expression_ref},
        {mode, bindingId: 'world.expressions', epoch, signal: new AbortController().signal, state: reading, current: valid}) as {state?: string; document?: KernelExpressionDocument}
      if (!valid()) throw Error('The selected Canvas changed while its native subject was being read')
      if (result.state !== 'ready' || !result.document) throw Error('The native owner did not disclose the selected Expression')
      const input = createCanvasKnowledgeOpen(result.document, captured, mode)
      const complete = (error?: string) => {if (valid() && error) setError(error)}
      window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {...input, complete}}))
    } catch (cause) {if (origin.current.workspaceId === id) setError(cause instanceof Error ? cause.message : String(cause))}
    finally {setOpeningGraph(false)}
  }
  return <aside className={`world-browser world-browser-categories${poolOpen ? '' : ' pool-collapsed'}`} aria-label="World browser" onKeyDown={onBrowserKeyDown}>
    <div className="world-browser-searchrow"><label className="world-browser-search"><span className="sr-only">Search {CATEGORIES.find(row => row.id === category)?.name}</span><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search (⌘ F)" /></label><output className="world-browser-count" aria-live="polite">{countText}</output></div>
    <div className="world-browser-main">
      <nav className="world-category-list" aria-label="World browser categories"><h3>Library</h3>{CATEGORIES.map(row => <button type="button" key={row.id} aria-pressed={category === row.id} onClick={() => {setCategory(row.id); setQuery('')}}><span aria-hidden="true">{row.icon}</span><span>{row.name}</span></button>)}</nav>
      <div className="world-browser-results">
    <div hidden={category !== 'knowledge'}><NativeTechneBrowser query={category==='knowledge'?query:''} onOpenGraph={openSelectedGraph} openingGraph={openingGraph} graphError={category==='knowledge'?error:null}/></div>
    <section hidden={category !== 'works'} className="world-works" aria-label="Saved native works"><h3>Name</h3><ul>{works.map(work => <li key={work.expression_ref}><button type="button" data-browser-row className={`world-work-row${reading?.nativeScene?.expression_ref === work.expression_ref ? ' selected' : ''}${previewRef === work.expression_ref ? ' previewed' : ''}`} aria-current={reading?.nativeScene?.expression_ref === work.expression_ref ? 'true' : undefined} title={`${work.expression_ref} · revision ${work.revision}. Enter opens; Space previews.`} onClick={() => openWork(work.expression_ref)} onKeyDown={event => {if (event.key === ' ') {event.preventDefault(); setPreviewRef(work.expression_ref)}}} onKeyUp={event => {if (event.key === ' ') event.preventDefault()}}><span aria-hidden="true">◇</span><span>{work.title}</span></button></li>)}</ul>{!works.length && <p className="native-empty">{nativeWorks.length ? 'No works match this search.' : 'No native works disclosed.'}</p>}</section>
    {category === 'works' && <NativeExpressionCollections query={query}/>}
    <div hidden={category !== 'material'}><NativeMaterialBrowser query={category === 'material' ? query : ''} detailHost={materialHost} onCount={count => reportCount('material', count)}/></div>
    <div hidden={category !== 'properties'}><NativePropertyBrowser query={category === 'properties' ? query : ''} detailHost={propertyHost} onCount={count => reportCount('properties', count)}/></div>
    <div hidden={category !== 'objects'}><NativeObjectBrowser rows={objectList} reading={workspace.editorReading} request={(changes, basis) => applyDeviceChanges(workspace, changes, basis)}/></div>
    <div hidden={category !== 'devices'}><NativeDeviceBrowser rows={deviceList} reading={workspace.editorReading} selected={device?.family ?? null}/></div>
    <section hidden={category !== 'files'} className="world-files" aria-label="Central files">
      <div className="world-files-heading"><h3>Central</h3><button type="button" className="world-hidden-toggle" aria-pressed={showHidden} title="Show native dot files and directories" onClick={() => setShowHidden(value => !value)}>Hidden</button></div>
      <nav className="world-breadcrumbs" aria-label="Central file path"><button type="button" onClick={() => navigate('')} aria-current={!parts.length ? 'location' : undefined}>⌂</button>{parts.map((part, index) => <span key={parts.slice(0, index + 1).join('/')}><span aria-hidden="true">›</span><button type="button" onClick={() => navigate(parts.slice(0, index + 1).join('/'))} aria-current={index === parts.length - 1 ? 'location' : undefined}>{part}</button></span>)}</nav>
      {transport.kind === 'unavailable' && <p className="native-error" role="status">{transport.reason}</p>}
      {transport.kind !== 'unavailable' && !accessReady && <p className="native-empty" role="status">Qualifying the native World resource access…</p>}
      {workspace.sourceError && <p className="native-error" role="alert">{workspace.sourceError}</p>}
      {error && <p className="native-error" role="alert">{error}</p>}
      {loading && <p className="native-empty" role="status">Reading Central…</p>}
      {directory && <ul className="world-file-list">{parts.length > 0 && <li><button type="button" className="world-file-row" onClick={() => navigate(parts.slice(0, -1).join('/'))}><span aria-hidden="true">↰</span><span>Parent folder</span></button></li>}{entries.map(entry => {
        const isDirectory = entry.kind === 'directory'
        const available = isDirectory || (entry.kind === 'file' && entry.retrieval_allowed)
        return <li key={entry.location.ref}><button type="button" className={`world-file-row${selectedRef === entry.location.ref ? ' selected' : ''}`} disabled={!available} aria-current={selectedRef === entry.location.ref ? 'true' : undefined} title={available ? `${entry.location.path}\n${entry.location.ref}` : `Native retrieval is unavailable for this ${entry.kind}`} onClick={() => isDirectory ? navigate(entry.location.path) : void selectFile(entry)}><span aria-hidden="true">{isDirectory ? '▸' : '·'}</span><span>{entry.name}</span>{opening === entry.location.ref && <span className="world-file-status" role="status">…</span>}</button></li>
      })}</ul>}
      {directory && !entries.length && <p className="native-empty">{needle ? 'No files match in this folder.' : 'This folder has no visible entries.'}</p>}
    </section>
      </div>
    </div>
    <section className={`world-context-pool${device ? ' is-device' : ''}`} aria-label="Browser context">
      <header><button type="button" aria-expanded={poolOpen} aria-controls="world-browser-pool-body" onClick={() => setPoolOpen(value => !value)}><span aria-hidden="true">{poolOpen ? '▾' : '▸'}</span> {device ? 'Device' : category === 'properties' ? 'Parameter' : category === 'material' ? 'Material' : category === 'objects' ? 'Objects' : category === 'devices' ? 'Devices' : 'Context'}</button></header>
      <div id="world-browser-pool-body" className="world-pool-body" hidden={!poolOpen}>
        {device && <NativeDevicePool request={device} onClose={closeDevice}/>}
        <div hidden={device !== null}>
          <div ref={setMaterialHost} hidden={category !== 'material'}/>
          <div ref={setPropertyHost} hidden={category !== 'properties'}/>
          {category === 'works' && previewWork && <p className="world-browser-preview" role="status">Previewing {previewWork.title}. Enter opens it.</p>}
          {category === 'works' && <p className="native-empty">{reading?.nativeScene ? 'The open Expression keeps its own Scenes, objects and chosen controls.' : 'Open a native Expression to continue its work.'}</p>}
          {category === 'objects' && <p className="native-empty">Adds a formation or force pin to the open Scene, one native edit each. Drag onto the stage is not available yet.</p>}
          {category === 'devices' && <p className="native-empty">Select a device to open its whole panel here. Editing here never adds to the rack; + Add or a drag onto the rack does.</p>}
          {category === 'files' && <div className="world-file-context"><strong>Central</strong><p>{directory?.location.path || 'Personal ground'}</p><button type="button" disabled={loading || transport.kind === 'unavailable' || !accessReady} onClick={() => resources.ensureDirectory(workspaceId, path, true)}>Refresh folder</button></div>}
          {category === 'knowledge' && <p className="native-empty">Instruments open over the current native work. Graph keeps the selected subject and its Canvas Return.</p>}
        </div>
      </div>
    </section>
  </aside>
}
