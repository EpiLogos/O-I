/**
 * Object detail for the Factory Live scene (FX-C3): what a selected object
 * in the hosted Expression IS, resolved from the kernel's own document and
 * the act — never from the frame's untrusted words. Pure except for the two
 * kernel calls at the bottom (the existing encounter send path and the
 * Expression document read).
 *
 * The hosted frame announces its selection as engine entity ids
 * (`oi-app-state` → HostedAppState.selection). Those ids are the native
 * occurrence refs of the performing Scene; the Scene material carries the
 * role slot (`role`), the document's entity carries the native subject, and
 * the act's bindings (and the passage that last bound the role) say who or
 * what fills it.
 */
import {kernelOp} from "../../../kernel/bridge";
import type {KernelTransportStatus} from "../../../kernel/types";
import {composeAddressed} from "../../../encounter/AddressedComposer";
import type {Change, ExpressionDocument} from "../../../expression/types";
import {decodeBasis, type Binding, type OpBasis} from "./eventMap";
import type {ActBinding, WorldAct} from "../../../expression/world";
import type {LiveCastMember, PerformedPassage} from "./producer";

export type LiveObjectKind = "agent" | "goal" | "artifact" | "exchange" | "other";
export interface LiveObject {
  kind: LiveObjectKind;
  entityRef: string;
  label: string;
  role?: string;
  binding?: Binding | ActBinding;
  subjectRef?: string;
  /** The cast member, for an agent. */
  member?: LiveCastMember;
  /** The event that last bound or performed this object (detail source). */
  basis?: OpBasis;
  /** The bindings of the passage on stage (when the object comes from it). */
  stageBindings?: Record<string, Binding | ActBinding>;
}

type SceneMaterial = {entities?: {id: string; name?: string; role?: string}[]};

/** The performing Scene's material entity for an id, across the document's
 * Scenes (the current Scene first). */
function materialEntity(document: ExpressionDocument | undefined, entityRef: string, sceneRef?: string): {role?: string; name?: string} | undefined {
  if (!document) return undefined;
  const scenes = [...document.scenes].sort((a, b) => (a.scene_ref === sceneRef ? -1 : b.scene_ref === sceneRef ? 1 : 0));
  for (const scene of scenes) {
    const material = scene.presentation?.scene as SceneMaterial | undefined;
    const entity = material?.entities?.find(candidate => candidate.id === entityRef);
    if (entity) return entity;
  }
  return undefined;
}

/** The newest performed passage whose bindings fill `role` (or name the subject). */
function lastBinding(performed: PerformedPassage[], role: string | undefined, subjectRef: string | undefined): {binding?: Binding; basis?: OpBasis} {
  for (let i = performed.length - 1; i >= 0; i--) {
    const op = performed[i].op;
    if (role && op.bindings[role]) return {binding: op.bindings[role], basis: op.basis};
    if (subjectRef) {
      for (const binding of Object.values(op.bindings)) {
        if ((binding.kind === "agent" && binding.agent_ref === subjectRef) || (binding.kind === "object" && binding.subject_ref === subjectRef)) return {binding, basis: op.basis};
      }
    }
  }
  return {};
}

const AGENT_ROLES = /^(self|lead|sender|recipient|participants\.\d+)$/;

