import {wikiRelationMetadata,type WikiRelationMetadata} from './wikiRelationMetadata';
import {readWikiSpatial,type WikiSpatialReading} from "./spatialFacets";
import {readWikiTemporal,type WikiTemporalReading} from "./temporalFacets";
import {wikiDisplayName} from "../../../../packages/oi-design-system/expressions-engine/oi/wikiPresentation.mjs";
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
 *   - stable identity and revision are separate: changed source bytes disclose
 *     drift on the same Expression; native open drafts are never replaced.
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

/** One Central-rooted tree: "central" plus each disclosed project, deduped by
 * its native identity (the disclosed project name — Central's own register
 * key), never by a display label. A project the kernel's census names twice
 * (a stale or duplicated disclosure) still projects exactly one register. */
export function wikiRegistersFrom(projects: {name: string; path: string}[]): WikiRegister[] {
  const seen = new Set<string>();
  const native = projects.filter(row => seen.has(row.name) ? false : (seen.add(row.name), true));
  return [
    {key: "central", title: "Central"},
    ...native.map(row => ({key: row.name, title: row.name, project: row.name, projectPath: row.path})),
  ];
}

/** The Project a Central wiki space ref names, by its canonical grammar
 * (`central:wiki:project:<Project>`) — the native identity, never a label. */
export function projectOfWikiSpace(ref: string): string | null {
  const match = /^central:wiki:project:(.+)$/.exec(ref);
  return match ? match[1] : null;
}

/** The constellations a register's tree node lists, deduplicated by native
 * identity. A child space the root wiki discloses for a Project that stands
 * as its own register IS that Project's node in the one tree — it is not
 * listed a second time. A constellation's anchor, which its space also holds
 * as a member, is listed once: as the constellation itself. */
export function treeConstellationsOf(constellations: readonly ProjectedConstellation[], projects: ReadonlySet<string>): ProjectedConstellation[] {
  const anchors = new Set(constellations.filter(row => row.kind === "frame").map(row => row.wholeRef));
  return constellations
    .filter(constellation => {
      if (!constellation.disclosedChild) return true;
      const project = projectOfWikiSpace(constellation.wholeRef);
      return !project || !projects.has(project);
    })
    .map(constellation => constellation.kind === "space" && constellation.members.some(member => anchors.has(member.subjectRef))
      ? {...constellation, members: constellation.members.filter(member => !anchors.has(member.subjectRef))}
      : constellation);
}

/** The space a new constellation in a Project is placed in, from that
 * Project's own register reading: its canonical Project space by exact
 * native ref, then by the Project's identity in the ref grammar, then the
 * register's first disclosed space. Undefined = the register discloses none. */
export function projectSpaceRefOf(spaces: readonly {ref: string}[], project: string | undefined): string | undefined {
  if (!project) return (spaces.find(space => space.ref.endsWith(":root")) ?? spaces[0])?.ref;
  const exact = spaces.find(space => space.ref === `central:wiki:project:${project}`);
  if (exact) return exact.ref;
  const named = spaces.find(space => projectOfWikiSpace(space.ref)?.toLowerCase() === project.toLowerCase());
  return (named ?? spaces[0])?.ref;
}

export function wikiPathOf(register: WikiRegister): string {
  return wikiPathForProject(register.projectPath);
}

// ---------------------------------------------------------------------------
// Live reads (through the owners — the files seam and the kernel knowledge op)

export interface WikiRelationEdge extends WikiRelationMetadata { ref?: string; direction?: string; relation: string; from: string; to: string; provider: string | null; authority: string | null; revision: string | null }
export type WikiRelationsReading =
  | { state: "available"; focusRef: string; edges: WikiRelationEdge[]; truncated: boolean; warnings: string[] }
  | { state: "unavailable"; focusRef: string; reason: string };

