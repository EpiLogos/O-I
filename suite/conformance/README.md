# C7 conformance harness — configuration plane

The lane-C7 deliverable of the Configuration Plane Wayfinder (#299 §22):
the fourteen required cross-surface / cross-owner tests as executable
specifications, plus the fixture product-owner stub that lets them run
end-to-end today. The frozen contract
(`docs/cradle/09-CONFIGURATION-PLANE.md`) and the frozen fixtures
(`suite/configuration/`) are consumed here, never re-decided.

## What lives here

```text
src/bin/config-owner-stub.rs   the fixture product owner: an honest, independent
                               implementation of the frozen owner surface
                               (09 §4 discovery, §6 transport, §9 receipts and
                               idempotency, 07 v2 disclosure) over a sandboxed
                               file store. Deliberately does not link `oi-cli`,
                               so two independent implementations of the frozen
                               grammar can be cross-checked.
tests/configuration_conformance.rs   the fourteen required tests (#299 §22),
                               driven as real subprocesses through the frozen
                               transport, with every law check carried by the
                               frozen `oi_cli::configuration` types.
src/bin/conformance_report.rs  the status table: which required tests ran and
                               held, which surface legs await binding, and the
                               whole-artifact redaction sweep.
src/lib.rs                     the harness library: stub driver, verdict
                               records, plan-digest verification, redaction
                               sweep, reconciliation helpers.
```

The crate is a member of the `cli` workspace so one target directory serves
both suites.

## How to run

```text
# the fourteen required tests (#299 §22)
cargo test --manifest-path suite/conformance/Cargo.toml --test configuration_conformance

# the status table + whole-artifact redaction sweep (run right after)
cargo run  --manifest-path suite/conformance/Cargo.toml --bin config-conformance-report

# the Gate-A contract suite (no regression)
cargo test --manifest-path cli/Cargo.toml --test configuration_contracts
```

Every artifact the suite writes lives under `cli/target/tmp/conformance/`,
one `runs/<pid>` directory per suite run; nothing lands in the source tree.

## How the verdicts work

Each test records a verdict:

- `passed` — every executable leg of the required test ran and held. Pending
  binding legs (surfaces that have not converged) are listed but were never
  claimed as run.
- `partial` — a material part of the test's own executable scope could not
  run today (test 9: the CLI/Desktop surfaces do not exist yet; test 10: the
  O:I Agent surface; test 13: C4's connector fixture executable is not on
  this base).
- missing — the test failed or crashed and wrote no verdict; the report
  exits non-zero.

Per the conformance law: an environment-gated leg that did not run leaves
its acceptance requirement open — it is never counted as a pass, and nothing
is faked. Binding points are named by lane (C1 kernel, C2 profiles, C3 owner
lanes, C4 connector executable, C5 `oi config`/`oi profile`, C6 Desktop);
when a lane lands, its leg binds into this suite instead of being
re-implemented.

## Status at this branch

| # | required test | status |
|---|---|---|
| 1 | ordinary-setting propagation | passed — surfaces C1/C5/C6/Agent pending binding |
| 2 | native-first edit | passed — O:I observer leg pending C1 |
| 3 | O:I-routed edit | passed — ChangeSet engine C1, CLI C5 pending binding |
| 4 | profile switch | passed — profile engine C2 + connector op C4 pending binding |
| 5 | scope | partial — connector-relation case ran at contract level only (C4) |
| 6 | secrets | passed — CLI/Desktop presence rendering pending binding (C5/C6) |
| 7 | partial multi-owner apply | passed — kernel orchestrator C1 pending binding |
| 8 | absence/degradation | passed — doctor/rendering legs pending binding (C5/C6) |
| 9 | CLI/Desktop parity | partial — owner-boundary identity proven; CLI/Desktop legs await C5/C6 |
| 10 | Agent parity | partial — headless JSON flow proven; O:I Action surface awaits C1/C5 |
| 11 | no semantic mirroring | passed — real owner lanes re-prove it (C3) |
| 12 | bootstrap reuse | passed — bootstrap/adopt leg awaits C1/C2 |
| 13 | connector proof | partial — representability proven from the frozen fixture; executable awaits C4 |
| 14 | versioning | passed — kernel mount leg awaits C1 |

## The stub owner

`config-owner-stub` serves the C0-5 grammar exactly
(`config-contribution --json`, `config validate|plan|apply|reset --json`,
plus `system --json` for re-read verification) over a sandboxed store:

- owner-minted `plan_id` / `plan_digest` (sha256 over the canonical plan
  body, 09 §6) — the harness re-derives the digest independently and the
  owner recomputes it on apply;
- `oi.config-receipt/v1` receipts, owner-side idempotency under the frozen
  key: a replay answers `no_op` naming `original_receipt_id`, and never
  re-executes;
- failures exit non-zero with an `oi.config-error/v1` document using the
  frozen codes;
- secret-kind settings accept a secret reference only — material is refused
  without ever being echoed;
- `OWNER_STUB_DEGRADED=1` makes the owner honestly unavailable (empty
  sections as proof, named obligations, `owner_unavailable` on every
  mutation);
- `OWNER_STUB_CONTRACT=future-schema|unknown-kind` serves the versioning
  scenarios of 09 §15.

Environment: `OWNER_STUB_HOME` (sandbox root), `OWNER_STUB_OWNER`
(`ai-kit` default, or `oi`), plus the two scenario flags above. The stub's
`store.json` is the owner's native configuration — the surface a
native-first edit touches directly.
