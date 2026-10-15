# The lead kit

What the DLW lead and its builders used on 15 Oct to measure and prove work off-screen, moved here from a session's scratch
so the next session starts with it. Every script is parametrised; nothing writes into the seat.

| Tool | What it does |
|---|---|
| `tsc-serial.sh <root>` | One `tsc --noEmit` at a time machine-wide (a lock in `/tmp`, or `$OI_TSC_LOCK`). Run from the seat's root; read the printed `tsc-exit=` line — the script always exits 0. Roots: `packages/live-shell/ui`, `desktop/cradle`, `desktop/cradle/expressions-app`. |
| `start-stack.sh DIR BASE [FRAME_DIST]` / `stop-stack.sh DIR BASE` | A private real-ground dev stack: bridge `BASE`, live-shell `BASE+1`, front `BASE+2` (serving a built frame), vite `BASE+3` with `VITE_KERNEL_BRIDGE` baked in. Writes land under `DIR/home`; every owner binary is pinned (else each `oi` dispatch re-verifies the suite). Build the debug walk-bridge first. Stop only by the recorded pids and the stack's own ports — never by name. |
| `door-trace.mjs OUT [seconds] [subject]` | Technē › Locations › O-I headless on a stack (`BRIDGE_PORT`, `VITE_PORT`): every kernel op with its timing, the frame's reports, then a frame probe (what the frame lays out) and a shell probe (the iframe's rect, its ancestors' stacking, what is topmost at the pane's centre) and `after.png`. Launches Chromium on the GPU. |
| `door.py IDLE MAX OUT.tsv`, `op.py` | Kernel-direct load with no browser (`BRIDGE_PORT`): the shell's polling plus one door's burst, with a lock probe (`/event-replay` every 250 ms). The honest way to measure kernel time. |
| `front.mjs PORT UPSTREAM DIST` | Serves `/__application/expressions/*` from a built frame, everything else from live-shell (used by `start-stack.sh`). |
| `shoot-mock.mjs OUT mode…` | The mockup's modes to PNG (the craft floor a builder Reads). |

Lessons the numbers taught (15 Oct):

- **Headless Chromium draws WebGL in software** unless launched with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`; the
  Earth then holds the main thread for 15–68 s and overstates every Technē timing.
- **Browser traces overstate kernel time**: six HTTP/1.1 connections per host and a preflight per op queue requests. Measure the
  kernel with `door.py`; the native host's IPC has neither.
- **A development build double-invokes effects** (React StrictMode); the native candidate is a production build. A stall seen only
  in dev may not exist natively — and may still reveal a real lifecycle bug (lane D).
- **`pgrep -f` patterns**: match the exact argument you started with, or you will conclude a live run died.
- **Memory**: one headless browser at a time, close it, stop your own pids. The machine runs swap-near-full.
- **The native candidate under Stage Manager** parks in the strip until clicked onto its stage; background screenshots of its web
  view can be stale — the screen pass needs full-screen control (FOUNDATION §5).
