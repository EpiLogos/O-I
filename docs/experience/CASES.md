# Acceptance cases

Cases that stories and tickets cite by ID. Each has its own expected observation; a test exercises the real owning path, and a component fixture proves only its component. The standard a story is held to is in [LOCAL-CAMPAIGN](LOCAL-CAMPAIGN.md) §2.2.

## Plural Flow (MP01–MP18)

One conversation across people, agents and worlds ([stories CJ](STORIES.md); the contract is [plural Flow](../architecture/plural-flow.md)). The native owners are Central's Flow append, AIKit's encounter conversation and the shell's plural Flow ([architecture](../architecture/plural-flow.md)).

| Case | Activity and expected result | Primary obligation / packets |
|---|---|---|
| **MP01 Identity** | Two agents with one initial and two people with the same name remain distinct. A replacement session retains the agent's enduring identity and exact earlier occurrence. Legacy/unknown attribution stays truthful. | `plural65:FORM`, `plural65:PARTICIPATION`; PF1/PF3 |
| **MP02 Rich compatibility** | Open/export/reimport original F/H and v0.3 fixtures with rich entries, journal, notes, packet, media and unknown compatible metadata. Explicit upgrade is repeatable, retains identity/full bodies and leaves the source unchanged on read. An old writer cannot drop new fields. | FORM; PF1 |
| **MP03 Thread/convergence** | Two answers to one question, a branch and a synthesis referencing both answers remain navigable in chronological/thread/Expression views. An actual runtime fork is separately represented. | FORM/UI; PF1/PF4 |
| **MP04 Request correlation** | Concurrent sends to independent sessions plus an unrelated assistant event produce only their own matched replies. A single provider without parallel turn IDs serializes rather than guesses. | DELIVERY; PF2 |
| **MP05 Stream completion** | Several partial text/tool events update one live result; final/interrupted state reflects the native turn. Long output stays fully addressable; first fragment and last visible block are not a completion oracle. | DELIVERY; PF2/PF4 |
| **MP06 No-UI return** | Close the view and all UI clients before a delayed response. Native owners retain, correlate and include the actual answer; reopen finds it once without restarting the turn. | DELIVERY/RECOVERY; PF2 |
| **MP07 Crash/replay boundaries** | Interrupt after document commit, after queue acceptance, after delivery, after provider completion, and after Flow inclusion but before ack. Same native request reconciles; changed payload under that ID refuses. Unknown external dispatch is explicit, not blindly replayed. | RECOVERY; PF1/PF2 |
| **MP08 Concurrency and changed basis** | Two agent appends coexist with a human/external edit. A late reply targets the historical question; a stale source-edit proposal conflicts. All collections and current human bytes survive. | RECOVERY; PF1/PF2 |
| **MP09 Membership/context** | Late join, observer, scope change, leave and revocation produce correct per-body history and effect bounds. Queued work is revalidated. A foreign agent message retains its role/author and cannot become the receiver's own prior answer or system instruction. | PARTICIPATION; PF3/PF4 |
| **MP10 Address and location** | Unembodied registered agent stays addressable; durable responsibility follows declared succession. Exact generation/required-Workcell never reaches a same-named peer/successor. Test actual local and remote owners. | PARTICIPATION; PF3 |
| **MP11 Wake and bounded exchange** | An admitted addressed request wakes an eligible idle recipient without human continuation. Facilitated/team work advances materially, preserves budgets through relays, suppresses self echoes and ends/waits. Cancellation prevents new unsent turns while retaining actual effects. | RESPONSE; PF2/PF3 |
| **MP12 Local without cloud** | Human plus two real agents complete the meaningful inquiry with hosted SharedField/SpaceTimeDB and optional QL/Factory absent from the execution path. Ordinary writing and short contact remain usable without manufacturing runs/NOWs. | SHARED; PF3/PF4 |
| **MP13 Two Workcells** | The same world across Mac/Omarchy preserves participant/work/source identity through gateway interruption and fresh-body continuation; actual sessions stay at their recorded material owners. | SHARED; PF3/PF4 |
| **MP14 Two human worlds** | Two independently authorised human identities and agents join selected shared work; each has correct author, rights, source and personal Day. Same labels/shared physical host do not collapse identity. Controlled drivers versus two real humans retain their evidence levels. | SHARED/PARTICIPATION; PF3/PF4 |
| **MP15 Time and Nara** | Cross civil-Day/timezone boundaries and receive an old result later. Correct occurrence/receipt/source survives; no deck/journey reset. Nara and historical intake distinguish 'I said', 'said to me', agent interpretation and the person's correction. | CONTINUITY; PF2/PF4 |
| **MP16 Scope and portable material** | Shared/exported content excludes private journal/notes, embedded JSON, hidden assets and derived context. Withdrawn/deleted/changed source produces current scope and stale-knowledge handling, not cached disclosure. Claimed author cannot impersonate a native caller. | PARTICIPATION/SHARED; PF1/PF3/PF4 |
| **MP17 Actual human controls** | Real keyboard/pointer bring-in, address, reply, branch/rejoin, stop, retry/reconcile, source/Expression deep-open, back/reopen and narrow/reduced-motion use. Visible state follows owners; disconnect a producer and observe changed liveness. Frozen/replay never invokes tools. | UI; PF4 |
| **MP18 Useful Return and matrix** | A fresh participant uses the corrected retained result on a different example. Source/capability/practice/test links identify what enabled it; an intentionally disconnected producer is caught. Distinct native communication, source inclusion and actual understanding have separate receipts. | MATRIX/CONTINUITY; PF5 |

## Wiki and constellations (WCT01–WCT25)

Wiki reading and editing without QL, constellation construction, the agent's construction space and Return ([the wiki specification](../cradle/WIKI-CONSTELLATION-SPEC.md); decisions WC01–WC15 in [the practice position](../../ProjectCentral/docs/0-ground/positions/WIKI-CONSTELLATION-PRACTICE.md)).

| Case | Required observation and negative |
|---|---|
| WCT01 | Non-QL imported corpus reads/edits/searches without rewriting source or fabricating QL metadata. |
| WCT02 | Markdown/wikilink/alias/heading/block resolution agrees in reader, graph, backlink and agent route; duplicate titles remain distinct. |
| WCT03 | Backlink occurrences and tag membership are truthful; unlinked suggestions and shared tags do not create asserted document cliques. |
| WCT04 | Native/external edit, rename/delete, missed watcher and reconnect update only affected readings; stale selectors and dirty conflicts survive honestly. |
| WCT05 | Local results appear during slow/failing supplementary providers; late results retain keyboard selection and cannot replace a newer query. |
| WCT06 | Shared resources deduplicate reads; delayed tree cannot block known-page return; access change prevents cached disclosure. |
| WCT07 | Scope/type/direction/depth/query/metadata filters, groups and saved views work by keyboard and pointer; clear and fit have separate effects. |
| WCT08 | Atomic and composite shape membership survives partial filters/expansion, cyclic refs and shape-aware budgets; no arbitrary first-ten whole. |
| WCT09 | Exact selected passage/relation transfers to M0′/constellation and Context with source/revision; actual disclosure is explicit and minimal. |
| WCT10 | Frame-first and material-first construction both work; empty roles, valid form with contested interpretation and two context-specific roles for one source remain distinguishable. |
| WCT11 | Glyph/text/image/line/particle composition is real in the existing 3D Stage; moving a body does not silently assert an edge or create a duplicate renderer. |
| WCT12 | Actual situated agent reads/edits the same construction; a concurrent human edit defeats stale agent writes; hold/continue preserves work. |
| WCT13 | Reuse, pinned basis, variant and instance presentation have different effects; editing one composition does not unintentionally mutate all users. |
| WCT14 | Native QL relation/constellation and artifact Return become searchable; whole/member structure, derivation and partial-save retry survive. |
| WCT15 | M3′ real Scenes and M5′ Palace composition preserve Expression refs and source access; same object crosses 3:3/4:2 without reminting. |
| WCT16 | Back, lens/mode switch, detach/redock, release and restart recover useful state; source revision exposes affected bindings without resetting unaffected work. |
| WCT17 | Audience filtering happens before counts/expansion/cache; public projection excludes private references and context; offline local work remains usable. |
| WCT18 | Recorded cold/warm corpus benchmarks meet or explicitly report spec budgets; bounded memory/listeners/workers and independent disconnected-handler test prevent cosmetic success. |

