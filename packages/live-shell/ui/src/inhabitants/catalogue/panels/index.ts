// The reference devices: one instrument of Central, one of Live, a field effect of Expressions, a rack and an effect of the
// Factory chain — the pattern every device's UI follows (docs/dlw/DEVICE-UI.md §8).
import type {DesignedDevice} from './design'
import {day} from './day'
import {memberDevice} from './member'
import {physics} from './physics'
import {scope} from './scope'
import {skills} from './skills'
import {torus} from './torus'

export const DESIGNED: Readonly<Record<string, DesignedDevice>> = Object.fromEntries([day, torus, physics, skills, memberDevice, scope].map(d => [d.id, d]))
export type {DesignedDevice} from './design'
