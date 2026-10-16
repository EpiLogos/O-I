// Terminal (manual §17.11 and §23.3): a shell next to your work, in a pane or on the rail. Live's nearest: Utility, a small device
// whose few controls are plain at a glance. The owner is the shell host's terminal (desktop/cradle/src/terminal/TerminalSurface.tsx,
// src-tauri/src/terminal.rs): an xterm over a real PTY, started in a folder with the login shell or a carried command. The picture
// is the screen: the last lines of the shell at the text size, a ruler of columns whose handle sets that size, and a gauge of the
// lines kept whose handle sets the scrollback. The grid it reports (columns × rows) is the pane divided by the cell, the law of
// xterm's fit; a command an agent ran carries a teal tick, and a shell that waits for an answer draws in the stall colour.
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Readout, Section, TextField, Tile, Toggle, type LightState} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './widgets__terminal.css'

type V = ViewProps['v']

/** The owner's text size: xterm `fontSize:12` (TerminalSurface.tsx:27), in pixels. The range is the device's. */
const FONT = {min: 10, max: 18, def: 12} as const
/** The owner's scrollback: xterm `scrollback:5000` (TerminalSurface.tsx:27). The range is the device's. */
const SCROLLBACK = {min: 1000, max: 100000, def: 5000} as const
/** The pane the gallery fits the shell to, in pixels. The grid is this divided by the cell (xterm's fit, then terminal_resize). */
const PANE = {w: 700, h: 380} as const
/** A monospace cell: about 0.6 of the size wide and 1.25 high. */
const cellW = (fs: number) => fs * 0.6
const cellH = (fs: number) => Math.round(fs * 1.25)
const gridOf = (fs: number) => ({cols: Math.floor(PANE.w / cellW(fs)), rows: Math.floor(PANE.h / cellH(fs))})

interface Line {readonly t: string; /** Typed by an agent. */ readonly by?: 'agent'; /** Output, not a command. */ readonly out?: boolean; /** The shell waits for an answer here. */ readonly ask?: boolean}
interface Shell {readonly id: string; readonly name: string; readonly short: string; readonly agent: boolean; readonly lines: readonly Line[]}

/** The live shells of the fixture. Names are the Session grid's lanes under Fizz (dlw__session-grid.tsx); the commands are this repository's. */
const SHELLS: readonly Shell[] = [
  {id: 'lead', name: 'Fizz · lead', short: 'lead', agent: true, lines: [
    {t: '$ git status -sb', by: 'agent'}, {t: '## port/bridge-2...origin/port/bridge-2', out: true}, {t: ' M src/shell/widgets.tsx', out: true},
    {t: '$ git diff --stat', by: 'agent'}, {t: ' 1 file changed, 12 insertions(+)', out: true}, {t: '$ '}]},
  {id: 'test', name: 'test', short: 'test', agent: true, lines: [
    {t: '$ git pull --ff-only', by: 'agent'}, {t: 'Already up to date.', out: true},
    {t: '$ npx tsc --noEmit', by: 'agent'}, {t: '$ npm test -- widgets', by: 'agent'},
    {t: 'ok   sessions', out: true}, {t: 'ok   agents', out: true}, {t: 'ok   terminal', out: true}, {t: 'ok   files', out: true},
    {t: 'ok   web', out: true}, {t: 'ok   graph', out: true}, {t: 'ok   diff', out: true}, {t: 'run  frames', out: true}, {t: '$ '}]},
  {id: 'fixture', name: 'fixture-gen', short: 'fixture', agent: true, lines: [
    {t: '$ git status -sb', by: 'agent'}, {t: '## port/bridge-2', out: true}, {t: '?? src/agent/agentShellFixture.old.tsx', out: true},
    {t: '$ rm -i src/agent/agentShellFixture.old.tsx', by: 'agent'}, {t: 'remove src/agent/agentShellFixture.old.tsx? ', ask: true}]},
  {id: 'own', name: 'Terminal · yours', short: 'yours', agent: false, lines: [
    {t: '$ cd ~/Central/Work/O-I'}, {t: '$ ls'}, {t: 'desktop  docs  packages', out: true}, {t: '$ '}]},
]

