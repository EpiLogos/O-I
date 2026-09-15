# Native engine / O:I host performance comparison

Returned implementation evidence, 2026-09-15. This is an isolated engine-host
comparison, not acceptance of the full desktop opening or the lived UX campaign.

## Basis and method

- O:I EngineSurface and recipes frozen at `2a4f76ab9b9672b25fa9bcc12573d271e2653a17`.
- Native source `703b6970bfd405c482c2a15985c09c8925ec3b7d`, the scoped compatibility
  branch consumed by that O:I commit. The retained adapter and vendor runtime
  bytes still match that O:I commit; `basis.json` records source hashes.
- Actual native `ProductionAdapter`, actual O:I `RetainedProductionAdapter`, and
  actual O:I `EngineSurface.forWindow` / `forElement`. All execute the real
  PointCloudField, renderer, sampler and simulator. Instrumentation wraps calls
  and records elapsed time; it substitutes no renderer or simulation.
- Every result uses the byte-equal full `oi.mark` native configuration:
  120,000 points, same entities and sources, 2D camera, inactive pointer,
  revision 1, no scaffold, 1280×820 CSS pixels. DPR is varied only in its named
  separate control. One visible test page and one engine canvas per case.
- Same host frame rule in direct adapters and EngineSurface: clamped positive
  RAF delta, maximum 0.05 seconds. Each case uses a fresh browser context and
  canvas, two seconds of warmup, then a six-second observation. A final
  software control also requires 60 completed native draws before measurement
  and reverses the case order.
- Chrome `152.0.7977.84`, actual Apple M4 Metal on hardware runs. The software
  control explicitly selects SwiftShader; both renderer strings are in JSON.
- No GPU readback, screenshot, or particle-buffer inspection in timed windows.
  Native step, seed and bake counters are read at their boundaries. JavaScript
  method timings overlap; they must not be added as independent CPU totals.
- The root and sibling agents held their browser runs. A separate session's
  SharedField walk was observed on this machine. System-wide load was not
  forcibly controlled; this especially limits precise comparisons between the
  variable software runs.

## Observed result

| Renderer / DPR | Native adapter | Retained adapter | EngineSurface window | EngineSurface element |
| --- | ---: | ---: | ---: | ---: |
| Apple M4 Metal / 1 | 59.98–59.99 fps | 59.98 fps | 59.97–59.99 fps | 59.98 fps |
| Apple M4 Metal / 2 | 59.99 fps | — | 59.98 fps | — |
| SwiftShader / 1, two-second warmup | 8.17 fps | — | 7.16 fps | — |
| SwiftShader / 1, 60-draw warmup, reverse order | 6.33 fps | — | 13.00 fps | — |

All twelve cases used the same full config and reported one engine canvas,
zero additional seed generations, zero target rebakes, and no page or engine
errors. Hardware draw JavaScript averaged 0.28–0.37 ms. `setHostView` averaged
0.018–0.026 ms per draw; configuration lookup averaged 0.004–0.009 ms. The
software cases still spent under 0.9 ms in synchronous render JavaScript while
their RAF intervals were much longer.

The isolated desktop host does not reproduce a consistent frame-rate penalty.
The graphics backend change produces the large observed difference. Software
results vary enough that the native/host ordering reverses; they cannot support
a claim that one integration is faster. They also cannot establish the cause
of a separate real desktop report without its actual renderer and loading trace.

## Allocation and simulation findings

`setHostView` does construct vectors and a matrix per call, but actual renderer
resize is guarded by width, height and DPR. Its measured synchronous cost is
small in this comparison. Both adapter configurations use an authoring revision,
so neither serializes the scene or converts the whole native config per frame.
No `replaceConfig` was called during measured windows, and no measured rebake or
reseed occurred. Scene migration remains presentation-time work.

The native engine divides positive delta by `ceil(delta / (1/60))`. Hardware RAF
jitter therefore averaged approximately 1.60–1.64 substeps per draw; software
averaged 2.92–2.96. This happens in both native and hosted paths. At a 0.05-second
cap a slow draw consumes up to three physics steps, while simulation time advances
more slowly than wall time. An opening driven by fixed wall timers can consequently
end before its native simulation completes. The parent task is repairing that
opening contract; this comparison makes no timing or particle-count change.

## Evidence and reproduction

`summary.json` contains compact measurements; `hardware.json`,
`hardware-dpr2.json`, `software.json`, and `software-warm.json` include complete
config, renderer, counters, timings and error arrays. `entry.ts`, `run.mjs`,
`build.mjs` and `snapshot/` preserve the actual measurement source. Their paths
refer to the two locked local worktrees and this evidence directory.

```sh
node /tmp/oi-ui-parity-20260915/build.mjs
node /tmp/oi-ui-parity-20260915/run.mjs
node /tmp/oi-ui-parity-20260915/run.mjs --dpr2
node /tmp/oi-ui-parity-20260915/run.mjs --software
node /tmp/oi-ui-parity-20260915/run.mjs --software --warm
```

This does not measure full Cradle startup, React commit work, application/kernel
loading overlap, macOS WebView rendering, detached-window load, or GPU execution
duration directly. It isolates the steady engine-host boundary sufficiently to
reject particle reduction and per-frame scene conversion as supported fixes for
the measured host comparison. The full opening remains a separate real-app check.
