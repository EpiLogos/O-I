// Terminal (manual §17.9): a shell next to your work, in a pane or on the rail. It shows a room of a session space (§10.1): the room of
// the workcell your track works in, live, and it follows the run you select; pinned, it keeps its room. Live's nearest: Utility, a small
// device whose few controls are plain at a glance. The owner of the shell is the shell host's terminal (desktop/cradle/src/terminal/
// TerminalSurface.tsx, src-tauri/src/terminal.rs): an xterm over a real PTY. The room is not the Terminal's: a provider (herdr, tmux, cmux
// or this computer's own terminal) gives it, and the name it gives the room is a label. The picture is the screen: the last lines of the
// shell at the font size, a ruler of columns whose handle sets that size, and a gauge of the lines kept whose handle sets the scrollback.
// The grid it reports (columns × rows) is the pane divided by the cell, the law of xterm's fit; a command an agent ran carries a teal
// tick and the agent's name, a shell that waits for an answer draws in the stall colour, and a provider that does not answer dims the
// screen and says so: the room stays.
//
// Value keys. The owners report (never written from here unless named):
//   light       'lit' | 'dark'   the shell runs; dark once it exited
//   rooms       [{id, name, agent?, lines: [{t, by?, out?, ask?}]}]  the rooms of the workcell's session space, each with the name its
//               provider gives it, the agent whose run it is, and its screen: the last lines, `by` 'agent' for a command an agent ran,
//               `out` for output, `ask` where the shell waits for an answer
//   selected    the room of the run you select (the Terminal follows it); shell  the room you pinned it to (Room)
//   provider    'herdr' | 'tmux' | 'cmux' | 'terminal'; answers  whether the provider answers
//   folder      where the shell started; command  what started ('' is your shell); exited  whether it ended; lines  the lines kept
// Settings, written through the surface that holds the lease: fontSize (points), scrollback (lines), watch (Input: true is Watch only).
// Settings the Terminal holds: follow (true Follows, false Pinned), wrap (wrap long lines).
//   driving     keys reach the room now (Input is Type and the room's keyboard is held); keys  what you type, sent to the room
//               while it drives (a keydown or a paste on the screen, as the terminal's own sequences: keyData)
//   reason      the owner's words for what does not answer (a provider that does not, a takeover it refused)
// A key the owner has not reported is absent, and the view draws "—" for it.
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './widgets__terminal.css'

type V = ViewProps['v']

/** The font size, in points: the owner's xterm starts at 12 (TerminalSurface.tsx:27). The range is the manual's. */
const FONT = {min: 10, max: 18, def: 12} as const
/** The lines kept: 1000 to 100000, 10000 by default (the manual's). */
const SCROLLBACK = {min: 1000, max: 100000, def: 10000} as const
/** The pane the gallery fits the shell to, in pixels. The grid is this divided by the cell (xterm's fit, then terminal_resize). */
const PANE = {w: 700, h: 380} as const
/** A monospace cell: about 0.6 of the size wide and 1.25 high. */
const cellW = (fs: number) => fs * 0.6
const cellH = (fs: number) => Math.round(fs * 1.25)
const gridOf = (fs: number) => ({cols: Math.floor(PANE.w / cellW(fs)), rows: Math.floor(PANE.h / cellH(fs))})

const FOLLOW: readonly Option<string>[] = [{value: 'follows', label: 'Follows', does: 'Move to the room of the run you select.'},
  {value: 'pinned', label: 'Pinned', does: 'Keep this room while you select elsewhere.'}]
const INPUT: readonly Option<string>[] = [{value: 'type', label: 'Type', does: 'Keys reach the shell.'},
  {value: 'watch', label: 'Watch only', does: 'Keys do not reach the shell: read a run without touching it.'}]
const PROVIDER_WORD: Record<string, string> = {herdr: 'herdr', tmux: 'tmux', cmux: 'cmux', terminal: 'this terminal'}

