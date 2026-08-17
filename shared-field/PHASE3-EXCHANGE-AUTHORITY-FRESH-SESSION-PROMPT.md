# PHASE 3 — FRESH SESSION PROMPT

Work directly in GitHub on:

https://github.com/EpiLogos/O-I

CONTINUE THE ENCOUNTER-SECURITY CONVERGENCE PROGRAMME FROM THE ACTUAL CURRENT LIVE STATE.

PRIMARY TICKETS

- #31 — `[OI-017] Research and implement encounter security for shared and composable O:I spaces`
- #43 — `[OI-017-C] Encounter-security convergence: private content → admission → exchange authority → containment`

THIS SESSION IS PHASE 3 OF #43 ONLY:

**EXPLICIT EXCHANGE AUTHORITY**

This is an IMPLEMENTATION / PROVIDER-CONFORMANCE / ADVERSARIAL-SECURITY session.

IMPORTANT: DO NOT TRY TO FINISH #43 OR CLOSE #31 IN THIS SESSION.

#43 constitutionally requires each phase to run in a fresh implementation session.

Therefore:

```text
Phase 1 private hosted content
        ↓
Phase 2 generic Contribution ingress / quarantine / Admission / index eligibility
        ↓
exact Phase-2 receipt
        ↓
THIS SESSION: Phase 3 only
        ↓
explicit exchange authority
        ↓
exact Phase-3 receipt
        ↓
fresh Phase-4 prompt
        ↓
STOP
```

Do not roll into Phase 4 even if context/time remains.

Phase 4 is the later containment phase for rich content / packages / tools / execution resources.

Only after Phase 4 should a separate fresh #31 closure-verification session be considered.

---

## START FROM LIVE STATE

Do not trust any SHA, PR state, branch state, CI result, provider version, issue comment, implementation claim or handoff detail in this prompt without verifying GitHub and current primary sources.

Re-read before changing authority semantics:

- `shared-field/PHASE1-PRIVATE-CONTENT-SECURITY-RECEIPT.md`
- `shared-field/PHASE2-CONTRIBUTION-ADMISSION-SECURITY-RECEIPT.md`

Expected Phase-2 canonical line at handoff — **verify it**:

- PR #47 — `[OI-017-C/P2] Quarantine and admit inbound Contributions`
- branch `agent/oi-017-contribution-admission`
- Phase-1 base `58e40b65e4e33bbca16f6321f3d7d871498291cc`
- last Phase-2 implementation-code head before receipt: `42cfd326eef42f4578705a422458a21b0b7d9ee0`
- canonical provider run #127 / Actions id `32015781710` — expected `test` SUCCESS and `spacetimedb-live` SUCCESS
- SpaceTimeDB expected `2.8.1`; CLI commit observed in Phase 2: `4d9aa49594d59bf09f949b83c30413e43bf0805a`

Expected #37 A2A Phase-2 adaptation line — **verify it**:

- PR #51 — `[OI-017-C/P2 A2A] Route returned differences to generic Contribution ingress`
- branch `agent/oi-017-p2-a2a-ingress-adapter`
- base exact #37 head `f1b2075618696fdaeba4da6111904205f295af76`
- expected adaptation head `6d15d3914fc52e2c26c892daea1e7c1c346ef30a`
- run #129 / Actions id `32016793372` — expected `test` SUCCESS and `spacetimedb-live` SUCCESS

Expected full downstream Phase-2 conformance evidence — **verify it, do not merge it as an implementation shortcut**:

- temporary conformance PR #50
- evidence head `69d3d8715730c051165da400f3ce678925743f0b`
- run #128 / Actions id `32016545227` — expected `test` SUCCESS and `spacetimedb-live` SUCCESS
- this evidence branch was cut fresh from exact #42 head `7d7f1362ee92cd1aa6073cfc39d218311e144a01`

Also reverify current heads/state of:

- PR #32 — SharedField authority / privacy / Watch / Contact security floor;
- PR #44 — Phase-1 hosted-content privacy;
- PR #37 — A2A SharedField integration;
- PR #42 — Watch → availability → Encounter → Central notification;
- PR #47 — Phase-2 generic Contribution ingress / Admission;
- PR #51 — #37 adaptation to generic Contribution ingress;
- any newer exchange, Contact, authority, MCP, A2A, package, Action, capability or containment branches/PRs.

Other agents may be active. If another agent has already begun Phase 3, consume/converge that work rather than creating a duplicate authority implementation.

Re-check the current SpaceTimeDB release and official documentation relevant to reducers, caller identity, private backing state, caller Views, subscriptions, transactions, server time and any provider feature you intend to rely upon.

---

## CONSTITUTIONAL SECURITY LAW

Preserve absolutely:

