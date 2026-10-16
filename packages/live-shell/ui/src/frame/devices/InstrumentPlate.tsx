// An instrument as one plate with its controls grouped in sections side by side (manual §10.4 "Whole — every setting, grouped"; the
// mockup's `instFrame()` at world-shell-mockup.html:1411 and its CSS .inst/.insth/.isecs/.isec at :352-359; the device UI standard,
// docs/dlw/DLW.md §16.9: "Sections are columns, ruled off from each other by a hairline and named in small capitals. The well is the
// only inset surface … Nothing scrolls, and no box sits inside a box"). Its head is the panel kit's (inhabitants/sdk/panel.tsx PanelHead,
// manual §16.9: the activator, ▾, the name, the held mark, the pages, ⤢), with the device's own acts after the pages (the Studio's Save,
// Undo, Redo) and the place's marks before ⤢; who owns the plate and where it stands is said on the status bar when you point at the head,
// never drawn as a sentence (§1 "A sentence never appears in a panel"). Its body is one row of sections at the widths their controls take,
// each headed in small capitals; a display section (§4.2 "The display stands in a section of its own, at the left") holds the well and
// never folds. A row too narrow for every section folds sections to their titles — the runtime's strip, pressed to open (manual §10.4 "A
// device can also fold down to its title") — never a scroller: the host's own fit when it gives one (the Studio's, the stage plates'), else
// the plate's, from the last section back. The controls are the device panel kit's (inhabitants/sdk/panel.tsx) and plateControls.tsx: a
// dial for a value you sweep, a radio for one of a few, rows for items.
//
// A section can still hold devices of the runtime (`SectionDevices`): one device at a time, chosen by its mark when the section holds
// several (Live's rack: "several chains side by side under one device, with a selector to choose between them", manual §10.4), each
// drawn by DeviceView at its compact size, its own frame stood down so it reads as the section's controls.
import {useState, type CSSProperties, type DragEvent, type ReactNode} from 'react'
import type {PlateMark, PowerStanding} from '../../inhabitants/sdk/controls'
import {Icon} from '../../inhabitants/sdk/Icon'
import {ChevronFold, PopOut} from '../../inhabitants/sdk/marks'
import {Lamp, PanelHead, type LightState, type Page} from '../../inhabitants/sdk/panel'
import type {FacePresentation} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import {DeviceView} from './DeviceView'
import {lightOf, type DeviceInstance} from './deviceRuntime'
import {usePlateFit, type PlateFit} from './plateFit'
import type {HeldDevice} from './plateControls'
import './plateControls.css'
import './instrumentPlate.css'

/** One control column of a section (manual §16.9 "Control column 56 wide"). */
export const PLATE_COLUMN = 56

export interface PlateSection {
  readonly id: string
  /** The group's name, as the head of its column (the mockup's `.isec h5`). A display section draws none. */
  readonly title: string
  /** What stands at the right of the heading (the mockup's `h5 span`: a provenance, a count, a scale, the marks of held devices). */
  readonly note?: ReactNode
  /** The column's own width where the mockup gives one; absent, the column takes what it holds. */
  readonly width?: number
  /** The section's controls stand in this many control columns (56 px each, manual §16.9): dials side by side, a radio, a list or
   * a field across them all. Absent, the controls stand one under the next. */
  readonly cols?: number
  readonly children: ReactNode
  /** The display's own section (manual §16.9 "The display stands in a section of its own, at the left"; §7): the well alone, with no
   * heading; it never folds for room. */
  readonly display?: boolean
  /** Folded to its title (manual §10.4 "A device can also fold down to its title. Click the title to open it again"; the
   * mockup's folded strip .ifold, :153): the column stands as the runtime's fold strip, its name read upward. Absent on every
   * section, the plate folds what does not fit by its own fit. */
  readonly folded?: boolean
  /** The fold's press: on the strip it opens the column, on an open column's title it folds it. */
  readonly onFold?: () => void
}

/** A mark on the plate's head: its icon, its words (the status bar's, and its title), its press. */
export interface PlateHeadMark {
  readonly icon: PlateMark
  readonly label: string
  readonly onPress?: () => void
}