/** The lines a shell shows: Clear hides what was on the screen above the prompt. */
const linesOf = (v: V, s: Shell): readonly Line[] => { const cut = Number(v[`cleared:${s.id}`]); return s.lines.slice(Number.isFinite(cut) ? Math.min(cut, s.lines.length - 1) : 0) }
const shellOf = (v: V): Shell | undefined => SHELLS.find(s => s.id === (on(v, 'follow') ? str(v, 'selected') : str(v, 'shell')))
const waits = (s: Shell | undefined) => !!s && s.lines.some(l => l.ask)
const light = (v: V) => str(v, 'light') as LightState
const folderName = (v: V) => str(v, 'folder').split('/').filter(Boolean).pop() ?? str(v, 'folder')
const linesWord = (x: number) => (x >= 10000 ? `${Math.round(x / 1000)}k` : String(Math.round(x)))
const processWord = (v: V) => (str(v, 'command') ? (on(v, 'exited') ? 'Login command exited' : 'Login command') : on(v, 'exited') ? 'Shell exited' : 'Local shell')

/** The screen in the well: the last lines that fit at the text size, newest at the foot. Lines clip at the well, as a window onto
 * a wider screen. `ruler`: columns along the top, handle 1 on column 10. `gauge`: the lines kept at the right, handle 2 on the capacity. */
function Screen({v, set, w, h, ruler, gauge}: {v: V; set?: ViewProps['set']; w: number; h: number; ruler: boolean; gauge: boolean}) {
  const fs = num(v, 'fontSize'), cw = cellW(fs), ch = cellH(fs), shell = shellOf(v)
  const PAD = 6, top = ruler ? 17 : 5, right = gauge ? 16 : 3
  if (!shell) return <text x={PAD} y={h / 2} className="dp-axis">No reading: shell</text>
  const cols = Math.max(1, Math.floor((w - PAD - right) / cw)), rows = Math.max(1, Math.floor((h - top - 5) / ch))
  const shown = linesOf(v, shell).slice(-rows), asks = waits(shell), exited = on(v, 'exited')
  const foot = (i: number) => h - 5 - (shown.length - 1 - i) * ch
  const last = shown[shown.length - 1]
  const cap = num(v, 'scrollback'), kept = Math.min(num(v, 'lines'), cap)
  const gT = 22, gB = h - 6, gy = (n: number) => gB - Math.log(n / SCROLLBACK.min) / Math.log(SCROLLBACK.max / SCROLLBACK.min) * (gB - gT)
  return <g>
    {asks && <rect x={0.5} y={0.5} width={w - 1} height={h - 1} className="wt-ask-edge" />}
    {ruler && <path className="wt-rule" d={`M${PAD} 13H${Math.min(PAD + cols * cw, w - 44)}${Array.from({length: cols + 1}, (_, c) => (PAD + c * cw < w - 44 ? `M${PAD + c * cw} 13v${c % 10 === 0 ? -5 : -3}` : '')).join('')}`} />}
    {shown.map((line, i) => <g key={i}>
      {line.by === 'agent' && <rect x={1} y={foot(i) - ch + 2} width={2} height={ch - 4} className="wt-tick" />}
      <text x={PAD} y={foot(i) - Math.round(ch * 0.27)} fontSize={fs} className="wt-mono" data-out={line.out ? 'true' : undefined} data-ask={line.ask ? 'true' : undefined}>{line.t.slice(0, cols)}</text>
    </g>)}
    {!exited && last && last.t.length < cols && <rect x={PAD + last.t.length * cw} y={foot(shown.length - 1) - ch + 1} width={cw} height={ch - 2} className="wt-cursor" data-ask={last.ask ? 'true' : undefined} />}
    {gauge && <g>
      <rect x={w - 11} y={gT} width={5} height={gB - gT} className="wt-track" />
      <rect x={w - 11} y={gy(Math.max(kept, SCROLLBACK.min))} width={5} height={gB - gy(Math.max(kept, SCROLLBACK.min))} className="wt-kept" />
      {set && <Handle x={w - 8.5} y={gy(cap)} n={2} label="Scrollback" does="Drag up or down: how many lines the Terminal keeps." shape="square"
        onDrag={(_, y) => set('scrollback', Math.round(clampTo(SCROLLBACK.min, SCROLLBACK.max, SCROLLBACK.min * Math.pow(SCROLLBACK.max / SCROLLBACK.min, (gB - y) / (gB - gT))) / 100) * 100)}
        onReset={() => set('scrollback', SCROLLBACK.def)} />}
    </g>}
    {set && ruler && <Handle x={PAD + 10 * cw} y={8} n={1} label="Text size" does="Drag along the ruler: a wider column is a larger text size." shape="ring"
      onDrag={x => set('fontSize', clampTo(FONT.min, FONT.max, Math.round((x - PAD) / 6)))} onReset={() => set('fontSize', FONT.def)} />}
  </g>
}

