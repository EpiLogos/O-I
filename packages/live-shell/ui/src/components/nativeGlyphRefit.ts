/** Refit all states as boundary changes. The app's own law (stateSizing.refitFormationToGlyphs) runs on a
 * clone; only the states whose objectState it changed are encoded, as step-overrides capture with the
 * exact computed state. A held formation's base box has no boundary write path, so it is refused here. */
import type {Entity, NativeGlyphChange} from '../../../../expressions-boundary/src/editor';
import {refitFormationToGlyphs, type FontRef} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/stateSizing';

export interface GlyphRefitPlan {changes: NativeGlyphChange[]; blocked: string | null}
export const HELD_REFIT_DISCLOSURE = 'Refit all is not available through the boundary yet for a held formation: its base box has no write path. Play or manual blend refits the states.';

/** The refit mutates only the top-level box, the native extent, and each state's objectState, so the clone copies those
 * and shares the rest (image dataUrls are large and never touched by the refit). */
function refitWorkingCopy(entity: Entity): Entity {
  return {...entity, size: {...entity.size}, native: entity.native ? {...entity.native} : entity.native,
    sequence: {...entity.sequence, steps: entity.sequence.steps.map(step => ({...step, objectState: step.objectState ? structuredClone(step.objectState) : undefined}))}};
}
const plans = new WeakMap<Entity, {font: string; plan: GlyphRefitPlan}>();

export function planGlyphRefit(entity: Entity, font: FontRef): GlyphRefitPlan {
  const key = JSON.stringify(font), memo = plans.get(entity);
  if (memo?.font === key) return memo.plan;
  const plan = computeGlyphRefit(entity, font);
  plans.set(entity, {font: key, plan});
  return plan;
}
function computeGlyphRefit(entity: Entity, font: FontRef): GlyphRefitPlan {
  if (entity.kind !== 'formation') return {changes: [], blocked: 'Choose a formation to refit'};
  const next = refitWorkingCopy(entity);
  refitFormationToGlyphs(next, font);
  if (JSON.stringify(next.size) !== JSON.stringify(entity.size) || JSON.stringify(next.native) !== JSON.stringify(entity.native)) return {changes: [], blocked: HELD_REFIT_DISCLOSURE};
  const changes = entity.sequence.steps.flatMap((step, index): NativeGlyphChange[] => {
    const after = next.sequence.steps[index]?.objectState;
    if (JSON.stringify(after) === JSON.stringify(step.objectState)) return [];
    return [{kind: 'step-overrides', entity_id: entity.id, step_id: step.id, operation: 'capture', values: structuredClone(after)}];
  });
  return {changes, blocked: null};
}