export function resolveLiveObject(input: {entityRef: string; name?: string; document?: ExpressionDocument; act?: WorldAct; performed: PerformedPassage[]; cast: LiveCastMember[]; sceneRef?: string}): LiveObject {
  const {entityRef, document, act, performed, cast} = input;
  const material = materialEntity(document, entityRef, input.sceneRef);
  // The role a live entity presents: its material slot, else the act's own
  // role → entity map (kernel `role_entities`).
  const role = material?.role ?? Object.entries(act?.role_entities ?? {}).find(([, ref]) => ref === entityRef)?.[0];
  const subject = document?.entities[entityRef]?.subject ?? undefined;
  // What the role presents on stage now: the binding of the passage the act
  // stands on (a timeline seek), else the act's latest binding.
  const onStage = act?.position !== undefined ? act.sequence?.[act.position] : undefined;
  const fromAct = role ? (onStage?.bindings?.[role] ?? act?.bindings?.[role]) : undefined;
  // The passage that bound what the role presents NOW (a timeline seek puts
  // an earlier binding back on stage), else the newest binding of the role.
  const boundNow = fromAct?.subject_ref ?? fromAct?.agent_ref;
  const matching = boundNow ? [...performed].reverse().find(passage => { const b = role ? passage.op.bindings[role] : undefined; return !!b && ((b.kind === "object" && b.subject_ref === boundNow) || (b.kind === "agent" && b.agent_ref === boundNow)); }) : undefined;
  const last = matching ? {binding: role ? matching.op.bindings[role] : undefined, basis: matching.op.basis} : lastBinding(performed, role, subject?.subject_ref);
  const binding = fromAct ?? last.binding;
  const agentRef = binding?.kind === "agent" ? binding.agent_ref : subject?.presentation_role === "being" && subject.native_owner === "central" ? subject.subject_ref : undefined;
  const member = agentRef ? cast.find(candidate => candidate.agent_ref === agentRef) : undefined;
  const label = (binding && "label" in binding && binding.label) || member?.label || material?.name || document?.entities[entityRef]?.title || input.name || entityRef.replace(/^.*:entity:/, "");
  const stageMessage = onStage?.event_basis?.family === "message" && (role === "artifact" || role === "caption");
  const inExchange = (last.basis?.family === "message" || stageMessage) && (role === "artifact" || role === "caption");
  if (stageMessage && last.basis?.family !== "message") {
    const decoded = decodeBasis(onStage!.event_basis);
    if (decoded) last.basis = {family: "message", source: (decoded.source ?? "aikit-encounter") as OpBasis["source"], entry: decoded.entry ?? "encounter.agent-message", event_ref: decoded.event_ref, occurrence: decoded.occurrence, ...(decoded.journal ? {journal: decoded.journal} : {})};
  }
  let kind: LiveObjectKind = "other";
  if (agentRef || (role && AGENT_ROLES.test(role))) kind = "agent";
  else if (role === "goal" || subject?.readings.some(reading => reading.ref === "factory.run-node/destination")) kind = "goal";
  else if (inExchange) kind = "exchange";
  else if (role === "artifact" || binding?.kind === "object" || subject?.presentation_role === "thing") kind = "artifact";
  return {kind, entityRef, label, ...(onStage?.bindings ? {stageBindings: onStage.bindings} : {}), ...(role ? {role} : {}), ...(binding ? {binding} : {}), ...(subject?.subject_ref ?? (binding?.kind === "object" ? binding.subject_ref : agentRef) ? {subjectRef: subject?.subject_ref ?? (binding?.kind === "object" ? binding.subject_ref : agentRef)} : {}),
    ...(member ? {member} : {}), ...(last.basis ? {basis: last.basis} : {})};
}

/** An exchange's message as the panel shows it: sender, recipient, body and
 * its native ref (Communique ref, delivery ref, or journal session#cursor). */
export function exchangeOf(object: LiveObject, performed: PerformedPassage[]): {sender?: string; recipient?: string; body: string; ref: string; state?: string} | undefined {
  if (object.kind !== "exchange" || !object.basis) return undefined;
  const passage = [...performed].reverse().find(candidate => candidate.op.basis.event_ref === object.basis!.event_ref && candidate.op.basis.occurrence === object.basis!.occurrence);
  const bindings: Record<string, Binding | ActBinding> = passage?.op.bindings ?? object.stageBindings ?? {};
  const name = (binding: Binding | ActBinding | undefined) => binding ? (("label" in binding ? binding.label : undefined) || (binding.kind === "agent" ? binding.agent_ref : binding.kind === "object" ? binding.subject_ref : undefined)) : undefined;
  const detail = object.basis.detail ?? {};
  const journal = object.basis.journal ? `${object.basis.journal.session}#${object.basis.journal.cursor}` : undefined;
  const ref = String(detail.communique_ref ?? detail.delivery_ref ?? journal ?? object.basis.event_ref);
  const caption = bindings.caption?.kind === "text" ? bindings.caption.text ?? "" : "";
  return {sender: name(bindings.sender) ?? (detail.from as string | undefined) ?? (detail.sender as string | undefined), recipient: name(bindings.recipient) ?? (detail.to as string | undefined),
    body: String(detail.body ?? detail.text ?? caption), ref, ...(detail.state ? {state: String(detail.state)} : {})};
}

/** Open a conversation's own encounter surface (where the addressed
 * composer lives). CradleFrame opens it through `openEncounter`. */
export const OPEN_ENCOUNTER_EVENT = "oi:open-encounter";
export interface OpenEncounterDetail {ref: string; project: string; space: string; title?: string}
export function openEncounterSurface(detail: OpenEncounterDetail): void {
  // The encounter surface is a workbench tab: stand in the base working mode
  // first, or it opens behind the full-page Factory centre.
  window.dispatchEvent(new CustomEvent("oi:enter-mode", {detail: {mode: "base"}}));
  window.dispatchEvent(new CustomEvent<OpenEncounterDetail>(OPEN_ENCOUNTER_EVENT, {detail}));
}

