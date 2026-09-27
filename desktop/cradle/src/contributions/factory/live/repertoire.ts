/**
 * Repertoire resolution for a Run's act (contract §5, spec §5 "Repertoire
 * association"): an explicitly selected Expression wins; otherwise the
 * workflow-associated Expression, then task/SkillSet-associated material,
 * then the generic Factory composition. Skill invocations contribute their
 * associated gesture or Scene within that repertoire.
 *
 * Pure: `material_list` entries in, material refs out. The act operations an
 * event map produces name repertoire keys (`arrival`, `handoff`, …, character
 * states, `invoke-skill`); this module turns each into the saved material the
 * kernel performs — never a Scene of its own making.
 */
import type {ActOp, CharacterState, RepertoireScene} from "./eventMap";
import type {MaterialListing} from "../../../expression/world";
type MaterialEntry = MaterialListing;

/** The generic Factory composition's association key (curated starter
 * material carries it: material/factory-expressions/expression/factory-generic). */
export const GENERIC_WORKFLOW_KEY = "factory:generic";
/** Where a repertoire key falls back when its own form is missing. */
const FALLBACK: Partial<Record<RepertoireScene, RepertoireScene>> = {continuation: "work-passage", explanation: "arrival"};

export interface RepertoireContext {
  explicit?: string; // file_ref of an explicitly selected Expression
  workflowKey?: string;
  /** The Run's unit keys and task refs (the workflow unit's task type). */
  taskTypes?: string[];
  /** The units' `agentRequirements.agentSetRefs`. */
  skillSetRefs?: string[];
  /** The units' / attempts' `praxisRefs` (the skills the work selects). */
  skillRefs?: string[];
}

/** The repertoire context a Run's workflow units and attempts disclose. */
export function contextOfUnits(units: {key?: string; workflowUnitRef?: string; praxisRefs?: string[]; agentRequirements?: {agentSetRefs?: string[]}}[], attempts: {taskRef?: string; disposition?: {praxisRefs?: string[]}}[] = []): Omit<RepertoireContext, "explicit" | "workflowKey"> {
  const uniq = (values: (string | undefined)[]) => [...new Set(values.filter((value): value is string => !!value))];
  return {
    taskTypes: uniq([...units.map(unit => unit.key), ...attempts.map(attempt => attempt.taskRef)]),
    skillSetRefs: uniq(units.flatMap(unit => unit.agentRequirements?.agentSetRefs ?? [])),
    skillRefs: uniq([...units.flatMap(unit => unit.praxisRefs ?? []), ...attempts.flatMap(attempt => attempt.disposition?.praxisRefs ?? [])]),
  };
}
export interface Repertoire {
  expression?: MaterialEntry;
  basis: "explicit" | "workflow" | "task-or-skillset" | "generic" | "none";
  /** Every entry considered (scenes/gestures/characters for fallbacks). */
  material: MaterialEntry[];
}

const has = (list: string[] | undefined, value: string | undefined) => !!value && !!list?.includes(value);
/** Skill refs match by exact ref, `skill:` prefix or trailing name. */
const skillMatch = (list: string[] | undefined, skill: string | undefined) => !!skill && !!list?.some(ref => ref === skill || ref === `skill:${skill}` || skill === `skill:${ref}` || ref.endsWith(`/${skill}`) || ref.endsWith(`:${skill}`) || skill.endsWith(`/${ref}`) || skill.endsWith(`:${ref.replace(/^skill:/, "")}`));
const hasAny = (list: string[] | undefined, values: string[] | undefined) => !!values?.some(value => list?.includes(value));

export function resolveRepertoire(material: MaterialEntry[], context: RepertoireContext): Repertoire {
  const expressions = material.filter(entry => entry.kind === "expression");
  const explicit = context.explicit ? expressions.find(entry => entry.file_ref === context.explicit) ?? material.find(entry => entry.file_ref === context.explicit) : undefined;
  if (explicit) return {expression: explicit, basis: "explicit", material};
  const workflow = expressions.find(entry => has(entry.associations?.workflow_keys, context.workflowKey));
  if (workflow) return {expression: workflow, basis: "workflow", material};
  const task = expressions.find(entry => hasAny(entry.associations?.task_types, context.taskTypes) || hasAny(entry.associations?.skill_set_refs, context.skillSetRefs)
    || (context.skillRefs ?? []).some(skill => skillMatch(entry.associations?.skill_refs, skill)));
  if (task) return {expression: task, basis: "task-or-skillset", material};
  const generic = expressions.find(entry => has(entry.associations?.workflow_keys, GENERIC_WORKFLOW_KEY));
  if (generic) return {expression: generic, basis: "generic", material};
  return {basis: "none", material};
}

