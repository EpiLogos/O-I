# OI-017-C Phase 3 — Explicit Exchange Authority Security Receipt

**Status:** Phase 3 implementation receipt for #43. Phase 3 is complete. This receipt does **not** close #43 or #31 and does **not** begin Phase 4 containment.

## Canonical implementation line

- Repository: `EpiLogos/O-I`
- Branch: `agent/oi-017-exchange-authority`
- Exact Phase-2 receipt base: `679a370dcd7a5ce99178e3c86e8f581f72147a7b`
- Last canonical implementation/documentation head before this receipt: `da3cf594da8828037332853c343368c87b44785a`
- Canonical PR: #53 — `[OI-017-C/P3] Enforce explicit bounded Exchange authority`
- Canonical implementation validation: Shared field run **#139**, Actions `32022520356`, `test` SUCCESS and `spacetimedb-live` SUCCESS
- SpaceTimeDB: `2.8.1`
- Provider CLI commit reported by acceptance: `4d9aa49594d59bf09f949b83c30413e43bf0805a`

The Phase-3 line was deliberately stacked on the exact Phase-2 receipt head, then converged with the source-faithful PR #37 A2A transport and PR #51 generic-ingress adaptation. Temporary convergence PRs #52/#54 were closed without merge. They are evidence/tooling history, not production shortcuts.

## Constitutional law now executable

Phase 3 makes the following distinctions server/host enforced rather than documentary:

```text
published / reachable ≠ Exchange-authorised
accepted Contact ≠ Exchange
Admission ≠ Exchange
Exchange ≠ trust
Exchange ≠ execution

A2A Agent Card / endpoint ≠ Agent identity
endpoint ≠ Participant
returned A2A material ≠ admitted Contribution
returned A2A material ≠ Projection
returned A2A material ≠ index eligibility
returned A2A material ≠ Action / tool / package authority
returned A2A material ≠ Workcell / Actuation / Factory execution authority
```

Composition continues to transfer reference and possibility, not ambient trust or authority.

## Server-side Exchange shape

The hosted SpaceTimeDB module adds three **private** security ledgers:

```text
exchange_request
exchange_grant
exchange_use
```

They are omitted from generated public client table bindings. Ordinary callers cannot enumerate them through raw subscriptions.

The first concrete authority flow is:

```text
initiating Participant / runtime actor
        ↓ explicit request
PRIVATE exchange_request
        ↓ receiving field-side decision
PRIVATE exchange_grant
        ↓ exact bounded operation consumption
PRIVATE exchange_use
        ↓
privileged transport/controller may perform network I/O
```

The grant is separate from Contact, Admission and execution authority.

### Grant scope

A grant binds at least:

- containing `SharedField`;
- initiating Participant;
- server-observed initiating runtime identity;
- counterparty Participant;
- protocol/provider family;
- exact transport binding ref;
- exact binding revision;
- allowed exchange mode(s);
- purpose;
- exact bounded scope JSON;
- finite server-time lifetime;
- finite use count;
- grantor and decision provenance;
- active/revoked/completed/exhausted state.

The first server limits are:

- maximum Exchange TTL: 24 hours;
- maximum uses per grant: 64;
- maximum scope JSON: 8 KiB;
- maximum outstanding pending requests per initiating Participant/field: 8;
- accepted protocol identifiers at this floor: `a2a`, `mcp`, `http`;
- accepted exchange modes at this floor: `message:send`, `task`, `data`.

`tool:call` is deliberately **not** an Exchange mode.

### Issuance and use

The first grant issuer is the actual SharedField owner. This is deliberately narrower than inventing a new delegation ontology in Phase 3.

The request reducer requires the runtime caller to be bound to the initiating Participant with current field authority. The grant reducer uses reducer server time, stores the runtime actor identity and receiving-side decision provenance, and refuses expired/conflicting requests.

The consume reducer re-checks the exact actor, field, initiator, counterparty, protocol, binding ref/revision, purpose, scope and mode at use time. It also re-checks current Participant authority and bilateral Contact block/mute policy.

Exact retry of the same `{grant_ref, operation_id, demand}` is idempotent. A conflicting replay fails closed. New operations consume the finite use budget transactionally. Exhaustion, expiry, explicit revocation and completion end the authority.

Revoking the initiating Participant's field authority terminates its outstanding Exchange grants. Blocking/muting either side terminates live grants between the pair.

## Privileged A2A enforcement

`performA2aExchange()` now requires an explicit Exchange-authority resolver before it performs **any** remote request.

The order is:

```text
published binding + live presence
        ↓
construct exact Exchange demand
        ↓
consume server-side grant
        ↓ ALLOW only
Agent Card fetch
        ↓ matching already-published interface only
POST /message:send
        ↓
bounded untrusted Task / Message / Artifact result
```

A missing or denied authority resolver results in zero A2A HTTP requests, including zero Agent Card discovery requests.

