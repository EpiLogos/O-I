/**
 * The Wiki→Expression projection (O-I #366 EX3A, Technè M0′ — owner
 * direction 2026-09-19): a register's bounded local whole — the wiki.json
 * its own ground discloses, plus the typed relations the kernel's knowledge
 * relations faculty returns — projected into a real `oi.expression/v1`
 * document. Deterministic, source-backed, exact refs retained.
 *
 * The pipeline (one direction, no second graph store):
 *
 *   native wiki.json (files seam, verbatim)   +   kernel knowledge
 *   relations read (typed, provenance-carrying) over the register's
 *   primary space ref
 *        ↓ this module, pure
 *   overview Scene (the local whole) carrying each disclosed constellation
 *   as one addressable object ↓ one constellation Scene per constellation:
 *   the actual wiki nodes as subject-bound entities, actual typed relations
 *   as document relations, warranted QL shape layout as presentation.
 *
 * Laws kept here:
 *   - NO invented edges. A document `Relation` exists only where the kernel
 *     relations read returned that edge with its provenance; the QL layout
 *     never creates one (`shape_address_asserts_semantic_relation = false`,
 *     ql-shape-contract-v1). Where the relations read is unavailable the
 *     projection carries the exact named state and zero relations —
 *     membership appears as scene composition only, which is presentation.
 *   - QL shape = presentation warrant only. The "ql-constellation" scheme
 *     engages only when the wiki itself declares positions (frame
 *     constellation members, or node `ql.position` facets) — the same
 *     canonical sixfold layout law as the M1′ Canvas instrument
 *     (position 0 at the top, clockwise at 60° steps, outer rings ×1.45).
 *     With no declared positions the scheme is the ordinary radial
 *     presentation and no shape is claimed.
 *   - exact refs: every entity binds its canonical native subject ref with
 *     the revision(s) the owner disclosed; document provenance retains the
 *     wiki basis ref + revision and the relations basis.
 *   - dynamic currentness (#366 EX3A4): the projection identity is
 *     content-addressed over what was actually read, so a changed basis is
 *     a new generation that opens cleanly — an open draft is never
 *     silently replaced (the kernel's own CAS law).
 */
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import {kernelOp} from "../kernel/bridge";
import {listFiles, readFile} from "../files/client";
import {parseWiki, wikiPathForProject, type WikiConstellation, type WikiReading, type WikiSpace} from "./wikiReading";
import type {Entity, ExpressionDocument, Parameter, ReadingRef, Relation, Scene, SubjectBinding} from "../expression/types";

// ---------------------------------------------------------------------------
// The register (which local whole is projected)

export interface WikiRegister {
  /** Stable key: "central" or the project name. */
  key: string;
  title: string;
  /** The project the knowledge reads are scoped to (undefined = Central). */
  project?: string;
  /** The project's Central-relative path (undefined = Central root). */
  projectPath?: string;
}

export function wikiRegistersFrom(projects: {name: string; path: string}[]): WikiRegister[] {
  return [
    {key: "central", title: "Central"},
    ...projects.map(row => ({key: row.name, title: row.name, project: row.name, projectPath: row.path})),
  ];
}

export function wikiPathOf(register: WikiRegister): string {
  return wikiPathForProject(register.projectPath);
}

// ---------------------------------------------------------------------------
// Live reads (through the owners — the files seam and the kernel knowledge op)

export interface WikiRelationEdge { relation: string; from: string; to: string; provider: string | null; authority: string | null; revision: string | null }
export type WikiRelationsReading =
  | { state: "available"; focusRef: string; edges: WikiRelationEdge[]; truncated: boolean; warnings: string[] }
  | { state: "unavailable"; focusRef: string; reason: string };

export type WikiRegisterReading =
  | { state: "unavailable"; reason: string }
  | { state: "absent" }
  | { state: "ready"; register: WikiRegister; wiki: WikiReading & { state: "ready" }; wikiBasis: { path: string; revision: string; location: CentralLocation }; relations: WikiRelationsReading };

/** Read one register's bounded local whole: the wiki.json its ground
 * discloses (verbatim through the files seam), then the typed relations
 * over the register's own primary space ref (the first space the wiki
 * discloses — never an assumed naming convention). */
