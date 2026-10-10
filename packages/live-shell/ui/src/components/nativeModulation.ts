import type {NativeEditorReading, Scene} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, automationTarget, entityTargets} from '../../../../expressions-boundary/src/parameters'
import {resolveNativeRackTarget, type NativeRackTarget} from '../../../../expressions-boundary/src/nativeRackSchema'
import {resolvedAutomation} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks'

/** Modulation honesty (WORLD-SHELL-DESIGN §14): a value that something moves shows what moves it.
 * Pure: every fact is read from the reading. The sources are automation lanes, recorded property takes, rack macros and the shared
 * Field values. Follow and Bind pins choose which object a pin shows; they are not value modulators, so they never appear here. */
export type ModulationKind = 'automation' | 'take' | 'macro' | 'shared'
export interface ModulationSource {kind: ModulationKind; id: string; name: string}
export interface Modulation {
  /** The control's target: `field.<key>` for a Field parameter, `entity:<id>:<suffix>` for an object parameter. */
  target: string
  /** The authored value the control reads (baseValue for a Field parameter, the entity target value for an object). Null when the target is unknown. */
  base: number | null
  /** The engine's observed value for this target when the reading carries one, else null. */
  effective: number | null
  sources: ModulationSource[]
}

const SHARED_NAME = 'Shared value'
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function labelOf(scene: Scene, target: string): string {
  if (target.startsWith('field.')) {
    const binding = NATIVE_BINDINGS.find(row => 'field.' + row.key === target)
    if (binding) return binding.label
  }
  return entityTargets(scene).find(row => row.target === target)?.label ?? target
}

function baseOf(scene: Scene, target: string): number | null {
  try {
    const row = automationTarget(scene, target)
    return row && finite(row.value) ? row.value : null
  } catch {
    // A malformed target string cannot name a value; the control shows no base.
    return null
  }
}

function effectiveOf(reading: NativeEditorReading, target: string): number | null {
  const observed = reading.observation?.effectiveValues?.[target]
  return finite(observed) ? observed : null
}

/** An enabled lane drives its target. A follower lane also needs its leader enabled, as the engine resolves it. */
function drives(lanes: Scene['automation'], lane: Scene['automation'][number]): boolean {
  try {
    return resolvedAutomation(lanes, lane).enabled === true
  } catch {
    // A link cycle cannot drive anything; the validator refuses such a reading.
    return false
  }
}

function automationSources(reading: NativeEditorReading, target: string, label: string): ModulationSource[] {
  const lanes = reading.scene.automation ?? []
  return lanes.filter(lane => lane.target === target && drives(lanes, lane))
    .map(lane => ({kind: 'automation' as const, id: lane.id, name: `${label} · ${lane.type} ${lane.wave}`}))
}

/** A recorded property track names its target by bind. Field tracks are `field.params.<key>` with no entity; object tracks match their entity and bind. */
function takeSources(reading: NativeEditorReading, target: string): ModulationSource[] {
  const scene = reading.scene
  if (target.startsWith('field.')) {
    const key = target.slice('field.'.length)
    if (!NATIVE_BINDINGS.some(row => row.key === key)) return []
    return (scene.propertyTracks ?? [])
      .filter(track => !track.entityId && track.bind === 'field.params.' + key)
      .map(track => ({kind: 'take' as const, id: track.id, name: `Take ${track.id}`}))
  }
  const entity = entityTargets(scene).find(row => row.target === target)
  if (!entity) return []
  return (scene.propertyTracks ?? [])
    .filter(track => track.entityId === entity.entityId && track.bind === entity.bind)
    .map(track => ({kind: 'take' as const, id: track.id, name: `Take ${track.id}`}))
}

/** A macro's mapping counts only when the admitted resolver maps it to this exact target in this Scene. An unresolvable mapping is not guessed. */
function macroSources(reading: NativeEditorReading, target: string): ModulationSource[] {
  const occurrences = reading.entityOccurrences ?? {}
  const out: ModulationSource[] = []
  for (const rack of reading.scene.parameterRacks?.racks ?? []) {
    for (const macro of rack.macros) {
      for (const mapping of macro.mappings) {
        if (resolvesTo(reading.scene, occurrences, mapping.target, target)) out.push({kind: 'macro', id: macro.id, name: macro.name})
      }
    }
  }
  return out
}

function resolvesTo(scene: Scene, occurrences: Readonly<Record<string, string>>, mapping: NativeRackTarget, target: string): boolean {
  try {
    return resolveNativeRackTarget(scene, occurrences, mapping).target === target
  } catch {
    // The mapping does not resolve in this Scene (absent entity, unadmitted path). It modulates nothing here.
    return false
  }
}

function sharedSources(reading: NativeEditorReading, target: string): ModulationSource[] {
  return reading.sharedTargets?.includes(target) ? [{kind: 'shared', id: target, name: SHARED_NAME}] : []
}

/** Everything that moves one control's value, read from the reading. Pure and total: an unknown target has no sources and no base. */
export function modulationOf(reading: NativeEditorReading, target: string): Modulation {
  const label = labelOf(reading.scene, target)
  return {
    target,
    base: baseOf(reading.scene, target),
    effective: effectiveOf(reading, target),
    sources: [
      ...automationSources(reading, target, label),
      ...takeSources(reading, target),
      ...macroSources(reading, target),
      ...sharedSources(reading, target),
    ],
  }
}

const shown = (value: number | null) => value === null ? '—' : String(Number(value.toFixed(4)))

export interface ModulationView {
  /** True when at least one source names the control. */
  named: boolean
  /** The source names joined for display, or a plain statement when the effective value differs and no source is named. */
  driven: string
  base: string
  effective: string
  /** One sentence for titles and accessible names. */
  accessible: string
}

/** The disclosure a control shows, or null when nothing modulates it and its effective value matches its base.
 * A disagreement with no named source is still shown, so an unexplained difference is never hidden. */
export function modulationView(modulation: Modulation | null | undefined): ModulationView | null {
  if (!modulation) return null
  const drift = modulation.effective !== null && modulation.base !== null && modulation.effective !== modulation.base
  if (modulation.sources.length === 0 && !drift) return null
  const named = modulation.sources.length > 0
  const driven = named ? modulation.sources.map(source => source.name).join('; ') : 'no source named in this reading'
  const base = shown(modulation.base), effective = shown(modulation.effective)
  return {named, driven, base, effective, accessible: `${named ? 'Driven by' : 'Unexplained'} ${driven}. Base ${base}. Effective ${effective}.`}
}
