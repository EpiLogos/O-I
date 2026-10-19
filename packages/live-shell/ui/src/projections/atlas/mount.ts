// The Earth projection's mount boundary — [C2-a1] the provider registry replaces
// the found boot composition's fixed fetches.
//
// Named source: `src/main.ts` at the pinned atlas HEAD (5fe5117; re-ported 13 Oct 2026, T-AE-REPORT — see PORT.md) — the boot
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
import './src/style/redbook.css';
import './src/style/dynamics.css';
import './src/style/graph.css';
import './src/style/shell.css';
import './src/style/touch.css';
import { Controller } from './src/app/controller';
import { buildModel, type Model } from './src/data/model';
import { rgbToHex, type RGBPalette } from './src/data/palette';
import { GlobeEngine } from './src/globe/engine';
import { prefersReducedMotion } from './src/ui/dom';
import { TimeModel } from './src/state/timeModel';
import type { TimeScale } from './src/data/time';
import { historyExtent } from './src/aion/model';
import { loadProvider, type CorpusBundle } from './provider/corpusProvider';
import { setSkyProvider, type SkyProvider } from './provider/skyProvider';
import { setPublishedSource } from './src/data/published';
import { loadRedbook } from './src/redbook/load';
import type { Family, Occurrence } from './src/types/field';
import type { SeamChange } from './src/data/occurrenceSeam';
import { beginLifetime, nextFrame, type AtlasLifetime } from './src/ui/lifetime';

export { registerFixtureProvider, FIXTURE_PROVIDER_ID } from './provider/fixtureProvider';
export { setSkyProvider } from './provider/skyProvider';
export type { CorpusBundle } from './provider/corpusProvider';

// [§8.4 host] the atmosphere's custom properties land on the atlas pane (`.atlas-host`, where the atlas's tokens are
// scoped), never on the document — the O:I shell owns the document. Falls back to the document root outside a host.
let paletteHost: HTMLElement | null = null;
function setPaletteVars(p: RGBPalette) {
  const s = (paletteHost ?? document.documentElement).style;
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
  /** T-ATLAS-TIME: binds the clock to the shell's shared time window. Called once the controller has booted, so the boot
   * itself writes nothing to the window; the returned binding is released when the atlas is destroyed. */
  clock?: (time: TimeModel, scale: TimeScale) => {dispose(): void};
}

export interface AtlasHandle {
  readonly engine: GlobeEngine;
  readonly ctl: Controller;
  /** the one deep-time clock the atlas's time control reads (shell face bodies share it; the pane owns it) */
  readonly time: TimeModel;
  /** the corpus model the atlas draws (its time scale is the deep-time scale) */
  readonly model: Model;
  /** [T-ATLAS-SEAM] One occurrence of the drawn field replaced in place (`occ` null takes it away): the Earth's Sun follows
   * the shared window through this, and nothing else is redrawn. A refusal names its rule and leaves the field as it was. */
  replaceOccurrence(occ: Occurrence | null, id: string, family?: Family): SeamChange;
  /** [T-WORLDS §4 W2] Open the reading of the occurrence whose subject is `subjectRef` (a page launched as Reading): its manifestation in
   * its family, read deep, as the controller reaches one. False when the field holds no occurrence of that subject. */
  openReading(subjectRef: string): boolean;
  /** Release the atlas: the frames and the GPU resources of the globe, every listener, timer and observer it installed
   * (the atlas lifetime), and its DOM. Idempotent. Nothing of the atlas runs after it. */
  dispose(): void;
}

/** Mount the Earth projection (globe + graph + aion over one corpus bundle).
 * Resolves once the engine's first paint is ready. Throws with the found
 * boot's own messages when the bundle is missing or WebGL is unavailable. */
export async function mountAtlas(options: AtlasMountOptions): Promise<AtlasHandle> {
  const { globe, app, loading } = options;
  paletteHost = globe.closest<HTMLElement>('.atlas-host');
  // every listener, timer, frame and observer the mounted atlas installs is registered under this lifetime (ui/lifetime.ts)
  const life: AtlasLifetime = beginLifetime();
  let built: GlobeEngine | null = null;
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
    // [§8.4] the provider's published material (Red Book, dynamics, lens files, sky cards, Aion's book) — the found
    // boot fetched these from public/data; here only the provider publishes them, and unpublished is absent
    setPublishedSource(bundle.published ?? null);
    const redbook = await loadRedbook();
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
        onSkyPick: (key) => ctl?.onCanvasSkyPick(key),
      },
      prefersReducedMotion(),
    );
    built = engine;
    ctl = new Controller(model, engine, time, app, history, corpus, redbook ?? undefined);
    await engine.ready;
    ctl.boot();
    // T-ATLAS-TIME: the clock binds to the shared window only after the boot, so the boot writes nothing to it.
    const binding = options.clock ? options.clock(time, model.scale) : null;
    nextFrame(() => loading?.classList.add('done'));
    const handle: AtlasHandle = {
      engine,
      model,
      time,
      get ctl(): Controller {
        return ctl!;
      },
      replaceOccurrence(occ, id, family) {
        const change = engine.replaceOccurrence(occ, id, family);
        if (change.changed) ctl!.refreshOccurrences(change);
        return change;
      },
      openReading(subjectRef) {
        const occurrence = model.occ.find(item => item.subject_ref === subjectRef);
        if (!occurrence || !ctl) return false;
        ctl.navigate({view: {kind: 'manifest', occId: occurrence.id, context: {type: 'family', id: occurrence.familyId}}, deep: true});
        return true;
      },
      dispose() {
        binding?.dispose();
        // the controller stops first: its late callbacks (loaders, hash writes) check it and do nothing once it is disposed
        ctl?.dispose();
        // the globe stops drawing and frees its GPU resources (GlobeEngine.dispose); then the lifetime releases every window,
        // document and global listener, timer, frame and observer the atlas installed, and the atlas's marks on the body
        engine.dispose();
        life.dispose();
        globe.replaceChildren();
        app.replaceChildren();
      },
    };
    return handle;
  } catch (err) {
    built?.dispose();
    life.dispose();
    console.error(err);
    if (loading) {
      loading.classList.add('failed');
      loading.textContent = err instanceof Error && err.message.startsWith('The atlas data') ? err.message : 'This device could not start the globe (WebGL is required).';
    }
    throw err;
  }
}
