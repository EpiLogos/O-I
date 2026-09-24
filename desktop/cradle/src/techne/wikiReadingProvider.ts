import {sceneSpatialFacets,type SceneSpatialReading} from "./spatialFacets";
/**
 * The wiki-grounded ql.techne/v1 reading provider (parent integration,
 * 2026-09-19) — the resolve-once path the owner Wayfinder (PR #387 §20)
 * names: current World/Project/subject → the register's REAL wiki reading
 * (wikiExpression.readWikiRegister — the owner's files seam plus the AIKit
 * knowledge relations op, one reading implementation shared with the M0
 * projection) → bounded local whole → ql.techne/v1 wire payload →
 * TechneDisclosureState (techneReading.ts) → DisclosureSession
 * (m0m5/reading.ts) → the active lens.
 *
 * Honest scope: this composes the disclosure from what the register's wiki
 * ground actually discloses. It is NOT the QL TechneAdapter — the QL-side
 * warrant/agency facets are absent because their owner has not supplied
 * them in this window (absent facets are data, not errors — the contract's
 * own law). The instruments' capability follows the reading: place is
 * disclosed unavailable with the real reason (the wiki reading carries no
 * spatial facets), never faked. When the QL adapter side registers its own
 * provider it is already registered first, and techneReadingProvider()
 * serves the first registration — this one stands as the cradle's ground
 * source.
 *
 * The Expression and Actions facets (added 2026-09-19 for the Journey save
 * lane): when the register's standing kernel document exists (the M0′
 * projection opened it), the reading binds that Expression —
 * `expressions[0]` with its ref and revision — and discloses the kernel's
 * own edit action `oi.expression.edit`, so Journey composes real scenes
 * INTO the register's Expression and the routed proposal reaches the
 * kernel's edit op. No document standing → both facets absent → the
 * Journey honestly refuses until the Web is entered.
 *
 * Hosted instruments use readWikiSceneTechne: the exact native Scene resolves
 * its existing projection and retained source reading. The legacy subject
 * provider remains for callers explicitly requesting a register reading.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and node --test.
 */
import {kernelOp} from "../kernel/bridge";
import {readFile} from "../files/client";
import {decodeRegister, readRegister, CONSTRUCTION} from "../knowledge/construction";
import type {KernelTransportStatus} from "../kernel/types";
import type {ExpressionDocument} from "../expression/types";
import {readWikiRegister, type WikiRegister, type WikiRegisterReading, type WikiRelationEdge, wikiPathOf} from "./wikiExpression";
import {getWikiProjectionState, subscribeWikiProjection, wikiDocumentOf, wikiReadingOf, ensureWikiProjectionReading} from "./wikiProjectionStore";
import {TECHNE_CONTRACT, type TechneReadingProvider, type TechneSubject} from "./techneReading";
import {wikiSceneRelationReadings,wikiSceneSourceRelations} from "./wikiSceneRelationReadings";
import {wikiSceneNodeReadings} from "./wikiSceneNodeReadings";
import {sceneTemporalFacets,resolveSceneTemporalFacets,type SceneTemporalReading} from "./temporalFacets";
import {placeFacetsFromReading} from "./placeFacets";
import {useSyncExternalStore} from "react";

/** The reading's Expression facet source: the register's standing kernel
 * document (ready/drift phases) or the projection's own document
 * (projected/opening) — the SAME document the M0′ centre presents, never a
 * second read. */
export function wikiExpressionDocumentFor(registerKey: string): ExpressionDocument | undefined {
  const standing = getWikiProjectionState().standings[registerKey];
  return wikiDocumentOf(standing);
}

/** The Technē field's EFFECTIVE subject (parent integration, 2026-09-19):
 * the workspace's selected subject when one is selected, else the mode's own
 * ground — the current register's wiki local whole. This is the M0′ law the
 * owner wayfinder §14 names (the web IS the opening; no material is
 * required): the disclosure, the session and the HUD stand on the register's
 * whole even before the person selects anything. The subject is stable per
 * register, so standing on one register never re-reads; switching register
 * re-grounds (a new reading basis, lawfully). */
