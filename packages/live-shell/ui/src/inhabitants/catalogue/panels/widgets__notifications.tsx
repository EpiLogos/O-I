// Notifications (manual §23.9, widgets:notifications): what asks for your attention, from an owner or an agent. A monitor: it stands
// on the rail and in a pane, writes nothing, and opens what it shows. Live's nearest: none; the shape is the browser's list beside
// the clip it opens. Messages keeps the agents that wait for you (its Needs you order, §19.24) and Approvals the proposals (§19.11);
// this monitor counts both in its head, opens them, and lists the requests an owner raised for you: a routine that failed, a Day
// whose close is due, a check that broke. The display is the day as a strip, one mark for each request at the time it came: the
// accent for an ordinary request, the record colour for an urgent one, hollow once you opened it, crossed where the host refused it.
//
// Owners, keyed on their paths:
//   requests  [{id, at, time, title?, body?, from, subject?, urgency?, category?, open?, delivery: {state, provider, unsupported?}}]
//             each attention request and its delivery: Central's `personal.notify` (ctrl/src/personal.rs; connector-sdk
//             notification.rs NotificationRequest title, body, subject_ref, urgency, category, callback (oi:// or https://) as
//             `open`, caller_ref as `from`; NotificationDelivery state posted | rejected, provider, unsupported_requested_features).
//             `time` is minutes after midnight, for the strip. A delivery is never your acknowledgement
//             (notification_delivery_is_human_acknowledgement: false). personal.notify is not in the installed action list (`ctrl
//             --json action list`; `oi central action run personal.notify` answers Unknown Action), and no owner keeps the
//             requests: the receipt goes back to the caller only. Until Central keeps them, `requests` arrives absent.
//   provider  {provider, available, authorization, callback, urgency, category}  the host's notification capabilities
//             (UserNotification capabilities: authorization granted | denied | not_determined | provider_managed | unavailable;
//             supports_callback, supports_urgency, supports_category).
//   waiting   number  agents that wait for you or have stalled: Messages' Needs you (`aikit gateway who --json`, state waiting or
//             stalled).
//   proposals number  proposals that wait in Approvals (the Approvals device's reading).
// Settings the shell holds: show ('all' | 'unopened' | 'urgent'), follow (keep the newest at the top and the strip on now), opened
//   [id] (the requests you opened here), selected (the request shown under the list).
// Acts: open <id> (the shell opens the request's `open` target, or its subject, where it belongs: an oi:// target in its instrument,
//   an https:// one in Web), messages (opens Messages on Needs you), approvals (opens Approvals). Opening writes nothing to any owner.
// A key the owner has not reported is absent: the views draw "—" and name the missing reading.
import {Action, Display, Radio, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {NONE, boolOf, has, json, numOf, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane} from './monitor'
import './widgets__notifications.css'

type V = ViewProps['v']
type Rec = Record<string, unknown>
const rec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x)
const txt = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)

interface Request {
  readonly id: string; readonly at?: string; readonly time?: number; readonly title?: string; readonly body?: string; readonly from: string
  readonly subject?: string; readonly urgency?: string; readonly category?: string; readonly open?: string
  readonly delivered?: 'posted' | 'rejected'; readonly provider?: string; readonly unsupported: readonly string[]
}
function requestsOf(v: V): Request[] | undefined {
  if (!has(v, 'requests')) return undefined
  return json<unknown[]>(v, 'requests', []).filter(rec).flatMap(r => {
    const id = txt(r.id), from = txt(r.from), d = rec(r.delivery) ? r.delivery : undefined
    return id && from ? [{id, from, at: txt(r.at), time: typeof r.time === 'number' ? r.time : undefined, title: txt(r.title), body: txt(r.body), subject: txt(r.subject),
      urgency: txt(r.urgency), category: txt(r.category), open: txt(r.open), delivered: d?.state === 'posted' || d?.state === 'rejected' ? d.state : undefined,
      provider: txt(d?.provider), unsupported: Array.isArray(d?.unsupported) ? (d!.unsupported as unknown[]).filter((x): x is string => typeof x === 'string') : []}] : []
  })
}
const openedOf = (v: V) => json<unknown[]>(v, 'opened', []).filter((x): x is string => typeof x === 'string')
const urgent = (r: Request) => r.urgency === 'critical' || r.urgency === 'urgent'
/** The list as Show filters it, newest first. */
function shown(v: V, all: readonly Request[]): Request[] {
  const show = strOf(v, 'show') ?? 'all', opened = openedOf(v)
  return [...all].filter(r => (show === 'unopened' ? !opened.includes(r.id) : show === 'urgent' ? urgent(r) : true)).sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
}
const headline = (r: Request) => r.title ?? r.body ?? NONE
const who = (from: string) => from.replace(/^(routine|position|agent|owner|central|factory|aikit|workcell):/, '')