export async function readWikiRegister(transport: KernelTransportStatus, register: WikiRegister): Promise<WikiRegisterReading> {
  if (transport.kind === "unavailable") return {state: "unavailable", reason: transport.reason};
  const wikiPath = wikiPathOf(register);
  const directory = await listFiles(transport, wikiPath.replace(/\/[^/]+$/, ""));
  const entry = directory.entries.find(candidate => candidate.name === "wiki.json");
  if (!entry) return {state: "absent"};
  const file = await readFile(transport, entry.location);
  const wiki = parseWiki(file.content);
  if (wiki.state !== "ready") return wiki.state === "absent" ? {state: "absent"} : {state: "unavailable", reason: wiki.state === "failed" ? wiki.reason : "the wiki reading did not resolve"};
  const focusRef = wiki.spaces[0]?.ref;
  let relations: WikiRelationsReading;
  if (!focusRef) {
    relations = {state: "unavailable", focusRef: "", reason: "the wiki discloses no space to read relations from"};
  } else {
    try {
      const reply = await kernelOp(transport, {op: "knowledge", project: register.project, request: {action: "relations", address: {kind: "wiki", value: focusRef}}});
      const data = reply.outcome?.result === "knowledge" ? reply.outcome.data as {
        edges?: { relation: string; from: string; to: string; origin?: { provider?: string; authority?: string; revision?: string } }[];
        truncated?: boolean;
        warnings?: string[];
      } : null;
      if (!data) throw new Error(reply.error ?? "AIKit did not return the requested reading");
      relations = {
        state: "available",
        focusRef,
        edges: (data.edges ?? []).map(edge => ({
          relation: String(edge.relation),
          from: String(edge.from),
          to: String(edge.to),
          provider: edge.origin?.provider ?? null,
          authority: edge.origin?.authority ?? null,
          revision: edge.origin?.revision ?? null,
        })),
        truncated: data.truncated === true,
        warnings: data.warnings ?? [],
      };
    } catch (cause) {
      relations = {state: "unavailable", focusRef, reason: cause instanceof Error ? cause.message : String(cause)};
    }
  }
  return {state: "ready", register, wiki, wikiBasis: {path: wikiPath, revision: file.revision, location: file.location}, relations};
}

// ---------------------------------------------------------------------------
// The deterministic layout — the canonical M1′ law (Canvas layout.ts), in
// the engine's unit field. Presentation only: never a semantic edge.

export type ConstellationScheme = "ql-constellation" | "radial";

const MEMBER_RING_RADIUS = 0.36;
const RING_GROWTH = 1.45;
const SIXFOLD = 6;
const OVERVIEW_RING_RADIUS = 0.3;

const polar = (angleDegrees: number, radius: number) => {
  const angle = (angleDegrees * Math.PI) / 180;
  return {x: Number((Math.cos(angle) * radius).toFixed(5)), y: Number((Math.sin(angle) * radius).toFixed(5))};
};

/** Overview objects: evenly spaced on one ring clockwise from the top; a
 * lone whole sits at the centre. Deterministic in disclosed order. */
function overviewPosition(index: number, count: number): {x: number; y: number} {
  if (count <= 1) return {x: 0, y: 0};
  return polar(-90 + (360 / count) * index, OVERVIEW_RING_RADIUS);
}

/** Constellation members. The QL scheme places each member at its DECLARED
 * sixfold position (0..=5 at 60° steps from the top; repeats continue on
 * outer rings ×1.45) — a warrant the wiki itself must carry. The radial
 * scheme spaces members evenly and claims no shape. */
function memberPosition(index: number, count: number, declared: number | null): {x: number; y: number} {
  if (declared !== null) {
    const position = declared % SIXFOLD;
    const ring = Math.floor(declared / SIXFOLD);
    return polar(-90 + 60 * position, MEMBER_RING_RADIUS * Math.pow(RING_GROWTH, ring));
  }
  if (count <= 1) return {x: 0, y: 0};
  return polar(-90 + (360 / count) * index, MEMBER_RING_RADIUS);
}

// ---------------------------------------------------------------------------
// The projection (pure): reading → oi.expression/v1 document

export interface ProjectedMember { entityRef: string; subjectRef: string; title: string; position: number | null }
export interface ProjectedConstellation {
  index: number;
  kind: "space" | "frame";
  /** The native whole ref — the space ref, or the frame anchor. */
  wholeRef: string;
  title: string;
  scheme: ConstellationScheme;
  overviewEntityRef: string;
  wholeEntityRef: string;
  sceneRef: string;
  members: ProjectedMember[];
  /** Child spaces this constellation discloses (other registers' grounds). */
  childSpaceRefs: string[];
}

