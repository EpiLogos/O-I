// A set-valued row, drawn as the runtime's controls can draw it. Some declared rows take a whole set on their one write path
// ("write the full set you want on": the atlas's kinds and relations, the knowledge graph's subject kinds and relation types).
// The runtime's controls are single-valued, so a set is drawn as one switch per member; a change to any switch writes the
// whole set through the row's own write path. Pure: no React, no store.
import type {SdkParamRow} from '../../sdk/define'

export interface SetMember {
  readonly id: string
  readonly label: string
}

const SEPARATOR = ':'

/** The key of one member's switch: `<row>:<member>`. A declared row key never carries the separator. */
export const memberKey = (rowKey: string, member: string): string => `${rowKey}${SEPARATOR}${member}`

/** The row and member a switch key names, or null for a key that is no member's. */
export function memberOf(key: string): {readonly row: string; readonly member: string} | null {
  const at = key.indexOf(SEPARATOR)
  return at <= 0 ? null : {row: key.slice(0, at), member: key.slice(at + 1)}
}

/** One boolean row per member of a declared set row. The switches keep the declared row's family, device instance and write path
 * (or the lack of one); the group is the declared row's. */
export function memberRows(declared: SdkParamRow, members: readonly SetMember[], group: string): SdkParamRow[] {
  return members.map(member => ({
    family: declared.family, deviceInstance: declared.deviceInstance, key: memberKey(declared.key, member.id), type: 'boolean', title: member.label, group,
    ...(declared.writePath ? {writePath: declared.writePath} : {}),
    ...(declared.disclosure ? {disclosure: declared.disclosure} : {}),
  }))
}

/** The set that results when switches are changed: the members that stand, in the declared order, with each change applied. */
export function changedSet(order: readonly string[], standing: readonly string[], changes: readonly {readonly member: string; readonly on: boolean}[]): string[] {
  const on = new Set(standing)
  for (const change of changes) {
    if (change.on) on.add(change.member); else on.delete(change.member)
  }
  const known = order.filter(member => on.has(member))
  const unknown = [...on].filter(member => !order.includes(member))
  return [...known, ...unknown]
}
