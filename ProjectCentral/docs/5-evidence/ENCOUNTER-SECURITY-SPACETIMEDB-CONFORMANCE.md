# O:I Encounter Security — SpaceTimeDB 2.8.1 Provider Conformance

**Issue:** #31 / OI-017  
**Provider:** SpaceTimeDB 2.8.1  
**Verified:** 2026-08-16  
**Implementation:** `shared-field/spacetimedb/src/index.ts`  
**Adversarial harness:** `shared-field/spacetimedb/security-live-acceptance-v3.ts`

This note records provider-specific findings beneath the semantic security grammar in `ENCOUNTER-SECURITY.md`. It is deliberately not constitutional: another hosted-state provider may implement the same O:I security relations differently.

## Accepted provider properties

Current primary documentation and live 2.8.1 behaviour support the following O:I uses:

- reducer `ctx.sender` as the authenticated SpaceTimeDB runtime Identity;
- server-side reducer checks as the mutation-authority boundary;
- private tables for Identity→Participant grants, Watch, Contact, block/mute policy and rate state;
- public caller-filtered Views over private tables;
- generated client bindings which omit private tables and include only public Views/reducers;
- server invocation time through `ctx.timestamp.microsSinceUnixEpoch` for rate windows and expiry checks;
- reducer `SenderError` propagation as a negative conformance surface;
- public application tables only where O:I has explicitly constrained the hosted floor to public material.

SpaceTimeDB Identity remains an implementation/runtime principal:

```text
SpaceTimeDB Identity ≠ O:I Participant ≠ Human/Agent identity
```

A private grant binds the runtime principal to a semantic Participant and field scope; it does not replace that Participant's identity or provenance.

## Public content floor is explicit

The existing PR #19 Explore module began as a public hosted-state proof. OI-017 makes that status executable rather than implicit:

- non-public SharedFields are rejected by the public `shared_field` reducer;
- non-public Projection audiences are rejected by the public `projection` reducer;
- semantic JSON identity/revision fields are checked against indexed table columns;
- Explore entries and relations are field-scoped and owner-written;
- private Watch/Contact state never enters the public Explore snapshot.

O:I therefore does **not** claim private hosted worlds merely because SpaceTimeDB can store private tables. Private/audience-scoped SharedField/Projection/Explore Views remain a later ES1 slice.

## Private relationship-state conformance

The following tables are private and are not generated into ordinary client bindings:

```text
field_owner
field_authority
watch
contact
contact_policy
contact_rate
```

Clients receive relationship state only through:

```text
my_field_authority
my_watch
my_contact
```

The adapters in `shared-field/spacetimedb-watch.mjs` and `shared-field/spacetimedb-contact.mjs` fail closed unless these caller-filtered Views are present; they will not silently consume a raw private-table-shaped handle.

Explicit revocation deletes the Identity→Participant grant. Because the Views depend on that grant, revocation removes the caller's private Watch/Contact visibility as well as reducer authority.

## Timed authority: provider-conformance finding

SpaceTimeDB's current primary documentation describes one-shot schedule tables using:

```ts
ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + delta)
```

and states that scheduled reducers are invoked automatically when the specified time arrives.

That documented mechanism was implemented and exercised against the exact pinned **SpaceTimeDB 2.8.1 local standalone** used by O:I CI. The module built, published and generated bindings successfully, but the scheduled authority-expiry reducer did not execute within repeated 15-second live proof windows for a one-second schedule.

This is recorded as a **provider-conformance failure for this use case**, not as evidence that the documentation is generally false or that other SpaceTimeDB deployments cannot schedule correctly. O:I simply does not rely on a security property which its current provider fixture could not reproduce.

### Fail-closed resolution

Until timed View revocation is proven on the deployed provider, O:I distinguishes two grant classes without adding a new ontology type:

```text
persistent grant (ttlSeconds = 0)
    → reducer authority
    → eligible for caller-filtered private Watch/Contact Views
    → explicit revocation removes both authority and private visibility

finite grant (ttlSeconds > 0)
    → reducer authority only until server-time expiry
    → never exposes private Watch/Contact Views
    → expired reducer calls fail using ctx.timestamp
```

This is intentionally conservative. A finite grant cannot become an indefinitely stale private-read entitlement merely because a timer failed to fire.

A future provider/deployment may restore time-bounded private-read grants once it proves a server-driven expiry/change event which reliably invalidates caller Views. That change is an implementation improvement beneath the same O:I Authority/Boundary grammar.

## Contactability is separate from discoverability

A Participant authority grant contains an explicit `contactable` bit. `request_contact` requires the recipient to have a live grant with `contactable = true`.

Therefore a Participant may remain present in the public semantic field while refusing direct Contact:

```text
discoverable Participant
    + contactable=false
    → Explore/read remains possible
    → Contact reducer rejects initiation
```

This is the executable form of:

```text
discoverable ≠ contactable ≠ contacted ≠ reciprocal ≠ trusted
```

Contact creation also creates no A2A session, Contribution, Projection, trust relation, capability grant or executable authority.

## Current attack/conformance claims

The v3 live fixture is designed to prove with independent SpaceTimeDB identities:

1. raw Watch/Contact/authority subscriptions are denied;
2. a non-owner cannot mutate another SharedField;
3. private SharedField/Projection material is rejected by the current public hosted floor;
4. a non-owner cannot create Participant state in another field;
5. semantic refs cannot be substituted by changing indexed SpaceTimeDB columns;
6. a caller cannot publish as another Participant or overwrite an immutable Projection revision;
7. field-owner-mediated human Projection refinement preserves canonical source revision;
8. non-owners cannot inject Explore index entries;
9. Watch rows are visible only through caller-filtered `my_watch`;
10. unrelated identities receive no Contact graph rows;
11. a discoverable but `contactable=false` Participant rejects Contact server-side;
12. only the recipient Participant can accept/decline/redirect/narrow Contact;
13. mute/block, size limits and per-origin/per-field rate pressure are enforced server-side;
14. explicit authority revocation removes private relation visibility and write authority;
15. finite grants expose no private relation state, may mutate before server-time expiry, and fail mutation after expiry.

The provider-specific implementation remains replaceable. None of these relations grants Root Agency, package, component, Workcell, filesystem, secret, network or Action authority merely because the shared field can resolve the corresponding object.
