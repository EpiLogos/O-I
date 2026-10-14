// The one lifetime of a mounted atlas (T-ATLAS-DISPOSE). Port-new: no Archetypal-Earth module owns it.
//
// The ported controller, the globe engine, the time control and the views they open install window and document
// listeners, timers, animation frames and observers that the found code never removes: the found app was a page, not a
// pane. A pane that closes must leave none of them running, and a pane that opens again must start clean. So every such
// registration in the port goes through this module, and dispose() releases them all at once: listeners are removed,
// timers and frames cancelled, observers disconnected, and the atlas's own marks on the shared document body are taken off.
//
// One atlas is mounted per session (the claim in AtlasProjectionPanel.tsx), so one lifetime is live at a time: beginLifetime
// refuses a second. A registration made while no lifetime is live installs nothing, so a callback that was in flight when
// the atlas stopped cannot start anything again.

export type Cancel = () => void;
const noop: Cancel = () => {};

/** The classes the atlas's controller and views set on the shared document body. Taken off on dispose. The O:I shell
 * owns the document and sets none of these. */
export const ATLAS_BODY_CLASSES = [
  'aion-card-open', 'aion-mode', 'deep-open', 'dynamics-mode', 'filtered', 'hovering', 'interacted', 'landing-on',
  'lens-loading', 'menu-open', 'mode-graph', 'natal-sky', 'panel-full', 'panel-open', 'po-holding', 'redbook-mode',
  'search-open', 'sky-gazing', 'sky-on', 'sky-ready', 'thread-inspecting',
] as const;
/** The dataset keys the atlas sets on the document body: the lens, the view (data-mode, which the lens bar mirrors), the
 * sky phase and the state of the field. */
export const ATLAS_BODY_DATA = ['lens', 'mode', 'skyPhase', 'state'] as const;

export interface AtlasLifetime {
  /** true from beginLifetime until dispose */
  readonly live: boolean;
  /** Release every registration made under this lifetime, and the atlas's marks on the document body. Idempotent. */
  dispose(): void;
}

class Lifetime implements AtlasLifetime {
  live = true;
  /** Aborted on dispose: every listener added with this signal is removed by the browser as well. */
  readonly signal: AbortSignal;
  /** Release functions not yet run: listener removals, cancellations of timers, frames and observers. */
  readonly releases = new Set<Cancel>();
  private readonly controller = new AbortController();

  constructor() {
    this.signal = this.controller.signal;
  }

  dispose(): void {
    if (!this.live) return;
    this.live = false;
    if (current === this) current = null;
    this.controller.abort();
    const pending = [...this.releases];
    this.releases.clear();
    for (const release of pending) {
      try {
        release();
      } catch (error) {
        console.warn('atlas lifetime: a release failed', error);
      }
    }
    clearBodyMarks();
  }
}

let current: Lifetime | null = null;

function clearBodyMarks(): void {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.remove(...ATLAS_BODY_CLASSES);
  for (const key of ATLAS_BODY_DATA) delete document.body.dataset[key];
}

/** Open the lifetime of one mounted atlas. Throws while another is live: one atlas per session. */
export function beginLifetime(): AtlasLifetime {
  if (current) throw Error('An Earth atlas is already mounted in this session, and its lifetime is live until it is disposed.');
  current = new Lifetime();
  return current;
}

/** Whether an atlas lifetime is live (an atlas is mounted, and not yet disposed). */
export function lifetimeLive(): boolean {
  return current !== null;
}

/** addEventListener, released on dispose. Returns the removal (a no-op when no lifetime is live). Installs nothing when no
 * lifetime is live. */
export function listen<E extends Event = Event>(target: EventTarget, type: string, listener: (event: E) => void, options: boolean | AddEventListenerOptions = false): Cancel {
  const life = current;
  if (!life) return noop;
  const capture = typeof options === 'boolean' ? options : !!options.capture;
  const init: AddEventListenerOptions = typeof options === 'boolean' ? {capture, signal: life.signal} : {...options, signal: life.signal};
  const handler = listener as EventListener;
  target.addEventListener(type, handler, init);
  const cancel: Cancel = () => {
    target.removeEventListener(type, handler, capture);
    life.releases.delete(cancel);
  };
  life.releases.add(cancel);
  return cancel;
}

/** setTimeout, cancelled on dispose. Returns the cancellation (a no-op when no lifetime is live). */
export function later(run: () => void, ms: number): Cancel {
  const life = current;
  if (!life) return noop;
  const handle = setTimeout(() => {
    life.releases.delete(cancel);
    run();
  }, ms);
  const cancel: Cancel = () => {
    clearTimeout(handle);
    life.releases.delete(cancel);
  };
  life.releases.add(cancel);
  return cancel;
}

/** requestAnimationFrame, cancelled on dispose. Returns the cancellation (a no-op when no lifetime is live). */
export function nextFrame(run: (time: number) => void): Cancel {
  const life = current;
  if (!life) return noop;
  const handle = requestAnimationFrame((time) => {
    life.releases.delete(cancel);
    run(time);
  });
  const cancel: Cancel = () => {
    cancelAnimationFrame(handle);
    life.releases.delete(cancel);
  };
  life.releases.add(cancel);
  return cancel;
}

/** Observe a target with an observer the port created, disconnected on dispose. Observes nothing when no lifetime is live. */
export function watch(observer: {observe(target: Element): void; disconnect(): void}, target: Element): void {
  const life = current;
  if (!life) return;
  observer.observe(target);
  life.releases.add(() => observer.disconnect());
}

/** requestIdleCallback, cancelled on dispose; where the platform has none, a timer of `fallbackMs`. */
export function whenIdle(run: () => void, timeout: number, fallbackMs: number): Cancel {
  const life = current;
  if (!life) return noop;
  const host = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, options: {timeout: number}) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof host.requestIdleCallback !== 'function') return later(run, fallbackMs);
  const handle = host.requestIdleCallback(() => {
    life.releases.delete(cancel);
    run();
  }, {timeout});
  const cancel: Cancel = () => {
    host.cancelIdleCallback?.(handle);
    life.releases.delete(cancel);
  };
  life.releases.add(cancel);
  return cancel;
}
