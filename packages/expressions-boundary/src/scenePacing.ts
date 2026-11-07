/** A scene's pacing, the owner's law (sceneEdits.ts `pacing`; DLW §20.1 The Clip panel, Duration and Transition): how long a scene holds,
 * 1–3600 s, and how long its change to the next takes, 0–30 s. A Transition longer than the Duration is a slow swell. The Clip panel's
 * dials run over these ranges, so they reach every value the owner takes and none it refuses. Import-light: the shell reads it. */
export const SCENE_PACING = {duration: {min: 1, max: 3600}, transition: {min: 0, max: 30}} as const;
