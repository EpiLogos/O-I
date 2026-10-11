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
  session: 'M5 4v16M12 4v16M19 4v16',
  arrangement: 'M4 5h16M4 12h16M4 19h16',
  expressions: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 10v4M10 12h4',
  techne: 'M5 5h4v4H5zM15 15h4v4h-4zM15 4h5v5h-5zM4 15h5v5H4zM9 7h6M7 9v6M9 17h6M17 9v6',
  agents: 'M9 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2',
  context: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
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
