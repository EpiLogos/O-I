/**
 * The kernel Technē adapter (parent integration, 2026-09-19) — the Journey
 * save lane. The ported instruments route mutation proposals and stop at
 * the receipt (m0m5/adapter.ts's routing law); the route names the native
 * authority seam. In the cradle that seam IS the kernel's expression op —
 * the same `oi.expression/v1` edit channel the M0′ projection's focus edits
 * travel (WikiExpressionBody.focus). This module crosses it:
 *
 *   routed `oi.expression.edit` + `scene_create`
 *     → kernelOp {op:"expression", operation:"edit", changes:[scene_create]}
 *     → the edited document written back to the ONE projection store
 *     → a receipt naming what the kernel applied, verbatim.
 *
 * Laws kept:
 *   - resolveActionRoute (the ported law) gates everything: an undisclosed
 *     action or a foreign subject comes back unrouted, unchanged;
 *   - the kernel's refusals travel verbatim; a revision conflict refreshes
 *     the shared mirror but NEVER retries a constructive edit;
 *   - the reading served to the instruments is the wiki-grounded payload
 *     (wikiReadingProvider), contract-checked at the seam;
 *   - nothing here owns domain state: the document belongs to the kernel,
 *     the projection mirror to the store.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and node --test.
 */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import type {ExpressionDocument, ExpressionResult} from "../expression/types";
import {
  getWikiProjectionState,
  wikiRegisterOwning,
  wikiProjectionDocumentFocused,
} from "./wikiProjectionStore";
import {wikiReadingPayload, wikiExpressionDocumentFor, wikiRegisterForSubject} from "./wikiReadingProvider";
import {readWikiRegister} from "./wikiExpression";
import {
  validateReading,
  type TechneActionReceipt,
  type TechneActionRoute,
  type TechneReading,
} from "./contract";
import {resolveActionRoute, createTechneSource, type TechneAdapter, type TechneSource} from "./m0m5/adapter";
import {composeRegions, type PalaceDocumentSnapshot, type PalaceRegionSpec} from "./m0m5/palace/composition";

/** The actor name the journey edits carry (the projection's focus edits use
 * the same grammar; the kernel records it on the document). */
export const JOURNEY_ACTOR = "oi-cradle.techne-journey";

/** The route input a scene composition carries (journey/compose.ts). */
interface SceneCompositionInput {
  expression_ref: string;
  revision: string | null;
  change: {change: "scene_create"; scene_ref: string; title: string};
}

/** The route input the Palace's durable composition carries
 * (`m0m5/palace/return.ts` `palaceReturnInput`): the INTENT (which regions,
 * which Expressions in each) — never a diffed change list and never a
 * `composition_set`/`shared.values` payload. The diff against the live
 * document happens here, in `submitPalaceComposition`, against the ONE
 * standing document this window actually holds. */
interface PalaceCompositionInput {
  expression_ref: string;
  regions: PalaceRegionSpec[];
}

/** The receipt a Palace composition earns: routed, with the applied kernel
 * Changes named verbatim (never a generic "composition_set applied" — the
 * Change list is exactly what the substrate recorded). */
function appliedPalaceReceipt(route: TechneActionRoute, applied: {expression_ref: string; revision: number; changes: string[]}): TechneActionReceipt {
  return {
    action_ref: route.action_ref,
    native_owner: "oi.cradle.kernel",
    routed: true,
    authority: "oi.kernel/expression-edit",
    expected_effects: [
      ...applied.changes,
      `document ${applied.expression_ref} now at revision ${applied.revision}`,
    ],
  };
}

/** Build the pure diffing snapshot from the ONE live standing document —
 * exactly the facts `composition.ts`'s `planRegions` needs, nothing more.
 * No Entity facts: a region's contained Expression is read only from its
 * Scene's own body, never from an Entity. */
function paletteSnapshot(document: ExpressionDocument): PalaceDocumentSnapshot {
  return {
    expression_ref: document.expression_ref,
    revision: document.revision,
    scenes: document.scenes.map(scene => ({
      scene_ref: scene.scene_ref,
      title: scene.title,
      body: scene.body ? {carrier: scene.body.carrier, subject_ref: scene.body.subject_ref} : null,
      triggers: (scene.triggers ?? []).map(trigger => ({
        trigger_ref: trigger.trigger_ref,
        target: trigger.target && "kind" in trigger.target
          ? {kind: (trigger.target as {kind?: string}).kind, subject_ref: (trigger.target as {subject_ref?: string}).subject_ref}
          : undefined,
      })),
    })),
  };
}

/** Where the fresh expected revision comes from: the register's standing
 * document in the ONE projection state. Overridable for the unit seam. */
