

## 2026-09-08 · UI lead shell/pane tranche (user-directed topbar correction)

Original WIP safety checkpoint `79a446d` pushed before implementation. User
explicitly requested three parallel subagents and moved region controls from
footer to a window-wide, focused-pane-aware topbar. Built that strip, quiet
workspace footer, usable narrow focused-pane selector, persistent empty splits,
pane/tab operations and native detach/re-dock focus/draft recovery. Tab
activation and Close are now distinct native accessibility actions.

Functional: shell-recovery 36/36, surfaces 28/28, material 26/26, navigator
23/23, spatial 42/42 passed. Real app evidence includes empty-pane reload and
fill, width transitions, overlays and real HTML/CSS/JavaScript interaction.
Native macOS observations include topbar integration, split/fill, narrow pane
switching, editor focus, draft-preserving detach/re-dock, quit/relaunch and
separate tab activation/close/reopen. Browser screenshots are identified as
browser evidence; native screenshots remain in the task record.

Resource correction to earlier failing readings: explicit retained-heap
measurement after bounding renderer receipts to 256 produced 20,537.8 B/cycle
(<58,890 threshold), DOM 3.729/cycle, 20/20 successful sampled cycles. Earlier
failed/no-GC readings remain preserved. This is not native GPU/lifetime
acceptance. FND-06 and the full FND-00–06 gate remain open; provider helper
composition and native permission/failure coverage are unresolved.

System internal design is deferred to its separate task. Point-cloud options
are isolated proposals, not production interaction effects. Review and exact
file/build evidence: `desktop/cradle/walk/artifacts/review/SHELL-PANES-TRANCHE-2026-09-08.md`.
No phase advancement. Concurrent kernel, System and A2A work is preserved.
