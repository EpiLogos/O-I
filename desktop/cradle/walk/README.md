# The cradle walk harness (U0.6)

The cradle's own verification instrument — map §3 D10: *"a typed, dev-only
channel in the cradle (`__cradle.walk`): invoke operations, read state,
capture receipts/screenshots. Dev tooling only — no new renderer
authority."* This directory is its relation cell: **S, its own verification
instrument**. Per `docs/cradle/05-EXECUTION.md §3`, walks are the
acceptance — prose, test output, and contract tests do not establish a UX
condition — and the harness turns each walk into **data**: a
machine-readable receipt JSON plus screenshots under `walk/artifacts/`.

## How to run

```bash
cd desktop/cradle
node walk/run.mjs all            # rest + surfaces + kernel-cas, in order
node walk/run.mjs rest           # one scenario
node walk/run.mjs u0.4          # aliases: u0.3 / u0.3b / u0.4
npm run walk -- all              # same through the package script
```

What the runner boots, as needed:

1. **The walk bundle** — `WALK=1 npm run build`: the normal production
   pipeline (`tsc --noEmit` + `vite build`) with the dev/walk channel
   baked in (`SKIP_BUILD=1` reuses `dist/`).
2. **`vite preview`** serving that bundle on `http://localhost:4173`
   (`WALK_URL=<url>` drives an already-served bundle instead).
3. **The dev-only walk bridge** (`kernel/src/bin/walk-bridge.rs`, cargo) —
   the same typed `KernelOp` seam the Tauri host fronts, over loopback
   HTTP, fronting the real kernel with the real `ctrl` on PATH. Booted
   fresh per kernel scenario so each event log starts at seq 1.

Each scenario writes `walk/artifacts/<scenario>.json` (the receipt) plus
`walk/artifacts/<scenario>-<label>.png` screenshots. The receipts for the
three standing scenarios are **committed as evidence**; re-running the walk
regenerates them.

Scenarios (ported from the ad-hoc u0.3/u0.3b/u0.4 scripts, which are
retired):

| scenario | proves | key checks |
|---|---|---|
| `rest` | austere rest (map §5 U0.3) | exact 6-node census, caret in canvas, To: keyboard path, cold-start FCP, honest unavailability without a bridge |
| `surfaces` | surface management (map §5 U0.3b) | open/split/tile/move/pin/close/reopen via keyboard AND pointer, D15 menu disclosures, D17 depth states, reload restore, close-all → rest; kernel log monotonic |
| `kernel-cas` | the kernel seam (map §5 U0.4) | real horizon listing, open/edit/save with revision advance, structured conflict with both sides preserved, channel-driven re-read + save, channel-driven focus change, log monotonic 1..N |

## The op vocabulary

The channel (`window.__cradle.walk`, defined in `walk/client.ts`) speaks
three op categories. **Every op returns one typed receipt:**
`{ok, op, seq_range?, duration_ms, data}` — `seq_range` is the inclusive
receipt-seq range the op produced (absent when it produced none).

### invoke — typed calls over the same `KernelOp` seam

Method names mirror the KernelOp tags; every receipt's `op` field is the
path you called (`invoke.source_save`, …).

| op | kernel op | notes |
|---|---|---|
| `invoke.kernel_op(op)` | any | the seam primitive the conveniences wrap |
| `invoke.source_open(ref, project?)` | `source_open` | open a source into the buffer layer |
| `invoke.source_edit(ref, content)` | `source_edit` | set the cradle-held dirty buffer |
| `invoke.source_save(ref, project?)` | `source_save` | CAS-save through the owner's write |
| `invoke.source_reread(ref, project?)` | `source_reread` | rebase onto the canonical layer (conflict reconcile) |
| `invoke.surface_focus(surfaceId)` | `surface_focus` | move the one global focus relation |
| `invoke.surface_open({surface_id, kind, source_ref?, title})` | `surface_open` | register a binding kernel-side |
| `invoke.surface_close(surfaceId)` | `surface_close` | close a binding kernel-side |

### read — kernel state as data

| op | returns |
|---|---|
| `read.state()` | the whole kernel snapshot |
| `read.focus()` | the one global focus relation |
| `read.events(sinceSeq?)` | the ordered event log after a cursor |
| `read.sources(project?)` | the owner-disclosed participating sources |
| `read.layout()` | the frame's persisted layout read model |

### capture — measurements and snapshots

| op | returns |
|---|---|
| `capture.timing()` | in-page timings: `fcp_ms` (cold start), DCL, load |
| `capture.events(sinceSeq?)` | receipt snapshot with seq numbers + capture time |

Screenshots (`capture.screenshot` in receipts) are taken by the runner,
which owns the browser, into `walk/artifacts/`.

### Metrics as data (map §8)

The harness captures the shell-row metrics into each receipt's `metrics`
object — numbers, never assertions in prose: `cold_start_fcp_ms`,
`open_4_tabs_ms`, `tile_ms`, `drag_between_splits_ms`,
`reload_restore_ms`, `close_all_to_rest_ms`; kernel scenarios add
`open_file_ms`, `save_ms`, `kernel_events_total`. As verticals land
(U1.x–U4.x) their rows (file open < 1 s ×10, first token < 2 s, interrupt
< 500 ms, …) are captured the same way — the receipt JSON is the phase-gate
evidence the owner re-walks.