const SHOWS: readonly Option<string>[] = [{value: 'all', label: 'All', does: 'Every request today.'}, {value: 'unopened', label: 'Unopened', does: 'The requests you have not opened.'},
  {value: 'urgent', label: 'Urgent', does: 'The requests an owner marked urgent.'}]
const AUTH: Readonly<Record<string, string>> = {granted: 'allowed', denied: 'refused', not_determined: 'not asked yet', provider_managed: 'by the provider', unavailable: 'unavailable'}

/** The light: lit while the host shows notifications, dark where it cannot or you refused it, hollow with no reading. */
function light(v: V): LightState {
  const pr = json<Rec | null>(v, 'provider', null)
  return !pr ? 'unknown' : pr.available === true && pr.authorization !== 'denied' && pr.authorization !== 'unavailable' ? 'lit' : 'dark'
}
const LIGHT_WHY = 'Notifications has no on or off: it reads whether this computer shows notifications.'

/** The day as a strip, midnight to midnight: a mark for each request at the time it came, the record colour for an urgent one,
 * hollow once opened, crossed where the host refused it. A tick marks now. */
function Strip({v, x0, w, y, all, now}: {v: V; x0: number; w: number; y: number; all: readonly Request[]; now?: number}) {
  const X = (m: number) => x0 + (Math.max(0, Math.min(1440, m)) / 1440) * w, opened = openedOf(v)
  return <g>
    <path d={`M${x0} ${y}H${x0 + w}`} className="dp-faint" />
    {[0, 6, 12, 18, 24].map(h => <g key={h}><path d={`M${X(h * 60)} ${y - 2}V${y + 2}`} className="dp-faint" /><text x={X(h * 60)} y={y + 11} className="dp-axis" textAnchor="middle">{String(h).padStart(2, '0')}</text></g>)}
    {now !== undefined && <path d={`M${X(now)} ${y - 7}V${y + 3}`} stroke="var(--dp-value)" strokeWidth={1} />}
    {all.filter(r => r.time !== undefined).map(r => {
      const x = X(r.time!), c = urgent(r) ? 'var(--rec)' : 'var(--dp-on)', seen = opened.includes(r.id)
      return <g key={r.id}><title>{`${r.at ?? NONE} · ${headline(r)}`}</title>
        {r.delivered === 'rejected' ? <path d={`M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6`} stroke={c} strokeWidth={1.4} />
          : <circle cx={x} cy={y} r={3} fill={seen ? 'none' : c} stroke={c} strokeWidth={1.2} />}</g>
    })}
  </g>
}

function Head({p}: {p: ViewProps}) {
  const v = p.v, all = requestsOf(v), opened = openedOf(v), pr = json<Rec | null>(v, 'provider', null)
  return <MonitorHead title="Notifications" readings={[
    {label: 'unopened', value: all?.filter(r => !opened.includes(r.id)).length, does: 'Requests today that you have not opened.', tone: 'accent'},
    {label: 'urgent', value: all?.filter(urgent).length, does: 'Requests an owner marked urgent.', tone: 'rec'},
    {label: 'agents wait', value: numOf(v, 'waiting'), does: 'Agents that wait for you or have stalled. Messages lists them first.', tone: 'stall'},
    {label: 'proposals', value: numOf(v, 'proposals'), does: 'Proposals that wait for you in Approvals.'},
    {label: 'shown by', value: pr ? `${txt(pr.provider) ?? NONE} · ${AUTH[txt(pr.authorization) ?? ''] ?? NONE}` : undefined, does: 'Whether this computer shows the requests, and through what.',
      tone: pr && (pr.authorization === 'denied' || pr.available === false) ? 'stall' : undefined},
  ]} controls={<>
    <Radio {...st(p, 'show')} label="Show" does="Which requests the list holds." value={strOf(v, 'show') ?? 'all'} options={SHOWS} onChange={x => p.set('show', x)} />
    <Toggle {...st(p, 'follow')} label="Follow" does="Keep the newest request at the top and the strip on now." on={boolOf(v, 'follow') === true} unknown={boolOf(v, 'follow') === undefined} onChange={x => p.set('follow', x)} />
    <Action label="Messages ▸" does="Opens Messages on Needs you: the agents that wait for you." onPress={() => p.set('messages', true)} />
    <Action label="Approvals ▸" does="Opens Approvals: the proposals that wait for you." onPress={() => p.set('approvals', true)} />
  </>} />
}

