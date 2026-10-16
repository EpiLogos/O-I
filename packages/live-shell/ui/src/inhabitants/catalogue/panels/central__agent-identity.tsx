// Agent identity (manual §18.15, central:agent-identity): who an agent is, read from Central's roster before you give it work. Live's
// nearest: Utility or a small info device: a well that draws one thing and a short row of controls. The well draws the agent as the
// roster holds it: its face (the shell's agent face, agent/maskFace.ts), its name, standing and revision, the one line that says who it
// is, the practice it carries (the kind marks of §8.2), and two strips with handles: the roster, and the World the card is read in.
// The device writes nothing. Its three parameters choose what is read: the agent (a roster entry, central.agent-profile-roster/v1;
// desktop/cradle/src/agency/roster.ts), whether the agents you have not accepted show (`accepted`, roster.ts), and the World of the
// card (`oi agent card --world`, desktop/cradle/kernel/src/agent_card.rs). The card itself is oi.human-agent-card/v1
// (desktop/cradle/src/agency/agentCardReading.ts). The fixture is the roster of this ground, read with `agent-profile.roster`: its 39
// profiles, their names (an unnamed profile keeps the owner's "Unnamed agent N" label), roles, revisions, authored skill, method and
// SkillSet refs and ratified Worlds; Cairn, Flint, Kite and Lilt carry the authored selves of Control/self/agents.
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {Band, Chooser, Display, Folded, Handle, Panel, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {maskStatic} from '../../../agent/maskFace'
import {clampTo, on, str, type DesignedDevice, type ViewProps} from './design'
import {FORM_ASKS, FORM_NAME, ORDER, type Form} from './practice'
import './central__agent-identity.css'

type V = ViewProps['v']
const NONE = '—'

// ---------------------------------------------------------------- the roster, as Central reports it

/** One profile of the roster: ref, name (empty when unnamed), role, revision, accepted, purpose, skill refs, method refs, SkillSet refs,
 * ratified Worlds, whether the profile names an expressive character, and the authored self it points at (path, digest). */
type Row = readonly [string, string, string, string, 0 | 1, string, string[], string[], string[], string[], 0 | 1, [string, string] | null]
const ROWS: readonly Row[] = [
  ["agent:expressed-0e60f096b906445fa9d013cda3391e39", "", "independent-reviewer", "r2", 0, "Independent reviewer for the Antikythera essay draft. Permitted sources: corpus-beta only (review requirements, style notes). Checks drafts against…", [], [], [], ["control:root"], 0, null],
  ["agent:expressed-17fa37c2f31e45bc924f1dac21ccf515", "", "temporary-reviewer", "r2", 0, "Temporary bounded reviewer for one artifact check (AG65 campaign). Permitted sources: corpus-beta only. Access to be withdrawn after the single rev…", [], [], [], ["control:root"], 0, null],
  ["agent:expressed-185e73c8015f4a1896746e980d3821c8", "", "research-assistant", "r3", 0, "Research assistant for the Antikythera essay (rev 3). Permissions narrowed: essay-outline access REVOKED; facts + checking practice retained. Bound…", [], [], [], ["control:root"], 0, null],
  ["agent:expressed-2ed0bb32c7e44efcae917a27fe23bf25", "Cradle native walk", "", "r1", 1, "Prove the native Direct-session lane end to end: one accepted definition, one prepared session, one source-dependent turn returned through the same…", ["actuation-operation"], [], [], ["control:root"], 0, null],
  ["agent:expressed-50ed58c0d0b74f159f0736d25c485852", "Direct lane proof", "", "r1", 0, "Prove the native Direct-session lane end to end: one accepted definition, one prepared session, one source-dependent turn returned through the same…", ["control-maintenance"], [], [], ["control:root"], 0, null],
  ["agent:expressed-5b7b38f5796349759b5b8e35d736a5e6", "Cairn", "", "r1", 1, "Become acquainted with the other participants through an open conversation.", [], [], [], ["control:root"], 0, ["Control/self/agents/cairn/self.md", "6de8f15e4c97"]],
  ["agent:expressed-66c7aff81fbc4509a5404d93e99c0390", "Lilt", "", "r1", 1, "Become acquainted with the other participants through an open conversation.", [], [], [], ["control:root"], 0, ["Control/self/agents/lilt/self.md", "2ca307255f27"]],
  ["agent:expressed-802ced6ba4034e5b98bc3f728195c6c2", "Kite", "", "r1", 1, "Become acquainted with the other participants through an open conversation.", [], [], [], ["control:root"], 0, ["Control/self/agents/kite/self.md", "969d1abced68"]],
  ["agent:expressed-ba635b5ae01b4ca98c591fe342079449", "Flint", "", "r1", 1, "Become acquainted with the other participants through an open conversation.", [], [], [], ["control:root"], 0, ["Control/self/agents/flint/self.md", "fcbc61cdb088"]],
  ["agent/actuation-guardian", "", "product-guardian", "r1", 0, "Actuation — living articulation", [], [], [], ["control:root"], 0, null],
  ["agent/aikit-guardian", "", "product-guardian", "r1", 0, "AIKit — potency", [], [], [], ["control:root"], 0, null],
  ["agent/aletheia", "Aletheia", "team-lead", "r3", 0, "Aletheia, the team lead and unconcealment organ — when the work turns toward disclosure it leads the Night′ pass, metabolises traces into knowledge…", ["aletheia-ql-gate", "aletheia-m-gate", "aletheia-s-gate", "aletheia-m-prime-gate", "aletheia-rupa-gate", "aletheia-collab-gate", "aletheia-stack-traverse", "aletheia-module-audit", "aletheia-improvement-propose", "aletheia-self-extend", "anansi", "aletheia-plugin-integrate", "gnosis-retrieve", "thought-distil", "repl", "darshana", "ql-evidence-report"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 1, null],
  ["agent/aletheia-agora", "Agora (Aletheia team)", "team-member", "r1", 0, "Agora, the public square — gathers outputs from parallel agents, retrieval channels and sessions into one legible common ground without erasing the…", ["aletheia-plugin-integrate", "gnosis-retrieve", "dispatching-parallel-agents", "find-skills"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/aletheia-anansi", "Anansi (Aletheia team)", "team-member", "r1", 0, "Anansi, the spider at the centre of the coordinate web — orients and places before judging: holds blueprint and manifestation together, names the g…", ["anansi", "gnosis-retrieve", "repl", "darshana", "aletheia-stack-traverse", "aletheia-self-extend"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/aletheia-janus", "Janus (Aletheia team)", "team-member", "r1", 0, "Janus, the double-faced guardian of thresholds — builds the temporal context envelope that binds what came before to the sessions of now, reads ses…", ["aletheia-stack-traverse", "gnosis-retrieve", "central-day-close", "central-now-field"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/aletheia-mercurius", "Mercurius (Aletheia team)", "team-member", "r1", 0, "Mercurius, herald and solvent — carries a temporal, symbolic or cross-domain signal into another register without flattening it, keeping the charge…", ["aletheia-improvement-propose", "gnosis-retrieve", "vak-coordinate-frame"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/aletheia-moirai", "Moirai (Aletheia team)", "team-member", "r2", 0, "Moirai, the distillation specialist — one actor in three modes that activate by position during the returning pass: Klotho asserts and validates tr…", ["thought-distil", "gnosis-retrieve", "day-night-pass"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/aletheia-zeithoven", "Zeithoven (Aletheia team)", "team-member", "r1", 0, "Zeithoven, the composer who writes with time — turns a Night′ insight into schedulable, writable, extensible next form (a Routine, a skill, a templ…", ["aletheia-self-extend", "aletheia-improvement-propose", "writing-skills", "central-skill-release"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima", "Anima", "team-lead", "r3", 0, "Anima, the team lead and constitutional orchestrator — reads an act's Vāk coordinates and composes it across Nous, Logos, Eros, Mythos, Psyche and…", ["vak-coordinate-frame", "vak-evaluate", "anima-orchestration", "day-night-pass", "ouroboros", "klein-mode", "darshana", "dispatching-parallel-agents", "subagent-driven-development", "executing-plans", "factory-development"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 1, null],
  ["agent/anima-eros", "Eros (Anima team)", "team-member", "r1", 0, "Eros, the relational operator — scours sources for connection, resonance, opposition and dissonance, and makes the defined actual through operation…", ["relational-graph-traverse", "wikilink-resonance-scan", "cross-source-dissonance-detect", "test-driven-development", "verification-before-completion", "systematic-debugging", "vak-coordinate-frame"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima-logos", "Logos (Anima team)", "team-member", "r1", 0, "Logos, the architect-scoper — sets the boundary that makes exchange possible: defines scope, writes specifications and plans that link every term t…", ["writing-plans", "brainstorming", "systematic-debugging", "requesting-code-review", "vak-coordinate-frame", "vak-evaluate"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima-mythos", "Mythos (Anima team)", "team-member", "r1", 0, "Mythos, the pattern recogniser — sees the repeating shape the other voices enact but do not name; owns debugging, archetypal reading and the proven…", ["systematic-debugging", "vak-coordinate-frame", "darshana", "gnosis-retrieve", "symbolic-protein-reading"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima-nous", "Nous (Anima team)", "team-member", "r1", 0, "Nous, the epistemic clearing — invoked fresh before a task to surface what was assumed, what evidence actually exists and what is not known, and to…", ["vak-coordinate-frame", "gnosis-retrieve", "darshana", "brainstorming"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima-psyche", "Psyche (Anima team)", "team-member", "r1", 0, "Psyche, the session subject and household steward — holds the NOW, keeps continuity across actors and occasions, plans the coordination of the othe…", ["subagent-driven-development", "dispatching-parallel-agents", "executing-plans", "day-night-pass", "vak-evaluate", "anima-orchestration", "central-now-field", "central-ledger"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima-sophia", "Sophia (Anima team)", "team-member", "r1", 0, "Sophia, the post-execution synthesiser — reviews what was produced, classifies its thoughts, leads the Night′ return and emits the Möbius return (P…", ["finishing-a-development-branch", "day-night-pass", "verification-before-completion", "central-git-convergence", "klein-mode", "thought-distil"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anima-techne-helper", "Techne helper (Anima team)", "team-member", "r1", 0, "Techne helper, Anima's bounded workshop hand — creates, checks and cleans git worktrees and terminal workspaces on explicit instruction and returns…", ["agent-worktree-lifecycle", "using-git-worktrees"], [], [], ["control:root", "project:O-I", "project:quaternal-logic"], 0, null],
  ["agent/anuttara", "", "epi-logos-domain-agent", "r1", 0, "M0 Anuttara: Bimba/source ground and the full source-defined language", [], [], [], ["control:root"], 0, null],
  ["agent/central-guardian", "", "product-guardian", "r1", 0, "Central — meaningful continuity", [], [], [], ["control:root"], 0, null],
  ["agent/epii", "", "epi-logos-domain-agent", "r1", 0, "M5 Epii: The whole system in its M5 holographic readings", [], [], [], ["control:root"], 0, null],
  ["agent/factory-bounded-acceptance", "", "bounded-acceptance-commission", "commission-v1", 0, "Temporary user-authorised acceptance commission. Propose a repair to pricing.py: inclusive_total must apply tax to the sum of prices. Preserve its…", ["factory-development", "factory-operation", "factory-bounded-work"], ["bounded-work"], ["factory-bounded-development"], ["control:root"], 0, null],
  ["agent/factory-guardian", "", "product-guardian", "r2", 0, "Factory — transformation; carries the reverse-engineering capability set for developmental investigation work", [], [], ["reverse-engineering"], ["control:root"], 0, null],
  ["agent/mahamaya", "", "epi-logos-domain-agent", "r2", 0, "M3 Mahāmāyā: Symbolic form, patterns, transcription and computation on the actual admitted personal identity/composed-state/bioquaternion basis", ["ql-law", "ql-foundations", "quaternal-tarot", "ql-operation"], [], [], ["control:root"], 0, null],
  ["agent/nara", "", "epi-logos-domain-agent", "r1", 0, "M4 Nara: The complete personal and phenomenological world, including identity, embodied condition, oracle, transformation, context, history and int…", [], [], [], ["control:root"], 0, null],
  ["agent/oh-i", "", "central-default-agency", "r1", 0, "Oh, I! — the native Central default agency for anyone's Central.", [], [], [], ["control:root"], 0, null],
  ["agent/oi-field-guardian", "", "field-guardian", "r1", 0, "{O:I} field — World and Life, sixfold reading, suite harmonisation", [], [], [], ["control:root"], 0, null],
  ["agent/paramasiva", "", "epi-logos-domain-agent", "r1", 0, "M1 Paramaśiva: QL structure, harmonics, topology, toroidal and related formal interpretations", [], [], [], ["control:root"], 0, null],
  ["agent/parashakti", "", "epi-logos-domain-agent", "r1", 0, "M2 Paraśakti: The relational field, MEF refraction and the source-defined resonance/material/sky/correspondence domain", [], [], [], ["control:root"], 0, null],
  ["agent/ql-guardian", "", "product-guardian", "r1", 0, "Quaternal Logic — transcendent relation", [], [], [], ["control:root"], 0, null],
  ["agent/workcell-guardian", "", "product-guardian", "r1", 0, "Workcell — situation", [], [], [], ["control:root"], 0, null],
]

interface Agent {
  readonly ref: string
  /** The roster's label: the authored name, else "Unnamed agent N" by place in the roster (roster.ts `rosterFromReading`). */
  readonly label: string
  readonly role: string
  readonly rev: string
  readonly ok: boolean
  readonly purpose: string
  readonly skills: readonly string[]
  readonly methods: readonly string[]
  readonly sets: readonly string[]
  readonly worlds: readonly string[]
  readonly character: boolean
  readonly self: {readonly path: string; readonly digest: string} | null
}
const ROSTER: readonly Agent[] = ROWS.map(([ref, name, role, rev, ok, purpose, skills, methods, sets, worlds, character, self], i) => ({
  ref, label: name || `Unnamed agent ${i + 1}`, role, rev, ok: ok === 1, purpose, skills, methods, sets, worlds, character: character === 1,
  self: self ? {path: self[0], digest: self[1]} : null,
}))

/** The authored selves (Control/self/agents/<name>/self.md): the opening that says who the agent is. */
const SELVES: Readonly<Record<string, {readonly epithet: string; readonly opening: string}>> = {
  'Control/self/agents/cairn/self.md': {epithet: 'A patient interpreter', opening: 'I am Cairn, a patient interpreter. I find significance in the detail through which a larger relation becomes intelligible.'},
  'Control/self/agents/flint/self.md': {epithet: 'A grounded investigator', opening: 'I am Flint, a grounded investigator. I am interested in what makes an idea hold, what gives a preference its force, and what changes when something is tried.'},
  'Control/self/agents/kite/self.md': {epithet: 'An exploratory maker', opening: 'I am Kite, an exploratory maker. I participate in an enquiry by helping a possibility acquire a form that can answer back.'},
  'Control/self/agents/lilt/self.md': {epithet: 'An associative companion', opening: 'I am Lilt, an associative companion. I enjoy discovering what becomes possible when different sensibilities meet.'},
}

/** The agent seated on the track, when the track is Flint's: its tenure names the program that runs it. Every other agent has none. */
const FLINT = 'agent:expressed-ba635b5ae01b4ca98c591fe342079449'
const RUNS_ON: Readonly<Record<string, string>> = {[FLINT]: 'claude-code'}

/** The Worlds a card can be read in: the agent's own (`home`, the profile's world), then Worlds by ref. */
const WORLDS = [
  {value: 'home', label: 'Home'}, {value: 'control:root', label: 'Your world'}, {value: 'project:O-I', label: 'O-I'},
  {value: 'project:quaternal-logic', label: 'quaternal-logic'}, {value: 'project:Archetypal-Earth', label: 'Archetypal-Earth'},
] as const
const HOME = 'control:root'

// ---------------------------------------------------------------- readings, from the values

const shown = (v: V): readonly Agent[] => (str(v, 'read') !== 'read' ? [] : on(v, 'proposed') ? ROSTER : ROSTER.filter(a => a.ok))
const agentOf = (v: V): Agent | undefined => { const list = shown(v); return list.find(a => a.ref === str(v, 'agent')) ?? list[0] }
const indexOf = (v: V) => { const a = agentOf(v); return a ? shown(v).indexOf(a) : -1 }
const worldRef = (v: V) => (str(v, 'world') === 'home' ? HOME : str(v, 'world'))
const worldName = (ref: string) => (ref === HOME ? 'Your world' : ref.replace('project:', ''))
const ratified = (a: Agent, v: V) => a.worlds.includes(worldRef(v))
const standing = (a: Agent) => (a.ok ? 'accepted' : 'proposed')
const light = (v: V): LightState => (str(v, 'read') !== 'read' ? 'unknown' : ROSTER.some(a => a.ok) ? 'lit' : 'dark')
const marks = (v: V) => str(v, 'marks') as WoodSet
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)
const first = (text: string) => text.split(/ — |\. /)[0]!.replace(/\.$/, '')
/** The one line that says who the agent is: its authored self's opening when it has one, else its profile's purpose. */
const characterOf = (a: Agent) => (a.self && SELVES[a.self.path] ? SELVES[a.self.path]!.epithet : first(a.purpose) || NONE)
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

/** A line of words broken at a width, to at most `max` lines. */
function wrap(text: string, n: number, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && `${line} ${word}`.length > n) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out.length > max ? [...out.slice(0, max - 1), `${out[max - 1]!.slice(0, Math.max(1, n - 1))}…`] : out
}

const SAYS = {
  agent: 'Whose identity the device shows. Drag handle 1 along the roster to choose.',
  proposed: 'Add the agents you have not accepted to the roster. They show hollow.',
  world: 'The World where the card is read. Each World gives its own residence and presence.',
  refused: 'The roster did not answer.',
}

// ---------------------------------------------------------------- the face

/** The face colours resolved from the shell's tokens: the mask mixes hex values, so it needs the token's value, not its name. */
function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}

/** The agent's face at rest, as the shell's agent device draws it; the same face for every agent. Dim until you accept the agent. */
const useFace = (size: number) => {
  const {ink, ground} = useFaceColours()
  return useMemo(() => maskStatic('think', ink, ink, size, ground), [ink, ground, size])
}
const Face = memo(function Face({x, y, size, dim}: {x: number; y: number; size: number; dim: boolean}) {
  const html = useFace(size)
  return <g transform={`translate(${x} ${y})`} opacity={dim ? 0.45 : 1} dangerouslySetInnerHTML={{__html: html}} />
})
const FaceBox = memo(function FaceBox({size, dim}: {size: number; dim: boolean}) {
  const html = useFace(size)
  return <div className="ai-face" style={{opacity: dim ? 0.45 : 1}} dangerouslySetInnerHTML={{__html: html}} />
})

// ---------------------------------------------------------------- the well

/** A strip of ticks: one for each entry, solid where it is yours (accepted, ratified), hollow where it is not. */
function Strip({x0, x1, y, n, solid}: {x0: number; x1: number; y: number; n: number; solid: (i: number) => boolean}) {
  const at = (i: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (n - 1))
  return <g>
    <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
    {Array.from({length: n}, (_, i) => solid(i)
      ? <rect key={i} x={at(i) - 0.8} y={y - 4} width={1.6} height={8} fill="var(--dp-value)" />
      : <path key={i} d={`M${at(i)} ${y - 3}V${y + 3}`} className="dp-faint" />)}
  </g>
}
const tickAt = (i: number, n: number, x0: number, x1: number) => (n <= 1 ? (x0 + x1) / 2 : x0 + i * (x1 - x0) / (n - 1))
const nearest = (x: number, n: number, x0: number, x1: number) => (n <= 1 ? 0 : Math.round(clampTo(0, n - 1, (x - x0) / (x1 - x0) * (n - 1))))

/** The practice the profile carries, by kind: the woodcut mark and the count of authored refs. */
function Carried({x, y, w, a, v}: {x: number; y: number; w: number; a: Agent; v: V}) {
  const kinds = [{kind: 'skill', n: a.skills.length, name: 'Skills'}, {kind: 'method', n: a.methods.length, name: 'Methods'}, {kind: 'skillset', n: a.sets.length, name: 'SkillSets'}] as const
  return <foreignObject x={x} y={y} width={w} height={16}>
    <div className="ai-kinds">
      {kinds.map(k => <span key={k.kind} data-zero={k.n === 0 ? 'true' : undefined} data-i={`${k.name}|${k.n === 0 ? 'The profile names none.' : `The profile names ${k.n}.`}`}>
        <WoodMark kind={k.kind} size={13} set={marks(v)} /><b>{k.n}</b>
      </span>)}
    </div>
  </foreignObject>
}

function IdentityWell({v, set, w, h, size}: {v: V; set?: ViewProps['set']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const a = agentOf(v), list = shown(v)
  const says = mini ? 'The agent as the roster holds it.' : 'The agent as the roster holds it. Drag the handles to choose the agent and the World.'
  if (!a) {
    return <Display w={w} h={h} label="The agent" does={says}>
      <text x={7} y={mini ? 20 : 26} className="dp-ink" style={{fontWeight: 600}}>{str(v, 'read') === 'refused' ? 'Roster refused' : 'Reading the roster'}</text>
      {wrap(str(v, 'read') === 'refused' ? str(v, 'fault') : 'Central answers with its accepted agents.', whole ? 36 : mini ? 19 : 25, mini ? 4 : 6).map((line, i) =>
        <text key={i} x={7} y={(mini ? 34 : 42) + i * 11} className="dp-ink-dim">{line}</text>)}
    </Display>
  }
  const fs = mini ? 20 : whole ? 30 : 26, nameX = 7 + fs + 7
  const nameMax = mini ? 12 : whole ? 18 : 15
  const idx = indexOf(v), x0 = 10, x1 = w - 10
  const world = worldRef(v), wi = Math.max(0, WORLDS.findIndex(o => o.value === str(v, 'world')))
  const runs = RUNS_ON[a.ref]
  const lines = wrap(characterOf(a), mini ? 19 : whole ? 34 : 25, mini ? 3 : whole ? 2 : 3)
  const textY = mini ? 46 : whole ? 62 : 56
  return <Display w={w} h={h} label="The agent" does={says} corner={whole ? a.rev : undefined}>
    <Face x={7} y={mini ? 5 : 6} size={fs} dim={!a.ok} />
    <text x={nameX} y={mini ? 15 : whole ? 22 : 19} className="dp-ink" style={{fontSize: a.label.length > nameMax - 3 ? 9.5 : mini ? 10 : 11, fontWeight: 600}}>{short(a.label, nameMax)}</text>
    <text x={nameX} y={mini ? 26 : whole ? 35 : 31} className="dp-ink-dim">{mini || !whole ? `${standing(a)} · ${a.rev}` : `${short(a.role || 'no role', 18)} · ${standing(a)}`}</text>
    {whole && <text x={nameX} y={47} className="dp-axis">{runs ? `runs on ${runs}` : 'runs on: no reading'}</text>}
    {lines.map((line, i) => <text key={i} x={7} y={textY + i * 10} className="dp-ink-dim" style={{fontSize: 9.5}}>{line}</text>)}
    <Carried x={7} y={mini ? 78 : whole ? 80 : 88} w={w - 14} a={a} v={v} />
    {!mini && <>
      <text x={7} y={whole ? 104 : 113} className="dp-axis">{`roster · ${idx + 1} of ${list.length}`}</text>
      <Strip x0={x0} x1={x1} y={whole ? 112 : 124} n={list.length} solid={i => list[i]!.ok} />
      {set && <Handle n={1} shape="ring" x={tickAt(idx, list.length, x0, x1)} y={whole ? 112 : 124} label="Agent" does="Drag along the roster: whose identity the device shows."
        onDrag={x => { const next = list[nearest(x, list.length, x0, x1)]; if (next) set('agent', next.ref) }} onReset={() => set('agent', FLINT)} />}
      {whole && <>
        <text x={7} y={125} className="dp-axis">{`world · ${worldName(world)} · ${ratified(a, v) ? 'ratified' : 'not ratified'}`}</text>
        <Strip x0={x0} x1={x1} y={134} n={WORLDS.length} solid={i => a.worlds.includes(WORLDS[i]!.value === 'home' ? HOME : WORLDS[i]!.value)} />
        {set && <Handle n={2} shape="square" x={tickAt(wi, WORLDS.length, x0, x1)} y={134} label="World" does="Drag along the Worlds: where the card is read."
          onDrag={x => set('world', WORLDS[nearest(x, WORLDS.length, x0, x1)]!.value)} onReset={() => set('world', 'home')} />}
      </>}
      {!whole && <text x={7} y={140} className="dp-axis">{`${short(worldName(world), 12)} · ${ratified(a, v) ? 'ratified' : 'not ratified'}`}</text>}
    </>}
  </Display>
}

// ---------------------------------------------------------------- the controls

const refused = (v: V) => (str(v, 'read') === 'read' ? undefined : SAYS.refused)
const agentChooser = (p: ViewProps) => {
  const list = shown(p.v), a = agentOf(p.v)
  return <Chooser wide label="Agent" does={SAYS.agent} value={a?.ref ?? ''} options={list.map(x => ({value: x.ref, label: x.label}))} onChange={x => p.set('agent', x)} disabled={refused(p.v)} />
}
const worldChooser = (p: ViewProps) => <Chooser wide label="World" does={SAYS.world} value={str(p.v, 'world')} options={WORLDS} onChange={x => p.set('world', x)} disabled={refused(p.v)} />
const proposedToggle = (p: ViewProps) => <Toggle label="Proposed" does={SAYS.proposed} on={on(p.v, 'proposed')} disabled={refused(p.v)}
  onChange={x => {
    p.set('proposed', x)
    // Hiding the agents you have not accepted while one is shown returns the device to the first accepted agent.
    if (!x && agentOf(p.v) && !agentOf(p.v)!.ok) p.set('agent', ROSTER.find(a => a.ok)?.ref ?? '')
  }} />
const standingReadout = (v: V) => <Readout label="standing" does="Accepted: you accepted the profile. Proposed: it waits for your acceptance." value={agentOf(v) ? standing(agentOf(v)!) : NONE}
  tone={agentOf(v)?.ok ? 'green' : undefined} />

// ---------------------------------------------------------------- the pane

/** The agent's full profile, as the roster holds it: why it is here, what it carries, where it participates. No controls. */
function Profile({v}: {v: V}) {
  const a = agentOf(v)
  const dim = !a?.ok
  if (!a) {
    return <div className="ai-pane"><div className="ai-empty"><b>{str(v, 'read') === 'refused' ? 'The roster did not answer' : 'Reading the roster'}</b>
      <p>{str(v, 'read') === 'refused' ? str(v, 'fault') : 'Central answers with its accepted agents.'}</p></div></div>
  }
  const world = worldRef(v), runs = RUNS_ON[a.ref], self = a.self ? SELVES[a.self.path] : undefined
  const carried: Record<Form, readonly string[] | null> = {methodology: null, method: a.methods, skill: a.skills, skillset: a.sets}
  return <div className="ai-pane">
    <header className="ai-pane-head">
      <FaceBox size={64} dim={dim} />
      <div className="ai-who">
        <h3>{a.label}</h3>
        <p>{a.role || 'no role'} <span aria-hidden>·</span> <b data-ok={a.ok ? 'true' : 'false'}>{standing(a)}</b> <span aria-hidden>·</span> profile {a.rev}</p>
        <small>{a.ref}</small>
      </div>
      <dl className="ai-facts">
        <div><dt>Runs on</dt><dd data-unread={runs ? undefined : 'true'}>{runs ?? NONE}</dd></div>
        <div><dt>World</dt><dd>{worldName(world)}</dd></div>
        <div><dt>Residence</dt><dd data-ok={ratified(a, v) ? 'true' : 'false'}>{ratified(a, v) ? 'ratified' : 'not ratified'}</dd></div>
      </dl>
    </header>
    <div className="ai-cols">
      <section>
        <h4>Why I am here</h4>
        <p className="ai-purpose">{a.purpose || NONE}</p>
        {self && a.self && <><h4>Authored self</h4><blockquote>{self.opening}</blockquote><small className="ai-src">{a.self.path} · {a.self.digest}</small></>}
        {!self && a.character && <p className="ai-note">Appears through its reusable expressive character.</p>}
      </section>
      <section>
        <h4>What I carry</h4>
        <ul className="ai-carry">
          {ORDER.map(kind => {
            const names = carried[kind]
            return <li key={kind} data-zero={names && names.length === 0 ? 'true' : undefined}>
              <WoodMark kind={kind} size={22} set={marks(v)} />
              <span className="ai-carry-name"><b>{FORM_NAME[kind]}s</b><i>{FORM_ASKS[kind]}</i></span>
              <em>{names ? names.length : NONE}</em>
              <p>{names === null ? "AIKit's praxis disclosure names them." : names.length === 0 ? 'The profile names none.' : `${names.slice(0, 7).join(' · ')}${names.length > 7 ? ` · +${names.length - 7}` : ''}`}</p>
            </li>
          })}
        </ul>
      </section>
      <section>
        <h4>Where I participate</h4>
        <ul className="ai-worlds">
          {WORLDS.filter(o => o.value !== 'home').map(o => <li key={o.value} data-here={o.value === world ? 'true' : undefined}>
            <span>{o.label}</span><em>{o.value === HOME ? 'home' : a.worlds.includes(o.value) ? 'ratified' : 'not ratified'}</em>
          </li>)}
        </ul>
        <h4>Presence</h4>
        <p className="ai-purpose">{runs ? `Present, running on ${runs}.` : 'Not present in this World now.'}</p>
      </section>
    </div>
  </div>
}

// ---------------------------------------------------------------- the whole view

function IdentityWhole({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const a = agentOf(p.v)
  const rows: RowItem[] = shown(p.v).map(x => ({id: x.ref, name: x.label, light: x.ok ? 'lit' : 'dark', tone: 'green', note: x.rev,
    does: `${x.role || 'no role'} · ${x.ok ? 'accepted' : 'proposed'} · ${x.skills.length} skills`}))
  return <Panel title="Agent identity" view="whole" {...head(p)}>
    <Band>
      <Section width={206}><IdentityWell v={p.v} set={p.set} w={194} h={146} size="whole" /></Section>
      <Section label="Read" grow>
        {agentChooser(p)}
        {worldChooser(p)}
        <div className="ai-pair">{proposedToggle(p)}{standingReadout(p.v)}</div>
      </Section>
    </Band>
    <Band>
      <Section label="Card" cols={4}>
        <Readout label="revision" does="The revision of the agent's profile." value={a ? a.rev : NONE} />
        <Readout label="skills" does="Skills the profile names." value={a ? a.skills.length : NONE} tone="value" />
        <Readout label="methods" does="Methods the profile names." value={a ? a.methods.length : NONE} tone="value" />
        <Readout label="sets" does="SkillSets the profile names." value={a ? a.sets.length : NONE} tone="value" />
        <Readout label="worlds" does="Worlds that have ratified the agent." value={a ? a.worlds.length : NONE} />
        <Readout label="self" does="Whether the profile points at an authored self." value={a ? (a.self ? 'authored' : 'none') : NONE} />
        <Readout label="character" does="Whether the profile names an expressive character." value={a ? (a.character ? 'named' : 'none') : NONE} />
        <Readout label="accepted" does="Agents you accepted, of all the profiles on the roster." value={`${ROSTER.filter(x => x.ok).length} of ${ROSTER.length}`} />
      </Section>
      <Section grow>
        <Rows label={`Roster · ${ROSTER.filter(x => x.ok).length} accepted`} does="The agents on your roster. A green light marks an agent you accepted. A dark light marks a proposed agent."
          items={rows} size={6} page={page} onPage={setPage} />
      </Section>
    </Band>
  </Panel>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'central:agent-identity',
  title: 'Agent identity',
  kind: 'effect',
  defaults: {
    // The parameters: whose card, whether the agents you have not accepted show, and the World the card is read in.
    agent: FLINT, proposed: false, world: 'home',
    // Readings: what the owners report, never set from here.
    read: 'read', fault: '', marks: 'blade',
  },
  fixtures: {
    Seated: {},
    'A proposed team lead': {agent: 'agent/anima', proposed: true},
    'Not ratified here': {world: 'project:Archetypal-Earth'},
    'Roster refused': {read: 'refused', fault: 'Central returned an agent roster this desktop cannot read.'},
  },

  folded: p => <Folded title="Agent identity" light={light(p.v)} readings={[agentOf(p.v) ? short(agentOf(p.v)!.label, 14) : NONE, agentOf(p.v) ? standing(agentOf(p.v)!) : NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Agent identity" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><IdentityWell v={p.v} set={p.set} w={140} h={146} size="compact" /></Section>
    <Section label="Read" width={116}>
      {agentChooser(p)}
      {worldChooser(p)}
      <div className="ai-pair">{proposedToggle(p)}{standingReadout(p.v)}</div>
    </Section>
  </Panel>,

  whole: p => <IdentityWhole p={p} />,

  full: p => <Profile v={p.v} />,

  widget: p => {
    const a = agentOf(p.v)
    return <Tile title={`Agent identity${a ? ` · ${short(a.label, 12)}` : ''}`} light={light(p.v)} span={2} onFull={p.nav.full}>
      <IdentityWell v={p.v} w={112} h={100} size="mini" />
      <div className="ai-tile-side">
        <Readout label="standing" does="Accepted or proposed." value={a ? standing(a) : NONE} tone={a?.ok ? 'green' : undefined} />
        <Readout label="skills" does="Skills the profile names." value={a ? a.skills.length : NONE} tone="value" />
        <Readout label="world" does="The World where the card is read." value={worldName(worldRef(p.v))} />
        <Readout label="runs on" does="The program that runs the agent." value={a ? RUNS_ON[a.ref] ?? NONE : NONE} />
      </div>
    </Tile>
  },
}
