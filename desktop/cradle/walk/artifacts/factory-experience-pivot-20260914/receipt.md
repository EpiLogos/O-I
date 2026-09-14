# Factory experience pivot receipt — 2026-09-14

**Standing:** Browser, owner-read, selected native presentation, and Linux Rust evidence below have executed. This receipt does not claim an execution, populated roster, returned work, full campaign completion, or human acceptance.

The receipt is based on branch head `7c633da920ad0869ba219adf72587d583c0d9dad`, merged main `f0b4739602fda7f57f6ca5c50688064cfe6f0879`, and correction ancestor `35d2aa0aa61860f87b0b28b46965065bfd244d42`.

## Executed checks

- Owner roster, Factory Run, and material reads passed. The retained Run has two nodes and one edge; its Build has zero Candidates and Evidence.
- `node walk/surface-composition.mjs` passed 24 checks. [surface-composition-24.log](surface-composition-24.log) retains its output (trailing whitespace normalized).
- Browser walks passed: conversation placement 18; native Git return 13; session controls 19; Factory workbench 18; Factory Run content 20; empty Factory handoff 4; Agents capability gate 11 (103 checks total). The final empty-handoff result means the queued Run disclosed no retained task and the interface offered no Handoff.
- Session controls read the owner catalogue first. `gpt-5.6-luna` at `low` was already selected for native session `01a09ff3-f1fd-7f92-a156-2d85d11a9462`; refresh confirmed the same session. No model prompt or terminal input was sent. The public working-surface read confirmed `working-surface/oi-factory-demo-20260914-shell` to `surface/terminal/factory/shell` and its current tmux marker.
- `cargo test -p oi-cradle --bin oi-cradle -- windows::tests` passed 3 tests. [linux-rust-3-tests.log](linux-rust-3-tests.log) retains the command output (trailing whitespace normalized).

## Native presentation evidence

Parent CUA captured the native Git view in the right region, promoted, and redocked:

- [git-native-right.png](git-native-right.png)
- [git-native-promoted.png](git-native-promoted.png)
- [git-native-redocked.png](git-native-redocked.png)

The Git view reread current owner-observed working state when opened in the new native window. These captures do not assert a byte-exact frozen patch.

## Exact browser evidence

- [browser-factory-workbench-18.log](browser-factory-workbench-18.log)
- [browser-factory-run-content-20.log](browser-factory-run-content-20.log)
- [browser-factory-handoff-empty-4.log](browser-factory-handoff-empty-4.log)

Known native refs are Project `project:o-i`, AgentSession `agent-session/oi-factory-codex-20260914`, SessionSpace `session-space/oi-factory-demo-20260914`, and native session `01a09ff3-f1fd-7f92-a156-2d85d11a9462`.

## Remaining joins

The remaining native joins are Agent/Profile/AgentSet admission and AgentSession attachment; shared Start/formation including temporary or child work; Factory execution correlation to Agency, AgentSession, Activity and Return; returned-artifact material resolution; and a canonical Routine catalogue with schedule, last outcome and next read.


## Final integration readback

The production build and native Linux build passed. The rebuilt native app restored the saved workspace and conversation; its Inspect controls disclosed the already selected Luna/low session and opened the same persisted tmux Surface. See `agents-native-final.png`, `inspect-native-final.png` and `working-native-final.png`.

The real public Central catalogue now crosses the read-only O:I `central_actions_read` operation. It returned 150 owner descriptors, with no `agent-profile.express`. The intent form is therefore omitted. This catalogue does not grant authority. An independent native kernel test matched the public catalogue, preserved the snapshot and emitted no receipts (1 passed). Kernel all-target tests passed (32, with other owner-gated tests explicitly ignored); all-target clippy passed with warnings denied. Production Agents capability-gate walk passed (11); final Git document walk passed (13). Together the seven recorded browser walks contain 103 checks.

This is a tested presentation/consumer increment; the missing native joins above still prevent complete #289 acceptance. No full Factory execution, all-harness acceptance or H claim is made.

The subsequent Git-retention fix and expanded 34-check walk are recorded in [the follow-up receipt](../git-review-retention-20260914/receipt.md). The 13-check Git log above retains the original increment's standing.
