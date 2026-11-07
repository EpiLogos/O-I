/** XS04 (O-I #747 round 888; DLW build ruling 2026-11-06, the lane's structural proposal accepted): another Expression held over the
 * presented one, on the one field. Live's Session holds a track for each Expression and plays a clip on each at once; here the presented
 * Expression is the one the frame edits, and each Expression held over it is a track of its own whose scene plays on the same field. A
 * launched scene's symbols join the one Scene the engine draws and sounds (production.ts reads the picture and the object sound off that
 * one Scene), so the scenes play together, picture and sound from one state. The presented Scene's field (its sky, its parameters) stands;
 * a layered scene brings its symbols, their sequences and sound, and its automation, read at its own time.
 * Round 889: a launch reads the held Expression afresh, so its Activator counts as its document stands now (item 4); each held Expression has
 * its own mixer — its Activator, Solo and Volume, kept in its own document and written through its owner (`mix`), and heard in the Main mix
 * with the presented one (native-field/entitySound.ts voiceMixOf).
 * Pure: no DOM and no I/O of its own. The frame reads a held Expression through the kernel's expression read, and writes its mixer through
 * the owner's scene edit, and hands both in. */
import type {Journey, Scene} from './model.js';
import {evaluateTracks} from './propertyTracks.js';
import {NESTED_WINDOW} from './nestedOccurrence.js';
import {FIELD_LAYERS_MAX, type FieldLayerMixSet, type FieldLayerReading} from './stageCommands.js';
import {expressionMixOf, expressionMixRefusal, type ExpressionMixReading} from './native-field/entitySound.js';

/** A held Expression as the kernel's read gives it, converted as the frame converts the Expression it opens. */
export interface FieldLayerDocument {expression_ref: string; title: string; revision: number; journey: Journey}
interface Held extends FieldLayerDocument {playing: {scene_ref: string; elapsed: number; loop: boolean} | null}

const NOT_HELD = 'That Expression is not held over the field: hold it first.';