export interface ResolvedMaterial {file_ref: string; revision?: string; scene_ref?: string; state?: string; gesture?: string; basis: string}

/** A repertoire Scene key → the selected Expression's named state (its
 * `reuse.states[key]`), else a Scene associated with the key, else the key's
 * fallback. */
export function sceneFor(repertoire: Repertoire, key: RepertoireScene): ResolvedMaterial | undefined {
  for (let current: RepertoireScene | undefined = key; current; current = FALLBACK[current]) {
    const scene = repertoire.expression?.states?.[current];
    if (repertoire.expression && scene) return {file_ref: repertoire.expression.file_ref, revision: repertoire.expression.revision, scene_ref: scene, basis: `${repertoire.basis}:${current}`};
    const standalone = repertoire.material.find(entry => entry.kind === "scene" && (entry.associations?.event_families?.includes(current!) || slugOf(entry.file_ref) === current));
    if (standalone) return {file_ref: standalone.file_ref, revision: standalone.revision, scene_ref: standalone.entry_scene_ref ?? undefined, basis: `scene:${current}`};
  }
  return undefined;
}

/** A character state for a cast member: the member's own profile character
 * when it has one, else a curated character by cast position (so two
 * participants never share one body by accident). */
export function characterFor(repertoire: Repertoire, characterRef: string | undefined, castIndex: number, state: CharacterState): ResolvedMaterial | undefined {
  if (characterRef) return {file_ref: characterRef, state, basis: "profile-character"};
  const characters = repertoire.material.filter(entry => entry.kind === "character");
  if (!characters.length) return undefined;
  const chosen = characters[castIndex % characters.length];
  // An object-local state change names the character material and state only
  // (the role's entity takes that state's `self` material; no Scene change).
  return {file_ref: chosen.file_ref, revision: chosen.revision, state, basis: "curated-character"};
}

/** A gesture: skill-associated material first (spec: skill invocations
 * contribute their associated gesture or Scene), then the character's own
 * gesture, then the curated gesture material. */
export function gestureFor(repertoire: Repertoire, gesture: "invoke-skill" | "operate", skill: string | undefined, characterRef: string | undefined): ResolvedMaterial | undefined {
  // 1. Material associated with this very skill (a gesture, a Scene, or an
  //    Expression carrying the skill in its associations).
  if (skill) {
    const bySkill = repertoire.material.find(entry => skillMatch(entry.associations?.skill_refs, skill) && entry !== repertoire.expression && entry.kind !== "character");
    if (bySkill) return {file_ref: bySkill.file_ref, revision: bySkill.revision, scene_ref: bySkill.gestures?.[gesture]?.scene_ref ?? bySkill.entry_scene_ref ?? undefined, gesture, basis: `skill:${skill}`};
  }
  // 2. The selected Expression's own gestures (its artistic language).
  const own = repertoire.expression?.gestures?.[gesture];
  if (repertoire.expression && own) return {file_ref: repertoire.expression.file_ref, revision: repertoire.expression.revision, scene_ref: own.scene_ref, gesture, basis: `${repertoire.basis}:gesture`};
  // 3. The performer's profile character.
  if (characterRef) return {file_ref: characterRef, gesture, basis: "profile-character"};
  // 4. Curated gesture material, then a curated character's gesture.
  const curated = repertoire.material.find(entry => entry.kind === "gesture" && entry.gestures?.[gesture]) ?? repertoire.material.find(entry => entry.kind === "gesture");
  if (curated) return {file_ref: curated.file_ref, revision: curated.revision, scene_ref: curated.gestures?.[gesture]?.scene_ref ?? curated.entry_scene_ref ?? undefined, gesture, basis: "curated-gesture"};
  const character = repertoire.material.find(entry => entry.kind === "character" && entry.gestures?.[gesture]);
  return character ? {file_ref: character.file_ref, revision: character.revision, scene_ref: character.gestures![gesture].scene_ref, gesture, basis: "curated-character"} : undefined;
}

const slugOf = (fileRef: string) => fileRef.replace(/^.*\//, "").replace(/\.expression\.json$/, "");

/** Resolve one mapped operation's material (undefined for act_text, which
 * fills a role in whatever is performing). */
export function materialFor(repertoire: Repertoire, op: ActOp, characterOf: (role: string) => {character_ref?: string; index: number}): ResolvedMaterial | undefined {
  if (op.operation === "act_text") return undefined;
  if (op.operation === "act_gesture") { const who = characterOf(op.role); return gestureFor(repertoire, op.gesture, op.skill, who.character_ref); }
  if ("scene" in op) return sceneFor(repertoire, op.scene);
  const who = characterOf(op.role);
  return characterFor(repertoire, who.character_ref, who.index, op.state);
}
