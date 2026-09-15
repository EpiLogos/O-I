# Install-mode acceptance campaign kit

Reusable fixtures for the Context Frame acceptance campaign
(`docs/CONTEXT-FRAME-ACCEPTANCE-CAMPAIGN.md`, parent #268): the
deterministic container ladder and the physical-machine tooling. These
scripts prove each install mode's own promise — fresh install, promised
capability, absence of unselected dependencies, restart, change, update,
interruption/recovery, supported rollback, removal, retained state — using
production paths only (`oi suite install/update/cleanup`, `oi mode`,
`oi current-world`, `oi verify`/`doctor`). A green exit code alone is never
acceptance; the teardown law's residual accounting is.

## Layout

```text
baseline-capture.sh   capture a machine baseline to explain every residual against
make-rootfs.sh        fresh Arch rootfs under ~/oi-machines (unprivileged)
run-case.sh           snapshot the rootfs, run case phases in systemd-nspawn,
                      export evidence outside the case dir, purge the case dir
lib.sh                container entry point: isolation, step/expect helpers
check-closure.sh      absence prover: composition, filesystem, PATH, services
case-mode.sh          one full lifecycle for a mode (0/1, 0/1/2, 0/1/2/3, 5/0, 4.5/0)
case-transitions.sh   the up/down adoption ladder with identity-drift checks
world-*.py            canonical extractors from `oi current-world --json`
```

## The environment ladder

1. **Process-level isolation** — `cli/tests/install_modalities.rs` and the
   other deterministic cargo tests. Deterministic cases run here first.
2. **One container per destructive case** — `run-case.sh` on the second
   machine; fresh install → use → restart → change → update →
   interruption/recovery → rollback → removal → residual accounting.
   Reset to baseline between cases (each case starts from the base
   rootfs snapshot).
3. **Bare metal, small explicit set** — machine adoption, real shell/PATH
   hooks, real systemd user services, `oi host omarchy plan/realise/verify`.
   No container stand-ins.

## Running a mode case end to end (second machine)

```sh
OI_BIN=~/Work/O-I/cli/target/release \
  scripts/install-mode-campaign/run-case.sh mode-0-1 \
  t-install.sh t-restart.sh t-change.sh t-remove.sh
```

where the phase scripts call `case-mode.sh <mode> <phase>` inside the
container. Evidence lands in `~/oi-campaign-evidence/<run>/<case>/` —
outside any root cleanup removes. Teardown is complete only when every
residual is explained against the baseline (campaign doc §3).

## What a case proves, and what it refuses to fake

Every absence claim is proven twice: through the composition disclosure
(`oi current-world`) and through a filesystem/service search
(`check-closure.sh`). Physical and human acceptance are never claimed by
these scripts; they produce returns for Recognition, not acceptance.