| Case | Required observation and negative |
|---|---|
| WCT19 | A person corrects actual agent behaviour once; exact Wiki source changes; the next act receives its revision and independently shows the desired change. Disconnect delivery: source save succeeds but joined acceptance fails. |
| WCT20 | Two writers using one basis cannot both win; conflict retains the human draft and evidence. Inference is not self-accepted; governance bytes do not change with projection edits. |
| WCT21 | Root-only Central, sibling ProjectCentrals, primary world and a second workcell retain scope and identities. No fallback to another root when current source is absent. |
| WCT22 | Resume, compaction and fresh session reload the current selected reading; unsupported events/harnesses report absent delivery, never a fabricated loaded receipt. |
| WCT23 | Source denied/deleted, projection cleared/suspended, budget exclusion and session expiry prevent future stale delivery. Exact source history remains attributable. |
| WCT24 | Plain Markdown correction and document skills work with QL absent; optional QL organisation preserves source authority, common evidence lineage and deliberate relation authorship. |
| WCT25 | Existing chat/Context/Run/Agents controls show saved/selected/emitted/acknowledged/use separately. No extra participant modal; independent actual-harness and human review retained. |

## Factory and Agency joined walk (FAJ1–FAJ9)

One connected walk through Factory and Agency on the installed app, with a real commissioned Run and one bounded child ([factory-agency.json](factory-agency.json) attaches the fourteen `factory289:*` obligations to the stories). An unrelated conversation or terminal beside a queued Run cannot pass. Run the existing repository checks and real installed-app walks, and use a fresh independent verifier for the whole feature. Screenshots record the actual layout; native refs and receipts establish correlation; human visual judgement stays human. Keep failed evidence and every unresolved obligation. Design adoption sets no runtime readiness, feature verdict or human-experience evidence.

| Case | Activity and expected result | Primary obligation / stories |
|---|---|---|
| **FAJ1 Choose and start** | Choose or create an Agent, inspect its effective skills and context, and start with an available harness and model. | `factory289:agents`, `factory289:session-compose`, `factory289:praxis-context`; AG01, AG04, FA01 |
| **FAJ2 Enter Factory with the same conversation** | The same conversation carries into Factory; the conversation, the work's produced material and its activity all show the same work, and the conversation is visible once. | `factory289:arrangement`, `factory289:conversation`; UI02, UI04, FQ01 |
| **FAJ3 A real Run with a bounded child** | Carry a real commissioned Run with one bounded delegated assignment; open its exact persisted working environment. | `factory289:runs`, `factory289:joined`; DV01, DV02, TM03, GA10 |
| **FAJ4 Receive the work** | Receive a code change, a preview, a verification and a handoff through the shared presentation; inspect the actual Git differences and the unresolved obligations. | `factory289:output-dynamics`, `factory289:templates`, `factory289:handoff`, `factory289:git`; WR05, DV03, RA04, WM04 |
| **FAJ5 Correct and continue** | Request a correction, continue, and tell the new revision apart from the material already reviewed. | `factory289:output-dynamics`, `factory289:handoff`; RA04, FJ08 |
| **FAJ6 Relocate and restart** | Detach and redock, leave Factory, restart and resume with draft, selection and native identity preserved. | `factory289:arrangement`, `factory289:visual`; UI02, DV05, SU08 |
| **FAJ7 NOW and recurrence** | Follow the handoff through NOW and exercise supported recurrence with real permission and proof checks. | `factory289:temporal-routine`; WR06, WP09, WM08 |
| **FAJ8 Across arrangements** | Exercise Epi/Nara/Factory continuity across arrangements, and ordinary Direct and external work beside it. | `factory289:joined`; TM03, WK04, RW01 |
| **FAJ9 Every admitted harness** | Test every available admitted harness against its actually supported faculties with an economical eligible model. Record unsupported, unavailable and failed cases explicitly; one harness smoke is not cross-harness acceptance. | `factory289:joined`, `factory289:session-compose`; AG04, TM06 |

## Factory agency scenarios (FAS1–FAS7)

Seven coverage scenarios for the Factory agent roster, the run and the work's sources and produced material. Each runs over the real owning path. Test click and keyboard behaviour and the real callback and readback contracts, not screenshot labels; a deliberately disconnected native handler must fail the integrated test even when the interaction looks convincing. One integrated scenario with alternate states may cover several; seven separate demonstrations are not required.

| Case | Activity and expected result | Primary obligation / stories |
|---|---|---|
| **FAS1 Empty → organised** | With no Run or conversation, the roster and the sources are usable from entry: create a proposed worker and team, search and choose skills by hand, and ask for suggestions. A change of source or authority, or cancelling the inference, leaves an editable proposal. Add files as sources. | `factory289:agents`, `factory289:praxis-context`; AG01, AG02, FM04, RK10 |
| **FAS2 Work → collaborate** | Select a Run with several independent lanes and a named outcome owner. Move between the conversation and the Run, address one agent or team, inspect its activity and delegate with bounds. Grouping or an @mention alone dispatches nothing; roster or step selection does not redirect a draft. | `factory289:conversation`, `factory289:runs`; AG07, FX02, FQ07 |
| **FAS3 Blocked → resolved** | A child awaits permission, another required leg fails and a third finishes. The Run shows the true barrier and scoped actions, and every cue reaches the same unresolved item. Resolve or refuse, retry only with reconciled effects, and keep late results explicit. | `factory289:runs`, `factory289:attention-gateway`; DV04, FJ02, RA03, RA07 |
| **FAS4 Inputs → outputs → human response** | Add an eligible source and inspect what each agent actually loaded; receive a partial artifact, then a final addressed Return. Open the artifact body, compare two Candidates or checks, request changes and receive through the existing Day and queue relation. Ordinary progress stays out of the queue. | `factory289:praxis-context`, `factory289:output-dynamics`, `factory289:temporal-routine`; AG03, DV03, WR04, RA04 |
| **FAS5 Inspect without losing place** | Pause live-follow on a past tool or claim; open evidence → exact Git or source → context or skill → return. New events and a newer result do not move the held view. Pop out and redock while the centre switches; the draft and unsaved material survive. | `factory289:output-dynamics`, `factory289:git`, `factory289:arrangement`; UI02, RA04, GB12 |
| **FAS6 Learn and repeat** | From a poor result, bound an inquiry, keep adequate and contradictory evidence, propose a guardian practice improvement, inspect the native apply and reload, and reopen a proven routine occurrence. Proposals and repeated summaries do not become law by themselves. | `factory289:temporal-routine`, `factory289:agents`; PX05, GV08, RK11 |
| **FAS7 Degraded and ordinary** | An unavailable model, provider or host, a missing skill companion, a revoked permission, partial search or index lag, stale checks and a lost stream each have a useful state. Direct work and operation without DSH stay valid; there is no ghost Run and no silent empty success. | `factory289:visual`, `factory289:joined`; UI05, WN10, TM06 |

## Expressions connected walk (EXW1–EXW13)

The connected walk the owner's spec asks for ("Do not hide behind fixtures"), on real Central ground through the native app. Each step records how it was backed: live through the owners, a named unavailable state, or a named remainder; never invented content. The legacy cradle's runner is `desktop/cradle/walk/expression-walk-13-step.mjs`. A run with console errors fails.

| Case | Activity and expected result | Stories |
|---|---|---|
| **EXW1** | Expressions opens the real hosted Expressions application. | XS01 |
| **EXW2** | The real Library opens. | WB01, WB02 |
| **EXW3** | My world's scopes list; the shared web shows its named unavailable state, with no invented results. | WO03, WO04 |
| **EXW4–EXW6** | A project's real ProjectCentral whole opens as an Expression: the overview, its constellations, its exact nodes. A thin wiki places its one entry as the whole. | XA02, TG01 |
| **EXW7–EXW8** | Focus lands on a canonical ref, and one selection holds across the map and the centre. | KN03, TS01 |
| **EXW9** | A page opens in its own placement; a source opens through the same open paths. | WB02, TD01 |
| **EXW10** | Returning restores the register, the scene and the selection. | XA03, SU08 |
| **EXW11** | Explore opens as the web's discovery operation; the shared scope is honest. | WO03 |
| **EXW12** | Shared-field staging shows its named unadmitted state: one projection identity, no second public graph. | WO04, SH01 |
| **EXW13** | Search resolves native subjects. | CS01 |

## Acceptance floor: what never counts as acceptance (AFN1–AFN10)

