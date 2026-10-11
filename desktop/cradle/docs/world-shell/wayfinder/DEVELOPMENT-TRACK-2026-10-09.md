# Development track — the current increments (9 October)

**Standing:** the one converged development track (the wayfinder map and its
tickets), stated plainly. This is not a recovery — there is no disaster to
recover from; there is laid-out work that had not been started, now started.
The honest state of the ground, the concrete increments, and who is running
them right now. Supersedes the session's completion-shaped framings.

---

## 1. What is actually true after today

**Genuinely solid (verified, keep):**
- Kernel read horizon (seat `92695a963`): measured 55 s → 11.4 s cold /
  1.4 ms warm, identity byte-equal, tests green. Real kernel-level work.
- CE1 ctrl fix (Work/Central `9449881`): the validator fault found and fixed
  with a red/green regression; awaits binary reinstall.
- C1/C2 research packs, L6 audit accounting: records the ground honestly.
- CUA root-cause + workaround: the machine's Computer Use now works
  (zai-org/feedback #825 worked around; `~/.zcode/cua-broker/relaunch-broker.sh`).
- The atlas port (L5) and the seams (L1/L2/L4/L7/L9) as **foundations**:
  contracts, manifests, adapters, tests — code that exists and is honest
  about not being integrated.

**True and bad (visible on screen tonight, and the owner is right):**
- **The rendered shell is far below the mockup spec.** Spacing cramped,
  typography degraded, icons rendering as raw glyph text, huge dead space,
  raw error JSON dumped into panels, tracks mostly "—" placeholders. The
  widget law's bar — *function and look better than the mockup* — was never
  measured by anything. The fidelity oracle asserts structure, tokens and
  behaviour, not craft; every lane met the oracle and none met the mockup.
- **"Nothing works" in the running context:** every device "not admitted",
  gateway refused, workcell unavailable, roster refused. Two distinct causes
  conflated until tonight: (a) the **harness context** (Vite/Safari) has no
  host owner attachments, so honest disclosures are *correct* there — but
  the lanes never made that visible, and the compact device rendering is
  poor regardless; (b) the **owner bindings** (ctrl binary with the roster
  fix, gateway, workcell reading) are genuinely not installed/attached in
  this environment yet.
- **The native path is unfinished and the installed state is confusing:**
  `~/Applications/O-I.app` is the LEGACY cradle (Oct 7 bake); `~/Applications/
  O-I Shell Candidate.app` is the new-shell Tauri candidate at source
  revision `99111821a` (Oct 8 17:04 — *before* the agent-shell implementation
  and everything landed today); products home has desktop 0.1.0 (legacy);
  acceptance dirs hold 0.1.2 duplicates of the same stale revision. A
 screenshot of any of these can be mistaken for "the installed cut". The
  new shell as a **current** native app does not exist yet: building it
  requires the release pipeline (suite CLI release basis → feature host →
  package), which is the native composition parent's serialized commission
  (their "B package … still pending").
- **My session failures, named:** I accepted honest disclosure as the bar and
  never challenged craft; I chose the browser/Vite route twice after the
  owner ruled for the native app; I issued completion-shaped statements
  (verdict parent "one item left", day close) while the product was visibly
  below the bar; the verdict I recorded could not see the craft gap because
  nothing measures craft and I didn't look at pixels until tonight.

## 2. Ground-keeping (immediate, reversible)

1. **Disambiguate the installed state** — the legacy app and the stale
   candidate are mistakable for the installed cut. Proposal to the owner:
   rename `~/Applications/O-I.app` → `O-I (legacy cradle, Oct 7).app` and
   `O-I Shell Candidate.app` → `O-I Shell Candidate (Oct 8, rev 99111821a —
   pre-agent-shell).app`, or move both into a clearly-named folder. Owner
   call; reversible.
2. **Mark the verdict honestly** — append to V1's resolution: the
   computer-use pass surfaced a **craft-gap finding** (shell below mockup
   spec; devices unadmitted in harness context) that the scripted oracle
   could not see; the parent stays open on that finding, not only on the
   pass itself.
3. **Stop the misleading run context** — the Vite/Safari harness is renamed
   for what it is: a fixture-context harness, not the product surface. The
   native run path (R1 below) is the only acceptance surface from here.

## 3. The track's current lanes (running now)

- **R1 — Native run path in Tauri (the unblocking lane) — RUNNING: the
  packet's recorded release pipeline is executing at the seat (release CLI
  built and basis-verified 4m30s; the candidate stage is building now).** Establish the
  supported way to run the NEW shell at HEAD inside the Tauri host from the
  seat: the `native_shell` feature host + a development-payload path (or the
  release pipeline pieces it genuinely needs: suite CLI release basis).
  Coordinate with the composition parent's serialization — this is their
  build territory; the lane's job is the supported dev/native run, documented
  so every other lane tests there. **Nothing else should be accepted in any
  other surface.**
