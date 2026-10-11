/** Status-bar fidelity for the agent shell — one source, two renders.
 *
 * Every control pair is transcribed verbatim from the shell oracle
 * (agent-shell-fidelity.json, `controls`). The `data-i` attribute renders
 * `label|function` (the status-bar contract splits on the FIRST `|`); the
 * `title` attribute renders the same pair as `label · function`. Never
 * build a data-i or title string by hand: add it here. */

export function agentControlTip(label: string, fn: string): string {
  return `${label} · ${fn}`
}

export function agentDataI(label: string, fn: string): string {
  return `${label}|${fn}`
}

/** Control pairs keyed by stable control keys — oracle ids where the oracle
 * names one (tBrowser, hb, tokScope, od, lfold, …), task names otherwise.
 * `trackArm` is the grid Arm (who you talk to); `arm` stays the transport
 * Write arm, matching the oracle's two distinct controls. */
export const AGENT_CONTROL_PAIRS = {
  // Transport — oracle orderHint ids.
  tBrowser: ['Browser', 'Show or hide the browser (⌘⌥B).'],
  tap: ['Tap · ping', 'Asks every running agent for a status line now instead of at the next heartbeat. Answers land in the Agents tile.'],
  effort: ['Effort', 'Where Live has tempo: how hard the armed session thinks per turn (low → max). Each task can override it.'],
  effDn: ['Effort −', 'One step less effort.'],
  effUp: ['Effort +', 'One step more effort.'],
  hb: ['Heartbeat', 'Where Live has the metronome: running agents check in on a cadence. Each check-in moves that thread’s needle in the Arrangement; a needle that stops is a stall.'],
  tokScope: ['Tokens', 'Where Live has key and scale: a token counter. Click to switch what it counts — selected session · group · everything open.'],
  follow: ['Follow', 'The Arrangement scrolls with the live needles and Context tiles follow what the selected agent touches. Off: nothing moves your view.'],
  play: ['Run', 'Live’s Play. Launches the selected task, or every queued one. Enter in a composer is the same press.'],
  stop: ['Stop all', 'Once: every running agent pauses at the next quantize point and keeps context. Twice: turns are cancelled and unlanded writes return to basis. Per-session hard stop sits on each track.'],
  rec: ['Voice', 'Live’s Record. Records speech into a new task clip on the armed track, or into the open thread’s composer.'],
  od: ['Steer · overdub', 'On: what you send while an agent runs steers the running turn. Off: it queues as the next task.'],
  arm: ['Write arm', 'Live’s automation arm. Off: writes arrive as proposals. On: writes inside each world device land directly, with a receipt.'],
  loop: ['Loop', 'The selected task repeats until its stop condition or cap — a routine.'],
  vSession: ['Session · Tab', 'Tracks are sessions, clips are tasks.'],
  vArr: ['Arrangement · Tab', 'The run viewer: sessions over time, one live needle per thread.'],
  tDetail: ['Detail', 'Show or hide the device/clip detail (⌘⌥L).'],
  tDock: ['Context dock', 'Show or hide the context dock: tiles above, launcher below.'],
  // Transport extras.
  link: ['Link', 'Joins these sessions to agents in other harnesses and on other machines (Mac, Omarchy): one ledger, one clock. 2 peers.'],
  budget: ['Budget', 'Where Live has the time signature: turns used / allowed for the selected session.'],
  quantize: ['Interrupt quantize', 'Where Live has launch quantization: how fast Stop and Steer land — now · next tool · next turn.'],
  tokIn: ['Tokens in', 'Tokens read by the counted sessions.'],
  tokOut: ['Tokens out', 'Tokens written by the counted sessions.'],
  position: ['Position', 'Where Live shows bars.beats.sixteenths: task . turn . step of the selected session.'],
  handBack: ['Hand back', 'Live’s re-enable automation. Lit: you edited something an agent holds (HeroShot physics, Honey). Press to hand it back.'],
  capture: ['Capture', 'Live’s session record. Records what you do by hand into a new clip on the armed track — a worked example an agent can learn as a skill.'],
  punchIn: ['Punch in', 'Turns the write window’s start on or off.'],
  punchOut: ['Punch out', 'Writes stop after this step (here: before deploy).'],
  writeWindowIn: ['Write window · in', 'Punch-in: no writes before this step (here: until the plan is approved).'],
  writeWindowOut: ['Write window · out', 'Punch-out step, or the loop cap when Loop is on.'],
  point: ['Point', 'Live’s draw mode. Mark the stage or any tile; the armed agent receives the mark as a reference.'],
  keys: ['Keys', 'Live’s computer keyboard: number keys launch task rows, letters fire rack macros, Space runs.'],
  earthView: ['Earth view (planned)', 'The Earth / Solar-System projection of the World. The button holds its place; the projection is still to be built.'],
  map: ['Map', 'Live’s MIDI map. Bind a key, pad or spoken phrase to any control — ‘Fizz, retry’.'],
  throughput: ['Throughput', 'Where Live shows sample rate: tokens per second across running agents.'],
  context: ['Context', 'Where Live shows CPU load: the selected session’s context-window fill.'],
  spend: ['Spend', 'Where Live’s CPU meter sits: session spend against its cap.'],
  expressionsTab: ['Expressions', 'The native Expressions application (outside this mockup).'],
  techneTab: ['Technē', 'Knowledge and instruments (outside this mockup).'],
  workbenchTab: ['Workbench', 'Native sources and sessions (outside this mockup).'],
  // Grid controls.
  hardStop: ['Hard stop', 'Stops ${t.group?\'the group and every session in it\':\'this session\'} now — mid-tool if needed — and keeps what was written as a draft.'],
  retry: ['Retry', 'Restarts a stalled or failed task from its last good step, same basis.${lit?\' Lit: a lane in here has stalled.\':\'\'}'],
  telemetry: ['Telemetry', 'Live’s track activator, on the number: the whole group as a context source. Off: it keeps running but stops feeding the dock, the ledger stream and other agents’ context.'],
  telemetryContext: ['Telemetry · context source', 'Live’s track activator. On: this session feeds the dock, the ledger stream and other agents’ context. Off: it keeps working, silently.'],
  solo: ['Solo', 'Only soloed sessions may run.'],
  trackArm: ['Arm', 'Who you are talking to: voice and the composer send here.'],
  watch: ['Watch', 'Live’s monitor. In: always stream this session into the dock. Auto: when armed or selected. Off: never.'],
  model: ['Model', 'This session’s model. Subagents can run a different one.'],
  subagentModel: ['Subagent model', 'Default model for everything this group spawns; a member’s strip can override it.'],
  group: ['Group', 'Fold or unfold the crew.'],
  queued: ['Queued', 'Waiting behind the running task. No length is drawn: nobody knows how long it will take.'],
  emptySlot: ['Empty slot', 'Its square stops the session after the current task (soft stop). Double-click to write a task; arm and press ● to speak one.'],
  groupSlot: ['Group slot', 'The children’s tasks in this row; launching fires them all. Amber = stalled.'],
  main: ['Main', 'The whole work: Ledger and Approvals live on its chain.'],
  mainTelemetry: ['Main telemetry', 'Everything into the dock and the ledger stream.'],
  runs: ['Runs', 'See this thread among its siblings over time.'],
  openThread: ['Open thread', 'Open this session’s thread in the main space.'],
  // Context dock.
  resize: ['Resize', 'Drag left to give the context more room; tiles reflow into columns.'],
  wider: ['Wider', 'Grow the dock leftwards for richer compositions; Session/Arrangement give up width.'],
  narrower: ['Narrower', 'Shrink the dock back.'],
  lfold: ['Fold', 'Fold the launcher to its search bar; tiles take the height.'],
  lmore: ['Library', 'The full context library is also in the browser under Context, where SDK widgets appear too.'],
  curate: ['Curate', 'Save a composition of tiles as a context preset; SDK widgets install here.'],
  pin: ['Pin', 'Stop following; keep this view.'],
  close: ['Close', 'Close the tile; it stays in the launcher.'],
  // Devices.
  writeMode: ['Write mode', 'propose · draft · direct (direct needs Write arm).'],
  connect: ['Connect', 'Attach or detach this session’s transport. Detached sessions keep running in the harness and are re-attached with session.resume.'],
  transportMode: ['Transport', 'stdio (spawned child, trusted) · ws (token / 30 s ticket at the upgrade) · remote (through Workcell’s address book).'],
  approvals: ['Approvals', 'Default answer to approval.request: ask you each time · allow for this session · always. Deny is always yours to give.'],
  gateways: ['Gateways', 'Every gateway this work can reach, as chains. Three are named alike: Hermes’ tui_gateway, AIKit’s agency gateway and Actuation’s gateway on frank. Each row states its standing, never assumed.'],
  frameMonitor: ['Frame monitor', 'Live’s MIDI monitor for agents: every frame the gateway sends or receives, per session, in order. Use it to see exactly what a stalled lane last did.'],
  git: ['Git', 'The session’s repository seat. The diagram is the branch against main; the pulsing hollow dot is uncommitted work.'],
  commit: ['Commit', 'When the agent commits: per turn · per task · manual.'],
  push: ['Push', 'off · on land.'],
  land: ['Land', 'Open a draft PR from this branch (checks 2/3 ✓).'],
  dropZone: ['Drop zone', 'Gateways, agents, skillsets, worlds, git. Left to right: through → who → how → where → lands.'],
  then: ['Then', 'Live’s follow action, as hand-off.'],
  outputStyle: ['Output style', 'Per-task override of how the agent writes: register and form.'],
  power: ['Power', 'The agent on, or benched.'],
  input: ['Input', 'Steer the running turn, or queue.'],
  activityBudget: ['Activity · budget', 'Meter: live activity (empty when telemetry is off). Fader: this session’s share of the budget, in turns.'],
  steers: ['Steers', 'Highlight where steering was heard.'],
} as const satisfies Record<string, readonly [string, string]>

