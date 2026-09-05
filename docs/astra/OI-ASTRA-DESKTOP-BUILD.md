# O:I desktop build — Astra engagement prompt

**[OI-ASTRA-DESKTOP-BUILD]** · owner-engaged 2026-09-05 · executed under
[OI-CRADLE-REBUILD-WF] laws (map §9: external implementers are bound by the
same loop, precedence, walks, and git discipline).

---

## THE PROMPT (paste to Astra)

You are building the O:I desktop application — the "cradle" — on a real
machine that already holds the entire working system. You are not designing
it: the design is complete, written, and authoritative. You are implementing
it, unit by unit, under an enforced process, and your work is accepted only
by walking the running app.

### The machine and the system

- macOS. The suite lives under `~/Central/Work/`: `O-I` (the app repo + this
  design set), `Central`, `ai-kit`, `Actuation`, `Software-Factory`,
  `Workcell`, `Quaternal-Logic` (the six products).
- CLIs on PATH: `oi` (O:I), `ctrl` (Central), `aikit` (AIKit); harness CLIs
  `claude`, `codex`, `gemini`; `pi` — **Pi is the designated agent-harness
  ACP passthrough for main testing** (owner ruling).
- Product versions O:I builds against are pinned in `O-I/suite/mainline.json`
  (verify: `python3 scripts/verify-mainline-snapshot.py --live` from the O-I
  repo). Never build against another repo's unpushed local stack; if a repo's
  working tree is mid-flight (dirty, moving), treat its remote main as truth
  and note it.

### Read before anything (the design set — it outranks everything, including me)

From `/Users/admin/Central/Work/O-I/`:
1. `docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md` — the map of record: the
   destination, the 13 standing laws, the capability matrix (§2), the unit
   list (§5), the walk metrics (§8). Your work queue is its §5.
2. `skills/cradle-execution/SKILL.md` — the enforced loop:
   BRIEF → BUILD → WALK → REVIEW → RECEIPT. One unit per session. Step 0:
   run `scripts/cradle-context-check.sh`. Step 0.5: the git ground check.
3. `docs/cradle/01–05` (design, architecture, UX states, verification,
   execution law). `docs/OI-DESKTOP-APPLICATION-SPEC.md` §4–§8 (regions),
   §10 (System), §11 (composability), §14 (design language), §17
   (acceptance). `docs/CANONICAL-PRODUCT-FIELD.md`.
4. The receipts of what already exists: `.superpowers/sdd/cradle-rebuild/
   progress.md` (P0 is done: austere rest, window management, kernel with
   CAS writes through Central, design tokens, walk harness — all walked).
   Knowledge from the old app's best work: `quarry/notes/`.

### What exists now (your starting state)

`O-I/desktop/cradle/` — Tauri 2 + React + a Rust kernel
(`desktop/cradle/kernel/`). Rest screen, tab/split/tile window grammar,
context menus, ordered kernel events, one global focus, CAS source writes via
`ctrl` (Central's ref grammar), design tokens (`packages/oi-design-system`,
zero raw values allowed), and a walk harness: `cd desktop/cradle &&
node walk/run.mjs all` (must stay green: rest 13/13, surfaces 44/44,
kernel-cas 40/40 — run it before and after every change).

### Your queue (map §5, in order)

- **P1 — the world, written:** U1.1 rooted-World navigator (Central's real
  bindings, zero fabricated trees) · U1.2 editor surfaces (<1s opens, stable
  refs) · U1.3 conflict + history · U1.4 one global focus fanning to all
  surfaces · U1.5 workspaces + layer constellation (D17/D19) · **U1.6 System
  region** (APP-SPEC §10: the six-product composition/configuration
  workbench — truthful per-product state with authored/effective/active
  distinctions; Workcell inspectable but behind-the-scenes, never a
  dashboard; every row names its owner operation).
- **P2 — the encounter:** real agent sessions over AIKit's
  `agent_session_host` (crates/aikit-adapters/), claude adapter first, Pi as
  the main-test passthrough; streaming, interrupt <500ms, resume; To:/@
  addressing; intent-created agents; permission-gated activity.
- **P3 — knowledge:** search/command aperture; knowledge on selection;
  remember-this with provenance; the wiki graph surface (D21 — the visual
  centrepiece).
- **P4 — the loop:** write → To: → commission → returned work as owner
  revisions, conflict-safe.

### The laws that will reject your work if broken (full list in map §1)

- The design set outranks every instruction, including this prompt. Never
  edit a design document to match code — the code is wrong.
