# Plural Flow: one conversation across people, agents and worlds

**Commission:** [O:I #558](https://github.com/EpiLogos/O-I/issues/558), 29 September 2026.  
**Execution:** [Plural Flow Wayfinder](../../.wayfinder/maps/plural-flow-now.md).  
**Containing work:** #65 C0–C5, #220 native integration, #154 communication and #375 experience; the existing SharedField and personal-document work.  
**Standing:** owner-commissioned development specification. The purpose and requested extension come from the owner's current discussion; the operational decisions below are this implementation plan, not a report that the installed system already performs them. Publication does not claim runtime or human acceptance.

## 0. Purpose, encounter and current ground

Plural participation is fundamental. A person writing with Nara, two agents discussing a source, a team developing an Expression and several people bringing their agents into a shared undertaking use the same conversational relations. SharedField extends scope, reach and shared participation; local plural work remains useful with no hosted SharedField service.

**Flow holds the developing conversation and its material. NOW holds the undertaking in which it matters. SessionSpace brings actual runtime sessions and Surfaces into relation. Day places the encounter within each person's continuing life.** These meanings are complementary, not aliases.

The desired ordinary act is to bring someone into a continuing Flow, address a contribution, follow a side inquiry, receive useful independent work, examine its sources and return to the same conversation later. A contribution may be writing, a source passage, a note, media, a constellation, an Expression or an artifact. The person's existing writing retains its full shape and usefulness outside the live app.

### 0.1 Source and implementation basis

Read [Founding Positions](../positions/FOUNDING-POSITIONS.md), [the temporal field](WORKCELL-NOW-TEMPORAL-FIELD.md), [SharedField desktop](SHARED-FIELD-DESKTOP.md), [document operations](DOCUMENT-OPERATIONS.md), and the actual incoming source cut. Relevant current implementations inspected for this specification are:

- `desktop/cradle/src/flow/instance.ts`: the v0.3 document already has declared person/agent participants, entries, reply anchors, journal, notes, packet and media. Entry authors and participant matching still use initials; an optional participant ref names an answering session.
- `desktop/cradle/src/flow/FlowSurface.tsx`: one answering session is bound in UI state; writing lands before send, and a watcher chooses a newer assistant block to append. This is the existing one-to-one path to extend, not a multi-party correlation guarantee.
- `desktop/cradle/src/flow/FlowEntryBody.tsx`: rich passive reading and same-document reply/anchor display already exist.
- AIKit `crates/aikit-core/src/session_space.rs`: multiple AgentSessions can belong to a SessionSpace, with individual leases, bodies, Surfaces and connection observations. Shared membership need not be reinvented.
- AIKit `docs/encounter-runtime.md`: native resident sessions retain transcript/composer and process-bound activity independently of UI clients. Preserve its explicit uncertainty and native-restart semantics.
- AIKit `docs/GATEWAY-CONTACT-AND-DAY.md`: durable contact, exact generation/Workcell routes, turn-boundary delivery and existing owner journals. `docs/GATEWAY-BOT-TO-BOT.md` supplies the newer agency-identity addressability clarification and one-system/four-faces relation. Its later identity rule takes precedence over older Position-only examples: a registered agent is addressable without a current Position or embodiment.
- Central `docs/CLI-REFERENCE.md`: the old `projectcentral.flow.*` Actions and separate Flow registry were retired in #177. Current Flow documents are ordinary sources using ordinary file CAS/history. AIKit's older `FLOW.md` remains useful design genealogy but does not revive that retired implementation.

These observations are source facts at inspection, not installed results. PF0 reconciles subsequent source and active work, preserving completed implementation. Current identity, numerical and Nara work continue at their owners.

### 0.2 First complete encounter

A human opens an actual source-backed Flow and brings in two distinct agents. One investigates an argument; the other tests an example. Their concurrent contributions answer the same question without becoming one undifferentiated assistant. A side inquiry develops; a later contribution relates both answers. The human changes a material assumption while an answer is in flight, closes the view, then returns to all contributions with their actual bases. The undertaking continues through a fresh body and a Day boundary, with an actual saved Expression and useful retained understanding.

Run that encounter locally first, then across Mac/Omarchy, then between independently authorised human worlds. Controlled accounts can prove multi-user protocol boundaries; two actual humans supply the separate human encounter evidence.

## 1. One native relation, several participating owners

### 1.1 The objects and their jobs

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

### 1.2 Local, cross-Workcell and cross-World

The same semantic operations must support:

1. One local world, including human-only writing and one human/multiple agents. No hosted database or public publication is required.
2. One world across several Workcells, using actual source/placement and gateway routes. Remote participation is distinct from relocating a running agent.
3. Independently grounded worlds with selected shared sources, membership, capabilities and contributions, using the existing SharedField/SpaceTimeDB adapter.

A common shared NOW can relate the participants' local child NOWs and SessionSpaces. Preserve their actual root/World/Workcell refs; do not pretend all processes inhabit the server's session or write its local source tree. A group can outlive a view, agent body, individual membership or personal Day. Closing one client detaches that client. Ending the common undertaking is a different operation with outstanding-work and retention readback.

### 1.3 Source, representation and transport

One exchange may have a document entry ref, communication/request ref, runtime act ref, and shared Contribution ref. Retain the explicit binding among them, each native owner and revision. A mirrored delivery is not another authorial act or independent corroboration. A source document and its live/frozen/replay presentations keep their own revision bases.

PF0 records which existing service provides each operation and which minimum extension is required. The required behaviours below are determined; exact new field spellings and public Action identifiers must follow the actual owner's schema/versioning law. This does not author a universal chat protocol, a new daemon, event database, Flow registry or CRDT subsystem.

## 2. Evolve the complete Flow form

### 2.1 Participants and attribution

Add a stable document-local participant key independent of its initial/name. A portable or imported document can declare participants before native identities are resolved. Where the participant is natively bound, retain its owner-qualified human/Agent identity and the basis of that binding. Display name, initial and glyph remain editable presentation.

Each entry/contribution records its author key. For native agent output it also retains the producing Agency/AgentSession/generation and material attribution supplied by the actual runtime. New sessions for the same enduring agent do not alter earlier occurrence provenance. Where an act is explicitly on behalf of another participant, retain speaker and represented party separately with the actual authority basis.

Native entry operations validate the caller against the author binding. A user-editable JSON participant declaration, imported name or displayed initial is not authenticated authorship or authority to impersonate someone. Preserve declared, verified, inferred and unknown attribution honestly. Imported transcripts retain their source character.

A member joining late has a declared readable history horizon and participation revision. Join, leave, observer versus contributor status, response participation and actual body binding are distinct facts. Editing a name does not update old authors; losing a live body does not erase its entries.

### 2.2 Entries, addresses and threads

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

### 2.3 Readership is not addressee selection

An addressed entry can be visible to the whole admitted group. A group contribution need not ask every agent to respond. A private aside uses an explicit narrower scope or separate linked thread/source, not hidden CSS in a shared portable document.

A raw HTML file containing private journal/notes cannot be shared merely because its rendered dialogue hides those collections. The initial implementation should prefer clearly scoped documents/threads; any selective outward projection filters bodies, embedded JSON, assets, links, participant metadata, derived context and counts through the existing disclosure owner. A filtered copy is a qualified projection with its own coverage and source basis, not a silently complete replica.

### 2.4 Compatibility and versioning

Opening an old document is read-only. Support the original F/H forms and current v0.3 participant form. On an explicit native upgrade/write, produce a deterministic identity-preserving migration with a retained original basis and idempotent receipt. Keep existing documentId, entry IDs, rich collections, presentation and source history. Ambiguous historical initials remain ambiguous; do not retroactively identify every H entry with the presently attached agent.

The template version is a document-format negotiation, not a new source identity. Agree the exact successor version during PF1, publish its validator and compatibility fixtures, and update the standalone template and app together. Older incapable writers must refuse or remain read-only instead of dropping new relations. Export/reimport, rename and supported relocation preserve document and participant identity independently of filename.

Provide pure validation/read/authoring operations at the existing document/form boundary that both native and UI consumers use. A malformed imported document remains inspectable as original material while invalid operations are refused precisely. Do not run arbitrary source HTML handlers as authority-bearing app operations.

## 3. Native conversation operation and dependable return

### 3.1 The accepted act

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

### 3.2 Correlation and group delivery

Every accepted send binds its original document/entry/revision, author, target policy, requested action, source/context basis and native operation identity. Each selected recipient has its own resolved route, delivery/outcome and returned contribution. One recipient's failure neither drops successful siblings nor implies all have responded.

Resolve group/AgentSet recipients against an exact membership/roster revision at send time; record the expansion. A participant joining later receives allowed history, not a replay of all old invitations to act. Deliberate new delivery is a separately recorded act. Prevent one agent being scheduled twice merely because two handles resolve to it.

Use stable request/turn/output references from the runtime. If a provider cannot correlate simultaneous requests, serialize that provider session and preserve the mapping; concurrency across independent sessions remains available. An adapter cannot infer an answer from whichever assistant block is newest. Foreign participant contributions remain attributed input to the model, not that model's own previous assistant output or high-priority instructions.

A useful containing readback distinguishes source committed, request accepted, held/queued, delivered to a particular occurrence, turn started, partial output, final/cancelled/failed/unknown outcome, contribution included and projection observed. Preserve actual owner statuses instead of inventing a single success bit. Ack does not prove inference or comprehension. Ordinary reading/focus/refresh causes no model invocation.

### 3.3 Streaming, interruption and uncertain effects

Stream deltas update the same live contribution view, correlated to its request and producer. Do not append one durable conversational entry per token, or mark the first assistant fragment as a complete answer. Final output retains its full body or an exact paginated source/artifact route. Bounded view/context limits disclose continuation rather than truncate source.

On cancellation or provider loss, retain available partial output with its interrupted/unknown standing, plus any known tool effects. Keep raw tool/log detail in its native inspectable history; only actual admitted contributions become the shared conversation. A restart recovers the real runtime condition and does not claim resumed inference from a persisted active flag.

If a crash makes dispatch outcome uncertain, inspect the existing request/runtime journal and reconcile. Where the external protocol offers no idempotency/readback, expose the uncertainty and obtain an explicit retry decision; never promise exactly-once remote inference. Repeated native request IDs preserve at-most-once admitted effect where proven and cannot be reused with a different payload, target or source basis.

### 3.4 Concurrent source writes and corrections

Implement a native append operation over the ordinary file CAS, using the shared Flow validator/authoring contract and existing request/Return records. It rereads and verifies the current document and referenced entry, caller and policy before safely appending a distinct contribution. It preserves every unrelated entry and collection. Two independent replies can coexist after sequential owner commits.

A late answer to an earlier question retains that question's exact historical basis, even if the present question changed. It can be included as a historical reply with a visible basis difference. A proposed source mutation against an obsolete revision is different: it needs reconciliation rather than mechanical rebasing. A correction links to the reading/source it changes and preserves what previously occurred.

Whole-document human/external edits continue through existing CAS/history. An arbitrary external writer may produce conflict; the contract does not pretend advisory locks control every editor. Detect and preserve conflicts, new bytes, pending contributions and source exclusions. An already recorded identical contribution is recovered, not appended twice. Undo/retraction follows native source history, audience and current dependency rules rather than pretending delivered text was never seen.

### 3.5 Shared storage and origin ownership

The first delivery uses the existing source owner as the write authority for each Flow. Remote contributions reach it through the existing authorised native route; disconnected replicas keep pending submissions and their basis. The SharedField adapter records shared participation/Contribution state, not a competing writable canonical document.

A hosted, independently authored shared Flow can have its own declared source owner/location and revision rule. Each participant's personal Day relates to it rather than owning a synchronized editable copy. Deliberate relocation/rebinding follows the existing migration law. True offline multi-writer merging is not promised by CAS; keep offline drafts and reconcile on reconnect. A future stronger owner merge capability can fit the same contract when independently proven.

## 4. Participation, response practice and human experience

### 4.1 Identity and material routing

Preserve current agent-profile addressability: an unembodied agent is a real address with a declared hold/start option, not a nonexistent recipient. A Position remains useful for responsibility, occupancy and succession. Exact generation and optional required-Workcell constraints remain exact. A reply to an exact occurrence never follows a same-named successor silently.

Joining a Flow/NOW binds an actual participant, eligible readable history, intended role, response arrangement and current session/material locus where present. Joining need not start a model. Starting or waking a body is an explicit effect admitted by the selected arrangement and current authority. A narrow invitation does not expose the person's whole Central world.

For local multi-session composition reuse SessionSpace membership/leases. Across owners, relate the actual SessionSpaces instead of allocating a fake master AgentSession. Leave/detach, end participation, interrupt a turn, stop a process, retire an occurrence and close the undertaking are separate operations. Revalidate authority/history scope at delivery and before effects; queued requests cannot rely on a departed participant's old grants. Superseded leases cannot mutate a replacement session.

### 4.2 Useful autonomous response

Supply three practical arrangements through existing Methods/AgentSets, encounter and Routine/dispatch machinery rather than a parallel group scheduler:

- **Addressed:** explicitly requested recipients receive one admitted act; other eligible participants can read without waking. This is the ordinary default.
- **Facilitated:** a selected participant composes the inquiry and delegates bounded contributions, then returns a useful joined result.
- **Bounded team exchange:** an explicitly selected group can respond to relevant contributions within its defined purpose, participant set, turn/time/tool budget and stop/wait conditions.

The UI makes the chosen arrangement and any invocation effect visible. A direct human send can request inference without a second redundant confirmation. A standing authorised arrangement can wake an idle eligible agent through the real dispatcher; a queue waiting forever for another human prompt is not autonomous response. A busy session obeys the provider's actual queue/interrupt semantics. Never inject messages into another running act without the supported boundary.

Carry causal request/origin and reply-budget state across local, connector and remote faces. Suppress self echoes, duplicate re-delivery and automatic reply cycles. A copied or relayed reply cannot reset the budget. Missing facts, reached budgets, human requests and resolved questions give explicit waiting/completed outcomes. Stop further unsent work when the undertaking is cancelled and retain already-real effects.

### 4.3 One conversation through different faces

Native Flow/desktop, structured-agent operations, supported terminal controls, gateway contact and selected external connector conversations operate the same request/contribution relationships. Retain platform/native sender, conversation and message IDs as provenance, not as O:I participant identity. A2A remains external interoperability through the existing gateway work; it is not required for native intra-World conversation.

This tranche proves the core local/cross-World path and preserves existing connector-group semantics and exact routing. Use one configured external connector as a cross-face acceptance specimen when available, with its actual per-sender admission and received message. All remaining connector and A2A coverage stays with #154's existing matrix; internal group support does not claim those platforms are all finished.

### 4.4 Flow and Expression UI

Extend the present Flow surface and template rather than launch a new messenger. Keep writing primary. Add a compact participants/response control and contextual **Bring someone in**, **Reply to**, **Address**, **Follow thread**, **Open source**, **Open Expression** and pending/recovery actions, using actual operation descriptions.

The composer distinguishes adding writing from asking someone to respond. It shows the intended recipient(s) and audience in ordinary terms. Choosing a participant or inspecting a Being does not replace the user's private companion session. A new participant can receive a reviewed current-thread slice or selected history; the result shows what actually reached its body.

Chronological reading stays available. Thread focus shows the initiating contribution, replies and convergence without hiding that other branches exist. Multi-target replies have one authored identity, not duplicate entries for each view. Distinguish human, agent and unknown/imported authors without turning every message into a telemetry panel. Current speaker, progress, addressed recipient, changed basis and recoverable failures are visible; raw provenance remains one depth away.

Preserve keyboard use, drafts, narrow layouts, readable rich media, source/selection, accessible labels and reduced-motion equivalents. A Flow can open a constellation/activity Expression over the same subjects and contributions; selection can return to the exact passage/participant. Live appearance follows actual producer state. Frozen/replay versions retain their captured basis and never reissue tool or model effects.

The standalone document remains readable with complete local material and safe fallbacks offline. Native actions require the actual attached host bridge and current authority; opening exported HTML is not permission to contact agents or run tools. Sharing preserves meaningful authored form as well as data.

### 4.5 Day, Nara and historical intake

Each person keeps their own civil Day and private reflections. Shared Flow participation can enter their Day by an eligible source/ref relation; FieldDay is the common temporal reading, not a replacement personal calendar. Occurrence, receipt and review time remain distinct across timezones and offline periods. Rolling a Day never resets shared discussion, pending answers or a Nara oracle journey.

Nara and Central #242's importer must receive author/addressee/occurrence/reply/interpretation distinctions. A statement said to the person is not their belief; an agent answer is not their autobiography. Archive migration preserves historical attribution, incomplete identity and correction. New participant-aware source should improve context and Wiki construction through AIKit #388 and QL-MEF #258, without rebuilding those programmes.

## 5. Development contract and completion

The [Wayfinder](../../.wayfinder/maps/plural-flow-now.md) defines PF0–PF5, exact first delivery and MP01–MP18 proof cases. The [source module](plural-flow.json) binds the full specification and Wayfinder into the existing #65 story/obligation compiler. Existing `web65:*`, CAW, gateway and QL evidence retain their own coverage.

For each required branch, bind the actual repository-qualified capability ID, current matrix digest/account, source meaning, public operation/schema, selected Skill/Method/Methodology, material/provider/authority conditions and independent test. Follow [TOOLS.md](TOOLS.md). Required missing capabilities become implementation obligations at their native owner; neither a rendered participant list nor a populated matrix proves behaviour.

Develop a reusable Method for participating in a shared Flow and Methods for addressed/facilitated exchange, correction, and return/continuation, through the current practice lifecycle. Keep deterministic mechanics in native operations. Ordinary actors receive their bounded meaningful task and discoverable powers; the verifier holds expectations and withheld cases. Record actual loaded practice/context and observed use separately. A positive alternative way of completing useful work can still leave the specific architecture-under-test unproved.

Complete source/form migration, native correlation and recovery, participant-specific context, supported autonomous response, real local/shared interaction and installed fresh-body continuation. Preserve failed episodes, repair their responsible owner and immediately repeat the affected activity. Runtime defects inside the commissioned owners are work to complete, not a reason to finish with another audit.

### Source trail

- [Founding positions](../positions/FOUNDING-POSITIONS.md); [#65 experience entry](README.md); [document operations](DOCUMENT-OPERATIONS.md); [temporal law](WORKCELL-NOW-TEMPORAL-FIELD.md); [SharedField desktop](SHARED-FIELD-DESKTOP.md); [source/obligation tooling](TOOLS.md).
- Current [Flow form](../../desktop/cradle/src/flow/instance.ts), [Flow surface](../../desktop/cradle/src/flow/FlowSurface.tsx) and [entry reader](../../desktop/cradle/src/flow/FlowEntryBody.tsx). These paths are implementation starting points, not declarations that their current one-to-one assumptions govern the new feature.
- [AIKit contact/Day](https://github.com/EpiLogos/ai-kit/blob/main/docs/GATEWAY-CONTACT-AND-DAY.md), [one-system communication and identity correction](https://github.com/EpiLogos/ai-kit/blob/main/docs/GATEWAY-BOT-TO-BOT.md), [resident encounter](https://github.com/EpiLogos/ai-kit/blob/main/docs/encounter-runtime.md), [SessionSpace](https://github.com/EpiLogos/ai-kit/blob/main/crates/aikit-core/src/session_space.rs), [older Flow contract](https://github.com/EpiLogos/ai-kit/blob/main/docs/FLOW.md), [#388](https://github.com/EpiLogos/ai-kit/issues/388).
- [Central current CLI](https://github.com/EpiLogos/Central/blob/main/docs/CLI-REFERENCE.md), [source Return](https://github.com/EpiLogos/Central/blob/main/docs/SOURCE-RETURN.md), [#150](https://github.com/EpiLogos/Central/issues/150), [#151](https://github.com/EpiLogos/Central/issues/151), [#152](https://github.com/EpiLogos/Central/issues/152), [personal-history #242](https://github.com/EpiLogos/Central/issues/242).
- [QL Nara programme #258](https://github.com/EpiLogos/QL-MEF/issues/258), [Workcell #72](https://github.com/EpiLogos/Workcell/issues/72), [O:I #154](https://github.com/EpiLogos/O-I/issues/154), [#220](https://github.com/EpiLogos/O-I/issues/220), [#375](https://github.com/EpiLogos/O-I/issues/375).

At implementation record exact incoming revisions, active claims and remaining source mismatches. This specification determines the joined feature; native owners determine faithful schema/operation realization, and returned evidence determines what actually works.
