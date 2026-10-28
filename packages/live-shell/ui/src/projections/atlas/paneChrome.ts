// The Earth pane's chrome, on the devices (O-I #762; manual §16.3: Full holds the material itself — "the page, the field, the torus,
// the world. No controls" — and "A pane holds no device controls. They stay in Device view under the pane"; §17.11: a lens's controls
// are the Lens's). The ported atlas draws its own chrome over the globe: the focus label (a subject's name, its line and its acts), the
// graph's display settings, the closes of its reading cards, and a non-Field lens's own title and controls (its panel's handle, close,
// tabs, walk rail and fields; Aion's epochs, rails and ring; the Red Book's and the dynamical lens's rails and closes). The host stands
// all of it down in the pane (atlasHost.css, the same regions as below) and reads it here as data, in the atlas's own words and states;
// the World device draws the World's part (inhabitants/ql/devices/atlasDevices.ts atlasGlobeBinding) and the Lens the lens's
// (techne/devices/effectBindings.ts lensBinding). A press from a device is the atlas's own control pressed — a button clicked, a choice
// chosen, a value set — through the same element and handler the hand reached in the pane: nothing here re-implements a control or keeps
// a copy of a value, and the atlas's keys are unchanged.
//
// Ported, not recreated: the frame's chrome door does the same for the hosted Expressions frame
// (desktop/cradle/expressions-app/field-studies-journeys/src/presentedChrome.ts — its words :38-49, its kinds :174-189, its keys :193-201,
// its locate :206-252, its setNative :255-260 and its press :293-319), itself the move of the atlas header's door (src/shell/shell.ts
// headerReading: "each press is the header's own button pressed"). Adapted for the atlas: the regions are the atlas's, a control is read
// by its tag and its attributes (no prototype checks, so the host tests read it over a small stand-in), and what the host stands down is
// read whole (the frame stands its chrome down by visibility; the host stands the atlas's down by display, so nothing here measures).
// What stays in the pane is the material: the globe, the graph, the palace floor, and the readings the atlas opens with the links in
// their text (a related name, a cite, a step into the field).

import {useSyncExternalStore} from 'react'

/** Which device stands a control: the World (§17.2) or the Lens (§17.11). */
export type PaneChromeHome = 'world' | 'lens'
export type PaneChromeKind = 'button' | 'toggle' | 'select' | 'text' | 'number' | 'reading'

