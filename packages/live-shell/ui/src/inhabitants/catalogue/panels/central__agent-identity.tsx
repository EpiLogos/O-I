// Agent identity (manual §18.15, central:agent-identity): who an agent is, read from Central's roster before you give it work. Live's
// nearest: Utility or a small info device: a well that draws one thing and a short row of controls. The well draws the agent as the
// roster holds it: its face (the shell's agent face, agent/maskFace.ts), its name, standing and revision, the one line that says who it
// is, the practice it carries (the kind marks of §8.2), and two strips with handles: the roster, and the World the card is read in.
// The device writes nothing. Its three parameters choose what is read: the agent (a roster entry, central.agent-profile-roster/v1;
// desktop/cradle/src/agency/roster.ts), whether the agents you have not accepted show (`accepted`, roster.ts), and the World of the
// card (`oi agent card --world`, desktop/cradle/kernel/src/agent_card.rs). The card itself is oi.human-agent-card/v1
// (desktop/cradle/src/agency/agentCardReading.ts).
//
// Bindable: the material is two value keys, each a JSON string.
//   `roster` is the roster as roster.ts reports it, one entry for each profile: [{ref, name, role, revision, accepted}] (`name` is the
//     owner's label, "Unnamed agent N" for an unnamed profile; `role` and `revision` are left out when the profile names none).
//   `card` is the card of the chosen agent, in the World the card is read in: {agent, home, purpose, carries, ratified, runs_on, self,
//     character}. `agent` is the agent_ref the card was read for; a card for another agent is not this agent's reading and is not drawn.
//     `home` is the profile's own World (where_i_participate.home_world_ref); `purpose` is why_im_here; `carries` holds the refs by
//     the practice kinds of panels/practice.ts: {skill, method, methodology, skillset} (what_i_can_do, how_i_work, how_i_orient,
//     what_i_carry.skill_sets); a kind the card does not report is left out. `ratified` is the Worlds that have ratified the agent.
//     `runs_on` is the program that runs the agent, null when none does. `self` is the authored self the profile points at
//     ({path, digest, epithet, opening}), null when it points at none. `character` is whether the profile names an expressive character.
//   `worlds` is the list of World refs the card can be read in (a JSON list of strings); Home, the profile's own World, is always offered.
//   `read` is the roster owner's answer ('refused' when it did not answer) and `fault` its own words.
// A key the owner does not report is drawn "—", and the well names the reading that is missing. The sample is the roster of this ground,
// read with `agent-profile.roster`: its 39 profiles, their names, roles, revisions, authored skill, method and SkillSet refs and ratified
// Worlds; Cairn, Flint, Kite and Lilt carry the authored selves of Control/self/agents. It sits in the defaults and the fixtures.
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {Band, Chooser, Display, Folded, Handle, Panel, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem, type Standing} from '../../sdk/panel'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {maskStatic} from '../../../agent/maskFace'
import {NONE, boolOf, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {FORM_ASKS, FORM_NAME, ORDER, type Form} from './practice'
import './central__agent-identity.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the gallery's sample (read only by the defaults and the fixtures)

/** One profile of the roster: ref, name (empty when unnamed), role, revision, accepted, purpose, skill refs, method refs, SkillSet refs,
 * ratified Worlds, whether the profile names an expressive character, and the authored self it points at (path, digest). */
type Row = readonly [string, string, string, string, 0 | 1, string, string[], string[], string[], string[], 0 | 1, [string, string] | null]
const SAMPLE_ROWS: readonly Row[] = [
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

/** The authored selves (Control/self/agents/<name>/self.md): the opening that says who the agent is. */
const SAMPLE_SELVES: Readonly<Record<string, {readonly epithet: string; readonly opening: string}>> = {
  'Control/self/agents/cairn/self.md': {epithet: 'A patient interpreter', opening: 'I am Cairn, a patient interpreter. I find significance in the detail through which a larger relation becomes intelligible.'},
  'Control/self/agents/flint/self.md': {epithet: 'A grounded investigator', opening: 'I am Flint, a grounded investigator. I am interested in what makes an idea hold, what gives a preference its force, and what changes when something is tried.'},
  'Control/self/agents/kite/self.md': {epithet: 'An exploratory maker', opening: 'I am Kite, an exploratory maker. I participate in an enquiry by helping a possibility acquire a form that can answer back.'},
  'Control/self/agents/lilt/self.md': {epithet: 'An associative companion', opening: 'I am Lilt, an associative companion. I enjoy discovering what becomes possible when different sensibilities meet.'},
}

/** The agent seated on the track in the sample: Flint, whose tenure names the program that runs it. Every other agent has none. */
const SAMPLE_SEATED = 'agent:expressed-ba635b5ae01b4ca98c591fe342079449'
const SAMPLE_HOME = 'control:root'
/** The Worlds the sample card can be read in. */
const SAMPLE_WORLDS = [SAMPLE_HOME, 'project:O-I', 'project:quaternal-logic', 'project:Archetypal-Earth']

/** The roster as roster.ts reports it: an unnamed profile keeps the owner's "Unnamed agent N" label, by place in the roster. */
const sampleRoster = () => JSON.stringify(SAMPLE_ROWS.map(([ref, name, role, revision, ok], i) =>
  ({ref, name: name || `Unnamed agent ${i + 1}`, ...(role ? {role} : {}), revision, accepted: ok === 1})))

/** The card of one sample agent, as `oi agent card` reads it: the sample reports no Methodology for any agent. */
function sampleCard(ref: string): string | undefined {
  const row = SAMPLE_ROWS.find(r => r[0] === ref)
  if (!row) return undefined
  const [, , , , , purpose, skill, method, skillset, ratified, character, self] = row
  const authored = self ? SAMPLE_SELVES[self[0]] : undefined
  return JSON.stringify({agent: ref, home: SAMPLE_HOME, purpose, carries: {skill, method, skillset}, ratified, runs_on: ref === SAMPLE_SEATED ? 'claude-code' : null,
    self: self ? {path: self[0], digest: self[1], ...authored} : null, character: character === 1})
}

// ---------------------------------------------------------------- the readings, as the owners report them

/** One profile of the roster (roster.ts RosterAgent): its label, role, revision and whether you accepted it. */
interface Agent {
  readonly ref: string
  readonly label: string
  readonly role: string | undefined
  readonly rev: string | undefined
  readonly ok: boolean | undefined
}
interface Self {readonly path: string; readonly digest: string | undefined; readonly epithet: string | undefined; readonly opening: string | undefined}
/** The card of the chosen agent. `runsOn`, `self`: null is the owner's answer "none"; undefined is "not reported". */
interface Card {
  readonly agent: string
  readonly home: string | undefined
  readonly purpose: string | undefined
  readonly carries: Readonly<Partial<Record<Form, readonly string[]>>>
  readonly ratified: readonly string[] | undefined
  readonly runsOn: string | null | undefined
  readonly self: Self | null | undefined
  readonly character: boolean | undefined
}

const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const strings = (x: unknown): string[] | undefined => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s !== '') : undefined)

