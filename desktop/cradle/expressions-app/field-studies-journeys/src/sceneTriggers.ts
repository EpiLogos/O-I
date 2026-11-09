/** A scene's triggers, run on the occasions the manual lists (DLW §20.1 The Launch panel: Occasion "Scene enters · Scene leaves ·
 * Activated · Selected · Sequence moves on", "When a trigger runs"; Target "What a trigger does"). O-I #747 round 893, DLW build ruling
 * 2026-11-07:
 *   - Scene enters: when the scene's launch lands. Scene leaves: when another launch lands over it, or it ends of itself. Activated: when
 *     its launch is pressed, before the launch lands. Selected: when the scene is selected in the Session or the Arrangement. Sequence
 *     moves on: when the follow action takes the sequence on from it.
 *   - The target acts the same whatever the occasion. A Jump to a scene is a launch of that scene, landing at that scene's Quantize as a
 *     press would.
 *   - One launch's chain of triggered jumps enters each scene at most once: a jump to a scene the chain already entered is not run, and
 *     the Info line says so. A Live follow action takes time to come round; these triggers do not, so this is their bound.
 * "Scene leaves → Jump to a scene" is the follow action Jump (sceneTransport.ts followJumpTarget, XS07): it comes where the scene ends of
 * itself, as Live's does, never when another launch lands over the scene.
 * Pure: the frame's transport (app.ts) runs what this plans. */
import type {Journey} from './model';
import type {KernelSceneTrigger, TriggerOccasion} from './kernelDocumentBridge';
import type {FramePresentation} from './stageCommands.js';

type View = {bindings: Readonly<Record<string, {scene_ref: string; triggers?: readonly unknown[]}>>} | null | undefined;

/** How the Info line says each occasion after the scene's name. */
export const OCCASION_SAID: Readonly<Record<TriggerOccasion, string>> = {
  scene_enter: 'enters', scene_leave: 'leaves', activate: 'is activated', select: 'is selected', sequence_transition: 'moves on',
};

/** One launch's chain: the frame's scenes it has entered so far. */
export interface TriggerChain {readonly entered: Set<string>}
export function newTriggerChain(): TriggerChain {return {entered: new Set()};}

/** What one trigger does on its occasion. */
export type TriggerAct =
  | {kind: 'launch'; sceneId: string; said: string}
  | {kind: 'portal'; trigger_ref: string; said: string}
  | {kind: 'read'; operation: 'inspect' | 'list' | 'export'; expression_ref: string; said: string}
  /** Run a native Action: asked of the owner (kernel expression.rs Request::Trigger), which runs it only as a reading (round 894). */
  | {kind: 'action'; trigger_ref: string; action_ref: string; target_ref: string; said: string}
  | {kind: 'say'; text: string};

const isTrigger = (value: unknown): value is KernelSceneTrigger => !!value && typeof value === 'object'
  && typeof (value as KernelSceneTrigger).trigger_ref === 'string' && typeof (value as KernelSceneTrigger).occasion === 'string'
  && !!(value as KernelSceneTrigger).target && typeof (value as KernelSceneTrigger).target.kind === 'string';

/** The triggers the scene keeps for one occasion, in the order it declares them; none where no native view is read. */
export function triggersOn(view: View, sceneId: string, occasion: TriggerOccasion): KernelSceneTrigger[] {
  return ((view?.bindings[sceneId]?.triggers ?? []) as readonly unknown[]).filter(isTrigger).filter(trigger => trigger.occasion === occasion);
}

/** What the scene's triggers for `occasion` do now, in order, under `chain`. `followJump` false leaves out a leave's Jump (the follow
 * action's, which comes only where the scene ends of itself and is run there). A jump the chain already entered, or whose scene is gone,
 * is said instead of run. A native Action is asked of its owner, which runs it only where it reads (round 894). */