> **Composition transfers reference and possibility, not ambient trust or authority.**

And:

```text
visible != contactable
contactable != contacted
accepted Contact != exchange
exchange authority != trust
```

Phase 2 additionally fixed:

```text
received != admitted
admitted != canonical
admitted != executable
admitted != trusted
admitted != Projection
admitted != Explore automatically
admitted != exchange authority
```

And preserve the authority ladder:

```text
runtime Identity != Participant
Participant != field membership
field membership != private audience
read audience != mutation authority
read authority != admission authority
admission authority != exchange authority
exchange authority != execution authority
```

Do not add:

- global trust scores;
- a second authority ontology;
- hidden Root/Central privilege;
- transport identity masquerading as Participant identity;
- exchange permission inferred from Contact acceptance;
- exchange permission inferred from Admission;
- exchange permission inferred from A2A endpoint discovery;
- exchange permission inferred from Agent Card skills/capabilities;
- exchange permission inferred from MCP tool discovery;
- automatic Action/tool execution because a caller can exchange messages;
- ambient bilateral authority because one side has unilateral field authority;
- client-only exchange enforcement.

---

## PHASE-1 AND PHASE-2 FLOOR — MUST NOT REGRESS

Phase 1 established server-enforced private content:

```text
PRIVATE canonical backing state
        ↓
server-side audience resolver
        ↓
caller-filtered public Views
```

Keep SharedField/Projection/Explore audience intersection semantics intact.

Phase 2 established generic untrusted material handling:

```text
external / remote / local material
        ↓
server RECEIVE
        ↓
PRIVATE quarantine
        ↓
schema / bounds / provenance / replay checks
        ↓
explicit receiving-side Admission
        ↓
admitted Contribution
        ↓
separate index-eligibility decision
        ↓
caller-filtered representation
```

Keep these invariants intact:

- raw quarantine/admission/index backing state stays private;
- sender cannot self-admit or choose visibility/index eligibility;
- exact retry is idempotent;
- claimed semantic ref cannot overwrite server identity;
- Admission is receiver-side and does not imply canonicality/trust/execution/Projection/indexing;
- admitted + index-eligible still intersects Phase-1 caller visibility;
- A2A returned Task/Message/Artifact material enters through generic Contribution ingress rather than an A2A-specific Admission ontology;
- the legacy `admitA2aDifference()` semantic shortcut remains fail-closed unless removed entirely with clean migration evidence.

Phase 3 must add exchange authority **after** these boundaries, not tunnel around them.

---

## PHASE-3 DESTINATION

Build the generic server-enforced authority boundary for an actual bounded exchange between attributable Participants/actors.

The target conceptual lifecycle is:

```text
discoverable / Contact relation / admitted material
        ≠ exchange authority

explicit exchange request / proposed scope
        ↓
receiving / relevant authority decision
        ↓
exchange grant
        ↓
bounded authorised exchange instance / channel / session
        ↓
messages / tasks / tool-neutral data transfer within that grant
        ↓
expiry / completion / revocation / exhaustion
```

The Exchange authority primitive should answer:

> **May this attributable actor communicate across this particular boundary, with this counterparty, for this purpose/scope, through these protocol capabilities, for this bounded duration/extent?**

It must not answer:

> Is the counterparty trusted? Is their content true? May their content execute? May they invoke arbitrary Actions/tools? May they access all private field state?

Those remain separate questions.

Prefer extending the existing O:I authority/Contact/A2A primitives where they already express the right conceptual seam. Do not create a competing global exchange ontology merely because this prompt uses the word Exchange.

---

## EXCHANGE AUTHORITY LAW

Exchange authority must be explicit, server enforced, scoped and attributable.

At minimum distinguish:

```text
Contact relation
        != exchange grant

exchange grant
        != one exchange instance

exchange instance
        != every future exchange

A2A binding / endpoint
        != permission to use it

MCP server/tool discovery
        != permission to invoke it

message-send authority
        != Action/tool execution authority

exchange participant
        != transport connection identity
```

An exchange grant must be bound to enough of the following to prevent ambient authority:

- SharedField / boundary;
- initiating Participant / runtime actor binding;
- counterparty Participant / attributable endpoint relation;
- purpose or scope;
- protocol/provider family where materially relevant;
- allowed exchange mode(s);
- finite duration and/or usage cardinality where appropriate;
- authority issuer/decision provenance;
- revocation state;
- server-observed creation/use/expiry state.

Do not turn this into a universal capability policy system. Use the existing Authority/Boundary grammar and add only what Exchange requires.

---

## CONTACT CONVERGENCE LAW

Existing Contact means a bounded request to become contactable/contacted under the current Contact semantics.

Preserve:

```text
Contact accepted
    != Exchange automatically
```