export interface WikiProjection {
  document: ExpressionDocument;
  constellations: ProjectedConstellation[];
  overviewSceneRef: string;
  /** Typed relation edges that bound into the projection. */
  boundRelationCount: number;
  /** Typed relation edges whose endpoints fell outside this bounded whole. */
  adriftRelationCount: number;
  /** Named, honest truncations and states the surface must disclose. */
  notices: string[];
}

const kebab = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "register";
const glyphOf = (title: string) => {
  const found = title.match(/[^\s]/u);
  const glyph = found ? found[0] : "·";
  return [...glyph][0] ?? "·";
};

/** A small deterministic content hash (FNV-1a 32) over the projection-relevant
 * reading: the wiki basis revision plus every relation edge with its origin
 * revision. Same reading → same identity; changed basis → a new generation. */
function basisHash(input: {wikiRevision: string; relations: WikiRelationsReading}): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => { for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; } };
  feed(input.wikiRevision);
  feed("\0");
  if (input.relations.state === "available") {
    feed(input.relations.focusRef);
    for (const edge of input.relations.edges) feed(`${edge.from}\u001f${edge.relation}\u001f${edge.to}\u001f${edge.revision ?? ""}\u001e`);
    feed(input.relations.truncated ? "truncated" : "complete");
  } else {
    feed(`unavailable:${input.relations.reason}`);
  }
  return hash.toString(16).padStart(8, "0");
}

/** The projection's expression identity: content-addressed over the reading,
 * stable for the same basis. Structure keeps #366 EX3A4 honest — a changed
 * wiki is a new generation, never an implicit replacement. */
export function projectionExpressionRef(register: WikiRegister, input: {wikiRevision: string; relations: WikiRelationsReading}): string {
  return `expression:techne-m0.${kebab(register.key)}.${basisHash(input)}`;
}

const parameter = (value: string | number): Parameter => ({value, automation: null});
const reading = (ref: string, revision: string, availability: ReadingRef["availability"] = "available"): ReadingRef => ({ref, revision, availability});

/** One constellation of the reading: every space the wiki discloses is a
 * constellation (anchored whole + members), and every frame constellation
 * (explicit positional carrier) is one too. Child spaces a space discloses
 * are carried as further constellations whose members their OWN register's
 * wiki discloses — this reading names that state honestly. */
interface DisclosedConstellation { kind: "space" | "frame"; wholeRef: string; title: string; space?: WikiSpace; constellation?: WikiConstellation; childSpaceRefs: string[] }
function constellationsOf(wiki: WikiReading & { state: "ready" }): DisclosedConstellation[] {
  const byRef = new Map(wiki.nodes.map(node => [node.ref, node]));
  const own: DisclosedConstellation[] = [
    ...wiki.spaces.map(space => ({
      kind: "space" as const,
      wholeRef: space.anchor_ref ?? space.ref,
      title: space.title ?? space.ref,
      space,
      childSpaceRefs: space.child_space_refs ?? [],
    })),
    ...wiki.constellations.map((constellation, index) => ({
      kind: "frame" as const,
      wholeRef: constellation.anchor_ref ?? `wiki:frame:${index}`,
      title: byRef.get(constellation.anchor_ref ?? "")?.title ?? constellation.anchor_ref ?? `Constellation ${index + 1}`,
      constellation,
      childSpaceRefs: [],
    })),
  ];
  // Child spaces the own spaces disclose: each is a real, ref-exact
  // constellation of the local whole whose members live in its own
  // register's wiki (not read here — named, never invented).
  const ownRefs = new Set(own.map(entry => entry.wholeRef));
  const children: DisclosedConstellation[] = [];
  for (const entry of own) {
    for (const childRef of entry.childSpaceRefs) {
      if (ownRefs.has(childRef)) continue;
      ownRefs.add(childRef);
      children.push({kind: "space", wholeRef: childRef, title: childRef, childSpaceRefs: []});
    }
  }
  return [...own, ...children];
}

/** The declared sixfold position a member carries, when the wiki itself
 * warrants one: a frame constellation member's `position`, or the node's
 * own `ql.position` facet. Null = no declared position. */
function declaredPosition(kind: "space" | "frame", memberRef: string, constellation: WikiConstellation | undefined, nodes: WikiReading & { state: "ready" }): number | null {
  if (kind === "frame" && constellation) {
    const member = (constellation.members ?? []).find(candidate => candidate.ref === memberRef);
    if (member && typeof member.position === "number") return member.position;
  }
  const node = nodes.nodes.find(candidate => candidate.ref === memberRef);
  const position = node?.ql?.position;
  return typeof position === "number" ? position : null;
}

