// The world you are on (T-PROCEDURAL-BODY §6 item 4; manual §17.2 "Your system": "Enter the place and you are on that world"). The view's own
// choice, as the body choice is (body/worldBody.ts chooseBody) and no owner's state: which world the World shows as the body "another
// world", one of today's set entered or another person's visited in the field (O-I #858 SF11). Entering or visiting one chooses that
// Body, which is read-only (worldBody.ts READ_ONLY: another world's body is its owner's), and the body drawer draws it (system/bodyDraw.ts):
// an entered world with its look, a visited one with none, as the field gives none. Nothing is written, and nothing of a visited world is
// kept here: its body is read from the held field each time (fieldModel.ts visitedBody, handed in by the World's devices so that reading
// loads with them and never with the first frame), so it goes when the field stops showing it.
import type {BodyLook, WorldBodyRecord} from '../src/globe/body'
import {chooseBody} from '../body/worldBody'
import {systemBodies} from './systemStore'

let entered: string | null = null
/** How a visited world's body is read, each time it is drawn: from the field as it shows the world now, or why it cannot be. */
export type VisitRead = (ref: string) => {readonly name: string; readonly record: WorldBodyRecord} | {readonly refusal: string}
let visited: {readonly ref: string; readonly read: VisitRead} | null = null
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
  visited = null
  chooseBody('other')
  notify()
  return null
}

/** The ref of another person's world visited in the field, or null while none is. */
export const visitedWorld = (): string | null => visited?.ref ?? null

/** Visit another person's world in the field (SF11), its body read by `read`: the refusal in words when it cannot be visited or its body
 * cannot be drawn here (fieldModel.ts visitedBody), and null once visited. A refused visit changes nothing. */
export function visitWorld(ref: string, read: VisitRead): string | null {
  const body = read(ref)
  if ('refusal' in body) return body.refusal
  entered = null
  visited = {ref, read}
  chooseBody('other')
  notify()
  return null
}

/** The body the World shows as another world: the world entered, with its look, or the world visited as the field shows it now, with
 * none; null while neither is drawn (none chosen, or it is no longer in the set or the field, or its body does not read). */
export function otherBody(): {readonly ref: string; readonly name: string; readonly record: WorldBodyRecord; readonly look?: BodyLook; readonly visit: boolean} | null {
  if (visited) {
    const body = visited.read(visited.ref)
    return 'refusal' in body ? null : {ref: visited.ref, name: body.name, record: body.record, visit: true}
  }
  const body = entered ? systemBodies().find(entry => entry.key === entered) : undefined
  return body?.record ? {ref: body.key, name: body.world.name, record: body.record, look: body.look, visit: false} : null
}

/** Leave the world entered or visited: back on your own. */
export function leaveWorld(): void {
  entered = null
  visited = null
  chooseBody('own')
  notify()
}
