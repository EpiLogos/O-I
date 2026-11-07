// Scope (manual §19.12): how far an agent may reach into your world, how its writes arrive, which of its acts wait for you, and what it
// may do to other agents. Live's nearest: Utility — a small effect of few controls whose meaning is plain at a glance. The rings are the
// picture: teal is what the agent may read, amber what it may write. Raising the reach asks you first: the new reach waits, dashed, until
// you confirm it. Three pages in the head of Whole: Reach, Asks and Grants.
// A read place's square is your include or exclude of it in the world (`r:<id>`: true included, false excluded; Central's world relations
// keep it, central.world-relations.save), as Context & world's toggles were before Scope carried them (lock §0.3.5); its standing says why
// a place takes no request. A place the owner reports no request for has no square.
// The Asks page (manual §19.12 Asks): which acts wait for you, and whom the agent asks. Tool calls (`toolCalls`: ask · session · always,
// the answer to the harness's request to use a tool), Before it lands (`gate`: diffs · approvals · both), Calls to other agents (`calls`:
// allow · pair · deny, AIKit's ingress decisions; the owner's word for Ask is pair), Escalate to (`escalate`, a person's id among `people`,
// JSON rows of {id, name}), Wait (`wait`, seconds, 15 min to 24 h) and On no answer (`noAnswer`: hold · deny). Approvals shows the wait
// and the answer and never sets them (§19.14).
// The Grants page (manual §19.12 Grants): the authority the agent holds to act on agency — to actualise an agency, configure it, determine
// another, or take its return back in (Actuation's MetagencyOperation). Each grant is Actuation's governing authority record
// (actuation.local-authority/v1: authority_source_ref, holder, issued_by, metagency_grant.operations, allowed_world_refs,
// issued_at_unix_seconds, expires_at_unix_seconds) with its revocation (AuthorityStore: revoked {at_unix_seconds, reason}). Keys: `grants`
// (JSON rows of {ref, holder, issuedBy, operations, worlds, issuedAt (s), expiresAt (s | null), revoked: {at, reason} | null}), `holder`
// (the agent the grants are for), `worlds` (the World refs a grant may name), `readAt` (s, when the grants were read). Settings for the
// next grant: `grant:<operation>` (on or off for each of the four), `grant:world`, `grant:expires` ('never' | '1h' | '1d' | '7d'),
// `revoke:reason`. Acts: `issue` (JSON {holder, operations, worlds, expiresIn}: `actuation authority issue`), `revoke` (the grant's ref:
// `actuation authority revoke <ref> --reason <text>`; held, as it cannot be undone).
import {useState} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type Option, type RowItem, unreadRows} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const RINGS = ['Object', 'Scene', 'Expression', 'Central']
const MODES = [{value: 'propose', label: 'Propose', does: 'A write arrives as a proposal that waits.'}, {value: 'draft', label: 'Draft', does: 'A write arrives in a draft that you review.'},
  {value: 'direct', label: 'Direct', does: 'A write goes into the thing itself, with a receipt.'}] as const

/** A place the agent may read or write, on its ring (0 object … 3 Central); the binding supplies both lists. */
interface Place {readonly id: string; readonly name: string; readonly ring: number; readonly receipts?: number}
const reads = (v: V) => json<Place[]>(v, 'reads', [])
const writes = (v: V) => json<Place[]>(v, 'writes', [])
const reach = (v: V) => numOf(v, 'reach')
const writeRing = (v: V) => {
  const r = reach(v), wanted = writes(v).filter(w => v[`w:${w.id}`] !== false).map(w => w.ring)
  return r === undefined || !wanted.length ? undefined : Math.min(r, Math.max(...wanted))
}
const readRows = (p: ViewProps): RowItem[] => reads(p.v).map(r => ({id: r.id, name: r.name, light: reach(p.v) === undefined ? 'unknown' : r.ring <= reach(p.v)! ? 'lit' : 'dark', tone: 'value',
  note: ['obj', 'scene', 'expr', 'world'][r.ring] ?? NONE, request: boolOf(p.v, `r:${r.id}`), why: st(p, `r:${r.id}`).disabled}))
