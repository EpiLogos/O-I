import type {Scene} from './model';
import {bindValue, nativeBinding} from './nativeParameters.js';
import {stageLiveRefusal} from './stageCommands.js';

/** The frame's transient value layer for the live parameter channel (stageCommands.ts, command 'live').
 * It is runtime state: it never touches the document, the store or its history. Two kinds of entry, both keyed by the registry target `field.<key>`:
 *  - a drag override, streamed while a gesture moves and cleared by release (the committed value is then the document's own);
 *  - a hold, a manual value kept on a parameter that automation drives, until `automation resume` hands it back.
 * apply() returns a copy of the scene with those values and with the automation lanes that target them removed, so a dragged
 * or held parameter shows the value the person set rather than the lane's output. */
export class LiveOverrides {
  private drags = new Map<string, number>();
  private holds = new Map<string, number>();
  /** Bumps on every change; the engine rebuilds its configuration when it moves (EngineFrame.liveRevision). */
  version = 0;

  setDrag(target: string, value: number) {
    const refusal = stageLiveRefusal(target, value);
    if (refusal) throw new Error(refusal);
    if (this.drags.get(target) === value) return;
    this.drags.set(target, value); this.version++;
  }
  /** Clears every drag override. Holds stay: they end only at resume. */
  releaseDrags(): boolean {
    if (!this.drags.size) return false;
    this.drags.clear(); this.version++;
    return true;
  }
  /** Keeps a manual value on a parameter. The caller has checked that an enabled automation lane drives the target. */
  hold(target: string, value: number) {
    const refusal = stageLiveRefusal(target, value);
    if (refusal) throw new Error(refusal);
    this.drags.delete(target); this.holds.set(target, value); this.version++;
  }
  /** Releases every hold and returns how many were held. */
  resume(): number {
    const count = this.holds.size;
    if (count) {this.holds.clear(); this.version++;}
    return count;
  }
  heldCount(): number {return this.holds.size;}
  active(): boolean {return this.drags.size > 0 || this.holds.size > 0;}
  /** The value a registry bind path currently holds (a drag outranks a hold), for the take sampler. */
  valueForBind(bind: string): number | undefined {
    for (const [target, value] of this.drags) if (nativeBinding(target.slice(6))?.bind === bind) return value;
    for (const [target, value] of this.holds) if (nativeBinding(target.slice(6))?.bind === bind) return value;
    return undefined;
  }
  /** The scene with this layer applied: unchanged (same reference) when nothing is overridden. */
  apply(scene: Scene): Scene {
    if (!this.active()) return scene;
    const out: Scene = {...scene, field: {...scene.field, params: {...scene.field.params}}, engine: {...scene.engine}, morph: {...scene.morph}, composition: {...scene.composition}};
    const taken = new Set<string>();
    for (const layer of [this.holds, this.drags]) for (const [target, value] of layer) {
      const binding = nativeBinding(target.slice(6));
      if (!binding) continue;
      bindValue(out, binding.bind, value);
      taken.add(target);
    }
    if (out.automation?.some(lane => taken.has(lane.target))) out.automation = out.automation.filter(lane => !taken.has(lane.target));
    return out;
  }
}