export interface InstrumentPlateProps {
  readonly presentation: FacePresentation
  /** The instrument's light: a reading, hollow while unknown (manual §16.9 "A hollow ring: the owner has not said"). */
  readonly power?: PowerStanding
  readonly onPower?: () => void
  /** ▾ in the head: fold the instrument to its title (manual §16.3 "Press ▾ in the head to fold the device"). */
  readonly onFold?: () => void
  /** ⤢ at the head's right: open the instrument full in a pane, in the place's words. */
  readonly onFull?: () => void
  readonly fullLabel?: string
  /** Who else holds values on this instrument, in the stall colour (manual §16.9 "Held mark"). */
  readonly heldBy?: string
  /** Pages in the head (manual §16.9 "When a panel holds more than fits, it gets pages in its head"). */
  readonly pages?: readonly Page[]
  readonly page?: string
  readonly onPage?: (id: string) => void
  /** The device's own acts in its head, after the pages and before its marks (the mockup's Studio head: Save, Undo, Redo, :1432). */
  readonly head?: ReactNode
  /** The marks on the plate's head (settings, read again, copy the address …), each with its label, before ⤢. */
  readonly actions?: readonly PlateHeadMark[]
  readonly sections: readonly PlateSection[]
  /** The host's own fit (plateFit.ts usePlateFit), where the host decides what folds (its own order, sections that wait folded). Absent,
   * the plate fits itself: sections fold from the last back to the second while the row is too narrow; a press holds. */
  readonly fit?: PlateFit
  /** The plate's body class, for hosts that restore a position (the Expressions detail's Return). */
  readonly bodyClassName?: string
  /** A drop onto the plate (a device dragged from the browser), handled by the host's own owner path. */
  readonly onDragOver?: (event: DragEvent<HTMLElement>) => void
  readonly onDrop?: (event: DragEvent<HTMLElement>) => void
  readonly onDragLeave?: (event: DragEvent<HTMLElement>) => void
  readonly dataAttributes?: Readonly<Record<`data-${string}`, string | undefined>>
  /** What stands under the sections (a refusal in the owner's words). */
  readonly footer?: ReactNode
}

/** The owner's on/off as the kit's activator reads it. */
export const lightOfPower = (power: PowerStanding): LightState => (power === 'on' ? 'lit' : power === 'off' ? 'dark' : 'unknown')

function MarkView({mark}: {mark: PlateMark}) {
  return mark === 'fold' ? <ChevronFold size={10} /> : mark === 'full' ? <PopOut size={10} /> : <Icon name={mark} size={11} />
}

/** The place's marks on the head, drawn as the kit draws its own (▾, ⤢): each names what it does on the status bar. */
function HeadMarks({actions}: {actions: readonly PlateHeadMark[]}) {
  return <>{actions.map((action, index) => <button key={`${action.icon}:${index}`} type="button" className="dp-full" data-plate-mark={action.icon} title={action.label} aria-label={action.label}
    data-i={`${action.label.split(':')[0]}|${action.label}.`} disabled={!action.onPress} onClick={action.onPress}><MarkView mark={action.icon} /></button>)}</>
}