- **R2 — Installed-state disambiguation** (damage control above; small,
  immediate, owner-approved rename/mark).
- **THE SYSTEM SHAPE — LANDED (seat `20da871dc`, 13 files +1052):** the
  shell's core mode system is built: `modeGrammar.ts` holds Revision 5's
  tables as typed data (five modes × 28 transport slots, each slot's
  {label, function} pair being the data-i string; per-mode Session|
  Arrangement presentations; Rev 4's Clip|Device pairs; icon-cut marks),
  cross-tested against the SDK's own Rev-5 declaration; the frame consumes
  it (one transport wearing five meanings; the six-icon mode rail;
  per-mode Clip|Device through the one inhabitant rack; Technē lens bar).
  Per mode: Live unchanged (read-only honesty); Base·Central = World
  browser + World cut + Central chain; Factory = agency surface; Expressions
  unchanged; Technē = lens bar + instruments. Suites: mode-grammar 9/9,
  composition guard 29/29, agent 51/51, 90/90; tsc zero; 26 headless
  captures. The parent session is co-building on the same branch (its SDK
  QA + mode-layer commits landed between ours — cross-tested, no
  collision).
- **R3 — Widget-craft pass — one lane landed, one running:**
  `zcode:inhabitants-craft` **done**: all faces to guide standard with
  icon-cut marks extracted programmatically from the owner's specimen
  (50 marks, `--check` green, zero invented SVGs); five named-outcome chips;
  honest dashed waiting cards; reading-row tables with boundary_op + standing
  + honoured-how; declared-unfireable tenders with receiptShape on the
  control; walks 17/17 rack steps + manifest 10/10; tsc zero. Shortfalls
  named: die-turn needs an owner channel, per-position die counts need the
  form grammar, row composition is the host's join. **Commit held** — the
  icon sdk (`sdk/marks.tsx`, `sdk/icons.ts`) is shared-handed with the
  still-running `zcode:agent-shell-craft`; both commit together at
  convergence, then the orchestrator's computer-use pass on the live screen.
  `zcode:agent-shell-craft` still running (chrome, icons per the cut, tracks,
  disclosure components, device cards, dock).
- **R4 — Owner bindings in the native run.** Make the owners reachable in
  the native host context so the faces actually admit: gateway attachment,
  roster (after the ctrl binary reinstall), workcell reading, skillsets.
  The "not admitted" wall turns into real admitted devices or precisely
  named real absences — in the native app, not the harness.
- **R5 — World-context disclosure + disclosure components.** The shell
  visibly states which world it runs in (native host vs fixture harness);
  raw JSON error dumps become real disclosure components. A screenshot must
  never again be mistakable for the product or vice versa.
- **R6 — Verdict re-base.** After R1–R4: re-run the acceptance in the native
  app with the craft bar included; the fidelity oracle gains craft
  assertions; the parent closes on native computer-use evidence only.

**Sequencing:** R3's craft lanes are running now against the dev surface
(no installed cut is a prerequisite for UI craft); R1's candidate build runs
in parallel and becomes the native acceptance surface; R2 on owner nod; R4
bindings + R5 disclosure alongside; R6 re-base closes.

## 4. What this session's work is worth under this light

The seams and foundations are real and worth keeping — but they are
*scaffolding*, and the day's completion framings over-sold them. The product
bar (mockup-craft + working owners in the native app) is the actual
destination, and it is several dedicated lanes away, not a verdict stamp.