/** One control of the pane's chrome, as the atlas draws it. */
export interface PaneChromeControl {
  /** `<region>/<key>`: stable across the atlas's redraws, so a press names the control the person saw */
  readonly id: string
  readonly home: PaneChromeHome
  /** the region it stands in (focus, closes, graph, panel, aion, redbook, dynamics) */
  readonly region: string
  readonly kind: PaneChromeKind
  /** its name: what it says of itself, else the words it shows */
  readonly label: string
  /** its hover words, where they say more than its name */
  readonly title?: string
  /** a reading's words, a field's value, a choice's value */
  readonly value?: string
  readonly pressed?: boolean
  readonly disabled?: boolean
  readonly options?: readonly {readonly value: string; readonly label: string}[]
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

/** What a device reads of one home: the controls in the atlas's order, and the title of the lens or reading they belong to. */
export interface PaneChromeReading {
  readonly title: string | null
  readonly controls: readonly PaneChromeControl[]
}

/** The least of an element the reader needs: the browser's own, or a stand-in in the host tests. */
export interface ChromeElement {
  readonly tagName: string
  readonly children: ArrayLike<ChromeElement>
  readonly parentElement: ChromeElement | null
  readonly classList: {contains(name: string): boolean}
  readonly textContent: string | null
  getAttribute(name: string): string | null
  hasAttribute(name: string): boolean
  click(): void
  dispatchEvent?(event: Event): boolean
  value?: string
  checked?: boolean
  disabled?: boolean
  readonly type?: string
  readonly options?: ArrayLike<{readonly value: string; readonly textContent: string | null}>
}

/** A region of the atlas's chrome: the class of its root, the class its root must stand inside (a rail is Aion's or the Red Book's),
 * the device it goes to, whether its root's own name titles it, which of its elements are its controls (the rest of a reading stays),
 * and what the host's stylesheet stands down in the pane for it (atlasHost.css: the host tests hold the two equal). */
export interface PaneChromeRegion {
  readonly name: string
  readonly home: PaneChromeHome
  readonly root: string
  readonly within?: string
  readonly titled?: boolean
  /** Whether an element inside the root is one of the region's controls. Absent: every button, field and choice in it. */
  readonly control?: (element: ChromeElement) => boolean
  /** The selector, under `.atlas-host`, the pane stands down for this region. */
  readonly standDown: string
  /** The class of the region's own disclosure in the pane (the graph's Settings panel), which the stand-down supersedes: its `hidden`
   * is the closed disclosure's, not the atlas concealing the region, so its controls are read whether it was opened or not. */
  readonly opens?: string
}

const tag = (element: ChromeElement) => element.tagName.toLowerCase()
const FIELD_TAGS = new Set(['input', 'select', 'textarea'])
const isField = (element: ChromeElement) => FIELD_TAGS.has(tag(element)) && !['file', 'hidden'].includes(element.getAttribute('type') ?? '')
const isControl = (element: ChromeElement) => tag(element) === 'button' || element.getAttribute('role') === 'button' || isField(element)
const hasClass = (element: ChromeElement, ...names: string[]) => names.some(name => element.classList.contains(name))
/** Whether an ancestor (not the element) up to, not past, `stop` carries the class. */
function within(element: ChromeElement, name: string, stop: ChromeElement): boolean {
  for (let node = element.parentElement; node && node !== stop; node = node.parentElement) if (node.classList.contains(name)) return true
  return false
}
const insideTag = (element: ChromeElement, name: string, stop: ChromeElement): boolean => {
  for (let node: ChromeElement | null = element.parentElement; node && node !== stop; node = node.parentElement) if (tag(node) === name) return true
  return false
}

/** A lens panel's own controls (src/shell/panel.ts): its handle, its close and its walk rail; the lens's tabs (lenses/theory.ts th-tab);
 * and its fields with the buttons of their forms (Astrology's birth form, a dream, a coincidence, the symbol to find). The reading the
 * panel holds — its text, its rows, the links in it — is the lens's material and stays in the pane. */
const panelControl = (element: ChromeElement): boolean => {
  if (hasClass(element, 'lp-handle', 'lp-close', 'th-tab')) return true
  if (isField(element)) return true
  if (tag(element) !== 'button') return false
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.classList.contains('lens-panel')) return false
    if (node.classList.contains('lp-foot') || tag(node) === 'form') return true
  }
  return false
}

/** The regions. One list: the reader below reads them, and the host's stylesheet stands each one's `standDown` down in the pane. A
 * control two regions name is the first's (a reading lens's card close is the Lens's, before the Field's cards). */
export const PANE_CHROME_REGIONS: readonly PaneChromeRegion[] = [
  // The Lens's: a panel lens's own title and controls …
  {name: 'panel', home: 'lens', root: 'lens-panel', titled: true, control: panelControl,
    standDown: '.lens-panel :is(.lp-handle, .lp-close, .lp-foot, .th-tab, form, input, select, textarea)'},
  // … Aion's epochs, its walk rail, its card's close and the equinox ring's convention (aion/view.ts, aion/skyclock-view.ts) …
  {name: 'aion', home: 'lens', root: 'aion-epochs', within: 'aion', standDown: '.aion .aion-epochs'},
  {name: 'aion', home: 'lens', root: 'rb-rail', within: 'aion', standDown: '.aion .rb-rail'},
  {name: 'aion', home: 'lens', root: 'rv-close', within: 'aion', standDown: '.rv-close'},
  {name: 'aion', home: 'lens', root: 'aion-ring', within: 'aion', control: element => tag(element) === 'select', standDown: '.aion-ring select'},
  // … the Red Book's folio walk and its card's close (redbook/view.ts) …
  {name: 'redbook', home: 'lens', root: 'rb-rail', within: 'redbook', standDown: '.redbook .rb-rail'},
  {name: 'redbook', home: 'lens', root: 'rv-close', within: 'redbook', standDown: '.rv-close'},
  // … and the dynamical lens's route rail and its card's close (dynamics/view.ts).
  {name: 'dynamics', home: 'lens', root: 'dy-rail', within: 'dynamics', standDown: '.dynamics .dy-rail'},
  {name: 'dynamics', home: 'lens', root: 'rv-close', within: 'dynamics', standDown: '.rv-close'},
  // The World's: the focus label (ui/focus-label.ts: the way out, the name, the line, the ties, where it hangs in the sky, its acts) …
  {name: 'focus', home: 'world', root: 'focus-label', standDown: '.focus-label'},
  // … the closes of the Field's reading cards (ui/reveal.ts rv-close; ui/deep.ts and ui/passage.ts dp-close) …
  {name: 'closes', home: 'world', root: 'rv-close', standDown: '.rv-close'},
  {name: 'closes', home: 'world', root: 'dp-close', standDown: '.dp-close'},
  // … and the graph's display settings (graph/tools.ts gvt-display: node size, link width, text fade, Reset). The graph's settings
  // stand down whole: the rest of them (steps, kinds, relations, sky anchors, forces, Reframe) stand on the Project plate's Graph and
  // Forces (inhabitants/ql/devices/ProjectPlate.tsx) and the Graph tools device already.
  {name: 'graph', home: 'world', root: 'gvt-display', within: 'gv-tools', standDown: '.gv-tools', opens: 'gvt-panel'},
]

