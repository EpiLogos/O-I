# 01 — Cradle design: intent and experience

**Status:** authored design position for the O:I desktop.
**Upstream:** `docs/positions/FOUNDING-POSITIONS.md`, `docs/VISION.md`, O:I #103/#154/#155/#158/#166.

## 1. What the Cradle is

O:I is deliberately building the higher-order environment. The Cradle is the
first-party meta-harness in which the human, Agents, Projects, knowledge, tools,
harnesses, machines, development and shared worlds become **one operable
environment**.

Central, Actuation, AIKit, Factory and Workcell are not external apps the
desktop politely displays. They are the **native powers from which the
environment is constituted**. The desktop owns the whole application experience
and composition; the products own the deeper mechanics particular to their
function.

Visually the Cradle is a window. Constitutionally, **the Cradle is the whole
active application situation**: which World, which Project, what is in focus,
which Agencies are present and acting, what surfaces are composed, what is
materially real, and what requires the human. That situation is modelled in
[02-ARCHITECTURE.md](02-ARCHITECTURE.md) as the application kernel.

This is the same relation the Omarchy work (#158/#159) makes explicit one level
up: the O:I desktop is the integral application body, and can itself become a
native constituent of a still larger host environment. Neither level absorbs the
other.

## 2. The human premise: writing is the primary act

The desktop's first human primitive is **writing, not navigating**.

A person writes in the canvas — a thought, a brief, a question, a plan, a
specification, a refusal. That writing is an ordinary **Flow**: authored material
that remains theirs whether or not anything is ever asked of it (`docs/FLOW.md`).
From there, one deliberate act — *ask* / *run* — hands the writing to an Agent
or AgentSet as commission, context or prompt, **without the writing becoming
disposable chat input**.

```text
authored Flow
     │  ask / run
     ▼
Agent / Agency  ── acts in the Worlds available to it ──▶
     │
     ▼
returned work, evidence, difference
     │
     ▼
the human continues writing
```

This loop is the founding relation of the whole programme (`FOUNDING-POSITIONS`
§0→§4): authorship is where the person has maximum leverage; delegated work
returns room for human agency; what returns can be recognised, refused, or
revised. The desktop exists to make this loop ordinary.

Provenance distinctions survive the loop intact: **authored material ≠ sent
commission ≠ returned work ≠ accepted revision.** The canvas never silently
converts one into another.

## 3. The everyday shape: austere, with depth summoned

The three-panel/tabs workbench is a **latent spatial capability**, not three
permanently occupied dashboards. Most of the time the Cradle is almost bare:

```text
┌───────────────┬──────────────────────────────────────────────────────┐
│               │                                                      │
│    AGENCY     │                  FLOW / CANVAS                       │
│               │                                                      │
│  Guardian  ○  │       write · think · code · design · prompt         │
│  Epii      ●  │                                                      │
│  Research  ◐  │       the authored thing remains central             │
│               │                                                      │
│  activity     │                                                      │
│  relations    │                                                      │
│  sessions     │                                                      │
│               │                                                      │
├───────────────┴──────────────────────────────────────────────────────┤
│ only when invoked: context · knowledge · terminal · trace · inspect  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Agency lives at the left** — a compact, live map of who is present and what
  is actually happening (§5).
- **The work lives in the centre** — the authored thing itself: document, code,
  conversation, trajectory, running application, shared thread. The centre shows
  the thing, not commentary about the thing.
- **Everything else is summoned** — World navigator, knowledge, agent context,
  terminal, trace, inspect, processes. Summoned depth appears beside, below, or
  in place of the work, and dismisses back to rest.
- **No fat chrome.** World/Project identity sits quietly beside the document
  title. Search/command is one shortcut. Attention is small state attached to
  the agents that require it — a badge on Epii, not a global siren.

When the work warrants it, the same space expands into the full workbench
grammar: World navigator (World / Knowledge / Journeys / Shared), centre splits,
Cradle encounter panel, contextual lower drawer for terminal, processes, trace
and evidence. These are the **same surfaces at larger area**, entered by
promotion — never separate applications or modes of the data.

The resting shape is the product. The full grammar is its depth.

## 4. The application hierarchy

```text
                       HUMAN
                         │
                         ▼
                  FLOW / CANVAS
                writing / making
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
           AGENCY                WORLD
      access + live          files + knowledge
      observation            available to act
              │                     │
              └──────────┬──────────┘
                         ▼
                      ACTION
                         │
               ┌─────────┴─────────┐
               ▼                   ▼
        ordinary Agent work    FACTORY
                               structured
                               multi-Agent work
                         │
                         ▼
                  MATERIAL BODY
                    Workcell — mostly implicit
```

Ordinary: write → ask Epii → work happens → it returns. Structured: when the
work warrants multi-agent development, the canvas enters **Factory mode** —
Journey, plan, AgentSet, Runs, Candidates, Evidence, Recognition. Material
reality is felt, not stared at: "runs on this Mac" by default; placement becomes
visible only when it becomes consequential.

## 5. Agency at the left: a living map, not a chat sidebar

The left field is a compact **agency map and log** — presence, current intent,
live activity, relations, sessions — inspired by the DeepSeek Harness's ability
to show the whole activity shape.

At rest it answers one question: *who is doing what right now?*

```text
● Epii      editing desktop host
● Dev       ├ Rust agent  testing
            └ UI agent    working
◐ Research  waiting on you
○ Guardian
```

Expanding an agent reveals, in place: current intent, activity (read / edit /
run / inspect — each row resolving to the exact subject), the Worlds the agent
stands in, its current session. At full depth it becomes an interactive agency
graph — agent, worlds, current act, knowledge, tools — and promotes into the
canvas as a **Session Observatory** when the person really wants to watch.

One view therefore covers agent access, observation, delegation, session
switching and live activity — without separate "Agents", "Activity", "Sessions"
and "Runtime" screens. The same agent, actuated through the Agency Gateway
(#154), is encounterable from the desktop, a terminal, Telegram or Slack: these
are encounter surfaces around one Agency, not new agents.

## 6. Agents are durable teammates created from intent

Agent creation begins the way work with a person begins:

```text
New Agent
What do you want this Agent to do?
[ Help me develop the O:I desktop. Understand its design,
  work across the relevant repos, and improve its
  implementation over time. ]
                         Create
```

From that intent, the field resolves what exists: relevant Worlds and Projects,
relevant Knowledge, available tools/skills/methods, a model and harness body,
authority and access bounds. The human inspects and changes those
determinations — but they are **resolutions to inspect, not a forty-field form
to fill before anything exists** (Grok Bot lesson, #166).

The agent then develops competence through repeated work:

```text
task → tries knowledge + tools + skills → result
     → what worked / failed
     → knowledge update, skill evidence, possible Method refinement
     → next task
```

**Skill → Method → Routine**: a faculty used, a successful practice made
explicit, a proven practice admitted to unattended routine. This is accumulation
of competence around actual work — never autonomous self-rewriting; every step
that would become durable ground or unattended authority passes a human
recognition point.

## 7. Knowledge is reached, not resident

Knowledge does not occupy permanent screen space. It is part of what an agent or
human can **reach from a World**, and appears in two scales:

- **Aperture.** Select a phrase in the canvas, invoke knowledge: a small local
  graph/wiki aperture — the node, its neighbourhood, sources, history — anchored
  to the selection. Dismiss or promote.
- **Surface.** When knowledge becomes the work, it promotes to a full canvas
  tab. Same subject, same binding, larger area.

Agent context is shown the same way — compact, on demand, and honest:

```text
CONTEXT — Epii / current act
O:I World     Desktop design        ✓ disclosed
              Founding Positions    ◌ eligible
              old CI work           – excluded
Why? selected file → Desktop relation; current Journey → Cradle
```

Eligible versus actually-disclosed, with reasons, is the human counterpart of
the agent's operative horizon — the disclosure ladder (`available ≠ eligible ≠
selected ≠ projected ≠ loaded ≠ invoked`) made visible. "Remember this" is a
real epistemic act: the human chooses the destination (this Journey, Project
Knowledge, the agent's own World-relative knowledge, or a proposal toward
authored Ground), and generated material only becomes durable source through
that explicit act.

## 8. What each product means in the experience

The desktop is bound to the native visions of the six centres as they describe
themselves in their own repositories. The Cradle owes each of them a specific
experience and must never absorb their semantics.

| Centre | Native intent (its own words) | In the Cradle experience |
|---|---|---|
| **Central** | "A human-owned operating root for a technological life"; authored / observed / inferred kept distinct; "Control says what should persist. `ctrl` says what can be done." | The World. Real files, real Ground, ordinary editing, full history. The account the person owns; the tree agents get deliberate views into. |
| **Actuation** | "The constitution and management of technological agency"; "downward authority requires upward reality". | Who is acting, under what authority, with what bounds — and the Return path through which encountered reality alters the governing picture. |
| **AIKit** | "The operative composition and disclosure layer for heterogeneous agentic worlds"; `exists ≠ eligible ≠ available ≠ selected ≠ projected ≠ loaded ≠ invoked`. | What powers, context, knowledge and body are available *here and now*; the composition of the agent's operative horizon; the body a session runs in. |
| **Software Factory** | Development durable "from authored intention through design, development, evidence, candidate formation, Recognition and Return"; human attention at Commission and Recognition. | Factory mode: the canvas state in which work becomes structured multi-agent development — Journey, Runs, Candidates, Evidence, Recognition. |
| **Workcell** | "The technological materialisation product"; provider choices never leak upward into semantic identity. | The material body, mostly implicit: "this Mac" by default; named machines, services and placement exactly when consequential. |
| **Quaternal Logic** | "The formal and experimental field… making archetypal and relational form technically answerable", under operational parity. | Instruments, present when invoked (QL/Epi surfaces), never a prerequisite for ordinary use. |

SharedField (whole-level) appears as another mode of inhabitation: a Project or
Knowledge subject can acquire participants; the same addressing grammar (To: /
@) reaches humans, agents and AgentSets; Projection, Contribution and Encounter
keep provenance and alterity intact.

## 9. Activity, attention, and where the human touches

Most activity stays quiet. A person should be able to work while five agents
run, without watching five transcripts.

```text
Activity ──▶ Completed ──▶ Return
        ──▶ Failed ──┐
        ──▶ Waiting ─┴─▶ ATTENTION ──▶ resolved ──▶ work continues
```

Attention is the primary human aperture: permission needed, a candidate ready
for Recognition, a bound refused, a materialisation failed. Each attention item
names the exact subject and resolves to it. This is founding position §4 made
concrete — the person touches the system at authorship, authority, Commission,
Recognition, revision and refusal, not inside every loop.

## 10. The desktop as a research instrument

O:I is a research programme: hold model capacity, vary the surrounding
arrangement, observe what changes in the resulting agency
(`docs/RESEARCH.md`). The Cradle is the primary instrument for that programme,
so it must make the variables observable in the ordinary course of work:

- **What World was available** — the agent's eligible vs disclosed horizon, with reasons.
- **What the human supplied** — authored ground, commission, authority grants, interventions.
- **What the agent actually did** — semantic activity over raw protocol, attributable.
- **What returned** — work, evidence, difference, dissent, refusal.
- **What was recognised** — accepted, revised, refused, left open.

The desktop must not smooth these into a comfortable summary. A research
environment that hides its variables cannot run experiments. Quiet by default,
inspectable on demand, honest about absence and degradation — these are research
requirements, not aesthetic preferences.

## 11. What success means

The Cradle succeeds when the everyday loop is real: **write something; bring
Agency to it; let that Agency inhabit as much of the Worlds as it legitimately
needs; see what it is actually doing; pull knowledge and context into view when
useful; escalate into Factory when work becomes structured development; let
Workcell quietly make the required body real.**

Not a better dashboard. A live meta-harness in which files, knowledge, agents
and their activity already constitute one working situation.