/** The `data-i` render of every fixed control: `label|function`. */
export const AGENT_DATA_I = Object.fromEntries(
  Object.entries(AGENT_CONTROL_PAIRS).map(([key, [label, fn]]) => [key, agentDataI(label, fn)]),
) as {[K in keyof typeof AGENT_CONTROL_PAIRS]: string}

/** Title-attribute keys consumed across the shell (pre-oracle names kept as
 * aliases onto the same pairs, so there is still only one source). */
const TIP_SOURCES = {
  browser: 'tBrowser',
  link: 'link',
  tap: 'tap',
  effort: 'effort',
  effortDn: 'effDn',
  effortUp: 'effUp',
  budget: 'budget',
  heartbeat: 'hb',
  quantize: 'quantize',
  tokens: 'tokScope',
  tokIn: 'tokIn',
  tokOut: 'tokOut',
  follow: 'follow',
  position: 'position',
  run: 'play',
  stop: 'stop',
  voice: 'rec',
  steer: 'od',
  writeArm: 'arm',
  handBack: 'handBack',
  capture: 'capture',
  loop: 'loop',
  sessionTab: 'vSession',
  arrangementTab: 'vArr',
  detail: 'tDetail',
  dock: 'tDock',
  spend: 'spend',
  wider: 'wider',
  narrower: 'narrower',
  fold: 'lfold',
} as const satisfies Record<string, keyof typeof AGENT_CONTROL_PAIRS>

