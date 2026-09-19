# The install-and-update flow

How the suite's binaries get onto a machine, how they stay current, and how
they go back. One install authority per machine: the O:I-managed root with
receipts. Everything else — `cargo install`, hand `cp` to `~/.local/bin`,
`.backup-YYYYMMDD` archaeology — is drift this flow names and absorbs.

This document is the update authority. `docs/INSTALL.md` remains the
first-install entry point (fresh ground, provenance labels); it deliberately
does not carry the update lifecycle. The two concerns erode differently:
entry erodes when a bootstrap route breaks, update erodes when a swap or
receipt shortcut is taken.

## The specimen (what was actually true, 2026-09-15)

Both machines had every installed binary placed by hand:

```text
Mac (primary)
  ~/.local/bin/oi       -> ~/.local/share/oi/cargo/bin/oi    oi 0.1.0 (5c7582e0)   — stale (head 0df0680c)
  ~/.local/bin/ctrl     -> ~/.cargo/bin/ctrl                 ctrl 0.1.0 (b7b3e7b)  — current by luck, unmanaged
  ~/.cargo/bin/aikit                                         aikit 0.1.0 (cc00077) — unmanaged
  ~/.local/bin/actuation                                     actuation 0.2.0       — hand-copied file, no revision
  ~/.local/share/oi/cargo/bin/{factory,ql,workcell,...}                            cargo install --root, invisible to receipts
  ~/Library/Application Support/OI                                                 release-era install of 0.1.0-prelocal.2, receipt drifted

Omarchy (frank)
  ~/.local/bin/{oi,ctrl,aikit,workcell,actuation,ql,factory}   flat hand-copied files
  oi 0.1.0 (5c7582e0) stale; ctrl 0.1.0 (c9d3778) stale — predates both
  harness-connector commits (c7184e4, b7b3e7b); `.backup-*` siblings are the
  manual-update archaeology
```

The machinery to end this already existed in `oi` — receipts, managed
layouts, suite channels, atomic staging — but nothing connected PATH reality
to any of it, and the one developer install path that exists refused to run
on exactly these machines (both trees are dirty live work). So installs
happened by hand, and staleness became invisible.

## What already exists and is reused unchanged

| Piece | Where | Role in this flow |
|---|---|---|
| Per-product build contract | `surfaces.json` `native.source_install` (build command, executable path, version command); `oi`'s own build in `current_main_install.rs` | The only build commands the updater runs |
| Committed-cut export | `rolling_dev.rs` `export_rolling_source` (`git archive <revision>`) | Build inputs are a committed cut, never a dirty tree |
| Modality vocabulary | `cli/src/modality.rs` | This flow records `developer-source` |
| Channel machinery | `suite/channels.json`, `development_field.rs` | `source` channel = this flow; `stable`/`mainline` stay refused until published release artifacts exist. No new channel vocabulary is invented here |
| Receipt-swap precedent | `development_field_command.rs` `activate_source_suite` / `command_development_suite_rollback` | active/previous receipt swap, atomic_json, staged-then-renamed products |
| Managed root | `oi_data_root()`: macOS `~/Library/Application Support/OI`, Linux `~/.local/share/oi` (honours `OI_DATA_HOME`) | The one place binaries, receipts and build caches live |
| Composition state | `composition.rs` (`~/.config/oi/composition.json`) | Registrations are repointed at the managed bin by the updater |

## One machine, one authority

```text
<data-root>/                              oi_data_root() — the managed root
  products/<product>/<sha256>/bin/<exe>   content-addressed binaries (the only real files)
  bin/<exe>                               symlink -> ../products/<product>/<sha256>/bin/<exe>  (the flip point)
  receipts/updates/active.json            oi.managed-update/v1 — what is live now
  receipts/updates/previous.json          oi.managed-update/v1 — what rollback restores
  receipts/updates/gates/<...>/           per-run evidence: build logs, exported-cut receipts
  cache/build/<product>-target/           persistent per-product CARGO_TARGET_DIR (warm rebuilds)
~/.local/bin/<exe>                        activation symlink -> <data-root>/bin/<exe>
```

