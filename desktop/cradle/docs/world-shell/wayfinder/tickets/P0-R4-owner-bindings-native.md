# P0-R4 — Owner bindings in the native run

Label: wayfinder:task (Phase 0)
Claimed-by: — (released W0d, 12 Oct: code legs and honesty nit committed; native walk and owner ops open)
Blocked-by: P0-R1

Zones: `packages/live-shell/src/` binding glue and
`packages/live-shell/ui/src/agent/`; owner-side operations are NOT in this
zone — they are tickets on the owners' own seats (ai-kit, workcell, central).

## Question

Turn the "not admitted" wall into admitted devices or precisely named
absences, in the native app: roster (ctrl roster fix is installed —
`7a45111` ⊇ `efef5c3`), gateway attachment, workcell reading grant,
skillset admission. Then the three missing owner ops from the chain-drag
table — `agent-chain skillset admit`, `workcell git-seat attach`,
`agent-chain order`: each is either built by its owner (own ticket, own
seat) or declared absent by its owner.

## Acceptance

Per device family: admitted through a real owner reading, or a disclosure
naming the owner, the missing op and the remedy. Computer-use walk in the
native app. Matrix cells updated where a product's capability changed.

## Resolution

### W0c — code legs landed, 12 Oct 2026 (ticket stays open)

**Landed.** `7b59fecad` (builder, converged and pushed by the conductor),
zone `packages/live-shell/ui/src/agent/` and one test file;
`packages/live-shell/src/` unchanged. Dispatched while Blocked-by P0-R1
still held: only the code legs are done.

- `agentChainDrag.ts` gains `OWNER_BINDINGS` beside `MISSING_OPS`: roster →
  Central (`agent_definition` roster); gateway reading → AIKit
  (`harness_agent_read`; transport face Actuation's); workcell → Workcell
  (`workcell_status_read`); skillset rack → AIKit. Cited from
  `AGENT-DEVICE-OWNERSHIP.md:20,22,27,30,37` and `DLW-PLAN.md:1706-1713`
  (re-opened by the conductor).
- Missing ops carry owner and remedy: `agent-chain skillset admit` → AIKit,
  `workcell git-seat attach` → Workcell ("builds it on its own seat, or
  declares it absent"); `agent-chain order` → no owner named, disclosed as
  such. Drop and slide refusal cards carry owner and remedy; the drop zone
  reads "owed by <Owner>".
- Gateway lamp honesty bug fixed: `NativeAgentDeviceRack` defaulted
  `gatewayAdmitted = true` and `AgentDeviceChain` never passed it; the lamp
  now lights only on an answered, non-refused `harness_agent_read`.
- The "not admitted" wall becomes a named wait ("waiting · <Owner>"; aria
  "not admitted — waiting on <Owner>"); refusals read "waiting on <Owner> —
  <reading> refused: <owner's words>"; a shell transport failure reads "not
  reached".
- `AgentShellBrowser` misattribution fixed: a refused roster read names
  Central's roster, not the ai-kit skillset registry. The pool now receives
  the roster-derived skill admission.

**Checks (scripted, conductor re-run).** `cargo check` pass; tsc 0 errors;
agent suites 86/86 (81 + 5 new); run-context guard and devices-panels SSR
8/8; branch in sync with origin after push.

**Unverified (channel).** Native-window walk per device family at
`7b59fecad` from a clean rebuild (`computer-use`; gated on P0-R1 and PATH
§3). Native-run admissions (Central roster via bundled ctrl `7a451112a1a4`,
AIKit `harness_agent_read`, Workcell `workcell_status_read`) not exercised;
the Git lamp is expected to read "waiting · Workcell" (code-reading only).
Matrix: no product capability changed, no cells updated.

**Not met.** The three missing ops are not yet built or declared absent by
their owners; refused readings name owner and op but carry no remedy by
design.

**Carries:** PATH §10 items 25–30, 32, 33 (honesty nit item 27; owner
tickets item 29; `agent-chain order` owner item 30; WIDGET-GUIDE proposals
item 33).

### W0d — honesty nit landed, 12 Oct 2026 (ticket stays open)

**Landed `4a5887376`** (zone `ui/src/agent/AgentShellBrowser.tsx` and
`ui/tests/agent-shell-browser-rows.test.mjs`). PATH §10 item 27.
`gitRowsFromWorkcell` now returns the refused row (key `seat-unavailable`,
meta "workcell · refused") only when `seatError` is set
(`AgentShellBrowser.tsx:115-120`). An answered seat without a
`workcell_ref` reads as answered (key `seat-no-ref`, label "Git seat
answered - workcell_status_read disclosed no workcell_ref", meta
"workcell · no ref", `:122-127`). No reading and no error reads as unread
(key `seat-unread`, label "Git seat not read", meta "workcell · unread",
`:130-132`), where it previously read as refused. Three new tests.

**Checks (scripted, converge re-run).** tsc 0 errors; agent suites 89/89
(86 + 3); `agent-shell-browser-rows` 11/11. Conductor re-run at
`4a5887376`: lane suites 169/169.

**Unverified (channel `computer-use`).** The rendered Git row in the native
window.

**Still open (unchanged by W0d).** The native-window walk per device family
(PATH §10 item 25); native-run admissions (item 26); the owner ops (items
29–30); items 28, 32, 33.

**Carries:** PATH §10 items 43 (the new unread state; label renamable), 47.
Item 27 is done. WIDGET-GUIDE: none from this leg.
