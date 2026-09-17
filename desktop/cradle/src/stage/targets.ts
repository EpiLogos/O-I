/**
 * The Expression Target registry: stable presentation targets that
 * application surfaces expose so a cue or presentation can say "at this
 * target" instead of mounting another visual component. A target is a
 * name plus a live geometry resolver; the field host reads rect
 * functions per frame, so targets survive layout changes without
 * re-registration and a vanished element simply reports no geometry.
 */

export type ExpressionTargetResolver = () => DOMRect | null;

const targets = new Map<string, ExpressionTargetResolver>();

/** The whole window — the implicit target when none is named. */
export const EXPRESSION_VIEWPORT_TARGET = "viewport";

/** Register a stable target. Returns the deregister function. A later
 * registration under the same id replaces the earlier one (the newest
 * surface owns the name); the earlier deregister then no-ops. */
export function registerExpressionTarget(id: string, resolve: ExpressionTargetResolver): () => void {
  targets.set(id, resolve);
  return () => {
    if (targets.get(id) === resolve) targets.delete(id);
  };
}

export function expressionTargetIds(): string[] {
  return [...targets.keys()];
}

/** Resolve a target id to viewport coordinates, or null when the target
 * is unknown or its element is not presently layed out. */
export function resolveExpressionTarget(id: string | undefined): DOMRect | null {
  if (!id || id === EXPRESSION_VIEWPORT_TARGET) {
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }
  const resolve = targets.get(id);
  if (!resolve) return null;
  const rect = resolve();
  if (!rect) return null;
  const finite = [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite);
  return finite && rect.width >= 0 && rect.height >= 0 ? rect : null;
}
