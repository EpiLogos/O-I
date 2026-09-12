---
Register: episteme
Standing: design-commitment
---

# 03 — Cradle UX states

**Status:** design commitment. Every state below is derived from intent
(citations in each family), not from implementation nouns. The eventual app is
complete when every state here exists, is reachable, and is verified as stated
in [04-VERIFICATION.md](04-VERIFICATION.md).

Notation: **rest** = what a state looks like in the austere default;
**summoned** = what appears when depth is invoked. Absence of a region is a
state, not a defect.

The 12 September CAW reconciliation extends the existing families below and the
everyday-loop spine in 04 §2. It follows the exact Day/Dialogue sources and
Factory #195 / O:I #220 authorial amendments, rather than deriving intent from
implementation or pull requests. Current Wave 6–8 file-opening, source and
participation rules refine earlier shorthand without discarding these states.

---

## A. Inhabitation states — *does a World exist here?*

Derived from: existing Worlds are legitimate starting points (FP §2);
"install, then work" (inhabitation foundations §2); recognition is observation,
never failure (same, §1).

| State | Meaning | Rest shows | Exits to |
|---|---|---|---|
| `A0 Unrecognised` | No World/machine recognised yet | Empty canvas with a single act: *write, or recognise this machine* | `A1` |
| `A1 Recognising` | Machine/ground recognition in progress | Quiet progress line; never a blocking wizard | `A2` |
| `A2 Inhabited-minimal` | Ground + Work exist; no available Agency yet | Canvas + honest agency entry; create or encounter an eligible Agent without pretending one exists | `A3`, `D-create` |
| `A3 Inhabited` | Ground and an available Agency, with child Projects where present | The ordinary resting shape, including root work without a child Project | — |
| `A2/A3.d Product absent` | A native product not installed | Its capabilities absent from the current grammar; explained in composition reading, never an error blanket | — |
| `A*.d Degraded` | Present but partially serving (daemon stopped, stale binding, no version flag) | Reading marked Degraded with reason and actual available recovery; identity unchanged | recovery |

Invariants: recognition asserts nothing about health it did not observe;
absence is an observation; partial compositions are legal. Central is the root
meta-Project, not just configuration and not a child Project to manufacture.
Unreadable, withheld, unrecognised and absent ground remain distinct.

### A.U — Updating the system while remaining in one's work

Derived from the user's suite-convergence/upgrade/repair commission, O:I #97,
#220 and BOOT-13 in `BOOTSTRAP-AND-LOADING.md`. These are refinements of A*.d,
E.G and H, not another onboarding wizard or new runtime ontology.

| Situation | Required experience and exit |
|---|---|
| Understanding the installation | Explain the relevant source, built, installed, registered, running and loaded-practice facts; keep unaffected writing available |
| Reviewing a developer update | One operator explains change, scope, active-work hold and rollback. Proceed/defer/refuse does not require the human to schedule repository dependencies |
| Updating under existing authority | Preserve dirty work and pending operations; show actual bounded stages without fake percentages; no old process labelled as the newly installed one |
| Update/activation fails | Retain prior usable state and uncertain effects; explain the first failed relation and a real owner repair/recovery path |
| Repair or rollback | Act on current evidence and authority; preserve human source and history; code rollback does not imply irreversible effects were undone |
| Continuing after update | Restore the same subject, pending Return and permissible context using actual provider continuation or explicit rehydration; publish the new exact tested cut |

A full developer-suite campaign accounts for all seven repositories and their
companions; ordinary app use still supports a smaller composition. Full
installed proof is not a prerequisite for independent repository coding. A
session owns the connective work and next handoff; the human is not its message
bus. Walk these situations using 04 §6.1–6.2 and the existing CAW cases.

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
returned ≠ accepted (design §3; FLOW.md); exact Day/Dialogue sources and the
current Wave 6 file-opening determination.

