# Factory review and NOW continuation — 2026-09-15

Continues O-I #289 through draft PR #292 from `c05ffeb6c39a901fc3599a39c34a228ae5992979`. Main `267a688b81d1cc5e71071bad382fa6ee49602e4f` was first merged as `d4a3d28c6e2a1350c3f9cb6ce9aa4a1d13789457`. The U increment is `97c8bb9`; newly landed main `5b328af754bfc4ea3762bd0cc44f10771c335909` (#310, EX1) is incorporated by `946d51de05837eaffe2f6ba6426723871f27b59a`. Work stayed in the existing Omarchy checkout; the Mac checkout and owner installations were not changed. Three bounded Luna/Terra workers supplied native-readiness, result-consumer and NOW work/review; the primary integrated, tested and operated the desktop.

Authority: `docs/experience/FACTORY-AGENCY.md`, #289 owner correction `35d2aa0`, #220 lane U allocation, SESSION-GROUNDING §11–14, and the accepted September 14 correction brief, arrangement wayfinder and Ta-Onta amendment. This is an implementation receipt, not another design.

## Changed behavior

Factory Candidate/Evidence and Handoff Surfaces retain an exact owner response, bound to state path, Run, subject/task and revision, within 64 KiB. Reload, pane moves and detached-window persistence consume that retained presentation. Invalid, oversized, mismatched or wrong-kind snapshots preserve the workspace with explicit Refresh recovery. Different material revisions require explicit selection; Handoff Refresh preserves the selected task or discloses its absence. Independent review found no remaining identity, stale-response or hydration-loop defect. Factory adapters remain Factory-owned.

NOW relations now request native `central.now.read` with `with_placement:true` through the existing Action dispatch. Obligation refs, archive state, placement destination and policy revision render from the owner. The root register stays explicit. The shared walk runner accepts the same optional Chromium executable path as the standalone walks. Run-content acceptance now consults the real Action catalogue before expecting an Agent Expression form.

## Executed checks

| Check | Result |
|---|---|
| Production `npm run build`; separate `WALK=1 npm run build` | passed |
| `node walk/surface-composition.mjs` | 24 assertions |
| `factory-review-read.mjs` / `factory-review-recovery.mjs` | 11 / 15 |
| `conversation-placement.mjs` / `factory-workbench.mjs` | 18 / 18 |
| `git-return.mjs` / `session-controls.mjs` | 33 / 19 |
| `factory-run-content.mjs` / `factory-handoff.mjs` | 18 / 4 |
| `SKIP_BUILD=1 WALK_URL=http://localhost:4173 WALK_BRIDGE_PORT=4189 WALK_CHROMIUM_EXECUTABLE=/usr/bin/chromium node walk/run.mjs now-relations` | 20 real native assertions, temporary authorized ground |
| `cargo test --manifest-path desktop/cradle/kernel/Cargo.toml --all-targets -j2` | 32 library tests; owner-dependent ignored tests remain ignored |
| `OI_BIN=/home/frank/.local/bin/oi OI_CENTRAL_ROOT=/home/frank/Central cargo test --manifest-path desktop/cradle/kernel/Cargo.toml --test native_action_catalog -- --ignored` | 1 real catalogue parity test |
| Kernel `cargo clippy --all-targets -j2 -- -D warnings` | passed |
| `cargo test --manifest-path desktop/cradle/src-tauri/Cargo.toml --bin oi-cradle -j2 -- windows::tests` | 3 passed |
| `cargo build --manifest-path desktop/cradle/src-tauri/Cargo.toml -j2` | passed |

Standalone Factory walks used the real `header-continuity.state.json`, Run `run:01ARZ3NDEKTSV4RRFFQ69G5FCD`, Central Project `project:o-i`, Chromium `/usr/bin/chromium` and bridge port 4179. The frozen Factory executable and installed hashes are in `native-executable-basis.json`; its override was preserved. Logs, JSON readbacks and `source-sha256.json` accompany this receipt. Published log copies trim trailing whitespace; the original logs remain in task scratch.

## Actual desktop observation

The rebuilt native app reopened the saved workspace and connected to the existing resident provider. Native Inspect disclosed Luna/low and provider session `01a09ff3-f1fd-7f92-a156-2d85d11a9462`. `Open working surface` resolved `working-surface/oi-factory-demo-20260914-shell` through public operations and showed the retained terminal marker. Factory entry and central Conversation retained the same session; selecting its Conversation plane showed one composer and the existing replies. Leaving Factory restored the terminal and accompanying conversation. No prompt or terminal input was sent during this continuation.

The visible dots came from compositor transparency: the scoped opacity rule matched `oi-cradle` while the running X11 class was `Oi-cradle`. Updating that existing host rule to `^[Oo]i-cradle$` removed the bleed-through. Engine readback had one hidden, idle canvas, with no active presentation. `recovered.png`, `opaque.png` and `native-expression-reading.json` record the distinction. The native screenshots retain visible desktop crash notifications; they do not certify crash-free WebKit.

