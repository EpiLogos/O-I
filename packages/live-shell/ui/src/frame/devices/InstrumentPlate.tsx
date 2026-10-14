// An instrument as one plate with its controls grouped in columns (manual §10.4 "Whole — every setting, grouped"; the
// mockup's `instFrame()` at world-shell-mockup.html:1411 and its CSS .inst/.insth/.isecs/.isec at :352-359). The plate is the
// SDK's own (inhabitants/sdk/controls.tsx FacePlate: the power ring, the mark, the name, the owner, the head's marks); its body
// is a row of sections, each headed in small capitals, each holding what that group of the instrument does. The Expressions
// Studio and the open Technē instrument both stand this way. A section holds devices of the runtime (`SectionDevices`): one
// device at a time, chosen by its mark when the section holds several (Live's rack: "several chains side by side under one
// device, with a selector to choose between them", manual §10.4), each drawn by DeviceView at its compact size.
import {useState, type CSSProperties, type DragEvent, type ReactNode} from 'react'
import {FacePlate, type PlateMark, type PowerStanding} from '../../inhabitants/sdk/controls'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {FacePresentation} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import {DeviceView} from './DeviceView'
import {lightOf, type DeviceInstance} from './deviceRuntime'
import './instrumentPlate.css'

export interface PlateSection {
  readonly id: string
  /** The group's name, as the head of its column (the mockup's `.isec h5`). */
  readonly title: string
  /** What stands at the right of the heading (the mockup's `h5 span`: a provenance, a count, a scale). */
  readonly note?: ReactNode
  /** The column's own width where the mockup gives one; absent, the column takes what it holds. */
  readonly width?: number
  readonly children: ReactNode
}

export interface InstrumentPlateProps {
  readonly presentation: FacePresentation
  /** The instrument's light: a reading, dark while unknown. */
  readonly power?: PowerStanding
  readonly onPower?: () => void
  /** The marks on the plate's head (settings, open full, read again …), each with its label. */
  readonly actions?: readonly {readonly icon: PlateMark; readonly label: string; readonly onPress?: () => void}[]
  readonly sections: readonly PlateSection[]
  /** The plate's body scroller class, for hosts that restore a scroll position (the Expressions detail's Return). */
  readonly bodyClassName?: string
  /** A drop onto the plate (a device dragged from the browser), handled by the host's own owner path. */
  readonly onDragOver?: (event: DragEvent<HTMLElement>) => void
  readonly onDrop?: (event: DragEvent<HTMLElement>) => void
  readonly onDragLeave?: (event: DragEvent<HTMLElement>) => void
  readonly dataAttributes?: Readonly<Record<`data-${string}`, string | undefined>>
  /** What stands under the sections (a refusal in the owner's words). */
  readonly footer?: ReactNode
}

export function InstrumentPlate({presentation, power = 'unknown', onPower, actions, sections, bodyClassName, onDragOver, onDrop, onDragLeave, dataAttributes, footer}: InstrumentPlateProps) {
  return <div className="inst-plate" {...dataAttributes} onDragOver={onDragOver} onDrop={onDrop} onDragLeave={onDragLeave}>
    <FacePlate presentation={presentation} power={power} onPower={onPower} actions={actions}>
      <div className={`inst-sections${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {sections.map(section => <section key={section.id} className="inst-section" data-section={section.id} aria-label={section.title}
          style={section.width ? {'--section-w': `${section.width}px`} as CSSProperties : undefined}>
          <h5 className="inst-section-head"><span>{section.title}</span>{section.note !== undefined && <span className="inst-section-note">{section.note}</span>}</h5>
          <div className="inst-section-body">{section.children}</div>
        </section>)}
      </div>
      {footer}
    </FacePlate>
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

/** A group whose owner discloses nothing here says so in one line. */
export function SectionNote({children}: {children: ReactNode}) {
  return <p className="inst-section-line">{children}</p>
}