export function createFieldLayers(deps: {read: (ref: string) => Promise<FieldLayerDocument>; presented: () => string | null;
  /** Write the held Expression's own mixer through its owner (the scene edit `mix`; null returns a setting to its default). */
  mix?: (ref: string, set: FieldLayerMixSet) => Promise<void>}) {
  const held = new Map<string, Held>();
  /** Moves on every act, so the field draws the layers afresh; a layered scene's automation moves it with its own clock. */
  let version = 0;
  const layer = (ref: string): Held => {
    const found = held.get(ref);
    if (!found) throw Error(NOT_HELD);
    return found;
  };
  const sceneOf = (layer: Held) => layer.playing ? layer.journey.scenes.find(scene => scene.id === layer.playing!.scene_ref) ?? null : null;
  /** Read the held Expression afresh, keeping the scene it plays where that scene still stands. */
  const reread = async (ref: string): Promise<Held> => {
    const read = await deps.read(ref);
    const before = held.get(ref);
    const playing = before?.playing && read.journey.scenes.some(scene => scene.id === before.playing!.scene_ref) ? before.playing : null;
    const next = {...read, playing};
    held.set(ref, next);
    version++;
    return next;
  };
  return {
    /** Read the Expression onto the field (afresh when it is held already). */
    async hold(ref: string): Promise<string> {
      if (ref === deps.presented()) throw Error('That Expression is the one presented: its scenes play on the field already.');
      if (!held.has(ref) && held.size >= FIELD_LAYERS_MAX) throw Error(`The field holds ${FIELD_LAYERS_MAX} Expressions over the presented one: release one first.`);
      const read = await reread(ref);
      return `${read.title} is held over the field: launch one of its scenes.`;
    },
    /** Launch one of the held Expression's scenes over the field, from its start; it plays to its end, or round again when it loops. The
     * Expression is read afresh first: its Activator and its scenes count as its document stands now (round 889, item 4). */
    async start(ref: string, sceneRef: string, loop = false): Promise<string> {
      layer(ref);
      const target = await reread(ref);
      if (target.journey.mix?.active === false) throw Error('This Expression\'s Activator is off: its scenes do not launch.');
      const scene = target.journey.scenes.find(row => row.id === sceneRef);
      if (!scene) throw Error(`${target.title} has no scene ${sceneRef}.`);
      if (scene.entities.length > NESTED_WINDOW.entities)
        throw Error(`${scene.name} holds ${scene.entities.length} symbols: a scene layered over the field holds at most ${NESTED_WINDOW.entities}.`);
      target.playing = {scene_ref: sceneRef, elapsed: 0, loop};
      version++;
      return `${scene.name} plays over the field.`;
    },
    stop(ref: string): string {
      const target = layer(ref);
      target.playing = null;
      version++;
      return `${target.title} stops: the field plays the presented Expression alone.`;
    },
    /** Set the held Expression's own mixer (its Activator, Solo and Volume) through its owner, then read it afresh. The Main level is the
     * presented Expression's (the Main track sets every Expression's level together). Refused in words before any write. */
    async mix(ref: string, set: FieldLayerMixSet): Promise<string> {
      const target = layer(ref);
      if (!deps.mix) throw Error('This field writes no held Expression\'s mixer.');
      if ('main' in set) throw Error('The Main level is the presented Expression\'s: set it on the Main track.');
      const next: Record<string, unknown> = {...target.journey.mix};
      for (const [key, value] of Object.entries(set)) if (value === null) delete next[key]; else next[key] = value;
      const refused = expressionMixRefusal(next);
      if (refused) throw Error(refused);
      await deps.mix(ref, set);
      const read = await reread(ref);
      return `${read.title}'s mixer is set.`;
    },
    /** Each held Expression's mixer as the field sounds it (native-field/entitySound.ts setLayerMixes). */
    mixes(): Map<string, ExpressionMixReading> {
      return new Map([...held.values()].map(target => [target.expression_ref, expressionMixOf(target.journey.mix)]));
    },
    release(ref: string): string {
      const target = layer(ref);
      held.delete(ref);
      version++;
      return `${target.title} is let go from the field.`;
    },
    /** The field's clock moved `seconds`: each layered scene plays on, and stops at its end unless it loops. Whether a scene stopped, so
     * the frame says so to the shell. */
    advance(seconds: number): boolean {
      if (!(seconds > 0)) return false;
      let ended = false;
      for (const target of held.values()) {
        const scene = sceneOf(target);
        if (!scene || !target.playing) continue;
        const from = target.playing.elapsed, elapsed = from + seconds;
        if (elapsed < scene.duration) target.playing = {...target.playing, elapsed};
        else if (target.playing.loop && scene.duration > 0) target.playing = {...target.playing, elapsed: elapsed % scene.duration};
        else { target.playing = null; version++; ended = true; continue }
        // Its symbols' own sequences run on the engine's clock; only its automation is read at its time, in steps of 1/60 s as the
        // presented Scene's tracks are (app.ts frameData).
        if (scene.propertyTracks?.length && Math.floor(target.playing.elapsed * 60) !== Math.floor(from * 60)) version++;
      }
      return ended;
    },
    /** Whether any layered scene plays. */
    playing(): boolean { return [...held.values()].some(target => target.playing !== null) },
    /** A term that moves whenever what the layers draw can have moved; constant while nothing changes. */
    revision(): number { return version },
    /** The presented Scene with every layered scene's symbols over it, each named by its Expression; the presented Scene itself when none
     * plays. An Expression held and then presented plays as the presented one, never twice. */
    over(base: Scene): Scene {
      const presented = deps.presented();
      const layered = [...held.values()].flatMap(target => {
        const scene = sceneOf(target);
        if (!scene || !target.playing || target.expression_ref === presented) return [];
        const now = scene.propertyTracks?.length ? evaluateTracks(scene, target.playing.elapsed) : scene;
        return now.entities.map(entity => ({...entity, id: `${target.expression_ref}#${entity.id}`}));
      });
      return layered.length ? {...base, entities: [...base.entities, ...layered]} : base;
    },
    /** What the frame reports to the shell (its hosted state's `layers`). */
    reading(): FieldLayerReading[] {
      return [...held.values()].map(target => ({expression_ref: target.expression_ref, title: target.title, revision: target.revision,
        active: target.journey.mix?.active !== false,
        mix: (({active, solo, level}) => ({active, solo, level}))(expressionMixOf(target.journey.mix)),
        scenes: target.journey.scenes.map(scene => ({scene_ref: scene.id, title: scene.name, duration: scene.duration})),
        playing: target.playing ? {...target.playing} : null}));
    },
  };
}
export type FieldLayers = ReturnType<typeof createFieldLayers>;
