import {markPresented, markRetained, markReleased, forgetSurface, runtimeRecord} from '../../../../../desktop/cradle/src/surface/runtime'

export interface SurfaceLifecycle {
  id: string
  kind: string
  /** Owner/model checkpoint, not canonical Save or a changed dirty flag. */
  checkpoint: () => Promise<boolean>
  disposeView: () => void
}
/** Reuses the native presentation registry; membership remains in the v2
 * book. Concealment never disposes. Release waits for recoverable state. */
export class ContinuityResidency {
  private views = new Map<string, SurfaceLifecycle>()
  private releases = new Map<string, Promise<boolean>>()
  register(view: SurfaceLifecycle): () => void {
    if (this.views.has(view.id)) throw Error('A Surface already has a runtime host')
    this.views.set(view.id,view)
    return () => {if (this.views.get(view.id) === view) this.views.delete(view.id)}
  }
  present(id: string): void {const view = this.require(id); markPresented(id,view.kind)}
  conceal(id: string): void {const view = this.require(id); markRetained(id,view.kind)}
  release(id: string): Promise<boolean> {
    const pending = this.releases.get(id)
    if (pending) return pending
    const view = this.require(id)
    // Register before invoking even a synchronously refusing owner adapter.
    const release = Promise.resolve().then(async () => {
      try {
        if (!await view.checkpoint() || this.views.get(id) !== view) return false
        // A reveal during checkpoint supersedes eviction.
        if (runtimeRecord(id)?.residency === 'active') return false
        view.disposeView()
        markReleased(id,view.kind)
        this.views.delete(id)
        return true
      } catch { return false }
      finally {this.releases.delete(id)}
    })
    this.releases.set(id,release)
    return release
  }
  /** Called only after the book's explicit close/dirty policy succeeds. */
  forgetClosed(id: string): void {this.views.delete(id); forgetSurface(id)}
  private require(id: string): SurfaceLifecycle {const view = this.views.get(id); if (!view) throw Error('The Surface has no registered runtime host'); return view}
}