const gridWord = (v: V) => { const g = gridOf(num(v, 'fontSize')); return `${g.cols}×${g.rows}` }
const DISPLAY_DOES = 'The last lines of the shell at the text size. A teal mark stands by a command an agent ran. Orange: the shell waits for an answer.'

/** The controls the views share, so that a change in one view shows in the others. */
function controls(p: ViewProps) {
  const fs = num(p.v, 'fontSize')
  return {
    follow: <Toggle label="Follow" does="On: the Terminal moves to the shell of the session you select. Off: it keeps its shell." on={on(p.v, 'follow')}
      onChange={x => { p.set('follow', x); if (!x) p.set('shell', shellOf(p.v)?.id ?? 'own') }} />,
    watch: <Toggle label="Watch" does="On: keys do not reach the shell. Use it to read a run without touching it." on={on(p.v, 'watch')} onChange={x => p.set('watch', x)} />,
    font: <Dial label="Text" does="The size of the text, in pixels. A larger size fits fewer columns and rows." value={fs} def={FONT.def} scale={{min: FONT.min, max: FONT.max, step: 1}}
      format={x => `${x} px`} onChange={x => p.set('fontSize', x)} />,
    scrollback: <Dial label="Scrollback" does="How many lines the Terminal keeps. The oldest lines go first." value={num(p.v, 'scrollback')} def={SCROLLBACK.def}
      scale={{min: SCROLLBACK.min, max: SCROLLBACK.max, log: true}} format={linesWord} onChange={x => p.set('scrollback', Math.round(x / 100) * 100)} />,
    clear: <Action label="Clear" does="Clear the screen and the lines kept. The shell keeps running." onPress={() => { const s = shellOf(p.v); if (s) { p.set(`cleared:${s.id}`, s.lines.length - 1); p.set('lines', 1) } }} />,
  }
}

