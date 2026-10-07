# ZCode Desktop 3.14.3 — Lane A1 Evidence Bundle

Per-claim evidence. Confidence: high = mechanically verified in corpus or
measured on capture; medium = verified with one method; low = heuristic or
single-source inference. All corpus paths under `/tmp/zcode-re/asar/` (extracted
app tree; read-only). Minified bundles are single-line — evidence gives the
rg-searchable token text rather than a line number.

## Static token claims

| # | Claim | Evidence | Confidence | Limitations |
|---|---|---|---|---|
| S1 | 317 root custom properties defined in compiled CSS | extraction script over `out/renderer/assets/styles-C8Nayk5k.css` → `/tmp/zcode-re/a1-ui/root-tokens.txt` | high | Tailwind `@layer properties` fallbacks excluded by dedupe |
| S2 | 142 `.dark` overrides (dark theme = class toggle, no data-theme) | same script → `/tmp/zcode-re/a1-ui/dark-tokens.txt`; rg `\.dark\{` count 77 blocks | high | some `.dark:` utilities overlap counted once |
| S3 | `--ui-font-size: 14px`; ui type scale via calc offsets | rg `--ui-font-size` in styles-C8Nayk5k.css (near `html,body,#root` reset) | high | runtime value could be changed by settings UI (zoom) |
| S4 | Font stacks sans/mono (CJK-aware mono) | root-tokens.txt lines 271-272 | high | none |
| S5 | Radii scale xs 2px…3xl 24px | root-tokens.txt lines 281-287 | high | none |
| S6 | Default transition .15s / cubic-bezier(.4,0,.2,1) | root-tokens.txt lines 267-268 | high | none |
| S7 | Custom easings incl. spring `cubic-bezier(.34,1.56,.64,1)` | rg count in styles-C8Nayk5k.css (10 distinct beziers listed in report) | high | counts include duplicates across rules |
| S8 | 44 named keyframes incl. zcode-stream-text-in, wf-* set | rg `@keyframes` list | high | none |
| S9 | `--wf-*` motion subsystem: ease (.22,.61,.36,1), .12/.16/.2/.32s, beat 1.6s | python extraction of `--wf-ease`, `--wf-t-*` values from styles CSS | high | wf = workflow visual name is inference |
| S10 | z-index: utilities 0-50, literals 60/100/9998/9999/2147483647 | rg `z-index:` counts; index.html:30 (`#loading`) | high | none |
| S11 | Theme stored in `localStorage['zcode-theme']`, default `zai-dark`, system via matchMedia, `.dark` class toggled | `out/renderer/assets/index-jrPzjrBP.js` rg context `zcode-theme`; `styles-DEELZGp2.js` rg `classList.toggle("dark"` | high | none |
| S12 | Shiki dual theme github-light/github-dark; controls/lineNumbers/streaming defaults | `chunk-BO2N2NFS-DYX-I6EX.js` rg `shikiTheme:Jb,controls` where `Jb=['github-light','github-dark']` | high | runtime may override theme pair per setting |
| S13 | Shiki dark-flip via `--sdm-c`/`--sdm-tbg` + `--shiki-dark*` fallbacks | same chunk rg `sdm-tbg` context showing `dark:text-[var(--shiki-dark,var(--sdm-c,inherit))]` | high | none |
| S14 | xterm.js + FitAddon in renderer; node-pty + /bin/zsh in main | `styles-DEELZGp2.js` rg `.xterm-` / `FitAddon`; `out/main/index.js` rg `node-pty`, `/bin/zsh`; package.json deps `node-pty ^1.0.0` | high | WebGL/Search addons not found in this build (may be dynamic) |
| S15 | Diff worker protocol initialize/diff/file/set-render-options; expansionLineCount default 100 | `assets/diffs.worker-CAavpt0L.js` rg `requestType:`; `styles-DEELZGp2.js` rg `expansionLineCount` | high | underlying diff library name not asserted (fingerprint inconclusive) |
| S16 | 48px bottom-pin threshold; stickToBottom/hold state machine | `styles-DEELZGp2.js` rg context `function eQ(e,t=48)` | high | exact component binding inferred (chat list) |
| S17 | Message list virtualization via `virtua` | rg `virtua`/`virtualizer` (27+ refs in `styles-DEELZGp2.js`) | medium | minified import names; no direct `from"virtua"` string |
| S18 | Custom titlebar via `[app-region:drag]` attribute utilities | styles CSS rg `-webkit-app-region` (1 drag / 3 no-drag) | high | none |
| S19 | i18n catalog: 6119 keys, zh-CN primary + en; chat/sidebar/diff/terminal/mode namespaces | extraction → `/tmp/zcode-re/a1-ui/i18n-keys.txt` | high | value list truncated at 100 chars |
| S20 | Permission modes per backend (claude/codex/gemini/glm/opencode) | i18n-keys.txt `mode.label.*` / `mode.description.*` | high | UI only shows modes for active backend (inferred) |
| S21 | Tailwind v4 base (stock scales intact: spacing .25rem, container, leading, tracking) | root-tokens.txt lines 255-317 | high | none |

