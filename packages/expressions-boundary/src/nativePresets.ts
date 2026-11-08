/** A built-in preset's objects added to the open Scene: one native edit (O-I #747 round 894, the port ledger's add-built-in and chakra-add).
 * The app's own acts, ported whole: add-built-in (app.ts case 'add-built-in') adds the objects of a built-in preset's first scene; chakra-add
 * (app.ts case 'chakra-add', mergeSemanticStarter) adds the Semantic Chakra Body's seven yantra centres with their meanings. Every object
 * takes fresh entity and state identities, so a preset added twice never repeats one; the scene's 32 objects bound it, as formation-add's.
 * The meanings follow the app's binding law: the field's profile, affinity and global colour gain are the starter's own, each binding
 * keeps its centre, colour and modulation, its carrier points at the new centre, and its identity is fresh.
 *
 * Kept apart from nativeFormations.ts: the presets are generated material (COMPOSITION_PRESETS), which only the frame's editor and this
 * module's tests load. The shell names the presets from FORMATION_PRESET_ROWS (nativePresetRows.ts) and loads none of them. Pure. */
import type {Journey, NativeFormationPresetChange} from './editor';
import {FORMATION_SCENE_LIMIT} from './nativeFormations';
import {FORMATION_PRESET_ROWS, type FormationPreset} from './nativePresetRows';
import {clone, fieldStudies, smallLanguage, uid, validateJourney, type Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {nativeSnapshotToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge';
import {COMPOSITION_PRESETS} from '../../../desktop/cradle/expressions-app/src/engine/compositionPresets';

export {FORMATION_PRESET_ROWS as FORMATION_PRESETS, type FormationPreset};

/** The Semantic Chakra Body's scene, built as the starters and the app's Seven centres build it (expressions.ts startingPoints,
 * 'composition-chakra_body'; nativeSeven's first scene). Built here, not imported: expressions.ts installs the app's library listeners when
 * it loads, which a module the boundary and its tests import must not do. */
function chakraBodyScene(): Scene {
  const preset = COMPOSITION_PRESETS.find(row => row.id === 'chakra_body');
  if (!preset) throw Error('The Semantic Chakra Body starter is unavailable.');
  const built = preset.build();
  return nativeSnapshotToJourney({name: preset.name, config: {particleCount: 62000, entities: built.entities, composition: built.composition,
    cymatics: built.cymatics, semanticField: built.semanticField, resonanceDrive: built.resonanceDrive}}).scenes[0];
}

/** The scene a preset's objects come from: a built-in preset's first scene (app.ts preset(): Seven centres is nativeSeven(), whose first
 * scene is the Chakra Body's, named for its preset and with no text), or the Semantic Chakra Body starter's. */
export function presetScene(preset: FormationPreset): Scene {
  if (preset === 'chakra-body') return chakraBodyScene();
  if (preset === 'seven-centres') {
    const scene = chakraBodyScene(), named = COMPOSITION_PRESETS.find(row => row.id === 'chakra_body');
    scene.name = named?.name ?? scene.name; scene.text = [];
    return scene;
  }
  return (preset === 'small-language' ? smallLanguage() : fieldStudies()).scenes[0];
}
/** The meanings come only with the Semantic Chakra Body (app.ts chakra-add, mergeSemanticStarter); a built-in preset adds its objects only
 * (app.ts add-built-in). */
const BRINGS_MEANINGS: ReadonlySet<FormationPreset> = new Set(['chakra-body']);

const PRESET_KEYS = ['kind', 'preset'];
/** Admit one formation-preset exactly, or refuse with the legible reason. */
export function validateFormationPreset(change: unknown): FormationPreset {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose a preset to add.');
  const row = change as Record<string, unknown>;
  if (row.kind !== 'formation-preset' || Object.keys(row).some(key => !PRESET_KEYS.includes(key))) throw Error('A preset add carries only its preset.');
  const preset = FORMATION_PRESET_ROWS.find(item => item.preset === row.preset);
  if (!preset) throw Error('Choose a preset the browser offers: Field studies, A small language, Seven centres or the Semantic Chakra Body.');
  return preset.preset;
}

/** Adds each preset's objects (and the Chakra Body's meanings) to the Scene. One call is one owner transaction; the caller commits once. */
export function applyNativeFormationPresets(journey: Journey, sceneId: string, changes: readonly NativeFormationPresetChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > FORMATION_SCENE_LIMIT) throw Error('Choose between 1 and 32 preset additions.');
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  for (const change of changes) {
    const preset = validateFormationPreset(change), source = presetScene(preset);
    if (scene.entities.length + source.entities.length > FORMATION_SCENE_LIMIT) throw Error('A scene holds up to 32 formations and pins.');
    const incoming = clone(source.entities), idMap = new Map<string, string>();
    for (const entity of incoming) {
      const id = uid('entity');
      idMap.set(entity.id, id);
      entity.id = id;
      // The engine entity the preset was built from rides with it (its centre and station among it), as the app's add keeps it, under
      // this object's identity: the owner's correspondence writes the occurrence's own id there (sceneCorrespondence.ts), so a preset
      // object keeping the engine's id (ent_semantic_muladhara …) never read back as sent and its acknowledgement was refused (the walk
      // of #747 r894).
      if (entity.native) entity.native = {...entity.native, id};
      entity.sequence.steps.forEach(step => {step.id = uid('step')});
    }
    scene.entities.push(...incoming);
    // The meanings, by the app's mergeSemanticStarter: only the Chakra Body brings them, and only a source that carries bindings.
    if (BRINGS_MEANINGS.has(preset) && source.semanticField?.bindings.length) {
      const field = scene.semanticField ??= {enabled: true, profile: clone(source.semanticField.profile), affinity: clone(source.semanticField.affinity),
        globalColorGain: source.semanticField.globalColorGain, bindings: []};
      field.enabled = true;
      field.profile = clone(source.semanticField.profile);
      field.affinity = clone(source.semanticField.affinity);
      field.globalColorGain = source.semanticField.globalColorGain;
      for (const raw of source.semanticField.bindings) {
        const binding = clone(raw);
        binding.id = uid('semantic');
        binding.carriers = binding.carriers.map(carrier => carrier.kind === 'entity' ? {...carrier, id: idMap.get(carrier.id) ?? carrier.id} : carrier);
        field.bindings.push(binding);
      }
    }
  }
  validateJourney(draft);
  return draft;
}