export function planTriggers(journey: Journey, view: View, sceneId: string, occasion: TriggerOccasion, chain: TriggerChain,
  options: {followJump?: boolean} = {}): TriggerAct[] {
  const name = (id: string) => journey.scenes.find(scene => scene.id === id)?.name || 'This scene';
  const from = `${name(sceneId)} ${OCCASION_SAID[occasion]}`;
  const acts: TriggerAct[] = [];
  for (const trigger of triggersOn(view, sceneId, occasion)) {
    const target = trigger.target;
    if (target.kind === 'navigate') {
      if (occasion === 'scene_leave' && options.followJump === false) continue;
      if (!target.scene_ref) continue;
      const to = journey.scenes.find(scene => view?.bindings[scene.id]?.scene_ref === target.scene_ref);
      if (!to) {acts.push({kind: 'say', text: `${from} → its scene was not run: the scene it jumps to is no longer in this Expression.`}); continue;}
      if (chain.entered.has(to.id)) {acts.push({kind: 'say', text: `${from} → ${name(to.id)} was not run: ${name(to.id)} was already entered in this chain.`}); continue;}
      acts.push({kind: 'launch', sceneId: to.id, said: `${from} → ${name(to.id)}`});
    } else if (target.kind === 'portal') acts.push({kind: 'portal', trigger_ref: trigger.trigger_ref, said: `${from} → a ${PLACEMENT_SAID[target.placement] ?? 'portal'}`});
    else if (target.kind === 'expression_operation' && (target.operation === 'inspect' || target.operation === 'list' || target.operation === 'export'))
      acts.push({kind: 'read', operation: target.operation, expression_ref: target.expression_ref, said: from});
    else if (target.kind === 'native_action') acts.push({kind: 'action', trigger_ref: trigger.trigger_ref, action_ref: target.action_ref, target_ref: target.target_ref, said: `${from} → ${target.action_ref}`});
    else acts.push({kind: 'say', text: `${from} → its target was not run: this frame does not know it.`});
  }
  return acts;
}
/** The frame's side of running triggers (app.ts gives its transport, host and Info line). */
export interface TriggerRuntime {
  journey(): Journey;
  view(): View;
  /** A launch on its way, in `chain`: it lands at once (the frame then calls launchLanded) or is held for its scene's Quantize. */
  place(sceneId: string, chain: TriggerChain): void;
  /** A portal trigger of `sceneId`, asked of the host. */
  portal(trigger_ref: string, sceneId: string, said: string): void;
  read(act: Extract<TriggerAct, {kind: 'read'}>): void;
  /** A native Action trigger of `sceneId`, asked of the owner's `trigger`. */
  action(act: Extract<TriggerAct, {kind: 'action'}>, sceneId: string): void;
  /** Words for the Info line. */
  say(text: string): void;
}
/** Run the scene's triggers on one occasion, in order. True when a Jump was launched. */
export function runTriggers(runtime: TriggerRuntime, sceneId: string, occasion: TriggerOccasion, chain: TriggerChain, options?: {followJump?: boolean}): boolean {
  const view = runtime.view();
  if (!view) return false;
  let launched = false;
  for (const act of planTriggers(runtime.journey(), view, sceneId, occasion, chain, options)) {
    if (act.kind === 'say') runtime.say(act.text);
    else if (act.kind === 'launch') {
      launched = true;
      try {runtime.place(act.sceneId, chain);} catch (cause) {runtime.say(`${act.said} did not act: ${cause instanceof Error ? cause.message : String(cause)}`);}
    } else if (act.kind === 'portal') runtime.portal(act.trigger_ref, sceneId, act.said);
    else if (act.kind === 'action') runtime.action(act, sceneId);
    else runtime.read(act);
  }
  return launched;
}
/** A launch has landed on `sceneId`: the scene it landed over leaves (its Jump is its follow action's, which comes only where it ends of
 * itself), then `sceneId` enters `chain`, and its enter triggers run in that chain. */
export function launchLanded(runtime: TriggerRuntime, sceneId: string, chain: TriggerChain, outgoing: string | null): void {
  if (outgoing && outgoing !== sceneId) runTriggers(runtime, outgoing, 'scene_leave', chain, {followJump: false});
  chain.entered.add(sceneId);
  runTriggers(runtime, sceneId, 'scene_enter', chain);
}
/** Activated: a press of the scene's launch. Its triggers run before its launch lands; a Jump among them is a launch of its scene,
 * and it takes the press's place, as a later launch takes a held one's. */
export function pressLaunch(runtime: TriggerRuntime, sceneId: string): void {
  const chain = newTriggerChain();
  if (!runTriggers(runtime, sceneId, 'activate', chain)) runtime.place(sceneId, chain);
}
/** The follow action took the sequence on from `from` (its Jump, or Next in the saved sequence) and landed on `sceneId`, in a chain of its
 * own (a follow action takes time to come round): `from` leaves and moves on, then `sceneId` enters. */
export function followLanded(runtime: TriggerRuntime, from: string, sceneId: string): void {
  const chain = newTriggerChain();
  chain.entered.add(sceneId);
  runTriggers(runtime, from, 'scene_leave', chain, {followJump: false});
  runTriggers(runtime, from, 'sequence_transition', chain);
  runTriggers(runtime, sceneId, 'scene_enter', chain);
}
/** `from` ended of itself and nothing follows it: it leaves. */
export function sceneStopped(runtime: TriggerRuntime, from: string): void {
  runTriggers(runtime, from, 'scene_leave', newTriggerChain(), {followJump: false});
}
const PLACEMENT_SAID: Readonly<Record<string, string>> = {preview: 'preview portal', overlay: 'overlay portal', beside: 'portal beside', full: 'full portal', detached: 'detached portal', re_dock: 're-dock portal'};

