# 05 — Execution: orchestrated development

**Status:** the standing injunction for the orchestrator and its subagents
building the Cradle. **Authority:** `docs/cradle/01–04` and
`docs/positions/FOUNDING-POSITIONS.md`. Where any instruction — here, or from
any subagent — conflicts with the design, the design wins.

## 1. The mission

Build the Cradle for real. Not specimens of the Cradle, not a system browser
over the products: the application described by `docs/cradle/01–04`, in which
files, knowledge, agents and their activity constitute one working situation.
Each vertical lands as working software verified in the running app.

## 2. Order of reading

Before dispatching itself, the orchestrator has read:

1. `docs/cradle/01–04` in order;
2. `docs/positions/FOUNDING-POSITIONS.md` — authored ground;
3. `02-ARCHITECTURE.md §11` — current build disposition (keep / mount / add /
   retire);
4. for each vertical, the owning product's own docs (paths in 01 §8).

Every subagent brief names the exact sections the subagent must read and the
verification conditions its work must satisfy. Never assume a subagent finds
context itself; never let a subagent redesign the application.

## 3. The verification law — the heart of this arrangement

A subagent's report of finished work is **the subagent's idea of "plausibly
done"**. It is a hypothesis, never an acceptance.

On every return, the orchestrator:

1. **Verifies against intent.** Re-reads the design sections the work touches
   (01 for experience, 02 for structure, 03 for states, 04 for conditions;
   FOUNDING-POSITIONS for anything touching authorship, authority, provenance)
   and checks the work's *semantics* against them — not only its mechanics.
2. **Verifies by operation.** Runs the app and walks the exact condition from
   04 §3 that the work claims to satisfy. Prose summaries, test output, and
   contract tests do not establish a UX condition; they only justify trying
   the walk.
3. **Verifies mechanical claims itself.** Runs the build, the tests, the cold
   start — never accepts "tests pass" or "command added" on faith.
4. **Only then does work count as done.** Anything less is in progress with a
   claim attached.

If verification fails: return the work with the exact failed condition and
what was observed. Do not partially accept; do not silently fix it in place
unless that is faster than re-dispatching. If the work contradicts the design,
the design wins: fix the work, or return the conflict to the owner with
reasons. **Never edit `docs/cradle/` to match code** — design changes are
recognised by the owner, not derived from implementation.

## 4. Design law — violations are returned, never merged

- **Non-identities:** reading ≠ action · surface ≠ action · UI selection ≠
  context disclosure · "plausibly done" ≠ done · presence ≠ authority ·
  masking ≠ missing · degraded ≠ broken · authored ≠ observed ≠ generated ·
  Projection ≠ Contribution ≠ source object · Participant ≠ Identity ·
  encounter ≠ belief.
- **Native ownership:** the desktop composes and discloses; it never
  reimplements product semantics. Product changes happen in the product's own
  repo under its own conventions.
- **Honesty laws:** provider truth (`live → may claim live; fixture →
  Degraded`); absence is an observation, not an error; degradation is local;
  authority is visible behind every mutation.
- **Security boundary:** no ambient shell/filesystem/process/network/secret
  power in the renderer; contribution code is never the authorising caller
  (`02-ARCHITECTURE §12`).
- **Two state layers:** semantic state is kernel/product-owned; presentation
  state is desktop-owned and never derives semantic meaning.
- **Austere rest, summoned depth:** the resting shape is the agency field and
  the canvas; the full grammar is reached by promotion only.

## 5. Working arrangement

- **Repos.** O:I is the app: `desktop/core` kernel, `desktop/src-tauri` host,
  `desktop/ui` presentation. Owner products change in their own repos —
  Central, ai-kit, Software-Factory, Actuation, Workcell — under their own
  conventions.
- **Stack.** Tauri + Rust kernel + React/TS. Keep `desktop` building and tests
  green at every integration; commit small on the working branch.
- **Starting point.** Begin from `02-ARCHITECTURE §11`: keep what is real,
  mount what is written-but-unmounted, add the load-bearing gaps,
  retire/replace as listed there.

## 6. Build order and dispatch

Verticals in `04 §5` order. Foundations first: vertical 1 lands the kernel
service pattern, the **event seam**, the global focus model, and surface
bindings — later verticals consume them, so they land as reviewed kernel code
before parallel fan-out.

Per vertical: (a) kernel service — typed events, tested; (b) UI specimen —
states from 03, austere rest, no chrome; (c) the end-to-end walk — **yours**,
per §3. Owner-side seams (Central owner-Actions, AIKit streaming, Agency
Gateway, Factory Journey readings, Workcell placement) may be dispatched in
parallel with (a); they land in the owner repos.

Parallel fan-out is safe when units touch disjoint files and contracts;
integrate and re-verify the whole vertical before it counts as done.

## 7. Definition of done (per unit, per vertical)

- the `04 §3` conditions for the area hold in the running app from cold start,
  within the vertical's scope;
- structured state is exposed for agent-native parity (04 §4);
- absence and degradation render honestly in every view of the area;
- kernel operations are tested; UI states match the design; no design-law
  violations;
- a receipt: what was built, the exact walk that verified it, what remains.

## 8. Records

Status lives in the working branch's execution log, PR descriptions, and
issues — **not** in `docs/cradle/`. The design set records the design; the log
records what is real and how it was verified. On vertical completion, a receipt
carries the walk, the commands, and the observed renders, so the owner can
re-walk it without you.

## 9. Posture

Quiet diligence, honest returns. A verified small vertical is worth more than a
plausible large one. When reality contradicts intent, surface it — that is
Return, and it is welcome. What is not welcome is silently reconciling the
design to the code.