Acceptance derives from the designs, not from what got built (owner ruling 8 of 22 Sep 2026, `packages/oi-design-system/DESKTOP-LANGUAGE.md`). Each design row becomes a behavioural check, and the known plausible compromises are removed from acceptance. From design to check: the System settings law (now §0 of `docs/cradle/07-WAVE-5-SYSTEM-CONTRIBUTION.md`, with bootstrap and drift) row by row; each UI story in [STORIES](STORIES.md) one walk scenario; the Factory acceptance (FAJ, FAS) over real kernel legs; walks are the acceptance ([LOCAL-CAMPAIGN](LOCAL-CAMPAIGN.md) §10).

| Case | What does not count, and what is required instead |
|---|---|
| **AFN1** | Verbatim wire or demo snapshots as requirements (`chat-settings` `LIVE_*` constants). Required: a live read round-trip. |
| **AFN2** | Presence-only claims (`count()>0` proving "presents" or "expands"). Required: content equality or geometry; bare presence checks are flagged. |
| **AFN3** | One-sided layout invariants (`height >= tallest-0.5`). Required: two-sided ±0.5px, with the triggering transition exercised. |
| **AFN4** | Controlled receipts in acceptance shape (`passed:true` with `standing: controlled`). Required: committed receipts carry `spec_ref` and `grade`; controlled means grade D; an evidence aggregator emits `passed:true` only with at least one grade-A receipt (`desktop/cradle/scripts/receipt-lint.mjs`). |
| **AFN5** | Acceptance on the dev fixture world for surfaces with a real owner route. Required: fixture-backed scenarios are excluded from the acceptance set, and the production bundle holds no fixture marker. |
| **AFN6** | Static imports of fixture modules outside the walk gate. Required: found and refused. |
| **AFN7** | Probes without a failure path. Required: exit nonzero on failure, or be named `*.diagnostic.mjs`. |
| **AFN8** | Raw dumps in the primary view. Required: a walk check that no `<pre>` or JSON text node stands outside a disclosure. |
| **AFN9** | Attribute vocabulary as proof of legibility (`data-reconciliation='drifted'`). Required: the visible text that says it. |
| **AFN10** | A controlled double where the design row names live, installed or human. It may support the row and never discharges it; the consent-gated live proof is the required shape. |

Specimens that already meet the bar: `document-entry` (byte-exact carrier), `day-edit` ("the face never wrote bytes"), `verify-live-settings`, `local-shell-acceptance` (consent-gated live proof), the honest-unavailability legs of `rest`, the honesty checks of `system-settings`, the real-read legs of `factory-development`, `knowledge-projection-geometry` (rendered-pixel measurement), `personal-web-browser` (controlled inputs, real behaviour), `kernel-cas`.

## Epi-Logos agent body (EPM1–EPM11)

The Prime–QL agent body as the default for a new conversation under the Epi-Logos lens, in Expressions and in Technē (story RW13). The seven `vakcraft65:*` obligations of [vak-expression-craft.json](vak-expression-craft.json) carry these cases as their `EPI-MODE/*` branches. Actual provider, child, material, UI and human tests are the implementation's; source tests prove only document and compiler integrity.

