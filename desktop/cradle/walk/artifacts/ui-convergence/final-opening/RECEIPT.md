# Final whole-app opening: physical GPU measurement

Observed 2026-09-15. The actual full 120,000-point opening ran at approximately **60 fps** during steady rest and entry in both light and dark. Both native entry sequences completed before release. Settled desktop idle produced **zero field frames, zero native draw submissions and zero requestAnimationFrame callbacks** over the 1.2-second observation window. Expression-disabled startup created no canvas or WebGL context and requested no engine/Three JavaScript chunks.

## Exact basis and method

- Accepted O:I main: `48e298bc2f1cea71b4d1f9367a9c81ebdf209800`.
- Measured UI source: `2a0c206b43f5cbfff872ee787fc7db5600bebe44`.
- Native Point-Cloud-Demo intake: `91db8428fc9dfba06cd258ec5a58e7dd9eef5313`.
- WALK `dist/index.html` SHA256: `0df566dd65d928f1144f8d88c505e6e93884446b85191ca5d02921298b78b60a`, unchanged before/after all cases.
- Browser: Chrome `152.0.7977.84`, actual ANGLE Metal / Apple M4 GPU, 1280×820 CSS pixels, DPR2, no reduced-motion preference.

The replay ran the real Rust walk bridge on `4330`, with a fresh isolated OI_HOME and `/Users/admin/Central` as its source root, against the held WALK build on `4321`. Light, dark and disabled used separate fresh browser contexts sequentially. The empty workspace honestly displayed its default-ground selection state; this was not a restored rich-surface workload. Native state and transport were not replaced. The temporary OI_HOME was removed after browser and bridge closure.

Other agents held their browser checks for this measurement. Sanitized process snapshots before/after contain no competing Chrome headless/GPU processes; the measured browser's actual GPU is recorded in `opening.json`. This bounds known test concurrency, not every possible system activity.

Instrumentation observed real default-framebuffer draw submissions, resource timings, DOM composition, requestAnimationFrame callbacks and the existing Stage inspection API. Actual WebGL contexts were held strongly for ownership inspection. No framebuffer readback or screenshot happened during a timing window. Screenshots and asset hashing happened afterward. The timestamp called “first native draw” is a **draw submission**, not a compositor-presented-pixel timestamp.

## Final returned measurements

| Observation | Light | Dark |
| --- | ---: | ---: |
| First native framebuffer draw, ms from navigation | 226.4 | 180.9 |
| CradleFrame chunk request starts, ms | 231.3 | 184.7 |
| Desktop shell composed under field, ms | 296.2 | 225.8 |
| Entry control ready, ms | 302.0 | 230.3 |
| Steady rest rate | 60.00 fps | 60.02 fps |
| Steady entry rate | 59.99 fps | 60.00 fps |
| Visible entering duration | 2605.0 ms | 2612.8 ms |
| Native playback elapsed / authored duration | 2616.6 / 2600 ms | 2616.6 / 2600 ms |
| Native playback result | completed | completed |
| Final 1.2-second idle: field frames / draws / RAF callbacks | 0 / 0 / 0 | 0 / 0 / 0 |

In both themes, the workspace request began after the first native draw. The workspace was composed, inert and hidden from accessibility beneath the field before entry. Each case allocated exactly one actual healthy WebGL context at 2560×1640 and one production canvas. Ordinary presentation release retained that context as intended, removed all live presentations and left the Stage unscheduled. Focus returned to `root`; no legacy Expression SVG or non-engine canvas remained; browser errors were zero.

Disabled startup requested CradleFrame at 29.2 ms and composed the shell at 70.3 ms. It did not mount the welcome, allocate any canvas/context, draw a native frame, or request `engineSurface`, `expressions-engine` or `three` chunks. It had one bootstrap RAF callback before settling and zero callbacks during the final 1.2-second idle window. Stage engine fields were `null`, correctly describing an absent engine.

## Remaining measured cost and limits

There remains a brief loading interruption. Four native draws occurred during each first-draw-to-ready interval (75.6 ms light; 49.4 ms dark). The largest observed gap was **58.5 ms light / 28.5 ms dark**. These short windows do not support stable FPS estimates. Initial JavaScript long tasks of **126 ms / 85 ms** overlapped native setup and the first draw. The steady entry interval later stayed near 16.67 ms, with maximum gaps of 20.9 ms / 18.5 ms. This single paired run locates the remaining startup cost; it does not establish a universal latency budget or isolate every contributor to that loading gap.

The probe's raw `initial-ground` event fires when the parser first creates the body, before the inline appearance script. It is **not first-paint evidence**; the transparent early sample is not a claim of a visible theme flash. Likewise, the captured WebGL clear color is not the native scene's final shader-rendered background. The dedicated delayed-entry startup audit supplies appearance/prepaint evidence.

These final measurements cover the ordinary opening on the reconciled native91db/SF5 basis. The earlier native-versus-host parity report retains its own historical basis. Restored PageExpression, native knowledge and Nara behavior is covered by their separate real-kernel/owner checks. Browser verification is not human experience acceptance of O:I #65.

## Evidence and replay

- `opening.json`: raw native draw, resource, DOM, long-task, actual context, Stage and machine/basis evidence.
- `opening-summary.json`: derived metrics and **18/18 passed boundary assertions**.
- `opening-bundle-hashes.json`: exact bytes of every requested local asset.
- `opening.mjs`: real-browser/kernel measurement; `summarize.mjs`: deterministic derivation and assertions.
- `opening.log`, `opening-kernel.log`: completed real execution.
- `opening-{light,dark,disabled}-entered.png`: entered desktop screenshots, taken after timing.
- `concurrency-{before,after}.json`: bounded Chrome timing-concurrency inventory, without unrelated process arguments.

The replay defaults to the recorded local worktree, ports and `/tmp/oi-ui-final-opening-20260915` output directory; change those constants when replaying elsewhere. Run `node opening.mjs`, then `node summarize.mjs`. The replay records the actual new basis rather than claiming to reproduce these numbers on another machine or revision.