export function techneGroundSubject(selected: TechneSubject | undefined): TechneSubject {
  if (selected) return selected;
  const {registers, registerKey} = getWikiProjectionState();
  const register = registers.find(entry => entry.key === registerKey)
    ?? registers.find(entry => entry.key === "central")
    ?? registers[0];
  if (!register) return {ref: "wiki:central", kind: "wiki-register", title: "Central"};
  return {ref: `wiki:${register.key}`, kind: "wiki-register", title: register.title, project: register.project};
}

export function useTechneGroundSubject(selected: TechneSubject | undefined): TechneSubject {
  useSyncExternalStore(subscribeWikiProjection, getWikiProjectionState, getWikiProjectionState);
  return techneGroundSubject(selected);
}

/** Pick the register the subject's disclosure reads from: the subject's own
 * project when the register list knows it, else the projection's current
 * register, else Central, else the first register. */
export function wikiRegisterForSubject(subject: TechneSubject | undefined): WikiRegister | undefined {
  const {registers, registerKey} = getWikiProjectionState();
  const list = registers.length > 0 ? registers : [{key: "central", title: "Central"}];
  if (subject?.project) {
    const named = list.find(register => register.project === subject.project || register.key === subject.project || register.title === subject.title);
    if (named) return named;
  }
  return list.find(register => register.key === registerKey) ?? list.find(register => register.key === "central") ?? list[0];
}

/** One typed wiki edge as a contract relation: the source-owned semantic
 * relation stays the edge's own; the wiki document that disclosed it is the
 * source ref. Never a QL warrant, never an invented standing. */
function relationOf(edge: WikiRelationEdge, sourceRef: string) {
  return {
    relation: edge.relation,
    from_ref: edge.from,
    to_ref: edge.to,
    origin: edge.provider ?? "wiki",
    standing: edge.standing ?? null,
    relation_ref: edge.ref ?? null,
    ...(edge.evidence_refs ? {evidence_refs:edge.evidence_refs} : {}),
    source_ref: sourceRef,
  };
}

/** The disclosure for one register's wiki reading: every mounted lens is
 * available on the real whole except the ones whose facets the wiki reading
 * genuinely does not carry — those name the real reason. Timeline is
 * available exactly when the source declares dated temporal facets; place is available exactly when the reading discloses a real
 * spatial facet (a declared place or a hard geography relation) — a truly
 * absent spatial facet stays absent, with the real reason. */
function disclosureFor(hasTemporalBasis: boolean, hasExpression: boolean, hasSpatial: boolean) {
  return {
    instruments: [
      {instrument: "project", available: true, m_prime: 0, reading: "4:2-deep"},
      {instrument: "canvas", available: true, m_prime: 1, reading: "4:2-deep"},
      {instrument: "timeline", available: hasTemporalBasis, m_prime: 2, reading: "4:2-deep",
        ...(hasTemporalBasis ? {} : {reason: "the register's wiki reading carries no temporal facets"})},
      {instrument: "journey", available: hasExpression, m_prime: 3, reading: "4:2-deep",
        ...(hasExpression ? {} : {reason: "the register's Expression generation is not open in this window — enter its Web (M0′) first, and Journey composes into it"})},
      {instrument: "place", available: hasSpatial, m_prime: 4, reading: "4:2-deep",
        ...(hasSpatial ? {} : {reason: "the register's wiki reading carries no spatial facets"})},
      {instrument: "palace", available: true, m_prime: 5, reading: "4:2-deep"},
    ],
    degraded: [],
    suggestions: [],
  };
}

/** The pure wire-payload builder: one register's real wiki reading + the
 * register's standing Expression document (when one stands) → one
 * ql.techne/v1 payload. Exported for the unit seam — the provider and the
 * TechneSource serve this exact payload. */
