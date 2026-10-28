---
role: architecture
standing: agent-inference
scope: ordinary plural Flow dispatch, recovery and incorporation
diagram_refs: ["plural-flow.mmd"]
design_refs: ["../experience/STORIES.md", "../experience/CASES.md"]
updated: 2026-10-28
---
# How does an interrupted Flow return?

![Plural Flow](rendered/plural-flow.svg)

The ordinary Flow is a `ql-doc` HTML file in the person's Central
`Control/user/flows/`. Central owns its source mutation and revision. O:I edits
and presents it through the existing document Surface. This is the current
route for ordinary plural Flow. `PROJECTCENTRAL-FLOW.md` describes registered
continuity identity, metadata and older placement rules; it is not the public
request/delivery protocol. Use the plural specification and native append
source for this operation, including its authorised `Control/user/flows/` path.

The public operation is `aikit session-space encounter --request-json <JSON>`
(or `oi aikit session-space encounter` through the suite). `conversation-send`,
`conversation-read` and `conversation-reconcile` are JSON `action` values,
not positional CLI subcommands. Send supplies
`{"action":"conversation-send","request":{...}}`, with the real
`ConversationSendRequest` defined in the source below. Recovery of an existing
request uses:

```sh
aikit session-space encounter --request-json '{"action":"conversation-reconcile","request_ref":"<existing request ref>"}'
```

Send admits the Flow-bound sender, request digest and one to 32 recipients.
Before dispatch, Central's native append
operation commits the original entry, retrying a source conflict without
overwriting the intervening edit. Its operation ref/digest makes replay
idempotent. A request record without that source acknowledgement cannot dispatch.

AIKit rechecks current membership/seat authority, builds an attributed bounded
packet from the actual source, and targets the actual Agency's canonical
session. Local resident delivery and explicit SSH/exec remote routes are
implemented carriers. A connection/session signal is not participant identity.
Delivery/cursor state and replies are durably journalled; serial delivery on a
single provider session prevents reply attribution crossing adjacent turns.
Independent sessions can proceed independently.

After interruption, `conversation-reconcile` reads durable state and reconciles
acknowledged steps. Unknown provider continuation becomes `reconciled-no-replay`;
it is never automatically resent. Inclusion retries can terminate in refusal
after their bounded attempt limit (currently 20). A completed nonempty reply
is incorporated only after current
membership is checked again. Central's append records the original request and
source revision, actual agent/session/generation/Workcell and bounded reply.
Its native acknowledgement marks inclusion; reread/reopen shows the source
result, rather than trusting a desktop bubble. The JSON request addresses the
current native encounter owner; it does not start a replacement provider or
derive participant identity from a socket.

