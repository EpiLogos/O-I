/** The frame's chrome, presented on the shell's devices (T-FRAME-CHROME-ONTO-PLATES; manual §16.1 "A pane is a device at full size.
 * Its controls stay out of the pane and appear in Device view below it"; §20.1 Field, Full: "There are no controls in the pane"; §20.2
 * Studio, Rules: "The Studio controls stay out of the field pane"; PATH §1, owner 14 Oct: controls live in device UI, never as chrome
 * inside a pane).
 *
 * The shell tells the frame how it presents it, over the one channel (stageCommands.ts `presentation`): 'devices' (a pane) or 'frame'
 * (the pane at full size). In 'devices' the frame stands its own chrome down — its masthead and tool rail, the research instruments'
 * tool dock, the canvas's zoom keys and minimap toggle, the selected card's panel, the scene bar, the toolbelt handle and the library
 * attribution (workspace.css `body.oi-chrome-devices`) — and nothing else changes: every control stays mounted, keeps its own handler
 * and its own state, and its keyboard shortcuts stay the frame's. In 'frame', and opened standalone, the chrome stands as it always has.
 *
 * What the chrome holds is read here as data, in the frame's own words and states — the reading the frame publishes with its state
 * (app.ts announceHostState, `chrome`) — and a press from the shell is the frame's own control pressed (`press`): a button clicked, a
 * choice chosen, a value set and committed, through the same element and handler the person's hand reaches in 'frame'. This is the
 * atlas's header door's move (projections/atlas/src/shell/shell.ts headerReading, 6f8c25dc5: "each press is the header's own button
 * pressed, so the lens acts as it always has; the plate keeps no copy") made for the frame's whole chrome. Nothing here re-implements a
 * control, and the shell never reaches into this document. */
import {FRAME_CHROME_LIMITS, type FrameChromeControl, type FrameChromeHome, type FrameChromeKind, type FrameChromeOption, type FrameChromeReading, type FramePresentation, type FrameSummon} from './stageCommands.js';

/** A part of the chrome: where it is in this document, and where each of its controls belongs. `lens` is the instrument the research
 * regions draw for (the frame's chooser: project, canvas, timeline, journey) or 'expressions' outside Technē. */
export interface ChromeRegion {
  readonly name: string
  readonly root: () => Element | null
  readonly home: (element: HTMLElement, lens: string) => FrameChromeHome | null
}

/** The lens groups of a research instrument's tools (manual §17.3–§17.5): the first is where an unplaced tool of that lens stands. */
const LENS_TOOLS: Readonly<Record<string, FrameChromeHome>> = {canvas: 'canvas:tools', timeline: 'timeline:lens', journey: 'journey:stops', project: 'project:view'}

/** The canvas's own tools, placed in the manual's groups by the words the frame gives them (researchInstruments.tsx :880-895 and the
 * selected card's panel :940-950); every other tool of the dock stands in Tools. */
const CANVAS_LOOK = /^(Stroke colour|Zoom out canvas|Zoom in canvas|Fit all cards|Fit selected cards|Hide overview|Show overview|Width|Height|Dot colour|Background|Text colour)$/
const CANVAS_VIEWS = /^(Export selection as PNG|Present frames|Previous members|Next members|Focus disclosed source|Save view|Save view as…|Saved views|Export Obsidian canvas|Import Obsidian canvas|Frames)$/
/** The timeline's tools by the group the vendored lens names them in (TimelineLens.tsx toolbar :831) and the frame's own time window
 * (sharedTimeWindow.tsx). */
const TIMELINE_READINGS = /^(Timeline card filters|Timeline context filters|Timeline tag filters|Timeline relation type filters)$/

const words = (element: Element, attribute: string) => (element.getAttribute(attribute) ?? '').replace(/\s+/g, ' ').trim()
/** An element's words: its parts' words joined with spaces, as they read (the scene picker's number, name and standing). */
const textOf = (element: Element): string => (element.children.length
  ? [...element.childNodes].map(node => node instanceof Element ? textOf(node) : (node.textContent ?? '')).map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
  : (element.textContent ?? '')).replace(/\s+/g, ' ').trim()
