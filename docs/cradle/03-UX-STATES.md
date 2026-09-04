# 03 — Cradle UX states

**Status:** design commitment. Every state below is derived from intent
(citations in each family), not from implementation nouns. The eventual app is
complete when every state here exists, is reachable, and is verified as stated
in [04-VERIFICATION.md](04-VERIFICATION.md).

Notation: **rest** = what a state looks like in the austere default;
**summoned** = what appears when depth is invoked. Absence of a region is a
state, not a defect.

---

## A. Inhabitation states — *does a World exist here?*

Derived from: existing Worlds are legitimate starting points (FP §2);
"install, then work" (inhabitation foundations §2); recognition is observation,
never failure (same, §1).

| State | Meaning | Rest shows | Exits to |
|---|---|---|---|
| `A0 Unrecognised` | No World/machine recognised yet | Empty canvas with a single act: *write, or recognise this machine* | `A1` |
| `A1 Recognising` | Machine/ground recognition in progress | Quiet progress line; never a blocking wizard | `A2` |
| `A2 Inhabited-minimal` | Ground + Work exist; no agents yet | Canvas + empty agency field ("no agents — create one from an intent") | `A3`, `D-create` |
| `A3 Inhabited` | Ground + projects + at least one Agency | The ordinary resting shape | — |
| `A2/A3.d Product absent` | A native product not installed | Its capabilities simply absent from the grammar; noted in composition reading, never an error dialog | — |
| `A*.d Degraded` | Present but partially serving (daemon stopped, stale handoff, no version flag) | Reading marked Degraded with the reason; identity unchanged | recovery |

Invariants: recognition asserts nothing about health it did not observe;
absence is an observation; partial compositions are legal.

## B. Focus states — *what are we talking about?*

Derived from: human/agent co-reference as one stable subject relation
(architecture §7); surface focus ≠ semantic selection.

| State | Meaning | Rest shows |
|---|---|---|
| `B0 No focus` | Nothing selected | Bare canvas; agency field still live |
| `B1 Focused(subject)` | One `SubjectRef` is current | The subject's surface owns the centre; quiet identity line shows World/Project beside the title |
| `B2 Multi-focus` | Split canvases, each with its own subject | Both surfaces; one has interaction focus |
| `B3 Promoted` | A summoned/left subject raised to centre | Same `SubjectRef`, larger region |
| `B4 Detached` | A surface in its own window (e.g. Observatory) | Native window; same `AgentSessionRef`/`SubjectRef` |
| `B5 Returned` | Detached surface re-docked | Same binding, original region |

Invariants: exactly one current focus relation kernel-wide; focus change is an
event every surface may consume; detaching and returning never mint new
identity.

## C. Writing states — *the primary human act*

Derived from: authored Flow as the default human act; authored ≠ commissioned ≠
returned ≠ accepted (design §2; FLOW.md).

| State | Meaning | Rest shows |
|---|---|---|
| `C0 Blank` | New Flow/thought, nothing yet | An empty page that is already a real Flow (blank start is first-class) |
| `C1 Authoring` | Writing as material | The text, nothing else; provenance: authored |
| `C2 Addressing` | The writing acquires recipients | Inline `To:` / `@` chips — human, agent, AgentSet; composition stays visible (Buzz grammar) |
| `C3 Commissioned` | Ask/Run hands the Flow (or a selection) to an Agency | The Flow remains; a commission record exists (what was sent, to whom, when) |
| `C4 Continuing` | Returned material appended/replied in the same Flow | Returned content visually distinct from authored (provenance-marked) |
| `C5 Conflict` | Concurrent revision (agent wrote, human wrote) | Revision-aware reconcile: both sides, never silent overwrite |

Invariants: `C0→C1` needs no ceremony; commission never mutates the authored
source; every crossing of the authored/commissioned/returned boundary is
recorded and visible.

## D. Agency states — *who is acting?*