| Operation/source | Storage and lifecycle | Verification route |
| --- | --- | --- |
| Central Flow append, `ctrl/src/flow_append.rs` included by `file_mutation.rs` | Source CAS, policy/lock/journal; entry.request ref/digest and reply relation | `ctrl/tests/flow_append.rs`, shared plural conformance fixtures. |
| AIKit `conversation_send/step/admit/incorporate`, `crates/aikit-cli/src/encounter_conversation.rs` | `state/encounters.sqlite3`: request/recipient state, source ack, delivery IDs and cursors in `crates/aikit-store/src/encounter_conversation.rs` / `encounter_delivery.rs` | `crates/aikit-cli/src/encounter_conversation_tests.rs` departed/queued/running cases and the independent return (retired 27 Oct into the DLW map, O-I #706; read it at `8873b0968`). |
| O:I native document integration | `desktop/cradle/src` and embedded plural module | `desktop/cradle` `test:plural-flow`; installed keyboard/pointer proof has its own standing. |

The map reports an installed AIKit `02395f05` / Central `fe269e19` interrupted
Mac↔Omarchy episode and source readback. The retained receipt demonstrates
saved attribution and historical reply relations. The restored
[local and remote logs](../experience/evidence/plural-flow-20260930/README.md)
record interruption, restoration and `unknown → returned → included`.
The driver creates an SSH refusal flag, waits 30,000 ms and removes it;
the logs support that driver-controlled interval but have no break/restore
timestamps independently measuring elapsed time. This episode does not prove
withdrawal during recovery; the departed-participant tests below cover that
separate source boundary. D1–D9 are recorded repaired;
D10 remains open at this cut. Hosted SharedField/Gateway-native transport,
facilitated team budgets/cancel, independent two-human participation, Workcell
succession and installed pointer/keyboard completion still need their named
acceptance. These are not implied by the ordinary native route.

*Note, 28 Oct 2026.* D10 is closed (#766). The verifier found that Central's
append wrote the whole island back with its keys in alphabetical order and
rounded integers in unknown metadata. Measured on Central `3adbfabf98fc`,
integers that fit in 64 bits survived and larger ones did not:
`18446744073709551617` came back as `1.8446744073709552e+19`. A JavaScript
reader already rounds anything above 2^53. The append now writes only what it
owns into the island as it stands: the new entry after the last one,
`meta.revision`, and the binding a verified caller sets. Every other byte stays
as written. The shared case `an-append-keeps-every-island-byte-it-does-not-own`
in `desktop/cradle/documents/fixtures/plural-flow-cases.json` has keys out of
order and integers above 2^53 and 2^64. It passes in Central's
`ctrl/tests/flow_append.rs` and in `desktop/cradle/tests/plural-flow.test.mjs`.

The transport line above was true at this cut and is not true now. AIKit #477
(merged 1 Oct, `4f89f5c0`) gave Flow encounter requests to another Workcell
the gateway carrier. AIKit's `docs/implementation/GATEWAY-OPERATIONS-ACCEPTANCE.md`
("Native remote Flow delivery", read at `693ab2b0`) records two Flow requests
delivered from the Mac to Omarchy over that relay with ssh broken throughout,
each reply included once, with a controlled ACP body. Still unshown on that
route: a model body, the real Omarchy gateway as the relay target, the reverse
direction and a person using the desktop. Hosted SharedField and the other
items stand as listed.

*Note, 28 Oct 2026, later.* The form's own save and the host's save
(`embedDocument`) now write only what changed, as Central's append does (#785,
`desktop/cradle/src/flow/plural.ts` `spliceIsland`, ported from Central's
`flow_append.rs`). The case `an-append-keeps-every-island-byte-it-does-not-own`
passes through the host's save and the page's own "Save complete copy".
Central's copy of the shared cases is pinned to O:I's source by sha256 in
`ctrl/tests/flow_append.rs`. The kernel's own field writes (`page.rs`
`mutate_field`) still re-sort the island's keys (#793).

The departed/queued/running tests exercise real EncounterService and Central
files with scripted ACP processes. Their `need_ctrl!` guard can return early
without `AIKIT_TEST_CENTRAL_CTRL`; a passing runner without that native binary
does not prove the boundary. The fresh-agent navigation inspected these tests
and current source bytes; it did not execute a new live-model episode.

F1–F10 in [relations.json](relations.json) identify each implemented relation.

## The plural Flow contract

The intended experience is the CJ family of [STORIES](../experience/STORIES.md) and manual §18.1; the cases are MP01–MP18 in [CASES](../experience/CASES.md).

**Flow holds the developing conversation and its material. NOW holds the undertaking in which it matters. SessionSpace brings actual runtime sessions and Surfaces into relation. Day places the encounter within each person's continuing life.** These meanings are complementary, not aliases.

### One native relation, several participating owners

#### The objects and their jobs

