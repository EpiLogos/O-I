# {O:I} Encounter Security — ES0 Threat Model, Responsibility Matrix and Implementation Ledger

**Status:** executable research/implementation companion to `ENCOUNTER-SECURITY.md`  
**Issue:** #31 / OI-017  
**Implementation line:** `agent/oi-017-encounter-security`, based on PR #19 head `3de1cc548252017877bdd7d80447b7dcac375551`  
**Research date:** 2026-08-16

This file does not replace the six security primitives in `ENCOUNTER-SECURITY.md`. It records the first threat-model pass, current primary-source verification, responsibility cuts and executable security slices.

The governing law remains:

> **Composition transfers reference and possibility, not ambient trust or authority.**

## ES0 — threat model

### Assets and boundaries

The immediate hosted attack surface is the SpaceTimeDB-backed SharedField/Explore seam developed on PR #19. The protected assets are not merely rows. They include semantic identities, source revisions, publisher attribution, field membership/authority, private relationship graphs, Contact state, index integrity and the distinction between local canonical source and hosted projection.

The first material trust boundaries are:

```text
remote / independent client
        ↓ authenticated SpaceTimeDB Identity
server-side reducer boundary
        ↓ field owner / participant grant
shared semantic mutation
        ↓ public table or caller-filtered View
client read model / Explore
```

and, for social relation state:

```text
discoverable Participant
        ≠
private Watch / Contact relation
        ≠
accepted communication relation
        ≠
trusted / executable / canonical authority
```

### Adversary classes and required failure mode

| Threat | Example | Boundary that must hold | Executable evidence in this slice |
|---|---|---|---|
| Cross-field mutation | Client in Field B updates Field A | server-side `ctx.sender` → field ownership | live attack fixture |
| Participant impersonation | Client supplies another `participant_ref` | private Identity→Participant authority binding | live attack fixture |
| Projection overwrite/spoof | Contributor rewrites another revision or source attribution | immutable revision row + publisher authority | live attack fixture |
| Implementation-ID confusion | client treats SpaceTimeDB row/index ID as semantic identity | semantic refs independently checked against contract payload | live attack fixture |
| Relationship-graph extraction | public client subscribes to Watch/Contact rows | private tables + caller-filtered Views | live privacy fixture |
| Revoked authority | stale grant continues reading/writing | grant deletion must invalidate reducer authority and caller Views | live attack fixture |
| Expired authority | finite grant continues mutating or becomes stale private-read entitlement | server-time reducer expiry + finite grants excluded from private Views | live attack fixture |
| Contact spam / high fan-out | one Participant emits unbounded unsolicited requests | per-origin/per-field server rate window + one-active-request rule | live anti-spam fixture |
| Block/mute bypass | blocked initiator creates a new request with another ref | recipient-local private policy checked server-side | live attack fixture |
| Oversized Contact payload | attacker uses social relation as storage/processing sink | server-side field limits | live rejection fixture |
| Index pollution | contributor writes arbitrary Explore rows/relations | Explore index write remains field-owner-only | live attack fixture |
| Confused deputy by composition | mounted component/Agent assumes host privilege | no authority derived from containment/projection | responsibility invariant; downstream component slice |
| Remote metadata canonicalisation | Agent Card / package metadata becomes canonical fact | explicit Projection/Admission still required | coordinated with #21/#24; not automatic here |
| Prompt/content injection | foreign text becomes instruction/tool authority | representation remains untrusted data | downstream content/agent boundary |
| Supply-chain execution | package/component gains local bridge or process access | explicit package/native permission boundary | #21/#26 ownership; not implemented in SharedField module |
| Resource exhaustion beyond app quota | connection/reducer flood, energy/host exhaustion | SpaceTimeDB/host ingress + deployment controls | residual risk; app Contact budget is not a DoS firewall |

### Explicit non-assumptions

- A SpaceTimeDB `Identity` is an authenticated runtime principal, **not** an O:I `Agent`, `Human`, `Participant`, or canonical world identity.
- Possession of a semantic `participant_ref` is not authority to act as it.
- Public table readability is not trust, admission, canonicality, or execution permission.
- Field ownership in this first module slice is a hosted mutation authority, not Root Agency/metagentic authority.
- A successful Contact request creates no A2A task/session, no Contribution, no Projection and no trust edge.
- Application-level rate limiting does not replace host/network DoS controls.

## Responsibility matrix

