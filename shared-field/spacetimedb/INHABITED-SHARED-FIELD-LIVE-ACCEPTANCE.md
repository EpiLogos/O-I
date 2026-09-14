# Inhabited shared field — live acceptance (first authored world, two independent worlds, one native Action)

This receipt belongs to O:I #18 (and returns PW5 of #279, the acceptance pressure of #85, and the adapter seam of #13). It records executed evidence at the branch head named in PR #72; every claim here was run against a real SpaceTimeDB 2.8.1 database.

## 1. First real authored world through the actual Projection path

Source: the owner's real Central, read through Central's own Actions (`central.wiki.read`, `projectcentral.wiki.read` for project `O-I`). Selection: root WikiSpace addressable only; the O-I project WikiSpace with its `project-root/o-i` node; public audience; source refs disclosed.

| Fact | Value |
|---|---|
| world_ref | `world:central:project:O-I` |
| projection_ref @ revision | `projection:central:project:O-I@1` |
| source | `central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json` at `central.content-fnv1a64/v1:837:919e0d2d596a7eb6` |
| field_ref | `oi:field:central:project:O-I` |
| hosted database (this run) | `oi-shared-field-lane` on `ws://127.0.0.1:3000` |
| entries | 4 — world, root space (address only), O-I space, project-root node |
| relations | 4 — `wiki.contains` ×2 (origin wiki), `oi.world/wiki-space` ×2 (origin projection) |
| excluded from publication | 2 nodes (identity, staged intent), 14 relations, every sibling project space |
| edition digest (sha256, bytes only) | `0d2fed4ca590ebe8072c22ef1f33f21eeae29e47838698a9e45ae192d12a7bab` |
| sentinels proven absent | identity.md, wiki:node:identity, propose-not-write, Actuation, Workcell, Quaternal, Factory, project:ai-kit, project:Central |

The hosted owner is a SpaceTimeDB transport identity (`c2002d82ef45097e…`), persisted outside the repository; it is not the human's identity. `explore_status.healthy` was `True` when the live Explore application opened the world.

## 2. Two independently grounded worlds

`spacetimedb/two-world-live-acceptance.ts`, run twice on `oi-shared-field-lane`: once with a Central-shaped fixture as World A (sentinel checks on), once with the owner's real readings as World A (`real_readings: True`). World B is always an independent fixture world (`world:acceptance:two-world:mu1pir3n:b`, its own source root `central:source:project:Atelier:ProjectCentral/agents/wiki/wiki.json`), with its own Participant contract and its own transport identity/token.

Lifecycle observed (real-readings run `mu1pir3n`):

1. two distinct transport identities and tokens
2. A published P1 + entries + relations + edition
3. B published its own world into its own field
4. B refused as writer in A's field before any grant
5. B discovered A: search, exact ref resolution, bounded neighbourhood, P1 through the shared Surface
6. B read the hosted edition and verified its manifest digest
7. A registered B's Participant (B's contract, B's identity) and granted contributor authority
8. B contributed; the field quarantined it (received ≠ admitted ≠ indexed)
9. A admitted and indexed B's Contribution under A's server-side authority; attribution and B's source revision preserved
10. A re-projected P2 with the returned difference; source R1 preserved; B observed the lawful new revision
11. revocation enforced server-side (No authority grant for Participant participant:acceptance:tw); public reading unaffected
12. B reconnected with its own token: same identity, P2 observed
13. A lost the service and returned: canonical world unchanged, owner authority intact
14. A withdrew the Projection; B observed the withdrawal; addressability retained, source history untouched

Laws held server-side: discoverable ≠ contactable ≠ writer; received ≠ admitted ≠ indexed; admitted ≠ canonical (source R1 unchanged); transport identity ≠ Participant identity; service loss ≠ canonical loss; withdrawal ≠ erasure.

Identity facts: A `c200489392361821…` ≠ B `c20062e99656e091…`; B's Participant in A's field `participant:acceptance:two-world:mu1pir3n:b-in-a` carries B's source revision; the admitted Contribution `contribution:acceptance:two-world:mu1pir3n:b-reply` (ingress `ingress:4a06ed17d6c95b85…`) is attributed to B after admission; A's Projection went 1 → 2 (published) → 3 (withdrawn) with source revision constant at `central.content-fnv1a64/v1:837:919e0d2d596a7eb6`; A's local publication bundle was byte-identical before and after the hosted return and after service loss.

## 3. One native Action from an authored binding, through its owner

`scripts/native-action-live-acceptance.mjs` authored an `oi.presentation/action/v1` binding on the projected page carrying `central:action:projectcentral.now.return` and `central:action:projectcentral.now.promote`, then:

- refused to invoke an undisclosed Action (`central.day.lifecycle`) — the owner was never reached;
- invoked `central:action:projectcentral.now.return` through `ctrl --json action run` → owner envelope `success`, record `sharedfield-live-acceptance-mu1pmtdk-2026-09-14` in the O-I project's NOW field, attributed to `participant:central:owner`, visible through `projectcentral.now.inspect`;
- represented the owner's envelope as `oi.activity/v1` (`activity:central:projectcentral.now.return:mu1pmtdk`, phase `completed`, result refs ['ProjectCentral/now/agents/sharedfield-live-acceptance-mu1pmtdk-2026-09-14.json', 'sharedfield-live-acceptance-mu1pmtdk-2026-09-14']);
- returned that record into the Agent-maintained wiki with `acceptance: agent-return` → accepted (`returned into the Agent Wiki owner path as a source for Wiki maintenance; wiki.json is not silently rewritten`);
- attempted the same promotion toward human-authored ground with agent acceptance → refused by the owner: `human-ground promotion requires acceptance=human-accepted`.

An earlier run of the same script (before the wiki-return path was corrected) left note `sharedfield-live-acceptance-2026-09-14` in the field; it was resolved through `projectcentral.now.update` as superseded.

## 4. Hosted deployment status

`hosting.json` names the hosted target `epilogos-oi-shared-field` on `maincloud.spacetimedb.com`; `deploy.sh hosted` builds, publishes and regenerates bindings; `HOSTING.md` is the runbook. Publishing from this session was refused by the service: the machine's stored SpaceTimeDB login token is invalid (`401 Unauthorized: Invalid token: InvalidSignature`). Re-establishing that login is the owner's credential action and is the only remaining material step; the runbook's steps 0–5 are the exact handoff. Everything above was executed against the local 2.8.1 server instead, with the same module, the same generated client and the same scripts.

## 5. What this does not claim

The hosted maincloud database is not yet populated; the public site's Explore is not yet pointed at it (repository variables unset on purpose until it is); no second physical machine was exercised — the two worlds ran on one host with distinct source roots, Participants and transport identities, which the contracts require and which a second machine does not change. AIKit's composition body was consumed from a file, not from a CLI producer (EpiLogos/ai-kit#313). Card/Cube, Personal/Work shell and Hen uptake (PW1–PW4, PW6) are untouched.
