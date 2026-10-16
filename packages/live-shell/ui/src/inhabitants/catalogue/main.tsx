// The catalogue gallery (npx vite --config src/inhabitants/catalogue/vite.config.mjs, port 5208). It draws every device the
// families declare at the door, through the shell's own runtime (frame/devices/DeviceView.tsx), in each view the manual names
// (docs/dlw/DLW.md §16.1): folded, compact, whole, full and widget. The DLW manual embeds it beside each device's spec:
//   ?device=<family>:<face>&view=all|folded|compact|whole|full|widget   one device
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
import './catalogue.css'
import './panels/panels.css'

loadWorldShellFamilies()

const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget'] as const
type View = typeof VIEWS[number]

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
    <h2 className="cat-view-title">{view}</h2>
    <div className="cat-view-body">{children}</div>
  </section>
}

function DeviceViews({device, views}: {device: DeviceInstance; views: readonly View[]}) {
  const presentation = {family: device.family, faceId: device.face.id, title: device.face.title, icon: device.face.icon, owner: device.family}
  const one = (view: View): ReactNode => {
    switch (view) {
      case 'folded': return <FacePlate presentation={presentation} power="unknown" folded>{null}</FacePlate>
      case 'compact': return <DeviceView device={device} size="compact" />
      case 'whole': return <DeviceView device={device} size="whole" />
      case 'full': return <div className="cat-pane"><DeviceView device={device} size="full" /></div>
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

/** A designed device in its five views, all on one set of values: move a macro on the chain and the pool, the pane and the rail
 * move with it. */
function DesignedViews({design, views, fixture: first}: {design: DesignedDevice; views: readonly View[]; fixture?: string | null}) {
  const names = Object.keys(design.fixtures ?? {})
  const [fixture, setFixture] = useState(first && names.includes(first) ? first : names[0] ?? '')
  // A fixture lays its readings over the defaults; a key it sets to undefined is dropped, as an owner that reports nothing.
  const over = (name: string) => Object.fromEntries(Object.entries({...design.defaults, ...(design.fixtures?.[name] ?? {})})
    .filter(([, value]) => value !== undefined)) as Record<string, Value>
  const [values, setValues] = useState<Record<string, Value>>(over(fixture))
  const [page, setPage] = useState(design.firstPage ?? '')
  const [folded, setFolded] = useState(false)
  const pane = useRef<HTMLDivElement>(null)
  const set = (key: string, value: Value | undefined) => setValues(was => {
    const next = {...was}
    if (value === undefined) delete next[key]; else next[key] = value
    return next
  })
  const props = {v: values, set, page, setPage,
    nav: {fold: () => setFolded(true), unfold: () => setFolded(false), full: () => pane.current?.scrollIntoView({block: 'nearest', behavior: 'smooth'})}}
  const one = (view: View): ReactNode => {
    switch (view) {
      case 'folded': return design.folded({...props, nav: {}})
      case 'compact': return folded ? design.folded(props) : design.compact(props)
      case 'whole': return <div className="cat-pool">{design.whole(props)}</div>
      case 'full': return <div className="cat-pane cat-pane--ref" ref={pane}>{design.full(props)}</div>
      case 'widget': return <div className="cat-rail cat-rail--ref"><div className="cat-rail-head">Rail</div><div className="cat-rail-tiles">{design.widget(props)}</div></div>
    }
  }
  return <>
    {names.length > 0 && <div className="cat-fixtures" role="group" aria-label="Fixture">
      <span>Fixture</span>
      {names.map(name => <button key={name} type="button" aria-pressed={name === fixture} onClick={() => { setFixture(name); setValues(over(name)) }}>{name}</button>)}
    </div>}
    <div className="cat-views cat-views--ref">{views.map(view => <ViewFrame key={view} view={view}>{one(view)}</ViewFrame>)}</div>
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
    const views = viewParam === 'all' ? VIEWS : (VIEWS as readonly string[]).includes(viewParam) ? [viewParam as View] : VIEWS
    return <main className="cat-device"><DesignedViews design={design} views={views} fixture={query.get('fixture')} /><StatusLine /></main>
  }
  if (loadError) return <main className="cat-missing"><p><b>{id}</b>: its designed views did not load.</p><pre>{loadError}</pre></main>
  if (!found) return <main className="cat-missing"><p><b>{id}</b> is not declared at the door.</p><p>Its catalogue entry is the specification for its declaration.</p></main>
  const views = viewParam === 'all' ? VIEWS : (VIEWS as readonly string[]).includes(viewParam) ? [viewParam as View] : VIEWS
  return <main className="cat-device">
    <DeviceViews device={found} views={views} />
    {fixture && <p className="cat-note">Fixture readings — the gallery writes no owner.</p>}
  </main>
}

createRoot(document.getElementById('root')!).render(<Gallery />)