/** Include or exclude a read place, where its owner takes the request. */
const askRead = (p: ViewProps) => (id: string, x: boolean) => { if (!st(p, `r:${id}`).disabled) p.set(`r:${id}`, x) }
const writeRows = (v: V): RowItem[] => writes(v).map(w => {
  const request = v[`w:${w.id}`] !== false, r = reach(v)
  return {id: w.id, name: w.name, request, light: r === undefined ? 'unknown' : request && w.ring <= r ? 'lit' : 'dark', tone: 'accent', note: w.receipts === undefined ? NONE : `${w.receipts}`,
    why: r !== undefined && request && w.ring > r ? 'Outside the reach.' : undefined}
})
/** Receipts, summed from the writes the binding reports; absent when it reports none. */
const receipts = (v: V) => (has(v, 'writes') && writes(v).some(w => w.receipts !== undefined) ? writes(v).reduce((n, w) => n + (w.receipts ?? 0), 0) : undefined)

/** The rings: the reach for reads tinted teal, the reach for writes tinted amber. The handle sets the reach. With no reading of
 * the reach, the rings stand bare and say so. */
function Rings({v, set, w, h, labels}: {v: V; set?: ViewProps['set']; w: number; h: number; labels: boolean}) {
  const cx = w / 2, cy = h / 2 + (labels ? 4 : 0), step = (Math.min(w, h) / 2 - 8) / 4, r = (i: number) => step * (i + 1)
  const now = reach(v), pending = v.reachPending === undefined ? null : Number(v.reachPending), at = pending ?? now ?? 0, wr = writeRing(v)
  const angle = -Math.PI / 4, hx = cx + r(at) * Math.cos(angle), hy = cy + r(at) * Math.sin(angle)
  return <g>
    {now !== undefined && <circle cx={cx} cy={cy} r={r(now)} fill="var(--fizz)" fillOpacity={.1} />}
    {wr !== undefined && <circle cx={cx} cy={cy} r={r(wr)} fill="var(--accent)" fillOpacity={.13} />}
    {RINGS.map((name, i) => <g key={name}>
      <circle cx={cx} cy={cy} r={r(i)} className="dp-faint" />
      {labels && <text x={cx} y={cy - r(i) + 9} className="dp-axis" textAnchor="middle">{name.toLowerCase()}</text>}
    </g>)}
    {/* the read arc over the top, the write arc under the bottom */}
    {now !== undefined && <path d={`M${cx - r(now)} ${cy}A${r(now)} ${r(now)} 0 0 1 ${cx + r(now)} ${cy}`} fill="none" stroke="var(--dp-value)" strokeWidth={2} />}
    {wr !== undefined && <path d={`M${cx + r(wr)} ${cy}A${r(wr)} ${r(wr)} 0 0 1 ${cx - r(wr)} ${cy}`} fill="none" stroke="var(--dp-on)" strokeWidth={2} />}
    {pending !== null && <circle cx={cx} cy={cy} r={r(pending)} fill="none" stroke="var(--dp-value)" strokeDasharray="3 3" strokeWidth={1.4} />}
    {now === undefined && pending === null && w > 90 && <text x={cx} y={h - 6} className="dp-ink-dim" textAnchor="middle">No reading of the reach</text>}
    {set && <Handle x={hx} y={hy} label="Reach" does="Drag out or in: the widest part of the world the agent may touch. Raising it asks you first." tone="value"
      onDrag={(x, y) => ask(v, set)(Math.round(clampTo(0, 3, Math.hypot(x - cx, y - cy) / step - 1)))} />}
  </g>
}

/** A reach you set: a raise, or any reach while the owner has not reported one, waits for Confirm; a narrowing goes at once. */
const ask = (v: V, set: ViewProps['set']) => (x: number) => {
  const now = reach(v)
  if (now === undefined || x > now) set('reachPending', x)
  else { set('reach', x); set('reachPending', undefined) }
}