export function wikiReadingPayload(input: {
  register: WikiRegister;
  subject: TechneSubject;
  reading: WikiRegisterReading;
  document?: ExpressionDocument;
}): unknown {
  const {register, subject, reading, document} = input;
  const subjectRef = subject.ref?.trim() || `wiki:${register.key}`;
  const basis = reading.state === "ready" ? reading.wikiBasis : undefined;
  const wiki = reading.state === "ready" ? reading.wiki : undefined;
  const relations = reading.state === "ready" ? reading.relations : undefined;
  const sourceRef = basis ? `central:source:${basis.path}` : undefined;
  const wholeRef = relations?.state === "available" && relations.focusRef
    ? relations.focusRef
    : wiki?.spaces[0]?.ref ?? `wiki:${register.key}`;
  const memberRefs = (wiki?.nodes ?? []).map(node => node.ref).filter(value => typeof value === "string" && value.trim().length > 0);
  const edges = relations?.state === "available" ? relations.edges : [];
  const hasTemporalBasis = edges.some(edge => typeof edge.revision === "string" && edge.revision.length > 0);
  const hasExpression = !!document;
  // M4′: the register's own spatial facets (declared places + hard geography
  // relations), never an invented coordinate. Empty → place stays absent.
  const spatial = placeFacetsFromReading(reading);
  return {
    contract: TECHNE_CONTRACT,
    reading_ref: `ql.techne:reading:wiki:${register.key}${basis?.revision ? `@${basis.revision}` : ""}`,
    snapshot: {revision: basis?.revision ?? null, ...(sourceRef ? {basis_ref: sourceRef} : {})},
    subject: {
      subject_ref: subjectRef,
      native_owner: "oi-cradle.wiki-reading/v1",
      kind: "wiki-register",
      native_revision: basis?.revision ?? null,
    },
    whole: {
      whole_ref: wholeRef,
      member_refs: memberRefs,
      relations: edges.map(edge => relationOf(edge, sourceRef ?? wholeRef)),
      focus_refs: [wholeRef],
    },
    ...(document ? {
      // One binding per REAL scene: Journey's beat model reads scene refs
      // from these entries — the reading discloses the register's Expression
      // as it actually stands, scenes included.
      expressions: document.scenes
        .filter(scene => typeof scene.scene_ref === "string" && scene.scene_ref.length > 0)
        .map(scene => ({
          expression_ref: document.expression_ref,
          revision: String(document.revision),
          scene_ref: scene.scene_ref,
        })),
      actions: [{
        action_ref: "oi.expression.edit",
        native_owner: "oi.cradle.kernel",
        authority: "the owner's own grammar (oi.expression/v1 edit through the kernel expression op)",
        summary: "Edit the register's bound Expression — create and focus scenes — through the kernel's expression op",
        expected_effects: [
          "scene_create applies a new named scene to the bound Expression document",
          "the edited document returns with its revision advanced; the projection store carries it",
        ],
      }],
    } : {}),
    ...(spatial.length ? {spatial} : {}),
    disclosure: disclosureFor(hasTemporalBasis, hasExpression, spatial.length > 0),
  };
}

/** The provider itself: one subject in, one ql.techne/v1 wire payload out. */
export function wikiTechneReadingProvider(transport: KernelTransportStatus): TechneReadingProvider {
  return {
    ref: "oi-cradle.wiki-reading/v1",
    async read(subject: TechneSubject): Promise<unknown> {
      if (transport.kind === "unavailable") throw new Error(transport.reason);
      const register = wikiRegisterForSubject(subject);
      if (!register) throw new Error("no wiki register is disclosed in this window");
      const reading = await readWikiRegister(transport, register);
      if (reading.state === "unavailable") throw new Error(reading.reason);
      let document = wikiExpressionDocumentFor(register.key);
      if (document) {
        const result = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: document.expression_ref}});
        const latest = result.outcome?.result === "expression" ? (result.outcome.data as {document?: ExpressionDocument}).document : undefined;
        if (result.error || !latest || latest.expression_ref !== document.expression_ref) throw new Error(result.error ?? "The current native composition could not be read");
        document = latest;
      }
      return wikiReadingPayload({
        register,
        subject,
        reading,
        document,
      });
    },
  };
}


/** The hosted engine supplies native identity only, never a filesystem scope. */
export interface WikiSceneReadingRequest {expression_ref: string; revision: number; scene_ref: string}
function sceneRequest(value: unknown): WikiSceneReadingRequest {
  const request = value as Partial<WikiSceneReadingRequest> | null;
  if (!request || typeof request !== "object" || Array.isArray(request)
    || typeof request.expression_ref !== "string" || !request.expression_ref.trim() || request.expression_ref.length > 2048
    || typeof request.scene_ref !== "string" || !request.scene_ref.trim() || request.scene_ref.length > 2048
    || !Number.isSafeInteger(request.revision) || request.revision! < 1) {
    throw new Error("A native Expression revision and Scene are required for this reading");
  }
  return request as WikiSceneReadingRequest;
}

