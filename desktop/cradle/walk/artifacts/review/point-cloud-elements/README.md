# Elemental point-cloud showcase

Open http://127.0.0.1:4288/desktop/cradle/walk/artifacts/review/point-cloud-elements/ . Dedicated server runs from the O-I repository root on port 4288.

Four elemental panel directions (fire, water, air, earth), plus arrival, presence and relation. All seven are actual Canvas 2D dot compositions; preview controls change running behavior. Shared desktop palette and exact shared O:I masked-dot mark are consumed directly. The logo appears only in the explicit fullscreen initial-load preview. This is an isolated visual showcase, not a production loading flow or an operation-status claim.

Motion uses one shared requestAnimationFrame scheduler, capped at approximately 30 drawing frames/second and pixel ratio 2. Only intersecting fields draw. Pause, reduced motion, document hiding and fullscreen preview stop the canvas scheduler. Observers and listeners are released on pagehide. There are no particle arrays that grow across interactions, retained timers or dependencies. The fullscreen preview traps focus and makes the background inert until Escape or Return closes it.

Actual Chromium checks in checks.json: no page errors, pause stops scheduling, reduced motion stops scheduling, fullscreen stops scheduling and makes main inert, 390 px has no horizontal overflow. Narrow viewport renders only intersecting fields. Screenshots show actual output at 2×. These are functional animation lifecycle checks, not a native resource/performance acceptance claim.

Design intent: fire is vertically concentrated; water has a lateral wave; air remains open and elliptical; earth settles in dense strata. Production selection and any operator-state mapping remain for owner review. No production files changed.