Remote Agent Card metadata cannot widen the locally granted field, Participant, protocol, mode, purpose or binding lineage. A replacement endpoint/binding revision requires fresh Exchange authority; the old grant does not follow it automatically.

Request-local authorization headers are not copied into SharedField contracts, Contributions or returned differences.

## Transport resource floor

The A2A controller now applies bounded transport handling before remote bytes become returned data:

- outbound message text: 32 KiB;
- Agent Card response: 64 KiB;
- A2A response: 1 MiB;
- request timeout: 15 seconds;
- redirects rejected by the privileged fetch boundary;
- bounded JSON depth and object/array cardinality.

These are client/protocol bounds. They are not a substitute for Phase-4 process, filesystem, network, credential, package or Workcell containment.

## Returned A2A material converges through Phase 2

The returned `oi.a2a-difference/v1` carries the exact Exchange grant and operation lineage.

A new hosted adapter reducer, `ingest_authorized_exchange_contribution`, requires:

- a matching consumed Exchange grant/use;
- the correct field;
- the correct remote counterparty Participant as contributor;
- source/protocol lineage matching the grant.

It then delegates to the **generic Phase-2 Contribution ingress** boundary.

The resulting law is:

```text
A2A Task / Message / Artifact
        ↓ authorised transport occurrence
untrusted returned difference
        ↓
matching Exchange lineage check
        ↓
generic Contribution ingress
        ↓
PRIVATE quarantine
        ↓ separate receiving-side Admission
admitted Contribution
        ↓ separate index decision
possible Explore visibility under Phase-1 caller audience
```

Exchange success therefore does not auto-admit, index, Project, execute, canonicalise or trust remote material.

The former A2A-specific Admission shortcut remains fail-closed.

## MCP / execution non-escalation witness

The live provider corpus includes a protocol-neutral MCP-shaped case. A grant scoped to:

```text
protocol = mcp
mode = data
```

does not permit:

```text
mode = tool:call
```

This is the executable Phase-3 witness for:

```text
Exchange ≠ tool invocation authority
```

Actual Action/MCP-tool/package/process authority belongs to Phase 4.

## Permanent Phase-3 adversarial corpus

`shared-field/spacetimedb/security-live-acceptance-v6.ts` extends the existing real multi-identity provider world and reports **24** Phase-3 cases.

It proves at least:

1. raw Exchange request/grant/use tables cannot be subscribed to;
2. unrelated callers cannot enumerate Exchange audit state;
3. published/reachable participation without a grant cannot be consumed as Exchange authority;
4. accepted Contact does not itself create Exchange authority;
5. initiating/ordinary Participants cannot self-mint a field-side grant;
6. wrong runtime actor fails;
7. wrong SharedField fails;
8. wrong counterparty fails;
9. wrong protocol fails;
10. wrong endpoint/binding ref fails;
11. replacement binding revision cannot inherit the old grant;
12. purpose widening fails;
13. correct use succeeds;
14. exact operation retry is idempotent;
15. N-use exhaustion fails closed;
16. conflicting request replay fails;
17. explicit grant revocation fails closed;
18. block/mute policy terminates a live grant;
19. revoked Participant authority terminates outstanding Exchange authority;
20. finite Participant authority expiry is enforced using reducer server time;
21. MCP data authority cannot widen into `tool:call`;
22. authorised A2A return enters generic Phase-2 quarantine;
23. exact authorised-return retry is idempotent and unknown operation lineage is rejected;
24. saved-identity reconnect does not resurrect exhausted authority.

The proof reports:

```text
proof: oi-exchange-authority-phase3/v1
spacetimedb: 2.8.1
cases: 24
private_audit_tables: exchange_request, exchange_grant, exchange_use
contact_is_exchange: false
admission_is_exchange: false
exchange_is_execution: false
a2a_return_state: quarantined
mcp_tool_invocation_authority: false
```

## Canonical provider acceptance

Canonical Shared field run **#139**, Actions `32022520356`, at exact head `da3cf594da8828037332853c343368c87b44785a` completed successfully:

- `test` — SUCCESS;
- `spacetimedb-live` — SUCCESS.

The provider lane executed the real 2.8.1 build/publish/codegen/server path, including:

```text
npm install --prefix shared-field/spacetimedb
spacetime version install 2.8.1
spacetime version use 2.8.1
spacetime --version
spacetime build --module-path shared-field/spacetimedb
spacetime start --listen-addr 127.0.0.1:3000
spacetime publish oi-shared-field-ci --server local --module-path shared-field/spacetimedb --yes=all
spacetime generate --lang typescript --out-dir shared-field/spacetimedb/module_bindings --module-path shared-field/spacetimedb
npm --prefix shared-field/spacetimedb run acceptance
npm --prefix shared-field/spacetimedb run acceptance:a2a
```

The acceptance bootstrap runs the Phase-1 v4, Phase-2 v5 and Phase-3 v6 provider corpora against real SpaceTimeDB identities.