| Existing object/relation | Job in this feature |
|---|---|
| Flow document | Durable rich writing/conversation and its contextual relations, with original entries and retained revisions. |
| NOW | Intention, relevant subjects, participants, outstanding work and continuation for the undertaking. A Flow may continue through several bounded NOWs. |
| SessionSpace | Runtime/Surface participation of one or more actual AgentSessions; a shared conversation can also relate several locally owned SessionSpaces. |
| Agent / human identity | The continuing participant, independent of a name, initial, model, machine or particular session. |
| Agency / AgentSession / generation | The particular attributed occurrence which performed or received an act. |
| Workcell | Where that occurrence and its supporting services materially operate. |
| Communique / native request | Addressed contact, routing, delivery and request/result correlation. A small contact need not create a Flow or new NOW. |
| SharedField Contribution | The shared act and its field/subject/reply/presentation relation. It may represent the same exchange as a Flow entry without taking over the entry's source ownership. |
| Personal Day / FieldDay | Separate temporal readings of eligible participation. A shared conversation is not a merged personal journal. |
| Factory Run / custody | Developmental obligation and verification when explicitly commissioned, not compulsory ancestry for conversation. |

Central owns source identity, file revisions, source Return, NOW/Day and temporal receiving. AIKit owns session/SessionSpace, preparation, contact/encounter orchestration and its existing durable request/response journals. Actuation owns actual agency, delegation, occupancy and authority. Workcell owns material support. O:I owns the Flow form/template and its receiving interfaces, scene/Expression presentation and SharedField projection/participation. QL supplies selected domain construction and Nara practice. No participant array or UI cache becomes a replacement identity, authority or messaging registry.

#### Local, cross-Workcell and cross-World

The same semantic operations must support:

1. One local world, including human-only writing and one human/multiple agents. No hosted database or public publication is required.
2. One world across several Workcells, using actual source/placement and gateway routes. Remote participation is distinct from relocating a running agent.
3. Independently grounded worlds with selected shared sources, membership, capabilities and contributions, using the existing SharedField/SpaceTimeDB adapter.

A common shared NOW can relate the participants' local child NOWs and SessionSpaces. Preserve their actual root/World/Workcell refs; do not pretend all processes inhabit the server's session or write its local source tree. A group can outlive a view, agent body, individual membership or personal Day. Closing one client detaches that client. Ending the common undertaking is a different operation with outstanding-work and retention readback.

#### Source, representation and transport

One exchange may have a document entry ref, communication/request ref, runtime act ref, and shared Contribution ref. Retain the explicit binding among them, each native owner and revision. A mirrored delivery is not another authorial act or independent corroboration. A source document and its live/frozen/replay presentations keep their own revision bases.

PF0 records which existing service provides each operation and which minimum extension is required. The required behaviours below are determined; exact new field spellings and public Action identifiers must follow the actual owner's schema/versioning law. This does not author a universal chat protocol, a new daemon, event database, Flow registry or CRDT subsystem.

### Evolve the complete Flow form

#### Participants and attribution

Add a stable document-local participant key independent of its initial/name. A portable or imported document can declare participants before native identities are resolved. Where the participant is natively bound, retain its owner-qualified human/Agent identity and the basis of that binding. Display name, initial and glyph remain editable presentation.

Each entry/contribution records its author key. For native agent output it also retains the producing Agency/AgentSession/generation and material attribution supplied by the actual runtime. New sessions for the same enduring agent do not alter earlier occurrence provenance. Where an act is explicitly on behalf of another participant, retain speaker and represented party separately with the actual authority basis.

Native entry operations validate the caller against the author binding. A user-editable JSON participant declaration, imported name or displayed initial is not authenticated authorship or authority to impersonate someone. Preserve declared, verified, inferred and unknown attribution honestly. Imported transcripts retain their source character.

A member joining late has a declared readable history horizon and participation revision. Join, leave, observer versus contributor status, response participation and actual body binding are distinct facts. Editing a name does not update old authors; losing a live body does not erase its entries.

#### Entries, addresses and threads

Retain complete rich entry content, notes, journal pages, packet items, media, native assets and unknown compatible metadata. Introduce the smallest backward-compatible representation for:

