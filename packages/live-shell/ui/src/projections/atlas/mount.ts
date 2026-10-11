// The Earth projection's mount boundary — [C2-a1] the provider registry replaces
// the found boot composition's fixed fetches.
//
// Named source: `src/main.ts` at the pinned atlas HEAD (606fbe6) — the boot
// sequence ported with one seam changed (the bundle comes from loadProvider()
// instead of fixed fetches) and one shell obligation added (the mount/unmount
// handle, WORLD-SHELL-DESIGN §10.2: "each projection is a module with
// mount/unmount + encounter subscription"; the Atlas's vanilla-TS controller
// mounts the way the retained app's controller does — no React rewrite).
//
// The found boot's honest failure paths are kept: missing field data names
// itself; a WebGL-less device is told so; the loading element (when the host
// provides one) ends in `done` or `failed` exactly as the found page's did.

import './src/style/main.css';
import './src/style/aion.css';
import './src/style/sky.css';
import { Controller } from './src/app/controller';
import { buildModel } from './src/data/model';
import { rgbToHex, type RGBPalette } from './src/data/palette';
import { GlobeEngine } from './src/globe/engine';
import { prefersReducedMotion } from './src/ui/dom';
import { TimeModel } from './src/state/timeModel';
import { historyExtent } from './src/aion/model';
import { loadProvider, type CorpusBundle } from './provider/corpusProvider';
import { setSkyProvider, type SkyProvider } from './provider/skyProvider';

export { registerFixtureProvider, FIXTURE_PROVIDER_ID } from './provider/fixtureProvider';
export { setSkyProvider } from './provider/skyProvider';
export type { CorpusBundle } from './provider/corpusProvider';

function setPaletteVars(p: RGBPalette) {
  const s = document.documentElement.style;
  const set = (k: string, c: [number, number, number]) => {
    s.setProperty(`--${k}`, rgbToHex(c));
    s.setProperty(`--${k}-rgb`, `${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)}`);
  };
  set('core', p.core);
  set('glow', p.glow);
  set('fog', p.fog);
  set('deep', p.deep);
}

export interface AtlasMountOptions {
  /** the element the globe canvas mounts into (the found `#globe`) */
  globe: HTMLElement;
  /** the element the controller's DOM layers mount into (the found `#app`) */
  app: HTMLElement;
  /** optional loading element that receives `done`/`failed`, as the found boot used */
  loading?: HTMLElement | null;
  /** the corpus provider id; default = the registered default */
  provider?: string;
  /** the sky slot; set before mount (see provider/skyProvider.ts — the shell's
   * QL kerykeion binding arrives there, no ephemeris invented) */
  sky?: SkyProvider;
}

export interface AtlasHandle {
  readonly engine: GlobeEngine;
  readonly ctl: Controller;
  destroy(): void;
}

/** Mount the Earth projection (globe + graph + aion over one corpus bundle).
 * Resolves once the engine's first paint is ready. Throws with the found
 * boot's own messages when the bundle is missing or WebGL is unavailable. */
export async function mountAtlas(options: AtlasMountOptions): Promise<AtlasHandle> {
  const { globe, app, loading } = options;
  try {
    // [C2-a1] the provider registry composes the boot bundle (was four fixed
    // fetches). History/symbols ride the bundle (a5/a4); a URL-shaped provider
    // assembles them through jsonCorpusProvider, whose absent parts degrade
    // with the found catches. Everything downstream is the found composition.
    if (options.sky) setSkyProvider(options.sky);
    const bundle: CorpusBundle = await loadProvider(options.provider);
    const { field } = bundle;
    const history = bundle.history;
    const symbols = bundle.symbols;
    // [C2-a3, r2] the corpus slot rides the bundle; absent ⇒ no cite is a link
    const corpus = bundle.corpus ?? null;
    const model = buildModel(field, history ? historyExtent(history) : undefined, symbols);
    const time = new TimeModel();
    let ctl: Controller | null = null;
    const engine = new GlobeEngine(
      globe,
      model,
      time,
      {
        onPick: (i) => ctl?.onPick(i),
        onHover: (i, x, y) => ctl?.onHover(i, x, y),
        onInteract: () => ctl?.onInteract(),
        onGrab: () => ctl?.onGrab(),
        onPalette: setPaletteVars,
        onSkyPick: (key) => ctl?.onSkyPick(key),
      },
      prefersReducedMotion(),
    );
    ctl = new Controller(model, engine, time, app, history, corpus);
    await engine.ready;
    ctl.boot();
    requestAnimationFrame(() => loading?.classList.add('done'));
    const handle: AtlasHandle = {
      engine,
      get ctl(): Controller {
        return ctl!;
      },
      destroy() {
        // The found app had no unmount (a page, not a pane); the pane boundary
        // needs one. The engine's renderer and the controller's document-level
        // listeners are the two owners of teardown; full listener retirement is
        // recorded below as port debt (see the lane's unverified list).
        try {
          engine.renderer.dispose();
        } catch {
          /* the globe may already be gone with its pane */
        }
        globe.replaceChildren();
        app.replaceChildren();
      },
    };
    return handle;
  } catch (err) {
    console.error(err);
    if (loading) {
      loading.classList.add('failed');
      loading.textContent = err instanceof Error && err.message.startsWith('The atlas data') ? err.message : 'This device could not start the globe (WebGL is required).';
    }
    throw err;
  }
}