The isolated A2A provider proof reports:

```text
proof: oi-a2a-phase3-exchange-authority/v1
exchange_grant_ref: exchange-grant:a2a:p3-live
exchange_operation_id: exchange-operation:a2a:p3-live
legacy_a2a_admission_bridge: disabled
auto_contribution: false
auto_projection: false
auto_index: false
```

## Full downstream #37 / #42 convergence

A fresh evidence branch was constructed from the previously proven Phase-2 downstream evidence lineage and then run over the live #42 notification stack:

- Branch: `agent/oi-017-exchange-authority-conformance`
- Evidence head: `ad6de826a0b7f14d719bb24925b15b648a2b1fad`
- Evidence PR: #55 — `[CONFORMANCE/P3] Prove Exchange authority across A2A + notification stack`
- PR #55 was deliberately closed **without merge** after proof
- Shared field run **#141**, Actions `32022942197`: `test` SUCCESS, `spacetimedb-live` SUCCESS

That run proved, together:

```text
Phase 1 private/audience-scoped hosted content
+
Phase 2 generic quarantine / Admission / index separation
+
Phase 3 explicit bounded Exchange authority
+
source-faithful #37 Explore → A2A lifecycle
+
fresh Exchange grant on A2A binding revision replacement
+
authorised A2A return → generic quarantine → separate Admission
+
Watch → availability → Encounter → explicit Central notification decision/delivery
```

The source-faithful A2A proof reported:

```text
proof: oi-a2a-sharedfield-live/v3-exchange-authority
initial_task: a2a-task:initial
replacement_task: a2a-task:replacement
binding_state: withdrawn
admitted_contribution_indexed: false
legacy_a2a_admission_bridge: disabled
automatic_projection_from_returned_difference: false
transport_did_not_create_actuation_or_run: true
```

The same run then repeated the isolated canonical Phase-3 A2A proof and finally passed the existing notification proof:

```text
proof: oi-watch-availability-notification-live/v1
central_action: personal.notify
central_deliveries: 2
human_acknowledgement_recorded: false
intruder_watch_visibility: 0
revocation_stopped_delivery: true
rebuild_deduplicated: true
endpoint_churn_preserved_identity: true
```

Thus Exchange authority did not collapse Watch into Contact, availability into Activity, notification delivery into acknowledgement, or A2A transport into execution.

## Files materially changed in the canonical Phase-3 PR

- `.github/workflows/shared-field.yml`
- `shared-field/A2A-CONFORMANCE.md`
- `shared-field/a2a-explore.mjs`
- `shared-field/a2a-explore.test.mjs`
- `shared-field/a2a-lifecycle.mjs`
- `shared-field/a2a-schema-v1.json`
- `shared-field/a2a.mjs`
- `shared-field/a2a.test.mjs`
- `shared-field/api.mjs`
- `shared-field/exchange-authority.test.mjs`
- `shared-field/spacetimedb-a2a.mjs`
- `shared-field/spacetimedb/a2a-live-acceptance.ts`
- `shared-field/spacetimedb/a2a-phase2-ingress-live-acceptance.ts`
- `shared-field/spacetimedb/package.json`
- `shared-field/spacetimedb/security-live-acceptance-v4-bootstrap.ts`
- `shared-field/spacetimedb/security-live-acceptance-v6.ts`
- `shared-field/spacetimedb/src/index.ts`

The first A2A transplant preserved the actual current #37/#51 source rather than rebuilding the protocol model from memory.

## Provider / security caveats retained honestly

Phase 3 does **not** claim:

- that an A2A Agent Card cryptographically proves O:I Agent/Participant identity;
- that the first A2A fixture establishes a universal remote-peer credential system;
- that bearer/request credentials may be published in Projections;
- that Exchange grants authorize MCP tool calls, Actions, packages, binaries or arbitrary code;
- that admitted material is safe to execute;
- that transport size/time bounds replace OS/process/Workcell containment;
- that network-level distributed denial-of-service is solved by application reducers;
- that the field owner is the final universal Exchange-policy model;
- that raw private audit state should become a broadly subscribable social graph.

The current A2A path binds authority to an explicitly published endpoint/interface lineage and checks the returned material's Exchange ancestry. Stronger remote workload/credential authenticity, where required by the final product deployment, remains a separate provider/security integration rather than being fabricated from Agent Card metadata.

## Phase boundary

Phase 3 is complete.

The following are **not** implemented in this phase:

- Action invocation authority;
- MCP `tool:call` authority;
- package/component install or activation authority;
- native/Wasm execution authority;
- Workcell allocation authority;
- filesystem/secret/network/process capability grants;
- rich-content script/native execution;
- resource/egress containment for delegated execution.

Those are Phase 4.

The required fresh-session handoff is `shared-field/PHASE4-CONTAINMENT-FRESH-SESSION-PROMPT.md`.

**STOP after Phase 3. Do not implement Phase 4 in this session.**