/** The passages that concern an agent (messages to or from it, its skill
 * and tool gestures), newest first. */
export function communicationOf(performed: PerformedPassage[], agentRef: string, limit = 5): PerformedPassage[] {
  return performed.filter(passage => passage.op.basis.family === "message"
    && Object.values(passage.op.bindings).some(binding => binding.kind === "agent" && binding.agent_ref === agentRef)).slice(-limit).reverse();
}

// ---------------------------------------------------------------------------
// Kernel paths the panel uses (existing owners only)
// ---------------------------------------------------------------------------

/** Address an agent (a message, or a request to invoke one of its selected
 * capabilities) through the conversation's addressed-request composer — the
 * owner's AddressedTurn `send` path, where sender, audience and the
 * participation basis stay explicit, owner-validated inputs. The session's
 * shared draft is never touched. The caller then opens the conversation. */
export function addressAgent(session: string, sourceRef: string, text: string): void {
  composeAddressed({agentSession: session, sourceRef, text});
}

/** The owner's action request as the Run page states it (RunPage `invoke`):
 * the desktop holds no grant, so it names the action, its subject and the
 * authority the owner requires — never self-granting the capability. */
export function ownerActionWords(action: {label: string; requiredCapabilityRef?: string; authorityOwner?: string}, subjectRef: string | undefined): string {
  return `${action.label}${subjectRef ? ` on ${subjectRef}` : ""}: the owner's action request needs ${action.requiredCapabilityRef ?? "a capability"} granted by ${action.authorityOwner ?? "its native owner"}; the desktop carries requests only and holds no grant.`;
}

/** The kernel's copy of an Expression document. */
export async function inspectExpression(transport: KernelTransportStatus, expressionRef: string): Promise<ExpressionDocument | undefined> {
  const reply = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: expressionRef}});
  if (reply.error || !reply.outcome || reply.outcome.result !== "expression") return undefined;
  return reply.outcome.data.document;
}

/** Add what the Run gained since its Expression was opened — late cast
 * members, returned artifacts, new objects — to the held document's Live
 * Scene, through the ordinary native `edit` (entity_add + subject_bind). */
export async function syncRunExpression(transport: KernelTransportStatus, compose: () => Promise<ExpressionDocument>, actor: string): Promise<number> {
  const composed = await compose();
  const held = await inspectExpression(transport, composed.expression_ref);
  if (!held) { await ensureExpression(transport, async () => composed, actor); return 0; }
  const liveRef = `${composed.expression_ref}:scene:live`;
  const composedLive = composed.scenes.find(scene => scene.scene_ref === liveRef);
  if (!composedLive) return 0;
  const changes: Change[] = [];
  if (!held.scenes.some(scene => scene.scene_ref === liveRef)) changes.push({change: "scene_create", scene_ref: liveRef, title: composedLive.title});
  for (const ref of composedLive.entity_refs) {
    if (held.entities[ref]) continue;
    const entity = composed.entities[ref];
    changes.push({change: "entity_add", scene_ref: liveRef, entity_ref: ref, title: entity.title});
    if (entity.subject) changes.push({change: "subject_bind", entity_ref: ref, binding: entity.subject});
  }
  if (!changes.length) return 0;
  const reply = await kernelOp(transport, {op: "expression", request: {operation: "edit", expression_ref: held.expression_ref, expected_revision: held.revision, actor, changes}});
  if (reply.error || !reply.outcome || reply.outcome.result !== "expression") throw new Error(reply.error ?? "The Run's Expression could not take its new members");
  return changes.length;
}

/** Open the Run's composed Expression in the kernel when it is not held
 * there yet (a held one keeps what the act has performed into it). */
export async function ensureExpression(transport: KernelTransportStatus, compose: () => Promise<ExpressionDocument>, actor: string): Promise<{expressionRef: string; opened: boolean}> {
  const document = await compose();
  if (await inspectExpression(transport, document.expression_ref)) return {expressionRef: document.expression_ref, opened: false};
  const reply = await kernelOp(transport, {op: "expression", request: {operation: "open", document, actor}});
  if (reply.error || !reply.outcome || reply.outcome.result !== "expression") throw new Error(reply.error ?? "The Run's Expression could not be opened");
  return {expressionRef: document.expression_ref, opened: true};
}