## The no-new-renderer-authority law

Three properties, by construction:

1. **One seam.** The channel is bound (in `src/walk/WalkChannel.tsx`, a
   null-rendering component inside the `KernelProvider`) to the **live
   `KernelApi`** — every invoke enters the provider's one serialised
   `apply` queue and merges into the same read models the surfaces render.
   There is no second route to the kernel, the bridge, the filesystem, or
   the shell: the channel cannot do anything the app itself cannot do.
2. **No pixels.** The channel drives kernel relations and reads state; it
   cannot make the renderer present anything. The kernel-cas scenario
   proves this as data: a channel-driven focus change emits its one kernel
   event while the renderer's active tab stays where the person left it.
3. **No production surface.** The mount is build-gated (below); a plain
   production build eliminates it before code generation.

Consequently: walks drive **presentation** through the real UI — keyboard
chords, pointer gestures, context menus — and use the channel for typed
invokes, state reads, and captures. Binding changes (open/close tabs)
belong to the frame's reconciliation; scenarios drive them through the UI.

## Dev-only mounting, and the proof

The channel exists only in dev/walk bundles:

- `vite serve` (dev, `npm run dev`) — mounted (`import.meta.env.DEV`
  semantics via the vite config's `command === "serve"`).
- `WALK=1 vite build` — the walk bundle the runner previews; mounted.
- plain `vite build` (`npm run build`) — `vite.config.ts` bakes
  `__CRADLE_WALK__ = false`, the dynamic import in `src/Cradle.tsx` is
  dead-code-eliminated, and the channel chunk (which holds the only
  `__cradle` strings) is never emitted.

Prove it after any change that touches the gate:

```bash
npm run build                       # the plain production build
grep -r "__cradle" dist/ && echo "VIOLATION" || echo "clean"
grep -rl "__cradle" dist/assets/ 2>/dev/null | wc -l   # expect 0
```

## The receipt schema (`oi.cradle.walk.scenario/v1`)

```json
{
  "schema": "oi.cradle.walk.scenario/v1",
  "scenario": "surfaces",
  "generated_at": "2026-09-05T…",
  "environment": { "base_url": "…", "bridge_url": "…", "viewport": "1280x820", "bundle": "walk (WALK=1) served by vite preview", "node": "…", "platform": "…" },
  "passed": true,
  "error": null,
  "duration_ms": 18342,
  "checks": [{ "ok": true, "label": "…" }],
  "ops": [{ "ok": true, "op": "capture.timing", "seq_range": null, "duration_ms": 2.1, "data": { "fcp_ms": 351.2 } }],
  "metrics": { "cold_start_fcp_ms": 351.2, "open_4_tabs_ms": 412, "tile_ms": 87 },
  "screenshots": ["surfaces-tiled.png", "surfaces-menu.png"]
}
```

## How phase-gate walks use it

At each phase gate the owner walks the app; the harness is what makes that
walk reproducible and evidence-bearing (map §1 law 2/9, §7):

- `node walk/run.mjs all` re-runs the standing scenarios against the
  current build — the committed receipts regenerate, so drift is a diff.
- New units add scenarios (or checks within these) naming their §8 metric
  rows; the receipt carries the numbers the map makes enforceable.
- Screenshots accompany every receipt (APP-SPEC §17: visual acceptance is
  human evidence) — the owner views `walk/artifacts/*.png` and re-walks
  the app itself; the receipts are the apparatus, never the acceptor.

### U1.1: World and native packaging

`all` now includes `navigator` (real Central World mapping, project focus,
root/project wiki relations, absence and caret retention) and `native` (actual
Tauri frontend hook/build, macOS app bundle metadata, production walk-channel
exclusion). On other hosts `native` builds the native executable without a
macOS bundle.

World is summoned with Cmd/Ctrl+B or by right-clicking the Agency field and
choosing World. Escape or its close button returns to the prior caret.

The U1.1 receipt used Central from suite/mainline.json, compiled from a `git
archive` of that exact commit into `/tmp/oi-cradle-pins/<revision>`, leaving
active product checkouts and installed binaries untouched. Set
`OI_CENTRAL_CTRL_BIN` to that build's `target/release/ctrl` when repeating the
pinned walk. `navigator-native.json` records the exact binary/revision and the
computer-use operations on the real app; native PNG and AX receipts are beside it.

### U1.2: Source editor

`editor` provisions a temporary Central root with the actual pinned `ctrl`,
initializes a real project, and copies ten existing documents into its source
ground. UI operations open, edit, switch, save and reopen their owner refs. The
walk also selects a different project before saving, invokes a real exclusion
refusal, and checks that initial writing survives closing sources. No owner
executable or response is mocked. Temporary ground is removed after the walk.
`editor-native.json` records an actual O-I source edit/save/restore and retained
writing, observed through computer-use on the native bundle.
