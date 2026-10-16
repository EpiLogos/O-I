/// <reference types="vite/client" />
// The designed devices. The six reference devices load with the gallery: one instrument of Central, one of Live, a field
// effect of Expressions, the Skillset rack and its member device, and an effect of the Factory chain — the pattern every
// device's UI follows (docs/dlw/DLW.md §16.14). Every other device is its own module, `<family>__<face>.tsx`, exporting
// `design`, loaded only when the gallery asks for it, so one device that does not build never stops another from drawing.
import type {DesignedDevice} from './design'
import './panels.css'
import {day} from './day'
import {memberDevice} from './member'
import {physics} from './physics'
import {scope} from './scope'
import {skills} from './skills'
import {torus} from './torus'

export const DESIGNED: Readonly<Record<string, DesignedDevice>> = Object.fromEntries([day, torus, physics, skills, memberDevice, scope].map(d => [d.id, d]))

const MODULES = import.meta.glob<{design: DesignedDevice}>('./*__*.tsx')
const file = (id: string) => `./${id.replace(':', '__')}.tsx`

/** The designed devices that live in their own modules, by id. */
export const DESIGNED_IDS: readonly string[] = Object.keys(MODULES).map(path => path.slice(2, -4).replace('__', ':'))

/** A device's design: a reference device at once, any other from its own module. */
export async function loadDesign(id: string): Promise<DesignedDevice | undefined> {
  if (DESIGNED[id]) return DESIGNED[id]
  const load = MODULES[file(id)]
  return load ? (await load()).design : undefined
}
export type {DesignedDevice} from './design'
