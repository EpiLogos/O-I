// The gallery's clip route (catalogue/main.tsx): `?clip=<mode>` draws that mode's Clip view at the detail area's size and expanded
// into the main area (Live's ⌥⌘E), both from one set of values, with the clip's fixtures switch. `&fixture=<name>` opens on a
// fixture; `&size=detail|expanded` draws one size only. `?clip=` with no mode lists the clips. The manual embeds these beside each
// mode's "tracks and clips" section.
import {useEffect, useState} from 'react'
import {CLIP_MODES, isClipMode, loadClip} from './index'
import {ClipView} from './clipKit'
import {CLIP_ROOM, type ClipSize, type DesignedClip, type Value} from './design'

const FRAME: Readonly<Record<ClipSize, string>> = {detail: 'detail area · 1180 × 300', expanded: 'expanded · ⌥⌘E · 1180 × 640'}

export function ClipGallery({mode}: {mode: string}) {
  const [design, setDesign] = useState<DesignedClip | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!isClipMode(mode)) return
    loadClip(mode).then(setDesign, cause => setError(String(cause)))
  }, [mode])
  if (!isClipMode(mode)) return <main className="cat-index">
    <h1>Clip view</h1>
    <p className="cat-note">Clip view in each mode, after Live 12's Clip View.</p>
    <ul>{CLIP_MODES.map(item => <li key={item}><a href={`?clip=${item}`}>clip:{item}</a></li>)}</ul>
  </main>
  if (error) return <main className="cat-missing"><p><b>clip:{mode}</b> did not load.</p><pre>{error}</pre></main>
  if (!design) return <main className="cat-missing"><p>Loading <b>clip:{mode}</b>…</p></main>
  return <main className="cat-device"><ClipFrames design={design} /><Status /></main>
}

function ClipFrames({design}: {design: DesignedClip}) {
  const query = new URLSearchParams(location.search)
  const names = Object.keys(design.fixtures ?? {})
  const first = query.get('fixture')
  const [fixture, setFixture] = useState(first && names.includes(first) ? first : names[0] ?? '')
  // A fixture lays its readings over the defaults; a key it sets to undefined is dropped, as an owner that reports nothing.
  const over = (name: string) => Object.fromEntries(Object.entries({...design.defaults, ...(design.fixtures?.[name] ?? {})})
    .filter(([, value]) => value !== undefined)) as Record<string, Value>
  const [values, setValues] = useState<Record<string, Value>>(() => over(fixture))
  const set = (key: string, value: Value | undefined) => setValues(was => {
    const next = {...was}
    if (value === undefined) delete next[key]; else next[key] = value
    return next
  })
  const only = query.get('size')
  const sizes: readonly ClipSize[] = only === 'detail' || only === 'expanded' ? [only] : ['detail', 'expanded']
  return <>
    {names.length > 0 && <div className="cat-fixtures" role="group" aria-label="Fixture">
      <span>Fixture</span>
      {names.map(name => <button key={name} type="button" aria-pressed={name === fixture} onClick={() => { setFixture(name); setValues(over(name)) }}>{name}</button>)}
    </div>}
    <div className="cat-views cat-views--ref" style={{flexDirection: 'column'}}>
      {sizes.map(size => <section key={size} className="cat-view" data-view={size}>
        <h2 className="cat-view-title">{FRAME[size]}</h2>
        <div className="cat-view-body"><ClipView design={design} p={{v: values, set, size, room: CLIP_ROOM[size]}} /></div>
      </section>)}
    </div>
  </>
}

/** The status bar's line: what the control under the pointer does, from its data-i (the hover law). */
function Status() {
  const [said, setSaid] = useState('')
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
