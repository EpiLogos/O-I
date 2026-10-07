# ZCode → O-I cradle integration map

> Study deliverable of the ZCode desktop RE study (October 2026). Generated
> output of an agent study — reference until adopted by the owner.
> O-I side evidence: `evidence/B-EVIDENCE.md`, `evidence/B-DEPENDENCY-MAP.md`;
> ZCode side evidence per lane (`A1/A2/A3-EVIDENCE.md`).

Study: clean-room RE of ZCode desktop 3.14.3 as refinement source for the O-I
cradle. Every mapping names the exact O-I files that would adopt the pattern and
the implied work, and checks it against the cradle's standing law.

Standing constraint (lane B evidence: `desktop/cradle/src/contributions/contracts.ts`,
`packages/oi-design-system/DESKTOP-LANGUAGE.md`, `suite/desktop-projection.json`):
the cradle admits **compile-time contributions only — never runtime-loaded code** —
and adds no store or semantics of its own (the desktop is a projection surface;
meaning is always a native owner read). What is adoptable is *UI pattern +
semantics contract*, hosted over native owner verbs — never ZCode's runtime
plugin/scheduler architecture itself.

---

## 1. Automations (lane A2 → O-I Area 6)

ZCode shape: scheduler worker (20 s tick, CAS claims, 10-min stale reclaim) over a
shared SQLite store; declaration as cron carrier + `schedule_rule` JSON;
run-ledger with `skipped` rows carrying machine-readable reasons; retry backoff
`min(30s·2ⁿ⁻¹, 15min)` over 5 attempts; **5-minute late-fire window then
coalesce-and-skip**; lifecycle `active/paused/completed/failed`; one-shots
complete on `scheduled_run_count ≥ max_runs ?? 1`; cap 20; off-peak idle queue
behind server take-a-number tickets. Full spec: `AUTOMATIONS-SEMANTICS.md`.

| # | ZCode pattern | O-I adopter (exact files) | Implied work | Law check |
|---|---|---|---|---|
| A2-1 | **Recreated semantics in Rust** — the dispatch state machine, rule engine, cron carrier, documented constants | **Done in this study**: `desktop/cradle/reference/zcode-automation-semantics/` (26/26 tests; replays the live probe + observed skip). Adoption path: the kernel's new routine Create/Enable Request variants reuse these modules or their ports — the native create verb already exists (see A2-2) | None to land the reference; adoption = kernel wiring, unblocked | Clean (reference; not in kernel build) |
| A2-2 | **Declaration surface**: preset picker (once/hourly/daily/weekdays/weekly/monthly/custom) + custom repeat editor + **live next-run preview** + recurring toggle exposing max-runs + model/mode picker | `desktop/cradle/src/contributions/automations/Automations.tsx` (new create/adopt view beside Mine/Methods/History/Harness timers), `client.ts` (extend the `RoutineRequest` union), `kernel/src/routine.rs` (extend the closed `Request` enum) | **CORRECTED (owner check, 2026-10-07): nothing is blocked.** The native path exists — `aikit routine create` (from a `ProvenMethodBasis` produced by `aikit method prove`, sits in Draft until `aikit routine enable`; enable demands a fresh authority receipt, and schedule/event triggers additionally demand unattended authority; triggers are `aikit.time-schedule/v1` records or manual/event/external kinds). The surface's copy "awaiting a native verified-proof selection path" is stale. Remaining work is cradle wiring only: new Request variants + client verbs, and the create view mapping ZCode's form grammar onto it — presets → time-schedule record, proof selection → the Method's proven basis (refusal rendered when none), recurring/max-runs → the schedule record's own fields, mode/model → existing `modelRoster.ts` + `advertisedModes.ts` | Clean: UI over native verbs |
| A2-3 | **Run history as honest ledger**: trigger source, scheduled vs actual, duration, status incl. **skipped rows exposing their reason**, retry-queued badge with attempt number | `src/contributions/automations/Automations.tsx` (History view), `client.ts` (`routine invocations --with-outcomes` exists) | Map AIKit invocation outcomes onto the study's status taxonomy (succeeded/failed/running/skipped/stopped); render skip reasons in the owner's words per the `.oi-refusal` honesty law | Clean |
| A2-4 | **Semantics contract** for any suite scheduler: 5-min late window then coalesce-and-skip with recorded reason; backoff constants; one-shot completion rule; awake-only hint | This spec as acceptance reference for AIKit routine scheduling parity; verified by the same scripted-clock test used here (`cargo test` replays it) | Reference doc only | Clean |
| A2-5 | **Off-peak idle queue** (availability gate → ticket → schedulable flag → claim → settle; requeue-on-expiry with fixed continuation prompt; unique active per workspace+session) | None today. If ever adopted: new contribution `src/contributions/offpeak/` over a native AIKit verb | Explicitly not adopted now; recorded as the semantics reference | Clean to *not* adopt |