/** Exact native inspection shared by reading and source-editor navigation. */
export async function inspectWikiScene(transport: KernelTransportStatus, input: unknown) {
  const request = sceneRequest(input);
  if (transport.kind === "unavailable") throw new Error(transport.reason);
  const inspected = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref: request.expression_ref}});
  const document = inspected.outcome?.result === "expression" ? (inspected.outcome.data as {document?: ExpressionDocument}).document : undefined;
  if (inspected.error || !document || document.expression_ref !== request.expression_ref) throw new Error(inspected.error ?? "The native Expression could not be read");
  if (document.revision !== request.revision) throw new Error("The native Expression revision changed; reopen the current Scene before reading its facets");
  const scene = document.scenes.find(row => row.scene_ref === request.scene_ref);
  if (!scene) throw new Error("The requested Scene is absent from this native Expression");
  return {request, document, scene};
}

/** Fresh native register, selected solely through existing source readings.
 * This does not invoke knowledge providers or create a projection. */
export async function resolveWikiSceneSource(transport: KernelTransportStatus, input: unknown) {
  const {request, document, scene} = await inspectWikiScene(transport, input);
  const registers = getWikiProjectionState().registers;
  const selectedSubject=(input as {subject_ref?:unknown}|null)?.subject_ref;
  if(selectedSubject!==undefined&&(typeof selectedSubject!=="string"||!selectedSubject||selectedSubject.length>2048))throw new Error("A bounded selected native source is required");
  const selectedMembers=scene.entity_refs.flatMap(ref=>{const entity=document.entities[ref];return entity?.subject&&(selectedSubject===undefined||entity.subject.subject_ref===selectedSubject)?[entity]:[];});
  if(selectedSubject!==undefined&&!selectedMembers.length)throw new Error("The selected source is not a member of this native Scene");
  const memberReadings = selectedMembers.flatMap(entity=>entity.subject?.readings??[]);
  // A single source-open uses only its actual binding. Unrelated Scene or
  // document provenance cannot lend that source a different register scope.
  const all = selectedSubject===undefined?[...document.provenance,...memberReadings]:memberReadings;
  const matches = registers.filter(register => all.some(row => row.availability === "available" && row.ref === `wiki:${wikiPathOf(register)}`));
  if (matches.length !== 1) throw new Error("Open this constellation in its source editor and choose Open live composition to refresh its source bindings.");
  const register = matches[0];
  const current = await readRegister(transport, register.project);
  const basis = `wiki:${current.file.location.path}`;
  const readings = all.filter(row => row.availability === "available" && row.ref === basis);
  if (wikiPathOf(register) !== current.file.location.path || !readings.length || readings.some(row => row.revision !== current.file.revision)) throw new Error("This Scene's source register changed; refresh its live composition before opening the editor.");
  return {request, document, scene, register, current};
}

export interface SceneConstellationTarget {frame_ref: string; frame_revision: number; title: string; project?: string}
export async function resolveSceneConstellation(transport: KernelTransportStatus, input: unknown): Promise<SceneConstellationTarget> {
  const entityRef = (input as {entity_ref?: unknown} | null)?.entity_ref;
  if (typeof entityRef !== "string" || !entityRef || entityRef.length > 2048) throw new Error("Select a native constellation occurrence first.");
  const {document, scene, register, current} = await resolveWikiSceneSource(transport, input);
  const subject = document.entities[entityRef]?.subject;
  if (!scene.entity_refs.includes(entityRef) || !subject) throw new Error("The selected occurrence is not a source-bound member of this Scene.");
  const available = subject.readings.filter(row => row.availability === "available");
  if (!available.some(row => row.ref === `wiki:${current.file.location.path}` && row.revision === current.file.revision)) throw new Error("This occurrence has no current constellation register binding.");
  const frames = current.frames.filter(frame => available.some(row => row.ref === frame.ref && row.revision === String(frame.revision)) && frame.constellations[0].members.some(member => member.ref === subject.subject_ref));
  if (frames.length !== 1) throw new Error("This occurrence has no unambiguous current constellation binding. Open its source editor to refresh its live composition.");
  const frame = frames[0];
  return {frame_ref: frame.ref, frame_revision: frame.revision, title: frame[CONSTRUCTION].title, project: register.project};
}

/** Read the source of the exact Scene that the instrument is presenting.
 * There is no selected-register, shell-workspace or Central fallback. */