export type WikiRegisterReading =
  | { state: "unavailable"; reason: string }
  | { state: "absent" }
  | { state: "ready"; register: WikiRegister; wiki: WikiReading & { state: "ready" }; wikiBasis: { path: string; revision: string; location: CentralLocation }; relations: WikiRelationsReading; temporal?: WikiTemporalReading; spatial?: WikiSpatialReading };

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
        edges?: { reference?: string; ref?: string; edge_ref?: string; relation: string; direction?: string; from: string; to: string; origin?: { provider?: string; authority?: string; revision?: string }; standing?: string | null }[];
        truncated?: boolean;
        warnings?: string[];
      } : null;
      if (!data) throw new Error(reply.error ?? "AIKit did not return the requested reading");
      const nativeDocument=JSON.parse(file.content),nativeObjects:Array<Record<string,unknown>>=Array.isArray(nativeDocument)?nativeDocument:nativeDocument.objects;
      relations = {
        state: "available",
        focusRef,
        edges: (data.edges ?? []).map(edge => {
          const reference=edge.reference??edge.edge_ref??edge.ref;
          const matches=reference?nativeObjects.filter(row=>row.object==='edge'&&row.ref===reference):[];
          if(matches.length>1)throw Error('The native relation identity is ambiguous.');
          const native=matches[0];
          if(native&&String(native.revision)!==edge.origin?.revision)throw Error('The native relation changed while reading its attribution.');
          const metadata=native?wikiRelationMetadata(native):typeof edge.standing==='string'?{standing:edge.standing}:{};
          return {
          ref: edge.reference ?? edge.edge_ref ?? edge.ref,
          direction: edge.direction,
          relation: String(edge.relation),
          from: String(edge.from),
          to: String(edge.to),
          provider: edge.origin?.provider ?? null,
          authority: edge.origin?.authority ?? null,
          revision: edge.origin?.revision ?? null,
          ...metadata,
        };}),
        truncated: data.truncated === true,
        warnings: data.warnings ?? [],
      };
    } catch (cause) {
      relations = {state: "unavailable", focusRef, reason: cause instanceof Error ? cause.message : String(cause)};
    }
  }
  return {state: "ready", register, wiki, wikiBasis: {path: wikiPath, revision: file.revision, location: file.location}, relations, temporal: readWikiTemporal(file.content), spatial: readWikiSpatial(file.content)};
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
  if (count <= RING_CAPACITY) return polar(-90 + (360 / count) * index, MEMBER_RING_RADIUS);
  // A large undeclared membership: a sunflower spiral keeps neighbour
  // spacing constant as the count grows (one fixed ring packed 192 members
  // ~39px apart and stacked their anchors). Presentation only — no position
  // is claimed as a QL warrant.
  return polar(-90 + GOLDEN_ANGLE * index, MEMBER_RING_RADIUS * Math.sqrt((index + 1) / RING_CAPACITY));
}
const RING_CAPACITY = 12;
const GOLDEN_ANGLE = 137.50776405;

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
  /** True for a child space another space discloses (its members live in
   * its own register's wiki, not in this reading). */
  disclosedChild: boolean;
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
/** Stable identity follows the register, never the bytes/revision it reads.
 * The full native refs remain in bindings; this non-authoritative projection
 * key only gives browser/kernel-local identifiers a bounded ASCII spelling. */
export function projectionKey(value:string):string {
  const seeds=[0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35];
  for(const c of new TextEncoder().encode(value))for(let i=0;i<seeds.length;i++)seeds[i]=Math.imul(seeds[i]^c,0x01000193)>>>0;
  return seeds.map(h=>h.toString(16).padStart(8,"0")).join("");
}
export function projectionExpressionRef(register: WikiRegister, _input?: {wikiRevision: string; relations: WikiRelationsReading}): string {
  return `expression:techne-m0.${kebab(register.key).slice(0,48)}.${projectionKey(register.key)}`;
}

const parameter = (value: string | number): Parameter => ({value, automation: null});
const reading = (ref: string, revision: string, availability: ReadingRef["availability"] = "available"): ReadingRef => ({ref, revision, availability});

/** One constellation of the reading: every space the wiki discloses is a
 * constellation (anchored whole + members), and every frame constellation
 * (explicit positional carrier) is one too. Child spaces a space discloses
 * are carried as further constellations whose members their OWN register's
 * wiki discloses — this reading names that state honestly. */