- one author and zero or more intended addressees;
- the shared reading/audience scope, distinct from addressees;
- response intent: contribution only, direct response requested or an admitted discussion/work act;
- response-to relations with exact document/entry identity and source revision; passage selectors also retain their revision and anchor state;
- a thread branch anchored to an actual contribution and later convergence references to several prior contributions;
- explicit correction/supersession and artifact/Expression/source relations;
- the originating native request and resulting contribution/act refs when an operation occurred.

These are entry/document relations, not a second thread store. A readable linear order is one presentation; causal and reply relations retain their meaning independently of arrival order. Remote sender time is not proof of global order. Preserve occurrence, receipt and commit order where actually observed. Concurrent sibling replies can both belong to the same earlier question.

A normal reply may have one parent; a synthesis can refer to several. Retain each reference rather than repeatedly copying its text. Prevent malformed relation cycles in the causal reply structure; other deliberate semantic links can have their declared shapes. A branch is conversational focus, not automatically a forked model transcript or a new Factory unit. A deliberately new agent-context fork uses its existing runtime operation and retains lineage.

Use exact native source/selectors, not fragile quotation matching alone. Where an external edit makes an anchor stale or ambiguous, preserve the old target and offer repair; never attach it silently to a similarly worded new paragraph.

#### Readership is not addressee selection

An addressed entry can be visible to the whole admitted group. A group contribution need not ask every agent to respond. A private aside uses an explicit narrower scope or separate linked thread/source, not hidden CSS in a shared portable document.

A raw HTML file containing private journal/notes cannot be shared merely because its rendered dialogue hides those collections. The initial implementation should prefer clearly scoped documents/threads; any selective outward projection filters bodies, embedded JSON, assets, links, participant metadata, derived context and counts through the existing disclosure owner. A filtered copy is a qualified projection with its own coverage and source basis, not a silently complete replica.

#### Compatibility and versioning

Opening an old document is read-only. Support the original F/H forms and current v0.3 participant form. On an explicit native upgrade/write, produce a deterministic identity-preserving migration with a retained original basis and idempotent receipt. Keep existing documentId, entry IDs, rich collections, presentation and source history. Ambiguous historical initials remain ambiguous; do not retroactively identify every H entry with the presently attached agent.

The template version is a document-format negotiation, not a new source identity. Agree the exact successor version during PF1, publish its validator and compatibility fixtures, and update the standalone template and app together. Older incapable writers must refuse or remain read-only instead of dropping new relations. Export/reimport, rename and supported relocation preserve document and participant identity independently of filename.

Provide pure validation/read/authoring operations at the existing document/form boundary that both native and UI consumers use. A malformed imported document remains inspectable as original material while invalid operations are refused precisely. Do not run arbitrary source HTML handlers as authority-bearing app operations.

### Native conversation operation and dependable return

#### The accepted act

Implement this through the existing owner operations and journals:

```text
compose entry with exact source basis and resolved author/targets
  → retain an idempotent operation/request identity and intended effect
  → commit the authorial entry through Central's native source mutation
  → reconcile/dispatch the correlated contact or request through AIKit
  → verify actual recipient instance and disclose its eligible context
  → perform the admitted runtime act
  → retain ordered partial/final output in its native journal
  → include the returned contribution in Flow through the native source path
  → project the same exchange to other eligible Surfaces/SharedField
```

This is coordinated completion, not an atomic transaction across products. Before dispatch, the existing native continuation owner must retain enough exact request/basis state to recover if the process dies after the document commit. Persist returned output before trying to incorporate it. Record each independently successful effect and reconcile the remaining step. Do not silently undo accepted source to make a later delivery failure look atomic.

UI closure removes an observer, not the accepted act. No durable waiting flag, seen-block heuristic or required response-appending callback lives only in React/localStorage. FlowSurface's current one-answer watcher is replaced by consumption of the native correlated state after the joined path proves equivalent useful behaviour.

#### Correlation and group delivery

