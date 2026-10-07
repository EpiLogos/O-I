// Original inline glyph set (clean-room — no external icon assets).
// `filled` glyphs for transport primitives, stroked for the rest.

const FILLED: Record<string, string> = {
  play: 'M7 4.5v15l13-7.5z',
  stop: 'M6 6h12v12H6z',
  record: 'M12 5.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z',
}

const STROKED: Record<string, string> = {
  loop: 'M17 3.5l3.5 3.5-3.5 3.5M20.5 7H8.5a5 5 0 0 0-5 5M7 20.5L3.5 17 7 13.5M3.5 17h12a5 5 0 0 0 5-5',
  chevron: 'M8 10l4 4 4-4',
  folder: 'M3.5 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z',
  device: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5v4.5l3 2.5',
  element: 'M12 3.5l8.5 8.5-8.5 8.5L3.5 12z',
  inspector: 'M4.5 6h15M4.5 12h15M4.5 18h9',
  clock: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3.5 2.5',
  set: 'M5 4.5h9l5 5v10a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-14.5a.5.5 0 0 1 .5-.5zM14 4.5V10h5',
}

export type IconName = keyof typeof FILLED | keyof typeof STROKED

export function Icon({
  name,
  size = 14,
}: {
  name: string
  size?: number
}) {
  if (name in FILLED) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={FILLED[name]} />
      </svg>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={STROKED[name] ?? STROKED.element} />
    </svg>
  )
}
