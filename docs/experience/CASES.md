# Acceptance cases

Cases that stories and tickets cite by ID. Each has its own expected observation; a test exercises the real owning path, and a component fixture proves only its component. The standard a story is held to is in [LOCAL-CAMPAIGN](LOCAL-CAMPAIGN.md) §2.2.

## Plural Flow (MP01–MP18)

One conversation across people, agents and worlds ([PLURAL-FLOW-SPEC](PLURAL-FLOW-SPEC.md)). The native owners are Central's Flow append, AIKit's encounter conversation and the shell's plural Flow ([architecture](../architecture/plural-flow.md)).

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

Wiki reading and editing without QL, constellation construction, the agent's construction space and Return ([WIKI-CONSTELLATION-UX](WIKI-CONSTELLATION-UX.md); decisions WC01–WC15 in [the practice position](../positions/WIKI-CONSTELLATION-PRACTICE.md)).

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
