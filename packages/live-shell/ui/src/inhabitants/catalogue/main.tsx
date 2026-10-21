// The catalogue gallery (npx vite --config src/inhabitants/catalogue/vite.config.mjs, port 5208). It draws every device the
// families declare at the door, through the shell's own runtime (frame/devices/DeviceView.tsx), in each view the manual names
// (docs/dlw/DLW.md §16.3): folded, compact, whole (expanded above the chain; the pool holds no device, §16.7), full, pop-out and widget. The
// DLW manual embeds it beside each device's spec:
//   ?device=<family>:<face>&view=all|folded|compact|whole|full|popout|widget   one device (or a comma list of views; flip names whole)
//   (no device)                                                          the index of every declared device
// Readings are a labelled fixture (?values=none shows the owner-less state): the gallery writes no owner.
import {createRoot} from 'react-dom/client'
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import '../../styles.css'
import {loadWorldShellFamilies, worldShellFamilyManifests} from '../worldShellFamilies'
import {sdkParamRows, type DeviceDeclaration, type SdkParamRow} from '../sdk/define'
import {AGENT_SHELL_ADDRESS_TABLE} from '../agentParamAddresses'
import type {InhabitantFaceDeclaration, InhabitantManifest} from '../manifest'
import {FacePlate} from '../sdk/controls'
import {DeviceView} from '../../frame/devices/DeviceView'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import {centralDevice, CENTRAL_FAMILY} from '../../central/devices/centralDeviceModel'
import {DESIGNED, DESIGNED_IDS, loadDesign, type DesignedDevice} from './panels'
import type {Value} from './panels/design'
import {flippedOf, popoutOf} from './panels/popout'
import {PlaceContext} from '../sdk/panel'
import {ClipGallery} from './clips/gallery'
import './catalogue.css'
import './panels/panels.css'

loadWorldShellFamilies()

const VIEWS = ['folded', 'compact', 'flip', 'full', 'popout', 'widget'] as const
/** What each frame shows, as its title: the view, and where it stands when that is not the view's only place. */
const FRAME_TITLE: Readonly<Record<View, string>> = {folded: 'folded', compact: 'compact', flip: 'whole · expanded above the chain', full: 'full · a pane', popout: 'pop-out · its own window', widget: 'widget · the rail'}
type View = typeof VIEWS[number]

/** The views a query names: all, one, or a comma list (?view=flip,popout). */
const viewsOf = (param: string): readonly View[] => {
  if (param === 'all') return VIEWS
  const named = param.split(',').map(name => (name === 'whole' ? 'flip' : name)).filter((name): name is View => (VIEWS as readonly string[]).includes(name))
  return named.length ? named : VIEWS
}

const humanise = (key: string): string => key.split(/[-_]/).map(part => (part ? part[0]!.toUpperCase() + part.slice(1) : '')).join(' ')

/** The rows a face carries: the kit's registered rows, else the verified address table's, titled. */
function rowsOf(family: string, face: InhabitantFaceDeclaration): SdkParamRow[] {
  const kit = sdkParamRows(family as never).filter(row => row.deviceInstance === face.id)
  if (kit.length) return [...kit]
  return AGENT_SHELL_ADDRESS_TABLE.filter(row => row.family === family && row.deviceInstance === face.id)
    .map(row => ({...row, title: humanise(row.key), range: row.range ? {...row.range, unit: row.unit} : undefined}) as SdkParamRow)
}

/** A labelled fixture reading for each written row, so the controls show a value (the gallery's own, never an owner's). */
function fixtureValues(rows: readonly SdkParamRow[]): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
  for (const row of rows) {
    if (!row.writePath) continue
    if (row.type === 'boolean') values[row.key] = true
    else if (row.type === 'enumerated' && row.values?.length) values[row.key] = row.values[0]!
    else if (row.type === 'number') {
      const min = row.range?.min ?? 0, max = row.range?.max ?? 1
      values[row.key] = Math.round((min + (max - min) * 0.6) * 100) / 100
    }
  }
  return values
}