function standingDocument(expressionRef: string): ExpressionDocument | undefined {
  const state = getWikiProjectionState();
  for (const standing of Object.values(state.standings)) {
    const document = standing && (standing.phase === "ready" || standing.phase === "drift")
      ? standing.document
      : standing && "projection" in standing && standing.projection
        ? standing.projection.document
        : undefined;
    if (document?.expression_ref === expressionRef) return document;
  }
  return undefined;
}

/** Write the kernel's edited document back into the ONE projection state —
 * the same write-back the M0 focus edit performs, so every aperture (the
 * left map, the graph navigator, the M0′ lens) sees the saved scene at
 * once. Overridable for the unit seam. */
function adoptEditedDocument(expressionRef: string, document: ExpressionDocument): void {
  const key = wikiRegisterOwning(expressionRef) ?? getWikiProjectionState().registerKey;
  if (key) wikiProjectionDocumentFocused(key, document);
}

/** Execute one scene_create through the kernel's expression edit op.
 * Returns the applied outcome or the kernel's refusal verbatim. `runner`
 * and the document hooks are injectable for the unit seam. */
export async function submitSceneComposition(
  transport: KernelTransportStatus,
  input: SceneCompositionInput,
  seams?: {
    runner?: typeof kernelOp;
    readStanding?: typeof standingDocument;
    adopt?: typeof adoptEditedDocument;
  },
): Promise<{ok: true; scene_ref: string; expression_ref: string; revision: number} | {ok: false; reason: string}> {
  const run = seams?.runner ?? kernelOp;
  const readStanding = seams?.readStanding ?? standingDocument;
  const adopt = seams?.adopt ?? adoptEditedDocument;
  const standing = readStanding(input.expression_ref);
  if (!standing) {
    return {ok: false, reason: `the Expression ${input.expression_ref} is not open in this window — enter its Web (M0′) first so the kernel holds the generation, then compose`};
  }
  // An Agent/human proposal is based on what it actually inspected. A late
  // result must not silently acquire the latest revision as fresh authority.
  const basis = Number(input.revision);
  if (!input.revision || !Number.isSafeInteger(basis) || basis < 1 || basis !== standing.revision) {
    return {ok:false,reason:`construction basis is stale or absent (proposed ${input.revision ?? "none"}, current ${standing.revision}); inspect and explicitly reconcile before editing`};
  }
  const reply = await run(transport, {op:"expression",request:{operation:"edit",
    expression_ref:input.expression_ref, expected_revision:basis,actor:JOURNEY_ACTOR,changes:[input.change]}});
  const data=reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
  if (!reply.error && data?.document && data.document.expression_ref === input.expression_ref &&
      data.document.scenes.some(scene=>scene.scene_ref===input.change.scene_ref) && data.document.revision>basis) {
    adopt(input.expression_ref,data.document);
    return {ok:true,scene_ref:input.change.scene_ref,expression_ref:input.expression_ref,revision:data.document.revision};
  }
  if(data?.state === "revision_conflict") {
    // Refresh the shared mirror, but NEVER retry the mutating operation. The
    // caller retains its proposal and can reconcile it with the new inquiry.
    const fresh=await run(transport,{op:"expression",request:{operation:"inspect",expression_ref:input.expression_ref}});
    const document=fresh.outcome?.result === "expression" ? (fresh.outcome.data as ExpressionResult).document : undefined;
    if(document?.expression_ref===input.expression_ref)adopt(input.expression_ref,document);
    return {ok:false,reason:"revision_conflict: the construction changed during composition; inspect and explicitly reconcile the proposal"};
  }
  return {ok:false,reason:reply.error ?? data?.state ?? "the kernel did not confirm the composed scene"};
}

/** Execute the Palace's durable composition through the kernel's expression
 * edit op — diffed FIRST against the ONE live standing document
 * (`composition.ts` `composeRegions`/`planRegions`), so a region that
 * already matches emits nothing (replay-idempotent), and the CAS basis is
 * always the document's OWN current revision, never a stale one the caller
 * carried in. A revision_conflict refreshes the mirror without retrying;
 * "nothing to compose" (every region already matches) is an honest
 * no-op receipt, never a fabricated failure. */
