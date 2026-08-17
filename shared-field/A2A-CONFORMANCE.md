# O:I SharedField ↔ A2A conformance floor

**Issue:** #24 / OI-015  
**A2A target:** protocol `1.0`, HTTP+JSON binding  
**Hosted state:** SpaceTimeDB `2.8.1`  
**Security dependency:** #31 / OI-017 encounter-security floor

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
    ↓ protocol exchange
A2A Task | Message
    ↓ encountered returned difference
explicit admission decision
    ↓ optional
Contribution and/or Projection
```

The following non-identities are executable invariants:

```text
A2A Agent Card / endpoint ≠ Agent identity
A2A endpoint ≠ Participant
A2A Task ≠ Actuation Determination / Return
A2A Task ≠ Factory Run
A2A Message ≠ Contribution automatically
A2A Artifact ≠ Projection automatically
SpaceTimeDB row ID ≠ O:I semantic Ref
```

A2A exchange is communication between eligible situated loci. It carries no determining/delegation authority. If an A2A exchange later participates in an Actuation `Return`, that requires an independently existing Actuation Determination lineage and the Actuation recognition/world-mutation law.

## A2A primary-source lock

The implementation targets the released A2A v1 semantic/wire family rather than inventing an O:I-specific RPC dialect:

- official specification repository: `https://github.com/a2aproject/A2A`;
- normative v1 protocol schema: `specification/a2a.proto`;
- HTTP+JSON binding sends `POST /message:send`;
- `AgentInterface` supplies transport URL, protocol binding and protocol version;
- `SendMessageResponse` contains either an A2A `Task` or an A2A `Message`;
- Agent Cards are discovered independently of O:I identity and advertise supported interfaces;
- current v1 patch guidance prefers media type `application/a2a+json` for HTTP+JSON.

O:I records protocol version `1.0` in the semantic binding and uses `application/a2a+json` plus `A2A-Version: 1.0` on message exchange. The Agent Card is checked for an interface matching the *already explicitly published* O:I binding. It is not used to mint or replace the O:I Agent or Participant ref.

## Explicit publication

`oi.a2a-binding/v1` is a revocable semantic transport relation. Publication requires:

- distinct `agent_ref`, `participant_ref` and `binding_ref`;
- an attributable `publisher_participant_ref`;
- a fresh `publication_decision_ref`;
- source revision and provenance;
- an explicit public Agent Card URL and endpoint URL only while state is `published`.

Outside loopback development, locators must be HTTPS. Embedded URL credentials, query material and fragments are rejected. Runtime authorization headers are request-local and are never copied into SharedField contracts or returned differences.

Endpoint replacement increments the binding revision and requires another publication decision. Withdrawal is also a new revision and carries no endpoint locators. Agent identity, Participant identity and Watch relations survive both replacement and withdrawal.

## Security convergence with OI-017

A2A does not define another authority registry.

The binding is materialised as a normal public `oi.projection/v1` with representation kind `a2a-binding`. Therefore hosted mutation uses the existing OI-017 SpaceTimeDB Projection reducer and contributor authority checks.

Live availability is materialised as an `oi.explore-entry/v1` of kind `a2a-presence`; owner/index authority remains the OI-017 Explore authority boundary. The presence semantic ref is not the SpaceTimeDB row id and is not the binding ref.

This deliberately inherits the current public hosted-content floor. It does not claim private/audience-scoped endpoint publication before #31 provides that hosted content policy. Private runtime endpoints are therefore not silently projected merely because they are locally discoverable.

Contact remains a separate consent/anti-spam primitive. `discoverable ≠ contactable ≠ contacted ≠ reciprocal ≠ trusted`; an A2A binding is additionally `published-and-currently-reachable`, not an ambient permission to contact or delegate.

## Returned difference and admission

`performA2aExchange` returns `oi.a2a-difference/v1` with `admission: pending`. The wire Task/Message payload and any A2A Artifact remain transport provenance at this point.

`encounterA2aDifference` may record objective presentation/availability through `oi.encounter/v1`; it does not impute belief, understanding, agreement or other subjective state.

`admitA2aDifference` is the only current bridge from transport result to SharedField semantic material. Its explicit decision can:

- reject;
- create a Contribution;
- create a Projection;
- create both.

No branch creates an Actuation Determination/Return or Factory Run implicitly.

## Executable evidence

Portable/adversarial tests:

```text
shared-field/a2a.test.mjs
shared-field/a2a-explore.test.mjs
```

Live provider/protocol acceptance:

```text
shared-field/spacetimedb/a2a-live-acceptance.ts
```

The live fixture uses generated SpaceTimeDB bindings and a real loopback HTTP A2A server to prove:

1. Explore search finds the canonical Agent semantic ref;
2. Agent resolves to a distinct Participant and explicit binding;
3. binding and presence arrive from live SpaceTimeDB subscriptions;
4. SpaceTimeDB row ids remain implementation metadata;
5. the HTTP+JSON v1 exchange returns a Task with an Artifact but creates no SharedField Contribution/Projection automatically;
6. Encounter retains A2A transport provenance without subjective claims;
7. explicit admission writes a returned Projection through the secured SpaceTimeDB Projection reducer;
8. Watch remains independent;
9. endpoint replacement uses a fresh decision and new transport while preserving Agent/Participant identity;
10. withdrawal removes locators/reachability while Agent discovery and Watch survive;
11. post-withdrawal exchange fails before any network request.

CI runs the encounter-security v3 provider proof first and the A2A acceptance against a separate published SpaceTimeDB database second, so protocol evidence cannot pass by bypassing the current security floor.