| Case | Activity and expected result | Primary obligation / stories |
|---|---|---|
| **EPM1 Bind the episode** | Bind the full source and native capability field, the selected episode, actor, context and authority, the exact source, build, install and running cut, and the real default profile. The verifier's inputs exclude the implementer's expected conclusions. | `EPI-MODE/constitution`, `EPI-MODE/basis`; PX01, DV02 |
| **EPM2 Both hosts, a useful task** | In the installed current UI, enter Expressions, select an existing source-backed subject, select Epi-Logos and perform a useful agent task. Read back the actual Prime–QL activation, the relevant #0 operation, the native scene or source effect and the Return. Repeat entry and useful operation through Technē. Calling the same CLI while testing a different app build is not receiving-UI proof. | `EPI-MODE/selection`, `EPI-MODE/lifecycle`; RW13, XA07 |
| **EPM3 A bounded child and its handover** | Delegate a useful bounded contribution to a real inexpensive eligible child through the admitted harness. Verify inherited faculties, scoped context and persistent worktree allocation; independently attempt forbidden extra-worktree creation under the worker boundary while legitimate edit and test work stays functional. Finish one partial contribution, record a pithy native NOW handover (Central's `projectcentral.now.return`, `central.project-now.handoff/v1`), replace the worker, and continue from that record without the parent reconstructing the investigation. Exercise a source or Return change, view closure and re-entry, supported restart, and an interruption with a pending scene operation. OS and worktree confinement of Prime children stays named as unproved until Prime exposes a per-child supervisor hook or a Workcell-owned worker session replaces the child launch. | `EPI-MODE/children`; AG07, AG09 |
| **EPM4 Repair and reuse** | Keep a failure and its uncertain effects, repair its native owner, update the candidate through the lead and independently replay the complete affected act. Consume one warranted result into native Wiki, account, matrix or Method knowledge and show a fresh participant using it on a new input. Human assessment stays real and separately attributable. | `EPI-MODE/learning`; PX05, DV08 |
| **EPM5 Not running, missing, stale** | Selected but not running; a missing required Prime, QL or profile capability; unavailable optional Jev or EBM; a malformed or stale instrument answer; an explicit alternative not silently relabelled. Each is its own named state. | `EPI-MODE/selection`; RW13, UI05 |
| **EPM6 Mode off** | Taking the mode off restores ordinary function with no retained global injection, no new Agent and no lost work; a user override survives appropriate re-entry. | `EPI-MODE/lifecycle`; RW13 |
| **EPM7 Toggles and in-flight work** | Repeated toggles do not duplicate actors or worktrees; changing mode does not silently retarget an in-flight attempt. | `EPI-MODE/basis`, `EPI-MODE/lifecycle`; RW13 |
| **EPM8 Late and rejected** | Late enrichment against an obsolete Expression or source basis cannot auto-apply; a rejected proposal leaves state unchanged; an accepted operation is independently observed. | `EPI-MODE/lifecycle`; XA07 |
| **EPM9 Child failures** | A child omitting an inherited faculty, leaking sibling, verifier or private context, a conflicting claim, a failed handover and a stale resume all remain failures. | `EPI-MODE/children` |
| **EPM10 Full faculty coverage** | All #0–#5 required coverage stays mapped: meaningful TDA input and provenance, the graph / inference / embedding distinction, multimodal ambiguity, Nara unknown, confidence and decay, Logos near-miss and transfer. A sample happy path cannot close the lane. | `EPI-MODE/faculties` |
| **EPM11 Standing and comparison** | Authored source, analytical readings, execution evidence, lived response and human Recognition keep their standing; no trained voice or EBM result silently changes canonical identity. Compare the complete mode with ordinary and research controls on the same source and task basis, counting preparation, actor and child inference, retries, verification, latency, cost and human assistance; keep negative and inconclusive findings. | `EPI-MODE/learning`, `EPI-MODE/constitution`; PX06 |

## Optimisation comparisons (OPC1–OPC5)

The first comparative specimens inside the campaign; the protocol is [LOCAL-CAMPAIGN](LOCAL-CAMPAIGN.md) §13 (campaign.md). Each states its hypothesis, quality floor, alternatives, metrics, budgets and stopping rule before it starts, and reports sample counts and uncertainty. Missing producer or measurement support stays named implementation work; repository source checks validate the plan, not a claim of better performance.

| Case | Activity and expected result | Stories |
|---|---|---|
| **OPC1 Ordinary existing-harness task** | Compare eligible model, body, context and skill arrangements, including a simple baseline against escalation or justified plural work. Required beyond a number: complete independently verified work, actual loading and source use, whole-task cost and assistance, returned scoped roster evidence, and no new Factory ancestry for Direct work. | PX06, AG04, WK01 |
| **OPC2 Composed QL instrument activity** | Keep the same field, music and fidelity while graph, Epii, a background task, a detached view and source or remote updates coexist. Required: tails, deadlines, state age and resource lifecycle; smooth supported interaction; cancellation and re-entry; privacy. Reduce computation and transport waste rather than erase source-defined relations. | XA10, LT rows |
| **OPC3 Repair → learning → later reuse** | Compare the baseline procedure with a revised diagnosis, skill or native operation on a fresh unfamiliar variant. Required: verified restoration, the original failure kept, lawful admission, fresh-agent discovery and transferable benefit; broken, stale and unsafe candidates rejected; the full improvement overhead included. | DV08, PX05, RC06 |
| **OPC4 Optimiser O0 against O1** | The subject is an exact version of a diagnosis, experiment-selection, evaluation, retention or promotion practice. Freeze the outcome contract and an independent holdout before either starts; give both equal total improvement budgets on the same permitted development episodes; the independent verifier evaluates resulting candidates on unseen tasks or later occasions. Report gross gain and net resource consequence, with every rejected experiment and negative finding; no-change and inconclusive are valid results. | PX05, PX06 |
| **OPC5 The evaluator is tested** | Feed the evaluator deliberately broken, disconnected, stale and over-authorised candidates. It rejects apparent savings obtained by removing required work, and cannot improve its score by changing its own success criterion or reading holdout answers. Changes to the evaluation method are reviewed independently and versioned. | DV08 |

## Session grounding (SG1–SG12)

Twelve bounded units that prove the native prerequisites of continuous work: source and place, identity, the material census, providers, composition, authority and delivery, recovery, remote access, Guardians, Factory return, presence and the joined walk. They are proof units, not product primitives or story IDs. [session-grounding.json](session-grounding.json) holds each as an obligation `grounding220:<name>`, with its full required branches, the stories it binds (including the DO rows added on 22 September), its execution lanes and its required evidence: C, P and M for all, and H as well for SG11 and SG12. The laws the units prove are in [persistent agency and material hosting](../../ProjectCentral/docs/3-architecture/PERSISTENT-AGENCY-AND-MATERIAL-HOSTING.md), [agent context](../architecture/agent-context.md) and [World inhabitation §1](../contracts/WORLD-INHABITATION-V1.md).

| Case | Required proof | Obligation and original stories |
|---|---|---|
| **SG1 Source and place** | Existing or new work, a real root or Project destination, a required or preferred environment, and no forced migration or adoption of a default. | `grounding220:source-place`; TM01, TM02, AG01, MC01, DV02 |
| **SG2 Identity** | Exact semantic and native bindings: the same names and PIDs, two simultaneous sessions, stale generations and no duplicate task. | `grounding220:identity`; TM02, AG06, DV05, WK04 |
| **SG3 Census** | A real provider and process census, external work, failed and stale reads, and executable aggregation set against each live execution. | `grounding220:census`; TM03, WK04, MC03, MC07 |
| **SG4 Provider** | Herdr's public entry path, plus tmux and optional cmux; exact open, attach, focus, close and recreate; resident isolation and errors. | `grounding220:provider`; TM02, TM06, TM08, AG09 |
| **SG5 Composition** | Real selected and effective context, praxis and body; their scopes and lifetimes; two-session isolation; actual tooling. | `grounding220:composition`; AG03, AG04, PX02, PX03, PX04, PX06, TM01 |
| **SG6 Authority and delivery** | Real authority and response, finite plural work, native modes, and no completion read from a journal alone. | `grounding220:authority-delivery`; AG07, AG08, GW06, GW09, DV01, TM03 |
| **SG7 Recovery** | Detached work, service and provider death, pending permission and effects, rehydration and replay, and safe retry. | `grounding220:recovery`; AG06, AG09, GW05, GW07, MC06, DV04 |
| **SG8 Remote** | Same-host remote access against a deliberate second placement; proof of source, authority and continuation; no silent fallback. | `grounding220:remote`; MC02, MC04, MC08, GW08, TM09 |
| **SG9 Guardians** | Existing Guardian, source and default relations resolve and actually load under ordinary authority; profile-less work stays valid. | `grounding220:guardians`; AG01, AG02, AG05, AG08, TM01, TM03 |
| **SG10 Factory return** | A real commissioned change, independent verification against its Git basis, output, handoff, NOW and recurrence. | `grounding220:factory-return`; DV01, DV02, DV03, DV04, WR05, WR06, TM05 |
| **SG11 Presence** | Exact host, desktop, TUI and Gateway access and attention; permission-aware focus and a retained arrangement. | `grounding220:presence`; UI02, UI04, UI05, TM07, TM09, GW05 |
| **SG12 Joined** | The full native and installed workflow, every applicable provider branch and independent verification, through the connected walk below. | `grounding220:joined`; DV08, TM03, TM10, MC06, GW08 |

### SG12 — the connected walk

From actual recognised source, choose one existing Agent and an economical eligible harness/model. Allocate permitted task material and bind an existing terminal/workspace; demonstrate a separate deliberately created one. Verify operative identity/context/skills and legitimate writes, including two sessions with different scoped repertoire.

Carry a real Factory change in the **Herdr reference** while a Direct tmux session and external native harness coexist. Workcell reports actual places/processes; only the actual Factory execution has Run ancestry. One bounded child performs independent work and an independent verifier checks the actual changed Git state.

Close the views, receive attributable progress/output through another permitted Surface, reopen the exact work and inspect the accepted Factory output/handoff. Exercise provider/connection loss, stale target/name, cancelled/late output and a restart requiring explicit recovery. Then access the same remote work from the primary machine and separately test deliberate second-placement recovery with real material evidence.

Continue through NOW and supported recurrence with authority/proof revalidation. Retain no-QL usefulness and the existing Epi/Nara/Factory presentation parity. Test every available admitted harness against its true faculties; Herdr, tmux, cmux, Gateway and harness-specific passes remain distinct.

## Native agent creation packet (`propose` to `resume`)

The local packet `desktop/cradle/tests/agent-native-local.py` proves the native path for making an agent and delivering its definition ([agent context](../architecture/agent-context.md), Making an agent), phase by phase, on the selected `ctrl`, `aikit` and `oi` executables. It continues SG12.

Use `desktop/cradle/tests/agent-native-local.py` with Python 3.11 or later and the
actual selected `ctrl`, `aikit` and `oi` executable paths. The default preflight is
read-only. It records their SHA-256s, the native scope, eligible Skills and the
roster. Every subsequent phase uses a **new private receipt file** and the previous
receipt; a changed candidate or scope is refused rather than quietly reusing it.

Resolve the arguments from those actual readings, not a guessed model or Agent.
The phase sequence is:

| Phase | Additional explicit input | Evidence required before the next phase |
| --- | --- | --- |
| `propose` | `--execute --name … --purpose-file … --confirm-scope …`, optional repeated native `--skill` | Real source ref and reviewed body; no acceptance implied |
| `review` | Previous receipt or an actual `--profile-ref` | Exact native source and digest shown for human review |
| `accept` | `--execute --prior … --reviewed-digest …` | Existing native human-authority channel, then source and roster readback |
| `prepare` | `--execute --prior …` | Original request correlation and complete native attachment, no provider yet |
| `connect` | `--execute --prior … --provider …` | Actual eligible provider discovery, startup and native handshake |
| `live` | `--execute --prior … --provider … --source …` | A new source-dependent assistant return and fresh matching parent context-delivery receipt |
| `resume` | Same as live with the previous live receipt and a **new** source nonce | Same persisted native identity and another fresh source-dependent return |

The purpose file is the exact desired text, including an explicitly reviewed
trailing-newline choice; the packet never silently trims authored words. No phase
creates a human authority source, installs a credential, invents a provider or
makes a private rule authoritative. Missing genuine setup goes through its native
owner and a reviewed human decision. A stored proposal does not substitute for it.

The source probe's first line is `OI_AGENT_PROBE_` followed by a new random
32-digit hexadecimal value. Keep the source within the explicitly selected World;
its bytes must never appear in the prompt. The live phase delegates to the existing
`agent-native-live.py`, checks new output from the exact native session and requires
healthy completion. It additionally reads new journal events and compares the
accepted Agent and effective Skill digests to preparation. Parent submission is
not relabelled as independent model consumption or child activation. A timeout,
disconnect or refusal preserves the receipt and never automatically replays work.
Provider use may be billable. Permission requests remain visible for human review.

**desktop walk.** After integrating the delta and selected native dependencies, repeat the activity
through the actual desktop: create/review/accept, read the roster, select the native
harness/model, retain a draft through one setup excursion, return useful work,
deny one harmless requested effect, interrupt and explicitly reopen where supported.
Use both root and one genuine child Project without manufacturing a fake child
for root. A native process restart and a UI close/reopen are different observations.
The local operator starts the supported native owner before the packet's resume
phase; the packet itself never installs products or kills resident services.

**device check.** Open `tests/agent-native-device.html` in the actual candidate for explicit local
microphone capture/stop/playback and record human listening, denial or unavailable
capture honestly. It uploads and persists no audio. Ordinary-browser playback is
not Mac app microphone or Nara/dictation proof. Native keyboard, focus, window and
voice integration are separate local checks.

## Workcell-root NOW and the temporal field (NOW01–NOW37)

The temporal law owner-approved on 16 September 2026 ([World inhabitation §1](../contracts/WORLD-INHABITATION-V1.md), [shared participation](../architecture/shared-participation.md)) is proved inside the same installed world, under the session-grounding obligations and, for the SharedField cases, `web65:CONTINUITY`. It is complete when machines have their own persistent material presents; bounded work localises within those presents; the human Day holds several Workcell presents together without erasing place; Factory and Routine reconstruct what happened where and why; Activity and logging stay attributable across frames; SharedField can expose a live collective present without appropriating local temporal or source identity; and desktop, TUI and hosted surfaces present these relations as different views of the same current world.

| Case | Required observation | Obligation |
|---|---|---|
| NOW01 | The primary workstation and Omarchy each expose one stable root NOW. | `grounding220:source-place` |
| NOW02 | Several bounded child NOWs coexist beneath each. | `grounding220:source-place` |
| NOW03 | Same-task retry or reconnect resumes the intended child. | `grounding220:source-place` |
| NOW04 | Child scratch, context and authority do not bleed into siblings. | `grounding220:identity` |
| NOW05 | Day rollover retains root NOWs and live children. | `grounding220:recovery` |
| NOW06 | One child can be reached through desktop, TUI, Herdr and tmux without identity drift. | `grounding220:provider` |
| NOW07 | Provider or pane recreation cannot hijack another child. | `grounding220:identity` |
| NOW08 | Opening remote Omarchy work remains remote access. | `grounding220:remote` |
| NOW09 | Explicit re-placement establishes the target Workcell and root-NOW relation before useful execution resumes. | `grounding220:remote` |
| NOW10 | A parent Pi or another harness allocates a child NOW before the child launches. | `grounding220:authority-delivery` |
| NOW11 | A parent Pi delegates once to Pi and once to a different admitted harness. | `grounding220:joined` |
| NOW12 | Child authority, scope, verification and return are bounded. | `grounding220:authority-delivery` |
| NOW13 | Failed, late or cancelled child state stays attributable. | `grounding220:recovery` |
| NOW14 | Child quiescence releases child-owned material without ending the Workcell root NOW. | `grounding220:provider` |
| NOW15 | Trigger origin and execution destination can differ. | `grounding220:factory-return` |
| NOW16 | A trigger on the primary leading to child execution on Omarchy is attributable end to end. | `grounding220:joined` |
| NOW17 | Omarchy can continue while the primary is offline. | `grounding220:recovery` |
| NOW18 | Duplicate delivery, restart or provider replacement does not duplicate consequential effects. | `grounding220:recovery` |
| NOW19 | A late Return keeps its original occurrence and material temporal address. | `grounding220:recovery` |
| NOW20 | One Journey has live children on both Workcells. | `grounding220:factory-return` |
| NOW21 | One Run crosses a Day boundary without reminting. | `grounding220:factory-return` |
| NOW22 | Barriers converge exact child Returns. | `grounding220:factory-return` |
| NOW23 | Factory's Live and Trajectory readings show exact temporal and material correlations. | `grounding220:factory-return` |
| NOW24 | A produced result or handoff reopens the correct continuing work. | `grounding220:factory-return` |
| NOW25 | Explicit projection produces a live FieldNow in SpaceTimeDB. | `web65:CONTINUITY` |
| NOW26 | Another independently grounded Participant or World can appear beside it. | `web65:CONTINUITY` |
| NOW27 | FieldDay keeps its own aggregation policy while source Day refs stay intact. | `web65:CONTINUITY` |
| NOW28 | Live subscriptions update projected Activity, Presence and Contributions. | `web65:CONTINUITY` |
| NOW29 | Service loss and reconnect reconcile without local identity loss. | `web65:CONTINUITY` |
| NOW30 | Withdrawal or revocation removes shared availability without deleting local source. | `web65:CONTINUITY` |
| NOW31 | Private or unprojected NOW, source and log material is absent from hosted state, search, backlinks, previews and Encounters. | `web65:CONTINUITY` |
| NOW32 | The NOWs monitor (manual §23.6) shows the primary and Omarchy coherently. | `grounding220:presence` |
| NOW33 | The NOWs read by project, by Journey and by agent, and the session's own depth, co-refer to the same work. | `grounding220:presence` |
| NOW34 | The Day shows the human Day and late Returns without rewriting occurrence history. | `grounding220:presence` |
| NOW35 | The rail's NOWs and Agent tiles (manual §18.1 On the rail) give direct entry to live current agency rather than another dashboard. | `grounding220:presence` |
| NOW36 | The person can tell open here, open remote and move work apart through their actual effects. | `grounding220:presence` |
| NOW37 | Desktop, TUI and hosted views keep the same semantic refs and native Action lineage. | `grounding220:presence` |

NOW32–NOW37 were written for the retired cradle (My Now, Observatory, footer, Explore); the cases above name the DLW's equivalents. Stories: WM08–WM10, CC07, CC08, RF12, GA03, GA04, GD11, TX14.

## NOW, Paradigm and Return (NPR01–NPR10)

The first success is concrete: **a concern stated in ordinary use becomes a source- and task-grounded inquiry, an authorised improvement, and an independently checked difference encountered again in the same world.** The walk is LOCAL-CAMPAIGN §10.7; the recoverable relations are in [execution and Return](../architecture/execution-return.md). These negatives elaborate the existing obligations (`grounding220:composition`, `grounding220:factory-return`, `grounding220:joined`) and the stories WK07, GV03, GV09, RK04 and DV08; they do not replace their source-defined coverage.

| Case | Required observation and negative |
|---|---|
| NPR01 | A rule selected but not loaded: the inquiry reports it as selected and not loaded, never as followed or broken. |
| NPR02 | Unknown activation: activation inferred from an adapter is labelled as inferred; no unqualified "loaded" is shown. |
| NPR03 | A conflicting or stale native instruction: the competing instruction is named with its precedence and its owner. |
| NPR04 | A wrong diagnosis: the finding keeps the evidence against it and is revised when that evidence holds. |
| NPR05 | No correlation available: the reading says which evidence is unavailable rather than inferring a link. |
| NPR06 | Duplicate parent and child telemetry: one Activity seen in several views is counted once. |
| NPR07 | A returned task whose outcome is still unsatisfactory: returned is not recognised, and the concern stays open. |
| NPR08 | Stale verification after editing: a check made before the edit shows as stale against the new revision. |
| NPR09 | A proposed source change the person rejects: the rule stays as it was, and the rejection and the original occasion are kept. |
| NPR10 | A closed view whose work legitimately continues: closing the view neither cancels nor fails the work. |

## Prepared NOW context (PNC01–PNC18)

Each participant in an undertaking receives its own prepared view through the existing native entry, delegation and continuation path, before its first relevant turn ([agent context](../architecture/agent-context.md), Prepared NOW context). The decision helper is the one the manual calls Kev (§19.20, §25.2); the September sources call it Jev. Native procedure, schemas and service policy belong to AIKit (`docs/JEV-REDIS-NOW.md`, ai-kit #388) and Workcell (`docs/REDIS-NOW-SERVICE.md`, Workcell #98). Obligations: `grounding220:composition`, `authority-delivery`, `recovery`, `remote`, `guardians`, `factory-return`, `presence` and `joined`.

Within C0–C5: C0 selects the real intended experience and the current native document and capability field, then binds the first operation and relevant practice; C1 prepares the Redis, service, context and harness conditions and independent actor and verifier inputs; C2 performs useful work using the prepared field; C3 introduces related participants and a consequential source or Return change; C4 preserves failure, repairs and replays; C5 independently verifies the result and its document and knowledge Return. Source, controlled, native, live-provider, material and human evidence are reported separately. The live helper, actual Redis and real harness delivery must be exercised for the integrated verdict; controlled fixtures stay useful for failures and never stand in for those providers. A Redis record, a source compiler result or a provider response alone is not an episode. Use disposable Redis material for proofs; never flush a database.

| Case | Required observation and negative |
|---|---|
| PNC01 | Warm and cold preparation: preparation happens before the first relevant provider turn; a warm read serves the prepared view without calling the helper again. |
| PNC02 | The helper is invocable generally, outside any predefined document mode, with state, typed questions and structured answers. |
| PNC03 | Delivery through the CLI with no MCP server, on at least one real harness path. |
| PNC04 | Several capabilities composed together, with every member of the declared scope accounted for, and a need the current catalogue does not represent shown as such. |
| PNC05 | A source change invalidates the affected basis; a source change during preparation refuses the late publication; a stale expected version is refused. |
| PNC06 | Late, missing and malformed provider answers are refused; none is shown as a successful reading. |
| PNC07 | Revocation and egress: revoking access makes old cached content unavailable to the revoked actor; implementer, related worker and verifier views stay isolated; verifier-private material is absent from worker delivery. |
| PNC08 | Replayed and duplicate notifications are handled once, each participant keeping its own consumption position. |
| PNC09 | An uncertain reservation is reconciled after restart before reuse; lapsed presence never authorises overwriting. |
| PNC10 | Session end and Day rollover lose no waiting work. |
| PNC11 | One source keeps one identity across BKMR, Wiki and Redis. |
| PNC12 | Companion sources are updated coherently, and a fresh agent re-enters and uses the revised field. |
| PNC13 | The provider receives the prepared participant view, and AIKit records the prepared version and digest actually accepted for delivery. |
| PNC14 | A fresh session continues the same participant by compare-and-swap. |
| PNC15 | Redis restarts with its persisted records; prepared context recovers or the actual degradation is reported. |
| PNC16 | Redis selected but unavailable is reported as degradation or failure, never treated as the enhanced path. |
| PNC17 | The first real Factory episode: implementer, related-worker and independent-verifier child NOWs with declared write scopes and dependencies; a real source or contract change; the related Return reaching the consumer that needs it; fresh-session continuation; Redis restart and recovery; a warranted document, Wiki or practice Return; a later fresh participant using the revised field. No new scheduler or workflow store. |
| PNC18 | Three matched arms on the same bounded undertaking, source basis and worker model: ordinary context; Redis-prepared context without the helper's selection; helper-assisted preparation. Record only observed metrics: context-discovery calls, time to first useful action, source and capability omissions, stale decisions, duplicated work, handover success, corrections, acting-model, helper and retrieval cost and latency where actually reported. Unavailable metrics stay unavailable; no invented zeros or derived prices. The verifier's expected result stays outside worker preparation. |

## Workspace continuity (C01–C30)

The continuity contract is [Cradle architecture §6.1–§6.8](../cradle/02-ARCHITECTURE.md). The decisive proof is one ordinary working sequence: open HTML, edit or interact, change tabs, change mode, change workspace, return, close and reopen the application, and recover the same supported working state while the navigator is deliberately slow. Then add memory-pressure release, external changes, dirty drafts and corrupt records. Correctness must hold when every disposable view has been destroyed; retained DOM is an optimisation, not the only copy of the person's work.

Record end-to-end traces with intent, workspace, window, surface, subject, revision and generation IDs, covering intent, binding acknowledgement, queue wait, owner admission, owner read, material delivery, decode and parse, view mount and reveal, document ready and interactive observation. Count directory calls, body acquisitions, cache hits, iframe navigations, emulator attaches against native spawns, active listeners and timers, long tasks, checkpoint writes and eviction reasons. Never log private file contents or tokens. The warm targets (p95 ≤ 50 ms for a retained tab return and a cached folder expansion; p95 ≤ 100 ms for a retained arrangement return) are engineering targets, not measured results; workload definitions, hardware and build, sample counts and cold and reconstruction budgets are fixed before performance completion is claimed. Self-contained local documents and pages awaiting external assets are reported apart, as are source-read and parse or render costs.

The matrix below is copied word for word from the execution map `.superpowers/sdd/cradle-rebuild/WORKSPACE-CONTINUITY-WAYFINDER-2026-09-19.md` §4 (L120–155), which code cites ("matrix C24/C25"). If it moves here, the execution map points here.

These test IDs are proposed coverage, not claims of existing tests or passing results.

| ID | Scenario | Required observation |
|---|---|---|
| C01 | Switch away from and back to unchanged warm HTML 100 times | Same document-instance identity; zero visibility-caused navigation/body reads; p95 warm reveal target <=50 ms. |
| C02 | Tab move, split/merge, maximize/restore | Stable subject/view; no accidental iframe reload; exact caret/scroll or supported checkpoint restoration. |
| C03 | Change arrangement repeatedly | Same open bindings; last requested mode wins; no native close/open churn caused only by concealment; <=100 ms p95 retained return target. |
| C04 | Workspace A -> B -> A within budget | A's views/models survive appropriately; B never receives A's late open or focus completion. |
| C05 | Delay every directory-list response by ten seconds | Warm file return and independent direct file acquisition are not waiting for the tree; pending destination appears promptly. |
| C06 | Cold file with three simultaneous equivalent consumers | One coherent acquisition shared; owner admission remains real; errors reach each correct consumer. |
| C07 | Native HTML versus bridge HTML | Declared revision equals served/rendered basis; count owner acquisitions and transport deliveries separately. |
| C08 | Source-backed HTML/Day versus ordinary HTML | Correct existing owner route, draft basis and material lifecycle in both cases. |
| C09 | Cached collapse/re-expand; large visible tree | No unnecessary readdir; <=50 ms p95 cached expansion target; DOM proportional to visible rows, not all visited nodes. |
| C10 | Refresh fails after successful file/directory read | Allowed last content remains readable; error and retry local; empty and unavailable not conflated. |
| C11 | External file edit with dirty local draft | New canonical revision is observed; draft preserved; no silent overwrite; CAS conflict remains enforced. |
| C12 | Older slow read completes after newer read/receipt | Older value rejected or kept only as its own historical reading; current revision never rolls backward. |
| C13 | Rename/delete while hidden; path later reused | No identity confusion with replacement file; source availability and recovery choices truthful. |
| C14 | Owner/transport change, receipt gap or watcher overflow | Relevant entries revalidate; authorization partition respected; no silent eternal freshness. |
| C15 | Access revoked or different user/World uses same path | No cached authority reuse or prohibited disclosure; owner retention policy applied. |
| C16 | Force-release all disposable views | Working models, drafts, selections and logical open membership survive; no keep-mounted-only success. |
| C17 | Close/relaunch application | Workspace/per-mode layouts, demanded tabs and supported checkpoints recover independently of tree traversal. |
| C18 | Crash after acknowledged draft checkpoint | Acknowledged content survives; any unacknowledged loss bounded by the declared policy and reported honestly. |
| C19 | Corrupt one workspace, one binding, one view checkpoint | Valid siblings recover; originals quarantined; fallback never overwrites the only copy. |
| C20 | Truncated whole book, future schema, storage full | Last committed state/raw bytes protected; visible recovery/save failure; no silent downgrade or empty replacement. |
| C21 | Concurrent main and detached window writes | No lost tabs/drafts from whole-book last-writer-wins; checkpoint versions/origin fields correct. |
| C22 | Native terminal hidden, released, detached, redocked | Separate emulator attach and native spawn counters; intended owner process continuity; unsupported restart truthful. |
| C23 | Agent Run continues behind hidden view | Native work continues; hidden presentation polling/render work bounded; returning view catches up from owner state. |
| C24 | Managed HTML suspension; arbitrary HTML comparison | Managed adapter acknowledges pause and removes its background work; unsupported page never falsely reports suspended. |
| C25 | Late load/ready message from retired iframe generation | Ignored; cannot clear the new surface's loading/error state or claim wrong revision ready. |
| C26 | Sidebar hide/remount and conversation relocation | Same conversation/session, drafts, pinned context and selection refs; no duplicate subscriptions or modal. |
| C27 | Cache budget exhaustion and failed checkpoint | Predictable eviction of safe candidates; dirty uncheckpointed work protected; bounded steady-state warm resources. |
| C28 | Restore focus after user already navigated/typed | Restoration does not steal focus, caret or selection from newer user intent. |
| C29 | No QL/GPU, reduced motion, keyboard-only operation | Ordinary files/loading/retention remain usable and accessible; hidden views are not focusable. |
| C30 | Repeated mixed-workload loop and idle sampling | No cumulative timers/listeners/iframes/leases; no unrelated tree refresh storm or hot-path full-book serialization. |

Warm timing targets apply to resident/cached test classes with no invalidation requiring replacement. Report 100 warm iterations, raw samples and p50/p95, with the same build/device/workload before and after. For slower cached reconstruction, cold start and process restart, WF0 records fixed fixture sizes, asset availability and budgets; do not move them retrospectively to disguise regression. A faster spinner or pre-painted screenshot does not count as interactive content.

## Expression Field: standings and negative cases (EFN01–EFN13)

An Expression reached through the field, a page or a shared world ([stories XA01–XA11, XS, NF](STORIES.md); the contract is [EXPRESSION-APPLICATION-V1](../contracts/EXPRESSION-APPLICATION-V1.md)). Keep these standings separate:

```text
vision / UX specified
contract implemented
native operation technically supported
Agent capability discovered/projected/loaded
controlled operation exercised
real desktop/engine exercised
provider/material path exercised
human assessed
SharedField/two-world assessed
```

A screenshot, static graph, passing registry check, generated page, green headless test or plausible Agent narrative cannot independently close the experience.

Each case below is a condition the Expression is tested under. The desired result is graceful, inspectable degradation—not capability theatre and not hidden manual repair.

| Case | Condition |
|---|---|
| EFN01 | Unavailable/missing native subject or source |
| EFN02 | Stale Wiki/source revision |
| EFN03 | Stale domain generation |
| EFN04 | Denied Action/authority |
| EFN05 | Agent capability unavailable despite visible UI affordance |
| EFN06 | WebGL/audio/provider loss |
| EFN07 | Scene/configuration restoration without exact dynamic checkpoint |
| EFN08 | Private subject projected toward a broader audience |
| EFN09 | Imported legacy data requiring migration |
| EFN10 | Relation/layout source absent |
| EFN11 | Agent operation interrupted or refused |
| EFN12 | Concurrent human/Agent editing |
| EFN13 | Embedded renderer unavailable and fallback used |

## Vāk-authored Expression craft: the joined walk (vakcraft65)

The walk that proves the `vakcraft65:*` obligations ([vak-expression-craft.json](vak-expression-craft.json)); its experience is in the XA rows of [STORIES](STORIES.md) and its laws in [EXPRESSION-ACT-MATERIAL-V1](../contracts/EXPRESSION-ACT-MATERIAL-V1.md) §7.

Use the actual Factory/Day/NOW and integrated Expression cut in a bounded Omarchy test world. Prepare the full capability/role coverage before choosing specimens. The real operator receives an ordinary concern and native discovery, not an answer key. First prove a generic typed Factory workflow with QL/Epi absent; then prove the optional Vāk expressive undertaking through the same source/compiler/Run/trajectory route.

```text
request / source / NOW
→ Factory-owned typed undertaking and native first-source stamp
    + optional source-qualified Vāk interpretation
→ actual selected participants and tool/context delivery
→ compose and perform in the real Expression body
→ pause / inspect / manual change / interruption / continued work
→ observed result and independent comparison
→ curated source-bound work and appropriate practice Return
→ fresh-agent name/action/mood/gesture resolution on changed inputs
→ same subject across Expression / Technē / page / subtle placement
```

Exercise all six CFP forms with actual differing conduct, exact CS and other selected C′ effects, cancellation/material stop, stale/concurrent changes, missing tools or models, disconnected handlers and unavailable renderers. Preserve source/knowledge/Expression identity through #366's actual Wiki projection where applicable. Keep configuration and exact physical state recovery distinct. A request accepted or a screenshot produced is not the joined proof.

The current new UI remains the receiving design; Factory's **Desk / Tasks** centre and **Run / Agents / Context** expose their existing source/participant/work/result relations without a second monitor. No new shell, per-coordinate mini-app or permanent graph/agent furniture is commissioned. The same admitted work can later enter hosted O:I Web; the visitor has no new learner-install or agent-key prerequisite.

Follow the existing #65 C0–C5, Factory's native authoring plan and the domain Wayfinder's VW0–VW6 packets. Factory generic authoring/publication, QL's optional VW1 adapter, live tools and clean role delivery can develop in parallel against one shared native boundary; real Factory craft consumes the returned joins. Reuse one code worktree per coherent feature line, not per agent/session. Sandboxes and disjoint artifacts are separate allocations. Preserve current Mac/frontend work, the held QL kernel/install and independent running reviews. This publication launches no worker and certifies no runtime.

Preserve per-owner ordering/cursors, occurrence versus receipt time, bounded payload loading, tool input/output/error and actual available model/usage/material provenance. Unknown or unsupported native fields stay unavailable. Retries, late results and successor workflow revisions retain separate history; source edits do not rewrite past attempts, and an event must not be correlated by a guessed display name. Test source-to-log and log-to-source traversal, no-QL/no-DSH operation, an actual DSH maximal route where available, thin-harness degradation and reconnect while inspecting history.

## Technē and Expressions over one field (TD1–TD8)

One selected subject read through Technē's instruments and the 3:3 Expression without becoming another subject. The laws they test are in [world ownership](../architecture/world-ownership.md) (Technē and Expressions over one field); the round they run in is [LOCAL-CAMPAIGN](LOCAL-CAMPAIGN.md) §1.4.

### TD1 — the Project instrument is the existing World

Open a real Central/ProjectCentral Project, locate a subject through AIKit Search/Wiki/ProjectMap and move through available LIST/TREE/GRAPH projections.

Prove:

- stable native ref across projections;
- project/root Wiki distinction retained;
- optional QL overlay removable without changing canonical Wiki identity;
- current O:I graph uses the same knowledge world rather than copying it;
- no second Projects/search/graph store.

### TD2 — Canvas construction

Take the same subject/whole into the Canvas.

Prove manual presentation state stays distinct from semantic relation mutation, while explicit relation/member Actions reach the actual owner.

QL/constellation layout may inform presentation only when source-backed.

### TD3 — relation/time truth

Use a case containing both datable and non-datable relation material.

Prove the UI preserves distinctions among chronology, cause/influence/echo/instantiation and evidence standing. Archetypal or cultural relation does not become a fake historical date.

Where DAY/NOW/Run/Session are involved, occurrence, receipt and validity remain distinguishable.

### TD4 — the cross-cut / Journey → Expression

Compose a Journey from real refs and persist/resolve it through real Expression Scene identity.

Then:

```text
open Journey
  -> enter Scene in living Expression
  -> inspect/open source/verso
  -> return to Journey/deep field
```

Prove one Scene identity and one source basis. No Journey shadow scene store.

### TD5 — World / Places depth

First prove one historical-geography case:

- exact Place identity;
- relevant relation type (`OCCURRED_AT`, `LOCATED_IN`, `OPERATED_IN`, `TRAVELLED_TO`, `MYTH_LOCATED_AT`, etc.);
- temporal validity;
- precision/uncertainty;
- provenance.

Where the current accepted M2/M3/M4 providers are installed, also prove the wider reference-frame relation:

```text
planetary/solar condition
    -> Earth/shared world occasion
    -> geographic context
    -> Nara/current situated body
```

No renderer-local astronomical recomputation and no fake provider availability.

### TD6 — Palace / Return

Compose several real subjects/Expressions/Views/Journey elements into the Palace's whole.

Prove arrangement is composition/presentation state; each underlying object remains independently addressable; one recognised result can return as attributable Wiki/source proposal/accepted knowledge through the native owner.

### TD7 — Anima / Technē Agency

For one selected subject with both modes available, Anima, the Expressions companion, works the 3:3 Expression and Epii, Technē's companion, works its instruments (the former "Aletheia_i in Technē_i role", bound to the M_i′ instrument, went with the four-and-two reading). Prove both use the ordinary Actuation + AIKit + O:I session/Action infrastructure and preserve the canonical Guardian_i identity.

Do not create twelve bespoke runtime Agents merely because twelve operative profiles are conceptually distinguishable.

### TD8 — cut continuity and renderer lifecycle

Cross repeatedly among Project graph, at least two deep instruments and Expression.

Prove:

- exact selection/ref continuity;
- expected Agent/session continuity;
- hidden heavy renderers suspend/release;
- no duplicate point-cloud, graph, globe or media loops;
- split/detach/re-dock/front-verso transitions preserve semantic identity.

## Shared field participation (SF1, the Shared Stage walk, web65)

Sharing and taking part in O:I worlds ([stories TO, SH, TX](STORIES.md); the laws are in [shared participation](../architecture/shared-participation.md)). The `web65:*` obligations are in [shared-field-world-participation.json](shared-field-world-participation.json).

### SF1 acceptance walk

SF1 cannot close until this works in the running desktop against the real carrier/service available at that point:

```text
Project A / Expression E open in local Work Workspace
→ open global Explore
→ Search resolves an addressable projected Thing/world
→ result reveals eligible Expression / WorldPresentation without collapsing identity
→ WorldPresentation becomes the main canvas body
→ live Expression renders, or explicit safe fallback renders
→ summon relations/source depth and dismiss it
→ summon personal Agent without replacing the shared subject
→ full/split/detach/re-dock the presentation
→ return to Explore field with selection/history intact
→ return to prior Project A / Work/Personal Workspace intact
→ kill/relaunch
→ same valid Workspace constellation restores by refs/revisions

local Thing / ordinary Expression
→ Share / Project
→ inspect exact outward preview and omissions
→ choose admitted audience/destination
→ create Projection
→ Open in Explore
→ see the exact projected representation/ref
```

Also prove:

- offline/unavailable SharedField state is honest and does not erase local work;
- private sentinel data is absent from outward payload and fallback;
- opening a projected Agent does not replace the person's AgentSession;
- SessionSpace does not become Workspace/SharedField state;
- no new sidebar, graph store, chat store, workspace store or desktop SharedField database exists;
- human and structured Agent readings identify the same projected subject and revisions;
- projected HTML navigation is driven by structured refs/relations rather than DOM scraping.

Human judgement must confirm that Explore feels like entering another world/field rather than opening a platform administration dashboard.

---

### Shared Stage acceptance walk

```text
World A projects Expression E / WorldPresentation W
→ World B discovers it with Explore Search
→ both enter SharedField F
→ Presence becomes live
→ A opens Shared Stage over projected E
→ B explicitly chooses Follow
→ A changes admitted scene / shared focus
→ B receives the new stage revision
→ B chooses Unfollow and keeps a local reading
→ B contributes a refinement
→ owner accepts through the native Expression/source Action
→ optional reprojection advances the outward representation
```

Prove that A's local tabs/camera/private drafts/Agent context and Nara internals never appear in B merely because B followed the stage.

### First integrated delivery

Use Mac and Omarchy with the already-established Gateway and Herdr environment. Start with the current installed/source receipt and relevant active claims. Preserve accepted carrier and communication work; repair only reproduced gaps and missing joins. Substantial implementation belongs on the Mac; Omarchy carries discovery and independent replay. Shared source/bridge/renderer changes have one integrator and heavy builds/installations follow the existing per-machine authority and caches.

1. From actual ordinary desktop entry, select and project a coherent region of World A: a Workcell description/offer, an Agent with an inspectable Skill or Method, a source-backed project/knowledge constellation, authored Beings/Things presentation and current meaningful activity. Each constituent and its typed relations is independently addressable.
2. World B discovers that world through search, traverses its actual bounded graph, reads the Workcell and agent/practice presentations, and opens the same knowledge and activity Expressions. Verify normal language, exact refs, structured resolution and the general operative syntax through their actual native paths.
3. B joins a bounded undertaking with its own real agent, delivering eligible shared context into the actual body at its known Workcell. Send both a field-directed contribution and an exact-instance message. Require substantive work and a response/result tied to the same field and native activity.
4. Produce and review a useful shared artifact/Expression or knowledge refinement. Apply the accepted difference through its owner, reproject it, and use a shared Skill/Method through explicit adoption or offered invocation in a later real task. The original practice identity and intentional local adaptation remain traceable.
5. Preserve a frozen edition and replayable activity at their actual supported fidelity. Reconnect, replace a body and reopen the field; continue from native source/history without duplicating work. Return to the prior local workspace intact.

Choose a genuine concern such as explaining/reviewing a selected current essay relation; the shared world, agents, Workcell and practice must remain part of the exercised feature. A single file upload and two chat replies do not cover world participation. Use controlled, openly authored source for repeatable/public tests and owner-permitted material for actual use.

### Independent tests which discriminate the claim (web65)

| Obligation | Required positive and boundary proof |
|---|---|
| web65:WORLD | Project a coherent world including Workcell, agent/repertoire, practice, knowledge and activity; resolve each native identity and current outward revision from an independent world. Partial composition works; projected offer differs from granted use. |
| web65:EXPLORE | The installed Explore entrance completes search→bounded graph→Being/Thing→knowledge/activity Expression→back/restore. Same-label objects in different worlds resolve correctly; actual controls and resource behaviour are walked. |
| web65:RESOLVE | Normal and structured resolution share selected refs, horizon/operator meaning and field scope. Exact/fuzzy paths remain useful without optional deep providers; private adjacent records stay outside results, counts and payloads. |
| web65:PARTICIPATE | A second real agent joins, receives the scoped field and performs useful work from its actual Workcell. Field/Position messages follow declared routing, while exact-instance messages cannot silently follow replacement or a same-name peer. |
| web65:ACTIVITY | Live Expression reflects actual owner activity and artifacts; producer disconnection changes liveness. Frozen and replay readings retain their basis and never repeat historical side effects. |
| web65:RETURN | A substantive contribution returns through its native owner, is reprojected and used later; a shared practice is deliberately adopted or invoked and actually helps a task. Stale revisions, corrections and local variants remain intelligible. |
| web65:CONTINUITY | First prove one World across both Workcells, then independently authorised test Worlds on those machines. Server/gateway loss, source offline, duplicate/late delivery, withdrawal and body re-entry preserve the valid source/temporal/work relations and local work. |
| web65:MATRIX | Every tested branch carries reviewed exact native capability/source/operation/praxis bindings and independent observation. A disconnected producer must fail its dependent test. Missing code or binding stays an explicit owner gap; completed file/fixture/source checks are not runtime acceptance. |

Bind executable cases to these obligations in the existing `desktop/cradle/walk/scenario-bindings.json` and native suites as they are implemented. Source-module regression checks only prove coverage/compilation and retained source; installed provider, independent two-world operation, semantic quality and human experience each retain their actual evidence level.

The coordinator holds the full source/matrix/test oracle. Ordinary actors receive meaningful bounded work and their normal prepared World, not the verifier's tool sequence or expected result. Each necessary repair is followed immediately by replay of the original activity and independent fresh-body verification. Retain evidence and any warranted learning through current Factory/NOW/Wiki/practice owners. The human does not relay packets or compensate for missing native delivery.

## Personal Web (PW6 and the integrating route)

The PW family's proving, with its contract in [Personal Web](../cradle/PERSONAL-WEB.md).

| Case | Required observation |
|---|---|
| PW6 | Source→build→installed→registered→running/loading cut, reinstall/recovery, native/provider/two-world and human UX through the existing local orchestrator. Hen consumes the six forms and a seventh through #94 SP10–SP15. |

The integrating route is author → Wiki → Card/Cube or page → filtered publication → independently grounded encounter → contribution → authorised revision-checked Return → reprojection. Include private sentinel data absent from external HTML, JSON, assets, indexes and backlinks. Use owner/member/stranger, distinct worlds/credentials, revocation during subscriptions, reconnect, concurrent stale writes, source-offline hosted availability, restart/backup recovery and narrow/maximised/standalone/hosted readings. Two windows with one token do not meet the requirement.

Card: two real art directions with the same semantic body. Cube: full teaching plus second supported subject, verified intermediate mechanism states. Extensibility: second custom world and seventh template. App: Work/Personal switch preserves ongoing work, author identity, layout and drafts. Media/graph/windows: measured bounded resources, no duplicate simulations, hidden-view pause and proper disposal. Accessibility/reduced motion/plain reading retain meaning. Significant design and actual collaboration receive human review, not simulated approval.

## Plural Flow: the first complete encounter

The whole activity that MP01–MP18 above take apart ([stories CJ](STORIES.md); the contract is [plural Flow](../architecture/plural-flow.md)).

A human opens an actual source-backed Flow and brings in two distinct agents. One investigates an argument; the other tests an example. Their concurrent contributions answer the same question without becoming one undifferentiated assistant. A side inquiry develops; a later contribution relates both answers. The human changes a material assumption while an answer is in flight, closes the view, then returns to all contributions with their actual bases. The undertaking continues through a fresh body and a Day boundary, with an actual saved Expression and useful retained understanding.

Run that encounter locally first, then across Mac/Omarchy, then between independently authorised human worlds. Controlled accounts can prove multi-user protocol boundaries; two actual humans supply the separate human encounter evidence.

## Wiki and constellations: the first integrated walk

The walk WCT01–WCT18 above take apart.

Use an ordinary linked Markdown collection with no QL preparation. Read, preview and follow backlinks; filter the quiet graph; select exact passages; construct a constellation by each starting route; collaborate with a real agent on the same editable state; make glyph/text/image/line/particle presentation in the existing 3D Stage; create real Scenes and Palace composition; save and return QL relations and an artifact; rediscover them in the Wiki; resume after mode switch and restart; revise a source and inspect only the affected work.

Reuse one source in a second constellation. Exercise a stale concurrent agent edit, a failed relation save after successful presentation save, ambiguous/unresolved links, a slow/offline provider, and denied/private material. The full cases are WCT01–WCT18 in the Wayfinder. Native controlled checks, actual provider/material observations and human experience retain their distinct evidence grades.