Derived from: Actuation's constitution of agency (authority, bounds, Return);
Grok Bot durable teammate (#166); #155 D3 (AgentSets), D5 (Activity), D8
(Journey); inhabitation foundations §4 (acting, not just looking).

Creation:

| State | Meaning | Rest shows |
|---|---|---|
| `D-create Intent` | "What do you want this Agent to do?" | One intent paragraph + Create |
| `D-create Resolving` | Worlds / knowledge / capabilities / body / bounds being resolved | Which resolutions came from where, as they land |
| `D-create Determined` | Resolutions complete, inspectable | The determinations — editable before first act; authority bounds explicit |

Life (per agent, shown on the left map):

| State | Marker | Meaning |
|---|---|---|
| `D-idle` | ○ | Present, not engaged |
| `D-working` | ● | Acting now; live activity rows (read/edit/run/inspect → exact subjects) |
| `D-waiting` | ◐ | Needs something from the human |
| `D-attention` | ! | Human judgement required (subset of waiting: authority, Recognition, refusal) |
| `D-unavailable` | × | Body/harness unreachable — an observation, with reason |
| `D-returned` | ✓ | Produced a result awaiting the human's eye (folds into `D-idle` after recognition) |

Competence (accumulates across tasks): `skill used → method evidenced → routine
proposed → routine admitted (human recognition)`. Never self-granted.

Delegation shape: an agent may carry sub-agents (Agency); the map shows the
shape (`Epii ├── Rust agent ◆ testing └ UI agent ◆ working`). Sets (`AgentSet`)
are authored collectives — distinct from resolved membership, SharedField
membership, sessions, and co-actuation (#155 D3).

## E. Encounter states — *the conversation with an agent*

Derived from: the Buzz interaction specimen (#155 W9); Gateway continuity
(#154); the conversation mechanics of the encounter field.

| State | Meaning | Rest shows |
|---|---|---|
| `E0 Quiescent` | Session exists, no turn in flight | Last exchange, compact |
| `E1 Composing` | Human writing to agent(s) | `C2` grammar inside the encounter field |
| `E2 Streaming` | Agent turn in flight | Live tokens + live activity rows; interrupt available mid-turn |
| `E3 Permission-requested` | Agent requests authority for a consequential act | The request bound to the exact subject; grant/refuse with scope |
| `E4 Turn-complete` | Turn ended | Result + activity trail; session stays resident |
| `E5 Interrupted` | Human interrupted | Cause recorded in the session trail |
| `E6 Session-switched` | Same session from another surface (terminal, Telegram, harness UI) | Provenance of each encounter shown; one `AgentSessionRef` throughout |
| `E7 Observing` | Full Session Observatory (promoted/detached) | Conversation / activity / context / actions / runtime depths over the same session |
| `E8 Lineage` | Continue / refine-context / fork / recompose | Each shown as relation, never as a new agent |

Invariants: the stdio/session bridge never blocks the whole app; provider-native
conversation ids never collapse into canonical session identity; observability
of a session is never ambiently public.

## F. Context and knowledge states — *what may be known here?*

Derived from: the disclosure ladder (AIKit); legibility without capture (FP
1′); remember-this as epistemic act (design §7); provenance distinctions
(authored/observed/generated, FP §0).

Per subject-in-focus, on demand:

| State | Meaning |
|---|---|
| `F-eligible` | Could be disclosed into this act's horizon |
| `F-disclosed` | Actually disclosed — with the *why* (which relation selected it) |
| `F-excluded` | Present but out of horizon — with the why |
| `F-withheld` | Masked by selection — "not projected into this context" is a selection fact, not a missing file |
| `F-degraded` | Knowledge reading served from a lower provider class |

Knowledge apertures: `F-aperture` (selection-anchored neighbourhood popover) →
`F-surface` (promoted canvas tab). Promotion and dismissal never fork the node.

Remember-this destinations (human chooses): this Journey · Project/World
Knowledge · the agent's own World-relative knowledge · proposal toward authored
Ground → each lands with provenance `generated-proposal` until a human
Recognition act makes it authored.

## G. Development states — *Factory mode*

Derived from: Commission → … → Recognition as the Factory's own spine; Journey
above bounded Runs (#155 D8); "Factory is where work becomes structured
multi-agent development" (design §4).

| State | Meaning | Rest shows |
|---|---|---|
| `G0 Ordinary` | Work is not structured development | No Factory presence at all |
| `G1 Entering` | Work warrants structure | Canvas gains Factory mode: intent → Journey |
| `G2 Commissioned` | Journey authorised with direction | Journey card: purpose, participants, frontier |
| `G3 Running` | Runs acting under the Journey | Run rows with live states; the rest of the Cradle unchanged |
| `G4 Candidate-formed` | A coherent possible Project reality exists | Candidate with its Claims + Evidence |
| `G5 Recognition-pending` | Awaiting human judgement | Attention item naming the candidate |
| `G6 Recognised` | Candidate accepted / intention revised / refused | Decision recorded with provenance; Return closes the loop |
| `G7 Failed/returned` | Run or evidence path failed | Attributable failure, routed to the owning product |

Run depth ladder: semantic (Journey/Run/Candidate) → live (executions, activity)
→ trajectory (SSSF-grade trace). Three deliberate depths; never flattened into
one log.

## H. Material states — *where is this real?*

Derived from: Workcell's materialisation intent; "my laptop is the default
Workcell"; provider choices never leak upward (design §8).

| State | Meaning | Rest shows |
|---|---|---|
| `H-implicit` | Local machine serves, unnamed | Nothing (a status-line word at most) |
| `H-named` | Deliberate placement ("Runs on: Dev VM") | Placement line on the agent/run |
| `H-materialising` | Body being brought real | Quiet progress on the affected row |
| `H-relocated` | Semantic identity moved across bodies | Same `WorldRef`/session, new placement noted |
| `H-failed` | Materialisation/lifecycle failure | Attention item with owner-routed reason |

Invariants: deep Workcell administration lives in System depth and CLI, not in
the everyday grammar; placement is disclosed per agent/run, not per widget.

## I. Shared states — *other worlds*

Derived from: Projection/SharedField/Participant/Contribution/Encounter
(SHARED-FIELD.md); Identity ≠ Participant ≠ Presence ≠ Activity; addressing
carries no authority (#155 D4).

| State | Meaning | Rest shows |
|---|---|---|
| `I-private` | Default; nothing projected | Nothing |
| `I-projecting` | Composing a projection (audience, purpose, source revision) | Small compose sheet on the subject |
| `I-shared` | Projection live in a field | Provenance line on the subject |
| `I-encountering` | Others' material presented | Contribution thread where it anchors |
| `I-addressed` | Someone requests the person's attention | Attention item with mediation provenance |
| `I-contributing` | Returning an attributable difference | Composer bound to the field/subject |

Invariants: projection never transfers ownership; encounter records what was
presented, not what was believed; contributions stay attributable.

## J. Presentation states — *the shape of the window*

Derived from: austere rest with summoned depth (design §3); two state layers
(architecture §6); the P1 keyboard grammar.

| State | Meaning |
|---|---|
| `J-rest` | Agency field + canvas. Nothing else. |
| `J-summoned(region)` | Context · knowledge · terminal · trace · inspect · processes in their summoned region |
| `J-full` | The full workbench grammar: World navigator, splits, Cradle encounter panel, lower drawer |
| `J-focused-work` | Chrome minimised for writing; agency field collapsible to a strip |
| `J-detached(n)` | Detached windows in play |

Invariants: every summoned surface dismisses back to rest; presentation persists
professionally and never carries semantic state; regions resize/collapse
without changing what exists.

## K. Authority states — *what may happen?*

Derived from: Reading ≠ Action; authority gates (architecture §9.4); FP §4
(authorship, authority, refusal as high-leverage contact points).

| State | Meaning | Rest shows |
|---|---|---|
| `K-read` | Reading needs no authority | Silent |
| `K-proposed` | Agent proposes durable change | Proposal with provenance, awaiting Recognition |
| `K-grant-bounded` | Time/scope-bounded authority issued (e.g. one Action grant) | Visible grant; consumed on use |
| `K-refused` | Human declined | Recorded with reason; agent informed through Return |
| `K-expired` | Bound lapsed | Action fails closed — never re-asks silently |
| `K-escalated` | Beyond bounds → attention | Attention item naming bound and subject |

---

## Global invariants (apply to every state)

1. **Non-identities hold everywhere:** Reading ≠ Action · Surface ≠ Action ·
   UI selection ≠ Context disclosure · presence ≠ authority · masking ≠
   missing · degraded ≠ broken · authored ≠ observed ≠ generated · Projection
   ≠ Contribution ≠ source object · Participant ≠ Identity · encounter ≠
   belief.
2. **Semantic state is kernel/product-owned; presentation state is
   desktop-owned; neither derives from the other** (§6 of architecture).
3. **Degradation and absence are first-class observations**, rendered where the
   thing would have been — never as modal error, never fabricated.
4. **Every attention item names an exact subject** and resolves to it in one
   act.
5. **Agent-native parity:** agents get complete structured state over the same
   actuality; humans get progressive disclosure of the same facts — never two
   divergent truths.
6. **Keyboard and pointer parity** on every interaction the Buzz grammar
   contributes (compose, address, dismiss, promote).