/** The consent pair under a raised reach: the raise waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  if (p.v.reachPending === undefined) return null
  return <div className="ref-pair">
    <Action {...st(p, 'reach')} hold label="Confirm" does={`Raise the reach to ${RINGS[Number(p.v.reachPending)] ?? NONE}.`} onPress={() => { p.set('reach', Number(p.v.reachPending)); p.set('reachPending', undefined) }} />
    <Action label="Cancel" does="Keep the reach as it is." onPress={() => p.set('reachPending', undefined)} />
  </div>
}

// The light reads the owner alone; hollow while it has not said.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const ringName = (x: number | undefined) => (x === undefined ? undefined : RINGS[x])
const litCount = (rows: RowItem[], v: V, key: string) => (has(v, key) && reach(v) !== undefined ? rows.filter(r => r.light === 'lit').length : undefined)
const modeLabel = (v: V) => MODES.find(m => m.value === strOf(v, 'writeMode'))?.label

// ---------------------------------------------------------------- Asks: what waits for you, and whom the agent asks

const TOOL_CALLS = [{value: 'ask', label: 'Ask', does: 'You answer each request to use a tool.'}, {value: 'session', label: 'Session', does: 'A tool is allowed for this session.'},
  {value: 'always', label: 'Always', does: 'A tool is allowed every time.'}] as const
const GATES = [{value: 'diffs', label: 'Diffs', does: 'A change waits for you to read its diff.'}, {value: 'approvals', label: 'Approvals', does: 'A change waits for you to answer its request.'},
  {value: 'both', label: 'Both', does: 'A change waits for the diff and the approval.'}] as const
/** Calls to other agents: the owner's three ingress decisions (AIKit's GatewayIngressDecision). The owner's word for Ask is pair. */
const CALLS = [{value: 'allow', label: 'Allow', does: 'A call to another agent goes through at once.'}, {value: 'pair', label: 'Ask', does: 'A call waits in Approvals until you approve it.'},
  {value: 'deny', label: 'Deny', does: 'A call to another agent is refused, with a reason.'}] as const
