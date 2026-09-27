# First dogfood receipts — the gate run that proved the law

- Run 1 (tip `98ecb6aa`, `--keep-going`): 16/17 — `rust-format-kernel` FAIL:
  `kernel/tests/native_expression_owner.rs` was not fmt-clean at the landed
  tip. The drift predates the run (it entered with the convergence landing);
  the batch paradigm is exactly what missed it. Fixed and committed.
- Run 2 (tip after the fix): 17/17 PASS — receipt
  `gates/receipts/latest-landing.json`, ~7.5 minutes serialised.
- Run 3 (tip `2278b771`, the bootstrap-derivation fix): 17/17 PASS — full
  tier, clean tree, ~8.3 minutes serialised, one receipted retry
  (`browser-techne-lens-studio`, load-sensitive). The first attempt of this
  leg failed `cradle-node-suite` in a fresh workcell: the manifest bootstrap
  had dropped two prep steps its own provenance workflow
  (desktop-shell-recovery.yml → wider-suite) runs — the embedded
  expressions-app locked graph (`ensure-expressions-app.mjs --build`) and
  the personal reference carriers (`documents/build-personal.mjs`). Derived
  into the bootstrap and committed; a first-run vite cold start then
  surfaced inside `cradle-appearance`'s 30 s wait, which passes warm. This
  entry is the branch's last commit; latest-landing.json is re-taken at the
  tip carrying it, so the receipt on disk covers exactly the tip the
  pre-push guard will check for the landing push.

Total wall for "prove this tip landable": under 8 minutes, zero remote
round-trips. The 2026-09-27 convergence spent ~50 minutes on four CI rounds
discovering what a landing receipt now states up front.