/** A field's name from the label around it: the label's own words, never the field's options or value. */
const labelWords = (element: Element): string => {
  const label = element.closest('label')
  if (!label) return ''
  return [...label.childNodes].filter(node => !(node instanceof Element && node.matches('select,input,textarea,button,option')))
    .map(node => node instanceof Element ? textOf(node) : node.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim()
}
/** What a control shows of itself: a field's label, any other control's own words. */
const shownWords = (element: Element): string => element.matches('select,input,textarea') ? labelWords(element) : textOf(element)
/** The name a control's group gives it: the nearest labelled group or toolbar between the control and its region. */
function groupLabel(element: HTMLElement, root: Element): string {
  for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
    const label = words(node, 'aria-label')
    if (label && /^(group|toolbar|tablist|radiogroup)$/.test(node.getAttribute('role') ?? '') || label && node.matches('fieldset,[class*=filters],[class*=controls]')) return label
  }
  return ''
}

/** The frame's regions, in the order the person meets them. `held` are regions the frame keeps out of the document while its own
 * Studio is closed (the Canvas section, app.ts canvasHome). */
export function frameChromeRegions(held: {canvasHome?: HTMLElement | null} = {}): ChromeRegion[] {
  const one = (selector: string) => () => document.querySelector(selector)
  return [
    {name: 'save', root: one('#app>.masthead .header-actions'), home: element => element.closest('.nara-instrument-trigger') ? 'nara'
      : element.matches('[data-action="undo"],[data-action="redo"],#native-save') ? 'work'
      : element.matches('[data-action="capture-image"],[data-action="record-video"],[data-action="capture-options"]') ? 'capture' : null},
    {name: 'rail', root: one('#tool-rail'), home: () => 'tools'},
    {name: 'workspace', root: one('#workspace-menu'), home: () => 'tools'},
    {name: 'lens', root: one('#lens-chooser'), home: () => 'lens'},
    {name: 'scene', root: one('nav.instrument .transport-row'), home: () => 'scene'},
    {name: 'side', root: one('#toolbelt-button'), home: () => 'side'},
    // The stage's placement bar (shell.ts #view-controls: grid, snap, the working plane and its depth, face, guides) and the rail's
    // hint, drawn over the field while a placement tool is chosen (app.ts renderAll :957, setHint :948).
    {name: 'view', root: one('#view-controls'), home: () => 'tools'},
    {name: 'hint', root: one('#tool-hint'), home: () => 'tools'},
    // The way out of Present and the recording badge with its Stop (shell.ts #present-return, #recording-badge).
    {name: 'present', root: one('#present-return'), home: () => 'capture'},
    {name: 'recording', root: one('#recording-badge'), home: () => 'capture'},
    {name: 'tools', root: one('#instrument-tools'), home: (element, lens) => {
      const label = words(element, 'aria-label') || shownWords(element) || words(element, 'title')
      if (lens === 'canvas') return CANVAS_LOOK.test(label) ? 'canvas:look' : CANVAS_VIEWS.test(label) ? 'canvas:views' : 'canvas:tools'
      if (lens === 'timeline') {
        if (element.closest('.shared-time-window,[aria-label="Shared time window"],[class*=time-window]')) return 'timeline:window'
        const group = groupLabel(element, document.getElementById('instrument-tools')!)
        return TIMELINE_READINGS.test(group) ? 'timeline:readings' : 'timeline:lens'
      }
      return LENS_TOOLS[lens] ?? null
    }},
    {name: 'zoom', root: one('.research-canvas .canvas-zoom-controls'), home: () => 'canvas:look'},
    {name: 'overview', root: one('.research-canvas .research-minimap-toggle'), home: () => 'canvas:look'},
    {name: 'readout', root: one('.research-instrument .canvas-zoom-readout-host'), home: () => 'canvas:look'},
    {name: 'selected', root: one('#research-inspector'), home: (element, lens) => {
      if (lens !== 'canvas') return LENS_TOOLS[lens] ?? null
      if (element.closest('.research-connector-controls')) return 'canvas:lines'
      if (element.closest('.research-relate-knowledge')) return 'canvas:relation'
      const label = words(element, 'aria-label') || shownWords(element)
      if (element.matches('input[type=color],input[type=number]') || element.closest('.research-object-swatches') || CANVAS_LOOK.test(label)) return 'canvas:look'
      return 'canvas:tools'
    }},
    {name: 'views', root: () => held.canvasHome ?? document.querySelector('.canvas-home'), home: () => 'canvas:views'},
    // The journey's reading panel (journeyInstrument.tsx JourneyBeatPanel in app.ts journeyHome): its stops, their holds and the walk's
    // path, in the manual's groups (§17.5 "Stops, Pace, Transitions, Takes").
    {name: 'journey', root: one('.journey-reading-home'), home: element =>
      element.closest('.journey-path-edge') ? 'journey:transitions'
      : element.closest('.journey-beat-pace,.journey-pace-actions,.journey-pace-status,.journey-path-controls,.journey-path-clock') ? 'journey:pace'
      : 'journey:stops'},
    // The scenes panel inside the scene bar (app.ts renderTimeline :455): its transport and snapping toolbar, the save row, the curve
    // and seam choosers. In the journey lens it is the walk's rows (manual §17.5 Full: "The walk as rows of stops … In a pane, you
    // reorder stops, trim them and play the walk"): the scenes themselves stay in the pane and are never read; its controls are
    // Pace, Stops and Transitions. Opened elsewhere (Save scene…) its controls are the scene bar's.
    {name: 'timeline', root: one('#timeline-panel'), home: (element, lens) => {
      if (!element.closest('.timeline-toolbar,.scene-save-row,.seam-chooser,.curve-tools,.pending-switch')) return null
      if (lens !== 'journey') return 'scene'
      // A stop's hold is its pace, its arrival's length its transition; its name and saves are the stop's own (manual §17.5 Parameters).
      if (element.matches('[data-bind="duration"]')) return 'journey:pace'
      if (element.matches('[data-bind="transition"]')) return 'journey:transitions'
      return element.closest('.timeline-toolbar') ? 'journey:pace' : element.closest('.scene-save-row') ? 'journey:stops' : 'journey:transitions'
    }},
    // The relation field's own keys over its arcs (relationFieldView.tsx :200-216): its projection — cause, recurrence, concurrency —
    // and its standing filter, the manual's Lens and Standing (§17.4). The arcs and chains are its material and stay in the pane.
    {name: 'relations', root: one('.relation-field-modes'), home: () => 'timeline:lens'},
    {name: 'standing', root: one('.relation-field-filters'), home: () => 'timeline:standing'},
    // The return from a journey crossing (app.ts crossingReturnNode, T11), drawn over the field while the crossing stands.
    {name: 'crossing', root: one('.crossing-return'), home: () => 'scene'},
    // The editors the frame summons over its field (lane BE), read only while they are open (a closed one is [hidden] or unmounted): the
    // scene bar's Acts panel (actPanel.ts #act-panel), the personal Nara instrument (naraInstrument.tsx #nara-instrument) and Find on
    // Canvas (canvasFindOverlay.tsx). In the 'devices' presentation each stands down over the field (workspace.css) and the shell draws
    // its controls on a device in its pool; its own handlers and state stay the frame's.
    {name: 'acts', root: one('#act-panel'), home: () => 'acts'},
    {name: 'nara-instrument', root: one('#nara-instrument'), home: () => 'nara:instrument'},
    {name: 'find', root: one('.canvas-find-overlay'), home: () => 'canvas:find'},
  ]
}

