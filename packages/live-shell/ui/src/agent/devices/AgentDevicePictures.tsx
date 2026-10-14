// The pictures of the Factory chain's devices — each device's own live picture, drawn at the size it is shown (compact on the
// chain, whole in the pool, full in a pane). Ported from the chain cards' bodies (agent/NativeAgentDeviceRack.tsx: gateway
// :229-238, agent :255-263, skillset :298-304, world :315-323), the pool's Details (agent/AgentDevicePool.tsx:176-183), and the
// specimen's skillset rack (icon-cut.html:1754-1765: a mark per skill and an admit lamp). The owner's readings are the only data:
// a lamp is lit where the roster admits the skill, the git branch dot where the repository names a branch, the hollow dot where
// it counts uncommitted files; nothing is drawn as reading that was not read.
import {useEffect, useRef, useState, type MouseEvent, type ReactNode} from 'react'
import type {DeviceSize} from '../../frame/devices/deviceRuntime'
import {agentDataI} from '../agentFidelity'
import {SkillMark} from '../agentIcons'
import {maskStatic} from '../maskFace'
import {RefusalCard} from '../RefusalCard'
import {budgetLine, type AgentChainReading, type OwnerReading, type SkillChain} from './agentChainDevices'
import {selectSkillChain, useSelectedSkillChain} from './skillRackSelection'
import './factoryDevices.css'

/** What a picture needs beyond the reading: whether a session is attached and the two doors the old cards' pop-outs opened. */
export interface PictureContext {
  reading: AgentChainReading
  sessionRef: string | null
  /** The gateway card's pop-out: the Frames dock tile (NativeAgentDeviceRack.tsx:227). */
  onFrames: () => void
  /** The agent card's pop-out: the session's thread in the main space (NativeAgentDeviceRack.tsx:253). */
  onThread: () => void
}

const PICTURE_DATA_I = {
  gateway: agentDataI('Gateway · hermes', 'Where the session runs: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'),
  thread: agentDataI('Open thread', 'Open this session’s thread in the main space.'),
} as const

/** One card's honest reason in one styled line (NativeAgentDeviceRack.tsx:20-24). */
function InlineNote({reading, label}: {reading: OwnerReading; label: string}) {
  return reading.kind === 'refused'
    ? <p className="agent-refusal-inline"><b>Refused</b>{reading.line}</p>
    : <p className="agent-reading-inline"><b>{label}</b>{reading.line}</p>
}

/** An answered reading in the pool: one styled line with the receipt folded (AgentDevicePool.tsx:189-205). */
function ReadingLine({reading}: {reading: OwnerReading}) {
  return (
    <section className="agent-refusal answered fd-reading" role="note">
      <div className="agent-refusal-row"><b>{reading.title}</b><span className="line">{reading.line}</span></div>
      {reading.receipt != null && <details><summary>Receipt</summary><pre>{reading.receipt}</pre></details>}
    </section>
  )
}

/** The whole and full sizes show the reading with its receipt folded: a refusal as the named card, an answer as its line. */
function ReadingDetail({reading}: {reading: OwnerReading}) {
  return reading.kind === 'refused'
    ? <RefusalCard title={reading.title} line={reading.line} receipt={reading.receipt} />
    : <ReadingLine reading={reading} />
}

/** A button in a picture must not select the device it sits on. */
const alone = (act: () => void) => (event: MouseEvent) => { event.stopPropagation(); act() }

