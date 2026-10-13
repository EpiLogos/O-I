# T-E01 — The journey timeline surface

Label: wayfinder:task (Phase 4 · lane 3; UI leg)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-3-expressions-editor/TARGET-SET.md:104` (register `lane-3:E01`).

## Resolution

**Code landed (13 Oct 2026).** `journeyTimelineLayout.ts` derives every clip
edge and the playhead from `expressionTiming` (one clock; `sceneAtTime`
agrees with it and with the scrub walk at 200 sampled t);
`renderTimeline` draws the time-proportional track (one clip per Scene ref,
thumbnails and save dots kept, the playhead `expression-playhead` over the
lane), collapsible to the original strip. Scripted: 9/9; scene suites 75/75
before and after; build clean. Unverified (native screen pass): unequal
clip widths on a 5-scene work, the playhead thumb at 0 and at the end, drag
across scene boundaries, clicks reaching clips through the overlaid range
input in WKWebView, the ≤620 px rules.