/** What stands in a region: its controls and its readings, never a part inside a control. A file input is pressed through the control
 * that opens it, never directly; an overflow toggle of the masthead's narrow widths is a layout of the chrome, not a control of the work;
 * the selected card's own close is the panel's, not the card's. */
const CONTROLS = 'button,select,input,textarea,[role="status"],output,.pending-switch,.research-save-glyph,.research-pager,.canvas-zoom-readout-host,.research-inspector-content>header>h3,#tool-hint'
const SKIPPED = 'input[type=file],input[type=hidden],.header-menu-toggle,.card-close'
/** Where the chrome stands, for the change watch; and the readouts that tick with the field, never read for it (the scene time, its
 * progress, the transport readouts). The scene time is the clock's, not the chrome's: the shell reads the scene from the state. */
const CHROME_ROOTS = '#act-panel,#nara-instrument,.canvas-find-overlay,.relation-field-modes,.relation-field-filters,#view-controls,#tool-hint,#present-return,#recording-badge,#app>.masthead,#instrument-tools-dock,nav.instrument,#research-inspector,.canvas-home,.canvas-zoom-controls,.research-minimap-toggle,.canvas-zoom-readout-host,#toolbelt-button,.journey-reading-home,.crossing-return'
const TICKING = '#record-time,#record-size,#global-time,.time-progress,[data-transport-readout],[data-scene-progress],.journey-path-clock,.journey-path-next'

