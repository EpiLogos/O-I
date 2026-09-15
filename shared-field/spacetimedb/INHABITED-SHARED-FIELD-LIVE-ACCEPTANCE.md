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

---

## 6. The self-hosted field on the second machine (Lane C step 1; 2026-09-14/15)

The tranche's target host is the owner's second machine `frank` (Linux/Omarchy, the Workcell specimen, tailnet `100.92.62.101`), not maincloud. Commissioned over SSH from the primary workstation; every fact below was read back from the host.

| Fact | Value |
|---|---|
| server | `spacetimedb-standalone` 2.8.1 from the pinned release tarball, `~/.local/share/spacetime/bin/2.8.1/` |
| unit | `~/.config/systemd/user/oi-shared-field.service` (target-owned; `Restart=on-failure`; `ExecStartPost` readiness probe on `/v1/ping`; no `BindsTo`); user lingering enabled |
| listen address | `100.92.62.101:3000` only — the LAN address refuses (`curl 192.168.4.90:3000` → connection refused) |
| data / keys | `~/.local/state/workcell/shared-field/spacetimedb/data`; ES256 PKCS#8 keys under `…/keys/` (0600) |
| Workcell declaration | `oi-shared-field` and `oi-shared-field-site`, lifetime `target-owned`, status probe `systemctl --user is-active --quiet <unit>`, in `~/.local/state/workcell/smoke/services.json` |
| module identities | `oi-shared-field` → `c200c9684c1275a6a46e3729d0b3370e1d13f6a260319fc6387c6003f9c9a622`; `oi-shared-field-acceptance` → `c20066076ce1f6a10e27fc2e2f6d0616b81596375af74db88ea4161f32b6e413` |
| pre-live snapshot | `snapshots/spacetimedb-data-20260914T212944-pre-live.tar.gz` (sha256 `caab1095…`), taken with the unit stopped, before any world was pushed |
| Explore on the host | `oi-shared-field-site.service` serving the built `site/dist` and `/projections/<slug>/` on `100.92.62.101:4180` |
| CLI binding on the primary | `spacetime server add --url http://100.92.62.101:3000 frank` (fingerprint recorded); `hosting.json` targets `frank`, `frank-acceptance` |

## 7. The real world and two real artifacts on the host (steps 3 and 4)