interface DisclosedConstellation { kind: "space" | "frame"; wholeRef: string; title: string; space?: WikiSpace; constellation?: WikiConstellation; childSpaceRefs: string[]; disclosedChild?: boolean }
function constellationsOf(wiki: WikiReading & { state: "ready" }): DisclosedConstellation[] {
  const byRef = new Map(wiki.nodes.map(node => [node.ref, node]));
  const own: DisclosedConstellation[] = [
    ...wiki.spaces.map(space => ({
      kind: "space" as const,
      wholeRef: space.anchor_ref ?? space.ref,
      title: wikiDisplayName(space.title, space.ref),
      space,
      childSpaceRefs: space.child_space_refs ?? [],
    })),
    ...wiki.constellations.map((constellation, index) => ({
      kind: "frame" as const,
      wholeRef: constellation.anchor_ref ?? `wiki:frame:${index}`,
      // The frame's own authored title (then its question, then the anchor
      // node's title) names it; the anchor ref is the last resort.
      title: wikiDisplayName(constellation.title || constellation.question || byRef.get(constellation.anchor_ref ?? "")?.title, constellation.anchor_ref ?? `Constellation ${index + 1}`),
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
      children.push({kind: "space", wholeRef: childRef, title: wikiDisplayName(undefined, childRef), childSpaceRefs: [], disclosedChild: true});
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

const SCENE_ENTITY_BUDGET = 2048; // semantic composition, distinct from the renderer window
const SCENE_BUDGET = 64;
const ENTITY_BUDGET = 2048; // the kernel document's semantic bound (DOCUMENT_MEMBERS)

export function projectWikiExpression(input: WikiRegisterReading & { state: "ready" }): WikiProjection {
  const {register, wiki, wikiBasis, relations} = input;
  const notices: string[] = [];
  const expressionRef = projectionExpressionRef(register, {wikiRevision: wikiBasis.revision, relations});
  const byRef = new Map(wiki.nodes.map(node => [node.ref, node]));
  const subjectReadings = (ref: string, disclosure: DisclosedConstellation, occurrence?: number): ReadingRef[] => {
    const observed: ReadingRef[] = [reading(`wiki:${wikiBasis.path}`, wikiBasis.revision)];
    const revision = byRef.get(ref)?.revision ?? wiki.spaces.find(space => space.ref === ref)?.revision;
    if (Number.isSafeInteger(revision) && Number(revision) > 0) observed.push(reading(ref, String(revision)));
    const frame = disclosure.constellation;
    if (frame?.frame_ref && Number.isSafeInteger(frame.frame_revision) && Number(frame.frame_revision) > 0) {
      observed.push(reading(frame.frame_ref, String(frame.frame_revision)));
      const member = occurrence === undefined ? undefined : frame.members?.filter(member => member.ref === ref)[occurrence];
      if (member?.participation_ref) observed.push(reading(member.participation_ref, String(frame.frame_revision)));
    }
    return observed;
  };

  const entities: Record<string, Entity> = {};
  const scenes: Scene[] = [];
  const entitySubjects = new Map<string, string>(); // entity ref → native subject ref
  const boundRelations: Relation[] = [];
  let adriftRelationCount = 0;

  const overviewEntityRefs: string[] = [];
  const overviewSceneRef = `${expressionRef}:scene:overview`;
  const constellations: ProjectedConstellation[] = [];
  const disclosures = constellationsOf(wiki);
  const overviewCount = Math.min(disclosures.length, SCENE_BUDGET - 1);
  if (disclosures.length > overviewCount) notices.push(`The overview carries the first ${overviewCount} of ${disclosures.length} disclosed constellations (the scene's own entity budget).`);

  for (let index = 0; index < overviewCount; index++) {
    const disclosure = disclosures[index];
    const overviewEntityRef = `${expressionRef}:entity:o${projectionKey(`${disclosure.kind}:${disclosure.wholeRef}`)}`;
    const at = overviewPosition(index, overviewCount);
    const subject: SubjectBinding = {
      subject_ref: disclosure.kind === "space" && disclosure.space ? disclosure.space.ref : disclosure.wholeRef,
      native_owner: "wiki",
      presentation_role: "thing",
      sources: [reading(disclosure.wholeRef, String(disclosure.space?.revision ?? byRef.get(disclosure.wholeRef)?.revision ?? wikiBasis.revision))],
      readings: subjectReadings(disclosure.kind === "space" && disclosure.space ? disclosure.space.ref : disclosure.wholeRef, disclosure),
      actions: [],
    };
    entities[overviewEntityRef] = {
      entity_ref: overviewEntityRef,
      revision: 1,
      title: disclosure.title,
      subject,
      parameters: {x: parameter(at.x * 1000), y: parameter(-at.y * 1000), z: parameter(0), scale: parameter(0.24), glyph: parameter("●"), shape: parameter("disc")},
    };
    entitySubjects.set(overviewEntityRef, subject.subject_ref);
    overviewEntityRefs.push(overviewEntityRef);
  }

  for (let index = 0; index < Math.min(disclosures.length, SCENE_BUDGET - 1); index++) {
    if (Object.keys(entities).length + 1 >= ENTITY_BUDGET) {
      notices.push(`The projection stops at ${constellations.length} constellations (the document's own entity budget); the wiki discloses ${disclosures.length}.`);
      break;
    }
    const disclosure = disclosures[index];
    const sceneRef = `${expressionRef}:scene:c${projectionKey(`${disclosure.kind}:${disclosure.wholeRef}`)}`;
    const wholeEntityRef = `${expressionRef}:entity:w${projectionKey(`${disclosure.kind}:${disclosure.wholeRef}`)}`;
    const overviewEntityRef = overviewEntityRefs[index];

    // The members this register's own reading discloses for this whole.
    let memberRefs: string[] = [];
    if (disclosure.kind === "space" && disclosure.space) memberRefs = disclosure.space.node_refs ?? [];
    else if (disclosure.kind === "frame" && disclosure.constellation) memberRefs = (disclosure.constellation.members ?? []).map(member => member.ref ?? "").filter(Boolean);
    const membersWithWhole = memberRefs.filter(ref => ref && ref !== disclosure.wholeRef);
    const memberBudget = Math.min(SCENE_ENTITY_BUDGET - 1, ENTITY_BUDGET-Object.keys(entities).length-1);
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
        readings: subjectReadings(disclosure.wholeRef, disclosure),
        actions: [],
      },
      parameters: {x: parameter(0), y: parameter(0), z: parameter(0), scale: parameter(0.28), glyph: parameter("●"), shape: parameter("disc")},
    };
    entitySubjects.set(wholeEntityRef, disclosure.wholeRef);

    const members: ProjectedMember[] = placedMembers.map((memberRef, memberIndex) => {
      const entityRef = `${expressionRef}:entity:n${projectionKey(`${disclosure.kind}:${disclosure.wholeRef}`)}.${projectionKey(memberRef)}.${placedMembers.slice(0,memberIndex).filter(ref=>ref===memberRef).length}`;
      const node = byRef.get(memberRef);
      const title = wikiDisplayName(node?.title, memberRef);
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
          readings: subjectReadings(memberRef, disclosure, placedMembers.slice(0,memberIndex).filter(ref=>ref===memberRef).length),
          actions: node ? [{action_ref: "aikit:knowledge:read", target_ref: memberRef, authority_requirement: "read"}] : [],
        },
        parameters: {x: parameter(at.x * 1000), y: parameter(-at.y * 1000), z: parameter(0), scale: parameter(0.2), glyph: parameter("●"), shape: parameter("disc")},
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
      disclosedChild: disclosure.disclosedChild === true,
    });
  }

  scenes.unshift({scene_ref: overviewSceneRef, revision: 1, title: `${register.title} — wiki overview`, entity_refs: overviewEntityRefs, body: null, triggers: []});

  // Typed relations — ONLY from the live kernel read, co-present occurrences.
  if (relations.state === "available") {
    // Bind within EACH Scene, using exact occurrences. Same endpoints with
    // different native records/provenance remain independently addressable.
    // A generic relations provider that omits an edge ref is disclosed as a
    // sourced observation, not relabelled as a fictitious canonical WikiEdge.
    for (const [edgeIndex,edge] of relations.edges.entries()) {
      let bound=false;
      for(const scene of scenes) {
        const from=scene.entity_refs.filter(ref=>entitySubjects.get(ref)===edge.from);
        const to=scene.entity_refs.filter(ref=>entitySubjects.get(ref)===edge.to);
        for(const fromEntity of from) for(const toEntity of to) {
          if(boundRelations.length>=2048)continue;
          const observed=edge.ref ?? `wiki:relation-observation:${projectionKey(JSON.stringify([edge.provider,edge.authority,edge.revision,edge.from,edge.relation,edge.to,edgeIndex]))}`;
          boundRelations.push({
            native_owner:edge.provider ?? "wiki",
            binding_ref:`${expressionRef}:relation:r${projectionKey(JSON.stringify([scene.scene_ref,observed,fromEntity,toEntity]))}`,
            relation:reading(observed,edge.revision ?? wikiBasis.revision),
            from_entity_ref:fromEntity,to_entity_ref:toEntity,
            provenance:[reading(edge.provider ?? "wiki",edge.revision ?? wikiBasis.revision),
              reading(`wiki:relation-type:${edge.relation}`,edge.revision ?? wikiBasis.revision)],
          });
          bound=true;
        }
      }
      if(!bound)adriftRelationCount++;
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
      reading("oi:wiki-presentation", "2"),
      ...(relations.state === "available" ? [reading(`wiki:relations:${relations.focusRef}`, `${relations.edges.length} edges at wiki basis ${wikiBasis.revision}`)] : []),
    ],
    representations: [],
    refinements: [],
  };
  if (relations.state === "unavailable") notices.push(`Typed relations unavailable: ${relations.reason} — the projection binds no relation; membership shows as composition only.`);
  return {document, constellations, overviewSceneRef, boundRelationCount: boundRelations.length, adriftRelationCount, notices};
}

/** The relation edges bound wholly within one constellation's own Scene — a
 * restrained per-constellation indicator, read from the standing document's
 * actual bindings (never invented: zero where the reading carried none). */
export function relationCountOf(document: ExpressionDocument | undefined, sceneRef: string): number {
  if (!document) return 0;
  const entityRefs = document.scenes.find(scene => scene.scene_ref === sceneRef)?.entity_refs;
  if (!entityRefs?.length) return 0;
  const inScene = new Set(entityRefs);
  let count = 0;
  for (const relation of Object.values(document.relations)) if (inScene.has(relation.from_entity_ref) && inScene.has(relation.to_entity_ref)) count++;
  return count;
}
