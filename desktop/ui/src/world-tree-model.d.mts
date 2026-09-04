export const WORLD_TREE_SCHEMA: 'oi.world-tree/v1';
export const COMPOSITION_READING_SCHEMA: 'oi.composition-reading/v1';
export const SUBJECT_READING_SCHEMA: 'oi.subject-reading/v1';
export const PERSONAL_WORLD_REF: 'world:personal';
export const PROJECT_WORLD_PREFIX: 'world:project:';
export const ACCESS_FACTS: readonly string[];

/** A `SemanticRef` exactly as a landed reading carries it. */
export type ReadingRef = {
  ref: string;
  kind: string;
  native_owner: string;
  provenance: { source: string; revision?: string } | null;
};

/** The seven access facts (01 §2), `true` / `false` / omitted. */
export type AccessFacts = {
  exists?: boolean;
  readable?: boolean;
  indexable?: boolean;
  retrievable?: boolean;
  selected?: boolean;
  projected?: boolean;
  public?: boolean;
};

export type WorldSourceReading = {
  ref: string;
  path: string | null;
  /** The owner's declared treatment, verbatim. */
  treatment: string;
  provenance: string;
  standing: string;
  roles: string[];
  agent_retrieval_allowed: boolean;
  revision: string | number | null;
  access: AccessFacts;
  access_facts: string[];
};

export type WorldWikiReading = {
  profile: string;
  wiki_ref: string | null;
  source: unknown;
  federates: string[];
};

export type WorldGroundReading = {
  native_owner: string;
  contract: string;
  path: unknown;
  present: boolean;
  owner_world_ref: string | null;
};

export type WorldTreeNodeModel = ReadingRef & {
  depth: number;
  parent_ref: string | null;
  ground: WorldGroundReading | null;
  wiki: WorldWikiReading | null;
  sources: WorldSourceReading[];
  access: AccessFacts;
  access_facts: string[];
  children: WorldTreeNodeModel[];
};

export type WorldTreeModel = {
  schema: string;
  provider: { class: string; seam: string; detail: unknown };
  warnings: string[];
  root: WorldTreeNodeModel | null;
  nodes: WorldTreeNodeModel[];
  summary: { projects: number; sources: number; wikis: number; grounds: number };
};

/** `oi.world-tree/v1` as `world_tree` returns it. */
export type WorldTreeReading = {
  schema: string;
  root?: unknown;
  provider?: { class?: string; seam?: string; detail?: unknown };
  warnings?: unknown;
};

/** `oi.composition-reading/v1` as `composition_reading` returns it. */
export type CompositionReading = {
  schema: string;
  condition?: string;
  constituents?: unknown;
  warnings?: unknown;
};

export type CompositionConstituentModel = {
  native_owner: string;
  state: string;
  state_word: string;
  provider_class: string;
  capabilities: string[];
  detail: unknown;
};

export type CompositionModel = {
  schema: string;
  condition: string;
  constituents: CompositionConstituentModel[];
  warnings: string[];
  counts: { present: number; degraded: number; absent: number };
};

/** `oi.subject-reading/v1` as `open_subject` returns it. */
export type SubjectReading = {
  schema: string;
  subject?: unknown;
  access?: unknown;
  source?: unknown;
  content?: unknown;
  revision?: unknown;
  provider?: { class?: string; seam?: string; detail?: unknown };
  warnings?: unknown;
};

export type SubjectModel = {
  schema: string;
  subject: ReadingRef | null;
  access: AccessFacts;
  access_facts: string[];
  source: WorldSourceReading | null;
  content: string | null;
  revision: string | number | null;
  provider: { class: string; seam: string; detail: unknown };
  warnings: string[];
};

/** A `SemanticRef` the tree hands to the kernel's select/open operation. */
export type TreeSubjectRef = {
  ref: string;
  kind: string;
  native_owner: string;
  provenance: { source: string; revision?: string };
};

/** The kernel focus relation, narrowed to the refs the tree compares. */
export type TreeFocus = {
  world?: { ref?: string } | null;
  project?: { ref?: string } | null;
  subject?: { ref?: string } | null;
} | null;

export function accessFacts(access: unknown): string[];
export function accessFact(access: unknown, fact: string): boolean | undefined;
export function buildWorldTreeModel(reading: WorldTreeReading | unknown): WorldTreeModel | null;
export function focusRefs(focus: TreeFocus): { world: string | null; project: string | null; subject: string | null };
export function nodeIsFocused(node: WorldTreeNodeModel, focus: TreeFocus): boolean;
export function sourceIsFocused(source: WorldSourceReading, focus: TreeFocus): boolean;
export function subjectRefForNode(node: WorldTreeNodeModel): TreeSubjectRef;
export function subjectRefForSource(source: WorldSourceReading, node?: WorldTreeNodeModel): TreeSubjectRef;
export function projectNodeForSource(reading: WorldTreeReading | unknown, sourceRef: string): WorldTreeNodeModel | null;
export function projectNodeOfNode(model: WorldTreeModel, node: WorldTreeNodeModel): WorldTreeNodeModel | null;
export function buildCompositionModel(reading: CompositionReading | unknown): CompositionModel | null;
export function conflictFromFailure(failure: unknown): { source_ref: string; expected_revision: string; current_revision: string } | null;
export function failureReason(failure: unknown): 'conflict' | { reason: string; detail: string } | null;
export function buildSubjectModel(reading: SubjectReading | unknown): SubjectModel | null;