interface Line {readonly t: string; /** Typed by an agent. */ readonly by?: 'agent'; /** Output, not a command. */ readonly out?: boolean; /** The shell waits for an answer here. */ readonly ask?: boolean}
/** A room; `read` false where its screen has not been read (a room that is not shown, or a terminal whose surface publishes no text). */
interface Room {readonly id: string; readonly name: string; readonly agent?: string; readonly lines: readonly Line[]; readonly read: boolean}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
/** The rooms the owner reports, kept where they have a shape; undefined when it reports none. */
function roomsOf(v: V): Room[] | undefined {
  const raw = json<unknown>(v, 'rooms', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((r): Room[] => rec(r) && typeof r.id === 'string' && typeof r.name === 'string' ? [{id: r.id, name: r.name, agent: typeof r.agent === 'string' ? r.agent : undefined,
    lines: (Array.isArray(r.lines) ? r.lines : []).flatMap((l): Line[] => rec(l) && typeof l.t === 'string' ? [{t: l.t, by: l.by === 'agent' ? 'agent' : undefined, out: l.out === true, ask: l.ask === true}] : []),
    read: Array.isArray(r.lines)}] : [])
}
const follows = (v: V) => boolOf(v, 'follow') !== false
const roomOf = (v: V): Room | undefined => { const id = follows(v) ? strOf(v, 'selected') : strOf(v, 'shell'); return roomsOf(v)?.find(r => r.id === id) }
const waits = (r: Room | undefined) => !!r && r.lines.some(l => l.ask)
const silent = (v: V) => boolOf(v, 'answers') === false
const lightOf = (p: ViewProps): LightState => { const s = strOf(p.owner ?? p.v, 'light'); return s === 'lit' || s === 'dark' ? s : 'unknown' }
const linesWord = (x: number) => (x >= 10000 ? `${Math.round(x / 1000)}k` : String(Math.round(x)))
const shellName = (v: V) => (!has(v, 'command') ? undefined : strOf(v, 'command') || 'your shell')
const providerWord = (v: V) => { const x = strOf(v, 'provider'); return x === undefined ? undefined : PROVIDER_WORD[x] ?? x }

/** The screen in the well: the last lines that fit at the font size, newest at the foot. Wrap off clips lines at the well, as a window
 * onto a wider screen; Wrap on folds them. `ruler`: columns along the top, handle 1 on column 10. `gauge`: the lines kept at the right,
 * handle 2 on the capacity. */
function Screen({p, w, h, ruler, gauge}: {p: ViewProps; w: number; h: number; ruler: boolean; gauge: boolean}) {
  const v = p.v, fs = numOf(v, 'fontSize') ?? FONT.def, cw = cellW(fs), ch = cellH(fs), room = roomOf(v)
  const PAD = 6, top = ruler ? 17 : 5, right = gauge ? 16 : 3
  const fst = st(p, 'fontSize'), sst = st(p, 'scrollback')
  if (!room?.read) return <text x={PAD} y={h / 2} className="dp-axis">No reading: shell</text>
  const cols = Math.max(1, Math.floor((w - PAD - right) / cw)), rows = Math.max(1, Math.floor((h - top - 5) / ch))
  const wrap = boolOf(v, 'wrap') !== false
  const folded: Line[] = wrap ? room.lines.flatMap(l => (l.t.length <= cols ? [l] : Array.from({length: Math.ceil(l.t.length / cols)}, (_, i) => ({...l, t: l.t.slice(i * cols, (i + 1) * cols), by: i ? undefined : l.by})))) : [...room.lines]
  const shown = folded.slice(-rows), asks = waits(room), exited = boolOf(v, 'exited') === true, quiet = silent(v)
  const foot = (i: number) => h - 5 - (shown.length - 1 - i) * ch
  const last = shown[shown.length - 1]
  const cap = numOf(v, 'scrollback'), kept = cap === undefined ? undefined : Math.min(numOf(v, 'lines') ?? 0, cap)
  const gT = 22, gB = h - 6, gy = (n: number) => gB - Math.log(n / SCROLLBACK.min) / Math.log(SCROLLBACK.max / SCROLLBACK.min) * (gB - gT)
  return <g>
    {asks && <rect x={0.5} y={0.5} width={w - 1} height={h - 1} className="wt-ask-edge" />}
    {ruler && <path className="wt-rule" d={`M${PAD} 13H${Math.min(PAD + cols * cw, w - 44)}${Array.from({length: cols + 1}, (_, c) => (PAD + c * cw < w - 44 ? `M${PAD + c * cw} 13v${c % 10 === 0 ? -5 : -3}` : '')).join('')}`} />}
    <g opacity={quiet ? .4 : 1}>
      {shown.map((line, i) => <g key={i}>
        {line.by === 'agent' && <rect x={1} y={foot(i) - ch + 2} width={2} height={ch - 4} className="wt-tick" />}
        <text x={PAD} y={foot(i) - Math.round(ch * 0.27)} fontSize={fs} className="wt-mono" data-out={line.out ? 'true' : undefined} data-ask={line.ask ? 'true' : undefined}>{line.t.slice(0, cols)}</text>
      </g>)}
      {!exited && !quiet && last && last.t.length < cols && <rect x={PAD + last.t.length * cw} y={foot(shown.length - 1) - ch + 1} width={cw} height={ch - 2} className="wt-cursor" data-ask={last.ask ? 'true' : undefined} />}
    </g>
    {quiet && <text x={w - right - 4} y={top + 10} textAnchor="end" className="dp-ink" style={{fill: 'var(--stall)'}}>{providerWord(v) ?? 'the provider'} does not answer</text>}
    {gauge && cap !== undefined && <g>
      <rect x={w - 11} y={gT} width={5} height={gB - gT} className="wt-track" />
      {kept !== undefined && <rect x={w - 11} y={gy(Math.max(kept, SCROLLBACK.min))} width={5} height={gB - gy(Math.max(kept, SCROLLBACK.min))} className="wt-kept" />}
      <Handle x={w - 8.5} y={gy(clampTo(SCROLLBACK.min, SCROLLBACK.max, cap))} n={2} label="Scrollback" does={`Drag up or down: how many lines the Terminal keeps.${sst.disabled ? ` ${sst.disabled}` : ''}`} shape="square"
        onDrag={sst.disabled ? undefined : (_, y) => p.set('scrollback', Math.round(clampTo(SCROLLBACK.min, SCROLLBACK.max, SCROLLBACK.min * Math.pow(SCROLLBACK.max / SCROLLBACK.min, (gB - y) / (gB - gT))) / 100) * 100)}
        onReset={sst.disabled ? undefined : () => p.set('scrollback', SCROLLBACK.def)} />
    </g>}
    {ruler && <Handle x={PAD + 10 * cw} y={8} n={1} label="Font size" does={`Drag along the ruler: a wider column is a larger font size.${fst.disabled ? ` ${fst.disabled}` : ''}`} shape="ring"
      onDrag={fst.disabled ? undefined : x => p.set('fontSize', clampTo(FONT.min, FONT.max, Math.round((x - PAD) / 6)))} onReset={fst.disabled ? undefined : () => p.set('fontSize', FONT.def)} />}
  </g>
}

/** A key pressed on a driving screen as the bytes a terminal sends for it (the VT sequences xterm.js sends: its Keyboard evaluation,
 * which the cradle's Computer view hands the room through the same takeover client): a printed character as itself, Enter, Backspace,
 * Tab, Escape, the arrows, Home, End and Delete, and Control with a letter as its control code. Undefined for a key that sends nothing
 * here (a modifier alone, or a ⌘ shortcut, which stays the app's). */
export function keyData(event: {key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean}): string | undefined {
  if (event.metaKey) return undefined
  const named: Record<string, string> = {Enter: '\r', Backspace: '\x7f', Tab: '\t', Escape: '\x1b', ArrowUp: '\x1b[A', ArrowDown: '\x1b[B',
    ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D', Home: '\x1b[H', End: '\x1b[F', Delete: '\x1b[3~'}
  if (named[event.key]) return named[event.key]
  if (event.key.length !== 1) return undefined
  if (event.ctrlKey && /^[a-z@[\]^_\\]$/i.test(event.key)) return String.fromCharCode(event.key.toUpperCase().charCodeAt(0) & 0x1f)
  return event.altKey ? `\x1b${event.key}` : event.key
}
const driving = (v: V) => boolOf(v, 'driving') === true
/** The screen takes keys while the room drives: a keydown or a paste goes to the room as `keys`, never to the notes or the app. */
const keysOn = (p: ViewProps) => (driving(p.v) ? {tabIndex: 0, 'data-driving': 'true', 'aria-label': 'Keys go to the room',
  onKeyDown: (event: {key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; preventDefault: () => void; stopPropagation: () => void}) => {
    const data = keyData(event)
    if (data === undefined) return
    event.preventDefault(); event.stopPropagation(); p.set('keys', data)
  },
  onPaste: (event: {clipboardData: {getData: (kind: string) => string} | null; preventDefault: () => void}) => {
    const text = event.clipboardData?.getData('text') ?? ''
    if (text) { event.preventDefault(); p.set('keys', text) }
  }} : {})

const gridWord = (v: V) => { const fs = numOf(v, 'fontSize'); if (fs === undefined) return NONE; const g = gridOf(fs); return `${g.cols}×${g.rows}` }
const DISPLAY_DOES = 'The last lines of the shell at the font size. A teal mark stands by a command an agent ran. Orange: the shell waits for an answer.'

/** The controls the views share, so that a change in one view shows in the others. */
function controls(p: ViewProps) {
  const v = p.v, rooms = roomsOf(v)
  return {
    follow: <Radio {...st(p, 'follow')} label="Follow" does="Follows: the Terminal moves to the room of the run you select. Pinned: it keeps its room." value={has(v, 'follow') ? (follows(v) ? 'follows' : 'pinned') : ''}
      options={FOLLOW} stack onChange={x => { p.set('follow', x === 'follows'); if (x === 'pinned' && roomOf(v)) p.set('shell', roomOf(v)!.id) }} />,
    input: <Radio {...st(p, 'watch')} label="Input" does="Type: keys reach the shell. Watch only: they do not." value={has(v, 'watch') ? (boolOf(v, 'watch') ? 'watch' : 'type') : ''} options={INPUT} stack
      onChange={x => p.set('watch', x === 'watch')} />,
    font: <Dial {...st(p, 'fontSize')} label="Font size" does="The size of the text, in points. A larger size fits fewer columns and rows." value={numOf(v, 'fontSize') ?? NaN} def={FONT.def}
      scale={{min: FONT.min, max: FONT.max, step: 1}} format={x => `${x} pt`} onChange={x => p.set('fontSize', x)} />,
    wrap: <Toggle {...st(p, 'wrap')} label="Wrap" does="On: long lines fold onto the next. Off: they run past the edge." on={boolOf(v, 'wrap') === true} unknown={boolOf(v, 'wrap') === undefined} onChange={x => p.set('wrap', x)} />,
    scrollback: <Dial {...st(p, 'scrollback')} label="Scrollback" does="How many lines the Terminal keeps. The oldest lines go first." value={numOf(v, 'scrollback') ?? NaN} def={SCROLLBACK.def}
      scale={{min: SCROLLBACK.min, max: SCROLLBACK.max, log: true}} format={linesWord} onChange={x => p.set('scrollback', Math.round(x / 100) * 100)} />,
    room: <Chooser {...st(p, follows(v) ? 'selected' : 'shell')} wide label="Room" does="The room of the workcell's session space the Terminal shows. Following, it is the room of the run you select."
      value={roomOf(v)?.id ?? ''} options={(rooms ?? []).map(r => ({value: r.id, label: r.name}))} onChange={x => p.set('shell', x)}
      disabled={follows(v) ? 'Follow is on: the room is the selected run\'s. Pin the Terminal to choose one.' : st(p, 'shell').disabled} />,
    command: <TextField {...st(p, 'command')} wide label="Command" does="What starts in the Terminal. Empty starts your shell." placeholder="your shell" value={strOf(v, 'command') ?? ''} onChange={x => p.set('command', x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'widgets:terminal',
  title: 'Terminal',
  kind: 'instrument',
  defaults: {
    light: 'lit', follow: true, selected: 'test', shell: 'test', watch: true, fontSize: FONT.def, scrollback: SCROLLBACK.def, wrap: true,
    provider: 'herdr', answers: true, folder: '/Users/admin/Central/worktrees/env-1/o-i', command: '', lines: 3812, exited: false,
    rooms: JSON.stringify([
      {id: 'lead', name: 'env-1 · lead', agent: 'Fizz · lead', lines: [
        {t: '$ git status -sb', by: 'agent'}, {t: '## port/bridge-2...origin/port/bridge-2', out: true}, {t: ' M src/shell/widgets.tsx', out: true},
        {t: '$ git diff --stat', by: 'agent'}, {t: ' 1 file changed, 12 insertions(+)', out: true}, {t: '$ '}]},
      {id: 'test', name: 'env-1 · test', agent: 'test', lines: [
        {t: '$ git pull --ff-only', by: 'agent'}, {t: 'Already up to date.', out: true},
        {t: '$ npx tsc --noEmit', by: 'agent'}, {t: '$ npm test -- widgets', by: 'agent'},
        {t: 'ok   sessions', out: true}, {t: 'ok   agents', out: true}, {t: 'ok   terminal', out: true}, {t: 'ok   files', out: true},
        {t: 'ok   web', out: true}, {t: 'ok   graph', out: true}, {t: 'run  frames', out: true}, {t: '$ '}]},
      {id: 'fixture', name: 'env-1 · fixture-gen', agent: 'fixture-gen', lines: [
        {t: '$ git status -sb', by: 'agent'}, {t: '## port/bridge-2', out: true}, {t: '?? src/agent/agentShellFixture.old.tsx', out: true},
        {t: '$ rm -i src/agent/agentShellFixture.old.tsx', by: 'agent'}, {t: 'remove src/agent/agentShellFixture.old.tsx? ', ask: true}]},
      {id: 'own', name: 'env-1 · o-i', lines: [{t: '$ cd ~/Central/Work/O-I'}, {t: '$ ls'}, {t: 'desktop  docs  packages', out: true}, {t: '$ '}]}]),
  },
  fixtures: {
    'Follows a test run': {},
    'A shell that waits': {selected: 'fixture'},
    'Your own shell': {follow: false, shell: 'own', watch: false},
    'The provider does not answer': {answers: false},
  },

  folded: p => <Folded title="Terminal" light={lightOf(p)} readings={[roomOf(p.v)?.name ?? NONE, shellName(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => {
    const c = controls(p)
    return <Panel title="Terminal" view="compact" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select} hint="Show every setting in the pool">
      <Section width={152}>
        <Display w={140} h={146} label="Screen" does={DISPLAY_DOES} corner={gridWord(p.v)}>
          <Screen p={p} w={140} h={146} ruler={false} gauge={false} />
        </Display>
      </Section>
      <Section label="Macros" cols={2}>{c.follow}{c.input}{c.font}{c.wrap}</Section>
    </Panel>
  },

  whole: p => {
    const c = controls(p), room = roomOf(p.v)
    return <Panel title="Terminal" view="whole" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={168}>
          <Display w={156} h={146} label="Screen" does={`${DISPLAY_DOES} Drag handle 1 for the font size and handle 2 for the scrollback.`} corner={gridWord(p.v)}>
            <Screen p={p} w={156} h={146} ruler gauge />
          </Display>
        </Section>
        <Section label="Shell" cols={2} grow>
          <div className="wt-span">{c.room}</div>
          <Readout label="provider" does={silent(p.v) ? 'The provider of the room does not answer. The room stays; the screen shows its last lines.' : 'Which provider shows the room: herdr, tmux, cmux or this terminal.'}
            value={providerWord(p.v)} tone={silent(p.v) ? 'stall' : boolOf(p.v, 'answers') ? 'green' : undefined} />
          {c.follow}
          <div className="wt-span">{c.command}</div>
        </Section>
      </Band>
      <Band>
        <Section label="Input" width={80}>{c.input}</Section>
        <Section label="Display" cols={3} grow>
          {c.scrollback}
          {c.font}
          {c.wrap}
          <Readout label="agent" does={room?.agent ? 'The agent whose run the room is. A command it ran shows as its own.' : 'The room is no agent\'s run.'} value={room ? room.agent ?? 'none' : undefined} tone={room?.agent ? 'value' : undefined} />
          <Readout label="answer" does="Whether the shell waits for an answer, such as a yes or a no. Type it in the shell." value={room ? (waits(room) ? 'waits' : 'none') : undefined} tone={waits(room) ? 'stall' : undefined} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => {
    const v = p.v, fs = numOf(v, 'fontSize') ?? FONT.def, cw = cellW(fs), ch = cellH(fs), room = roomOf(v), grid = gridOf(fs)
    const cap = numOf(v, 'scrollback'), kept = cap === undefined ? undefined : Math.min(numOf(v, 'lines') ?? 0, cap), ask = waits(room), quiet = silent(v), exited = boolOf(v, 'exited') === true
    if (!room) return <div className="wt-pane"><header className="wt-bar"><span data-tone="dim">No reading: shell</span></header></div>
    const wrap = boolOf(v, 'wrap') !== false
    const lines: Line[] = []
    for (const l of room.read ? room.lines : [{t: 'No reading: shell', out: true}]) {
      if (!wrap || l.t.length <= grid.cols) lines.push(wrap ? l : {...l, t: l.t.slice(0, grid.cols)})
      else for (let i = 0; i < l.t.length; i += grid.cols) lines.push({...l, t: l.t.slice(i, i + grid.cols), by: i ? undefined : l.by})
    }
    const screen = lines.slice(-grid.rows)
    return <div className="wt-pane">
      <header className="wt-bar">
        <span data-tone="dim">{follows(v) ? 'follows' : 'pinned'}</span><b>{room.name}</b>
        {room.agent && <span data-tone="value">{room.agent}</span>}
        <span data-tone={quiet ? 'stall' : 'dim'}>{providerWord(v) ?? NONE}{quiet ? ' does not answer' : ''}</span>
        <span className="wt-fill" data-tone="dim">{gridWord(v)} · {fs} pt</span>
      </header>
      <div className="wt-body" data-quiet={quiet ? 'true' : undefined}>
        <div className="wt-gutter" style={{fontSize: 9.5, lineHeight: `${ch}px`}}>{screen.map((l, i) => <div key={i}>{l.by === 'agent' ? room.agent ?? 'agent' : ' '}</div>)}</div>
        <div className="wt-screen" style={{width: grid.cols * cw, height: grid.rows * ch, fontSize: fs, lineHeight: `${ch}px`}} {...keysOn(p)}>
          {screen.map((l, i) => <div key={i} data-out={l.out ? 'true' : undefined} data-ask={l.ask ? 'true' : undefined}>
            {l.t || ' '}{i === screen.length - 1 && !exited && !quiet && <span className="wt-cur" data-ask={l.ask ? 'true' : undefined} />}
          </div>)}
        </div>
        {cap !== undefined && kept !== undefined && <div className="wt-gauge" style={{height: grid.rows * ch}} aria-label="Lines kept"><i style={{height: `${Math.min(100, kept / cap * 100)}%`}} /></div>}
      </div>
      <footer className="wt-bar wt-bar--foot">
        <span>{shellName(v) ?? NONE}</span>
        <span data-tone="dim">{strOf(v, 'folder') ?? NONE}</span>
        {exited && <span data-tone="dim">exited</span>}
        {ask && <span data-tone="stall">waits for an answer</span>}
        {strOf(v, 'reason') && <span data-tone="stall">{strOf(v, 'reason')}</span>}
        <span className="wt-fill" data-tone="dim">{driving(v) ? 'typing · ' : boolOf(v, 'watch') ? 'watch only · ' : ''}{kept === undefined || cap === undefined ? NONE : `${linesWord(kept)} of ${linesWord(cap)} lines`}</span>
      </footer>
    </div>
  },

  widget: p => {
    const v = p.v, room = roomOf(v), asks = waits(room)
    return <Tile title="Terminal" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="wt-tile" {...keysOn(p)}>
        <Display w={266} h={82} label="Screen" does={DISPLAY_DOES}>
          <Screen p={p} w={266} h={82} ruler={false} gauge={false} />
        </Display>
        <p className="wt-tile-line" data-ask={asks ? 'true' : undefined}
          data-i={follows(v) ? 'Following|The tile follows the agent you select.' : 'Pinned|The tile keeps its room.'}>
          <span>{follows(v) ? 'following' : 'pinned'}</span> <b>{room ? room.agent ?? room.name : NONE}</b>{asks ? <em> · waits for an answer</em> : null}
        </p>
      </div>
    </Tile>
  },
}
