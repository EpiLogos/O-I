# Verification brief — the landing system (for an independent agent)

Written 2026-09-27 by the building session. Every claim below is falsifiable
by the command beside it. Repo: `/Users/admin/Central/Work/O-I` (landed tip:
see `git log --oneline -3`; the system itself is the `gates/` tree plus
`campaign-evidence/2026-09-27-landing-system/`). Control pieces live at
`/Users/admin/Central/Control/user/seat-guard/hooks/pre-push` (new) and
`/Users/admin/Central/Control/user/skills/central-git-convergence/SKILL.md`
(rewritten).

## V1. The gate catalog is derived from CI (provenance audit)

Claim: every `landing` gate in `gates/manifest.json` carries provenance to a
real workflow, and its command matches that workflow's step.

Check: for 5 sampled gates of the verifier's choosing, open the workflow
named in `provenance.workflow` under `.github/workflows/` and compare the
step's `run:` with `manifest`'s `command`. Expected: same commands modulo
whitespace/line-joins; `ci-site-public-deployment-gate` carries a `why`
documenting the envelope reconciliation block.

## V2. The runner works and receipts honestly

```bash
cd /Users/admin/Central/Work/O-I
node gates/run.mjs landing --only guard-source-markers-and-syntax,cradle-tsc
cat gates/receipts/latest-landing.json
```
Expected: exit 0; receipt `schema` = `oi.gate-run/v1`; `head` equals
`git rev-parse HEAD`; both gates `ok:true`; `deferred_to_ci` lists 11
ci-only gates; `pass:true`.

Falsify test (then revert): append `<<<<<<< HEAD` to any tracked `*.mjs`,
re-run the same command — `guard-source-markers-and-syntax` must FAIL with a
log under `gates/receipts/logs/`. Revert the file.

## V3. The pre-push guard refuses an uncovered tip

```bash
cd /Users/admin/Central/Work/O-I
# simulate a push toward main without a receipt covering the tip:
echo "refs/heads/system/landing-gates 0000000000000000000000000000000000000000 refs/heads/main $(git rev-parse HEAD)" \
  | /Users/admin/Central/Control/user/seat-guard/hooks/pre-push; echo "exit=$?"
```
Expected: non-zero exit with the "landing guard" guidance (no receipt, or
stale receipt for a tip other than HEAD).

Then prove the positive path: run `node gates/run.mjs landing` (full tier)
at the current tip; re-invoke the hook with the same stdin — expected exit 0.

Negative controls: pushing a NON-main ref must be a no-op (exit 0 even with
no receipt); `git config central.gates off` disables the hook entirely
(restore with `--unset`); a repo without `gates/run.mjs` is never touched
(verify by running the hook from any other repo — exit 0).

## V4. Convergence pressure is visible

```bash
cd /Users/admin/Central/Work/O-I
node gates/run.mjs status
```
Expected: one row per worktree with branch/dirty/ahead/behind; merge-tree
conflict prediction for unmerged branches; a `last landing receipt` line
whose `covers_current_head` is true after V2's full run. Live lanes (e.g.
`worktrees/oi-m123-instrument`) must appear WITHOUT being touched by the
tool — status is read-only (verify: `git status` in that worktree unchanged).

## V5. The law is discoverable

- `gates/README.md` states the five-law definition of landed, tiers, escape
  hatches, and the CI relationship.
- `Control/user/skills/central-git-convergence/SKILL.md` teaches the
  continuous cadence: land-on-green, status before building, the landing
  loop, named escapes, stop-and-ask triggers. The old "inspect CI on the
  PR" landing section is replaced.
- `Control/user/seat-guard/hooks/pre-push` exists, is executable, and the
  seat-guard `on` installer chmods it.

## V6. The system landed through its own procedure

The `gates/` tree landed on main via PR (linear, rebase-merged) with a green
landing receipt covering the merged tip (receipt `head` must equal the
commit that introduced `gates/` — the merge rewrote hashes; verify instead
that a landing receipt exists whose `gates` list is green at the
`gates/`-introducing content: diff the receipt's tree state via
`git log --oneline -- gates/`). PRs: #543 (convergence), #544 (record),
and the landing-system PR.

## Known-open (owned elsewhere, not verifiable here)

1. `ci-site-public-deployment-gate`: blocked by the curated envelope
   reconciliation — delivery lead.
2. Live lanes at verification time: `worktrees/oi-m123-instrument`
   (feat/m123-expression-instrument, in flight) and env-3's seat (active
   writer). Status must show them; their content is theirs.
