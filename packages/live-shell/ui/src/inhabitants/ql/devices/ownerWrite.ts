// A device's write reaches its owner only through the owner's armed setter (inhabitants/sdk/shellSetters.ts), the same path an
// agent's write takes: the setter validates the value against the domain the row declares, drives the mounted atlas or the open
// graph through the face action the body calls, and answers with a receipt. A refusal comes back in the owner's words and is
// thrown, so the runtime keeps the person's value and discloses the refusal; nothing is clamped, held or dropped here.
import type {SdkParamRow} from '../../sdk/define'
import {shellSetter} from '../../sdk/shellSetters'
import {registerAtlasShellSetters, registerKnowledgeShellSetters} from '../../../agent/shellSetterBridge'
import {changedSet, memberOf} from './rowSets'

/** Arm the atlas's and the knowledge graph's setters. Idempotent (a registration replaces by path): the agent shell arms them when
 * its transport mounts, and a Technē device may be written before any agent shell has. */
export function armTechneSetters(): void {
  registerAtlasShellSetters()
  registerKnowledgeShellSetters()
}

/** Write one value through the owner's setter at `path`; resolves with the owner's acknowledgement line, throws its refusal. */
export async function writeThroughOwner(path: string, value: unknown): Promise<string> {
  armTechneSetters()
  const setter = shellSetter(path)
  if (!setter) throw Error(`${path} is armed but not wired in this shell`)
  const receipt = await setter(value)
  if (receipt.kind === 'refused') throw Error(receipt.reason)
  return receipt.note
}

/** The members of a set row as they stand now, and the order the row declares them in. */
export interface SetStanding {
  readonly order: readonly string[]
  readonly on: readonly string[]
}

export interface OwnerWrites {
  /** The device's rows as the family declares them: each change finds its write path here. */
  readonly declared: readonly SdkParamRow[]
  /** The standing of each set row, by declared key: a switch change writes the whole set. */
  readonly sets?: Readonly<Record<string, SetStanding>>
  /** A drawn choice, turned back into the value the owner takes: a stepper's label as the number it names, an owner's label as its id. */
  readonly decode?: (key: string, value: number | string | boolean) => unknown
  /** How a set is written, where the owner's encoding differs from the plain list of members that stand. */
  readonly encodeSet?: (rowKey: string, on: string[], order: readonly string[]) => unknown
}

/** Send a draft's changes to the owner: each plain change on its row's write path, and every changed set once, whole. */
export async function submitThroughOwner(writes: OwnerWrites, changes: readonly {readonly key: string; readonly value: number | string | boolean}[]): Promise<void> {
  const pathOf = (key: string): string => {
    const path = writes.declared.find(row => row.key === key)?.writePath
    if (!path) throw Error(`${key} has no owner write path`)
    return path
  }
  const sent: [string, unknown][] = []
  const edits = new Map<string, {member: string; on: boolean}[]>()
  for (const change of changes) {
    const member = memberOf(change.key)
    if (member) {
      if (!writes.sets?.[member.row]) throw Error(`${member.row} is not a set the owner takes`)
      edits.set(member.row, [...(edits.get(member.row) ?? []), {member: member.member, on: change.value === true}])
      continue
    }
    sent.push([pathOf(change.key), writes.decode ? writes.decode(change.key, change.value) : change.value])
  }
  for (const [rowKey, memberEdits] of edits) {
    const standing = writes.sets![rowKey]!
    const next = changedSet(standing.order, standing.on, memberEdits)
    sent.push([pathOf(rowKey), writes.encodeSet ? writes.encodeSet(rowKey, next, standing.order) : next])
  }
  for (const [path, value] of sent) await writeThroughOwner(path, value)
}
