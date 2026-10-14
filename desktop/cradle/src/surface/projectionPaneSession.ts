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
 */
import type {ProjectionModuleContext, ProjectionModuleHandle, ProjectionModuleRegistration} from "./projectionModules";

export class ProjectionPaneSession {
  /** Settles once the module has mounted, or has failed to (reported through `onFault`). */
  readonly ready: Promise<void>;
  private handle: ProjectionModuleHandle | null = null;
  private live = true;
  private visible = true;

  constructor(registration: ProjectionModuleRegistration, context: ProjectionModuleContext, onFault: (message: string) => void) {
    this.ready = Promise.resolve()
      .then(() => registration.create(context))
      .then(handle => {
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
  }
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