If an accepted Contact is allowed to become one of the predicates for requesting Exchange, make that explicit.

A Contact response must not silently mint broad exchange authority unless the canonical contract is deliberately extended so that the human/receiving actor is visibly deciding **both** Contact and a separately represented Exchange grant in the same authorised transaction.

Even then, preserve separate evidence/schema fields for the two determinations.

Blocked/muted/revoked Contact policy should prevent or terminate exchange where the current architecture says the same boundary governs both, but do not invent hidden coupling without tests and explicit contract law.

---

## A2A CONVERGENCE LAW

Keep #37 source-faithful:

```text
Agent Card / endpoint != Agent
endpoint != Participant
A2A Task != Factory Run
A2A Message != Contribution automatically
A2A Artifact != Projection automatically
transport result != admitted semantic object
```

Phase 2 added:

```text
A2A returned difference
        ↓
generic Contribution ingress
        ↓
quarantine
        ↓
explicit Admission
```

Phase 3 should add the authority that governs whether an actual outbound/inbound A2A exchange may occur at all.

Conceptually:

```text
published A2A binding + live availability
        = reachable possibility

reachable possibility
+ explicit bounded Exchange authority
        = permitted A2A exchange
```

Do not make endpoint publication itself an exchange grant.

Do not treat an Agent Card's advertised skills/capabilities as O:I authority.

Preserve auth credentials as transport/runtime material rather than semantic Participant identity or durable public contract content.

If an A2A exchange returns material, it must still re-enter through Phase-2 generic Contribution quarantine regardless of the fact that the exchange itself was authorised.

Authorised transport does **not** imply admitted semantic content.

---

## MCP / TOOL-NEUTRAL CONVERGENCE

Where MCP or another protocol is present, distinguish:

```text
server discovered
    != trusted

tool/resource advertised
    != authorised for this caller

exchange/message capability
    != tool invocation authority

tool invocation authority
    != arbitrary execution authority
```

Phase 3 should define enough generic Exchange authority that A2A/MCP/HTTP-like transports can participate without each inventing its own ambient trust model.

Do **not** implement full tool/package containment in this phase. That is Phase 4.

If a protocol intrinsically couples message exchange and tool invocation, fail closed or split the semantic authority at the O:I boundary rather than inheriting the provider's broad authority by default.

---

## SCOPE / CARDINALITY / EXPIRY LAW

Exchange grants should be finite wherever practical.

Support and test the relevant bounded forms such as:

- one-shot exchange;
- N-message / N-task allowance;
- time-bounded grant using reducer server time;
- purpose/scope-limited grant;
- explicit completion;
- explicit revocation.

A consumed/expired/revoked grant must not remain usable merely because a connection/session is already open.

Do not rely on client clocks for authority expiry.

If provider subscription/session semantics make immediate revocation of a live transport connection impossible at this layer, record the exact transport/provider/Workcell enforcement boundary and make new semantic operations fail closed.

---

## REPLAY / CONFUSED-DEPUTY LAW

Exchange is an adversarial authority boundary.

Prove at minimum that:

- a sender cannot replay an old grant identifier after expiry/revocation;
- a grant for Participant A cannot be presented by Participant B;
- a grant for counterparty X cannot be redirected to Y;
- a grant for field F cannot be used across field G;
- a grant for one protocol/endpoint lineage cannot silently migrate to another if that would widen authority;
- transport retries do not multiply exchange authority or usage counters incorrectly;
- duplicate message/task ids are handled idempotently or rejected according to provider contract;
- a malicious endpoint cannot cause the local system to act as a confused deputy against unrelated private state or Actions.

Use server-observed identity and server-side grant state.

---

## NON-EXECUTION / PHASE-4 BOUNDARY

Phase 3 authorises **exchange**, not arbitrary execution.

An authorised exchange must still not automatically:

- execute shell/code;
- invoke unrelated O:I Actions;
- invoke arbitrary MCP tools;
- install a package;
- activate a Capability;
- acquire Workcell resources;
- mutate Central;
- create an Actuation Determination;
- create a Factory Run;
- trust or canonise returned content;
- Project or Explore-index returned content.

If the exchange protocol carries rich content, packages, executable HTML/JS, tool schemas or resource requests, preserve them as data or fail closed until Phase 4 supplies the containment boundary.

---

## AUDIT / PROVENANCE LAW

Preserve private server-observed evidence sufficient to answer:

- who requested Exchange?
- through which attributable Participant/runtime caller?
- with which counterparty/binding?
- for which SharedField/boundary?
- who granted it?
- what scope/protocol/cardinality/expiry was granted?
- when was it created/used/completed/revoked/expired?
- which A2A task/message or other transport operations consumed it?
- which returned Contribution ingress refs derive from authorised exchanges?