export async function readWikiSceneTechne(transport: KernelTransportStatus, input: unknown): Promise<unknown> {
  if ((input as {facet?: unknown} | null)?.facet === "scene-relations") {
    const source = await resolveWikiSceneSource(transport, input);
    const result = wikiSceneSourceRelations(source);
    await inspectWikiScene(transport, input);
    return result;
  }
  if ((input as {facet?: unknown} | null)?.facet === "node-metadata") {
    const source = await resolveWikiSceneSource(transport, input);
    const result = wikiSceneNodeReadings(source);
    await inspectWikiScene(transport, input); // Refuse a Scene changed during the native source read.
    return result;
  }
  if ((input as {facet?: unknown} | null)?.facet === "relation-semantics") {
    const source = await resolveWikiSceneSource(transport, input);
    return {schema: "oi.scene-relation-readings/v1", expression_ref: source.document.expression_ref, revision: source.document.revision, scene_ref: source.scene.scene_ref, relation_readings: await wikiSceneRelationReadings(source)};
  }
  const {request, document, scene} = await inspectWikiScene(transport, input);
  const state = getWikiProjectionState();
  // The provenance lookup covers restored native work before any Wiki has
  // been opened in this process. Both the path and register were disclosed
  // by native owners; no reverse parsing of a generated expression hash.
  const members = scene.entity_refs.flatMap(ref => document.entities[ref]?.subject ? [document.entities[ref].subject!] : []);
  const documentBases = document.provenance.filter(row => row.availability === "available" && state.registers.some(register => row.ref === `wiki:${wikiPathOf(register)}`));
  const memberBases = members.flatMap(member => member.readings.filter(row => row.availability === "available" && state.registers.some(register => row.ref === `wiki:${wikiPathOf(register)}`)));
  const bases = documentBases.length ? documentBases : memberBases;
  const matching = state.registers.filter(register => bases.some(row => row.ref === `wiki:${wikiPathOf(register)}`));
  if (matching.length !== 1) throw new Error("This Scene has no exact Wiki register binding. Open its saved constellation in the source editor and choose Open live composition to refresh its source bindings.");
  const register = matching[0];
  const reading = await ensureWikiProjectionReading(register, transport);
  const standing = getWikiProjectionState().standings[register.key];
  if (!standing || !("projection" in standing) || !standing.projection) throw new Error("The owning Wiki source projection is unavailable");
  const basis = bases.find(row => row.ref === `wiki:${reading.wikiBasis.path}`);
  if (basis?.revision !== reading.wikiBasis.revision || basis.availability !== "available" || bases.some(row => row.ref === basis.ref && row.revision !== basis.revision)) throw new Error("This Scene's source revision changed; reconcile its retained composition before reading new facets");
  if (!documentBases.length) {
    // An authored constellation carries the register beside its existing
    // frame reading on native subject bindings. Verify both at their owner;
    // a frame ref alone never selects another project's register.
    const file = await readFile(transport, reading.wikiBasis.location);
    if (file.revision !== basis.revision) throw new Error("The constellation register changed; refresh it in the source editor");
    const current = decodeRegister(file, file.location.ref);
    for (const member of members) {
      const scoped = member.readings.find(row => row.ref === basis.ref && row.revision === basis.revision && row.availability === "available");
      if (!scoped) throw new Error("A Scene member has no exact constellation register binding; reopen its live composition from the source editor");
      const frame = current.frames.find(frame => member.readings.some(row => row.ref === frame.ref && row.revision === String(frame.revision) && row.availability === "available"));
      if (!frame || !frame.constellations[0].members.some(row => row.ref === member.subject_ref)) throw new Error("The Scene member's constellation or source membership changed; refresh it in the source editor");
    }
  }
  if (wikiReadingOf(getWikiProjectionState().standings[register.key]) !== reading) throw new Error("This Scene's source reading was invalidated while it was returning");
  const [declaredSpatial,declaredTemporal]=await Promise.all([sceneSpatialFacets(reading.spatial,document,scene),resolveSceneTemporalFacets(reading.temporal,document,scene)]);
  if (wikiReadingOf(getWikiProjectionState().standings[register.key]) !== reading) throw new Error("This Scene's source reading was invalidated while its facet bindings were returning");
  return wikiSceneReadingPayload({register, reading, document, sceneRef: request.scene_ref,declaredSpatial,declaredTemporal});
}