/** What the host's stylesheet stands down in the pane, once each: atlasHost.css lists exactly these, under `.atlas-host`. */
export const PANE_STAND_DOWN: readonly string[] = [...new Set(PANE_CHROME_REGIONS.map(region => region.standDown))]

// ── reading (presentedChrome.ts :38-49, :174-201) ─────────────────────────────────────────────────────────────────────────────────

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()
const words = (element: ChromeElement, attribute: string) => clean(element.getAttribute(attribute))
/** A field's name from the label around it: the label's own words, never the field's value or options. */
function labelWords(element: ChromeElement): string {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (tag(node) !== 'label') continue
    let text = node.textContent ?? ''
    for (const child of descendants(node)) if (FIELD_TAGS.has(tag(child)) && child.textContent) text = text.replace(child.textContent, '')
    return clean(text)
  }
  return ''
}
const shownWords = (element: ChromeElement): string => (FIELD_TAGS.has(tag(element)) ? labelWords(element) : clean(element.textContent))

function kindOf(element: ChromeElement): PaneChromeKind {
  const name = tag(element)
  if (name === 'select') return 'select'
  if (name === 'textarea') return 'text'
  if (name === 'input') {
    const type = (element.getAttribute('type') ?? 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') return 'toggle'
    if (type === 'number' || type === 'range') return 'number'
    return 'text'
  }
  if (name === 'button' || element.getAttribute('role') === 'button') {
    // a tab of a lens's sections (lenses/theory.ts th-tab) is one of a set, the one it stands on marked current
    return element.hasAttribute('aria-pressed') || element.hasAttribute('aria-current') || element.hasAttribute('aria-expanded') || element.getAttribute('role') === 'tab'
      || element.classList.contains('th-tab') ? 'toggle' : 'button'
  }
  return 'reading'
}

/** Its key in its region: its id, else its name, else its tag. */
function keyOf(element: ChromeElement): string {
  const id = element.getAttribute('id')
  if (id) return `#${id}`
  const label = words(element, 'aria-label') || shownWords(element) || words(element, 'title') || words(element, 'placeholder')
  return label ? label : tag(element)
}

/** Whether the atlas draws it where it stands: no ancestor up to the pane hidden, set aside from the accessibility tree, or inert. The
 * host's stand-down is not a concealment the atlas made, so it is not read here. */
function drawn(element: ChromeElement, pane: ChromeElement, opens?: string): boolean {
  for (let node: ChromeElement | null = element; node && node !== pane; node = node.parentElement) {
    if ((node.hasAttribute('hidden') && !(opens && node.classList.contains(opens))) || node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('inert')) return false
  }
  return true
}

/** Every element under the root, in document order. */
function* descendants(root: ChromeElement): Generator<ChromeElement> {
  for (const child of Array.from(root.children)) {
    yield child
    yield* descendants(child)
  }
}

/** The region's roots among the pane's elements (walked once per reading), in document order. */
function rootsOf(all: readonly ChromeElement[], pane: ChromeElement, region: PaneChromeRegion): ChromeElement[] {
  return all.filter(element => element.classList.contains(region.root) && (!region.within || within(element, region.within, pane)))
}

interface Located {readonly control: PaneChromeControl; readonly element: ChromeElement}

function locate(pane: ChromeElement): {located: Located[]; titles: Record<PaneChromeHome, string | null>} {
  const located: Located[] = []
  const seen = new Set<string>()
  const taken = new Set<ChromeElement>()
  const titles: Record<PaneChromeHome, string | null> = {world: null, lens: null}
  const take = (region: PaneChromeRegion, element: ChromeElement, kind: PaneChromeKind) => {
    if (taken.has(element)) return
    taken.add(element)
    const label = words(element, 'aria-label') || shownWords(element) || words(element, 'title') || words(element, 'placeholder') || tag(element)
    let id = `${region.name}/${keyOf(element)}`
    for (let n = 2; seen.has(id); n++) id = `${id.replace(/~\d+$/, '')}~${n}`
    seen.add(id)
    const title = words(element, 'title')
    const control: {-readonly [K in keyof PaneChromeControl]: PaneChromeControl[K]} = {id, home: region.home, region: region.name, kind, label}
    if (title && title !== label) control.title = title
    if (kind === 'reading') control.value = shownWords(element)
    if (element.disabled) control.disabled = true
    if (kind === 'toggle') {
      const aria = element.getAttribute('aria-pressed') ?? element.getAttribute('aria-expanded') ?? (element.hasAttribute('aria-current') ? String(element.getAttribute('aria-current') !== 'false') : null)
      control.pressed = tag(element) === 'input' ? !!element.checked : aria === 'true' || aria === 'step' || aria === 'page'
    }
    if (tag(element) === 'select') {
      control.value = element.value ?? ''
      control.options = Array.from(element.options ?? []).map(option => ({value: option.value, label: clean(option.textContent) || option.value}))
    }
    if ((tag(element) === 'input' && kind !== 'toggle') || tag(element) === 'textarea') {
      control.value = element.value ?? ''
      for (const key of ['min', 'max', 'step'] as const) {
        const raw = element.getAttribute(key)
        const number = Number(raw)
        if (raw !== null && raw !== '' && Number.isFinite(number)) control[key] = number
      }
    }
    located.push({control, element})
  }
  const all = [...descendants(pane)]
  for (const region of PANE_CHROME_REGIONS) {
    for (const root of rootsOf(all, pane, region)) {
      if (!drawn(root, pane, region.opens)) continue
      // a lens's title: its panel's own name, else the name of the lens it stands in (Aion's "Archetypal history", "The Red Book")
      if (region.home === 'lens' && !titles.lens) {
        let named: ChromeElement | null = region.titled ? root : root.parentElement
        while (named && region.within && !named.classList.contains(region.within)) named = named.parentElement
        titles.lens = (named ? words(named, 'aria-label') : '') || null
      }
      // the focus label's name and line are its readings: the subject the acts are for
      if (region.name === 'focus') {
        for (const element of descendants(root)) if (hasClass(element, 'fl-line') || (tag(element) === 'h2' && hasClass(element, 'fl-name'))) {
          if (drawn(element, pane)) take(region, element, 'reading')
        }
        if (!titles.world) titles.world = clean([...descendants(root)].find(element => hasClass(element, 'fl-name'))?.textContent) || null
      }
      const elements = isControl(root) ? [root] : [...descendants(root)]
      for (const element of elements) {
        if (!isControl(element) || !drawn(element, pane, region.opens)) continue
        // a part inside a control is the control's own words, not a second control
        if (element !== root && insideTag(element, 'button', root)) continue
        if (region.control && element !== root && !region.control(element)) continue
        take(region, element, kindOf(element))
      }
    }
  }
  return {located, titles}
}

/** The pane's chrome now, by home. */
export function readPaneChrome(pane: ChromeElement): Record<PaneChromeHome, PaneChromeReading> {
  const {located, titles} = locate(pane)
  const of = (home: PaneChromeHome): PaneChromeReading => ({title: titles[home], controls: located.filter(item => item.control.home === home).map(item => item.control)})
  return {world: of('world'), lens: of('lens')}
}

/** A value set the way the person's typing sets it, so the atlas's own listeners take it (presentedChrome.ts :255-260). */
function setNative(element: ChromeElement, value: string): void {
  const own = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element) ?? {}, 'value')
  if (own?.set) own.set.call(element, value)
  else element.value = value
  if (typeof Event === 'function') {
    element.dispatchEvent?.(new Event('input', {bubbles: true}))
    element.dispatchEvent?.(new Event('change', {bubbles: true}))
  }
}

