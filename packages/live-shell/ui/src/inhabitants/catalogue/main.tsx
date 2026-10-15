// The catalogue gallery (npx vite --config src/inhabitants/catalogue/vite.config.mjs, port 5208). It draws every device the
// families declare at the door, through the shell's own runtime (frame/devices/DeviceView.tsx), in each view the manual names
// (docs/dlw/DLW.md §16.1): folded, compact, whole, full and widget. The DLW manual embeds it beside each device's spec:
//   ?device=<family>:<face>&view=all|folded|compact|whole|full|widget   one device
//   (no device)                                                          the index of every declared device
// Readings are a labelled fixture (?values=none shows the owner-less state): the gallery writes no owner.
import {createRoot} from 'react-dom/client'
import {useMemo, type ReactNode} from 'react'
import '../../styles.css'
import {loadWorldShellFamilies, worldShellFamilyManifests} from '../worldShellFamilies'
import {sdkParamRows, type DeviceDeclaration, type SdkParamRow} from '../sdk/define'
import {AGENT_SHELL_ADDRESS_TABLE} from '../agentParamAddresses'
import type {InhabitantFaceDeclaration, InhabitantManifest} from '../manifest'
import {FacePlate} from '../sdk/controls'
import {DeviceView} from '../../frame/devices/DeviceView'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import {centralDevice, CENTRAL_FAMILY} from '../../central/devices/centralDeviceModel'
import './catalogue.css'

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

function Index() {
  const manifests = worldShellFamilyManifests()
  return <main className="cat-index">
    <h1>Device catalogue</h1>
    <p className="cat-note">Every device the families declare, drawn by the shell's runtime. Readings are a labelled fixture.</p>
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
  const found = useMemo(() => {
    if (!id) return null
    const [family, faceId] = id.split(':')
    const manifest = worldShellFamilyManifests().find(candidate => candidate.id === family)
    const face = manifest?.faces.find(candidate => candidate.id === faceId)
    return manifest && face ? instanceOf(manifest, face, fixture) : undefined
  }, [id, fixture])
  if (!id) return <Index />
  if (!found) return <main className="cat-missing"><p><b>{id}</b> is not declared at the door.</p><p>Its catalogue entry is the specification for its declaration.</p></main>
  const views = viewParam === 'all' ? VIEWS : (VIEWS as readonly string[]).includes(viewParam) ? [viewParam as View] : VIEWS
  return <main className="cat-device">
    <DeviceViews device={found} views={views} />
    {fixture && <p className="cat-note">Fixture readings — the gallery writes no owner.</p>}
  </main>
}

createRoot(document.getElementById('root')!).render(<Gallery />)