function GatewayPicture({ctx, size}: {ctx: PictureContext; size: DeviceSize}) {
  const {gateway} = ctx.reading
  return (
    <div className="fd-pic fd-pic--gateway" data-size={size} data-gateway={gateway.kind}>
      <div className="fd-pic__row">
        <button type="button" className="fd-pic__mark" data-i={PICTURE_DATA_I.gateway} title="Open the Frames dock tile" aria-label="Open the Frames dock tile" onClick={alone(ctx.onFrames)}>
          <svg className="fd-pic__svg" viewBox="0 0 96 88" aria-hidden>
            <rect x="6" y="34" width="24" height="20" rx="3" fill="none" stroke="var(--line-strong)" />
            <text x="18" y="47" textAnchor="middle" fontSize="8" fill="var(--text-dim)">shell</text>
            <line x1="30" y1="44" x2="66" y2="44" stroke="var(--line-strong)" strokeWidth="2" />
            <text x="81" y="47" textAnchor="middle" fontSize="8" fill="var(--text)">gw</text>
            <circle cx="48" cy="44" r="2.4" fill={gateway.kind === 'refused' ? 'var(--stall)' : 'var(--sel)'} />
            <text x="48" y="76" textAnchor="middle" fontSize="8" fill="var(--text-faint)" fontFamily="var(--mono)">frames tile ↗</text>
          </svg>
        </button>
        {size === 'compact' && <InlineNote reading={gateway} label="Read" />}
      </div>
      {size !== 'compact' && <>
        <ReadingDetail reading={gateway} />
        <details className="agent-fold">
          <summary>Details</summary>
          <div className="agent-kv"><span>Protocol</span><span>JSON-RPC / NDJSON</span></div>
          <div className="agent-kv"><span>Connect</span><span>attaches this session’s harness; detached sessions keep running and re-attach with session.resume</span></div>
          <div className="agent-kv"><span>Frames</span><span>the Frames dock tile is the frame monitor</span></div>
        </details>
      </>}
    </div>
  )
}

/** The face colours the mask is inked with, resolved from the shell's own tokens (the mask mixes hex colours, so it needs
 * the token's value, not its name); before the picture is in the frame it falls back to the tokens by name. */
function useFaceColours(ref: { current: HTMLElement | null }): {ink: string; ground: string} {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const style = getComputedStyle(element)
    const hex = (name: string, fallback: string) => {
      const value = style.getPropertyValue(name).trim()
      return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
    }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [ref])
  return colours
}

function AgentPicture({ctx, size}: {ctx: PictureContext; size: DeviceSize}) {
  const holder = useRef<HTMLDivElement | null>(null)
  const {ink, ground} = useFaceColours(holder)
  const px = size === 'compact' ? 52 : size === 'whole' ? 96 : 200
  const budget = budgetLine(ctx.reading.budget)
  return (
    <div className="fd-pic fd-pic--agent" data-size={size} data-attached={ctx.sessionRef != null} ref={holder}>
      <div className="fd-pic__row">
        <span className="fd-face" dangerouslySetInnerHTML={{__html: maskStatic('think', ink, ink, px, ground)}} />
        <div className="fd-pic__text">
          <span className="fd-pic__caption">{budget ? `${budget} turns` : 'turns not read'} · {ctx.sessionRef != null ? 'attached' : 'unselected'}</span>
          <button type="button" className="fd-pic__open" data-i={PICTURE_DATA_I.thread} disabled={ctx.sessionRef == null} title="Open this session’s thread" onClick={alone(ctx.onThread)}>thread ↗</button>
        </div>
      </div>
    </div>
  )
}

function ChainRow({chain, selected}: {chain: SkillChain; selected: boolean}) {
  return (
    <button type="button" role="option" aria-selected={selected} data-chain={chain.ref} data-admitted={chain.admitted}
      className={'agent-chainrow fd-chain' + (chain.admitted ? '' : ' offc') + (selected ? ' sel' : '')}
      title={chain.admitted ? `${chain.ref} — admitted` : `${chain.ref} — carried, not admitted`}
      onClick={alone(() => selectSkillChain(chain.ref))}>
      <SkillMark kind="skill" size={14} state={chain.admitted ? 'whole' : 'outline'} />
      <span className="fd-chain__name">{chain.ref}</span>
      <span className={'lt' + (chain.admitted ? '' : ' offc')} role="img" aria-label={chain.admitted ? 'admitted' : 'not admitted'} />
    </button>
  )
}

