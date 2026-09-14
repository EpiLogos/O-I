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

Published on 2026-09-14 after the owner re-established the machine's SpaceTimeDB login (the earlier attempt from the same scripts was refused with `401 Invalid token`):

| Fact | Value |
|---|---|
| production field | `epilogos-oi-shared-field` on `wss://maincloud.spacetimedb.com` |
| module identity | `c20052b78a87b72e63b6d18aeb7601ed2237487bbe10d245be782a910eeaef92` |
| projection | `projection:central:project:O-I@1` from `central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json` @ `central.content-fnv1a64/v1:837:919e0d2d596a7eb6` |
| entries / relations | 4 / 4 |
| edition digest | `a40ec33ee50fcb5b0447e217bd8cc7c57f16215d8f73ccd8cdd63f2d6fa983fa` |
| owner transport identity | `c200cd0697d17ff4…` (token outside the repository; not a human identity) |
| acceptance field | `epilogos-oi-shared-field-acceptance` (deploy target `hosted-acceptance`) |
| two-world acceptance on the hosted acceptance field | run `mu1q3ba8`, World A from the owner's real readings, 14 lifecycle steps green |
| site build | repository variables `OI_SPACETIMEDB_URI` / `OI_SPACETIMEDB_DATABASE` set; `explore.html` connects to the production field |

The production field was wiped and republished once after the first acceptance run had left its withdrawn run-scoped worlds in it; live acceptance now runs only against the acceptance field. `deploy.sh` resolved `hosting.json` relative to the caller's directory and failed under `npm run`; fixed in this line.

## 5. What this does not claim

GitHub Pages is not enabled on the repository, so the built Explore page is not yet served publicly (every `site.yml` run on main has failed at `configure-pages` since 21 August; a repository setting for the owner); no second physical machine was exercised — the two worlds ran on one host with distinct source roots, Participants and transport identities, which the contracts require and which a second machine does not change. AIKit's composition body was consumed from a file, not from a CLI producer (EpiLogos/ai-kit#313). Card/Cube, Personal/Work shell and Hen uptake (PW1–PW4, PW6) are untouched.
