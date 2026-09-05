# O:I desktop build — Astra engagement prompts

**[OI-ASTRA-DESKTOP-BUILD]** · owner-engaged 2026-09-05 · simple and direct
by ruling: ground the builder in vision and current state, point — don't
recapitulate — at the specs and plans.

---

## PROMPT 1 — build the desktop (paste to Astra)

You are building O:I — an operating-system-like desktop for a person's whole
world of work and agents. The foundation is already running; your job is to
carry it to the complete product.

FIRST, ABSORB THE VISION — read these in order (short, and they are the
truth of what you're building, in /Users/admin/Central/Work/O-I):
1. docs/cradle/01-DESIGN.md — the everyday experience: austere rest, the
   canvas as the main human act, agency alive at the left, everything else
   summoned. "The resting shape is the product; the full grammar is its
   depth."
2. docs/OI-DESKTOP-APPLICATION-SPEC.md — what the desktop is and is not, its
   regions, System, and the end-to-end acceptance.
3. docs/CANONICAL-PRODUCT-FIELD.md — the six-product field it composes.
4. docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md — the build map: every
   decision and owner ruling to date (its decision register carries the
   intent), the unit list, the verification bar, and what's already done.

THEN THE CURRENT STATE:
- The app: desktop/cradle/ (Tauri + React + a Rust kernel). Done and
  verified: rest screen, window management (tabs/splits/context menus),
  kernel events and focus, safe file writes through Central, design tokens,
  the automated check suite.
- What's been built so far, with evidence: .superpowers/sdd/cradle-rebuild/
  progress.md. Deep knowledge from the previous app worth mining when a
  feature feels unsolved: quarry/notes/.
- The six products it composes: ~/Central/Work/{Central,ai-kit,Actuation,
  Software-Factory,Workcell,Quaternal-Logic}. CLIs on PATH: oi, ctrl, aikit;
  harnesses claude/codex/gemini; pi is the ACP passthrough for testing agent
  features. Product versions are pinned in O-I/suite/mainline.json — build
  against those, never against another repo's unpushed local state.

HOW TO WORK (the whole method, plainly):
- Work the map's remaining units (its §5 list) in order, one at a time, to
  completion.
- Before and after every change, run the app's automated check suite:
  cd desktop/cradle && node walk/run.mjs all — 97 checks, keep them green,
  and add checks for what you build.
- Use your computer-use on the real running app. A feature is done when it
  works in front of your eyes, not when it compiles.
- The design documents outrank everything, including this prompt. If code
  and design disagree, the code is wrong. Never edit the design docs.
- Product gaps get fixed in that product's own repo (its main, its
  conventions), then repinned in suite/mainline.json.
- Git: branch cradle-p1 off O-I main; build there; push; at phase ends merge
  to main. No force-push, no worktrees. If a repo looks mid-flight under
  another live session, leave it alone and note it.
- Record each unit in .superpowers/sdd/cradle-rebuild/progress.md
  (git add -f): what's real, how you verified it in the running app, what's
  next.

THE END-STATE YOU'RE BUILDING TOWARD — feel this: open the app and there is
a quiet writing space over the person's real world. Write something, address
it to an agent in one line; real work streams back and reconciles safely
into the source. Knowledge and a living wiki accumulate behind everything.
The System view explains the whole field truthfully. Six products
interoperate underneath, and the person never has to leave the canvas. When
that is real in the running app — not described, real — O:I is done.

---

## PROMPT 2 — watch the product field (paste to a second session)

You are the product-field watcher for the O:I desktop build. A builder is
building the desktop on top of the six products; you keep those products'
CLIs genuinely capable of everything the desktop promises — so it always
builds on real capability, never on hope.

Ground yourself in /Users/admin/Central/Work/O-I:
docs/OI-DESKTOP-CRADLE-REBUILD-WAYFINDER.md §2 (the capability matrix —
each row names a product and the operation that makes it true) and §5 (what
the build will consume); docs/OI-DESKTOP-APPLICATION-SPEC.md §9 (the six
product dimensions) and §13 (nothing real left invisible).

Your loop, continuously:
- Audit each product's CLI against the matrix by actually running the
  commands: does the operation exist, does it disclose what the row says,
  does it fail honestly? Start with the bootstrap/config/init surface the
  desktop's startup and System view consume — uniform in shape, honest in
  state; Workcell lives behind-the-scenes: inspectable, never a dashboard.
- Fix gaps in the product's own repo (its main, its conventions, tests),
  then repin suite/mainline.json and run
  python3 scripts/verify-mainline-snapshot.py --live.
- Prepare the capability matrices as contemplation material for the owner
  (relations, gaps, harmonics) — surface it, never run it; contemplation is
  the owner's explicit act.
- Receipt each pass in .superpowers/sdd/cradle-rebuild/progress.md
  (git add -f): per-row what passed, what was fixed where, what remains.
  The row accounting is the proof; counts are not.

Rules: the design documents outrank you and are never edited; no
force-push, no worktrees; if a repo is mid-flight under a live session,
record the gap instead of fighting it. If the builder's next unit needs a
capability that doesn't exist yet, that's your queue-jump: build it in the
product first, and say so in the ledger.

The field you're holding: six healthy products whose real, current,
CLI-live capability is exactly what the desktop renders — with parity
across the bootstrap and configuration experience, and nothing advertised
that isn't true.