| Responsibility | O:I | Central | AIKit | Actuation | Factory | Workcell / host | SpaceTimeDB module / adapter |
|---|---|---|---|---|---|---|---|
| Encounter grammar: Boundary / Identity+Provenance / Authority / Mediation / Contact / Admission | **owns** | informs local policy | consumes | consumes | consumes | consumes | implements hosted subset |
| Human-authored world-local preferences / durable social policy | references | **owns source** | resolves when applicable | consumes | consumes | n/a | receives derived policy only |
| Runtime caller authentication | maps, never canonicalises | n/a | may project credentials | n/a | n/a | may terminate/authenticate ingress | **binds current Identity/JWT** |
| SharedField membership and hosted write authority | **semantic owner** | may author policy | may resolve capability context | keeps Agent identity distinct | keeps Run/Action distinct | deployment enforcement | **server-side enforcement** |
| Agent determination / delegation / metagency | references | world ground | capability projection | **owns** | n/a | n/a | never infers from transport identity |
| Package install/permissions | composes | may author preferences | native extension contracts | n/a | may build package | process/filesystem enforcement | no package authority |
| Desktop/rich component bridge authority | composition law | user policy | component/surface contract | n/a | n/a | sandbox/process boundary | no bridge authority |
| Project/Run/Action authority | references | n/a | capability resolution | commissioning relation | **owns** | materialises bounded execution | no Factory identity collapse |
| Material isolation / network / secret mounts | requests bounded relation | secret source where applicable | resolves requirements | n/a | requests execution | **owns enforcement** | only hosted DB surface |
| Watch/Contact relation privacy | **owns semantic rule** | retention preferences | may project read Surface | Agent use under grants | n/a | storage/transport perimeter | **private table + caller View** |
| Public Explore indexing | **owns semantic/read-model rule** | controls selected Projection | may expose Surface | no canonicalisation | may supply objects | n/a | owner-only index mutation; public read floor |
| Federation/A2A transport trust | **owns Participant/Projection/Contact/Encounter seam** | local policy | Surface/binding | **owns agentic relation/Return** | owns Action/Run mapping | endpoint isolation | stores only explicitly projected/admitted state |

The matrix deliberately avoids one universal trust engine. Each native owner enforces the authority it actually owns; O:I composes the result and retains the cross-space laws.

## Primary-source lock — systems actually relied on in this slice

### SpaceTimeDB

**Pinned implementation version:** `v2.8.1`, GitHub release published 2026-08-12. The prior PR #19 live lane was pinned to 2.7.1 and is upgraded by this security slice so the conformance proof runs against the current release verified on 2026-08-16.

Primary sources:

- https://github.com/clockworklabs/SpacetimeDB/releases/tag/v2.8.1
- https://spacetimedb.com/docs/functions/reducers/reducer-context/
- https://spacetimedb.com/docs/tables/access-permissions/
- https://spacetimedb.com/docs/functions/views/
- https://spacetimedb.com/docs/clients/connection/
- https://spacetimedb.com/docs/clients/typescript/
- https://spacetimedb.com/docs/tables/schedule-tables/

Verified properties used here:

1. reducers receive the caller `Identity` as `ctx.sender` and are the server-side mutation boundary;
2. tables are private by default, while public tables are client-readable but still reducer-write-only;
3. private tables can be exposed through public per-caller Views using `ViewContext` + indexed `ctx.sender` filtering;
4. connection tokens can preserve the same SpaceTimeDB Identity across connections, while the connection ID remains session-specific;
5. reducer invocation time is supplied by `ctx.timestamp`, including `microsSinceUnixEpoch`, so expiry/rate windows do not trust client clocks;
6. current TypeScript client reducer invocations return a Promise which rejects on `SenderError`, enabling executable negative conformance tests;
7. private tables are omitted from generated ordinary client bindings, while public Views are generated;
8. schedule tables are documented for one-shot future reducer execution, but the exact pinned 2.8.1 standalone did not reproduce a one-second scheduled authority-expiry execution in repeated live CI fixtures.

The scheduling result is treated as provider-conformance evidence, not hand-waved away. See `ENCOUNTER-SECURITY-SPACETIMEDB-CONFORMANCE.md`.

**Consequence:** the first hosted security layer uses private Identity→Participant grants and caller-filtered Views, but finite grants are fail-closed out of private Views. O:I does not invent a second authentication protocol and does not rely on an unproven timer for relationship privacy.