Every accepted send binds its original document/entry/revision, author, target policy, requested action, source/context basis and native operation identity. Each selected recipient has its own resolved route, delivery/outcome and returned contribution. One recipient's failure neither drops successful siblings nor implies all have responded.

Resolve group/AgentSet recipients against an exact membership/roster revision at send time; record the expansion. A participant joining later receives allowed history, not a replay of all old invitations to act. Deliberate new delivery is a separately recorded act. Prevent one agent being scheduled twice merely because two handles resolve to it.

Use stable request/turn/output references from the runtime. If a provider cannot correlate simultaneous requests, serialize that provider session and preserve the mapping; concurrency across independent sessions remains available. An adapter cannot infer an answer from whichever assistant block is newest. Foreign participant contributions remain attributed input to the model, not that model's own previous assistant output or high-priority instructions.

A useful containing readback distinguishes source committed, request accepted, held/queued, delivered to a particular occurrence, turn started, partial output, final/cancelled/failed/unknown outcome, contribution included and projection observed. Preserve actual owner statuses instead of inventing a single success bit. Ack does not prove inference or comprehension. Ordinary reading/focus/refresh causes no model invocation.

#### Streaming, interruption and uncertain effects

Stream deltas update the same live contribution view, correlated to its request and producer. Do not append one durable conversational entry per token, or mark the first assistant fragment as a complete answer. Final output retains its full body or an exact paginated source/artifact route. Bounded view/context limits disclose continuation rather than truncate source.

On cancellation or provider loss, retain available partial output with its interrupted/unknown standing, plus any known tool effects. Keep raw tool/log detail in its native inspectable history; only actual admitted contributions become the shared conversation. A restart recovers the real runtime condition and does not claim resumed inference from a persisted active flag.

If a crash makes dispatch outcome uncertain, inspect the existing request/runtime journal and reconcile. Where the external protocol offers no idempotency/readback, expose the uncertainty and obtain an explicit retry decision; never promise exactly-once remote inference. Repeated native request IDs preserve at-most-once admitted effect where proven and cannot be reused with a different payload, target or source basis.

#### Concurrent source writes and corrections

Implement a native append operation over the ordinary file CAS, using the shared Flow validator/authoring contract and existing request/Return records. It rereads and verifies the current document and referenced entry, caller and policy before safely appending a distinct contribution. It preserves every unrelated entry and collection. Two independent replies can coexist after sequential owner commits.

A late answer to an earlier question retains that question's exact historical basis, even if the present question changed. It can be included as a historical reply with a visible basis difference. A proposed source mutation against an obsolete revision is different: it needs reconciliation rather than mechanical rebasing. A correction links to the reading/source it changes and preserves what previously occurred.

Whole-document human/external edits continue through existing CAS/history. An arbitrary external writer may produce conflict; the contract does not pretend advisory locks control every editor. Detect and preserve conflicts, new bytes, pending contributions and source exclusions. An already recorded identical contribution is recovered, not appended twice. Undo/retraction follows native source history, audience and current dependency rules rather than pretending delivered text was never seen.

#### Shared storage and origin ownership

The first delivery uses the existing source owner as the write authority for each Flow. Remote contributions reach it through the existing authorised native route; disconnected replicas keep pending submissions and their basis. The SharedField adapter records shared participation/Contribution state, not a competing writable canonical document.

A hosted, independently authored shared Flow can have its own declared source owner/location and revision rule. Each participant's personal Day relates to it rather than owning a synchronized editable copy. Deliberate relocation/rebinding follows the existing migration law. True offline multi-writer merging is not promised by CAS; keep offline drafts and reconcile on reconnect. A future stronger owner merge capability can fit the same contract when independently proven.

### Participation

#### Identity and material routing

Preserve current agent-profile addressability: an unembodied agent is a real address with a declared hold/start option, not a nonexistent recipient. A Position remains useful for responsibility, occupancy and succession. Exact generation and optional required-Workcell constraints remain exact. A reply to an exact occurrence never follows a same-named successor silently.