Gates: **passed live** — fire-at-time, one-shot completion, run-ledger outcome
settling, off-peak ticket/queue/sync behavior (see `AUTOMATIONS-SEMANTICS.md` §11).

## 2. Plugin/skill contract (lane A3 → O-I Area 7)

ZCode shape: two loaders converge on `~/.zcode/cli/config.json`; priority-numbered
discovery over `<base>/{.zcode,.agents}/skills` roots; collisions coexist in
listing (scope-tagged), user-first bare-name resolution, plugin namespacing
`plugin:name`; per-skill disable is a PATH-keyed config map; plugins enable via
`enabledPlugins["name@marketplace"]` over a ten-plugin official default set;
permission modes `plan|build|edit|yolo` (+ reserved `auto`) with a 13-step
decision ladder; hooks return `{decision, permissionUpdates}`; sha256-pinned
marketplace installs. Full contract: `PLUGIN-SKILL-CONTRACT.md`.

| # | ZCode pattern | O-I adopter (exact files) | Implied work | Law check |
|---|---|---|---|---|
| A3-1 | Enable/disable UX | O-I's staged-changes model is already stronger (`src/workspace/settings/sections/SkillsSection.tsx` + `changeModel.ts`: staged apply + undo + scope switch vs ZCode's direct config-map write). Keep O-I's | None — confirmation mapping | Clean |
| A3-2 | **Discovery-order + collision disclosure** (scope/source tags, coexisting collisions, user-first invocation) | `src/agency/harnessDisclosure.tsx`, `SkillSearch.tsx`, `settingsData.ts` (`watchSkillScope`) | If AIKit's disclosure lacks collision reporting (observed live here: two `central-session-strap` roots), file as an AIKit gap; the cradle renders what the disclosure returns | Clean: render-side only |
| A3-3 | **Permission ladder + hook decision envelope** (`{decision: allow|deny|escalate|modify, permissionUpdates}`) | `src/workspace/settings/sections/PermissionsSection.tsx` + `encounter/advertisedModes.ts` + runtime `PermissionCard.tsx`; envelope shape = comparison contract for AIKit permission requests | The `escalate`→user-prompt and `modify`→rewrite-input verbs are the notable surface beyond O-I's allow/refuse card | Clean |
| A3-4 | **Marketplace/installer contract** | NOT adoptable as runtime loading — collides with the compile-time admission law. Recorded as the contract reference if the suite grows native skill packs (installer = AIKit verb; UI = settings section) | Backlog note only | **Must NOT adopt runtime loading** |
| A3-5 | SKILL.md frontmatter contract (`name`/`description` ≤1024/`when_to_use`; unknown-key rule → explicit-invocation-only) | Comparison point for `central-skill-authoring` conventions (user ground) | Doc reference | Clean |

Gate: **passed** — e2e disable cycle live (`evidence/e2e/TRANSCRIPT.md`):
scratch skill 102→101→102 listed, byte-identical restore, no in-use plugin touched.

## 3. UI patterns & tokens (lane A1 → O-I Areas 1–5)

ZCode shape: Tailwind v4 `@theme` token table (317 root tokens + 142 `.dark`
overrides, oklch palette, alpha-tinted hairlines), runtime `--ui-font-size: 14px`
calc type scale, two-tier motion (`.15s` default + `cubic-bezier(.4,0,.2,1)`;
spring `(.34,1.56,.64,1)`; `--wf-*` subsystem; 46 keyframes), pre-paint `.dark`
class theming from `localStorage['zcode-theme']` (default `zai-dark`), Shiki
dual-theme code blocks bridged by `--sdm-c`/`--sdm-tbg` fallback vars, Web-Worker
diff rendering with 100-line hunk expansion, `virtua`-virtualized chat with a
48px pin-to-bottom state machine, token-driven 16-ANSI terminal palette.
Full sheet: `UI-TOKEN-SHEET.md`.