/** The skills rack's picture: the chains with their admit lamps and the selector (the specimen's rack, icon-cut.html:1754-1765). */
function SkillRackPicture({ctx, size}: {ctx: PictureContext; size: DeviceSize}) {
  const {chains, skillsNote, waitingOn} = ctx.reading
  const chosen = useSelectedSkillChain(chains)
  const detail = chains?.find(chain => chain.ref === chosen)
  return (
    <div className="fd-pic fd-pic--rack" data-size={size} data-chains={chains ? chains.length : 'reading'}>
      {chains?.length
        ? <div className="fd-rack" role="listbox" aria-label="Skill chains">{chains.map(chain => <ChainRow key={chain.ref} chain={chain} selected={chain.ref === chosen} />)}</div>
        : <p className="agent-disclosed fd-rack__empty">{skillsNote}</p>}
      {size !== 'compact' && <>
        {detail && <div className="fd-detail" data-chain-detail={detail.ref}>
          <div className="agent-kv"><span>Chain</span><span>{detail.ref}</span></div>
          <div className="agent-kv"><span>Light</span><span>{detail.admitted ? 'admitted' : 'carried, not admitted'}</span></div>
          <div className="agent-kv"><span>Carried by</span><span>{detail.carriedBy.length ? detail.carriedBy.join(', ') : 'no profile names itself'}</span></div>
        </div>}
        <details className="agent-fold">
          <summary>Details</summary>
          <div className="agent-kv"><span>Roster</span><span>{skillsNote ?? 'not read'}</span></div>
          {waitingOn.skillset && <div className="agent-kv"><span>Waiting on</span><span>{waitingOn.skillset}</span></div>}
        </details>
      </>}
    </div>
  )
}

function WorldPicture({size}: {ctx: PictureContext; size: DeviceSize}) {
  return (
    <div className="fd-pic fd-pic--world" data-size={size}>
      <div className="fd-pic__row">
        <svg className="fd-pic__svg" viewBox="0 0 84 84" aria-hidden>
          <circle cx="42" cy="42" r="34" fill="none" stroke="var(--line-strong)" strokeDasharray="2 3" />
          <circle cx="42" cy="42" r="23" fill="none" stroke="var(--text-faint)" />
          <circle cx="42" cy="42" r="12" fill="none" stroke="var(--text-dim)" />
          <path d="M42 20A22 22 0 1 1 22 56" fill="none" stroke="var(--fizz)" strokeWidth="4" strokeOpacity=".75" />
          <path d="M42 31A11 11 0 0 1 52 46" fill="none" stroke="var(--honey)" strokeWidth="4" />
        </svg>
        {size !== 'compact' && <span className="fd-legend"><b className="fd-legend--reads">teal</b> reads · <b className="fd-legend--writes">amber</b> writes</span>}
      </div>
    </div>
  )
}

function GitPicture({ctx, size}: {ctx: PictureContext; size: DeviceSize}) {
  const {git, gitRepo} = ctx.reading
  const dirty = (gitRepo.uncommitted ?? 0) > 0
  return (
    <div className="fd-pic fd-pic--git" data-size={size} data-git={git.kind}>
      <div className="fd-pic__row">
        <svg className="fd-pic__svg" viewBox="0 20 104 64" aria-hidden>
          <path d="M14 72H90" stroke="var(--text-faint)" fill="none" />
          <path d="M30 72q10-26 26-26h20" stroke="var(--text-faint)" fill="none" />
          <circle cx="30" cy="72" r="4" fill="var(--text-dim)" />
          {gitRepo.branch && <circle cx="76" cy="46" r="4" fill="var(--fizz)" />}
          {dirty && <circle className="fd-dirty" cx="90" cy="46" r="4" fill="none" stroke="var(--text)" />}
        </svg>
        <div className="fd-pic__text">
          <span className="fd-git__branch">{gitRepo.branch ?? 'branch not read'}</span>
          {size === 'compact' && <InlineNote reading={git} label="Seat" />}
        </div>
      </div>
      {size !== 'compact' && <ReadingDetail reading={git} />}
    </div>
  )
}

/** The slot's picture at the size it is shown. A slot with no picture of its own draws nothing here, and the device its rows. */
export function chainPicture(slot: string, ctx: PictureContext, size: DeviceSize): ReactNode {
  switch (slot) {
    case 'gateway': return <GatewayPicture ctx={ctx} size={size} />
    case 'agent': return <AgentPicture ctx={ctx} size={size} />
    case 'skillset': return <SkillRackPicture ctx={ctx} size={size} />
    case 'world': return <WorldPicture ctx={ctx} size={size} />
    case 'git': return <GitPicture ctx={ctx} size={size} />
    default: return null
  }
}