Joining a Flow/NOW binds an actual participant, eligible readable history, intended role, response arrangement and current session/material locus where present. Joining need not start a model. Starting or waking a body is an explicit effect admitted by the selected arrangement and current authority. A narrow invitation does not expose the person's whole Central world.

For local multi-session composition reuse SessionSpace membership/leases. Across owners, relate the actual SessionSpaces instead of allocating a fake master AgentSession. Leave/detach, end participation, interrupt a turn, stop a process, retire an occurrence and close the undertaking are separate operations. Revalidate authority/history scope at delivery and before effects; queued requests cannot rely on a departed participant's old grants. Superseded leases cannot mutate a replacement session.

#### Response arrangements

Supply three practical arrangements through existing Methods/AgentSets, encounter and Routine/dispatch machinery rather than a parallel group scheduler:

- **Addressed:** explicitly requested recipients receive one admitted act; other eligible participants can read without waking. This is the ordinary default.
- **Facilitated:** a selected participant composes the inquiry and delegates bounded contributions, then returns a useful joined result.
- **Bounded team exchange:** an explicitly selected group can respond to relevant contributions within its defined purpose, participant set, turn/time/tool budget and stop/wait conditions.

The UI makes the chosen arrangement and any invocation effect visible. A direct human send can request inference without a second redundant confirmation. A standing authorised arrangement can wake an idle eligible agent through the real dispatcher; a queue waiting forever for another human prompt is not autonomous response. A busy session obeys the provider's actual queue/interrupt semantics. Never inject messages into another running act without the supported boundary.

Carry causal request/origin and reply-budget state across local, connector and remote faces. Suppress self echoes, duplicate re-delivery and automatic reply cycles. A copied or relayed reply cannot reset the budget. Missing facts, reached budgets, human requests and resolved questions give explicit waiting/completed outcomes. Stop further unsent work when the undertaking is cancelled and retain already-real effects.

#### One conversation through different faces

Native Flow/desktop, structured-agent operations, supported terminal controls, gateway contact and selected external connector conversations operate the same request/contribution relationships. Retain platform/native sender, conversation and message IDs as provenance, not as O:I participant identity. A2A remains external interoperability through the existing gateway work; it is not required for native intra-World conversation.

This tranche proves the core local/cross-World path and preserves existing connector-group semantics and exact routing. Use one configured external connector as a cross-face acceptance specimen when available, with its actual per-sender admission and received message. All remaining connector and A2A coverage stays with #154's existing matrix; internal group support does not claim those platforms are all finished.

#### Flow and Expression presentation

Preserve keyboard use, drafts, narrow layouts, readable rich media, source/selection, accessible labels and reduced-motion equivalents. A Flow can open a constellation/activity Expression over the same subjects and contributions; selection can return to the exact passage/participant. Live appearance follows actual producer state. Frozen/replay versions retain their captured basis and never reissue tool or model effects.

The standalone document remains readable with complete local material and safe fallbacks offline. Native actions require the actual attached host bridge and current authority; opening exported HTML is not permission to contact agents or run tools. Sharing preserves meaningful authored form as well as data.

#### Day, Nara and historical intake

Each person keeps their own civil Day and private reflections. Shared Flow participation can enter their Day by an eligible source/ref relation; FieldDay is the common temporal reading, not a replacement personal calendar. Occurrence, receipt and review time remain distinct across timezones and offline periods. Rolling a Day never resets shared discussion, pending answers or a Nara oracle journey.

Nara and Central #242's importer must receive author/addressee/occurrence/reply/interpretation distinctions. A statement said to the person is not their belief; an agent answer is not their autobiography. Archive migration preserves historical attribution, incomplete identity and correction. New participant-aware source should improve context and Wiki construction through AIKit #388 and QL-MEF #258, without rebuilding those programmes.
