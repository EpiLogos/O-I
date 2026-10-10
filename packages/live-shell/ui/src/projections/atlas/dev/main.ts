// The render harness's boot — the found main.ts's composition root role, over
// the FIXTURE provider. This file is the harness, not the projection boundary:
// hosts use ../mount.ts (the pane seam). The dev global `__atlas` exposes the
// mounted engine/controller/model/time for the browser walk, as the found app
// exposed `__earth`.
import { mountAtlas, registerFixtureProvider } from '../mount';

registerFixtureProvider(true);

let mounted: Awaited<ReturnType<typeof mountAtlas>> | null = null;
mountAtlas({
  globe: document.getElementById('globe')!,
  app: document.getElementById('app')!,
  loading: document.getElementById('loading'),
})
  .then((h) => {
    mounted = h;
    (window as unknown as Record<string, unknown>).__atlas = {
      engine: h.engine,
      ctl: h.ctl,
      get model() {
        return (h.ctl as unknown as { m: unknown }).m;
      },
      time: (h.engine as unknown as { time: unknown }).time,
    };
  })
  .catch(() => {
    /* the loading element already carries the failure */
  });

export { mounted };
