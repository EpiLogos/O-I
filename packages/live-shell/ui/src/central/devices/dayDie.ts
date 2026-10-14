// The Day die's own reading, pure: the six positions and the open face the payload holds.
// Ported unchanged from the die face (inhabitants/DocumentDayDieFace.tsx:62-79), which keeps its own copy until it imports
// this one: the form's own POS list (the owners' names) and `dieFaceOf` (the form's own state, `meta.face`).

/** The die's positions — the form's own POS list (the owners' names). */
export const DIE_POSITIONS: readonly {readonly n: number; readonly name: string; readonly role: string}[] = [
  {n: 0, name: 'Ground', role: 'Capture'},
  {n: 1, name: 'Definition', role: 'Tasks'},
  {n: 2, name: 'Operation', role: 'Sessions'},
  {n: 3, name: 'Pattern', role: 'Observations'},
  {n: 4, name: 'Context', role: 'Structure'},
  {n: 5, name: 'Synthesis', role: 'Crystallization'},
]

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The die's open face, as the payload holds it (the form's own state). */
export function dieFaceOf(payload: unknown): number {
  const face = isObject(payload) && isObject(payload.meta) ? payload.meta.face : undefined
  return typeof face === 'number' && Number.isInteger(face) && face >= 0 && face <= 5 ? face : 0
}

/** One face as the caption reads it: `#3 Pattern — Observations`. */
export function dieFaceLabel(face: number): string {
  const position = DIE_POSITIONS[face]
  return position ? `#${position.n} ${position.name} — ${position.role}` : `#${face}`
}
