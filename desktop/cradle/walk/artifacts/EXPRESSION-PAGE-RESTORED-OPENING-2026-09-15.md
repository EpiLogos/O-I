# Restored page Expression after opening

Executed 2026-09-15, 15:28 UTC. **25/25 real-kernel browser checks passed.**

## Basis and replay

- Accepted O:I base: `0df0680cedaa4455069d1150510480f43fe159f4`.
- Repository HEAD observed by the walk: `4032740d6bcb16d09a2d9f253fbde2cca9a20f78`.
- Native engine intake: `91db8428fc9dfba06cd258ec5a58e7dd9eef5313`, the current-main candidate in [Point-Cloud-Demo #5](https://github.com/EpiLogos/Point-Cloud-Demo/pull/5).
- Scenario commit after reconciliation: `492c29c9` (`test(personal): verify restored page field after opening`).
- Built `dist/index.html` SHA256: `d687ba8884baedfee61c8f65fb23a4398ba56a43f19aaadaa034e3319d1cb01e`.
- `src/personal/PageExpression.tsx` SHA256: `532b2f29c7cad7c0a1a6edc8f59adac400e79b91509b7da78f81275862587fad`.
- `walk/scenarios/expression-page.mjs` SHA256: `77702c14aaa2eea2f005e9e4c48e4fb9f46c4f617180e9beeca0423f3ddb53f7`.

The WALK build was held unchanged for this run. The final HEAD's Explore-only change was not in that build; it does not affect this page scenario. Concurrent Welcome test-source edits were also outside the served build. Source and bundle hashes above were unchanged when the walk finished.

From `desktop/cradle`:

```sh
WALK_URL=http://127.0.0.1:4321 \
WALK_BRIDGE_PORT=4330 \
OI_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
CARGO_TARGET_DIR=/Users/admin/Central/Work/O-I/desktop/cradle/kernel/target \
CARGO_INCREMENTAL=0 \
OI_CENTRAL_CTRL_BIN=/Users/admin/.local/bin/ctrl \
OI_AIKIT_BIN=/Users/admin/.cargo/bin/aikit \
node walk/run.mjs expression-page
```

The runner launched the actual Rust kernel bridge, Chrome and a 1280×820 browser context. The scenario provisioned a fresh temporary Central project and isolated OI_HOME, used real native Expression operations and an authored HTML page, then removed its own temporary state. Browser and bridge closed after the run.

## Returned behavior

The already-open real page was restored through a fresh opening. While the opening owned the field, the page host remained mounted beneath the inert, hidden-from-accessibility workspace. Its controls were disabled, its authored iframe fallback stayed visible, and it had no sticky error or inline renderer. Exactly one healthy production canvas existed.

After entry, the **same held canvas and WebGL context** moved into the page's real inline container, fitted that container and remained healthy. Its identity stayed `expression:page-ada`, revision `4`, subject `central:being:ada`. The fallback hid only after readiness. Focus and Escape moved the same canvas to the dialog and back inline.

The existing owner-backed checks also passed: exact live-lease admission; forged-message refusal; standalone fallback; draft-edit lease revocation without source mutation; exact reread; unrelated-event continuity; nonuniform native PNG capture; stale-revision refusal; capture fallback; and exact new-revision re-entry. No assertions or native semantics were weakened.

## Evidence and limits

- [Machine receipt with all 25 assertions and native operations](expression-page.json)
- [Execution log](expression-page-restored-opening.log)
- [Restored inline page after focus/return](expression-page-restored-opening-inline.png)
- Existing capture, unavailable fallback and re-entry screenshots are listed in the machine receipt.

This verifies the actual page-body restore and admission boundary on the stated build at one desktop width. It is not a timing benchmark, a complete responsive or accessibility audit, proof of every restored surface, or human experience acceptance of O:I #65. The separate engine/host hardware measurements retain their earlier recorded build basis.
