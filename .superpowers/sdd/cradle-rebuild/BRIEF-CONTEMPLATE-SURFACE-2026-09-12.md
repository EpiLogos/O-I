# BRIEF — W1.4/W1.5 flow cognition, the desktop half — 2026-09-12

The owner's direction stands: the design was settled in planning, the owner
operations are LIVE on the installed cut (`aikit flow preflight|contemplate|
changed-since`, probed this session), and "no desktop surface speaks them" is
the only remaining gap. This cell closes it. What was called "owner-gated"
was mostly stale survey + over-deferral; the honest-unavailable law was always
permission to build, not to wait.

## Design citations (already authored, not re-decided)

> "explicit `Contemplate(FlowRef)` preflight/Explain disclosure — depends on
> AIKit #122 flow cognition state; never auto-invoked (#138 §7)" — wayfinder §6 W1.4.
> "'what changed relative to this thought': changed sources, affected
> knowledge, unresolved — from Central/AIKit seams (#138 §6)" — wayfinder §6 W1.5.
> "`aikit flow preflight` … Inert: records nothing" / "record-gated execution"
> / "changed-since … each with provenance" — the installed owner CLI.

## Files

- `desktop/cradle/src/flow/contemplate.tsx` (new) — client helpers
  (`contemplateFlow` via the kernel's typed `action:contemplate-flow`
  dispatch, bare = preflight; `input.execute` carries the held record
  verbatim; `changedSince` via `flow_changed_since`) + the `FlowCognition`
  section: idle until the explicit act; the owner's answer renders VERBATIM
  (`data-owner-payload` / `data-owner-refusal`) — record on success, the
  owner's own words on refusal or unavailability; "Execute Contemplate"
  exists only once a preflight record is held; the what-changed strip exists
  only once a thought exists and renders both owner sides (horizon + aikit
  receipt) explicitly, never faked empty.
- `desktop/cradle/src/flow/FlowSurface.tsx` — mounts the section below the
  conflict block.
- `desktop/cradle/src/flow/flow.css` — cognition styles (file-family idiom).
- `desktop/cradle/walk/scenarios/contemplate.mjs` + `walk/run.mjs` — the
  walk (alias `w14`), AIKit-home isolation held (private AIKIT_HOME).

## Walk contract

1. At rest: the section is idle — no disclosure, no execution, no read
   (never auto-invoked).
2. The explicit preflight act surfaces the owner's answer verbatim; on a
   ground whose store does not hold the Flow's knowledge node the owner's
   own refusal (`no Flow node resolves …`) IS the disclosure, and nothing
   executed (no payload, no execute control, no contemplate event).
3. Execution and the what-changed strip are structurally unreachable without
   a held preflight record.
4. Full regression floor green (17 suites).

Named open (owner lane, ai-kit store provisioning): a ground whose aikit
store resolves the Flow's knowledge node exercises the preflight-record →
record-gated execute rendering in the browser; the payload path itself is
proven by the kernel's flow_cognition/action_dispatch suites.

## Standing

Branch `agent/oi-contemplate-surface`, cut from origin/main `f76d662` (#244).