/** Pure aperture over the already disclosed owner reading. A Scene binding
 * does not make the rest of its register relevant to this instrument. */
export function wikiSceneReadingPayload(input: {
  register: WikiRegister;
  reading: Extract<WikiRegisterReading, {state: "ready"}>;
  document: ExpressionDocument;
  sceneRef: string;
  declaredSpatial?: SceneSpatialReading;
  declaredTemporal?: SceneTemporalReading;
}): unknown {
  const {reading, document, sceneRef} = input;
  const scene = document.scenes.find(row => row.scene_ref === sceneRef);
  if (!scene) throw new Error("The requested Scene is absent from this native Expression");
  const known = new Set([
    ...reading.wiki.nodes.map(node => node.ref),
    ...reading.wiki.spaces.flatMap(space => [space.ref, ...(space.node_refs ?? []), ...(space.child_space_refs ?? [])]),
    ...reading.wiki.constellations.flatMap(frame => [frame.anchor_ref, ...(frame.members ?? []).map(member => member.ref)]),
  ]);
  const refs = new Set(scene.entity_refs.map(ref => document.entities[ref]?.subject?.subject_ref).filter((ref): ref is string => !!ref && known.has(ref)));
  const nativeMembers = new Set(scene.entity_refs);
  const nativeRelations = Object.values(document.relations).filter(relation => nativeMembers.has(relation.from_entity_ref) && nativeMembers.has(relation.to_entity_ref));
  const edges = reading.relations.state === "available" ? reading.relations.edges.filter(edge => refs.has(edge.from) && refs.has(edge.to) && nativeRelations.some(relation => {
    const from = document.entities[relation.from_entity_ref]?.subject?.subject_ref;
    const to = document.entities[relation.to_entity_ref]?.subject?.subject_ref;
    return from === edge.from && to === edge.to
      && relation.native_owner === (edge.provider ?? "wiki")
      && (edge.ref ? relation.relation.ref === edge.ref : relation.provenance.some(row => row.ref === `wiki:relation-type:${edge.relation}`));
  })) : [];
  const scoped: typeof reading = {...reading,
    wiki: {...reading.wiki, nodes: reading.wiki.nodes.filter(node => refs.has(node.ref)),
      spaces: reading.wiki.spaces.filter(space => refs.has(space.ref)), constellations: []},
    relations: reading.relations.state === "available" ? {...reading.relations, focusRef: sceneRef, edges} : reading.relations,
  };
  const sourceRef = `central:source:${reading.wikiBasis.path}`;
  const canonical=input.declaredSpatial;
  const spatial = [...(canonical?.spatial??[]),...placeFacetsFromReading(scoped).filter(facet=>!canonical?.spatial.some(native=>native.place_ref===facet.place_ref))];
  const temporal = input.declaredTemporal ?? sceneTemporalFacets(reading.temporal, document, scene);
  const disclosure = disclosureFor(temporal.temporal.some(facet=>!!(facet.instant||facet.interval?.from)),true,spatial.length>0);
  if(canonical?.reason)disclosure.instruments.find(row=>row.instrument==="place")!.reason=canonical.reason;
  if(temporal.reason)disclosure.instruments.find(row=>row.instrument==="timeline")!.reason=temporal.reason;
  return {
    contract: TECHNE_CONTRACT,
    reading_ref: `ql.techne:reading:${document.expression_ref}@${document.revision}:${sceneRef}`,
    snapshot: {revision: reading.wikiBasis.revision, basis_ref: sourceRef},
    subject: {subject_ref: sceneRef, native_owner: "oi.cradle.kernel", kind: "expression-scene", native_revision: String(document.revision)},
    whole: {whole_ref: sceneRef, member_refs: [...refs], relations: edges.map(edge => relationOf(edge, sourceRef)), focus_refs: [...refs]},
    expressions: [{expression_ref: document.expression_ref, revision: String(document.revision), scene_ref: sceneRef}],
    ...(spatial.length ? {spatial} : {}),
    ...(temporal.temporal.length?{temporal:temporal.temporal}:{}),
    ...((temporal.provenance.length||canonical?.provenance.length)?{provenance:[...temporal.provenance,...(canonical?.provenance??[])]}:{}),
    disclosure,
  };
}
