/** The live scene's M2 condition as the frame announces it to its host (DLW §21.2 the Torus's Body group, §20.14 Resonance): the
 * tattva the condition stands on, by its coordinate, and its material fibre, verbatim from the coupled basis the native field host
 * disclosed on inspect (native-field/controller.ts sources: `current.m2.condition.source_path` tattva_coordinate and material_fibre;
 * ql-mef m2_condition.rs CorrespondenceRule). The frame announces what it last inspected; it reads nothing for the announcement.
 *
 * Pure: no DOM. The frame builds (app.ts announceHostState), the host boundary reads (protocol.ts readHostedState → readFrameCondition). */

/** QL's element fibres (ql-mef m2_engine.rs MaterialFibre, snake_case). */
export const MATERIAL_FIBRES = ['earth', 'fire', 'water', 'air'] as const
export type MaterialFibreName = (typeof MATERIAL_FIBRES)[number]
export interface FrameInstrumentCondition {
  /** The tattva's coordinate in the map (`#2-2-2-5-5`), or null where the condition stands on none. */
  tattva_ref: string | null
  /** The element fibre the condition gives the voices, or null where it gives none. */
  material_fibre: MaterialFibreName | null
}

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const coordinate = (value: unknown): value is string => typeof value === 'string' && /^#[0-9][0-9./-]{0,127}$/.test(value)
const fibre = (value: unknown): value is MaterialFibreName => typeof value === 'string' && (MATERIAL_FIBRES as readonly string[]).includes(value)

/** The condition the native field's sources hold, as the announcement carries it; undefined while it holds none (no inspect yet, or a
 * supplied owner without an M2 condition path). */
export function conditionReadingOf(sources: unknown): FrameInstrumentCondition | undefined {
  const current = plain(sources) && plain(sources.current) ? sources.current : null
  const m2 = current && plain(current.m2) ? current.m2 : null
  const condition = m2 && plain(m2.condition) ? m2.condition : null
  const path = condition && plain(condition.source_path) ? condition.source_path : null
  if (!path) return undefined
  return {tattva_ref: coordinate(path.tattva_coordinate) ? path.tattva_coordinate : null, material_fibre: fibre(path.material_fibre) ? path.material_fibre : null}
}

/** The condition as the frame announced it, exact or refused (null). */
export function readFrameCondition(raw: unknown): FrameInstrumentCondition | null {
  if (!plain(raw) || Object.keys(raw).length !== 2 || !('tattva_ref' in raw) || !('material_fibre' in raw)) return null
  if (raw.tattva_ref !== null && !coordinate(raw.tattva_ref) || raw.material_fibre !== null && !fibre(raw.material_fibre)) return null
  return {tattva_ref: raw.tattva_ref as string | null, material_fibre: raw.material_fibre as MaterialFibreName | null}
}