| State | Meaning | Rest shows |
|---|---|---|
| `C0 Blank` | Blank writing or a chosen existing document with no text yet | Empty page is valid; opening the blank tab does not itself mint a Flow or require completing a form |
| `C1 Authoring` | Writing as material | The text, nothing else; provenance: authored |
| `C2 Addressing` | The writing acquires recipients | Inline `To:` / `@` chips — human, agent, AgentSet; composition stays visible (Buzz grammar) |
| `C3 Commissioned` | An explicit request sends selected material; Factory Commission only when developmental work is requested | The writing remains; the actual request/Commission records what was sent, to whom and when |
| `C4 Continuing` | Returned material is received and, when reviewed, included in the same document | Pending Return and included H contributions distinct from human text and from one another |
| `C5 Conflict` | Concurrent or stale revision | Revision-aware reconcile: both sides, no silent overwrite or anchor relocation |

Invariants: `C0→C1` needs no ceremony; sending never mutates the human source;
selection is not disclosure/authority. Every crossing of authored, requested,
returned and included standing is recorded without treating inclusion as truth.

### C.T — Human Day, Flow/Dialogue and agent NOW

The Day is the person's writing and receiving surface. NOW is an Agent-maintained
bounded clearing for activity under granted scope, with explicit T plans,
findings, coordination and tracking. The relation repeats at Central/Control and
ProjectCentral through native refs. Project views compose eligible root/Project
contributions, not synchronised editable copies of the person's day.

Flow and Dialogue share entries, IDs, revisions, media, reply anchors and
annotations. The supplied Journal collection is not automatically converted into
a Dialogue/Flow entry. HTML or another projection may instantiate this faithfully
without reproducing a specific component layout.

Concurrent Agents append to the owner receiving ledger, not race to rewrite Day
HTML. Receipt, review/inclusion, acknowledgement, personal task completion,
Factory Recognition and Git integration are separate facts. An untouched H
contribution can be replaced only by its own authorised producer against the
exact current revision; human-edited H is protected human material.

Day rollover follows actual adopted time policy. It does not swap the open
editor, complete/copy personal tasks, close human writing, archive active NOW or
invoke a model merely because time passed. Late Returns retain occurrence and
receipt times and reach the current receiving aperture with original context.
Archival retains pending obligations, source history and re-entry routes.

Portable Save HTML copy remains self-contained and does not overwrite the
original. Native acknowledged save/autosave is separately disclosed. Passive
open/select/save/view-switch invokes no Agent. Exact CT4b fixtures and source
keys, blank-field freedom and explicit scope survive every projection.

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
| `D-waiting` | ◐ | Waiting on an identified dependency or participant; not automatically a demand on the human |
| `D-attention` | ! | Human judgement required (subset of waiting: authority, Recognition, refusal) |
| `D-unavailable` | × | Body/harness unreachable — an observation, with reason |
| `D-returned` | ✓ | Produced an attributable result; awaiting review only where that is required, without equating delivery or later idleness with Recognition |

Competence (accumulates across tasks): `skill used → method evidenced → routine
proposed → routine admitted` through the actual owner and required acceptance.
Never self-granted. A Method is a Skill whose **description** starts `METHOD:`;
classification is not a new identity, grant, schedule or success status.

