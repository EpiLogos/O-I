/**
 * Techne surface lifecycle — the renderer law ported from the Expressions
 * physics workspace: one renderer lifecycle per active surface, one animation
 * loop, one dirty flag (field-studies-journeys/src/app.ts single `tick()`,
 * ~lines 586-604, plus the FieldEngineAdapter contract in engine.ts and the
 * context-lost recovery in production.ts). Ported as a contract; no engine
 * code is imported.
 *
 * The law, as the reference runs it:
 *   - ONE requestAnimationFrame loop per surface. Instrument surfaces never
 *     grow duplicate loops.
 *   - Raw delta is clamped to 0.25s so a background stall never jumps the
 *     field; while the transport plays, a frame advances at most 0.05s
 *     (app.ts: `Math.min((now-lastTime)/1000,.25)` / `Math.min(rawDelta,.05)`).
 *   - Delta gating: when the transport is paused the delta is 0 — a dirty
 *     surface still repaints once, nothing advances.
 *   - Single-frame dirty-flag rendering: a frame is drawn only when the
 *     transport is playing, or the surface was marked dirty, or the renderer
 *     itself reports needsRender() (FieldEngineAdapter.needsRender). After a
 *     draw the dirty flag clears.
 *   - Document-hidden auto-suspend: `visibilitychange` suspends the loop and
 *     resume() re-bases the clock so no delta spike lands (app.ts resets
 *     lastTime on visibilitychange).
 *   - Context loss is recovery, not teardown: a render throw stops the loop
 *     and reports through onError; the host decides to rebuild (production.ts
 *     keeps the adapter, throws 'context' on render, recover-context command
 *     recreates the engine).
 *
 * States: 'released' (no resources) → start() → 'active' ⇄ 'suspended'
 * (hidden/covered) → dispose() → 'released' (terminal).
 */

const MAX_RAW_DELTA_SECONDS = 0.25;
const MAX_FRAME_DELTA_SECONDS = 0.05;

export function createSurfaceLifecycle({
  acquire,   // () => void — create renderer resources once before the first frame
  release,   // () => void — dispose renderer resources; pairs with acquire
  render,    // (deltaSeconds) => void — draw one frame
  needsFrame, // () => boolean — renderer dirty flag (adapter.needsRender); optional
  fpsCap,    // number — max frames per second; 0/undefined = uncapped (quality cap law)
  onError,   // (error) => void — render failure report; optional
  document: doc = globalThis.document,
  requestAnimationFrame: scheduleFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame: cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  for (const [name, fn] of [['acquire', acquire], ['release', release], ['render', render]]) {
    if (fn !== undefined && typeof fn !== 'function') throw new TypeError(`${name} must be a function`);
  }
  if (typeof render !== 'function') throw new TypeError('A render(frame) function is required');
  if (needsFrame !== undefined && typeof needsFrame !== 'function') throw new TypeError('needsFrame must be a function');
  if (!scheduleFrame || !cancelFrame) throw new TypeError('A frame scheduler is required');
  if (doc !== undefined && doc !== null && typeof doc.addEventListener !== 'function') {
    throw new TypeError('document must expose addEventListener');
  }

  const minFrameIntervalMs = Number(fpsCap) > 0 ? 1000 / Number(fpsCap) : 0;
  let state = 'released';
  let resources = false;   // acquire() has run; release() belongs to dispose()
  let rafId = 0;
  let lastTime = 0;
  let lastRender = 0;
  let dirty = true;        // the single-frame dirty flag (app.ts needsFrame)
  let transportPlaying = false;
  let autoSuspended = false;

  const schedule = () => { if (!rafId) rafId = scheduleFrame(tick); };

  function tick(now) {
    rafId = 0;
    if (state !== 'active') return;
    const rawDelta = Math.max(0, Math.min((now - lastTime) / 1000, MAX_RAW_DELTA_SECONDS));
    lastTime = now;
    // Delta gating: paused surfaces repaint at delta 0; playing surfaces
    // advance by at most one bounded step per frame.
    const delta = transportPlaying ? Math.min(rawDelta, MAX_FRAME_DELTA_SECONDS) : 0;
    const rendererWantsFrame = needsFrame ? needsFrame() : false;
    if ((transportPlaying || dirty || rendererWantsFrame) && now - lastRender >= minFrameIntervalMs) {
      try {
        render(delta);
      } catch (error) {
        dirty = false;
        transportPlaying = false;
        onError?.(error);
        suspend(); // loop stops; the host recovers, then setPlaying(true) + markFrameNeeded()
        return;
      }
      dirty = false;
      lastRender = now;
    }
    schedule();
  }

  function start() {
    if (state === 'released') {
      acquire?.();
      resources = true;
    }
    state = 'active';
    autoSuspended = false;
    lastTime = performance.now();
    schedule();
  }

  function suspend({ automatic = false } = {}) {
    if (state !== 'active') return;
    if (rafId) { cancelFrame(rafId); rafId = 0; }
    autoSuspended = automatic;
    state = 'suspended';
  }

  function resume() {
    if (state !== 'suspended') return;
    state = 'active';
    autoSuspended = false;
    lastTime = performance.now(); // re-base the clock: no delta spike across the gap
    schedule();
  }

  function onVisibilityChange() {
    if (doc.hidden && state === 'active') suspend({ automatic: true });
    else if (!doc.hidden && state === 'suspended' && autoSuspended) resume();
  }
  doc?.addEventListener('visibilitychange', onVisibilityChange);

  return {
    get state() { return state; },
    start,
    suspend,
    resume,
    /** Host transport gate (app.ts `playing`). */
    setPlaying(playing) { transportPlaying = Boolean(playing); },
    /** Mark the surface dirty so the next frame repaints once (delta 0 when paused). */
    markFrameNeeded() { if (state !== 'released') dirty = true; },
    /** Terminal: stops the loop and releases renderer resources exactly once. */
    dispose() {
      if (rafId) { cancelFrame(rafId); rafId = 0; }
      doc?.removeEventListener('visibilitychange', onVisibilityChange);
      if (resources) { release?.(); resources = false; }
      dirty = false;
      transportPlaying = false;
      state = 'released';
    },
  };
}
