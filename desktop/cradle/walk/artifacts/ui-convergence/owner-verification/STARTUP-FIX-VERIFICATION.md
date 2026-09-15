# Startup fixes: actual browser verification

The read-only probe passed against a byte snapshot of the final **plain production build** from O:I `2a0c206b43f5cbfff872ee787fc7db5600bebe44`, rebased onto accepted main `48e298bc2f1cea71b4d1f9367a9c81ebdf209800`. Every served asset is hashed in `startup-fixed/startup-audit-dist-basis.json`; built entry is `index-aWaOs4IO.js`, built HTML SHA256 `67ef7fed76a22290bfa6583814534b28b038d06ea660c023871015d8e3afe56f`. The parent reconciled that exact entry against `/tmp/oi-final-production-build.log`: production build completed before this probe captured its byte snapshot; the subsequent 22 CSP cases and WALK build emitted a different entry. No uncommitted production-source changes were included. Thus the tested artifact includes the final SF5 camera rebase and both startup fixes, and does not depend on WALK instrumentation.

## Observed results

| Saved appearance | Actual first painted body, entry JavaScript delayed | Actual native opening ground | Body after entering |
|---|---|---|---|
| Light | `rgb(18, 18, 17)` | `rgb(18, 18, 17)` | `rgb(233, 233, 229)` |
| Dark | `rgb(251, 251, 249)` | `rgb(251, 251, 249)` | `rgb(11, 11, 10)` |

Both first paints had zero canvases and no Welcome DOM. The native opening subsequently had one canvas. Actual clicking and completed entry removed `data-oi-opening` and preserved the selected light/dark appearance. This closes the earlier measured selected-ground → inverse-ground startup flash; the intentional app-entry inversion remains.

Cold ordinary startup with Expression disabled requested **zero Expression runtime, native cue, EngineSurface or Three modules**, allocated **zero canvas contexts**, and had **zero canvases**. The earlier actual build requested 987,998 uncompressed bytes of grouped native/Three JavaScript despite allocating no canvas/context. This result is scoped to the observed ordinary disabled startup; opening a user-requested rich surface can legitimately load its modules later.

The prepaint gate was separately reviewed against the actual VisualsStore defaults/sanitization, session key, native detached initialization flag and Welcome gate. Strict boolean false, missing/malformed storage, session completion and detached cases agree; saved appearance is unchanged. The parent separately reports its 22 prepaint/CSP cases passed; this probe does not duplicate that native/config assurance.

## Method and files

`startup-fixed/startup-readonly-audit.mjs` serves a synchronous in-memory snapshot of the real dist files on4392, delays only the real entry module, records actual CSS/paint state, then runs the real native stage. Isolated Chromium profiles use reduced motion and SwiftShader; this is functional startup evidence, not an active frame-rate benchmark. Initial click lookup used hint text instead of the observed accessible label and timed out; the probe-only locator was corrected to the actual button name, after which all assertions passed. No application source, dist, native user app, preferences or owner configuration was changed. Browser and server closed before the hardware timing window.

Read `startup-fixed/startup-readonly-audit.json` and `.log`; four `startup-fixed/startup-{light,dark}-{entry-delayed,field-ready}.png` images show the major states. Original pre-fix observations remain in the parent evidence directory and `LEGACY-REMOVAL-FINAL-AUDIT.md`. This verifies implementation behavior, not O:I #65 lived experience acceptance.