Delegation shape: an agent may carry sub-agents (Agency); the map shows the
shape (`Epii ├── Rust agent ◆ testing └ UI agent ◆ working`). Sets (`AgentSet`)
are authored collectives — distinct from resolved membership, SharedField
membership, sessions, and co-actuation (#155 D3).

### D.P — Participation and assistance

Actuation Agent identity plus admissible World participation can be disclosed
without a Central AgentProfile. A Profile adds durable authored residence and
configuration; visibility grants no default selection, access or execution.
Declared/unresolved membership and observed situated Agency remain different.
Later Profile adoption enriches the same Agent/Paśu subject; withdrawal changes
current reachability without erasing permitted historical attribution.

The existing root Agent can help the person compose work in **Do with me / Teach
me / Do for me** modes. Teach explains without secretly executing; collaboration
stages choices; delegation acts under existing bounds and returns genuine human
choices. No mode grants authority or authors human intent. Preserve intended
difference, selected source, closure/evidence condition and deliberate constraints
from preview through actual commissioning. See AIKit TUI UX §§5–7 and 04 §6.3–6.4.

## E. Encounter states — *the conversation with an agent*

Derived from: the Buzz interaction specimen (#155 W9); Gateway continuity
(#154); the conversation mechanics of the encounter field.

| State | Meaning | Rest shows |
|---|---|---|
| `E0 Quiescent` | Session exists, no turn in flight | Last exchange, compact |
| `E1 Composing` | Human writing to agent(s) | `C2` grammar inside the encounter field |
| `E2 Streaming` | Agent turn in flight | Live tokens + live activity rows; interrupt available mid-turn |
| `E3 Permission-requested` | Agent requests authority for a consequential act | The request bound to the exact subject; grant/refuse with scope |
| `E4 Turn-complete` | Turn ended | Result + activity trail; session stays resident where the provider does |
| `E5 Interrupted` | Human interrupted | Cause and actual cancellation/quiescence state retained |
| `E6 Session-switched` | Same session from another supported surface | Provenance of each encounter; one canonical identity without invented provider continuation |
| `E7 Observing` | Full Session Observatory (promoted/detached) | Conversation / activity / context / actions / runtime depths over the same session |
| `E8 Lineage` | Continue / refine-context / fork / recompose | Actual lineage disclosed; a view switch never creates an Agent, and explicit derivation follows Actuation's own identity law |

Invariants: the stdio/session bridge never blocks the whole app; provider-native
conversation ids never collapse into canonical session identity; observability
of a session is never ambiently public.

Recorded conversation, prepared operative context and the provider's retained
continuation state are separate. A transcript on disk does not prove it entered
the new acting context. Compaction retains source range/producer, required
identity/governance, pins, unanswered requests and arrivals across its committed
cursor. Native resume, selected-context rehydration and a fresh attempt are
named distinctly. No hidden reasoning capture is required.

### E.G — Gateway continuity and the right-hand encounter

Owner-directed clarification, 2026-09-06; derives from #154 and architecture §14.
Agent details and Conversation / Activity / Context / Inspect are the dynamic
right-hand encounter section, including the appropriate actual subject content.
Do not duplicate that section above the canvas or substitute a fixed generic
inspector. Full/side/tab/detached are presentations of the same owner encounter;
view changes never make another transcript or composer.

| State | Required presentation and transition |
|---|---|
| `E.G absent` | Name Gateway/ecology absence and what cannot be reached; available local work stays usable; no perpetual loading or invented empty session list |
| `E.G restricted` | Show only the authorised ecology; distinguish no visible sessions from an unavailable read; discovery is not permission to attach/invoke |
| `E.G attaching` | Requested canonical session and actual owner operation remain visible; cancelled/refused/unsupported attach returns to prior usable context |
| `E.G connected` | Agent details and all four planes co-refer to the same authorised session/Stream; indicate actual provider/material origin where appropriate |
| `E.G reconnecting/last-observed` | Keep original identities/draft and observation age; reconcile native cursor/replay without duplicate messages, invented continuity or implicit new turn |
| `E.G lost/rematerialised` | Surface or remote Workcell loss is local degradation; process/socket/Fabric change does not rename session; explicit lineage if native continuation changes |
| `E.G subject-switched` | New subject gets its own relevant planes/availability; clear prior agent/history/context immediately; restore workspace-scoped view state without moving attention on incoming activity |

Walk E6/E7 through actual Gateway seams, including local detach/re-dock and a
second Surface/remote Workcell projection. Record canonical Agency/Session/Stream
refs, serving carrier, ordered cursor and authority separately. A browser view
reload over local ACP does not by itself prove E6 cross-context continuity.

Addressed requests and bounded parallel exchanges use actual resident dispatch
and attributable response. A journal append or ACK is not delivery/completion.
Machine contributions do not overwrite human drafts. Conversation participants
are not automatically an authored AgentSet. Sharing from a private exchange
requires its own authorised material relation. Queues, retries and automatic
exchanges have finite bounds; ordinary acknowledgements cannot create a loop.

## F. Context and knowledge states — *what may be known here?*

Derived from: the disclosure ladder (AIKit); legibility without capture (FP
1′); remember-this as epistemic act (design §8); provenance distinctions
(authored/observed/generated, FP §0).

Per subject-in-focus, on demand:

| State | Meaning |
|---|---|
| `F-eligible` | Could be disclosed into this act's horizon |
| `F-disclosed` | Actually disclosed — with the why (which relation selected it) |
| `F-excluded` | Out of the authorised horizon; explain only what the caller may know |
| `F-withheld` | Not projected into this context; a selection/policy fact, not a missing-file assertion |
| `F-degraded` | Knowledge reading served from a lower provider class |

Knowledge apertures: `F-aperture` (selection-anchored neighbourhood popover) →
`F-surface` (promoted canvas tab). Promotion and dismissal never fork the node.

Remember-this destinations (human chooses): this Journey · Project/World
Knowledge · the Agent's own World-relative knowledge · proposal toward authored
Ground. Preserve generated provenance and the destination's native admission.
Human-authored Ground requires explicit acceptance; Agent-owned operational
knowledge follows its bounded return/write law. Neither operation silently
promotes a generated statement into the human's words or triggers contemplation.

Skills and tools are encountered through descriptions, schemas and source refs.
A source being registered/selected/projected does not establish a harness link,
loaded context or demonstrated practice. Show the failed step and its real
repair. Private Central repertoire sources are resolved through AIKit, not
copied into a desktop or O:I-owned foreign-Skill catalogue.

## G. Development states — *Factory mode*

Derived from: Commission → … → Recognition as the Factory's own spine; Journey
above bounded Runs (#155 D8); Factory as structured developmental execution.

| State | Meaning | Rest shows |
|---|---|---|
| `G0 Ordinary` | Direct work without Factory execution | Direct work remains visible without Factory ancestry; unrelated Factory work may coexist |
| `G1 Entering` | Explicitly request structured development | Canvas gains Factory mode: intent → Journey |
| `G2 Commissioned` | Journey authorised with direction | Journey card: purpose, participants, frontier, expected Return |
| `G3 Running` | Actual attempts act under the Journey | Run rows with evidenced live states; the rest of the Cradle unchanged |
| `G4 Candidate-formed` | A coherent possible Project reality exists | Candidate with its Claims + Evidence, alternatives retained |
| `G5 Recognition-pending` | Awaiting human judgement | Attention item naming the candidate |
| `G6 Recognised` | Candidate accepted / intention revised / refused | Decision recorded with provenance; Git integration and human document inclusion remain separate |
| `G7 Failed/returned` | Run or evidence path failed | Attributable failure and preserved effects/obligations; real owner recovery available within authority |

Run depth ladder: semantic (Journey/Run/Candidate) → live (executions, activity)
→ trajectory (SSSF-grade trace), with Cognitive when the owner supplies it.
Deliberate readings of one work, never flattened into a log or a score.

### G.W — Working copies, environments and returned alternatives

For Candidate-isolated work, current source/context, working directory, writes,
checks and returned diff must identify the same intended exact-base worktree.
The task NOW carries its coordination/evidence/Return relations. The human's
dirty checkout, other Candidates and pending uncommitted material remain intact.
A worktree outside Work still belongs to its declared Project rather than being
silently stamped as a new Project or discarded as litter.

Working-environment intent retains **preference versus requirement**, separately
from the effective SessionSpace/Surface and material body. Required Herdr/mux/
native arrangements cannot vanish on dispatch or retry; permitted fallback is
explained. Open/focus elsewhere uses owner operations without new Commission or
duplicate work. Detach is not cancel. Recovery reconciles uncertain effects and
revalidates current source, authority and budgets before a new attempt.

Compare distinct Candidates by actual bases/results, Claims/Evidence,
contradictions, independent verifier lineage, diffs and previews. Navigation is
read-only. Recognition does not assert a successful merge against a changed
base. Return reaches the human receiving destination even with the UI closed;
source/usage/history remains available behind concise human language.

## H. Material states — *where is this real?*

Derived from: Workcell's materialisation intent; local machine as valid Workcell;
intentional placement and bounded native provider facts (design §9).

| State | Meaning | Rest shows |
|---|---|---|
| `H-implicit` | Local machine serves, unnamed | Nothing (a status-line word at most) |
| `H-named` | Deliberate placement (Runs on: Dev VM) | Placement line on the agent/run |
| `H-materialising` | Body being brought real | Quiet progress on the affected row |
| `H-relocated` | Semantic work continues through a changed body where supported | Same semantic refs, actual new material binding and continuation kind |
| `H-failed` | Materialisation/lifecycle failure | Owner-routed reason, retained work and appropriate recovery/Attention |

Deep administration lives in System/CLI, not the everyday grammar. Native
Central validation, supported harness interception and Workcell confinement have
different coverage. A plan or configured hook is not enforced protection. A
required unsupported boundary is explained before effects, not silently weakened.

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
presented, not what was believed; contributions stay attributable. External
protocol task/context identifiers retain provider scope and do not replace
native continuing conversation, Agent or Factory identity.

## J. Presentation states — *the shape of the window*

Derived from: austere rest with summoned depth (design §4); two state layers
(architecture §6); the P1 keyboard grammar.

| State | Meaning |
|---|---|
| `J-rest` | Agency field + canvas. Nothing else. |
| `J-summoned(region)` | Context · knowledge · terminal · trace · inspect · processes in their summoned region |
| `J-full` | The full workbench grammar: World navigator, splits, Cradle encounter panel, lower drawer |
| `J-focused-work` | Chrome minimised for writing; agency field collapsible to a strip |
| `J-detached(n)` | Detached windows in play |

Every summoned surface dismisses back to rest. Presentation persistence does not
own semantic truth; held editing buffers remain protected local state until a
native save is acknowledged. Resizing does not change what exists. Missing or
failed optional operations do not trap the app in a loader or steal focus.

## K. Authority states — *what may happen?*

Derived from: Reading ≠ Action; authority gates (architecture §9.4); FP §4
(authorship, authority, refusal as high-leverage contact points).

| State | Meaning | Rest shows |
|---|---|---|
| `K-read` | Non-effectful read within actual access/disclosure scope; no implied mutation/invocation authority | Silent unless scope or availability needs explanation |
| `K-proposed` | Agent proposes durable human-source change | Proposal with provenance, awaiting required acceptance |
| `K-grant-bounded` | Time/scope-bounded authority issued | Visible bounds and actual consumption; routine permitted steps do not each require another human ceremony |
| `K-refused` | Human declined | Recorded with reason; Agent informed through Return; safe work remains usable |
| `K-expired` | Bound lapsed | Action fails closed with its real next operation; no silent repeated permission request |
| `K-escalated` | Beyond bounds → attention | Attention item naming bound and subject |

---

## Global invariants (apply to every state)

1. **Non-identities hold everywhere:** Reading ≠ Action · Surface ≠ Action ·
   UI selection ≠ Context disclosure · presence ≠ authority · masking ≠
   missing · degraded ≠ broken · authored ≠ observed ≠ generated · Projection
   ≠ Contribution ≠ source object · Participant ≠ Identity · encounter ≠
   belief. Receipt ≠ human awareness/inclusion/Recognition; projected ≠ loaded.
2. **Semantic state is kernel/product-owned; presentation state is
   desktop-owned; neither derives from the other** (§6 of architecture).
3. **Degradation and absence are first-class observations**, rendered where the
   thing would have been, with bounded recovery where supported. They never
   become fabricated empty success or indefinite whole-app loading.
4. **Every attention item names an exact subject** and resolves to it in one
   act. Ordinary dependency waits and telemetry do not automatically demand the
   human's attention.
5. **Agent-native parity:** Agents get complete permitted structure and humans
   progressive disclosure of the same facts, never wider disclosure by being an Agent.
6. **Keyboard and pointer parity** on every interaction the Buzz grammar
   contributes (compose, address, dismiss, promote).
7. **Verification follows the original whole:** the lived walks in 04 §6 and
   CAW P01–P28 retain all obligations, even when a child implementation succeeds.
   Independent full-feature proof is separate from the implementer's checks.
