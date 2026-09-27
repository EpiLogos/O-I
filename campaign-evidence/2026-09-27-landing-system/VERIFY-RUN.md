# First dogfood receipts — the gate run that proved the law

- Run 1 (tip `98ecb6aa`, `--keep-going`): 16/17 — `rust-format-kernel` FAIL:
  `kernel/tests/native_expression_owner.rs` was not fmt-clean at the landed
  tip. The drift predates the run (it entered with the convergence landing);
  the batch paradigm is exactly what missed it. Fixed and committed.
- Run 2 (tip after the fix): 17/17 PASS — receipt
  `gates/receipts/latest-landing.json`, ~7.5 minutes serialised.
- Run 3: this tier re-runs at the final tip carrying the evidence docs; its
  receipt (latest-landing.json) is the one the pre-push guard checks for the
  landing push.

Total wall for "prove this tip landable": under 8 minutes, zero remote
round-trips. The 2026-09-27 convergence spent ~50 minutes on four CI rounds
discovering what a landing receipt now states up front.