### Matrix — Contact-state lesson only, no dependency adopted

**Verified current stable spec:** Matrix Client-Server API v1.19; current Server-Server API exposes invite blocking (`M_INVITE_BLOCKED`, added in v1.18).

Primary sources:

- https://spec.matrix.org/v1.19/client-server-api/
- https://spec.matrix.org/latest/server-server-api/

Useful lesson retained without copying Matrix ontology: `invite`, `knock`, `join`, `leave` and `ban` are distinct authorised membership transitions; a knock/invite does not itself confer participation. Matrix also specifies rejection/rate-limit paths. O:I Contact keeps the same separation of attempt, recipient decision and subsequent relation while remaining its own semantic object.

### ActivityPub / Mastodon — delivery is not trust

Primary sources:

- W3C Recommendation: https://www.w3.org/TR/activitypub/
- Mastodon moderation: https://docs.joinmastodon.org/admin/moderation/
- Mastodon user moderation: https://docs.joinmastodon.org/user/moderating/

Useful lesson: federation delivers activities to inboxes, but the ActivityPub Recommendation explicitly calls out spam, federation DoS, rate limiting and sanitisation in its security considerations. Mastodon adds local user/domain controls and makes moderation local to the receiving server. O:I therefore does not equate a reachable inbox/endpoint with accepted Contact, nor remote delivery with local admission.

### AT Protocol / Bluesky — moderation provenance stays attributable

Primary sources:

- https://atproto.com/specs/label
- https://atproto.com/guides/moderation

Useful lesson: moderation labels retain an attributable source DID, subject and lifecycle/expiry; multiple labelers can be composed rather than collapsed into one universal truth. O:I keeps moderation/recommendation as attributable mediation/Contribution rather than a global reputation fact.

No Matrix, ActivityPub, Mastodon or AT Protocol runtime dependency is introduced by this slice.

## ES1 — SpaceTimeDB authority/privacy vertical slice

Implemented contract:

```text
SpaceTimeDB Identity
        ↓ private field owner / Participant grant
ParticipantRef + field scope + role + contactable + expiry/revocation
        ↓ checked in reducer / caller View
allowed mutation or relationship disclosure
```

The grant is deliberately implementation-local:

```text
SpaceTimeDB Identity ≠ Participant ≠ Agent/Human identity
```

Roles in this first floor are intentionally small:

- `observer` — may own private Watch/read-social relations;
- `contact` — observer powers + initiate Contact;
- `contributor` — contact powers + publish Projection.

`contactable` is separate from role and discoverability. A Participant can remain publicly addressable while direct Contact is refused.

Field owners create/update hosted membership, grant/revoke Participant bindings, and own the derived Explore index write path. This does **not** make field owners global O:I administrators or Root Agents.

Security changes:

- first creation of a hosted SharedField binds its server-side owner to `ctx.sender`; subsequent mutation requires that owner;
- Participant creation/update is field-owner-only;
- indexed semantic fields are cross-checked against the canonical JSON contract at the reducer boundary;
- Participant authority binds a semantic Participant to a concrete SpaceTimeDB Identity privately, with role, `contactable`, server-time expiry and revocation;
- persistent grants (`ttlSeconds = 0`) may expose caller-filtered private relationship Views and can be explicitly revoked;
- finite grants (`ttlSeconds > 0`) are mutation-only and never receive private Watch/Contact Views; reducer authority expires using `ctx.timestamp`;
- Projection writes require the caller to be bound to the declared publisher Participant;
- an existing Projection revision is immutable; revision progression is monotonic; handing a revision line to a different publisher requires field-owner mediation;
- non-public SharedFields and non-public Projection audiences are rejected by the current explicitly public hosted floor;
- Explore entry/relation mutation is field-owner-only in this first slice, closing the easiest index-pollution path;
- Explore entries and relations carry hosted `fieldRef` scope metadata without changing their semantic refs;
- Watch storage becomes private and is exposed only through `my_watch`, a caller-filtered public View;
- explicit authority revocation deletes the grant and therefore removes private relationship visibility as well as write authority;
- Watch mutation requires a live Participant grant;
- contract/representation JSON gets explicit size/object and semantic-column validation at the reducer boundary.

### Deliberate current limitation

The existing PR #19 Explore floor remains explicitly **public** for SharedField/Participant/Projection/Explore content. OI-017 now rejects private material at those reducers rather than allowing a false privacy claim. Private **relationship** state is protected; private/audience-scoped content Views remain a later ES1 slice before private hosted worlds are claimed.

