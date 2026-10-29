// A plate's place on its chain (manual §16.5 Device view: "add, move and remove devices"; §16.10 "Rows that you order carry a grip beside
// ▲ ▼ … ⌥↑ ⌥↓ still move the row one place"): every chain renderer stands each plate in a slot that asks the chain's one law
// (inhabitants/sdk/chains.ts). The slot carries a grip — drag it onto another plate, or press ⌥← / ⌥→ on the plate — and the move is the
// law's: where the order is the person's and its owner's operation stands, the new order goes to the chain's `onMove` (one write through
// that operation); where the manual fixes the order, or the operation does not stand, nothing moves and the Info line says why in the
// chain's own words or names the operation it waits for. The grip says the same before it is pressed. Nothing here keeps an order.
import {useRef, type DragEvent, type KeyboardEvent, type ReactNode} from 'react'
import {chainLaw, chainMove, slotStanding, type ChainKind, type ChainLaw} from '../../inhabitants/sdk/chains'
import {sayOnInfoLine} from './deviceHost'

const SLOT_MIME = 'application/x-oi-chain-slot'

/** A chain's device ids as its law names the slots (Central's `central:<face>` ids; a Factory slot is its own name). Pure. */
const SLOT_OF_ID: Readonly<Record<ChainKind, Readonly<Record<string, string>>>> = {
  'central-world': {'central:packet': 'packet', 'central:agent': 'agent', 'central:scope': 'scope', 'central:docs': 'docs'},
  'central-main': {'central:day-die': 'day', 'central:main:approvals': 'approvals'},
  'factory-session': {}, 'factory-main': {}, workcell: {}, 'expressions-studio': {}, 'techne-reading': {}, 'live-part': {},
}

/** The law's name for a device that stands on a chain. Pure. */
export function chainSlotOf(chain: ChainKind, id: string): string {
  return SLOT_OF_ID[chain][id] ?? id
}

/** One plate's slot on its chain. `order` is the chain's order as its owner reads it (the law's slot names); `onMove` writes a new
 * order through the law's operation, where the chain's renderer holds one. */
export function ChainSlot({law, slot, order, title, onMove, className, children, ...data}: {readonly law: ChainLaw; readonly slot: string;
  readonly order: readonly string[]; readonly title: string; readonly onMove?: (order: readonly string[]) => Promise<void> | void
  readonly className?: string; readonly children: ReactNode} & Readonly<Record<`data-${string}`, string | undefined>>) {
  const box = useRef<HTMLDivElement>(null)
  const standing = slotStanding(law, slot)
  const words = standing.moves ? `Drag it along the chain, or press ⌥← ⌥→: ${law.means}` : standing.why
  const move = (by: -1 | 1) => {
    const result = chainMove(law, order, slot, by)
    if ('refused' in result) { sayOnInfoLine(box.current, `Move ${title}`, result.refused); box.current?.setAttribute('data-chain-refused', result.refused); return }
    if (!onMove) { sayOnInfoLine(box.current, `Move ${title}`, `No owner is handed this chain's order here (${result.op.name}).`); return }
    box.current?.removeAttribute('data-chain-refused')
    void Promise.resolve(onMove(result.order)).catch(cause => sayOnInfoLine(box.current, `Move ${title}`, cause instanceof Error ? cause.message : String(cause)))
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!event.altKey || event.metaKey || event.ctrlKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  }
  // A drop of another plate's grip here: it moves one place at a time toward this slot, each step the law's.
  const onDrop = (event: DragEvent<HTMLElement>) => {
    const from = event.dataTransfer.getData(SLOT_MIME)
    if (!from || from === slot) return
    event.preventDefault()
    const [chain, id] = from.split('\n')
    if (chain !== law.chain || !id) return
    const result = chainMove(law, order, id, order.indexOf(slot) < order.indexOf(id) ? -1 : 1)
    if ('refused' in result) { sayOnInfoLine(box.current, `Move ${id}`, result.refused); box.current?.setAttribute('data-chain-refused', result.refused); return }
    if (onMove) void Promise.resolve(onMove(result.order)).catch(cause => sayOnInfoLine(box.current, `Move ${id}`, cause instanceof Error ? cause.message : String(cause)))
  }
  return <div ref={box} className={['chain-slot', className].filter(Boolean).join(' ')} data-chain={law.chain} data-chain-slot={slot}
    data-chain-moves={standing.moves ? 'true' : undefined} onKeyDown={onKeyDown} {...data}
    onDragOver={event => { if (event.dataTransfer.types.includes(SLOT_MIME)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }} onDrop={onDrop}>
    <span className="chain-grip agent-chain-grip" role="button" tabIndex={0} draggable aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
      aria-label={`Move ${title}: ${words}`} data-i={`Move ${title}|${words}`}
      onKeyDown={onKeyDown} onClick={event => event.stopPropagation()}
      onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(SLOT_MIME, `${law.chain}\n${slot}`); event.dataTransfer.setData('text/plain', title) }}>
      <span aria-hidden="true">⋮⋮</span>
    </span>
    {children}
  </div>
}

/** The law a renderer asks for a chain it draws. */
export {chainLaw}