const NO_ANSWER = [{value: 'hold', label: 'Hold', does: 'The request stays in the queue. Nothing lands.'}, {value: 'deny', label: 'Deny', does: 'The request is declined.'}] as const
const SAYS = {
  toolCalls: 'The answer to the harness\'s request to use a tool: ask you each time, allow for this session, or allow always. You always give Deny yourself.',
  gate: 'What waits for you before a change lands.',
  calls: 'Whether the agent may call another agent. Ask puts the call in Approvals. The gateway carries the call or its refusal.',
  escalate: 'Who the agent asks when it needs a decision.',
  wait: 'How long a request waits before it counts as unanswered.',
  noAnswer: 'What the agent does when nobody answers.',
}
/** Wait's scale, in seconds: 15 minutes to 24 hours. */
const WAIT = {min: 900, max: 86400, def: 14400} as const
const waitText = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 360) / 10} h`)
/** A wait set on the scale, to the minute under an hour and to the quarter hour above it. */
const snapWait = (s: number) => clampTo(WAIT.min, WAIT.max, s < 3600 ? Math.round(s / 60) * 60 : Math.round(s / 900) * 900)

/** The people the agent may ask, with the one the owner reports kept among them. */
function people(v: V): Option<string>[] {
  const raw = json<unknown>(v, 'people', [])
  const list = (Array.isArray(raw) ? raw : []).flatMap(item => {
    const o = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return typeof o.id === 'string' && o.id ? [{value: o.id, label: typeof o.name === 'string' && o.name ? o.name : o.id}] : []
  })
  const now = strOf(v, 'escalate')
  return now !== undefined && now !== '' && !list.some(x => x.value === now) ? [...list, {value: now, label: now}] : list
}

/** A macro that turns through a setting's words: at the owner's word, or none. */
function wordDial(p: ViewProps, key: string, label: string, does: string, options: readonly Option<string>[], def: number) {
  const at = options.findIndex(o => o.value === strOf(p.v, key))
  return <Dial {...st(p, key)} label={label} does={does} value={at < 0 ? NaN : at} def={def} scale={{min: 0, max: options.length - 1, step: 1}}
    format={i => options[Math.round(i)]?.label ?? NONE} onChange={i => p.set(key, options[Math.round(i)]!.value)} />
}
const radio = (p: ViewProps, key: keyof typeof SAYS, options: readonly Option<string>[]) =>
  <Radio {...st(p, key)} does={SAYS[key]} value={strOf(p.v, key) ?? ''} options={options} stack onChange={x => p.set(key, x)} />

/** The Asks page: which acts wait for you, then whom the agent asks, how long a request waits and what happens then. */
function AsksBands({p}: {p: ViewProps}) {
  return <>
    <Band>
      <Section label="Tool calls" width={96}>{radio(p, 'toolCalls', TOOL_CALLS)}</Section>
      <Section label="Before it lands" width={104}>{radio(p, 'gate', GATES)}</Section>
      <Section label="Calls to other agents" grow>{radio(p, 'calls', CALLS)}</Section>
    </Band>
    <Band>
      <Section label="Escalate to" width={132}>
        <Chooser {...st(p, 'escalate')} wide does={SAYS.escalate} value={strOf(p.v, 'escalate') ?? ''} options={people(p.v)} onChange={x => p.set('escalate', x)} />
      </Section>
      <Section label="Wait" width={96}>
        <ValueBox {...st(p, 'wait')} does={SAYS.wait} value={numOf(p.v, 'wait') ?? NaN} def={WAIT.def} scale={{min: WAIT.min, max: WAIT.max, log: true}} format={waitText}
          onChange={x => p.set('wait', snapWait(x))} />
      </Section>
      <Section label="On no answer" grow>{radio(p, 'noAnswer', NO_ANSWER)}</Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- Grants: what the agent may do to agency

/** Actuation's metagency operations, in the order an agency's life runs: determine another, configure it, actualise it, take its return in. */
const OPS = [
  {value: 'determine-agency', label: 'Determine', does: 'Bring another agency into being within bounds: a helper, a member.'},
  {value: 'configure-agency', label: 'Configure', does: 'Change how an agency is set up.'},
  {value: 'actualise-agency', label: 'Actualise', does: 'Make a composed agency actual in its World, with a receipt.'},
  {value: 'reintegrate-return', label: 'Reintegrate', does: 'Take an agency\'s return back into the work.'},
] as const
const EXPIRES = [{value: 'never', label: 'Never', does: 'The grant holds until it is revoked.'}, {value: '1h', label: '1 hour'}, {value: '1d', label: '1 day'}, {value: '7d', label: '7 days'}] as const
interface Grant {readonly ref: string; readonly holder?: string; readonly issuedBy?: string; readonly operations: readonly string[]; readonly worlds: readonly string[]
  readonly issuedAt?: number; readonly expiresAt?: number | null; readonly revoked?: {readonly at?: number; readonly reason?: string} | null}
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s !== '') : [])
const grantsOf = (v: V): Grant[] | undefined => {
  const raw = json<unknown>(v, 'grants', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((g): Grant[] => {
    const o = g && typeof g === 'object' ? g as Record<string, unknown> : {}
    if (typeof o.ref !== 'string' || !o.ref) return []
    const r = o.revoked && typeof o.revoked === 'object' ? o.revoked as Record<string, unknown> : o.revoked === null ? null : undefined
    return [{ref: o.ref, holder: typeof o.holder === 'string' ? o.holder : undefined, issuedBy: typeof o.issuedBy === 'string' ? o.issuedBy : undefined, operations: strs(o.operations),
      worlds: strs(o.worlds), issuedAt: typeof o.issuedAt === 'number' ? o.issuedAt : undefined, expiresAt: o.expiresAt === null ? null : typeof o.expiresAt === 'number' ? o.expiresAt : undefined,
      revoked: r === null ? null : r ? {at: typeof r.at === 'number' ? r.at : undefined, reason: typeof r.reason === 'string' ? r.reason : undefined} : undefined}]
  })
}
/** How a grant stands at the time it was read: in force, ended on its own terms, or revoked. */
const grantState = (g: Grant, now: number | undefined): 'live' | 'expired' | 'revoked' =>
  (g.revoked ? 'revoked' : g.expiresAt != null && now !== undefined && g.expiresAt <= now ? 'expired' : 'live')
const DAY = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = (s: number) => { const d = new Date(s * 1000); return `${d.getUTCDate()} ${DAY[d.getUTCMonth()]}` }
const worldWord = (ref: string) => (ref === 'control:root' ? 'your world' : ref.replace('project:', ''))
const liveCount = (v: V) => { const gs = grantsOf(v), now = numOf(v, 'readAt'); return gs ? gs.filter(g => grantState(g, now) === 'live').length : undefined }

/** The grants as a grid: a column for each operation, a row for each grant, a filled cell where it allows the operation. A revoked grant
 * is struck through; one that ended on its own terms is dashed. The last row is the grant you are about to issue, drawn hollow. */
function GrantsWell({v, w, h, chosen}: {v: V; w: number; h: number; chosen?: string}) {
  const gs = grantsOf(v), now = numOf(v, 'readAt'), lx = 8, top = 30, cw = (w - lx - 50) / OPS.length, rh = 16, rows = 5
  if (!gs) return <Display w={w} h={h} label="The grants" corner={NONE}><text x={8} y={22} className="dp-ink">No reading of the grants</text></Display>
  const draft = OPS.map(o => boolOf(v, `grant:${o.value}`) === true)
  const shownGs = gs.slice(0, rows)
  return <Display w={w} h={h} label="The grants" does="A column for each operation on agency, a row for each grant: filled where it allows the operation. Struck: revoked. Dashed: ended. The hollow row at the foot is the next grant." corner={`${liveCount(v)} in force`}>
    {OPS.map((o, i) => <text key={o.value} x={lx + i * cw + cw / 2} y={20} className="dp-axis" textAnchor="middle">{o.label[0]}</text>)}
    {shownGs.map((g, k) => {
      const y = top + k * rh, state = grantState(g, now), on = g.ref === chosen
      return <g key={g.ref} opacity={state === 'live' ? 1 : .55}>
        {OPS.map((o, i) => { const has_ = g.operations.includes(o.value), x = lx + i * cw + cw / 2 - 5
          return <rect key={o.value} x={x} y={y - 5} width={10} height={10} rx={1.5} fill={has_ && state === 'live' ? 'var(--dp-value)' : 'none'}
            stroke={has_ ? 'var(--dp-value)' : 'var(--text-faint)'} strokeDasharray={state === 'expired' && has_ ? '2 2' : undefined} strokeWidth={has_ ? 1.2 : .8} /> })}
        {state === 'revoked' && <path d={`M${lx} ${y}H${lx + OPS.length * cw}`} stroke="var(--rec)" strokeWidth={1.2} />}
        {on && <rect x={lx - 3} y={y - 8} width={OPS.length * cw + 6} height={16} rx={2} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
        <text x={w - 6} y={y + 3} className={state === 'live' ? 'dp-ink-dim' : 'dp-axis'} textAnchor="end">{state === 'revoked' ? 'revoked' : g.expiresAt == null ? (g.expiresAt === null ? 'no end' : NONE) : state === 'expired' ? 'ended' : `to ${day(g.expiresAt)}`}</text>
      </g>
    })}
    {gs.length > rows && <text x={lx} y={top + rows * rh - 2} className="dp-axis">{gs.length - rows} more</text>}
    {gs.length === 0 && <text x={lx} y={top + 3} className="dp-ink-dim">The agent holds no grant.</text>}
    <path d={`M${lx} ${h - 30}H${w - 6}`} className="dp-grid" />
    {OPS.map((o, i) => <rect key={o.value} x={lx + i * cw + cw / 2 - 5} y={h - 22} width={10} height={10} rx={1.5} fill={draft[i] ? 'color-mix(in srgb, var(--dp-on) 35%, transparent)' : 'none'}
      stroke={draft[i] ? 'var(--dp-on)' : 'var(--text-faint)'} strokeDasharray="2 1.5" />)}
    <text x={w - 6} y={h - 14} className="dp-axis" textAnchor="end">next</text>
  </Display>
}

/** The Grants page: the grants, the next grant's terms with Issue, and Revoke for the chosen one. */
export function GrantsBands({p}: {p: ViewProps}) {
  const v = p.v, gs = grantsOf(v), now = numOf(v, 'readAt')
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const sel = gs?.find(g => g.ref === chosen) ?? gs?.find(g => grantState(g, now) === 'live')
  const draftOps = OPS.filter(o => boolOf(v, `grant:${o.value}`) === true).map(o => o.value), world = strOf(v, 'grant:world')
  const worlds = strs(json<unknown>(v, 'worlds', []))
  const items: RowItem[] = !gs ? unreadRows('No reading of the grants.')
    : gs.map(g => { const state = grantState(g, now)
      return {id: g.ref, name: g.worlds.map(worldWord).join(', ') || NONE, light: state === 'live' ? 'lit' : 'dark', tone: 'value',
        note: `${g.operations.length} op${g.operations.length === 1 ? '' : 's'} · ${state === 'revoked' ? 'revoked' : state === 'expired' ? 'ended' : g.issuedAt === undefined ? 'live' : `since ${day(g.issuedAt)}`}`,
        does: `${g.ref}: ${g.operations.join(', ') || 'no operation'}; issued by ${g.issuedBy ?? NONE}${g.revoked?.reason ? `; revoked: ${g.revoked.reason}` : ''}.`} })
  const issueWhy = !draftOps.length ? 'Choose at least one operation.' : !world ? 'Choose the World the grant reaches.' : undefined
  const selState = sel ? grantState(sel, now) : undefined
  return <Band>
    <Section width={206}><GrantsWell v={v} w={194} h={146} chosen={sel?.ref} /></Section>
    <Section label="Next grant" width={124}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 4px', width: '100%'}}>{OPS.map(o => { const now_ = boolOf(v, `grant:${o.value}`)
        return <Toggle {...st(p, `grant:${o.value}`)} key={o.value} label={o.label} does={o.does} on={now_ === true} unknown={now_ === undefined} onChange={x => p.set(`grant:${o.value}`, x)} /> })}</div>
      <Chooser {...st(p, 'grant:world')} label="World" wide does="The World the grant lets the agent act in." value={world ?? ''} options={worlds.map(x => ({value: x, label: worldWord(x)}))} onChange={x => p.set('grant:world', x)} />
      <Chooser {...st(p, 'grant:expires')} label="Ends" wide does="When the grant stops on its own. Revoke ends it sooner." value={strOf(v, 'grant:expires') ?? ''} options={EXPIRES} onChange={x => p.set('grant:expires', x)} />
      <Action {...st(p, 'issue')} label="Issue" does="Give the agent this grant. It holds from now until it ends or you revoke it." disabled={st(p, 'issue').disabled ?? issueWhy}
        onPress={() => p.set('issue', JSON.stringify({holder: strOf(v, 'holder'), operations: draftOps, worlds: world ? [world] : [], expiresIn: strOf(v, 'grant:expires')}))} />
    </Section>
    <Section label="Grants" grow>
      <Rows does="Each grant the agent holds, by the Worlds it reaches. Select one to revoke it." items={items} empty="The agent holds no grant." size={7} selected={sel?.ref} onSelect={gs?.length ? setChosen : undefined} />
    </Section>
    <Section label="Revoke" width={112}>
      <Readout label="chosen" does="The grant Revoke ends." value={sel ? sel.worlds.map(worldWord).join(', ') || NONE : undefined} />
      <TextField {...st(p, 'revoke:reason')} label="Reason" does="Why you end the grant. It is kept with the revocation." value={strOf(v, 'revoke:reason') ?? ''} placeholder="owner withdrawal" onChange={x => p.set('revoke:reason', x)} />
      <Action {...st(p, 'revoke')} hold label="Revoke" does="End the grant now. A revoked grant cannot be given back: issue a new one." onPress={sel ? () => p.set('revoke', sel.ref) : undefined}
        disabled={st(p, 'revoke').disabled ?? (selState && selState !== 'live' ? `The grant has ${selState === 'revoked' ? 'been revoked' : 'ended'}.` : undefined)} />
    </Section>
  </Band>
}

const SAMPLE_READS: Place[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0}, {id: 'scene', name: 'This scene', ring: 1}, {id: 'registers', name: 'Scene registers', ring: 1},
  {id: 'tidal', name: 'Tidal (Expression)', ring: 2}, {id: 'wiki', name: 'Central wiki', ring: 3},
]
const SAMPLE_WRITES: Place[] = [
  {id: 'lantern', name: 'Lantern (object)', ring: 0, receipts: 3}, {id: 'layers', name: 'Scene layers', ring: 1, receipts: 1}, {id: 'tidal', name: 'Tidal (Expression)', ring: 2, receipts: 0},
]
/** The grants of the gallery's fixtures, in the shape of Actuation's governing authority records: Flint may actualise and configure agency in
 * O-I; a grant for the Quaternal Logic ended on its own terms; one for your whole world was revoked. Read at 21 Oct, 02:00 UTC. */
const SAMPLE_GRANTS = {
  holder: 'agent:expressed-ba635b5ae01b4ca98c591fe342079449', readAt: 1792547400,
  worlds: JSON.stringify(['control:root', 'project:O-I', 'project:quaternal-logic', 'project:Archetypal-Earth']),
  grants: JSON.stringify([
    {ref: 'authority:local:flint-o-i-20261020', holder: 'agent:expressed-ba635b5ae01b4ca98c591fe342079449', issuedBy: 'human:owner',
      operations: ['actualise-agency', 'configure-agency'], worlds: ['project:O-I'], issuedAt: 1792450000, expiresAt: null, revoked: null},
    {ref: 'authority:local:flint-ql-20261014', holder: 'agent:expressed-ba635b5ae01b4ca98c591fe342079449', issuedBy: 'human:owner',
      operations: ['actualise-agency'], worlds: ['project:quaternal-logic'], issuedAt: 1791900000, expiresAt: 1792000000, revoked: null},
    {ref: 'authority:local:flint-root-20261002', holder: 'agent:expressed-ba635b5ae01b4ca98c591fe342079449', issuedBy: 'human:owner',
      operations: ['determine-agency', 'configure-agency', 'actualise-agency', 'reintegrate-return'], worlds: ['control:root'], issuedAt: 1790900000, expiresAt: null,
      revoked: {at: 1791600000, reason: 'owner withdrawal'}}]),
  'grant:determine-agency': false, 'grant:configure-agency': false, 'grant:actualise-agency': true, 'grant:reintegrate-return': false,
  'grant:world': 'project:Archetypal-Earth', 'grant:expires': '1d',
}
/** The Asks of the gallery's fixtures, at the manual's defaults; you are the one the agent asks. */
const SAMPLE_ASKS = {toolCalls: 'ask', gate: 'both', calls: 'pair', escalate: 'you', people: JSON.stringify([{id: 'you', name: 'You'}]), wait: WAIT.def, noAnswer: 'hold'}
const PAGES = [{id: 'reach', label: 'Reach'}, {id: 'asks', label: 'Asks'}, {id: 'grants', label: 'Grants'}]

export const scope: DesignedDevice = {
  id: 'software-factory:context-write-mode',
  title: 'Scope',
  kind: 'effect',
  defaults: {light: 'lit', reach: 1, writeMode: 'propose', basis: 'r15 → r17',
    reads: JSON.stringify(SAMPLE_READS), writes: JSON.stringify(SAMPLE_WRITES),
    // Your include or exclude of each read place, as the world's relations keep it: the Expression you set aside is excluded.
    'r:lantern': true, 'r:scene': true, 'r:registers': true, 'r:tidal': false, 'r:wiki': true,
    ...SAMPLE_ASKS, ...SAMPLE_GRANTS},
  firstPage: 'reach',
  fixtures: {
    'A scene in reach': {},
    'No grant yet': {grants: '[]', 'grant:actualise-agency': true, 'grant:world': 'project:O-I'},
    'No readings': Object.fromEntries(['light', 'reach', 'writeMode', 'basis', 'reads', 'writes', ...Object.keys(SAMPLE_ASKS), ...Object.keys(SAMPLE_GRANTS)].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Scope" light={light(p)} readings={[ringName(reach(p.v)) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Scope" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write." corner={shown(p.v, 'basis')}>
        <Rings v={p.v} set={p.set} w={140} h={146} labels={false} />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      <Dial {...st(p, 'reach')} label="Reach" does="The widest part of the world the agent may touch. Raising it asks you first." value={reach(p.v) ?? NaN} def={1}
        scale={{min: 0, max: 3, step: 1}} format={x => RINGS[x]!} onChange={ask(p.v, p.set)} pending={p.v.reachPending !== undefined || st(p, 'reach').pending} />
      {wordDial(p, 'writeMode', 'Write mode', 'How a write arrives.', MODES, 0)}
      {wordDial(p, 'toolCalls', 'Tool calls', SAYS.toolCalls, TOOL_CALLS, 0)}
      {wordDial(p, 'calls', 'Calls to other agents', SAYS.calls, CALLS, 1)}
      <Readout label="reads" does="Places the agent may read. Click the plate to choose them." value={litCount(readRows(p), p.v, 'reads')} tone="value" onPress={p.nav.select} />
      <Readout label="writes" does="Places the agent may write. Click the plate to choose them." value={litCount(writeRows(p.v), p.v, 'writes')} tone="accent" onPress={p.nav.select} />
    </Section>
  </Panel>,

  whole: p => <ScopeWhole p={p} />,

  full: p => {
    const w = 760, h = 420
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The world the agent may touch">
        <g className="dp-display" style={{background: 'none'}}>
          <Rings v={p.v} w={w} h={h} labels />
          {writes(p.v).filter(x => (x.receipts ?? 0) > 0).map((x, i) => {
            const step = (h / 2 - 8) / 4, rr = step * (x.ring + 1) - step / 2, a = -2.4 + i * .9
            return <g key={x.id}>
              <rect x={w / 2 + rr * Math.cos(a) - 7} y={h / 2 + 4 + rr * Math.sin(a) - 7} width={14} height={14} fill="var(--dp-on)" />
              <text x={w / 2 + rr * Math.cos(a)} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} textAnchor="middle" style={{font: '700 9px var(--font-ui)', fill: 'var(--on-accent)'}}>{x.receipts}</text>
              <text x={w / 2 + rr * Math.cos(a) + 11} y={h / 2 + 4 + rr * Math.sin(a) + 3.5} className="dp-ink">{x.name}</text>
            </g>
          })}
          {!has(p.v, 'writes') && <text x={18} y={h - 16} className="dp-ink-dim">No reading of the places the agent wrote</text>}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Scope" light={light(p)} onFull={p.nav.full}>
    <Display w={64} h={64} label="Reach"><Rings v={p.v} w={64} h={64} labels={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="reach" value={ringName(reach(p.v))} tone="value" />
      <Readout label="write mode" value={modeLabel(p.v)} tone="accent" />
      <Readout label="receipts" value={receipts(p.v)} />
    </div>
  </Tile>,
}

function ScopeWhole({p}: {p: ViewProps}) {
  const [readPage, setReadPage] = useState(0)
  const at = p.v.reachPending ?? reach(p.v)
  const page = p.page === 'asks' || p.page === 'grants' ? p.page : 'reach'
  return <Panel title="Scope" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} page={page} onPage={p.setPage} pages={PAGES}>
    {page === 'asks' ? <AsksBands p={p} /> : page === 'grants' ? <GrantsBands p={p} /> : <>
    <Band>
      <Section width={168}>
        <Display w={156} h={146} label="Reach" does="Teal: what the agent may read. Amber: what it may write. Drag the handle to set the reach." corner={shown(p.v, 'basis')}>
          <Rings v={p.v} set={p.set} w={156} h={146} labels />
        </Display>
      </Section>
      <Section label="Reach" width={96}>
        <Radio {...st(p, 'reach')} does="The widest part of the world the agent may touch. Raising it asks you first." value={at === undefined ? '' : String(at)}
          options={RINGS.map((name, i) => ({value: String(i), label: name}))} stack onChange={x => ask(p.v, p.set)(Number(x))} pending={p.v.reachPending !== undefined || st(p, 'reach').pending} />
        <Consent p={p} />
      </Section>
      <Section label="Write mode" grow>
        <Radio {...st(p, 'writeMode')} does="How a write arrives." value={strOf(p.v, 'writeMode') ?? ''} options={MODES} stack onChange={x => p.set('writeMode', x)} />
        <Readout big label="receipts" does="One receipt for each write the agent made." value={receipts(p.v)} tone="accent" />
      </Section>
    </Band>
    <Band>
      <Section width={132}>
        <Rows label="Reads" waiting={st(p, 'reads').waiting} why="No reading of the places the agent may read." does="The places the agent may read. A teal light marks a place in reach. The square is your request: pressed, the world includes the place; open, it excludes it."
          items={has(p.v, 'reads') ? readRows(p) : undefined} empty="The agent may read no place." onRequest={askRead(p)} size={7} page={readPage} onPage={setReadPage} />
      </Section>
      <Section width={132}>
        <Rows label={has(p.v, 'writes') ? 'Writes · receipts' : 'Writes'} waiting={st(p, 'writes').waiting} why="No reading of the places the agent may write." does="The places the agent may write. The square is your request; amber marks a place in reach." items={has(p.v, 'writes') ? writeRows(p.v) : undefined}
          empty="The agent may write no place." onRequest={(id, x) => p.set(`w:${id}`, x)} size={7} />
      </Section>
      <Section label="Basis" grow>
        <Readout label="basis" does="The revision the agent started from, and the revision of its edits." value={strOf(p.v, 'basis')} />
      </Section>
    </Band>
    </>}
  </Panel>
}