function instanceOf(manifest: InhabitantManifest, face: InhabitantFaceDeclaration, fixture: boolean): DeviceInstance {
  if (manifest.id === CENTRAL_FAMILY) {
    const device = centralDevice(face, {} as never)
    return fixture ? {...device, values: {...fixtureValues(device.rows), ...device.values}, submit: async () => {}} : device
  }
  const rows = rowsOf(manifest.id, face)
  const declaration = {id: face.id, title: humanise(face.id), icon: 'form', liveSemantic: face.liveSemantic, note: face.note} as unknown as DeviceDeclaration
  return {id: `${manifest.id}:${face.id}`, family: manifest.id, face: declaration, rows,
    values: fixture ? fixtureValues(rows) : {}, ...(fixture ? {submit: async () => {}} : {})}
}

function ViewFrame({view, children}: {view: View; children: ReactNode}) {
  return <section className={`cat-view cat-view--${view}`} data-view={view}>
    <h2 className="cat-view-title">{FRAME_TITLE[view]}</h2>
    <div className="cat-view-body">{children}</div>
  </section>
}

function DeviceViews({device, views}: {device: DeviceInstance; views: readonly View[]}) {
  const presentation = {family: device.family, faceId: device.face.id, title: device.face.title, icon: device.face.icon, owner: device.family}
  const one = (view: View): ReactNode => {
    switch (view) {
      case 'folded': return <FacePlate presentation={presentation} power="unknown" folded>{null}</FacePlate>
      case 'compact': return <DeviceView device={device} size="compact" />
      case 'full': return <div className="cat-pane"><DeviceView device={device} size="full" /></div>
      // The generic plate has no wide frame or window of its own: a device without a design shows Whole there.
      case 'flip': return <DeviceView device={device} size="whole" />
      case 'popout': return <div className="cat-pane"><DeviceView device={device} size="full" /></div>
      case 'widget': return <div className="cat-rail"><div className="cat-rail-head">{device.face.title}</div><DeviceView device={device} size="compact" /></div>
    }
  }
  return <div className="cat-views">{views.map(view => <ViewFrame key={view} view={view}>{one(view)}</ViewFrame>)}</div>
}

/** The status bar's line: what the control under the pointer (or in focus) does, from its data-i (WIDGET-GUIDE §1, the hover law). */
function StatusLine() {
  const [said, setSaid] = useState<string>('')
  useEffect(() => {
    const read = (event: Event) => {
      const at = (event.target as Element | null)?.closest?.('[data-i]')
      const [name, does] = (at?.getAttribute('data-i') ?? '').split('|')
      setSaid(name ? (does ? `${name} — ${does}` : name) : '')
    }
    document.addEventListener('mouseover', read)
    document.addEventListener('focusin', read)
    return () => { document.removeEventListener('mouseover', read); document.removeEventListener('focusin', read) }
  }, [])
  return <div className="cat-status" role="status">{said || 'Point at a control to read what it does.'}</div>
}

/** A designed device in its six views, all on one set of values: move a macro on the chain and the expanded band, the pane,
 * the window and the rail move with it. */
/** A rack's member, as the gallery draws it inside the rack's Full: the member's own design in its Whole view, at the pool's
 * measures, on its own defaults (the shell draws it on its owner). A member with no design draws nothing here; the rack stands in. */
function GalleryMember({id}: {id: string}) {
  const [design, setDesign] = useState<DesignedDevice | null | undefined>(undefined)
  useEffect(() => { let live = true; void loadDesign(id).then(found => { if (live) setDesign(found ?? null) }); return () => { live = false } }, [id])
  const [values, setValues] = useState<Record<string, Value> | null>(null)
  const [page, setPage] = useState('')
  if (!design) return null
  const v = values ?? Object.fromEntries(Object.entries(design.defaults).filter(([, x]) => x !== undefined)) as Record<string, Value>
  const set = (key: string, value: Value | undefined) => setValues(() => {
    const next = {...v}
    if (value === undefined) delete next[key]; else next[key] = value
    return next
  })
  return <>{design.whole({v, set, nav: {}, page: page || design.firstPage || '', setPage})}</>
}
const galleryMember = (id: string) => <GalleryMember key={id} id={id} />