function Pane({p}: {p: ViewProps}) {
  const v = p.v, all = requestsOf(v), opened = openedOf(v), list = all ? shown(v, all) : undefined, sel = all?.find(r => r.id === strOf(v, 'selected')) ?? list?.[0]
  const open = (r: Request) => { p.set('selected', r.id); p.set('open', r.id) }
  return <MonitorPane label="Notifications" head={<Head p={p} />}>{room => <div className="nt-body">
    <svg className="nt-strip" width={room.w} height={34} viewBox={`0 0 ${room.w} 34`} role="img" aria-label="Today's requests along the day">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><Strip v={v} x0={20} w={room.w - 40} y={14} all={all ?? []} now={numOf(v, 'now')} /></g>
    </svg>
    {list === undefined ? <p className="nt-none">No reading of the requests.</p>
      : list.length === 0 ? <p className="nt-none">{all!.length ? 'Nothing here under this Show.' : 'Nothing asks for you today.'}</p>
      : <table className="nt-list">
        <colgroup><col style={{width: 22}} /><col style={{width: 48}} /><col /><col style={{width: 120}} /><col style={{width: 150}} /><col style={{width: 84}} /><col style={{width: 54}} /></colgroup>
        <thead><tr><th /><th>At</th><th>Request</th><th>From</th><th>About</th><th>Shown</th><th /></tr></thead>
        <tbody>{list.slice(0, Math.max(1, Math.floor((room.h - 34 - 44 - 22) / 21))).map(r => {
          const seen = opened.includes(r.id)
          return <tr key={r.id} data-seen={seen ? 'true' : undefined} data-sel={sel?.id === r.id ? 'true' : undefined} onClick={() => p.set('selected', r.id)}>
            <td><i className="nt-mark" data-urgent={urgent(r) ? 'true' : undefined} data-seen={seen ? 'true' : undefined} /></td>
            <td className="nt-at">{r.at ?? NONE}</td>
            <td><b>{headline(r)}</b>{r.title && r.body && <span>{r.body}</span>}</td>
            <td data-i={`From|${r.from}`}>{who(r.from)}</td>
            <td className="nt-ref" data-i={r.subject ? `About|${r.subject}` : undefined}>{r.subject ?? NONE}</td>
            <td data-i={r.delivered === 'rejected' ? `Refused|${r.provider ?? 'The host'} did not show it.${r.unsupported.length ? ` It cannot show: ${r.unsupported.join(', ')}.` : ''}` : r.provider ? `Shown|Through ${r.provider}. Shown is not read: only opening it here counts.` : undefined}>
              <span data-st={r.delivered === 'rejected' ? 'stall' : undefined}>{r.delivered === 'posted' ? 'shown' : r.delivered === 'rejected' ? 'refused' : NONE}</span></td>
            <td className="nt-act"><Action {...st(p, 'open')} label="Open" does={`Opens ${r.open ?? r.subject ?? 'what it is about'} where it belongs.`} onPress={() => open(r)}
              disabled={r.open || r.subject ? undefined : 'It names nothing to open.'} /></td>
          </tr>
        })}</tbody>
      </table>}
    {sel && <p className="nt-detail" aria-live="polite"><b>{headline(sel)}</b>{sel.body && sel.title ? ` · ${sel.body}` : ''}<span>{who(sel.from)}{sel.category ? ` · ${sel.category}` : ''}{sel.urgency ? ` · ${sel.urgency}` : ''}</span></p>}
  </div>}</MonitorPane>
}

