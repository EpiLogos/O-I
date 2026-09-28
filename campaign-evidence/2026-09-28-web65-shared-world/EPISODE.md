# web65 shared-world episode — execution ledger

Commission: O-I #65 / #220, web65 obligations
(`docs/experience/shared-field-world-participation.json`), planning basis
O-I #549 (`33bb2e5a`). Lead: agent:claude-code:opus-5.5 on workcell:mac, seat
env-2/o-i, lane `web65/shared-world-participation`.

Evidence grades follow `desktop/cradle/walk/scenario-bindings.json`
(D deterministic, C conformance, P provider, M material, H human). Nothing
here claims H.

## 1. First runtime act — installed Explore entrance

| | |
|---|---|
| Installed | oi `76af402b`; desktop bundle `source_revision 9905eac4` (built in env-3, 2026-09-27) |
| Driven with | cua-driver 0.28 against `org.epilogos.oi.cradle` (pid-scoped click/screenshot) |
| Act | Welcome → rail **Explore** |
| Observed | Explore Surface opens with query `agents`, status `unavailable`: "SharedField client failed (exit status: 1): `<env-3 checkout>`/desktop/cradle/kernel/../../../shared-field/spacetimedb/field.sh: line 7: …/node_modules/.bin/tsx: No such file or directory" ([observation](observations/01-installed-explore-unavailable.png); the local checkout path is redacted in the text and the image) |
| First missing relation | The release kernel resolved its SharedField client through `CARGO_MANIFEST_DIR` into the checkout it was compiled in; the GUI process also had no `OI_SHARED_FIELD_TARGET`. The installed app carried no client and no binding. |
| Same defect on Omarchy | no desktop installed; its checkout's `field.sh` fails (`module_bindings/` generated-only, no `spacetime` CLI) |
| Repair | `a77e0891` — bundled client resource `shared-field/` (field + A2A runner + hosting.json + node-finding launcher), kernel order explicit → bundled → development-only checkout, machine binding `OI_STATE_HOME/shared-field/binding.json` (`bind`/`unbind`) |
| Owner verification | kernel `cargo test --lib shared_field` 9/9 (3 new: resolution order, launcher-less resource refused, missing client Unavailable with reason); bundled client reads hosted `epilogos-oi-shared-field` from Mac and from Omarchy under a bare `PATH` (distinct transport identities `c200cd…` / `c2003b…`) |
| Replay | pending: rebuilt bundle → `oi desktop install` → same Explore act |

## 2. Matrix anchors (C0)

`5de143e2`: bindings carry typed `obligation_id`/`branch` (0-based) validated
against the obligation modules; `--matrix` is owner-checked; O:I's ledger is
read through `--matrix-slice`. Reviewed batch in [c0/bindings.json](c0/bindings.json):
31 bindings, WORLD/EXPLORE/RESOLVE, all 9 branches bound, over Central
`8918a3b`, ai-kit `1a426e42` (telos matrix), Factory `6a24587`, Workcell
`c6a55af`, Actuation `8ad34cb`, QL-MEF `bea2eba`, O:I `33bb2e5a`. Owner
packets: [c0/packets.json](c0/packets.json). Experience suite 94/94.

## 3. A — World A shared (web65:WORLD)

| | |
|---|---|
| Selection | [world-a/selection.json](world-a/selection.json) — O-I world; workcell:mac (address); Aletheia-5 in occupancy with its 17 practices (3 skills, 14 methods) inspectable; @oi address; wiki spaces/node; Factory run `run:01M3FNY3P0E4H7JGN0BARSRQ8R` |
| Native reads | `machine.declaration`, `workcell discover`, `oi agent participation` (`oi.agent-world-participation/v1`), `factory development run` (`factory.run-reading/v1`), `central.position.list`, `aikit gateway who` |
| Publication | `projection:central:project:O-I@2` on hosted `epilogos-oi-shared-field` (revision 1 of 2026-09-14 kept as lineage), source `oi.world-sources/v1:4222ef77eb6a5f7a`, 25 entries / 26 relations, leak scan clean |
| Independent readback | Omarchy, World B transport `c2003b57…`: same 25/26; `workcell:mac@workcell:a936b0740f80389d`, `skill/ql/darshana@f3d55f2f…` resolve with native provenance |
| Not offered | no Workcell offer is read-only (the workspace offer is writable); the agent card declares `public_basis: none-declared` — so nothing is offered, everything is inspectable only |
| Absent natively | constellations (no constructive frame in the O-I register; no `wiki-construct list`), run → Position participants, public run purpose |