export function InstrumentPlate({presentation, power = 'unknown', onPower, onFold, onFull, fullLabel, heldBy, pages, page, onPage, head, actions, sections, fit, bodyClassName, onDragOver, onDrop, onDragLeave, dataAttributes, footer}: InstrumentPlateProps) {
  // The plate's own fit, standing down where the host fits it: the sections whose fold the host does not decide may fold, from the last.
  // The display's section never folds: the picture is what the device is read by (manual §16.9 "The picture comes first").
  const free = sections.filter(section => !section.display && section.folded === undefined && section.onFold === undefined).map(section => section.id)
  const foldable = fit ? [] : free.slice(sections[0]?.display ? 0 : 1)
  const own = usePlateFit(sections.map(section => section.id).join('|'), [...foldable].reverse(), !foldable.length)
  const fitted = fit ?? own
  const shown = sections.map(section => foldable.includes(section.id) ? {...section, folded: own.folded.has(section.id), onFold: () => own.press(section.id)} : section)
  return <div className="inst-plate" {...dataAttributes} data-studio-fit={dataAttributes?.['data-studio-fit'] ?? fitted.fitId}
    data-natural-width={fitted.natural ?? undefined} onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}>
    <section className="inst-face" aria-label={presentation.title}>
      <PanelHead title={presentation.title} light={lightOfPower(power)} onLight={onPower} onFold={onFold}
        mark={<Icon name={presentation.icon} size={11} className="inst-head-mark" />} heldBy={heldBy} pages={pages} page={page} onPage={onPage}
        acts={head} marks={actions?.length ? <HeadMarks actions={actions} /> : undefined} onFull={onFull} fullLabel={fullLabel} hint={presentation.owner} />
      <div className={`inst-sections${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {shown.map(section => section.display
          ? <section key={section.id} className="inst-section inst-section--display" data-section={section.id} aria-label={section.title}
              style={section.width ? {'--section-w': `${section.width}px`} as CSSProperties : undefined}>{section.children}</section>
          : section.folded
          // The runtime's fold strip (sdk.css .sdk-face__unfold), pressed to open.
          ? <section key={section.id} className="inst-section inst-section--folded" data-section={section.id} data-folded="true" aria-label={section.title}>
              <button type="button" className="sdk-face__unfold" aria-expanded={false} aria-label={`Open ${section.title}`} title={`${section.title} — open`}
                data-i={`${section.title}|Folded to its title. Click to open it.`} onClick={section.onFold}><span className="sdk-face__fold-title">{section.title}</span></button>
            </section>
          : <section key={section.id} className="inst-section" data-section={section.id} aria-label={section.title}
              style={section.width || section.cols ? {'--section-w': `${section.width ?? (section.cols! * PLATE_COLUMN + 12)}px`} as CSSProperties : undefined}>
              <h5 className="inst-section-head">{section.onFold
                ? <button type="button" className="inst-section-fold" aria-expanded={true} title="Fold to its title" aria-label={`Fold ${section.title} to its title`}
                    data-i={`${section.title}|Click the title to fold the section.`} onClick={section.onFold}>{section.title}</button>
                : <span>{section.title}</span>}{section.note !== undefined && <span className="inst-section-note">{section.note}</span>}</h5>
              <div className="inst-section-body" data-cols={section.cols} style={section.cols ? {'--cols': section.cols} as CSSProperties : undefined}>{section.children}</div>
            </section>)}
      </div>
      {footer}
    </section>
  </div>
}

/** One device of a section, with the picture it shows at its compact size and the marks its place gives it. */
export interface SectionDevice {
  readonly device: DeviceInstance
  /** The device's mark on the section's selector. */
  readonly mark: IconName
  readonly picture?: ReactNode
  /** The plate's marks: `detail` (show it whole in the pool) is the press on the plate; `pane` opens it full size. */
  readonly actions?: readonly {icon: 'detail' | 'pane' | 'back' | 'cmd' | 'plus'; label: string; onPress: () => void}[]
  /** The host's wrap for one of its controls (a modulation line under a moved value). */
  readonly wrapRow?: Parameters<typeof DeviceView>[0]['wrapRow']
  /** The plate's identity across readings: a new key stands it anew (a new Scene drops unsent drafts of the last). */
  readonly key?: string
}

/** The devices a section holds: the chosen one drawn by the runtime, the others behind their marks on the selector. The person's
 * choice holds while the section stands; with none, `initial` names the one shown first. */
export function SectionDevices({devices, initial, label}: {devices: readonly SectionDevice[]; initial?: string | null; label: string}) {
  const [picked, setPicked] = useState<string | null>(null)
  const shownId = devices.some(entry => entry.device.id === picked) ? picked : devices.some(entry => entry.device.id === initial) ? initial : devices[0]?.device.id
  const shown = devices.find(entry => entry.device.id === shownId)
  if (!shown) return null
  return <div className="inst-devices">
    {devices.length > 1 && <div className="inst-selector" role="tablist" aria-label={`${label}: the devices it holds`}>
      {devices.map(entry => {
        const light = lightOf(entry.device)
        return <button key={entry.device.id} type="button" role="tab" className="inst-selector-mark" aria-selected={entry.device.id === shown.device.id}
          aria-label={entry.device.face.title} title={`${entry.device.face.title}${light === 'unknown' ? '' : ` · ${light}`}`} data-device-light={light}
          onClick={() => setPicked(entry.device.id)}>
          <Icon name={entry.mark} size={12} />
        </button>
      })}
    </div>}
    <div className="inst-device" data-device-shown={shown.device.id}>
      <DeviceView key={shown.key ?? shown.device.id} device={shown.device} size="compact" picture={shown.picture} actions={shown.actions} wrapRow={shown.wrapRow} />
    </div>
  </div>
}

/** The devices a section holds as its marks (plateControls.tsx HeldMarks): the acts their boxed plates offered — every setting in the
 * pool, full size in a pane — kept, where the section's own controls are drawn from the same owner. */
export function heldMarksOf(entries: readonly SectionDevice[]): HeldDevice[] {
  const act = (entry: SectionDevice, icon: 'detail' | 'pane') => () => entry.actions?.find(action => action.icon === icon)?.onPress()
  return entries.map(entry => ({id: entry.device.id, title: entry.device.face.title, mark: entry.mark, light: lightOf(entry.device), onPool: act(entry, 'detail'), onPane: act(entry, 'pane')}))
}

/** A group whose owner discloses nothing here says so in one short line; its whole words are the status line's. With `word`, the line is
 * drawn as a light and that one word (manual §16.9 "A sentence never appears in a panel. What a control does is said in the status bar
 * when you point at it"): the sentence is only the status bar's. */
export function SectionNote({children, word, light = 'unknown'}: {children: ReactNode; word?: string; light?: LightState}) {
  const words = typeof children === 'string' ? children : undefined
  if (word) return <p className="inst-section-line inst-section-word" data-i={words ? `${word}|${words}` : undefined} aria-label={words ?? word}>
    <Lamp state={light} /><span>{word}</span></p>
  return <p className="inst-section-line" data-i={words ? `|${words}` : undefined}>{children}</p>
}