| # | ZCode pattern | O-I adopter (exact files) | Implied work | Law check |
|---|---|---|---|---|
| A1-1 | **Token coverage**, not framework: alpha-tinted hairlines (10% ink/paper), semantic→palette-stop indirection, trajectory family (`user/assistant/reasoning/tool-call/tool-result`), usage-chart/heatmap color-mix ramps | `packages/oi-design-system/tokens.css` under its section markers (`--oi-shell-*` wash/hairline already covers hairline; trajectory colors map to tape verb roles in the shell vocabulary/status roles) | Only genuinely new roles become new tokens — each with dark re-grounding in `.oi-desktop[data-theme="dark"]` + `themes/import-rules.json` entry if theme-convertible; `ds/checks/verify.mjs` enforces `--oi-*`-only consumption | Clean (owner-lawed token system) |
| A1-2 | **Runtime type scale** (`--ui-font-size` + calc steps, user-scalable) | `tokens.css` type section (`--oi-shell-type-*` ladder is fixed today); consumer: `src/workspace/geometry.ts`/shell CSS | Candidate accessibility affordance: a `--oi-shell-type-root` variable the ladder derives from, persisted via the visuals store (`src/visuals/store.ts`, kernel-persisted like custom themes) | Clean |
| A1-3 | **Motion patterns**: dominant `.15s`; spring bezier for pops; streaming chunk fade (`zcode-stream-text-in`); `prefers-reduced-motion` collapse | `tokens.css` motion section (`--oi-motion-fast/normal/ease` + shell durations); animations in `src/agent/chat/chat.css` | Port the *patterns* (per-chunk fade on stream reveal; reaction pop with overshoot bezier) — O-I's rAF prefix reveal (`streamText.ts`) stays the mechanism; CSS fade layers on top | Clean |
| A1-4 | **Theming mechanics**: pre-paint class toggle, system via matchMedia, default dark | O-I already resolves pre-paint (`cradle/index.html` inline script) and re-grounds ALL roles per theme (stronger than ZCode's 142-override layer) | None — parity confirmed, O-I approach kept | Clean |
| A1-5 | **Chat pin-to-bottom state machine** (48px threshold, stick/hold, direction classification) | `src/agent/chat/ChatTranscript.tsx` (reader-leads scroll + "Jump to latest" exists — the threshold-classified stick/hold refinement is the adoptable part) | Small: classify scroll direction + threshold, keep reader-leads law | Clean |
| A1-6 | **Tool-batch "load more"** + body preview truncation | `src/agent/tape/model.ts` (row folding exists) + `ChatTranscript.tsx` working-row renderer | Pagination affordance for long tool batches inside folded rows | Clean |
| A1-7 | **Code blocks**: Shiki dual-theme bridging (`var(--shiki-dark,var(--sdm-c,inherit))`), streaming highlight mode, copy/wrap controls | O-I chat markdown is its own lezer/GFM renderer (`src/material/markdown.ts`); syntax roles `--oi-syntax-*` exist; diffs use CodeMirror | The dual-theme **bridging-var pattern** is the adoptable trick if chat code blocks gain a second highlighter; streaming progressive-highlight is a candidate. Gate against `DESKTOP-LANGUAGE.md` (no raw JSON, real controls) | Clean |
| A1-8 | **Diff rendering**: Web Worker offload + hunk expansion (default 100 lines) | `src/git/DiffPage.tsx` + `diffModel.ts` (already virtualizes 22px rows) | Worker offload + expand/collapse hunks as performance patterns for large diffs | Clean |
| A1-9 | **Terminal**: token-driven 16-ANSI palette; xterm+pty backend | Parity: `--oi-terminal-ansi-*` + `TerminalSurface.tsx` re-reads roles live | None | Clean |
| A1-10 | **Layout geometry**: ≈270px sidebar, custom titlebar drag regions, z-scale 0–50 | `tokens.css` shell vocabulary (`--oi-sidebar-*` widths + min/max), Tauri-native drag already in the shell | Sidebar default width is unnamed in ZCode too (open question) — O-I's named tokens are the better shape; nothing to adopt | Clean |
| A1-11 | **Empty-state greeting** (time-of-day i18n) + quick-action chips | Chat empty state in `ChatTranscript.tsx`/composer | Small UX nicety; only if the owner wants it | Clean |

Gates: **determinism passed** (byte-identical twice-run captures; `rea`
verdict `identical`, 0 changed pixels — `evidence/A1-DETERMINISM.md`).
**Token reproduction gate partially met**: main screen measured within
tolerance (sidebar 271px; composer radius 12px = `--radius-xl`; composer 672×146px;
chips 32px = h-8) — settings/terminal screens were not capturable (AX presses
don't navigate the React UI; the live window sits on a non-current Space).
Capture path documented in `evidence/A1-EVIDENCE.md`; named as open item.

---

## 4. Explicitly not adopted (with reasons)

- ZCode's **runtime plugin/marketplace architecture** — collides with the
  cradle's compile-time admission law; only the staged-settings/disclosure UI
  patterns are adoptable.
- ZCode's **Tailwind framework** — O-I's law is plain `--oi-*` custom
  properties; only token *coverage* observations carry over.
- ZCode's **`.dark` override-layer theming** — O-I's full re-grounding per
  theme is the owner's law and strictly stronger.
- **Off-peak idle-compute queue** — no O-I surface today; semantics recorded
  for reference.