/** Whether the frame draws it where it stands: in the document, under no hidden ancestor, and laid out — a control the frame's own rules
 * conceal (display: none for its cut or lens) is not offered; one the stand-down conceals (visibility only) still is. A region the frame
 * holds out of the document (the Studio's Canvas section while the Studio is closed) is read as the frame keeps it. */
function drawn(element: HTMLElement, root: Element): boolean {
  if (element.closest('[hidden]')) return false
  return !root.isConnected || element.getClientRects().length > 0
}

const short = (text: string) => text && text.length <= 18 ? text : undefined
/** The word each icon key of the chrome stands by on a device key, where its own name is a sentence (its full name stays its label and
 * its hover words): the frame's own names, shortened by the frame. */
const SHORT: Readonly<Record<string, string>> = {
  'a:tool-interact': 'Interact', 'a:tool-select': 'Select', 'a:tool-pin': 'Pin', 'a:tool-formation': 'Formation', 'a:tool-text': 'Text',
  'a:pointer-options': 'Pointer…', 'a:objects': 'Objects…', 'a:research-preview': 'Preview field', 'a:library': 'Library…', 'a:studio': 'Studio…',
  'a:blueprint': 'Blueprint…', 'a:modes': 'Compositions…', 'a:quick-guide': 'Guide', 'a:deep-home': 'Epii home', 'a:deep-verso': 'Verso…',
  'a:native-save': 'Save', 'a:undo': 'Undo', 'a:redo': 'Redo', 'a:capture-image': 'Still', 'a:record-video': 'Video', 'a:capture-options': 'Image suite…',
  'a:previous': '‹ Scene', 'a:next': 'Scene ›', 'a:toggle-play': 'Pause', 'a:play-journey': 'Saved scenes', 'a:open-timeline': 'Save scene…', 'a:present': 'Present',
  'a:toolbelt': 'Toolbelt…', 'a:exit-present': 'Leave present', 'a:stop-record': 'Stop', 'a:grid': 'Grid', 'a:guides': 'Guides',
  'l:Zoom out canvas': '−', 'l:Zoom in canvas': '+', 'l:Fit all cards': 'Fit all', 'l:Fit selected cards': 'Fit selection', 'l:Hide overview': 'Minimap',
  'l:Show overview': 'Minimap', 'l:Add sticky, shape or text': 'Object…', 'l:Link card': 'Link…', 'l:Export selection as PNG': 'PNG', 'l:Find on Canvas': 'Find…',
  'l:Present frames': 'Present', 'l:Frame selection': 'Frame', 'l:Distribute ↔': 'Distribute ↔', 'l:Distribute ↕': 'Distribute ↕', 'l:Stroke colour': 'Stroke',
  'l:Previous members': '‹ Members', 'l:Next members': 'Members ›', 'l:Refresh timeline': 'Refresh', 'l:Save timeline view': 'Save view',
  'l:Focus the timeline stage': 'Focus', 'l:Export Obsidian canvas': 'Export .canvas', 'l:Import Obsidian canvas': 'Import .canvas',
}
/** Words, cleaned of control characters and bounded, so no word of the chrome can refuse the frame's whole state at the boundary. */
const clip = (text: string, max: number = FRAME_CHROME_LIMITS.text) => {const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' '); return clean.length > max ? clean.slice(0, max - 1) + '…' : clean}
/** A value the control holds, carried exactly (a choice's value is pressed back as it is), only bounded. */
const bound = (value: string) => value.slice(0, FRAME_CHROME_LIMITS.text)