export async function submitPalaceComposition(
  transport: KernelTransportStatus,
  input: PalaceCompositionInput,
  actions: TechneReading["actions"],
  seams?: {
    runner?: typeof kernelOp;
    readStanding?: typeof standingDocument;
    adopt?: typeof adoptEditedDocument;
  },
): Promise<{ok: true; expression_ref: string; revision: number; changes: string[]} | {ok: false; reason: string}> {
  const run = seams?.runner ?? kernelOp;
  const readStanding = seams?.readStanding ?? standingDocument;
  const adopt = seams?.adopt ?? adoptEditedDocument;
  const standing = readStanding(input.expression_ref);
  if (!standing) {
    return {ok: false, reason: `the Expression ${input.expression_ref} is not open in this window — enter its Web (M0′) first so the kernel holds the generation, then compose`};
  }
  const proposal = composeRegions(paletteSnapshot(standing), input.regions, actions);
  if (!proposal) {
    return {ok: true, expression_ref: input.expression_ref, revision: standing.revision, changes: []};
  }
  const basis = standing.revision;
  const reply = await run(transport, {op:"expression",request:{operation:"edit",
    expression_ref:input.expression_ref, expected_revision:basis,actor:JOURNEY_ACTOR,changes:proposal.input.changes}});
  const data=reply.outcome?.result === "expression" ? reply.outcome.data as ExpressionResult : undefined;
  if (!reply.error && data?.document && data.document.expression_ref === input.expression_ref && data.document.revision>basis) {
    adopt(input.expression_ref,data.document);
    return {ok:true,expression_ref:input.expression_ref,revision:data.document.revision,changes:proposal.input.changes.map(change=>change.change)};
  }
  if(data?.state === "revision_conflict") {
    const fresh=await run(transport,{op:"expression",request:{operation:"inspect",expression_ref:input.expression_ref}});
    const document=fresh.outcome?.result === "expression" ? (fresh.outcome.data as ExpressionResult).document : undefined;
    if(document?.expression_ref===input.expression_ref)adopt(input.expression_ref,document);
    return {ok:false,reason:"revision_conflict: the construction changed during composition; inspect and explicitly reconcile the proposal"};
  }
  return {ok:false,reason:reply.error ?? data?.state ?? "the kernel did not confirm the composition"};
}

/** The receipt the kernel's applied edit earns: routed, with the applied
 * effect named in the kernel's own terms. */
function appliedReceipt(route: TechneActionRoute, applied: {scene_ref: string; expression_ref: string; revision: number}): TechneActionReceipt {
  return {
    action_ref: route.action_ref,
    native_owner: "oi.cradle.kernel",
    routed: true,
    authority: "oi.kernel/expression-edit",
    expected_effects: [
      `scene_create applied: ${applied.scene_ref}`,
      `document ${applied.expression_ref} now at revision ${applied.revision}`,
    ],
  };
}

/** The kernel Technē source: the wiki-grounded reading served to the
 * instruments (the same contract-checked payload the reading provider
 * composes), so the instruments' `techneSource()` resolves in this window
 * and their routed proposals reach this adapter. */
export function kernelTechneSource(transport: KernelTransportStatus): TechneSource {
  return createTechneSource({
    ref: "oi-cradle.wiki-reading/v1",
    title: "The register's wiki ground — kernel-held",
    read: subjectRef => kernelTechneAdapter(transport).reading(subjectRef),
  });
}

/** The cradle's kernel adapter: the ported routing law, then — and only
 * then — the native authority seam crossing for the one action this window
 * owns the executor for. */
export function kernelTechneAdapter(transport: KernelTransportStatus): TechneAdapter {
  return {
    async reading(subjectRef: string) {
      const register = wikiRegisterForSubject({ref: subjectRef, title: subjectRef});
      if (!register) throw new Error("no wiki register is disclosed in this window");
      if (transport.kind === "unavailable") throw new Error(transport.reason);
      const reading = await readWikiRegister(transport, register);
      if (reading.state === "unavailable") throw new Error(reading.reason);
      const payload = wikiReadingPayload({register, subject: {ref: subjectRef, title: subjectRef}, reading, document: wikiExpressionDocumentFor(register.key)});
      const checked = validateReading(payload);
      if (!checked.valid) throw new Error(`the wiki reading drifted from the contract: ${checked.errors.join("; ")}`);
      return payload as TechneReading;
    },
    async capabilities(subjectRef: string) {
      return (await this.reading(subjectRef)).disclosure;
    },
    async routeAction(route: TechneActionRoute, reading: TechneReading): Promise<TechneActionReceipt> {
      const resolution = resolveActionRoute(reading, route);
      if (resolution.routed !== true) return resolution;
      if (route.action_ref !== "oi.expression.edit") return resolution;
      const input = route.input as (SceneCompositionInput & {regions?: undefined}) | (PalaceCompositionInput & {expression_ref: string | null}) | undefined;
      if (input && Array.isArray((input as {regions?: unknown}).regions) && typeof input.expression_ref === "string" && input.expression_ref) {
        const palaceInput = {expression_ref: input.expression_ref, regions: (input as {regions: PalaceRegionSpec[]}).regions};
        const applied = await submitPalaceComposition(transport, palaceInput, reading.actions);
        return applied.ok ? appliedPalaceReceipt(route, applied) : {...resolution, routed: false, reason: applied.reason};
      }
      const sceneInput = input as SceneCompositionInput | undefined;
      if (sceneInput?.change?.change === "scene_create") {
        const applied = await submitSceneComposition(transport, sceneInput);
        return applied.ok ? appliedReceipt(route, applied) : {...resolution, routed: false, reason: applied.reason};
      }
      return resolution;
    },
  };
}
