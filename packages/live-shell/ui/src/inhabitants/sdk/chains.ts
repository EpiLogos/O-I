// The order of every chain, declared once (manual §16.1 "Material runs one way, from the instrument through the effects, left to right";
// §16.2 "Chains on tracks"; §16.5 Device view: "add, move and remove devices"; §16.10 Rows: "Where the order is yours, the chosen row
// carries a grip and ▲ ▼"). Live is the model (Ableton Live 12.0.25, devices/racks-session-model.md §1.1: a track's `Devices` list is an
// ordered list the person rearranges by dragging; the instrument heads a MIDI track's chain): where the order is the person's, a move is
// one write through the chain owner's own operation; where the manual fixes the order, the order is the chain's meaning and a move is
// refused in those words; where the order is the person's but no owner operation writes it, the move is refused naming the operation it
// waits for. Each chain renderer asks this table (central/devices/CentralDevices.tsx, agent/devices/FactoryDeviceChain.tsx through
// frame/devices/ChainOrder.tsx; Live's chain keeps its own grips, live/noteDevices/NoteDeviceChain.tsx and live/designBindings/
// TorusEffectsOnChain.tsx, which write through the owners named here). Pure; nothing here imports.

/** The chains of the five modes and the workcell (§16.2). */
export type ChainKind = 'central-world' | 'central-main' | 'factory-session' | 'factory-main' | 'workcell' | 'expressions-studio' | 'techne-reading' | 'live-part'

/** The owner operation that writes a chain's new order, and whether it stands. */
export interface ChainOrderOp {
  readonly name: string
  readonly owner: string
  readonly stands: boolean
}

export interface ChainLaw {
  readonly chain: ChainKind
  readonly title: string
  readonly manual: string
  /** The slots, left to right, as the chain's renderer names them. A slot named with a trailing `*` is a group the person fills (Live's
   * note devices, its effects): any number of devices of that kind stand there. */
  readonly slots: readonly string[]
  /** The slots whose place is the chain's meaning: they never move, and nothing moves past them. */
  readonly fixed: readonly string[]
  /** What the order means, in the manual's words. */
  readonly means: string
  /** The operation that writes a new order of the movable slots; absent where the whole order is fixed. */
  readonly op?: ChainOrderOp
}

const AGENT_CHAIN_ORDER = (owner: string): ChainOrderOp => ({name: 'agent-chain order', owner, stands: false})

