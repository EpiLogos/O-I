/// <reference types="vite/client" />
// The designed devices. The six reference devices load with the gallery: one instrument of Central, one of Live, a field
// effect of Expressions, the Skillset rack and its member device, and an effect of the Factory chain — the pattern every
// device's UI follows (ProjectCentral/docs/1-vision/dlw/DLW.md §16.15). Every other device is its own module, `<family>__<face>.tsx`, exporting
// `design`, loaded only when the gallery asks for it, so one device that does not build never stops another from drawing.
import type {DesignedDevice} from './design'
import {deviceStates} from '../../sdk/views'
import './panels.css'
import {day} from './day'
import {memberDevice} from './member'
import {physics} from './physics'
import {scope} from './scope'
import {skills} from './skills'
import {torus} from './torus'

/** A design with its states from the kit (sdk/views.ts DEVICE_STATES, the one declaration the manifests derive from as well): every design
 * the registry hands out, the reference devices and each module alike, carries the views its device has (manual §16.3). */
const stated = (design: DesignedDevice): DesignedDevice => ({...design, views: deviceStates(design.id) ?? design.views})

export const DESIGNED: Readonly<Record<string, DesignedDevice>> = Object.fromEntries([day, torus, physics, skills, memberDevice, scope].map(d => [d.id, stated(d)]))

const MODULES = import.meta.glob<{design: DesignedDevice}>('./*__*.tsx')
const file = (id: string) => `./${id.replace(':', '__')}.tsx`

/** The designed devices that live in their own modules, by id. */
export const DESIGNED_IDS: readonly string[] = Object.keys(MODULES).map(path => path.slice(2, -4).replace('__', ':'))

/** A device's design: a reference device at once, any other from its own module. */
export async function loadDesign(id: string): Promise<DesignedDevice | undefined> {
  if (DESIGNED[id]) return DESIGNED[id]
  const load = MODULES[file(id)]
  return load ? stated((await load()).design) : undefined
}
export type {DesignedDevice} from './design'