const SCENE_ENTITY_BUDGET = 10; // the kernel's own composition budget
const SCENE_BUDGET = 64;
const ENTITY_BUDGET = 220; // stays under the kernel's 256-entity document budget

export function projectWikiExpression(input: WikiRegisterReading & { state: "ready" }): WikiProjection {
  const {register, wiki, wikiBasis, relations} = input;
  const notices: string[] = [];
  const expressionRef = projectionExpressionRef(register, {wikiRevision: wikiBasis.revision, relations});
  const byRef = new Map(wiki.nodes.map(node => [node.ref, node]));

  const entities: Record<string, Entity> = {};
  const scenes: Scene[] = [];
  const entitySubjects = new Map<string, string>(); // entity ref → native subject ref
  const boundRelations: Relation[] = [];
  let adriftRelationCount = 0;

  const overviewEntityRefs: string[] = [];
  const overviewSceneRef = `${expressionRef}:scene:overview`;
  const constellations: ProjectedConstellation[] = [];
  const disclosures = constellationsOf(wiki);
  const overviewCount = Math.min(disclosures.length, SCENE_ENTITY_BUDGET);
  if (disclosures.length > overviewCount) notices.push(`The overview carries the first ${overviewCount} of ${disclosures.length} disclosed constellations (the scene's own entity budget).`);

  for (let index = 0; index < overviewCount; index++) {
    const disclosure = disclosures[index];
    const overviewEntityRef = `${expressionRef}:entity:o${index}`;
    const at = overviewPosition(index, overviewCount);
    const subject: SubjectBinding = {
      subject_ref: disclosure.kind === "space" && disclosure.space ? disclosure.space.ref : disclosure.wholeRef,
      native_owner: "wiki",
      presentation_role: "thing",
      sources: [reading(disclosure.wholeRef, String(disclosure.space?.revision ?? byRef.get(disclosure.wholeRef)?.revision ?? wikiBasis.revision))],
      readings: [],
      actions: [],
    };
    entities[overviewEntityRef] = {
      entity_ref: overviewEntityRef,
      revision: 1,
      title: disclosure.title,
      subject,
      parameters: {x: parameter(at.x), y: parameter(at.y), z: parameter(0), scale: parameter(1.35), glyph: parameter(glyphOf(disclosure.title))},
    };
    entitySubjects.set(overviewEntityRef, subject.subject_ref);
    overviewEntityRefs.push(overviewEntityRef);
  }

  for (let index = 0; index < Math.min(disclosures.length, SCENE_BUDGET - 1); index++) {
    if (Object.keys(entities).length + SCENE_ENTITY_BUDGET + 1 > ENTITY_BUDGET) {
      notices.push(`The projection stops at ${constellations.length} constellations (the document's own entity budget); the wiki discloses ${disclosures.length}.`);
      break;
    }
    const disclosure = disclosures[index];
    const sceneRef = `${expressionRef}:scene:c${index}`;
    const wholeEntityRef = `${expressionRef}:entity:w${index}`;
    const overviewEntityRef = overviewEntityRefs[index];

    // The members this register's own reading discloses for this whole.
    let memberRefs: string[] = [];
    if (disclosure.kind === "space" && disclosure.space) memberRefs = disclosure.space.node_refs ?? [];
    else if (disclosure.kind === "frame" && disclosure.constellation) memberRefs = (disclosure.constellation.members ?? []).map(member => member.ref ?? "").filter(Boolean);
    const membersWithWhole = memberRefs.filter(ref => ref && ref !== disclosure.wholeRef);
    const memberBudget = SCENE_ENTITY_BUDGET - 1;
    const placedMembers = membersWithWhole.slice(0, memberBudget);
    if (membersWithWhole.length > placedMembers.length) notices.push(`${disclosure.title} carries ${membersWithWhole.length} members; its scene places the first ${placedMembers.length} (the scene's own entity budget).`);
    const warrantCount = placedMembers.filter(memberRef => declaredPosition(disclosure.kind, memberRef, disclosure.constellation, wiki) !== null).length;
    const scheme: ConstellationScheme = warrantCount > 0 ? "ql-constellation" : "radial";

    const sceneEntityRefs = [wholeEntityRef];
    entities[wholeEntityRef] = {
      entity_ref: wholeEntityRef,
      revision: 1,
      title: disclosure.title,
      subject: {
        subject_ref: disclosure.wholeRef,
        native_owner: "wiki",
        presentation_role: "thing",
        sources: [reading(disclosure.wholeRef, String(disclosure.space?.revision ?? byRef.get(disclosure.wholeRef)?.revision ?? wikiBasis.revision))],
        readings: [],
        actions: [],
      },
      parameters: {x: parameter(0), y: parameter(0), z: parameter(0), scale: parameter(1.5), glyph: parameter(glyphOf(disclosure.title))},
    };
    entitySubjects.set(wholeEntityRef, disclosure.wholeRef);

    const members: ProjectedMember[] = placedMembers.map((memberRef, memberIndex) => {
      const entityRef = `${expressionRef}:entity:n${index}.${memberIndex}`;
      const node = byRef.get(memberRef);
      const title = node?.title ?? memberRef;
      const declared = declaredPosition(disclosure.kind, memberRef, disclosure.constellation, wiki);
      const at = memberPosition(memberIndex, placedMembers.length, declared);
      const revision = node?.revision !== undefined ? String(node.revision) : wikiBasis.revision;
      entities[entityRef] = {
        entity_ref: entityRef,
        revision: 1,
        title,
        subject: {
          subject_ref: memberRef,
          native_owner: "wiki",
          presentation_role: "thing",
          sources: (node?.source_refs ?? []).map(sourceRef => reading(sourceRef, revision)),
          readings: [],
          actions: node ? [{action_ref: "aikit:knowledge:read", target_ref: memberRef, authority_requirement: "read"}] : [],
        },
        parameters: {x: parameter(at.x), y: parameter(at.y), z: parameter(0), scale: parameter(1), glyph: parameter(glyphOf(title))},
      };
      entitySubjects.set(entityRef, memberRef);
      sceneEntityRefs.push(entityRef);
      return {entityRef, subjectRef: memberRef, title, position: declared};
    });

    scenes.push({scene_ref: sceneRef, revision: 1, title: disclosure.title, entity_refs: sceneEntityRefs, body: null, triggers: []});
    constellations.push({
      index,
      kind: disclosure.kind,
      wholeRef: disclosure.wholeRef,
      title: disclosure.title,
      scheme,
      overviewEntityRef,
      wholeEntityRef,
      sceneRef,
      members,
      childSpaceRefs: disclosure.childSpaceRefs,
    });
  }

  scenes.unshift({scene_ref: overviewSceneRef, revision: 1, title: `${register.title} — wiki overview`, entity_refs: overviewEntityRefs, body: null, triggers: []});

  // Typed relations — ONLY from the live kernel read, both endpoints placed.
  if (relations.state === "available") {
    const bySubject = new Map<string, string>();
    for (const [entityRef, subjectRef] of entitySubjects) if (!bySubject.has(subjectRef)) bySubject.set(subjectRef, entityRef);
    const seen = new Set<string>();
    for (const edge of relations.edges) {
      const key = `${edge.from}\u001f${edge.relation}\u001f${edge.to}`;
      if (seen.has(key)) continue;
      const fromEntity = bySubject.get(edge.from), toEntity = bySubject.get(edge.to);
      if (!fromEntity || !toEntity) { adriftRelationCount++; continue; }
      seen.add(key);
      boundRelations.push({
        binding_ref: `${expressionRef}:relation:r${boundRelations.length}`,
        relation: reading(`wiki:relation:${edge.relation}`, edge.revision ?? wikiBasis.revision),
        from_entity_ref: fromEntity,
        to_entity_ref: toEntity,
        provenance: [reading(edge.provider ?? "wiki", edge.revision ?? wikiBasis.revision)],
      });
    }
    if (relations.truncated) notices.push("The relations read was truncated by its own budget; the bound relations are a bounded view.");
    for (const warning of relations.warnings) notices.push(`Relations read warning: ${warning}`);
  }

  const document: ExpressionDocument = {
    schema: "oi.expression/v1",
    expression_ref: expressionRef,
    revision: 1,
    title: `${register.title} — wiki local whole`,
    scenes,
    entities,
    relations: Object.fromEntries(boundRelations.map(relation => [relation.binding_ref, relation])),
    selection: {scene_ref: overviewSceneRef, entity_ref: null},
    provenance: [
      reading(`wiki:${wikiBasis.path}`, wikiBasis.revision),
      ...(relations.state === "available" ? [reading(`wiki:relations:${relations.focusRef}`, `${relations.edges.length} edges at wiki basis ${wikiBasis.revision}`)] : []),
    ],
    representations: [],
    refinements: [],
  };
  if (relations.state === "unavailable") notices.push(`Typed relations unavailable: ${relations.reason} — the projection binds no relation; membership shows as composition only.`);
  return {document, constellations, overviewSceneRef, boundRelationCount: boundRelations.length, adriftRelationCount, notices};
}