A Chromium temporary-storage quota failure was resolved by moving this task's scratch/backups to disk. The disk scratch setting was initially also used for a desktop restart; AIKit derives its resident socket from the temporary directory and refused a second resident lock. Restoring the desktop's original environment reconnected the existing process. Test scratch and desktop runtime are now separate. No resident/provider was killed or replaced. All 664 original walk artifact files were restored byte-for-byte after copying new evidence here.

## Verification after current-main integration

After EX1 landed during the campaign, the primary merged it into this branch, retained both the U Stage lifecycle checks and the new scene/selection projection, and obtained an independent Terra review. Factory still presents through the shared Expression Stage. The production code does not register Epi/Nara focused instruments; controlled-host tests cannot establish their parity gate.

On `946d51d`, production web, native Linux and CLI builds passed. Kernel all-target checks passed 32 library plus 8 Expression tests; other owner-gated tests remain ignored. The separate installed-Central Expression run passed all 9 tests; the native engine round trip passed 10 assertions; kernel clippy and all 3 window identity tests passed. Post-merge browser regressions passed 18 conversation, 18 Factory and 15 review-recovery assertions. Exact commands and logs are under [main-integration](./main-integration/).

The rebuilt native app reopened the same workspace and resident Codex session. Factory entry/Conversation/ordinary return preserved one composer and the exact persisted terminal. [Native observation](./native-main-observation.json) records the running binary hash and bounded readback; [the screenshot](./main-native-returned.png) shows the ordinary return. The mode-0600 Expression socket and the freshly built, uninstalled CLI both returned `oi.expression-capabilities/v1` from the running application. See [socket readback](./main-native-expression-capabilities.json) and [public CLI readback](./main-cli-expression-capabilities.json). This confirms the generic application API, not Factory execution or instrument registration.

## Remaining owner joins and standing

- **Agent Start/formation:** Central lists Profiles/Sets truthfully empty, resolves sets and supports `agent-profile.propose`; the current catalogue does not advertise `agent-profile.express`. AIKit compose and `factory start-work` consume existing native requests, but no published, installed shared resolver from selected Agent/Profile/AgentSet/temporary formation to admitted Direct/Factory SessionSpace is established. AIKit #311/#312 remain lane A work.
- **Execution/authority:** Actuation #85 has source authority issue/resolve/revoke under `actuation.local-authority/v1`; the installed CLI does not expose those routes. Authority foundations exist. This authorized Factory state remains queued, with zero executions, Candidates, Evidence and retained tasks. No successful correlated Agency/session/activity/Return invocation is claimed.
- **Material:** the frozen Factory Build/task reads work. No successful public body/location/native-Surface resolver and immutable artifact basis has been established for the opaque artifact refs. Populated Candidate/Evidence/Handoff retention and native repair/evidence/Recognition acceptance remain unproved.
- **Git:** `aikit.development-field-reading/v1` still reports the primary checkout at `4f0018d`, despite requesting this worktree. Its mismatched patch remains withheld. The separate ordinary Git review walk uses the actual disclosed primary basis. See `requested-worktree-owner-read.json`.
- **Temporal:** NOW reads work. `central.day.read` has no current DayRef/pointer in the inspected scope; no day was created or rolled over. Routine invocation reads exist; catalogue/occurrence/enable/pause contracts remain missing.
- **Instruments:** K9 is controlled-host evidence; no production registration caller was found. #310 is now merged; its generic `oi.expression/v1` application API works in the running desktop. It does not register Epi/Nara instruments. The Epi/Nara/Factory parity sequence still awaits runtime registration.
- **Harnesses:** Codex has current live SessionSpace/provider evidence. Pi's earlier attempt failed for missing credentials; its retained ref is not current admission. Claude, Hermes, Hermes-ACP and Gemini are detection only. No all-harness or Factory admission claim follows from executable detection.

D/C evidence covers implemented consumers and executed checks. P/M evidence is bounded to the existing Omarchy process/session/terminal and presentation return. It does not establish commissioned Factory execution, cross-host continuity or the full §11–14 gate. H remains the owner's act. PR #292 remains draft.

The next executable step belongs to lane A: publish and install the shared Start/admission plus scoped Factory execution/Return and artifact contracts, with exact real invocation refs. Lane U then consumes that cut for the accepted joined walk. Preserve the working frozen Factory runtime until replacement reads are verified.

The existing project NOW record is retained as the single return. Its native `projectcentral.now.update` supports status and preserve refs but cannot revise subject/result/evidence fields. `central.files.read` explicitly discloses writes to that owner state as unavailable. The continuation therefore links the new publication/receipt through native preserve refs; the old result text cannot yet be revised in place through the installed API.