**Wiki world (step 3).** `publish-world.mjs --from-ctrl` against the owner's Central, selection as in `WORLD-PUBLICATION.md` (root WikiSpace addressable, O-I space + `project-root/o-i`), nine sentinels, edition base on the host; pushed as `projection:central:project:O-I@1` from `central:source:project:O-I:ProjectCentral/agents/wiki/wiki.json` @ `central.content-fnv1a64/v1:837:919e0d2d596a7eb6` (4 entries, 4 relations; excluded 2 nodes, 14 relations; edition digest `a81fa0a9…`). Owner transport identity on this server `c2005d75ac2e2ff0…`. The ref `world:central:project:O-I` opens in a real Chromium against the host's Explore over the tailnet (Playwright; the desktop app's own preview pane cannot reach port 3000 and is not evidence).

The selection's durable home is `Work/O-I/ProjectCentral/user/publication/o-i.selection.json`; it does not exist there yet and this session did not write human ground — proposed in the session's NOW return.

**Curated HTML artifact (step 4).** `shared-field/curated-html-projection.mjs` + `scripts/publish-artifact.mjs`. Two real carriers were projected through the same seam:

| | Flow instance (ql-doc carrier) | Central document (kind flow, root register) |
|---|---|---|
| source | `Control/user/flows/flow-2026-09-14-2236.html`, written through `central.files.write` as `agent:claude-fable-5.1:lane-c` (a specimen; the owner may replace it), revision `central.content-fnv1a64/v1:45939:deae7744ca48657b` | `central.document.create` at the root register (the owner's grant covers `control:root`, not `project:O-I`): `central:source:control:root:Control/agents/now/flows/8908da97…7b70.json`, `doc:shared-field-artifact-2026-09-14`, revision `…:1097:fe7adf00a0e60d32` |
| selected | 3 of 3 entries; meta title/created/template/revision | the 2 authored fields |
| withheld | 1 journal page, 1 packet item, 1 note (planted sentinels), 4 private meta fields | contributions, operations, lifecycle/creation digest |
| hosted ref | `world:central:project:O-I/artifact:central:flow:09f8cdd4-ab1d-4fe4-b6aa-bde0d8a055fc` (`projection:central:artifact:flow-2026-09-14-2236@1`, row 2) | `world:central:project:O-I/artifact:central:document:doc:shared-field-artifact-2026-09-14` (`…native-document-2026-09-14@1`, row 3) |
| relation to the Wiki | `node-source` from `world:central:project:O-I/wiki:node:project-root/o-i`, origin `projection` (declared by the owner's selection: no Wiki node lists the Flow among its sources, so the reading cannot attest it) | same |
| edition | rebuilt from the Projection only (CSP `default-src 'none'`; one `<script>` = the embedded Projection JSON; no `ql-doc` block), digest `5831d23e…` | digest `a33ffad7…` |
| sentinels | `PRIVATE_SENTINEL`, `id="ql-doc"`, `journalCurrent`, `identity.md`, `wiki:node:identity` absent from bundle, reducer args, edition HTML, embedded JSON, manifest and the Explore index (7/7 unit tests + the publication's own refusal path) | same |

Both refs open on the host's Explore with their world and node-source relations (Playwright, 0 console errors).

## 8. The lived two-world circuit with a real second world (steps 6 and 7; wayfinder §6 steps 1–9)

World B is the owner's *other* Central on `frank` (`/home/frank/Central`, root reading revision `central.content-fnv1a64/v1:280:36d199b6666c9bd9`, O-I project reading `…:861:c94015435f6d17eb`, its own ref spelling `central:wiki:project:project:o-i`). B ran `lived-circuit.ts` **on frank** under its own transport token (`world-b`, identity `c2005b0729f8345b0ca818c602122d5c2d970568e2609ddaa3e64a5f328ad78a`); A ran the field client and Central's Actions on the primary. Receipts: `b-discover.json`, `b-engage.json`, `b-observe.json`, `b-read-while-a-offline.json` (kept on the host under `~/.local/state/workcell/shared-field/lane-c/receipts/`).

| # | wayfinder §6 | ran on | what happened |
|---|---|---|---|
| 1 | author/open a real object | primary | the Flow instance and the native document above |
| 2 | project only the selection | primary | §7 |
| 3 | discover/open from a second identity | frank | B found `world:central:project:O-I` by search, resolved the artifact by exact ref, opened the bounded neighbourhood (6 refs, no sentinel), read the served edition and verified its digest; 0 grants before A acted |
| 4 | inspect provenance / bounded relations | frank | projection `…flow-2026-09-14-2236@1`, source revision `…45939:deae7744…`, publisher `participant:central:owner`, standing `human-authored`, node-source origin `projection` |
| 5 | Contact / Watch under explicit authority | both | A registered `participant:central:project:O-I:world-b:frank` bound to B's identity with B's own contract/provenance (role contributor, contactable); B requested Contact `contact:world-b:lived-2026-09-15` and put Watch `watch:world-b:lived-2026-09-15:artifact` (target kind `object`); A accepted the Contact |
| 6 | contribute | frank | `contribution:world-b:lived-2026-09-15:reply` (mode reply → the artifact Projection) quarantined as `ingress:2538eb648bc752dc`; received ≠ admitted ≠ indexed held; B's forged index write refused |
| 7 | Agent through the Gateway | — | not exercised (see §10) |
| 8 | return through the native owner | primary | A admitted and indexed server-side (attribution and B's source revision preserved). **Artifact:** `central.receiving.submit` against the native document → `central:return:control:root:30c477a8…` `pending` with the shared-field lineage in the proposal; review/include are the owner's (human) acts and were left to the owner. The same submit against the Flow instance is refused (`SourceRef is not in this World`) — routed to Central as EpiLogos/Central#180. **Wiki knowledge:** `projectcentral.now.return` (learning `shared-field-a-second-world-read-2026-09-15`) then `projectcentral.now.promote` → agent-wiki accepted; the same promotion toward human ground with agent acceptance refused |
| 9 | observe the new revision, reproject | both | A re-projected P2 with a `replies` region (refinement; source revision constant; `supersedes` P1; row 4); B observed P2, its admitted reply in the public view and in search, contact `accepted`, watch `active` |
| 10 | same refs through desktop/web, reconnect, restart | — | web + restart: §9; desktop: the Lane C step 5 unit (see the ledger row / PR) |
| 11 | Bimba/QL and Nara/Personal representations | — | §10 |

Attribution caveat: the receiving submit carried the owner's credential (`principal_ref central:source:control:root:Control/user/identity`); B's authorship travels in the proposal's `shared_field` block, not as the Return's author. A receiving grant for the SharedField receiver (an agent principal) is the owner's authority decision — proposed in the NOW return.

The deterministic floor also ran on the host: `two-world-live-acceptance.ts` against `oi-shared-field-acceptance` with the owner's real readings as World A — run `mu200dlq`, 14 lifecycle steps, six laws held.

## 9. Host-layer resilience on the second machine (step 8)

| exercise | evidence |
|---|---|
| unit restart | PID `1426646 → 1426732`, `active`; field unchanged (1 field, 2 participants, 3 projections, 7 entries, 9 relations) |
| snapshot | `spacetimedb-data-20260915T013833-post-live.tar.gz` (sha256 `7e0fca92…`), unit stopped during the copy |
| restore | stop → `data` moved aside (`data.before-restore-20260915T013833`, kept) → untar → start: field unchanged; B's identity, watch and contact intact; the pre-live snapshot is retained separately |
| network loss | `tailscale down` on the primary: A's field calls refused as `unavailable`; a read scheduled on the host as B during the window returned the full field, `healthy: true`; `tailscale up` → A reads again |
| A offline | published material continued to serve from the host while the primary was off the tailnet; source updates that need A (re-projection, Central Return) did not continue elsewhere — by placement, not by accident |
| not exercised | relocation to another host; a host reboot (lingering is enabled but was not tested) |

The acceptance database stayed separate from the retained field throughout.

## 10. Not done, and why

- **Step 9 (Agent Participant through the Gateway):** the gateway crate is on Actuation `main` (squash `ff863c7`, PR #82; `ece2478` itself is reachable only on `act-rust/r12-staged-loop`, and `main`'s linear-history rule refuses a merge commit — Actuation PR #86 was opened by this session and closed as an empty diff). The AIKit ecology join named in O-I #154 is still open, and the resident gateway on `frank` runs the smoke policy. No Agent Participant was created; local Agency communication needed no SharedField publication.
- **Step 10 (Nara/Personal representation):** the installed `ql` CLI (0.1.0) exposes kernel/matheme/MEF/Vāk/service commands and no reading of a selected Nara/Personal representation; QL-MEF's K10 return (#134) is at repository scope. O:I defines only the audience relation; the subject and its standing are QL-MEF's to produce (a source-owned reading with raw identity/journal/activity/body/bioquaternion state absent). Dependency recorded, nothing faked.
- **Owner-visible ingress:** the module exposes no view of quarantined ingress to the field owner; A learned the ingress ref from B's receipt. A `my_field_ingress` view (owner-side) is a #18 follow-up.
- **`projectcentral.now.promote` destination:** the accepted promotion landed at `ProjectCentral/agents/wiki/returns/ProjectCentral/agents/wiki/returns/…` — the action prefixes `returns/` itself; pass a bare filename. Central quirk, recorded.