export const design: DesignedDevice = {
  id: 'widgets:terminal',
  title: 'Terminal',
  kind: 'instrument',
  defaults: {
    light: 'lit', follow: true, selected: 'test', shell: 'test', watch: true, fontSize: FONT.def, scrollback: SCROLLBACK.def,
    folder: '/Users/admin/Central/worktrees/env-1/o-i', command: '', lines: 3812, exited: false,
  },
  fixtures: {
    'Follows a test run': {},
    'A shell that waits': {selected: 'fixture'},
    'Your own shell': {follow: false, shell: 'own', watch: false},
  },

  folded: p => <Folded title="Terminal" light={light(p.v)} readings={[folderName(p.v), shellOf(p.v)?.short ?? '—']} onUnfold={p.nav.unfold} />,

  compact: p => {
    const c = controls(p)
    return <Panel title="Terminal" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select} hint="Show every setting in the pool">
      <Section width={152}>
        <Display w={140} h={146} label="Screen" does={DISPLAY_DOES} corner={gridWord(p.v)}>
          <Screen v={p.v} set={p.set} w={140} h={146} ruler gauge={false} />
        </Display>
      </Section>
      <Section label="Macros" cols={2}>{c.follow}{c.watch}{c.font}{c.clear}</Section>
    </Panel>
  },

  whole: p => {
    const c = controls(p), shell = shellOf(p.v), kept = Math.min(num(p.v, 'lines'), num(p.v, 'scrollback'))
    return <Panel title="Terminal" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={168}>
          <Display w={156} h={146} label="Screen" does={`${DISPLAY_DOES} Drag handle 1 for the text size and handle 2 for the scrollback.`} corner={gridWord(p.v)}>
            <Screen v={p.v} set={p.set} w={156} h={146} ruler gauge />
          </Display>
        </Section>
        <Section label="Run" cols={2} width={104}>{c.follow}{c.watch}{c.clear}</Section>
        <Section label="Text" cols={2} width={124}>{c.font}{c.scrollback}</Section>
      </Band>
      <Band>
        <Section label="Start" width={176}>
          <TextField wide label="Folder" does="The folder where the next shell starts. A shell that runs keeps its folder." value={str(p.v, 'folder')} onChange={x => p.set('folder', x)} />
          <TextField wide label="Command" does="What starts in the Terminal. Empty starts your login shell." placeholder="login shell" value={str(p.v, 'command')} onChange={x => p.set('command', x)} />
        </Section>
        <Section label="Shell" width={112}>
          <Chooser wide does="The shell the Terminal shows. With Follow on, it is the shell of the session you select." value={shell?.id ?? ''}
            options={SHELLS.map(s => ({value: s.id, label: s.name}))} onChange={x => p.set('shell', x)}
            disabled={on(p.v, 'follow') ? 'Follow is on. Turn it off to choose a shell.' : undefined} />
          <Readout label="question" does="The shell asked a question and waits for the answer, such as a yes or a no." value={waits(shell) ? 'open' : 'none'} tone={waits(shell) ? 'stall' : undefined} />
        </Section>
        <Section label="Readings" grow>
          <Readout label="screen" does="Columns × rows that fit the pane at this text size." value={gridWord(p.v)} />
          <Readout label="lines kept" does="Lines in the scrollback now." value={linesWord(kept)} tone="value" />
          <Readout label="process" does="What runs in the Terminal." value={processWord(p.v)} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => {
    const fs = num(p.v, 'fontSize'), cw = cellW(fs), ch = cellH(fs), shell = shellOf(p.v), grid = gridOf(fs)
    const cap = num(p.v, 'scrollback'), kept = Math.min(num(p.v, 'lines'), cap), ask = waits(shell)
    if (!shell) return <div className="wt-pane"><header className="wt-bar"><span data-tone="dim">No reading: shell</span></header></div>
    const wrapped: Line[] = []
    for (const l of linesOf(p.v, shell)) {
      if (l.t.length <= grid.cols) wrapped.push(l)
      else for (let i = 0; i < l.t.length; i += grid.cols) wrapped.push({...l, t: l.t.slice(i, i + grid.cols), by: i ? undefined : l.by})
    }
    const screen = wrapped.slice(-grid.rows)
    return <div className="wt-pane">
      <header className="wt-bar">
        <span data-tone="dim">{on(p.v, 'follow') ? 'follows' : 'pinned'}</span><b data-tone={shell.agent ? 'value' : undefined}>{shell.name}</b>
        <span className="wt-fill" data-tone="dim">{gridWord(p.v)} · {fs} px</span>
      </header>
      <div className="wt-body">
        <div className="wt-gutter" style={{fontSize: 9.5, lineHeight: `${ch}px`}}>{screen.map((l, i) => <div key={i}>{l.by === 'agent' ? shell.short : ' '}</div>)}</div>
        <div className="wt-screen" style={{width: grid.cols * cw, height: grid.rows * ch, fontSize: fs, lineHeight: `${ch}px`}}>
          {screen.map((l, i) => <div key={i} data-out={l.out ? 'true' : undefined} data-ask={l.ask ? 'true' : undefined}>
            {l.t || ' '}{i === screen.length - 1 && !on(p.v, 'exited') && <span className="wt-cur" data-ask={l.ask ? 'true' : undefined} />}
          </div>)}
        </div>
        <div className="wt-gauge" style={{height: grid.rows * ch}} aria-label="Lines kept"><i style={{height: `${Math.min(100, kept / cap * 100)}%`}} /></div>
      </div>
      <footer className="wt-bar wt-bar--foot">
        <span>{str(p.v, 'command') || str(p.v, 'folder')}</span>
        <span data-tone={on(p.v, 'exited') ? 'dim' : undefined}>{processWord(p.v)}</span>
        {ask && <span data-tone="stall">Waits for an answer</span>}
        <span className="wt-fill" data-tone="dim">{on(p.v, 'watch') ? 'Watch only · ' : ''}{linesWord(kept)} of {linesWord(cap)} lines</span>
      </footer>
    </div>
  },

  widget: p => {
    const shell = shellOf(p.v), asks = waits(shell)
    return <Tile title="Terminal" light={light(p.v)} span={2} onFull={p.nav.full}>
      <Display w={186} h={98} label="Screen" does={DISPLAY_DOES} corner={gridWord(p.v)}>
        <Screen v={p.v} w={186} h={98} ruler={false} gauge={false} />
      </Display>
      <div className="wt-side">
        <Readout label="shell" does={on(p.v, 'follow') ? 'The shell the tile shows. The tile follows the session you select.' : 'The shell the tile shows. The tile is pinned to it.'} value={shell?.short ?? '—'} tone={shell?.agent ? 'value' : undefined} />
        <Readout label="question" does="The shell asked a question and waits for the answer. Type your answer in the pane." value={asks ? 'open' : 'none'} tone={asks ? 'stall' : undefined} />
        <Readout label="input" does="Whether keys reach the shell." value={on(p.v, 'watch') ? 'watch' : 'type'} />
      </div>
    </Tile>
  },
}
