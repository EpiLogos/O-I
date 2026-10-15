/**
 * The pane-side lifecycle of one admitted projection module (WORLD-SHELL-DESIGN
 * §10.1; the hidden-inhabitant law in `projectionModules.ts`).
 *
 * `ProjectionSurface` (projectionPane.tsx) renders the pane body; what its
 * effects do lives here as plain TypeScript, so the lifecycle is pinned by a
 * node test without a DOM:
 * - a session mounts its module once, and unmounts it once, on dispose;
 * - concealment is a notice, never a teardown. The pane tier hides the wrapper
 *   (Workbench's `.surface-retained[hidden]`), the observer reports it, and the
 *   session calls `setVisible(false)`; showing the pane again calls
 *   `setVisible(true)`. The module's state lives until `unmount`.
 * - each session mounts into its own container inside the pane element. A new
 *   connection generation remounts the pane during React's commit, when the
 *   old module's React root defers its unmount: two roots sharing one element
 *   then tear each other's children out ("removeChild … not a child") and the
 *   pane draws blank. A container per session keeps every root on its own node.
 */
import type {ProjectionModuleContext, ProjectionModuleHandle, ProjectionModuleRegistration} from "./projectionModules";

export class ProjectionPaneSession {
  /** Settles once the module has mounted, or has failed to (reported through `onFault`). */
  readonly ready: Promise<void>;
  private handle: ProjectionModuleHandle | null = null;
  private live = true;
  private visible = true;
  private readonly container: HTMLElement | null;

  constructor(registration: ProjectionModuleRegistration, context: ProjectionModuleContext, onFault: (message: string) => void) {
    this.container = ownContainer(context.element);
    const mounted = this.container ? {...context, element: this.container} : context;
    // A session disposed before its module began to mount (React's development double-invoke of the pane's effect disposes the
    // first session in the same task) never mounts it: mounting it only to unmount it as soon as it stood built the Earth's whole
    // globe and then lost its WebGL context on the main thread (measured headless on software GL, 15 Oct: 15–40 s).
    this.ready = Promise.resolve()
      .then(() => this.live ? registration.create(mounted) : null)
      .then(handle => {
        if (!handle) return;
        if (!this.live) {handle.unmount(); return;}
        this.handle = handle;
        // A pane concealed before its module stood is told so at mount, once.
        if (!this.visible) handle.setVisible?.(false);
      })
      .catch(reason => {
        if (this.live) onFault(reason instanceof Error ? reason.message : String(reason));
      });
  }

  /** The concealment notice: `false` when the pane is hidden, `true` when it is shown again. */
  setVisible(visible: boolean): void {
    if (!this.live) return;
    this.visible = visible;
    this.handle?.setVisible?.(visible);
  }

  /** Full teardown: the module unmounts once. A module still mounting unmounts as soon as it stands. */
  dispose(): void {
    if (!this.live) return;
    this.live = false;
    const handle = this.handle;
    this.handle = null;
    handle?.unmount();
    // A React root may finish its unmount after this commit; the container leaves once it has.
    const container = this.container;
    if (container) setTimeout(() => container.remove(), 0);
  }
}

/** The session's own node inside the pane element; none where the element is not a DOM node (the node tests). */
function ownContainer(element: HTMLElement): HTMLElement | null {
  const document = (element as Partial<HTMLElement>).ownerDocument;
  if (!document || typeof element.appendChild !== "function") return null;
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;inset:0";
  element.appendChild(container);
  return container;
}

/**
 * Observe a pane wrapper for concealment: an IntersectionObserver reports
 * `display:none` as not intersecting. Returns the disposer, or `null` where the
 * host has no IntersectionObserver (the pane then carries no concealment notice).
 */
export function observeConcealment(target: Element, onVisibility: (visible: boolean) => void): (() => void) | null {
  if (typeof IntersectionObserver === "undefined") return null;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) onVisibility(entry.isIntersecting);
  });
  observer.observe(target);
  return () => observer.disconnect();
}