/** Every chain's law (§16.2's table, and each chain's own entry). */
export const CHAIN_LAWS: Readonly<Record<ChainKind, ChainLaw>> = {
  'central-world': {
    chain: 'central-world', title: 'A world\'s chain', manual: '§16.2, §18.3, §19.4, §19.12, §18.5',
    slots: ['packet', 'agent', 'scope', 'docs'], fixed: ['packet', 'agent'],
    means: 'The packet gathers what the agent reads, the agent of the world answers after it, then Scope limits what it may touch and Docs keeps the world\'s account.',
    op: AGENT_CHAIN_ORDER('Central'),
  },
  'central-main': {
    chain: 'central-main', title: 'Central\'s Main track', manual: '§16.2, §16.6',
    slots: ['day', 'approvals'], fixed: ['day', 'approvals'],
    means: 'The Main track\'s chain holds what works on the whole: the Day, then Approvals, where every proposal waits.',
  },
  'factory-session': {
    chain: 'factory-session', title: 'A session\'s chain', manual: '§16.2, §19.4, §19.7, §19.12, §19.15',
    slots: ['agentset', 'agent', 'skillset', 'world'], fixed: ['agentset', 'agent'],
    means: 'The Agent heads a session\'s chain (a group\'s Agentset rack before it); the skills rack and Scope work on what it does after it.',
    op: AGENT_CHAIN_ORDER('Software Factory'),
  },
  'factory-main': {
    chain: 'factory-main', title: 'Factory\'s Main track', manual: '§16.2, §19.1',
    slots: ['run-map', 'approvals', 'prompt-pads'], fixed: ['run-map', 'approvals', 'prompt-pads'],
    means: 'The Main track carries what serves every session: the Run map, Approvals and the prompt pads, in that order.',
  },
  workcell: {
    chain: 'workcell', title: 'A workcell\'s chain', manual: '§16.2, §19.23',
    slots: ['workcell', 'gateway', 'remote-carrier', 'git'], fixed: ['workcell', 'gateway', 'remote-carrier', 'git'],
    means: 'The chain\'s order is the road\'s: in through the gateway, onto the machine, into the seat, out through the landing.',
  },
  'expressions-studio': {
    chain: 'expressions-studio', title: 'An Expression\'s chain', manual: '§16.2, §20.3',
    slots: ['studio'], fixed: ['studio'],
    means: 'The Studio is the Expression\'s rack: the field, then its field devices in the four chains Material, Motion, Body and Nara. Your macros keep the order you give them (the Studio\'s ▲ ▼).',
  },
  'techne-reading': {
    chain: 'techne-reading', title: 'A reading\'s chain', manual: '§16.2, §17',
    slots: ['instrument', 'lens', 'effects*'], fixed: ['instrument', 'lens', 'effects*'],
    means: 'The instrument a reading plays through heads its chain; the Lens and the other effects only read it, so their order changes nothing.',
  },
  'live-part': {
    chain: 'live-part', title: 'A part\'s chain', manual: '§16.2, §21.3, §21.5',
    slots: ['notes*', 'torus', 'effects*'], fixed: ['torus'],
    means: 'The note devices work on the notes before they reach the torus; the effects shape its sound after it. The order of the chain is the order of the sound.',
    op: {name: 'live-instrument effect-chain', owner: 'Live', stands: true},
  },
}

/** The law of a chain. */
export const chainLaw = (chain: ChainKind): ChainLaw => CHAIN_LAWS[chain]

/** A slot's group in the law: its own name, or the `*` group it falls in (a Live effect is of `effects*`). */
const slotOf = (law: ChainLaw, id: string): string | undefined => (law.slots.includes(id) ? id : law.slots.find(slot => slot.endsWith('*') && id.startsWith(slot.slice(0, -1))))

/** What the hand may do with a slot: move it (through the law's operation), or nothing, with the reason in words. Pure. */
export function slotStanding(law: ChainLaw, id: string): {readonly moves: true} | {readonly moves: false; readonly why: string} {
  const slot = slotOf(law, id)
  if (!slot) return {moves: false, why: `${id} stands on no slot of ${law.title.toLocaleLowerCase()} (${law.manual}).`}
  if (law.fixed.includes(slot) || !law.op) return {moves: false, why: `${law.title} keeps its order: ${law.means} (${law.manual})`}
  if (!law.op.stands) return {moves: false, why: `${law.title}: ${law.means} No owner operation writes a new order of it yet — missing op: ${law.op.name} (${law.op.owner}).`}
  return {moves: true}
}

/** A move of one slot one place earlier (-1) or later (1) along a chain's order as its owner reads it: the new order to write through the
 * law's operation, or the refusal in words — a slot that keeps its place, a move past one, a move off the end, or an operation that does
 * not stand. Pure. */
export function chainMove(law: ChainLaw, order: readonly string[], id: string, by: -1 | 1): {readonly order: readonly string[]; readonly op: ChainOrderOp} | {readonly refused: string} {
  const from = order.indexOf(id), to = from + by
  if (from < 0) return {refused: `${id} is not on ${law.title.toLocaleLowerCase()}.`}
  const standing = slotStanding(law, id)
  if (!standing.moves) return {refused: standing.why}
  if (to < 0 || to >= order.length) return {refused: `${id} is already ${by < 0 ? 'first' : 'last'} where it can stand.`}
  const past = slotOf(law, order[to]!)
  if (past && law.fixed.includes(past)) return {refused: `${id} cannot move past ${order[to]}: ${law.means} (${law.manual})`}
  const next = [...order]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return {order: next, op: law.op!}
}