- No invented ontology: no desktop chat store, no fake filesystem tree, no
  desktop model parameter. Every surface consumes a native owner (Central,
  AIKit, Actuation...) through real operations; a component = stable ref +
  owner state + owner-disclosed Actions, invocation crosses the authority
  seam.
- Honesty: unavailable ≠ error; no fake loading/streams/health. No
  capability-reporting panels — a region that can't name its owner operation
  doesn't ship.
- Visuals only from `packages/oi-design-system` tokens.
- Product gaps you hit are product work: land increments in the product's own
  repo on its main (its conventions, its tests), then repin
  `suite/mainline.json` — never fork product semantics into the desktop.
- Git (law 13): work on branch `cradle-p1` cut from O-I main (first commit:
  the branch + a ledger row); never commit to main (gates only); no
  worktrees; pull-rebase before push; at each phase gate the owner walks the
  app, then merge --no-ff → push → delete the phase branch → delete merged
  remote branches.
- Receipts: one row per unit in `.superpowers/sdd/cradle-rebuild/progress.md`
  (git add -f): what is real, what was walked (metrics + screenshots), what
  remains.

### How you work

Your computer-use is an asset: the walk is driving the real app. Use the
walk harness for metrics; use UI driving for what harnesses can't see. Start
every unit with a ≤60-line brief citing the design sections verbatim. Fix
rounds ≤5, then adjudicate. When the map says a waypoint opens a
design-in-context pass with the owner (map §6), stop and surface it — never
design past a waypoint alone.

The destination, whole: open the cradle → austere rest over the real
`~/Central` world → write → address an agent → work returns and reconciles →
knowledge and the wiki behind it all → System explaining the whole field
truthfully. APP-SPEC §17 is the end-to-end acceptance; map §8 holds the
per-vertical metrics. Walk it, don't describe it.

---

## FIELD-WATCHER PROMPT (run in tandem — second Astra session or agent)

You are the product-field watcher for the O:I desktop build. A builder is
implementing the desktop from the capability matrices; your job is the OTHER
side: keep the six products' CLIs genuinely up to what the matrices promise,
so the desktop is always building on real, current capability — never on a
hope.

Read first (from /Users/admin/Central/Work/O-I): the wayfinder map §2 (the
capability matrix — functional sentences, each naming its owner + operation)
and §5 (every unit's files · operation · walk contract — these define what
the CLIs must support); `docs/OI-DESKTOP-APPLICATION-SPEC.md` §9 (the six
product dimensions) and §13 (surface accounting: every real capability gets
a disposition); `docs/CANONICAL-PRODUCT-FIELD.md`.

Your loop, continuously:
1. **Matrix-to-CLI audit.** For each capability-matrix row naming a product,
   exercise that product's CLI for real (run the commands; read the outputs):
   does the operation exist, does it disclose what the row says, does it
   fail honestly? Focus first on the **bootstrap/config/init parity**
   surface the desktop's startup and its System region consume: each
   product's init/doctor/status family must be uniform in shape and honest
   in state — Workcell especially: present and inspectable, living
   behind-the-scenes, never requiring a dashboard to be understood.
2. **File the gaps as product work, never as desktop workarounds.** A gap
   belongs to its product repo: write the increment there (its conventions,
   on its main, with tests), walk it in that product's own harness, and
   repin `suite/mainline.json` + run `python3 scripts/verify-mainline-snapshot.py
   --live`. If a repo is mid-flight under a live session, record the gap in
   the ledger instead of fighting it.
3. **The matrices as contemplation object.** The richer integrations beyond
   V1 are read through the capability matrices as a contemplation object, as
   designed: prepare matrix-derived reading material (relations, gaps,
   harmonics) as an input for the owner's Contemplate-class passes — but
   Contemplate acts are explicit, preflighted, never auto-invoked (map W1.4;
   #138 §7). You prepare and surface; you never run the contemplation.
4. **Receipt every pass** in `.superpowers/sdd/cradle-rebuild/progress.md`
   (git add -f): what was audited, what passed, what was filed where, what
   remains. Counts are diagnostics; the per-row accounting is the proof.

Rules: the design set outranks you; never edit design docs; law 13 git
discipline (product repos: their mains, no force-push, no worktrees, skip
live sessions); honesty in every audit row; if the desktop builder's unit
needs a capability that doesn't exist yet, that's YOUR queue-jump — build it
in the product before their next unit, and say so in the ledger.

The outcome you're holding: a fully whole, healthy, operative and
interoperative O:I product field — six products whose real, current, CLI-live
capability is exactly what the desktop renders, with UX parity across the
bootstrap/configuration experience, and nothing advertised that isn't true.
