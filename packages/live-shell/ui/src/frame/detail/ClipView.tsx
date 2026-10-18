// What the Clip side says while it holds no clip: one line, the mode's own words, no body under it (FOUNDATION F4). The Clip view
// itself is Live's anatomy, drawn by the one clip host (frame/detail/ClipHost.tsx) from the mode's designed clip
// (inhabitants/catalogue/clips/clipKit.tsx ClipView). The props-column anatomy this file drew (ClipView, ClipLine, ClipNone: the
// mockup's clipDetail() :1651-1680) is retired with the bodies that drew through it (T-REALIGN R2).
export function ClipWaiting({line}: {line: string}) {
  return <p className="clip-empty" role="status">{line}</p>
}