## ES2 — explicit Contact / anti-spam vertical slice

`oi.contact/v1` is added as an explicit relation separate from Participant discovery, Watch, A2A and Contribution.

Server-side Contact enforces:

- caller must be a live `contact` or `contributor` grant for the initiator Participant;
- recipient must resolve to a live Participant grant with `contactable = true`;
- purpose is required and bounded to 500 characters;
- requested scope and provenance payloads are bounded JSON objects;
- expiry is computed from server time and capped at seven days;
- one pending non-expired request per Participant pair;
- three successful new Contact requests per origin Participant / SharedField / 60-second server window;
- recipient-local `muted` / `blocked` policy rejects new requests before creation;
- only the recipient Participant may accept, decline, redirect or narrow the request;
- Contact and policy tables are private;
- `my_contact` exposes only rows for persistent caller grants where the caller is initiator or recipient;
- finite mutation grants get no Contact graph disclosure;
- Contact creation has no reducer path to A2A, Contribution, Projection, capability grant, trust, canon or execution.

The intentionally strict rate is a conformance floor, not a final product default. Future world-local Central policy can parameterise it without moving enforcement out of the server-side boundary.

## Attack/conformance fixture ledger

The live SpaceTimeDB CI lane proves, against the pinned current release:

- distinct connections receive distinct SpaceTimeDB Identities while semantic Participants remain explicit;
- raw private Watch/Contact/authority subscriptions fail;
- a non-owner cannot mutate another SharedField;
- private SharedField/Projection material cannot enter the current public hosted floor;
- a non-owner cannot create Participants in another field;
- indexed implementation columns cannot spoof semantic contract refs;
- a caller cannot act as another Participant by supplying its semantic ref;
- another Participant cannot overwrite an existing Projection revision;
- field-owner-mediated human refinement can create the next Projection revision without rewriting canonical source revision;
- Explore index writes reject non-owner pollution;
- `my_watch` and `my_contact` reveal only caller-visible relationship rows;
- a discoverable Participant with `contactable = false` rejects Contact;
- only the recipient can perform Contact response transitions;
- Contact block, oversize and rate-limit attacks fail server-side;
- explicit revocation removes private relationship visibility and protected reducer authority;
- finite grants expose no private relationship Views, can mutate before expiry, and fail protected mutation after server-time expiry;
- the Explore rebuild still preserves semantic identity and Projection provenance after the security changes.

### Exact successful provider receipt

Code head `d8877be1a58b2bbf9d71ede0c2ad20d30d50dd58` passed GitHub Actions **Shared field** run `31975770243` (run #94):

```text
test              SUCCESS
spacetimedb-live  SUCCESS

SpaceTimeDB 2.8.1 install/build/publish/codegen       SUCCESS
v3 live authority/privacy/Contact/Explore fixture    SUCCESS
```

The live proof reported:

```text
public Participants                         4
Projection revisions                        2
owner private Watch rows                    1
revoked/finite caller private Watch rows    0
unrelated/finite caller Contact rows        0
```

and denied cross-field mutation, private-content leakage into the public floor, unauthorised Participant creation, semantic-ref spoofing, Projection impersonation, Explore pollution, raw private-table subscriptions, Contact to a non-contactable Participant, recipient impersonation, block bypass, oversize Contact, high-rate Contact, revoked authority and expired authority.

The branch later gained documentation-only provider-conformance records; those do not alter the verified runtime code.

## Next unclosed security fronts

This pass intentionally does not claim closure of #31. Highest-value remaining fronts are:

1. private/audience-scoped SharedField, Participant, Projection and Explore read Views rather than the current public-field floor;
2. Contribution admission quotas and index-ingestion budgets once Contribution is hosted in SpaceTimeDB;
3. A2A Agent Card/endpoint verification and Contact→A2A admission under #24;
4. package/component signing, provenance and rich-code containment across #21/#26;
5. prompt-injection/untrusted-context handling for agent-facing read models;
6. file/rich-content sanitisation and malware handling;
7. deployment-level ingress/connection/resource DoS controls beyond application Contact quotas;
8. secret/material isolation and native process/Wasm containment at host/Workcell boundaries;
9. privacy-minimised security evidence/retention policy and deletion semantics.

The governing test for each later slice remains the same: no containment, mounting, discovery, Projection, federation or package composition silently widens authority.