Privacy-minimise the evidence.

Do not expose exchange existence, counterparties, private endpoints, purposes or usage counts to unrelated callers.

---

## PERMANENT ADVERSARIAL FIXTURE

Extend the actual Phase-1 + Phase-2 multi-identity provider world rather than constructing a disconnected pristine test universe.

Reuse identities equivalent to:

- OWNER
- MEMBER
- EXPLICIT_PRIVATE_RECIPIENT
- REVOKED_ACTOR
- FINITE_ACTOR
- STRANGER
- REMOTE_AGENT

Add another attributable remote/counterparty identity only where genuine bilateral exchange semantics require it.

Use real SpaceTimeDB callers and subscriptions.

Prove at minimum:

1. raw Exchange grant/backing/audit tables cannot be subscribed to;
2. unrelated callers cannot enumerate private Exchange grants or existence/status metadata;
3. visible/contactable/accepted Contact without an Exchange grant cannot send an authorised exchange;
4. admitted Contribution without Exchange authority cannot initiate an exchange;
5. sender/counterparty cannot self-mint an Exchange grant;
6. ordinary membership/read/admission authority does not imply Exchange authority;
7. only explicitly authorised receiving/field actor may grant Exchange under the chosen authority grammar;
8. revoked Exchange authority fails immediately for new semantic operations;
9. finite Exchange authority fails after reducer server-time expiry;
10. one-shot / bounded-cardinality grant cannot be reused beyond allowance;
11. transport retry does not double-consume or double-create authority incorrectly;
12. replayed expired/revoked grant id fails;
13. actor-bound grant cannot be used by another runtime identity/Participant;
14. counterparty-bound grant cannot be redirected;
15. field-bound grant cannot cross fields;
16. endpoint replacement does not silently inherit authority where the binding lineage/scope does not justify it;
17. A2A Agent Card claims cannot expand O:I Exchange scope;
18. A2A exchange succeeds when reachable + explicitly authorised and remains blocked when either predicate is absent;
19. A2A returned Task/Message/Artifact still enters Phase-2 generic quarantine and is not auto-admitted/indexed/Projected;
20. authorised Exchange causes zero unrelated Action/MCP/package/Workcell/Actuation/Factory side effect;
21. Contact block/mute/revocation interaction behaves exactly according to the explicit contract and does not leave ambient authority;
22. completion/revocation/expiry leaves no stale current-public availability/exchange representation;
23. reconnect/rebuild cannot resurrect revoked/expired/consumed Exchange authority.

Keep these attacks in the permanent corpus. Do not satisfy them only with portable mocks.

---

## DOWNSTREAM REGRESSION

After Exchange authority is implemented, re-run the materially affected stack:

```text
#32 authority / privacy / Watch / Contact
        ↓
#43 Phase 1 private hosted content
        ↓
#43 Phase 2 Contribution ingress / Admission / index eligibility
        ↓
#43 Phase 3 Exchange authority
        ↓
#37 A2A binding / availability / exchange / returned-difference ingress
        ↓
#42 Watch availability / Encounter / Central notification
```

Do not redesign downstream systems.

Adapt only where Phase 3 reveals an invalid ambient-authority assumption.

In particular preserve the existing rule that downstream consumers use legal caller Views/read models rather than raw private backing tables.

---

## PROVIDER CONFORMANCE

Re-check the current SpaceTimeDB release and official primary documentation rather than assuming 2.8.1 is still current.

Exercise the actual provider and record exactly:

- provider version;
- CLI version/commit if exposed;
- module build;
- local provider startup;
- publish;
- generated client bindings;
- public/private table exposure;
- actual multi-identity subscriptions;
- reducer caller identity;
- reducer server-time expiry;
- transactional grant/use/revoke behaviour;
- reconnect/rebuild behaviour;
- any provider limitation affecting live connection revocation or idempotency.

Do not claim provider guarantees which were not executed.

---

## IMPLEMENTATION RECEIPT

Before stopping:

- push working Phase-3 code;
- record exact branch/head;
- record exact PR;
- record exact CI checks/run ids;
- record exact SpaceTimeDB version and CLI commit if exposed;
- record actual provider commands/results;
- list exact files/modules changed;
- state every Exchange authority invariant proved;
- state every remaining provider/design limitation;
- preserve the Phase-1 and Phase-2 receipts unchanged except for explicit additive references if genuinely required;
- write `shared-field/PHASE3-EXCHANGE-AUTHORITY-SECURITY-RECEIPT.md`;
- write a **fresh Phase-4 containment prompt**;
- comment the durable #43 security ledger with the exact Phase-3 receipt;
- keep #31 and #43 open;
- STOP.

Do not begin Phase 4 implementation in the same session.