function DesignedViews({design, views, fixture: first}: {design: DesignedDevice; views: readonly View[]; fixture?: string | null}) {
  const names = Object.keys(design.fixtures ?? {})
  const [fixture, setFixture] = useState(first && names.includes(first) ? first : names[0] ?? '')
  // A fixture lays its readings over the defaults; a key it sets to undefined is dropped, as an owner that reports nothing.
  const over = (name: string) => Object.fromEntries(Object.entries({...design.defaults, ...(design.fixtures?.[name] ?? {})})
    .filter(([, value]) => value !== undefined)) as Record<string, Value>
  const [values, setValues] = useState<Record<string, Value>>(over(fixture))
  // ?page=<id> opens the device on that page (the manual's embed beside the page it describes).
  const [page, setPage] = useState(new URLSearchParams(location.search).get('page') ?? design.firstPage ?? '')
  const [folded, setFolded] = useState(false)
  const pane = useRef<HTMLDivElement>(null), flip = useRef<HTMLDivElement>(null), win = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  // The wide frames (expanded, its own window) take the page's width, up to a window's.
  const wide = Math.min(1180, Math.max(640, window.innerWidth - 24))
  const show = (at: {current: HTMLElement | null}) => at.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'})
  const set = (key: string, value: Value | undefined) => setValues(was => {
    const next = {...was}
    if (value === undefined) delete next[key]; else next[key] = value
    return next
  })
  const props = {v: values, set, page, setPage, ...(design.kind === 'rack' ? {member: galleryMember} : {}),
    nav: {fold: () => setFolded(true), unfold: () => setFolded(false), full: () => show(pane), expand: () => show(flip), popout: () => show(win)}}
  const place = {onExpand: () => { setExpanded(was => !was); show(flip) }, expanded, onPopout: () => show(win)}
  const one = (view: View): ReactNode => {
    switch (view) {
      case 'folded': return design.folded({...props, nav: {}})
      case 'compact': return folded ? design.folded(props) : design.compact(props)
      // Live's expanded view: a band as wide as the detail area, above the chain; the panes above shrink to make room.
      case 'flip': return <div className="cat-flip" ref={flip}>
        <div className="cat-flip-panes" aria-hidden="true">Panes</div>
        {flippedOf(design, {...props, room: undefined}, {w: wide, h: 192})}
        <div className="cat-flip-chain"><PlaceContext.Provider value={{...place, expanded: true}}>{design.compact(props)}</PlaceContext.Provider></div>
      </div>
      // A rack's Full is its devices (manual §16.3): it takes a pane as wide as the page, and its members draw on their own designs.
      case 'full': return design.kind === 'rack'
        ? <div className="cat-pane cat-pane--ref cat-pane--suite" ref={pane} style={{width: wide}}>{design.full({...props, frame: 'pane', room: {w: wide, h: 620}})}</div>
        : <div className="cat-pane cat-pane--ref" ref={pane}>{design.full({...props, frame: 'pane', room: {w: 760, h: 420}})}</div>
      // Live's plug-in window: the device's own window, the material over every control.
      case 'popout': return <div className="cat-window" ref={win}>
        <div className="cat-window-bar"><i /><i /><i /><span>{design.title}</span></div>
        <div className="cat-window-room">{popoutOf(design, props, {w: wide, h: 620})}</div>
      </div>
      case 'widget': return <div className="cat-rail cat-rail--ref"><div className="cat-rail-head">Rail</div><div className="cat-rail-tiles">{design.widget(props)}</div></div>
    }
  }
  return <>
    {names.length > 0 && <div className="cat-fixtures" role="group" aria-label="Fixture">
      <span>Fixture</span>
      {names.map(name => <button key={name} type="button" aria-pressed={name === fixture} onClick={() => { setFixture(name); setValues(over(name)) }}>{name}</button>)}
    </div>}
    <PlaceContext.Provider value={place}>
      <div className="cat-views cat-views--ref">{views.map(view => <ViewFrame key={view} view={view}>{one(view)}</ViewFrame>)}</div>
    </PlaceContext.Provider>
  </>
}

