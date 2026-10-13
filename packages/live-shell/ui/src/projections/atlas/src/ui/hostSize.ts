// The atlas's viewport (T-ATLAS-HOST-b). Inside the O:I shell the atlas is a pane (`.atlas-host`), and that pane
// contains its position:fixed overlays (atlasHost.css), so the pane is the viewport they are placed and sized against.
// Standalone (no `.atlas-host`) the window is the viewport, as the ported Archetypal-Earth page had it.

/** The pane that contains the atlas (nearest from `from`, else the first in the document); null standalone. */
export function hostElement(from?: Element | null): HTMLElement | null {
  const near = from?.closest<HTMLElement>('.atlas-host');
  if (near) return near;
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>('.atlas-host');
}

/** The size the atlas lays out in: the pane's client box, or the window standalone. */
export function hostSize(from?: Element | null): { w: number; h: number } {
  const host = hostElement(from);
  if (host) return { w: host.clientWidth, h: host.clientHeight };
  if (typeof window === 'undefined') return { w: 1440, h: 900 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/** The pane's top-left in client coordinates. A client point is pane-relative once this is subtracted; zero standalone. */
export function hostOrigin(from?: Element | null): { x: number; y: number } {
  const host = hostElement(from);
  if (!host) return { x: 0, y: 0 };
  const r = host.getBoundingClientRect();
  return { x: r.left, y: r.top };
}

/**
 * Where the hover label's box sits for a client point: 16px right of and 34px above the pointer, kept 12px inside the
 * pane's edges. Pure: the caller supplies the pane's origin and size.
 */
export function paneLabelPosition(
  clientX: number,
  clientY: number,
  origin: { x: number; y: number },
  size: { w: number; h: number },
  labelWidth: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(12, clientX - origin.x + 16), size.w - labelWidth - 12),
    y: Math.max(12, clientY - origin.y - 34),
  };
}