function TileView({p}: {p: ViewProps}) {
  const v = p.v, all = requestsOf(v), list = all ? shown({...v, show: 'all'}, all) : undefined, opened = openedOf(v)
  return <Tile title="Notifications" light={light(v)} lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}
    badge={all?.filter(r => !opened.includes(r.id)).length || undefined}>
    <Display w={266} h={104} label="Today's requests" corner={all ? `${all.filter(r => !opened.includes(r.id)).length} unopened` : NONE}
      does="The day as a strip: a mark for each request at the time it came, the record colour for an urgent one, hollow once opened, crossed where the host refused it. Under it the latest; click one to open it.">
      <Strip v={v} x0={10} w={246} y={24} all={all ?? []} now={numOf(v, 'now')} />
      {list === undefined ? <text x={10} y={64} className="dp-ink-dim">No reading of the requests</text>
        : list.length === 0 ? <text x={10} y={64} className="dp-ink-dim">Nothing asks for you today</text>
        : list.slice(0, 3).map((r, i) => <g key={r.id} role="button" tabIndex={0} aria-label={`Open ${headline(r)}`} style={{cursor: 'pointer'}} onClick={() => p.set('open', r.id)}
          onKeyDown={e => { if (e.key === 'Enter') p.set('open', r.id) }}>
          <circle cx={13} cy={46 + i * 14} r={2.6} fill={opened.includes(r.id) ? 'none' : urgent(r) ? 'var(--rec)' : 'var(--dp-on)'} stroke={urgent(r) ? 'var(--rec)' : 'var(--dp-on)'} />
          <text x={22} y={49 + i * 14} className="dp-axis">{r.at ?? NONE}</text>
          <text x={50} y={49 + i * 14} className={opened.includes(r.id) ? 'dp-ink-dim' : 'dp-ink'}>{headline(r).length > 38 ? `${headline(r).slice(0, 37)}…` : headline(r)}</text>
        </g>)}
      <text x={10} y={99} className="dp-axis">{`agents wait ${numOf(v, 'waiting') ?? NONE} · proposals ${numOf(v, 'proposals') ?? NONE}`}</text>
    </Display>
  </Tile>
}

// The gallery's sample material. The views never read these constants: they arrive on `requests` and `provider`.
const REQUESTS = [
  {id: 'n1', at: '07:31', time: 451, title: 'Morning checks failed', body: 'O-I Verify: 2 of 14 checks failed on main.', from: 'routine:morning-checks', subject: 'factory:run:01M5…verify', urgency: 'critical',
    category: 'routine', open: 'oi://factory/runs/01M5ENFNAVWDKQ', delivery: {state: 'posted', provider: 'macOS Notification Centre'}},
  {id: 'n2', at: '12:02', time: 722, title: 'Kev decision service down', body: 'service:kev-decision answers nothing on 127.0.0.1:8019.', from: 'workcell:mac', subject: 'service:kev-decision/personal-workcell',
    urgency: 'normal', category: 'service', open: 'oi://workcell/env-1/services', delivery: {state: 'posted', provider: 'macOS Notification Centre'}},
  {id: 'n3', at: '16:45', time: 1005, title: 'The Day closes at 04:00', body: 'Face 5 holds no synthesis yet.', from: 'central:day', subject: 'day:2026-10-21', urgency: 'low', category: 'day',
    open: 'oi://central/day/2026-10-21', delivery: {state: 'posted', provider: 'macOS Notification Centre', unsupported: ['urgency']}},
  {id: 'n4', at: '17:10', time: 1030, title: 'Flint asks for a decision', body: 'Which root first: shell or cradle?', from: 'position:flint', subject: 'agent:flint', urgency: 'normal', category: 'agent',
    open: 'oi://messages/position:flint', delivery: {state: 'posted', provider: 'macOS Notification Centre'}},
]
const GRANTED = {provider: 'macOS Notification Centre', available: true, authorization: 'granted', callback: true, urgency: false, category: true}

export const design = railAndPane({
  id: 'widgets:notifications',
  title: 'Notifications',
  kind: 'monitor',
  defaults: {
    show: 'all', follow: true, now: 1052, selected: 'n4', opened: JSON.stringify(['n2']),
    requests: JSON.stringify(REQUESTS), provider: JSON.stringify(GRANTED), waiting: 2, proposals: 3,
  },
  fixtures: {
    'Four ask': {},
    'Urgent only': {show: 'urgent', selected: 'n1'},
    'The host refuses': {provider: JSON.stringify({...GRANTED, authorization: 'denied'}),
      requests: JSON.stringify(REQUESTS.map(r => ({...r, delivery: {state: 'rejected', provider: 'macOS Notification Centre'}})))},
    'Nothing asks': {requests: JSON.stringify([]), opened: JSON.stringify([]), selected: undefined, waiting: 0, proposals: 0},
    'No readings': {requests: undefined, provider: undefined, waiting: undefined, proposals: undefined, opened: undefined, selected: undefined, now: undefined},
  },
  firstPage: '',
  full: p => <Pane p={p} />,
  widget: p => <TileView p={p} />,
})