/** Press one control by the id its reading gives it: the atlas's own control, pressed. Refused in words when the pane no longer draws it,
 * when the atlas draws it off, when it is a reading, or when a choice names an option the atlas does not offer (presentedChrome.ts
 * :293-319). */
export function pressPaneChrome(pane: ChromeElement, id: string, value?: string): void {
  const found = locate(pane).located.find(item => item.control.id === id)
  if (!found) throw new Error('The Earth no longer draws this control; read it again.')
  const {control, element} = found
  if (control.disabled) throw new Error(control.title ? `${control.label} is off: ${control.title}` : `${control.label} is off here.`)
  if (control.kind === 'reading') throw new Error(`${control.label} is a reading, not a control.`)
  if (tag(element) === 'select') {
    if (value === undefined || !Array.from(element.options ?? []).some(option => option.value === value)) throw new Error(`${control.label} offers no such choice.`)
    setNative(element, value)
  } else if (tag(element) === 'textarea' || (tag(element) === 'input' && control.kind !== 'toggle')) {
    if (value === undefined) throw new Error(`${control.label} needs a value.`)
    setNative(element, value)
  } else {
    if (value !== undefined) throw new Error(`${control.label} takes no value.`)
    element.click()
  }
}

// ── the reading the devices draw: one per session, the pane that holds the atlas ─────────────────────────────────────────────────