There is exactly one real copy of each binary generation, addressed by its
SHA-256. `bin/<exe>` is a symlink flip, never an in-place write. Activation
symlinks in `~/.local/bin` are created by temp-name-plus-rename, never
written in place. **A running process keeps executing its old inode** — an
update or even a rollback mid-session cannot kill a live campaign; it only
changes what the *next* invocation resolves. That property is why the swap is
`cp-to-tmp` + `mv`/`rename` everywhere and never `cp` onto a live path.

Receipts (`oi.managed-update/v1`) record per product: the source cut
(checkout path, commit, tree, branch, dirty flag), the binary SHA-256 and
managed path, the activation path, the exact build command and gate log, the
provenance (`built` or `adopted`), and the install time. The receipt is the
answer to "what is installed here" — not `ls ~/.local/bin`.

## Cut resolution (developer-source modality)

For each product the desired cut is the **committed HEAD** of its checkout
under the personal ground's `Work/` (`dev_source_path`): `oi` at `Work/O-I`,
`central` at `Work/Central`, and so on. A dirty tree is expected on a
development machine and does not block or contaminate anything: the updater
exports the committed cut with `git archive` (the same pattern as
`oi dev gate`) and builds that. Dirty files are never installed; uncommitted
work never leaks into a binary; the operator's hands are not involved.

This is the deliberate loosening of `oi dev install`'s guard, which refuses
branch != main, dirty trees, and any ahead/behind — the refusal that made
hand-copying the norm. `oi dev install` keeps its strict contract (it
answers "is this checkout exactly current accepted main?"). `oi update`
answers a different question: "is the machine running the binaries this
ground's committed cuts produce?" The receipt discloses branch and dirty
state honestly either way.

## The single command

```sh
oi update                    # resolve cuts, plan, apply (the explicit command)
oi update --check            # pure report; no file is touched. exit 0 current, 1 updates available
oi update --check --json     # machine-readable report (for timers and other agents)
oi update --apply [PRODUCT ...]   # explicit apply, optionally scoped
oi update --apply --channel mainline [PRODUCT ...]   # apply origin/main cuts instead of the checkouts'
oi update --rollback         # receipt-driven restore of the previous binary set
oi update timer --platform launchd|systemd [--output PATH]   # emit the scheduled-check artefact
```

Planning per product:

1. **skip** — the active receipt names the desired cut, the managed binary's
   SHA-256 still matches it, and the activation chain resolves. Nothing runs;
   binary currency is proven from the receipt, not re-derived by rebuilding.
2. **adopt** — no receipt entry, but PATH resolves the executable and its
   `--version` output names the exact desired cut (full or 12-char commit).
   The existing binary is linked into the managed store as-is, recorded with
   provenance `adopted` (no build claim is made). `--apply --rebuild`
   escapes adoption and forces a real build.
3. **build** — everything else: export the cut, run the product's own build
   contract with `CARGO_TARGET_DIR` pointed at the persistent per-product
   cache, verify the executable, stage by SHA-256, smoke `--version`, then
   flip `bin/<exe>`, point activation, write receipts, repoint the
   composition registration (`developer-source` / `managed-update`).
4. **absent** — no checkout at `Work/<name>`: disclosed, never fatal (the
   six-product suite is not demanded of every machine).

A checkout on a non-`main` branch (Actuation's `ql/vak-integration` on
2026-09-15) is the owner's committed cut like any other; it installs under
its own disclosure. Refusing it would just reproduce the hand-copy era.

## The mainline route

The developer-source route answers "what does this ground's committed state
produce?" — which, on a machine whose checkouts sit on long-lived in-flight
branches, is not "what has merged?". Work that lands on origin/main reaches
the machine only when each checkout's branch carries it, and that gap used
to be invisible: a product missing on the machine was really a git-state
fact in someone else's checkout, re-derived session after session.

