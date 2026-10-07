# Recreation & adoption backlog — ZCode desktop RE study (2026-10-07)

> Study deliverable — generated until adopted. Each item carries its verify
> gate. Owner adoption turns an item into commissioned work.

## Done in this study

- **B1 — Automations semantics recreated in Rust** ✅
  `desktop/cradle/reference/zcode-automation-semantics/` — rule engine
  (six units), cron carrier (documented grammar), dispatch state machine
  (claim/stale-reclaim/late-window/coalesce-skip/backoff/give-up/completion),
  all documented constants. Clean-room: written from
  `AUTOMATIONS-SEMANTICS.md`, not from recovered source.
  **Gate: PASSED** — `cd desktop/cradle/reference/zcode-automation-semantics && CARGO_TARGET_DIR=/tmp/cargo-target cargo test` → 26/26, including a
  minute-level replay of the live probe and the observed 32-min-late skip.
- **B2 — Automations semantics spec** ✅ `AUTOMATIONS-SEMANTICS.md`
  (+ live-verification addendum §11). Gate: PASSED (fire-at-time, one-shot
  completion, outcome settling, off-peak ticket/queue/sync — live store).
- **B3 — Plugin/skill contract** ✅ `PLUGIN-SKILL-CONTRACT.md`.
  Gate: PASSED (e2e skill disable cycle, byte-identical restore,
  `evidence/e2e/TRANSCRIPT.md`).
- **B4 — UI token sheet + flow determinism** ✅ / ◐ `UI-TOKEN-SHEET.md`.
  Determinism gate: PASSED (byte-identical twice-run captures, rea verdict
  `identical`). Token-reproduction gate: PARTIAL — main screen measured within
  tolerance (sidebar 271px, composer 672×146px radius 12px, chips 32px);
  settings/terminal screens not capturable this run (open item O1).

## Adoptable refinements (proposed, each with its gate)

- **R1 — Chat pin-to-bottom state machine** → `cradle/src/agent/chat/ChatTranscript.tsx`.
  Port the 48px-threshold stick/hold + direction classification behind the
  existing reader-leads law. *Gate: Playwright walk scenario (`walk/*.mjs`)
  proving hold-on-scroll-up, jump-to-latest pill, and re-stick at bottom.*
- **R2 — Diff hunk expansion + Web-Worker offload** → `cradle/src/git/DiffPage.tsx`,
  `diffModel.ts`. Expand/collapse hunks (ZCode default 100 lines); move diff
  shaping off the main thread for large diffs. *Gate: large-diff walk scenario;
  render timing before/after; kernel `git_diff_read` seam unchanged.*
- **R3 — Streaming-reveal fade layer** → `cradle/src/agent/chat/chat.css` on top of
  `streamText.ts`'s rAF prefix reveal (ZCode's per-chunk `zcode-stream-text-in`
  pattern). *Gate: reduced-motion collapses the fade (per house motion law);
  visual walk on slow + fast streams.*
- **R4 — Tape/trajectory color roles** → `oi-design-system/tokens.css`
  (trajectory family: user/assistant/reasoning/tool-call/tool-result mapped onto
  existing tape verb model). *Gate: `ds/checks/verify.mjs` + dark re-grounding +
  `themes/import-rules.json` entry if theme-convertible.*