/** The roster's profiles, or undefined when the owner reports none. */
function rosterOf(v: V): readonly Agent[] | undefined {
  const raw = json<unknown>(v, 'roster', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((x): Agent[] => {
    const o = rec(x), ref = text(o?.ref)
    return o && ref ? [{ref, label: text(o.name) ?? NONE, role: text(o.role), rev: text(o.revision), ok: typeof o.accepted === 'boolean' ? o.accepted : undefined}] : []
  })
}

/** The card as the owner reports it, or undefined when it reports none. */
function cardOf(v: V): Card | undefined {
  const o = rec(json<unknown>(v, 'card', undefined)), agent = text(o?.agent)
  if (!o || !agent) return undefined
  const c = rec(o.carries), carries: Partial<Record<Form, readonly string[]>> = {}
  for (const kind of ORDER) { const names = strings(c?.[kind]); if (names) carries[kind] = names }
  const s = rec(o.self), path = text(s?.path)
  return {agent, home: text(o.home), purpose: text(o.purpose), carries, ratified: strings(o.ratified),
    runsOn: o.runs_on === null ? null : text(o.runs_on),
    self: o.self === null ? null : s && path ? {path, digest: text(s.digest), epithet: text(s.epithet), opening: text(s.opening)} : undefined,
    character: typeof o.character === 'boolean' ? o.character : undefined}
}

const worldName = (ref: string | undefined) => (ref === undefined ? NONE : ref === 'control:root' ? 'Your world' : ref.replace('project:', ''))

/** What the views read: the roster and the agents it shows, the chosen agent and its card, and the World the card is read in. */
interface Model {
  readonly status: 'read' | 'refused' | 'unread'
  readonly roster: readonly Agent[] | undefined
  /** The agents shown: the accepted ones, and the others when Proposed is on. */
  readonly list: readonly Agent[] | undefined
  readonly agent: Agent | undefined
  readonly index: number
  /** The chosen agent's card; undefined when the owner reports none for this agent. */
  readonly card: Card | undefined
  readonly world: string | undefined
  readonly choices: readonly {readonly value: string; readonly label: string}[]
  readonly ratified: boolean | undefined
}
function model(v: V): Model {
  const refused = strOf(v, 'read') === 'refused'
  const roster = refused ? undefined : rosterOf(v)
  const list = roster && (boolOf(v, 'proposed') === true ? roster : roster.filter(a => a.ok === true))
  const chosen = strOf(v, 'agent')
  const agent = chosen === undefined ? undefined : list?.find(a => a.ref === chosen)
  const read = cardOf(v)
  const card = agent && read?.agent === agent.ref ? read : undefined
  const asked = strOf(v, 'world')
  const world = asked === 'home' ? card?.home : asked
  const worlds = strings(json<unknown>(v, 'worlds', undefined)) ?? []
  return {status: refused ? 'refused' : roster ? 'read' : 'unread', roster, list, agent, index: agent && list ? list.indexOf(agent) : -1, card, world,
    choices: [{value: 'home', label: 'Home'}, ...worlds.map(ref => ({value: ref, label: worldName(ref)}))],
    ratified: card?.ratified && world !== undefined ? card.ratified.includes(world) : undefined}
}

const standing = (a: Agent) => (a.ok === undefined ? undefined : a.ok ? 'accepted' : 'proposed')
const standingText = (a: Agent) => standing(a) ?? NONE
const ratifiedWords = (r: boolean | undefined) => (r === undefined ? NONE : r ? 'ratified' : 'not ratified')
// The light reads the owner alone (manual §16.8): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
// The mark set is the person's choice for the whole shell (Settings), not the owner's: the blade until they choose.
const marks = (v: V) => (strOf(v, 'marks') ?? 'blade') as WoodSet
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)
const first = (text: string) => text.split(/ — |\. /)[0]!.replace(/\.$/, '')
/** The one line that says who the agent is: its authored self's opening when it has one, else its profile's purpose. */
const characterOf = (card: Card) => card.self?.epithet ?? (first(card.purpose ?? '') || NONE)
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const roleOf = (a: Agent) => a.role ?? 'no role'

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
  unread: 'No reading of the roster.',
  none: 'The roster holds no agent to choose.',
}