function Index() {
  const manifests = worldShellFamilyManifests()
  return <main className="cat-index">
    <h1>Device catalogue</h1>
    <p className="cat-note">Every device the families declare, drawn by the shell's runtime. Readings are a labelled fixture.</p>
    <section>
      <h2>Reference devices</h2>
      <ul>{Object.values(DESIGNED).map(design => <li key={design.id}>
        <a href={`?device=${design.id}&view=all`}>{design.title}</a><span className="cat-semantic">{design.kind} · reference</span>
      </li>)}</ul>
      <h2>Designed devices</h2>
      <ul>{DESIGNED_IDS.map(id => <li key={id}><a href={`?device=${id}&view=all`}>{id}</a><span className="cat-semantic">designed</span></li>)}</ul>
    </section>
    {manifests.map(manifest => <section key={manifest.id}>
      <h2>{manifest.id}</h2>
      <ul>{manifest.faces.map(face => <li key={face.id}>
        <a href={`?device=${manifest.id}:${face.id}&view=all`}>{humanise(face.id)}</a>
        <span className="cat-semantic">{face.liveSemantic ?? ''}{face.admission === 'waiting' ? ' · waiting' : ''}</span>
      </li>)}</ul>
    </section>)}
  </main>
}

function Gallery() {
  const query = new URLSearchParams(location.search)
  const id = query.get('device')
  const viewParam = query.get('view') ?? 'all'
  const fixture = query.get('values') !== 'none'
  // A designed device draws in place of the generic plate; one in its own module loads on demand. A module that fails to
  // load says so and leaves the generic plate.
  const [design, setDesign] = useState<DesignedDevice | 'loading' | undefined>(() => (id && DESIGNED[id]) || (id && DESIGNED_IDS.includes(id) ? 'loading' : undefined))
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    if (!id || DESIGNED[id] || !DESIGNED_IDS.includes(id)) return
    loadDesign(id).then(found => setDesign(found), cause => { setLoadError(String(cause)); setDesign(undefined) })
  }, [id])
  const found = useMemo(() => {
    if (!id) return null
    const [family, faceId] = id.split(':')
    const manifest = worldShellFamilyManifests().find(candidate => candidate.id === family)
    const face = manifest?.faces.find(candidate => candidate.id === faceId)
    return manifest && face ? instanceOf(manifest, face, fixture) : undefined
  }, [id, fixture])
  if (!id) return <Index />
  if (design === 'loading') return <main className="cat-missing"><p>Loading <b>{id}</b>…</p></main>
  if (design && query.get('generic') !== '1') {
    const views = viewsOf(viewParam)
    return <main className="cat-device"><DesignedViews design={design} views={views} fixture={query.get('fixture')} /><StatusLine /></main>
  }
  if (loadError) return <main className="cat-missing"><p><b>{id}</b>: its designed views did not load.</p><pre>{loadError}</pre></main>
  if (!found) return <main className="cat-missing"><p><b>{id}</b> is not declared at the door.</p><p>Its catalogue entry is the specification for its declaration.</p></main>
  const views = viewsOf(viewParam)
  return <main className="cat-device">
    <DeviceViews device={found} views={views} />
    {fixture && <p className="cat-note">Fixture readings — the gallery writes no owner.</p>}
  </main>
}

// ?clip=<mode>: Clip view in that mode, at the detail area's size and expanded (clips/gallery.tsx).
const clipRoute = new URLSearchParams(location.search).get('clip')
createRoot(document.getElementById('root')!).render(clipRoute !== null ? <ClipGallery mode={clipRoute} /> : <Gallery />)

// Embedded in the manual, the gallery tells the page its height, so the frame fits every view it draws (docs/dlw/render.mjs).
if (window.parent !== window) {
  const tell = () => window.parent.postMessage({dlwGallery: {h: Math.ceil(document.documentElement.scrollHeight)}}, '*')
  new ResizeObserver(tell).observe(document.body)
  tell()
}