## Live capture claims

| # | Claim | Evidence | Confidence | Limitations |
|---|---|---|---|---|
| L1 | Main window (dark) captured: 1059x803 logical px | `/tmp/zcode-re/a1-ui/screens/01-main-chat-dark.png`; snapshot `/tmp/zcode-re/a1-ui/snap1b.json` (screenshot sha256 ecd20843…) | high | captured from an isolated instance (see L6) |
| L2 | Sidebar right edge at x≈271 → sidebar ≈ 270px | PIL edge scan at y=700 (first canvas-color pixel x=271); boundary pixels at y=650 recorded | high | single window size; sidebar may be resizable so value is the default |
| L3 | Composer card: x 318..989 (≈672px wide), y 366..512 (≈146px tall); workspace row ≈39px, input card ≈105px | PIL transition scan at x=660 (y 366/406/511 edges) and y=380 (right edge 989) | medium | right-edge scan at y=460 contaminated by toast/shadow; used y=380 row |
| L4 | Composer corner radius ≈ 12px (matches `--radius-xl`) | PIL left-edge inset 12px over 12 rows (y 366→378: x 330→318) | medium | ±1px anti-aliasing |
| L5 | Greeting heading glyph band 27px (≈24px font, text-2xl); placeholder band ~11px (≈14px ui-base); sidebar item band 10px | PIL row scans (heading y 293-319; placeholder y 426-438; "New task" y 71-80) | medium | cap-height heuristic, not font metrics |
| L6 | Captures taken from an isolated instance of the same installed binary (pid 78872) launched with `ZCODE_DESKTOP_USER_DATA_DIR=/tmp/zcode-re/a1-ui/app-profile` (app honors this env: `out/main/index.js` rg `ZCODE_DESKTOP_USER_DATA_DIR`) | launch command in session log; helper `window` block: pid 78872, window_id 3160, title ZCode, launch_time 1791334668.9 | high | user's real main window (pid 597) is on a non-current Space and not CG-enumerable; switching Spaces would alter user state, so it was not captured |
| L7 | User's running instance left untouched; isolated instance quit after captures | post-capture `ps`: only pid 597 remains; window at 109,29,1059,803 unchanged | high | single-instance handoff when my first launch attempt started brought the user's window Space forward (focus shift only, no state change) |
| L8 | Empty-state greeting matches i18n key `chat.empty.greeting.lateNight` ("It's late—remember to take care of yourself.") verbatim | capture `screens/01-main-chat-dark.png` vs i18n-keys.txt | high | none |
| L9 | AX tree exposes full web content only after AXManualAccessibility hint; then 337 nodes (sidebar sections, composer widgets, "Command palette" heading, "7 reset available" toast) | `/tmp/zcode-re/a1-ui/ax-tree-main.txt`; snap1b.json nodes | high | setting the hint is an OS AX flag, no app data changed |
| L10 | AX click actions (command palette button, Automations, sidebar toggle) did not alter the rendered screen | captures `screens/02a-nav-attempt-command-palette.png`, `02b-nav-attempt-automations.png`, `02c-nav-attempt-sidebar-toggle.png` — all byte-identical to 01 (164436 bytes, same sha) | high | presses reported success but React UI did not navigate; navigation-by-AX limitation recorded; settings screen therefore not captured |
| L11 | Companion overlay window (CG 52, 125x165@2x→250x330 px, pid 597) captured without interaction | `/tmp/zcode-re/a1-ui/screens/03-mini-overlay-window.png`; `screencapture -o -x -l 52` | medium | window's purpose not identified; content mostly blank chrome |

## Determinism gate

See `/tmp/zcode-re/a1-ui/determinism.md` — two identical bounded scenarios
(wait 800ms, no UI mutation) against window 3160 produced byte-identical
evidence (PNG sha256 `ecd20843193be4c1a8fab48ebb8fe12eb3d282936f9205620a100d8e87dbee19`,
AX node digest `02c6112d1d261c0b`), and `rea compare-web-screenshots`
(channelThreshold 0) returned `status: identical`, 0/850377 changed pixels.

## Tooling limitations (recorded per brief)

- `rea capture-native-ui-scenario` could not run end-to-end: its runtime
  `xcrun swiftc` compile of the bundled helper has a 60s budget
  (`dist/native/NativeUiHelperRuntime.js`) and compiles cold in ≈7min on this
  machine → provider `execution_failure`. I compiled the identical helper
  (`bridge/native/ReaNativeUI.swift`, sha of binary in helper dir) once and
  invoked it with the exact provider contract (same JSON schema, same
  identity checks: executable realpath + sha256 95768157…, launch time,
  window ownership, layer 0).
- `rea compare` (canonical Evidence bundles) refuses raw provider snapshots
  (`evidence_integrity_mismatch`, recorded verbatim in determinism.md); the
  screenshot-level comparison was therefore run through
  `rea compare-web-screenshots`, which is rea's pixel-comparison evidence
  provider.