The `--candidate PRODUCT=main` seam resolves one product's cut from the
fetched origin/main. `--channel mainline` is its batch form: every selected
product without an explicit candidate takes main, so merged work reaches the
machine without touching anyone's tree:

```sh
oi update --check --json     # discloses, per product: behind_main / ahead_of_main
oi update --apply --channel mainline central oi   # build origin/main for these products
oi update --apply --channel mainline              # or the whole selection
```

The mainline cut is exported with `git archive` and built in isolation
exactly as the default route builds a checkout cut; an apply that cannot
refresh origin/main fails loudly (`--candidate main`'s contract — pass an
exact commit id for offline work). The receipt records `branch: origin/main
(integration-lead candidate)` and `channel: mainline`, so the machine always
answers truthfully about which route produced what it runs. Composition
registrations are repointed with install source `managed-update:mainline`.

The default route stays developer-source, so the two channels are an
explicit choice each time — applying mainline and later applying the default
will honestly flip a product back to its checkout's cut, and the check
report shows which way every product sits. The plain `--check` now carries
the disclosure that motivates the route: for every product whose planned cut
predates origin/main it prints `N commit(s) behind origin/main`, and the
JSON adds `origin_main_revision`, `behind_main`, `ahead_of_main` and a
top-level `mainline_pending_count`. The origin/main read fetches
best-effort; a failed fetch degrades to the last-known ref and is disclosed,
never passed off as fresh. "The machine lacks X" is now one command away
from "the machine's cut predates X" — including when the product code for X
merged days ago.

Rollback is channel-blind by design: it restores the previous receipt set,
whatever route produced it.

Rollback restores the `previous.json` binary set: every product named there
must still verify (artifact present, SHA-256 matches) before anything flips —
then `bin/<exe>` symlinks, activation symlinks, receipts (active/previous
swap) and registrations move together. Products installed after the previous
receipt are left in place and named.

## Auto-update semantics

Check + notify by default; apply only on an explicit command. A scheduled
job never applies: a development machine running live campaigns must choose
its update moment. The atomic-swap property (above) means an apply is safe
for already-running processes, but it would silently change behaviour for
every later invocation — that is an owner's call, not a timer's.

`oi update timer` emits, without installing anything:

- **macOS** — a LaunchAgent plist running `oi update --check` (daily, with a
  retry-smoothing interval), logging to `<data-root>/receipts/updates/timer.log`.
  Install explicitly with `launchctl` if wanted.
- **Linux** — a systemd user timer + service pair with the same check-only
  contract; the service unit pins `PATH` to include `~/.cargo/bin` so
  headless/user environments resolve the toolchain.

The check is the notify: exit code 1 + a plain report (or `--json`) that any
watcher — a status bar, an agent session, `oi doctor`'s live disclosure — can
surface.

## Drift disclosure

`oi update --check` (and the doctor's live-disclosure leg) name everything
installed-but-unmanaged: PATH-resolved product executables outside the
managed root with no receipt entry (`~/.cargo/bin/aikit`, cargo-install
roots, hand-copied files). Updates absorb them: after an apply, the
activation symlink points at the managed store and the old copy is disclosed
as superseded rather than silently shadowed. `oi cleanup --managed` continues
to remove managed state; it still never touches anything it does not own.

## What this flow does not do yet

- **Release modality.** The `stable` channel still refuses for lack of
  materialisable published artifacts; `oi install`'s recorded-build path and
  its `installed-suite.json` receipt are unchanged and remain the seed for a
  future release-channel updater. (`mainline` is no longer in this refusal:
  since the mainline route above it installs as a source build of
  origin/main, which needs no published artifacts.)
- **npm/bootstrap entry.** The fresh-install closed loop (a machine with no
  `oi` at all) is a separate owner handoff; this flow begins once `oi` runs.
- **Attestation.** Adopted binaries carry provenance `adopted` with no
  attestation; built binaries carry the gate log, not a cryptographic
  attestation. GitHub artifact attestation remains with the release path.
- **Cross-machine orchestration.** Omarchy is served by the same commands
  run on that host; there is no push mechanism.
