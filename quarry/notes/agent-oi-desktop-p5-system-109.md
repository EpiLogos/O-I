# agent/oi-desktop-p5-system-109

`origin/agent/oi-desktop-p5-system-109` @ 430816d (2026-08-23) · 28 commits ·
Class A QUARRY-DESKTOP (§3) · contains `agent/oi-desktop-p1-host-105`.
Evidence doc on the branch: `docs/OI-DESKTOP-P5-SYSTEM-WORKBENCH-EVIDENCE.md`.

## What it is

The P5 System workbench: a six-product system surface that composes exactly
the six owners across seven state axes, rooted in the shell's CurrentWorld
reading rather than its own fetch. It is the most explicit pre-rebuild
enactment of APP-SPEC §13 surface accounting: every real product capability
gets a state, every state names its owner, and nothing is invented.

## Feature/function inventory

- **Six owners × seven state axes model** —
  `desktop/ui/src/system-workbench-model.mjs` + `.test.mjs`:
  `assert.deepEqual(model.products.map(p => p.id), ['central', 'actuation',
  'ai-kit', 'factory', 'workcell', 'ql-mef'])` and every product carries
  exactly `SYSTEM_STATE_AXES`; schema `oi.system-workbench/v1`.
- **CurrentWorld constitution, not a dashboard** — "CurrentWorld is the
  top-level partial constitution and retains exact positions":
  `constitution.present_positions` ([0,1,4] in fixture); per-product
  constitution presence/position; **CF5 appears only from an actual maximal
  CurrentWorld context-frame reading** — six rows alone stay `partial`,
  never `cf5`.
- **No activation theatre** — "AIKit effective resolution never becomes an
  Active/materialised claim": `states.effective.status === 'available'`
  while `states.active.status === 'not_disclosed'` with summary matching
  `/does not prove material activation/i`. Mirrors §2.1's
  "Surface available != active; installed != target loaded".
- **Central discovery without mutation** — "Central Action discovery exposes
  native ownership without manufacturing staged source mutation":
  `authored.status === 'not_disclosed'`, `staged.status === 'none'`,
  authority `native:central`, `/does not copy authored Ground/i`.
- **Factory observed-not-invented** — "Factory read model reports observed
  execution status but does not invent a staged preview".
- **Shell-owned world** — final commits: `refactor: render shell-owned
  CurrentWorld directly`, `thread CurrentWorld from ShellSnapshot`,
  `test: prove System consumes shell CurrentWorld` — System owns no second
  world model.

## Map-unit mapping

- Six-owner state model + constitution semantics → §2 capability-matrix
  grammar (S→S0..S5) and law 10 theatre guard; **no §5 unit builds the
  System region** — this is the map's uncharted gap (see summary).
- CurrentWorld-as-constitution → **U1.1** rooted-world reading (partial vs
  maximal) and the fog row **S→S2→S3 Factory import** (§2.4): the
  observed-execution Factory states are the first concrete shape of that
  fog row's desktop side.
- `available != active` axes → §2.1 distinction laws verbatim.

## Quarry verdict

**FOG-NOTE + UNCHARTED-REGION FLAG** — the model semantics (axes,
constitution, no-activation-theatre) inform U1.1 and the Factory-import fog
row, but the System region itself has no consuming unit in map §5; flagged
to the owner in `quarry/oi-branches.md`.