## 4. Explore on installed software (web65:EXPLORE)

| Step | Installed | Observed | Result |
|---|---|---|---|
| Replay of §1 (rail → Explore) | `273c1b1e` | status **hosted**, World A graph ([02](observations/02-installed-explore-hosted-world-a.png)) | repaired |
| Search "aletheia" | `273c1b1e` | Position (occupied, gen #2, workcell:mac) then 17 practices with revisions ([03](observations/03-installed-explore-search-aletheia.png)); macOS autocorrect popped "Althea" | autocorrect off in `168ccffe` |
| Search "agents" | `273c1b1e` | nothing, in a field of Agents | kind words in `168ccffe` |
| Select the Position | `273c1b1e` | the whole World page stood in for the Agent ([04](observations/04-position-opens-world-page.png)); typed relations correct in Relations depth | Being/Thing encounter `168ccffe` |
| Relaunch | `168ccffe` | Explore restored the prior selection and Relations depth | ✓ |
| Position → Being | `168ccffe` | handle, role, agent, occupancy, carried-by, practises ([05](observations/05-installed-agent-being-page.png)) | ✓; each related subject listed twice → deduped (next build) |
| → Workcell mac | `168ccffe` | Thing: material role, "nothing offered — inspectable only", carries Aletheia ([06](observations/06-installed-workcell-thing-page.png)) | ✓ |
| Back → darshana | `168ccffe` | Skill Thing: `skill/ql/darshana`, full source revision, owner ai-kit, "Granted use: none — publication is not permission" ([07](observations/07-installed-practice-thing-page.png)) | ✓; no adopt/adapt action yet (RETURN) |

Still open: the window reopens at a ~125×184 frame and needs Window ▸ Zoom;
`oi desktop install` has no in-place upgrade (remove + install used,
receipted); narrow layout and reduced-motion not yet walked.

## 5. B — discover and enter from World B (Omarchy)

World B is an independently authorised test World on workcell:omarchy:
its own transport identity (`c2003b57…`, state home separate from the
Mac's), its own AIKit home, Participant `participant:world-b:omarchy:a04-mask`.
A third identity on Omarchy (`c200f11b…`) is the control.

| | World B | third identity |
|---|---|---|
| public World A | 25 entries / 26 relations | 25 / 26 |
| private undertaking `oi:field:central:project:O-I:undertaking:a04-mask` (after grant-read) | fields 2, projections 4 (+FieldNow r1), entries 35 | fields 1, projections 1, no undertaking entries, relations or counts |

Repairs this step needed, each followed by replay: `ed6a2c5b` (wiki space
membership from either side), `ee2dc13e` (re-projection keeps an audience
change), region qualification after the hosted module refused one entry in
two fields (`publish` is not atomic across reducers — orphaned r1 withdrawn
with its reason).

## 6. C — World B joins with its own Agent and does useful work

| | |
|---|---|
| Undertaking NOW | `central:now:project:O-I:e4b628b8…` (child of the workcell:mac root NOW), projected as FieldNow r1 of the private field |
| Shared sources | A04 @`4d3e93cce1d87aa1`, A04′ @`d3a083e0ed98c235` via `projectcentral.wiki.source.read` (EpiLogos/Central#234) → curated artifacts `ebfbe859` |
| Prepared context | `participant-context.mjs` from B's own transport only (purpose, 2 sources × 7 sections, 8 constituents, contribution law; no verifier expectations) |
| Body | Claude Code on Omarchy, GLM Coding Plan route, served model `glm-5.3-flash`, session `fe893569…`, 16 turns ([task](world-b/run-1-TASK.md)) |
| Work | 718-word source-grounded account of A04′ ↔ A04 and the relation `A04′ —re-sites→ A04` (full text kept in the undertaking's NOW T destination, not in this public repository — the sources are team-visible) |
| Submission | two Contributions through B's transport, basis-pinned, agency = the Agent + session ([receipts](world-b/run-1-submission.json)) → quarantined |

## 7. E — review, native Return, reprojection

| | |
|---|---|
| Review (World A Agent) | every genuine quotation verbatim in the revisioned sources; one paraphrase quoted as source corrected ("disclosure of the viewer" → "… situated viewer" [A04 #0]) |
| Admission | both admitted into the private audience with the review as evidence; B's own receipts read `admitted` |
| Native Return | `aikit wiki maintenance` (CAS + readback) upserted `wiki:node:contemplation/a04p-re-sites-a04-2026-09-28` and edges `A04′ —re-sites→ A04`, `—explains→` both, origin `inferred`, provenance = corpus revisions + Contribution refs + contributor/Agent/session + review standing (agent-reviewed; human recognition pending) |
| Owner defect found | Central's wiki reading carried no WikiEdges at all (3,711 `references` + typed edges invisible) → `knowledge_edges` (EpiLogos/Central#234, `bffa9f6`), O:I projects them between selected nodes (`4c1f69de`) |
| Reprojection | region r4: refinement node + `wiki.edge/re-sites` (edge_origin_ref = the admitted Contribution) + `explains` + authored `references`; World B reads it |

## 8. E — practice adoption and fresh-body uptake

| | |
|---|---|
| Offer | region r5 offers `skill/ql/darshana` to the undertaking audience only; body `sha256:6072bc7c…` published only because AIKit's capsule revision `f3d55f2f…` was recomputed and matched |
| Adoption (World B) | `adopt-practice.mjs` into World B's own AIKit home: source `adopted-darshana-f3d55f2f9ec7`, original identity/revision/Projection r5 retained, World B adaptation as an AIKit overlay under `local_differences` ([record](world-b/adoption.json)); root spellings repaired for World B's older AIKit (`695544d3`) |
| Fresh body | new session `8b8c0d0c…` bound to the AIKit generation projection (`--add-dir`, AIKit's own Claude binding) on the related input A05 ↔ A05′ (shared in region r6) ([task](world-b/run-2-TASK.md)) |
| Uptake observed | the session invoked `Skill(darshana)`, applied World B's adaptation as its reading discipline, looked for the uncarried `darshana.py` and applied the practice as method; used the accepted A04 work as its pattern and relation vocabulary; proposed `A05′ —re-sites→ A05` with its own qualifications (784 words) → two new Contributions quarantined ([receipts](world-b/run-2-submission.json)) |
| Owner gap now built | payload scripts did not travel → `aikit praxis read` / `skill export` / `source add-capsule` preserving revision, mode and upstream provenance (EpiLogos/ai-kit#455) |

## 9. D — activity liveness, frozen edition, replay (web65:ACTIVITY)

| | |
|---|---|
| Before | World A's activity entry said `liveness: live` — a publication-time claim the renderer displayed as fact |
| Native repair | `d1aaf3ef`: hosted `activity_liveness` held by an owner-side producer over one persistent connection (reads the run through `factory development run`), cleared on SIGTERM and by the connection-scoped disconnect lifecycle; `activityReading` = live / stale / disconnected / static with its basis; frozen `oi.activity-edition/v1` replays as render steps with no effect path; desktop reads it (`2f082b58`) |
| Non-production proof | frank-acceptance live acceptance: disconnected → live (owner state/revision = Factory) → stale at 120 s → disconnected after SIGTERM and after kill -9 (52 ms); six server refusals; edition replay 4 steps, 0 effect calls |
| Production proof | hosted module deployed (additive); producer for `run:01M3FNY3P0E4H7JGN0BARSRQ8R` → World B reads `live`, owner state `seeded`, revision 6 (the run's current revision, not the publication's), heartbeat 3 s; `kill -9` → World B reads `disconnected` (0 rows, basis publication) |
| Left running | the producer on workcell:mac (`~/.local/state/oi/web65/activity-producer.pid`, log beside it); stop with `kill $(cat …pid)` — it clears its row |
| Honest limit | Factory's run reading has no event list or timestamps, so replay is lifecycle + node states + execution statuses in reading order, labelled as not a time sequence |

## 10. PARTICIPATE — durable Position route vs exact instance (installed)

EpiLogos/ai-kit#454 merged (`03a5c1db`) after an independent review whose
findings (older-gateway binding loss; relay-pass abort) were fixed with
tests that fail without the fixes. Installed on workcell:mac through the
managed updater's integration-lead path (`oi update --apply --candidate
ai-kit=main ai-kit` → `aikit 0.1.0 (03a5c1db8f88)`), without moving any
checkout's branch.

| Probe (installed) | Result |
|---|---|
| New CLI, gateway service still the old binary (`protocol.features = []`) | `send --instance …` refused `gateway.exact_instance_unsupported` — "Nothing was handed to it" |
| Gateway restarted (`launchctl kickstart -k gui/$UID/ai.aikit.gateway`) | `protocol.features = ["communique-exact-instance"]` |
| Exact → Aletheia-5 generation `actuation:generation:73ecbe3e…` on workcell:mac | `pending` for that instance |
| Exact → a generation Actuation never issued | `held: instance-absent` |
| Exact → right generation, required workcell:omarchy | `held: workcell-mismatch` |
| Durable Position route → @aletheia-5 | `pending` for whoever occupies it |

Successor and same-named-peer refusal across two gateways is proved by the
PR's real-binary integration tests; the two-machine replay needs Omarchy's
gateway on the same build (next).

## 11. CONTINUITY probes on the hosted field

| Probe | Result |
|---|---|
| `revoke-read` World B on the private undertaking | B: fields 2→1, projections 6→1, entries 42→25, relations 59→26, FieldNow 1→0 — public world intact |
| `grant-read` again | B back to 2 / 6 / 42 / 59 / 1 exactly |
| Changed payload under an existing contribution ref + message id | refused: "Contribution transport replay key conflicts…" |
| Exact resend (same message id) and late resend (new message id) of an admitted contribution | both return the same ingress `3a5cad37…`, state `admitted`; contributions stay 4 (one extra per-delivery receipt row) |
| Producer hard-killed (§9) | liveness degrades to `disconnected` for B |
| Source offline for B | B reads the hosted field directly from maincloud; nothing on the Mac is on B's read path |
| Fresh body re-entry (§8) | a new session continued from the field alone and produced accepted work |
| Relaunch/reinstall of the installed desktop | Explore restored its last subject and depth exactly |

## 12. Two machines on the same AIKit

| | |
|---|---|
| Installs | ai-kit `eeaab031` (#454 + #455) on both machines via `oi update --apply --candidate ai-kit=main ai-kit` (Omarchy needed `~/.cargo/bin` on the non-interactive PATH — the updater said so); Central `9b17daca` on the Mac the same way; both gateways restarted and advertise `communique-exact-instance` |
| Omarchy → Aletheia-5 (exact, required workcell:mac) | `held: instance-absent`, basis "this Workcell's Actuation never knew … could not ask workcell:mac (read gateway upgrade status: Resource temporarily unavailable); held" — no substitution |
| Omarchy → Aletheia-5 (durable) | held with `unanswered: workcell:mac` |
| Cause | TCP to the Mac gateway opens but the WebSocket upgrade is never answered: the macOS application firewall queues inbound connections to the newly installed ad-hoc-signed `aikit` (the allowance is keyed to the content-addressed binary path and lapses on every update) |
| Owner action | allow `…/Application Support/OI/products/ai-kit/<eeaab031 hash>/bin/aikit` for incoming connections, or front the gateway with a stable path (Tailscale serve to loopback / a stable signing identity). Mac → Omarchy is unaffected. |

## 13. Independent review of the lane, hardening, republication

An independent read-only review of EpiLogos/O-I#550 found two medium and
five low defects; all were fixed with tests that fail without the fix
(`b8a213df`…`139e484f`, `a339db28`, `cc3dac33`, `78cba60a`, `440be931`,
`e80ce038`), proved live on `frank-acceptance`, then deployed to `hosted`:

- a contributor could overwrite the owner's activity-liveness row and probe
  private entries → only the row's own producer (or the owner) may write it;
  invisible and absent entries return the same refusal;
- constituent entries (Workcell, practice + capsule, activity) ignored the
  Projection audience → every World-publication entry names its Projection
  and is served to that Projection's audience;
- capsule leak scan: full local-path set, base64 files decoded and scanned;
- release A2A runner never resolves a relative path; participant context
  bases a contribution only on this field's Projection; knowledge-edge
  provenance carries no foreign refs; a local path redacted from this ledger
  and its first screenshot.

Republished on the hardened module: World A r3, undertaking region r8,
artifacts A04/A04′/A05/A05′ r2. After republication: owner 42 entries /
59 relations; World B identical, including the offered capsule and the
activity liveness row; the ungranted identity sees only the public world.
Remaining: curated-artifact entries still carry no `projection_ref` (their
Projection's subject is the artifact, which the module's lineage rule does
not yet cover); their audience currently equals the field's read grants.
