# 04 — Verification

**Status:** the conditions that hold when the Cradle exists as designed.
**Companions:** [01-DESIGN.md](01-DESIGN.md) (intent), [02-ARCHITECTURE.md](02-ARCHITECTURE.md) (structure), [03-UX-STATES.md](03-UX-STATES.md) (states).

## 1. What verification means here

Every condition in this document is settled by **operating the application**.
Code, tests, and contracts in other repositories prepare a condition; only the
running app, driven by a person doing real work, establishes it. Each condition
is phrased so that one walk through the app settles it.

## 2. The spine: the everyday loop

The app is verified when, from a cold start on a machine with a Central ground —
no environment variables, no handoff files, no development setup — a person can
run the whole loop of the design (01 §11):

> write something → bring Agency to it → the Agency inhabits the Worlds it
> legitimately needs → the person sees what it is actually doing → knowledge and
> context come into view when summoned → the work escalates into Factory when it
> becomes structured development → the material body stays implicit → work
> returns → the person recognises, refuses, or revises.

When that loop runs natively end to end, the Cradle exists. The sections below
state the conditions per area, so that partial reality is always precisely
located.

## 3. Conditions per area

**Inhabitation.** The app starts from whatever exists. With no World configured
it offers one act: write, or recognise this machine. Recognition reads the live
machine — installed harnesses, tools, daemons — and the composition reading
names exactly what is present, absent, and degraded, as observed. Stopping a
daemon or renaming a binary degrades the affected reading in place; identity is
intact; nothing reports failure that is only absence.

**Focus.** Selecting a subject anywhere — file, knowledge node, agent, run,
contribution — sets the one application-wide subject. Every surface that can use
a subject uses the same one; there is no component-local selection state.
Promoting a summoned surface to the centre, splitting it, detaching it to a
window, and returning it, all preserve the identical subject.

**Writing.** A new canvas is a real Flow the moment it exists — blank start is
first-class, no ceremony. Writing is authored material with provenance;
commissioning hands it (or a selection of it) to an agent without mutating it;
returned material appears in the same Flow, visually distinct; concurrent human
and agent revision meets a reconcile state that offers both sides and never
overwrites silently.

**Agency.** An agent comes into being from one stated intent; its worlds,
knowledge, capabilities, body and bounds resolve from live sources and are
inspectable and editable before its first act. The left map shows true presence
for every agent — working, waiting, attention, idle, unavailable, returned —
with live activity rows that resolve to exact subjects. Competence accumulates
visibly: skill used, method evidenced, routine proposed; admission to unattended
routine requires an explicit human act.

**Encounter.** Conversation with an agent streams live and can be interrupted
mid-turn; concurrent sessions do not block one another; a permission request
appears bound to its exact subject and is granted or refused with scope. The
same session opened from the desktop and from any other encounter surface —
terminal, messaging, harness UI — is one session with one identity, each
encounter recorded. Addressing a set addresses its members without collapsing
membership, addressing, invocation, authority, or attention into one another.

**Context and knowledge.** Selecting a phrase summons the knowledge aperture:
the node, its neighbourhood, its sources and history — dismissible, or
promotable to a canvas tab without forking identity. An agent's context is
inspectable at any moment as eligible / disclosed / excluded / withheld, each
with its reason. "Remember this" writes to a destination the human chooses and
lands as a proposal carrying generated provenance until a human act makes it
authored. Knowledge served from anything below its native provider renders that
fact.

**Development.** Ordinary work carries no Factory presence. When work warrants
structure, the canvas enters Factory mode: intent becomes a commissioned
Journey; Runs act beneath it with live states; a Candidate forms with its claims
and evidence; Recognition is requested as attention naming the candidate; the
decision is recorded with provenance and returns into the Journey. Semantic,
live, and trajectory views remain three distinct depths of the same run.

**Material.** Work runs on the local machine by default and says almost nothing
about it. Deliberate placement names the machine on the agent or run;
relocation preserves semantic identity; materialisation failure becomes an
attention item routed to its owning product. Deep material administration lives
in the system depth and the CLI.

**Shared.** A subject can be projected — audience, purpose, source revision —
without transferring ownership; the projection carries its provenance line.
Encountered contributions appear where they anchor and remain attributable; an
address requesting the person's attention arrives with its mediation provenance.
With no live shared substrate, the desktop renders read-only honesty rather
than simulating participation.

**Presentation.** The resting shape is the agency field and the canvas, nothing
else. Every summoned depth dismisses back to rest without residue. The full
workbench grammar is reached by promotion, not by leaving into a different
destination set. Layout persists across restarts and contains no semantic
selection.

**Authority.** Every mutation traverses a visible authority gate; nothing
mutates through ambient filesystem, shell, or network power; rendered
contribution code is never a privileged caller. Grants are bounded and consumed
on use; expired bounds fail closed; a proposal only becomes authored ground
through Recognition, with both provenances recorded.

## 4. Agent-native parity

At every point above, an agent using only the structured state the application
itself exposes can reconstruct the same actuality a human sees — the same
subjects, activity, attention and provenance. The human gets progressive
disclosure; the agent gets complete structure. There are not two truths at any
altitude.

## 5. Build order

The verticals, in order. Each carries its kernel service and a working UI
specimen, operating end to end, before the next begins. The UI need not be
visually final; it must preserve the interaction contract of 01 and 03.

1. **Writing + World** — Central / WorldService: Flow authoring, real file open
   and edit through Central owner-Actions, conflict, history, and the global
   focus model live over source subjects.
2. **Agency encounter** — AgencyService and the Gateway: intent-created agent,
   streaming conversation, live activity, permission and attention, interrupt,
   observatory promote and detach, session continuity across one other surface.
3. **Knowledge in action** — KnowledgeService: search, selection-anchored
   aperture, neighbourhoods, relation to focus, remember-this, disclosure
   receipts with reasons.
4. **Attention** — AttentionService: activity → notification → attention over
   the real session stream; every item resolves to its subject.
5. **Factory mode** — DevelopmentService: Flow → Journey → Runs → Candidate →
   Recognition, with the trajectory depth mounted.
6. **Material** — MaterialService: implicit local placement, named placement,
   relocation, failure routing.
7. **Shared** — SharedFieldService: projection, encounter, contribution, on
   whatever live substrate SharedField has — read-only until there is one.

Verticals 1–3 establish the kernel, focus, surface bindings, events, and the
left-field mechanics that 4–7 plug into.

## 6. Acceptance

The app is accepted when the everyday loop of §2 has been lived in — used for
real work over a sustained period on a physical machine — with every condition
of §3 holding throughout that use. Acceptance is recorded as a receipt: what
was done, on which machine, what returned.