/** What the well and the pane say when there is no agent to draw: which reading is missing, in words. */
function missing(m: Model, v: V): {title: string; body: string} {
  if (m.status === 'refused') return {title: 'Roster refused', body: strOf(v, 'fault') ?? SAYS.refused}
  if (!m.list) return {title: 'No reading of the roster', body: 'Central has not reported its agents.'}
  if (m.list.length === 0) return {title: 'No agent on the roster', body: 'Central reports no accepted agent. Turn on Proposed to show the others.'}
  if (strOf(v, 'agent') === undefined) return {title: 'No agent chosen', body: 'Choose one from the Agent list.'}
  return {title: 'Agent not on the roster', body: 'The agent you chose is not on the roster shown.'}
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

/** The practice the card carries, by kind: the woodcut mark and the count of refs; "—" where the card reports none. */
function Carried({x, y, w, card, set}: {x: number; y: number; w: number; card: Card | undefined; set: WoodSet}) {
  const kinds = [{kind: 'skill', name: 'Skills'}, {kind: 'method', name: 'Methods'}, {kind: 'skillset', name: 'SkillSets'}] as const
  return <foreignObject x={x} y={y} width={w} height={16}>
    <div className="ai-kinds">
      {kinds.map(k => {
        const n = card?.carries[k.kind]?.length
        return <span key={k.kind} data-zero={n ? undefined : 'true'} data-i={`${k.name}|${n === undefined ? 'No reading of the card.' : n === 0 ? 'The profile names none.' : `The profile names ${n}.`}`}>
          <WoodMark kind={k.kind} size={13} set={set} /><b>{n ?? NONE}</b>
        </span>
      })}
    </div>
  </foreignObject>
}

function IdentityWell({m, v, set, w, h, size}: {m: Model; v: V; set?: ViewProps['set']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const a = m.agent, list = m.list ?? [], card = m.card
  const says = mini ? 'The agent as the roster holds it.' : 'The agent as the roster holds it. Drag the handles to choose the agent and the World.'
  if (!a) {
    const {title, body} = missing(m, v)
    const top = mini ? 20 : 26, titleLines = wrap(title, whole ? 30 : mini ? 17 : 22, 2), bodyY = top + titleLines.length * 11 + (mini ? 3 : 5)
    return <Display w={w} h={h} label="The agent" does={says} corner={whole ? NONE : undefined}>
      {titleLines.map((line, i) => <text key={`t${i}`} x={7} y={top + i * 11} className="dp-ink" style={{fontWeight: 600}}>{line}</text>)}
      {wrap(body, whole ? 36 : mini ? 19 : 25, mini ? 4 : 6).map((line, i) => <text key={i} x={7} y={bodyY + i * 11} className="dp-ink-dim">{line}</text>)}
    </Display>
  }
  const fs = mini ? 20 : whole ? 30 : 26, nameX = 7 + fs + 7
  const nameMax = mini ? 12 : whole ? 18 : 15
  const x0 = 10, x1 = w - 10, idx = m.index
  const wi = m.choices.findIndex(o => o.value === strOf(v, 'world'))
  const runs = card?.runsOn
  const lines = wrap(card ? characterOf(card) : 'No reading of the card.', mini ? 19 : whole ? 34 : 25, mini ? 3 : whole ? 2 : 3)
  const textY = mini ? 46 : whole ? 62 : 56
  return <Display w={w} h={h} label="The agent" does={says} corner={whole ? a.rev ?? NONE : undefined}>
    <Face x={7} y={mini ? 5 : 6} size={fs} dim={a.ok !== true} />
    <text x={nameX} y={mini ? 15 : whole ? 22 : 19} className="dp-ink" style={{fontSize: a.label.length > nameMax - 3 ? 9.5 : mini ? 10 : 11, fontWeight: 600}}>{short(a.label, nameMax)}</text>
    <text x={nameX} y={mini ? 26 : whole ? 35 : 31} className="dp-ink-dim">{mini || !whole ? `${standingText(a)} · ${a.rev ?? NONE}` : `${short(roleOf(a), 18)} · ${standingText(a)}`}</text>
    {whole && <text x={nameX} y={47} className="dp-axis">{`runs on ${runs ?? NONE}`}</text>}
    {lines.map((line, i) => <text key={i} x={7} y={textY + i * 10} className="dp-ink-dim" style={{fontSize: 9.5}}>{line}</text>)}
    <Carried x={7} y={mini ? 78 : whole ? 80 : 88} w={w - 14} card={card} set={marks(v)} />
    {!mini && <>
      <text x={7} y={whole ? 104 : 113} className="dp-axis">{`roster · ${idx >= 0 ? idx + 1 : NONE} of ${list.length}`}</text>
      <Strip x0={x0} x1={x1} y={whole ? 112 : 124} n={list.length} solid={i => list[i]?.ok === true} />
      {set && idx >= 0 && <Handle n={1} shape="ring" x={tickAt(idx, list.length, x0, x1)} y={whole ? 112 : 124} label="Agent" does="Drag along the roster: whose identity the device shows."
        onDrag={x => { const next = list[nearest(x, list.length, x0, x1)]; if (next) set('agent', next.ref) }} onReset={() => set('agent', list.find(x => x.ok === true)?.ref)} />}
      {whole && <>
        <text x={7} y={125} className="dp-axis">{`world · ${worldName(m.world)} · ${ratifiedWords(m.ratified)}`}</text>
        <Strip x0={x0} x1={x1} y={134} n={m.choices.length} solid={i => { const ref = m.choices[i]?.value === 'home' ? card?.home : m.choices[i]?.value; return ref !== undefined && card?.ratified?.includes(ref) === true }} />
        {set && wi >= 0 && m.choices.length > 1 && <Handle n={2} shape="square" x={tickAt(wi, m.choices.length, x0, x1)} y={134} label="World" does="Drag along the Worlds: where the card is read."
          onDrag={x => { const next = m.choices[nearest(x, m.choices.length, x0, x1)]; if (next) set('world', next.value) }} onReset={() => set('world', 'home')} />}
      </>}
      {!whole && <text x={7} y={140} className="dp-axis">{`${short(worldName(m.world), 12)} · ${ratifiedWords(m.ratified)}`}</text>}
    </>}
  </Display>
}

// ---------------------------------------------------------------- the controls

/** The control's standing from the host, and the owner's own reason it cannot act when the host gives none. */
const stand = (p: ViewProps, key: string, why: string | undefined): Standing => { const s = st(p, key); return s.disabled || !why ? s : {...s, disabled: why} }
const refusedWhy = (m: Model) => (m.status === 'refused' ? SAYS.refused : undefined)
const agentWhy = (m: Model) => (m.status === 'refused' ? SAYS.refused : !m.list ? SAYS.unread : m.list.length === 0 ? SAYS.none : undefined)
const agentChooser = (p: ViewProps, m: Model) => <Chooser {...stand(p, 'agent', agentWhy(m))} wide label="Agent" does={SAYS.agent} value={m.agent?.ref ?? ''}
  options={(m.list ?? []).map(x => ({value: x.ref, label: x.label}))} onChange={x => p.set('agent', x)} />
const worldChooser = (p: ViewProps, m: Model) => <Chooser {...stand(p, 'world', refusedWhy(m))} wide label="World" does={SAYS.world} value={strOf(p.v, 'world') ?? ''}
  options={m.choices} onChange={x => p.set('world', x)} />
const proposedToggle = (p: ViewProps, m: Model) => {
  const now = boolOf(p.v, 'proposed')
  return <Toggle {...stand(p, 'proposed', refusedWhy(m))} label="Proposed" does={SAYS.proposed} on={now === true} unknown={now === undefined}
    onChange={x => {
      p.set('proposed', x)
      // Hiding the agents you have not accepted while one is shown returns the device to the first accepted agent.
      if (!x && m.agent && m.agent.ok !== true) p.set('agent', m.roster?.find(a => a.ok === true)?.ref)
    }} />
}
const standingReadout = (m: Model) => <Readout label="standing" does="Accepted: you accepted the profile. Proposed: it waits for your acceptance." value={m.agent ? standing(m.agent) : undefined}
  tone={m.agent?.ok === true ? 'green' : undefined} />

// ---------------------------------------------------------------- the pane

/** What the card says of a kind of practice the profile carries, in words. */
function carryWords(kind: Form, card: Card | undefined, names: readonly string[] | undefined): string {
  if (names) return names.length === 0 ? 'The profile names none.' : `${names.slice(0, 7).join(' · ')}${names.length > 7 ? ` · +${names.length - 7}` : ''}`
  if (!card) return 'No reading of the card.'
  return kind === 'methodology' ? "AIKit's praxis disclosure names them." : 'The card does not report it.'
}

/** The agent's full profile, as the roster holds it: why it is here, what it carries, where it participates. No controls. */
function Profile({m, v}: {m: Model; v: V}) {
  const a = m.agent
  if (!a) {
    const {title, body} = missing(m, v)
    return <div className="ai-pane"><div className="ai-empty"><b>{title}</b><p>{body}</p></div></div>
  }
  const card = m.card, runs = card?.runsOn, self = card?.self
  return <div className="ai-pane">
    <header className="ai-pane-head">
      <FaceBox size={64} dim={a.ok !== true} />
      <div className="ai-who">
        <h3>{a.label}</h3>
        <p>{roleOf(a)} <span aria-hidden>·</span> <b data-ok={a.ok === true ? 'true' : 'false'}>{standingText(a)}</b> <span aria-hidden>·</span> profile {a.rev ?? NONE}</p>
        <small>{a.ref}</small>
      </div>
      <dl className="ai-facts">
        <div><dt>Runs on</dt><dd data-unread={runs ? undefined : 'true'}>{runs ?? NONE}</dd></div>
        <div><dt>World</dt><dd>{worldName(m.world)}</dd></div>
        <div><dt>Residence</dt><dd data-ok={m.ratified === true ? 'true' : 'false'}>{ratifiedWords(m.ratified)}</dd></div>
      </dl>
    </header>
    <div className="ai-cols">
      <section>
        <h4>Why I am here</h4>
        <p className="ai-purpose">{card?.purpose ?? NONE}</p>
        {!card && <p className="ai-note">No reading of the card.</p>}
        {self && <><h4>Authored self</h4>{self.opening && <blockquote>{self.opening}</blockquote>}<small className="ai-src">{self.path} · {self.digest ?? NONE}</small></>}
        {!self && card?.character === true && <p className="ai-note">Appears through its reusable expressive character.</p>}
      </section>
      <section>
        <h4>What I carry</h4>
        <ul className="ai-carry">
          {ORDER.map(kind => {
            const names = card?.carries[kind]
            return <li key={kind} data-zero={names && names.length === 0 ? 'true' : undefined}>
              <WoodMark kind={kind} size={22} set={marks(v)} />
              <span className="ai-carry-name"><b>{FORM_NAME[kind]}s</b><i>{FORM_ASKS[kind]}</i></span>
              <em>{names ? names.length : NONE}</em>
              <p>{carryWords(kind, card, names)}</p>
            </li>
          })}
        </ul>
      </section>
      <section>
        <h4>Where I participate</h4>
        <ul className="ai-worlds">
          {m.choices.length === 1 && <li><span>No reading of the Worlds</span><em>{NONE}</em></li>}
          {m.choices.filter(o => o.value !== 'home').map(o => <li key={o.value} data-here={o.value === m.world ? 'true' : undefined}>
            <span>{o.label}</span><em>{!card ? NONE : o.value === card.home ? 'home' : card.ratified === undefined ? NONE : card.ratified.includes(o.value) ? 'ratified' : 'not ratified'}</em>
          </li>)}
        </ul>
        <h4>Presence</h4>
        <p className="ai-purpose">{runs ? `Present, running on ${runs}.` : runs === null ? 'Not present in this World now.' : 'No reading of its presence.'}</p>
      </section>
    </div>
  </div>
}

// ---------------------------------------------------------------- the whole view

/** Identity's two bands: the Whole of Agent identity, and the Identity page of the Agent, which carries it. */
export function IdentityBands({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const m = model(p.v), c = m.card
  const accepted = m.roster?.filter(x => x.ok === true).length
  const rows: RowItem[] = !m.list
    ? [{id: 'unread', name: m.status === 'refused' ? 'Roster refused' : 'No reading of the roster', light: 'unknown', does: m.status === 'refused' ? SAYS.refused : SAYS.unread}]
    : m.list.length === 0
      ? [{id: 'none', name: 'No agent on the roster', light: 'unknown', does: 'Central reports no accepted agent. Turn on Proposed to show the others.'}]
      : m.list.map(x => ({id: x.ref, name: x.label, light: x.ok === undefined ? 'unknown' : x.ok ? 'lit' : 'dark', tone: 'green', note: x.rev ?? NONE, does: `${roleOf(x)} · ${standingText(x)}`}))
  return <>
    <Band>
      <Section width={206}><IdentityWell m={m} v={p.v} set={p.set} w={194} h={146} size="whole" /></Section>
      <Section label="Read" grow>
        {agentChooser(p, m)}
        {worldChooser(p, m)}
        <div className="ai-pair">{proposedToggle(p, m)}{standingReadout(m)}</div>
      </Section>
    </Band>
    <Band>
      <Section label="Card" cols={4}>
        <Readout label="revision" does="The revision of the agent's profile." value={m.agent?.rev} />
        <Readout label="skills" does="Skills the profile names." value={c?.carries.skill?.length} tone="value" />
        <Readout label="methods" does="Methods the profile names." value={c?.carries.method?.length} tone="value" />
        <Readout label="sets" does="SkillSets the profile names." value={c?.carries.skillset?.length} tone="value" />
        <Readout label="worlds" does="Worlds that have ratified the agent." value={c?.ratified?.length} />
        <Readout label="self" does="Whether the profile points at an authored self." value={c?.self === undefined ? undefined : c.self ? 'authored' : 'none'} />
        <Readout label="character" does="Whether the profile names an expressive character." value={c?.character === undefined ? undefined : c.character ? 'named' : 'none'} />
        <Readout label="accepted" does="Agents you accepted, of all the profiles on the roster." value={m.roster ? `${accepted} of ${m.roster.length}` : undefined} />
      </Section>
      <Section grow>
        <Rows label={`Roster · ${accepted ?? NONE} accepted`} does="The agents on your roster. A green light marks an agent you accepted. A dark light marks a proposed agent."
          items={rows} size={6} page={page} onPage={setPage} />
      </Section>
    </Band>
  </>
}

function IdentityWhole({p}: {p: ViewProps}) {
  return <Panel title="Agent identity" view="whole" {...head(p)}><IdentityBands p={p} /></Panel>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'central:agent-identity',
  title: 'Agent identity',
  kind: 'effect',
  defaults: {
    light: 'lit',
    // The parameters: whose card, whether the agents you have not accepted show, and the World the card is read in.
    agent: SAMPLE_SEATED, proposed: false, world: 'home',
    // Readings: what the owners report, never set from here.
    read: 'read', marks: 'blade', roster: sampleRoster(), card: sampleCard(SAMPLE_SEATED)!, worlds: JSON.stringify(SAMPLE_WORLDS),
  },
  fixtures: {
    Seated: {},
    'A proposed team lead': {agent: 'agent/anima', proposed: true, card: sampleCard('agent/anima')},
    'Not ratified here': {world: 'project:Archetypal-Earth'},
    'Roster refused': {read: 'refused', fault: 'Central returned an agent roster this desktop cannot read.', light: undefined, roster: undefined, card: undefined},
    'No readings': Object.fromEntries(['light', 'agent', 'proposed', 'world', 'read', 'fault', 'marks', 'roster', 'card', 'worlds'].map(k => [k, undefined])),
  },

  folded: p => {
    const m = model(p.v)
    return <Folded title="Agent identity" light={light(p)} readings={[m.agent ? short(m.agent.label, 14) : NONE, m.agent ? standingText(m.agent) : NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const m = model(p.v)
    return <Panel title="Agent identity" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><IdentityWell m={m} v={p.v} set={p.set} w={140} h={146} size="compact" /></Section>
      <Section label="Read" width={116}>
        {agentChooser(p, m)}
        {worldChooser(p, m)}
        <div className="ai-pair">{proposedToggle(p, m)}{standingReadout(m)}</div>
      </Section>
    </Panel>
  },

  whole: p => <IdentityWhole p={p} />,

  full: p => <Profile m={model(p.v)} v={p.v} />,

  widget: p => {
    const m = model(p.v), a = m.agent
    return <Tile title={`Agent identity · ${a ? short(a.label, 12) : NONE}`} light={light(p)} span={2} onFull={p.nav.full}>
      <IdentityWell m={m} v={p.v} w={112} h={100} size="mini" />
      <div className="ai-tile-side">
        <Readout label="standing" does="Accepted or proposed." value={a ? standing(a) : undefined} tone={a?.ok === true ? 'green' : undefined} />
        <Readout label="skills" does="Skills the profile names." value={m.card?.carries.skill?.length} tone="value" />
        <Readout label="world" does="The World where the card is read." value={m.world === undefined ? undefined : worldName(m.world)} />
        <Readout label="runs on" does="The program that runs the agent." value={m.card?.runsOn ?? undefined} />
      </div>
    </Tile>
  },
}