/** What a read trigger says it read, in one line on the Info line: the Expression's title and scenes (Inspect and Export), or how many
 * Expressions are listed (List). A reply it cannot read is said as such. */
export function readSaid(said: string, operation: 'inspect' | 'list' | 'export', reply: unknown): string {
  const record = reply && typeof reply === 'object' ? reply as Record<string, unknown> : {};
  if (operation === 'list') {
    const entries = Array.isArray(record.expressions) ? record.expressions : null;
    return entries ? `${said} → ${entries.length} Expression${entries.length === 1 ? '' : 's'} listed.` : `${said} → the list of Expressions could not be read.`;
  }
  const document = record.document && typeof record.document === 'object' ? record.document as {title?: unknown; scenes?: unknown; revision?: unknown} : null;
  if (!document || typeof document.title !== 'string' || !Array.isArray(document.scenes)) return `${said} → the Expression could not be read${typeof record.message === 'string' ? `: ${record.message}` : '.'}`;
  const scenes = `${document.scenes.length} scene${document.scenes.length === 1 ? '' : 's'}`;
  return operation === 'export' ? `${said} → ${document.title} exported for reading here: ${scenes}.` : `${said} → ${document.title}: ${scenes}, revision ${document.revision}.`;
}

/** An Action a trigger did not run, as the shell offers it for one press: the id of the offer the owner recorded when it withheld it (kernel
 * expression.rs TriggerOffer; O-I #747 round 895, DLW build ruling 2026-11-09, 0b.1). The shell reads the record from the owner and says it
 * in its own words; nothing else the frame says of it is read, and the press runs what the record holds. */
export interface TriggerOffer {offer_ref: string; expression_ref?: string}
const said = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
/** Why the owner withheld it, from its answer: it asks an authority, or it may write (the kernel's older answer says only the second). */
function withheldWhy(record: Record<string, unknown>): string {
  const asked = Array.isArray(record.authority_requirement) ? record.authority_requirement.filter(said) : [];
  return record.reads_only === true && asked.length ? `it asks for an authority (${asked.join('; ')}), and a trigger runs only what asks none`
    : 'it may write, and a trigger runs only a reading';
}
/** What a native Action trigger's answer says, in one line, and the offer a withheld one carries (DLW build ruling 2026-11-07: a trigger runs
 * only a reading; an Action that may write is named and offered, and one press by the person runs it). Presented on the devices, the Info
 * line holds the offer's Run; in the frame's own presentation there is no Info line, so the words say where it runs (DLW build ruling
 * 2026-11-08). Pure. */
export function actionSaid(act: Extract<TriggerAct, {kind: 'action'}>, reply: unknown, presentation: FramePresentation = 'devices'): {text: string; offer: TriggerOffer | null} {
  const record = reply && typeof reply === 'object' ? reply as Record<string, unknown> : null;
  if (!record) return {text: `${act.said} did not act: the owner gave no answer.`, offer: null};
  if (record.state === 'withheld' && said(record.scene_ref)) {
    const where = presentation === 'devices' ? 'Run runs it once, as your own press.'
      : 'To run it once, as your own press, present this field on O:I\'s devices: the status bar\'s Info line offers its Run.';
    const recorded = record.offer && typeof record.offer === 'object' ? (record.offer as {offer_ref?: unknown}).offer_ref : undefined;
    const offer = said(recorded) ? {offer_ref: recorded} : null;
    return {text: `${act.said} was not run: ${withheldWhy(record)}. ${where}`, offer};
  }
  const dispatch = record.dispatch && typeof record.dispatch === 'object' ? record.dispatch as Record<string, unknown> : null;
  if (record.state !== 'action_result' || !dispatch) return {text: `${act.said} did not act${typeof record.detail === 'string' ? `: ${record.detail}` : '.'}`, offer: null};
  if (dispatch.state === 'invoked') return {text: `${act.said} ran.`, offer: null};
  const why = [dispatch.message, dispatch.detail, dispatch.action].find(value => typeof value === 'string');
  return {text: dispatch.state === 'owner_refused' ? `${act.said} was refused: ${why}` : `${act.said} did not run${why ? `: ${why}` : '.'}`, offer: null};
}