- **R5 — User-scalable type root** → `oi-design-system/tokens.css` type section +
  `cradle/src/visuals/store.ts` persistence. A `--oi-shell-type-root` the shell
  ladder derives from (ZCode's `--ui-font-size` pattern). *Gate: setting
  round-trip through the visuals store; pre-paint resolution unchanged; ladder
  snapshots at 2 scales match calc expectations.*
- **R6 — Automation declaration surface** → `cradle/src/contributions/automations/`
  (create/adopt view, presets + custom repeat, mode/model pickers) +
  `kernel/src/routine.rs` Request variants + `client.ts` union.
  **IMPLEMENTED 2026-10-07** (uncommitted, working seat): Draft view with
  Method select, proven-basis attachment (JSON or @file), trigger builder over
  the native `aikit.time-schedule/v1` shapes (manual/daily/cron/every/once),
  structured authority (no raw JSON), client-side proof-gate refusals, and
  enable/reprove adoption forms on the routine detail. The stale
  "awaiting a native verified-proof selection path" copy is replaced.
  **GATE DEVIATION (decided in-loop):** the next-run preview uses the stored
  Draft's **native occurrences** (AIKit/Central resolve instants —
  `central.time.occurrences` owns the calendar), not a TS port of the Rust
  engine; a second client-side calendar authority would fight the world's
  own law. The Rust crate remains the ZCode-parity reference, not a UI
  dependency. *Gates RAN 2026-10-07: kernel routine tests **6/6 on a clean
  HEAD export** (whole-seat lib build blocked by the parallel wiki-links
  lane's in-flight `graph.rs` — their hand, untouched); client builder tests
  **10/10** (`node --test tests/knowledge-automations.test.mjs`); `tsc`
  clean in all touched files (whole-program gate blocked by the same lane's
  untracked `remoteRows.tsx`); `vite build` **bundled clean (46.5s)**.
  Still owed: the seat's own green (`cargo test` full, `npm run build`) once
  the parallel lane compiles; and the live fire (create → enable → scheduled
  run), which needs a proven Method basis and an owner-granted unattended
  authority receipt — owner authority, honestly outside this lane.*
- **R7 — Run-history ledger rendering** → `cradle/src/contributions/automations/`
  History view: skipped rows exposing their reason, retry-queued badge, status
  taxonomy. *Gate: walk scenario rendering a skipped invocation with reason; AIKit
  outcome mapping table reviewed.*

## Not adoptable (standing record)

- **N1 — Runtime plugin loading / marketplace installs** — collides with the
  compile-time admission law (`cradle/src/contributions/contracts.ts`); the
  documented contract (`PLUGIN-SKILL-CONTRACT.md` §6) is kept as reference only.
- **N2 — Tailwind framework** — house law is `--oi-*` custom properties;
  only token-coverage observations carry over (R4, R5).
- **N3 — `.dark` override-layer theming** — house law re-grounds every role per
  theme; strictly stronger than ZCode's 142-override layer.
- **N4 — Off-peak idle-compute queue** — no O-I surface; semantics recorded in
  the spec for future reference.

## Open items (named, unresolved)

- **O1 — Token-reproduction gate partial**: settings/terminal screens not
  captured (AX presses don't navigate the React UI; live window on a
  non-current Space). Capture path that works: isolated instance via
  `ZCODE_DESKTOP_USER_DATA_DIR` + rea's bundled capture helper (60s swiftc
  budget vs ≈7min cold compile blocks `rea capture-native-ui-scenario` itself).
- **O2 — Sidebar width** has no named token (270px observed, between the
  `w-[260px]`/`w-[280px]` utilities present in the CSS).
- **O3 — Mini overlay window** (CGWindow 52) purpose unidentified.
- **O4 — DST gap/repeat** behavior of local-time schedules: untested in app and
  unmodelled in the crate (JS `Date` semantics presumed).
- **O5 — `lifecycle_status='expired'`** literal exists in the bundle; no writer
  found in this build (dead value or server-driven).
- **O6 — Off-peak `awaiting_approval`** status: legacy or reachable? Rewound to
  `running` at DB init.
- **O7 — `bot_delivery_target` / `location_kind='remote'`**: no writer found in
  this build (likely chat-created automations only).
- **O8 — Persisted allow/deny rule file grammar**: decoded from code; no live
  file existed to confirm.
- **O9 — `plugins enable|disable` CLI** not executed (all installed plugins
  in-use); the config-map mechanism proven instead for skills.
- **O10 — Host-vs-CLI discovery precedence** diverges in one respect (host:
  workspace before user; CLI priority counter: user before project); bare-name
  invocation observed user-first once.
- **O11 — Rich cron syntax ceiling**: app parsers accept plain numeric crons;
  whether exotic Croner syntax survives IPC end-to-end untested.
- **O12 — Off-peak probe** still queued (~position 33) awaiting an idle-compute
  window; single-line no-tool prompt, will settle unattended.
- **O13 — rea authenticated asar analysis** refuses the bundle (unpacked-native
  `node-pty` hash mismatch — packaging artifact); extraction-based analysis used.
