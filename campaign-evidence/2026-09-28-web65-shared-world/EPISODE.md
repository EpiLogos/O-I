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
| Observed | Explore Surface opens with query `agents`, status `unavailable`: "SharedField client failed (exit status: 1): /Users/admin/Central/worktrees/env-3/o-i/desktop/cradle/kernel/../../../shared-field/spacetimedb/field.sh: line 7: …/node_modules/.bin/tsx: No such file or directory" ([observation](observations/01-installed-explore-unavailable.png)) |
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