function kindOf(element: HTMLElement): FrameChromeKind {
  if (element instanceof HTMLSelectElement) return 'select'
  if (element instanceof HTMLTextAreaElement) return 'text'
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') return 'toggle'
    if (element.type === 'color') return 'color'
    if (element.type === 'number') return 'number'
    if (element.type === 'range') return 'range'
    return 'text'
  }
  if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'button') {
    return element.hasAttribute('aria-pressed') || element.hasAttribute('aria-selected') || element.hasAttribute('aria-expanded') ? 'toggle' : 'button'
  }
  return 'reading'
}

/** The control's key in its region: its action and value where the frame names them (data-action, data-lens), else its id, else its
 * words. Stable across the frame's redraws, so a press names the control the person saw. */
function keyOf(element: HTMLElement): string {
  const action = element.dataset.action
  if (action) return `a:${action}${element.dataset.lens ? `:${element.dataset.lens}` : element.dataset.value ? `:${element.dataset.value}` : ''}`
  if (element.id) return `#${element.id}`
  const label = words(element, 'aria-label') || shownWords(element) || words(element, 'title') || words(element, 'placeholder')
  return label ? `l:${label}` : `k:${element.tagName.toLowerCase()}`
}

interface Located {control: FrameChromeControl; element: HTMLElement}

/** Every control the chrome holds now, with the element that is it. */
function locate(regions: readonly ChromeRegion[], lens: string): Located[] {
  const found: Located[] = []
  const seen = new Set<string>()
  for (const region of regions) {
    const root = region.root()
    if (!root) continue
    const elements = root.matches(CONTROLS) ? [root as HTMLElement] : [...root.querySelectorAll<HTMLElement>(CONTROLS)]
    for (const element of elements) {
      if (element.matches(SKIPPED) || !drawn(element, root)) continue
      // A part inside a control is the control's own words, not a second control.
      if (element !== root && element.parentElement?.closest('button,select')) continue
      const home = region.home(element, lens)
      if (!home) continue
      const kind = kindOf(element)
      // Its name: what it says of itself (aria-label), else the words it shows, else its hover words — a tab that reads "Relations"
      // keeps that name while its title says why it is off.
      const label = clip(words(element, 'aria-label') || shownWords(element) || words(element, 'title') || words(element, 'placeholder') || keyOf(element))
      let id = clip(`${region.name}/${keyOf(element)}`, FRAME_CHROME_LIMITS.id - 4)
      for (let n = 2; seen.has(id); n++) id = `${id.replace(/~\d+$/, '')}~${n}`
      seen.add(id)
      const control: FrameChromeControl = {id, home, kind, label}
      const title = words(element, 'title')
      if (title && title !== label) control.title = clip(title)
      const visible = shownWords(element)
      const word = SHORT[keyOf(element)] ?? (kind !== 'reading' && visible && visible !== label ? short(visible) : undefined)
      if (word) control.short = clip(word)
      if (kind === 'reading') control.value = clip(element.matches('.research-save-glyph') ? words(element, 'aria-label') : visible)
      if ((element as HTMLButtonElement).disabled) control.disabled = true
      if (kind === 'toggle') {
        const aria = element.getAttribute('aria-pressed') ?? element.getAttribute('aria-selected') ?? element.getAttribute('aria-expanded')
        control.pressed = element instanceof HTMLInputElement ? element.checked : aria === 'true'
      }
      if (element instanceof HTMLSelectElement) {
        control.value = bound(element.value)
        control.options = [...element.options].slice(0, FRAME_CHROME_LIMITS.options).map((option): FrameChromeOption => {
          const group = option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : ''
          return {value: bound(option.value), label: clip(textOf(option) || option.value), ...(group ? {group: clip(group)} : {})}
        })
      }
      if ((element instanceof HTMLInputElement && kind !== 'toggle') || element instanceof HTMLTextAreaElement) {
        control.value = bound(element.value)
        if (element instanceof HTMLInputElement) for (const key of ['min', 'max', 'step'] as const) {const number = Number(element[key]); if (element[key] !== '' && Number.isFinite(number)) control[key] = number}
      }
      found.push({control, element})
      if (found.length >= FRAME_CHROME_LIMITS.controls) return found
    }
  }
  return found
}

/** A value set the way the person's typing sets it, so the frame's own listeners (React's and the delegated ones) take it. */
function setNative(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', {bubbles: true}))
  element.dispatchEvent(new Event('change', {bubbles: true}))
}

