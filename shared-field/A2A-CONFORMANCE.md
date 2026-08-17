# O:I SharedField ↔ A2A conformance floor

**Issue:** #24 / OI-015 and #31 / #43 / OI-017  
**A2A target:** protocol `1.0`, HTTP+JSON binding  
**Hosted state:** SpaceTimeDB `2.8.1`  
**Security phase:** #43 Phase 3 — explicit Exchange authority

This file records the implemented provider/protocol boundary. It is intentionally narrower than “generic A2A support”.

## Constitutional separation

```text
O:I semantic Agent
    ↓ explicit Participant relation
O:I Participant
    ↓ explicit publication decision
A2A binding Projection
    ↓ live reachability observation
A2A presence Explore fact
    ↓ explicit Exchange request + field-side grant
bounded A2A Exchange use
    ↓ protocol exchange
A2A Task | Message | Artifact
    ↓ untrusted returned difference
Phase-2 generic Contribution ingress / quarantine
    ↓ separate receiving-side Admission decision
admitted Contribution
    ↓ separate receiving-side index-eligibility decision
optional Explore visibility, intersected with caller audience
```

The following non-identities are executable invariants:

```text
A2A Agent Card / endpoint ≠ Agent identity
A2A endpoint ≠ Participant
published / reachable endpoint ≠ Contact
accepted Contact ≠ Exchange
Exchange ≠ trust
Exchange ≠ execution authority
A2A Task ≠ Actuation Determination / Return
A2A Task ≠ Factory Run
A2A Message ≠ Contribution automatically
A2A Artifact ≠ Projection automatically
returned material ≠ Admission / index eligibility / canon / execution
SpaceTimeDB row ID ≠ O:I semantic Ref
```

A2A exchange is communication between eligible situated loci. It carries no determining, delegation, tool-call, package, Workcell, Actuation or Factory execution authority. If an A2A exchange later participates in an Actuation `Return`, that requires independently existing execution authority and recognition/world-mutation law; that is outside #43 Phase 3.

## A2A primary-source lock

The implementation targets the released A2A v1 semantic/wire family rather than inventing an O:I-specific RPC dialect:

- official specification repository: `https://github.com/a2aproject/A2A`;
- normative v1 protocol schema: `specification/a2a.proto`;
- HTTP+JSON binding sends `POST /message:send`;
- `AgentInterface` supplies transport URL, protocol binding and protocol version;
- `SendMessageResponse` contains either an A2A `Task` or an A2A `Message`;
- Agent Cards are discovered independently of O:I identity and advertise supported interfaces;
- current v1 guidance uses media type `application/a2a+json` for HTTP+JSON.

O:I records protocol version `1.0` in the semantic binding and uses `application/a2a+json` plus `A2A-Version: 1.0` on message exchange. The Agent Card is checked for an interface matching the *already explicitly published* O:I binding. Agent Card metadata cannot mint or widen O:I identity, Participant status, Exchange authority or execution authority.

## Explicit publication is not Exchange authority

`oi.a2a-binding/v1` is a revocable semantic transport relation. Publication requires distinct Agent, Participant and binding refs, attributable publisher and decision refs, source revision/provenance, and explicit endpoint locators while state is `published`.

Endpoint replacement increments the binding revision and requires another publication decision. Withdrawal is also a new revision and carries no endpoint locators. Agent identity, Participant identity and Watch relations survive replacement/withdrawal.

Publication and observed availability establish **reachability only**. `performA2aExchange` now requires an explicit Exchange-authority resolver before performing *any* network request, including Agent Card discovery. Missing or denied authority therefore produces zero outbound A2A requests.

## Phase-3 Exchange grant binding

A server-side Exchange grant is separate from Contact and Admission. It binds at least:

- SharedField;
- initiating Participant and server-observed runtime actor identity;
- counterparty Participant;
- protocol/provider mode;
- exact A2A binding ref and binding revision;
- purpose and scope;
- permitted exchange mode;
- finite server-time lifetime;
- finite use count;
- field-side grant decision/provenance;
- revocation/completion/exhaustion state.

The SpaceTimeDB `exchange_request`, `exchange_grant` and `exchange_use` ledgers are private. Grant consumption is reducer-mediated and transactional. Exact operation replay is idempotent; conflicting replay, wrong actor/field/counterparty/protocol/binding/revision/purpose/mode, expiry, revocation and exhaustion fail closed.

A replacement endpoint/binding revision cannot silently inherit an earlier grant.

## Bounded transport

The privileged A2A controller applies bounds before remote material can become returned data:

- outbound message text: 32 KiB;
- Agent Card response: 64 KiB;
- A2A exchange response: 1 MiB;
- bounded JSON depth/cardinality;
- 15 second fetch timeout;
- redirects rejected at the privileged fetch boundary.

Runtime authorization headers remain request-local and are never copied into SharedField contracts or returned differences.

## Returned difference → generic quarantine

`performA2aExchange` returns `oi.a2a-difference/v1` carrying the exact Exchange grant and operation lineage. Task/Message/Artifact payloads remain transport provenance and untrusted material.

The former A2A-specific semantic Admission shortcut is not the Phase-3 ingress path. An authorised return can only be submitted through `ingest_authorized_exchange_contribution`, which verifies the consumed Exchange grant/operation and counterparty/source lineage before delegating to the generic Phase-2 Contribution ingress boundary.

That boundary produces private quarantine and a caller receipt. It does **not** produce:

- Admission;
- index eligibility;
- Projection;
- Explore visibility;
- trust or canon;
- Action/tool/package authority;
- Workcell/Actuation/Factory execution authority.

Any later Admission and indexing remain separate receiving-side decisions under the Phase-2 laws.

## MCP non-escalation witness

The Phase-3 provider corpus also proves the protocol-neutral distinction using an MCP-shaped grant: a grant scoped to `protocol=mcp` and `mode=data` does not permit `mode=tool:call`. Tool invocation belongs to Phase-4 execution containment, not Exchange.

## Executable evidence

Portable/adversarial tests:

```text
shared-field/a2a.test.mjs
shared-field/a2a-explore.test.mjs
shared-field/exchange-authority.test.mjs
```

Live provider acceptance:

```text
shared-field/spacetimedb/security-live-acceptance-v4-bootstrap.ts
shared-field/spacetimedb/security-live-acceptance-v6.ts
shared-field/spacetimedb/a2a-phase2-ingress-live-acceptance.ts
```

The provider chain preserves the earlier Phase-1 private-content and Phase-2 Contribution-Admission corpora, then executes the Phase-3 multi-identity Exchange corpus. A separate isolated live A2A database proves that a grant is consumed before network I/O and that returned remote material lands only in the generic Contribution quarantine.