/** The `title` render: `label · function`, derived from the same pairs. */
export const AGENT_TRANSPORT_TIPS = Object.fromEntries(
  Object.entries(TIP_SOURCES).map(([alias, key]) => [alias, agentControlTip(AGENT_CONTROL_PAIRS[key][0], AGENT_CONTROL_PAIRS[key][1])]),
) as {[K in keyof typeof TIP_SOURCES]: string}

/** Parametric controls: the oracle renders these with interpolated values.
 * Labels substitute the parameter into the oracle's own label; functions are
 * verbatim oracle text (hardStop/retry keep their mockup template markup
 * where no state source exists yet). */
export const AGENT_DATA_I_FACTORIES = {
  taskN: (n: number | string) => agentDataI(`Task · ${n}`, "${st==='run'?'Running — no end is drawn; its needle is the live edge.':st==='stall'?'Stalled: the needle stopped where its output stopped.':'Done.'} Double-click to open the thread."),
  rowN: (r: number | string) => agentDataI(`Row · ${r}`, 'Launch the row: fires every task in it across sessions — a batch.'),
  skillsetRackN: (n: number | string) => agentDataI(`Skillset · ${n}`, 'A rack of skills; drop it on a session’s chain.'),
  worldBridgeN: (n: number | string) => agentDataI(`World · bridge-${n}`, 'What the session may read (teal) and write (amber).'),
  gatewayN: (n: number | string) => agentDataI(`Gateway · ${n}`, 'Where the session runs: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'),
  gatewayFoldedN: (n: number | string) => agentDataI(`${n} (folded)`, 'A device folded to its title, as in Live.'),
  agentset: (name: string) => agentDataI(`Agentset · ${name}`, 'One chain per member, nested as spawned, each with its model. Click a member to open its thread.'),
  agentFace: (name: string) => agentDataI(`${name} · agent`, 'Compact. Click: expand in the pool. ↗: open its thread full.'),
} as const

/** Control ids the F2 oracle requires on the transport (fidelity.transport.orderHint). */
export const AGENT_TRANSPORT_IDS = [
  'tBrowser', 'tap', 'effort', 'effDn', 'effUp', 'hb', 'tokScope', 'follow',
  'play', 'stop', 'rec', 'od', 'arm', 'loop', 'tDetail', 'tDock', 'vSession', 'vArr',
] as const