export interface PresentedChrome {
  presentation(): FramePresentation
  /** The shell's declaration: stands the chrome down in 'devices', restores it in 'frame'. */
  setPresentation(next: FramePresentation): void
  /** The chrome as it stands, for the frame's state announcement. */
  reading(): FrameChromeReading
  /** Press one control by the id the reading gives it: the frame's own control, pressed. Refused by name when the reading holds no such
   * control, when the frame draws it off, or when a choice names an option the frame does not offer. */
  press(id: string, value?: string): void
  /** Hand an editor to the shell (lane BE): in the 'devices' presentation the frame does not open it over its field; the reading counts the
   * summon and the shell opens the editor in its own device home. Refused (false) in the 'frame' presentation, where the frame opens it. */
  summon(kind: FrameSummon): boolean
  dispose(): void
}

/** Install the door. `lens` is the instrument the research regions draw for; `changed` asks the frame to announce its state again when
 * the chrome changes under the shell's eyes (a tool pressed in the frame, a card selected, a menu opened). */
export function installPresentedChrome({lens, changed, regions = () => frameChromeRegions()}: {lens: () => string; changed: () => void; regions?: () => ChromeRegion[]}): PresentedChrome {
  let presentation: FramePresentation = 'frame'
  let queued = 0, last = ''
  const summons: Partial<Record<FrameSummon, number>> = {}
  const read = (): Located[] => locate(regions(), lens())
  const reading = (): FrameChromeReading => ({lens: lens(), controls: read().map(item => item.control), ...(Object.keys(summons).length ? {summons: {...summons}} : {})})
  // The chrome changes by the frame's own hand (React redraws, delegated toggles, a card selected, a menu opened): a change inside a
  // chrome region is read again a moment later, and announced only when the reading differs from the last one announced. The field,
  // the canvas's cards and the ticking time readouts are never read for it.
  const check = () => {queued = 0; const next = JSON.stringify(reading()); if (next !== last) {last = next; changed()}}
  const soon = () => {if (!queued) queued = window.setTimeout(check, 80)}
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement
      if (target?.closest(CHROME_ROOTS) && !target.closest(TICKING)) {soon(); return}
    }
  })
  observer.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true,
    attributeFilter: ['aria-pressed', 'aria-selected', 'aria-expanded', 'aria-label', 'disabled', 'hidden', 'title', 'class', 'data-save-state']})
  const apply = () => {document.body.classList.toggle('oi-chrome-devices', presentation === 'devices')}
  return {
    presentation: () => presentation,
    setPresentation(next) {if (next === presentation) return; presentation = next; apply(); soon()},
    reading() {const value = reading(); last = JSON.stringify(value); return value},
    press(id, value) {
      const found = read().find(item => item.control.id === id)
      if (!found) throw new Error('This control is no longer drawn by the application; read its chrome again.')
      const {control, element} = found
      if (control.disabled) throw new Error(control.title ? `${control.label} is off: ${control.title}` : `${control.label} is off here.`)
      if (control.kind === 'reading') throw new Error(`${control.label} is a reading, not a control.`)
      if (element instanceof HTMLSelectElement) {
        if (value === undefined || ![...element.options].some(option => option.value === value)) throw new Error(`${control.label} offers no such choice.`)
        setNative(element, value)
      } else if ((element instanceof HTMLInputElement && element.type !== 'checkbox' && element.type !== 'radio') || element instanceof HTMLTextAreaElement) {
        if (value === undefined) throw new Error(`${control.label} needs a value.`)
        setNative(element, value)
        // A value the frame commits on leaving the field (its width, height and titles) is committed as the person's leaving commits it.
        element.dispatchEvent(new FocusEvent('focusout', {bubbles: true}))
        element.dispatchEvent(new FocusEvent('blur'))
      } else {
        if (value !== undefined) throw new Error(`${control.label} takes no value.`)
        element.click()
      }
      soon()
    },
    summon(kind) {
      if (presentation !== 'devices') return false
      summons[kind] = (summons[kind] ?? 0) + 1
      // Announced at once: the person's press is waiting for its answer.
      check()
      return true
    },
    dispose() {observer.disconnect(); window.clearTimeout(queued)},
  }
}
