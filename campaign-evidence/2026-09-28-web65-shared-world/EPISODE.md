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
