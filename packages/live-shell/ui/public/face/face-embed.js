/* The face as the shell hosts it (FaceStage, packages/live-shell/ui/src/agent/FaceStage.tsx). Built by
   packages/live-shell/ui/scripts/sync-face.mjs: do not edit by hand. Loaded after face-core.js and face-speech.js, it shares
   their globals. The shell keeps no rig setting: nothing here is remembered. A request for reduced motion turns the face's own
   life off (its `motion`: the drift, the breath, the small movements and the idle gestures, face-core.js faceTick); every
   state the shell puts it in still shows. */
(() => {
  const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const life = () => {
    const face = typeof LIVE_FACES === 'undefined' ? null : LIVE_FACES.find(f => f.el && f.el.closest('#fd-face'));
    if (face) face.motion = !(query && query.matches);
  };
  life();
  if (query && typeof query.addEventListener === 'function') query.addEventListener('change', life);
})();
