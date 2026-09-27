# Install receipts — 2026-09-27

## Managed update (`oi update --apply`, channel source)

Receipt: `~/Library/Application Support/OI/receipts/updates/active.json`
("Managed update complete: 7 product(s) swapped atomically").

| product | exe | installed revision | from |
|---|---|---|---|
| oi | oi | `9905eac4d799` (converged main) | 51971795 |
| central | ctrl | `737582c45a98` | f42779dc |
| actuation | actuation | `e5225dc29861` | 8ad34cb3 |
| ai-kit | aikit | `f1fb7c1c573e` (guidance/development-world-shape) | f95f9dcb |
| software-factory | factory | `9638c6181a24` (inhabit/current-carries-run-20260924) | ca7d594f |
| workcell | workcell | `b7371b358cc0` (workcell-runs-20260923) | 54abca82 |
| quaternal-logic | ql | `42e8d79ba613` (feat/nara-expression-embodiment-20260924) | 56921a5e |

Rollback: `oi update --rollback`.

## Desktop

- `oi desktop remove` (superseded the techne-lane-era installed bundle; the
  staged campaign bundle at
  `campaign-evidence/2026-09-25-cradle-state-coherence/staged-desktop-bundle/`
  stays on disk as evidence).
- `oi desktop install --bundle dist/bundle/oi-cradle-0.1.0-aarch64-apple-darwin.tar.gz`
  (sha256 `712711ae…`); `BUNDLE.json` `source_revision` =
  `9905eac4d799603ebe5e0e8a29356b7eea4951ad` — the converged tip.
- App relaunched from `/Users/admin/Applications/O-I.app` (PID verified).

## Verification

- `oi doctor`: PASS on all suite seams (PATH/registered executables same
  content, developer builds); the three DEFERRED physical acceptances
  (macOS reference workstation, Ubuntu Workcell reference machine,
  private-provider materialisation) remain named deferrals, not failures.
- `oi verify --all`: PASS (workcell managed chain revision `b7371b358cc0`).
- `oi status`: active receipt names the new revisions.
- `oi desktop status`: installed Desktop 0.1.0, backing composition
  present (central/actuation/ai-kit).

## Omarchy (host frank, second machine)

- `~/Central/Work/O-I` fast-forwarded `3b16acdd` → `9905eac4` (converged main).
- `oi update --apply` started on frank (its first attempt failed on
  non-interactive PATH without cargo; restarted per the error's own
  prescription with `PATH="$HOME/.cargo/bin:$PATH"`). Frank's plan: oi
  `3b16acdd → 9905eac4`, actuation, ai-kit, software-factory move; central,
  workcell, ql already current. Frank keeps no dev worktrees.