const EMPTY: Record<PaneChromeHome, PaneChromeReading> = {world: {title: null, controls: []}, lens: {title: null, controls: []}}
let current: Record<PaneChromeHome, PaneChromeReading> = EMPTY
let bound: ChromeElement | null = null
const listeners = new Set<() => void>()

/** Publish (or, with null, withdraw) the pane the atlas stands in and its chrome as last read. Called by the attach; exported for the tests. */
export function publishPaneChrome(pane: ChromeElement | null, reading: Record<PaneChromeHome, PaneChromeReading> | null): void {
  bound = pane
  const next = pane && reading ? reading : EMPTY
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  for (const listener of [...listeners]) listener()
}

/** The chrome of one home, as last read: empty while no atlas stands. */
export function paneChrome(home: PaneChromeHome): PaneChromeReading {
  return current[home]
}

export function subscribePaneChrome(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The chrome of one home, as a hook: a device re-reads it when the atlas redraws its chrome. */
export function usePaneChrome(home: PaneChromeHome): PaneChromeReading {
  return useSyncExternalStore(subscribePaneChrome, () => current[home], () => current[home])
}

/** A device's press: the atlas's own control pressed in the pane that holds it. Refused in words while no atlas stands. */
export function pressAtlasChrome(id: string, value?: string): void {
  if (!bound) throw new Error('The Earth has not mounted in this session. Its controls stand once the Earth pane is shown.')
  pressPaneChrome(bound, id, value)
}

/** A device's press as its design sends it (`pane.press`, a JSON {id, value?}): the atlas's own control pressed. A refusal is said through
 * `said`, in its words (the World's and the Lens's bindings say it on the atlas's line, places/placeTool.ts notePlaceTool). */
export function pressPane(press: unknown, said: (text: string) => void): void {
  try {
    const {id, value} = JSON.parse(String(press)) as {id?: unknown; value?: unknown}
    if (typeof id !== 'string') throw new Error('A press names the control it presses.')
    pressAtlasChrome(id, typeof value === 'string' ? value : value === undefined || value === null ? undefined : String(value))
  } catch (error) {
    said(error instanceof Error ? error.message : String(error))
  }
}

/** Read the pane's chrome as the atlas redraws it: a change under the atlas's root is read again a moment later and published when the
 * reading differs, and `changed` is told (the attach tells the faces, so the World's reading is taken again). Released with the attach. */
export function watchPaneChrome(pane: HTMLElement, changed: () => void): {dispose(): void} {
  let queued: ReturnType<typeof setTimeout> | null = null
  let last = ''
  const read = () => {
    queued = null
    const reading = readPaneChrome(pane as unknown as ChromeElement)
    const text = JSON.stringify(reading)
    if (text === last) return
    last = text
    publishPaneChrome(pane as unknown as ChromeElement, reading)
    changed()
  }
  const soon = () => { if (queued === null) queued = setTimeout(read, 60) }
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(soon)
  observer?.observe(pane, {subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['hidden', 'aria-hidden', 'inert', 'aria-pressed', 'aria-current', 'aria-expanded', 'aria-label', 'disabled', 'class', 'title']})
  read()
  return {
    dispose() {
      observer?.disconnect()
      if (queued !== null) clearTimeout(queued)
      queued = null
      publishPaneChrome(null, null)
    },
  }
}
