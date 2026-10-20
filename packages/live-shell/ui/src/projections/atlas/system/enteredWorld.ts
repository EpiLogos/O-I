// The world you are on (T-PROCEDURAL-BODY §6 item 4; manual §17.2 "Your system": "Enter the place and you are on that world"). The view's own
// choice, as the body choice is (body/worldBody.ts chooseBody) and no owner's state: which of today's worlds the World shows as the body
// "another world". Entering one chooses that Body, which is read-only (worldBody.ts READ_ONLY: another world's body is its owner's), and
// the body drawer draws that world's body with its look (system/bodyDraw.ts). Nothing is written.
import {chooseBody} from '../body/worldBody'
import {systemBodies} from './systemStore'

let entered: string | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of [...listeners]) listener() }

/** The orbit-body key (systemModel.ts worldKey) of the world entered, or null while none is. */
export const enteredWorld = (): string | null => entered

export function subscribeEnteredWorld(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Enter a world of today's set: the refusal in words when it is not in the set or its body is not read, and null once entered. A refused
 * entry changes nothing. */
export function enterWorld(key: string): string | null {
  const body = systemBodies().find(entry => entry.key === key && !entry.yours)
  if (!body) return `${key} is not in today’s set, so there is no world to enter.`
  if (body.state === 'reading' || body.state === 'refused' || !body.record) return `${body.world.name}’s body is not read, so it cannot be entered: ${body.standing}.`
  entered = key
  chooseBody('other')
  notify()
  return null
}

/** Leave the world entered: back on your own. */
export function leaveWorld(): void {
  entered = null
  chooseBody('own')
  notify()
}
