/**
 * Read-only ql.techne/v1 compatibility transport (lane T2-transport).
 *
 * `createTechneTransport(bundle)` serves the WorkspaceTransport read methods
 * the five Research Canvas lenses consume, backed entirely by a
 * `TechneFieldBundle` from `bundleFromTechneReadings` — there is no
 * Neo4j/SQLite substrate behind it, and nothing a surface reads here becomes
 * canonical (Wayfinder §12: the bridge is for adaptation, not a second
 * business layer).
 *
 * Served reads:
 *   - loadCanvasView (canvas and timeline lens) over each reading's bounded
 *     local whole (`techne:canvas:<reading_ref>`);
 *   - loadTimelineView / loadTimelineRelationField / expandTimelineNode over
 *     the bundle's temporal anchors under workspaceId `techne:field-bundle:v1`;
 *   - readGraphNode / findGraphNode / searchGraph (ids are the native refs);
 *   - the Places located-node read via `listLocatedGraphNodes` — this
 *     transport's single extension beyond WorkspaceTransport, mirroring the
 *     substrate's `list_located_graph_nodes_command` for Surface #3;
 *   - listScenes / getScene / listSceneSequences from the bundle's stubs;
 *   - listStreetViewImages and listGeographyEdges as honest empties (a
 *     reading discloses neither captured imagery nor movement streams);
 *   - loadPalaceGraph (encapsulation edges stay empty — provider relations
 *     are never relabelled into ENCAPSULATES);
 *   - archetypalLighting / resonancesForInstance (a reading discloses no
 *     archetypal lighting index, so instances/resonances are empty);
 *   - loadAppTabs (no persisted tabs).
 *
 * Every other method — all semantic mutations (create/update/delete/
 * compare-and-swap graph records, connect/disconnect, scene upserts, saved
 * sequences, fetch ingestion, attachments, palace curation, app tabs, …) —
 * rejects with the static transport's read-only error style.
 *
 * Layout upserts (upsertNodeLayout, upsertNodeLayouts, upsertEdgeLayout,
 * upsertCanvasAppState, upsertTimelineLayout) are ACCEPT-AND-HOLD: layout is
 * kept in memory on this transport instance only, so a switch between
 * surfaces does not lose placement during a session. They never persist to
 * any store, never touch the semantic node/relationship records, and are
 * discarded when the transport instance is dropped.
 */

import type {
  ArchetypalLighting,
  CanvasView,
  EdgeLayout,
  ExpandedTimelineNode,
  GraphNode,
  GraphRelationship,
  JoinedCanvasNode,
  LitInstance,
  NodeLayout,
  TimelineDiagnostic,
  TimelineLayoutOverride,
  TimelineLayoutMutationResult,
  TimelineViewNode,
} from "./graph";
import type { WorkspaceTransport } from "./index";
import { TECHNE_WORKSPACE_ID, type TechneFieldBundle } from "./techneBundle";

export const TECHNE_READ_ONLY_MESSAGE = "read-only techne transport";

/**
 * The techne transport is a WorkspaceTransport plus the Places located-node
 * read. Assignable anywhere a WorkspaceTransport is expected.
 */
export type TechneWorkspaceTransport = WorkspaceTransport & {
  /** Nodes carrying a Temporal Place projection (Surface #3 base read). */
  listLocatedGraphNodes(): Promise<GraphNode[]>;
  /** The bundle this transport serves; diagnostics included for surfaces. */
  readonly bundle: TechneFieldBundle;
};

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

function defaultLayoutFor(graphNodeId: string, canvasId: string): NodeLayout {
  // Deterministic auto-placement, mirroring the static bundle transport, so
  // every reading node surfaces even though a reading discloses no layout.
  let hash = 0;
  for (let i = 0; i < graphNodeId.length; i += 1) {
    hash = (hash * 31 + graphNodeId.charCodeAt(i)) >>> 0;
  }
  const column = hash % 6;
  const row = Math.floor(hash / 6) % 6;
  return {
    graphNodeId,
    canvasId,
    positionX: 80 + column * 320,
    positionY: 80 + row * 220,
    width: 240,
    height: 160,
    style: {},
  };
}

function matchesFilter<T>(value: T | null, filter?: { include?: T[]; exclude?: T[] }): boolean {
  const included = !filter?.include?.length || (value !== null && filter.include.includes(value));
  return included && !(value !== null && filter?.exclude?.includes(value));
}

function techneTimelineYear(value: string | null): number | null {
  if (!value) return null;
  const match = /^(-?\d{1,6})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

export function createTechneTransport(bundle: TechneFieldBundle): TechneWorkspaceTransport {
  if (bundle.workspaceId !== TECHNE_WORKSPACE_ID) {
    throw new Error(`techne bundle workspaceId mismatch: expected ${TECHNE_WORKSPACE_ID}`);
  }

  const nodeById = new Map(bundle.nodes.map((node) => [node.graphNodeId, node]));
  const relationshipsByCanvas = new Map<string, GraphRelationship[]>();
  for (const canvas of bundle.canvases) {
    const rels = canvas.relationshipIds
      .map((id) => bundle.relationships.find((relationship) => relationship.id === id))
      .filter((relationship): relationship is GraphRelationship => relationship !== undefined);
    relationshipsByCanvas.set(canvas.canvasId, rels);
  }
  const canvasById = new Map(bundle.canvases.map((canvas) => [canvas.canvasId, canvas]));
  const temporalNodes = bundle.nodes.filter((node) => node.isTemporal);

  // ---- accept-and-hold layout state (memory only; never persisted) ----
  const heldNodeLayouts = new Map<string, Map<string, NodeLayout>>();
  const heldEdgeLayouts = new Map<string, Map<string, EdgeLayout>>();
  const heldViewports = new Map<string, { x: number; y: number; zoom: number }>();
  const heldAppStates = new Map<string, Record<string, unknown>>();
  const heldTimelineLayouts = new Map<string, TimelineLayoutOverride>();

  const readOnlyReject = () => Promise.reject(new Error(TECHNE_READ_ONLY_MESSAGE));
  const readOnlyThrow = (): never => {
    throw new Error(TECHNE_READ_ONLY_MESSAGE);
  };
  const emptyTabs = (): Promise<{ tabs: never[]; activeTabId: null }> =>
    Promise.resolve({ tabs: [], activeTabId: null });

  const assertWorkspace = (workspaceId: string) => {
    if (workspaceId.trim() === "" || workspaceId !== TECHNE_WORKSPACE_ID) {
      throw new Error(`workspaceId does not match techne bundle: expected ${TECHNE_WORKSPACE_ID}`);
    }
  };

  /**
   * The converter guarantees well-formed anchors; the diagnostics channel is
   * kept so a malformed bundle degrades honestly instead of silently.
   */
  const timelineProjection = (): { nodes: TimelineViewNode[]; diagnostics: TimelineDiagnostic[] } => {
    const nodes: TimelineViewNode[] = [];
    const diagnostics: TimelineDiagnostic[] = [];
    for (const node of temporalNodes) {
      if (typeof node.validFrom !== "string" || node.temporalPrecision === null) {
        diagnostics.push({
          graphNodeId: node.graphNodeId,
          code: "invalid_temporal_anchor",
          message: "techne temporal anchor is missing its instant or precision",
          validFrom: node.validFrom,
          validTo: node.validTo,
        });
        continue;
      }
      nodes.push({
        node,
        anchor: {
          validFrom: node.validFrom,
          validTo: node.validTo,
          precision: node.temporalPrecision,
        },
        layoutOverride: heldTimelineLayouts.get(node.graphNodeId) ?? null,
      });
    }
    return { nodes, diagnostics };
  };

  const temporalRelationships = () =>
    bundle.relationships.filter((relationship) =>
      nodeById.get(relationship.sourceGraphNodeId)?.isTemporal === true
      && nodeById.get(relationship.targetGraphNodeId)?.isTemporal === true,
    );

  const rangeIntersects = (node: GraphNode, range: { startYear: number; endYear: number }) => {
    const fromYear = techneTimelineYear(node.validFrom);
    const toYear = techneTimelineYear(node.validTo) ?? fromYear;
    if (fromYear === null || toYear === null) return true;
    return fromYear <= range.endYear && toYear >= range.startYear;
  };

  return {
    bundle,

    // ---- workspace/constellation/file methods: not served by a techne bundle ----
    attachConstellationResourceRoot: readOnlyReject,
    bootstrapWorkspace: readOnlyReject,
    selectProject: readOnlyReject,
    resolveOrCreateHome: readOnlyReject,
    createProject: readOnlyReject,
    detachConstellationResourceRoot: readOnlyReject,
    listConstellationResourceRoots: readOnlyReject,
    loadConstellationDocument: readOnlyReject,
    flushConstellationDocument: readOnlyThrow,
    persistConstellationDocument: readOnlyReject,
    searchConstellation: readOnlyReject,
    listDirectories: readOnlyReject,
    listSavedSequences: readOnlyReject,
    createSavedSequence: readOnlyReject,
    updateSavedSequence: readOnlyReject,
    deleteSavedSequence: readOnlyReject,

    // ---- scenes: reads from the bundle, mutations rejected ----
    async listScenes() {
      return bundle.scenes;
    },
    async listSceneSequences() {
      return bundle.sceneSequences;
    },
    async getScene({ id }) {
      return bundle.scenes.find((scene) => scene.id === id) ?? null;
    },
    upsertScene: readOnlyReject,
    upsertSceneSequence: readOnlyReject,
    deleteScene: readOnlyReject,
    deleteSceneSequence: readOnlyReject,

    // ---- street-view imagery: a reading discloses none ----
    async listStreetViewImages() {
      return [];
    },
    registerStreetViewImage: readOnlyReject,
    stageStreetViewImage: readOnlyReject,
    addManualStreetViewRegion: readOnlyReject,
    applyStreetViewRedaction: readOnlyReject,
    markStreetViewRedactionNoneNeeded: readOnlyReject,

    // ---- geography edges: a reading discloses no movement streams ----
    async listGeographyEdges() {
      return [];
    },
    upsertGeographyEdge: readOnlyReject,
    deleteGeographyEdge: readOnlyReject,

    // ---- fetch records / keepsake / palace curation: not served ----
    listFetchRecords: readOnlyReject,
    ingestFetchedAsset: readOnlyReject,
    writeKeepsakeBundle: readOnlyReject,
    loadPalaceCuration: readOnlyReject,
    savePalaceCuration: readOnlyReject,
    writePalaceBundle: readOnlyReject,

    // ---- substance reads ----
    async readGraphNode({ graphNodeId }) {
      const node = nodeById.get(graphNodeId);
      if (!node) {
        throw new Error(`graph node not found: ${graphNodeId}`);
      }
      return node;
    },
    async findGraphNode({ graphNodeId }) {
      return nodeById.get(graphNodeId) ?? null;
    },
    async searchGraph({ query, limit }) {
      const needle = query.trim().toLowerCase();
      if (needle === "") {
        return [];
      }
      // Node titles ARE the native refs, so ref fragments are searchable.
      const hits = bundle.nodes.filter((node) =>
        `${node.title}\n${node.summary}\n${node.graphNodeId}`
          .toLowerCase()
          .includes(needle),
      );
      return typeof limit === "number" ? hits.slice(0, limit) : hits;
    },

    // ---- Places located-node read (transport extension for Surface #3) ----
    async listLocatedGraphNodes() {
      return bundle.nodes.filter((node) => node.place !== null);
    },

    // ---- joined reads ----
    async loadCanvasView({ canvasId, lens }): Promise<CanvasView> {
      const canvas = canvasById.get(canvasId);
      if (!canvas) {
        throw new Error(
          `unknown techne canvas: ${canvasId} (expected one of ${bundle.canvases
            .map((entry) => entry.canvasId)
            .join(", ")})`,
        );
      }
      const heldForCanvas = heldNodeLayouts.get(canvasId);
      const relationships = relationshipsByCanvas.get(canvasId) ?? [];
      const nodes: GraphNode[] = canvas.nodeIds.flatMap((id) => {
        const node = nodeById.get(id);
        return node ? [node] : [];
      });
      const visible = lens === "timeline" ? nodes.filter((node) => node.isTemporal) : nodes;
      const joined: JoinedCanvasNode[] = visible.map((node) => ({
        node,
        layout:
          heldForCanvas?.get(node.graphNodeId) ?? defaultLayoutFor(node.graphNodeId, canvasId),
      }));
      const edges: EdgeLayout[] = relationships.map((relationship) => ({
        id: relationship.id,
        canvasId,
        sourceGraphNodeId: relationship.sourceGraphNodeId,
        targetGraphNodeId: relationship.targetGraphNodeId,
        // Provider relation vocabulary, verbatim.
        relationKind: relationship.relType,
        style: {},
      }));
      return {
        canvasId,
        nodes: joined,
        edges,
        relationships,
        viewport: heldViewports.get(canvasId) ?? DEFAULT_VIEWPORT,
        appState: heldAppStates.get(canvasId) ?? {},
      };
    },

    async loadTimelineView({ workspaceId, filters, range }) {
      assertWorkspace(workspaceId);
      const { nodes, diagnostics } = timelineProjection();
      const filtered = nodes.filter(({ node }) =>
        matchesFilter(node.entityType, filters?.entityTypes)
        && matchesFilter(node.historicity, filters?.historicities)
        && matchesFilter(node.temporalRole, filters?.temporalRoles)
        && (!range || rangeIntersects(node, range)),
      );
      return {
        workspaceId: TECHNE_WORKSPACE_ID,
        nodes: filtered,
        relationships: temporalRelationships(),
        lanes: [],
        diagnostics,
      };
    },

    async loadTimelineRelationField({ workspaceId, graphNodeId }) {
      assertWorkspace(workspaceId);
      const relationships = bundle.relationships.filter(
        (relationship) =>
          relationship.sourceGraphNodeId === graphNodeId
          || relationship.targetGraphNodeId === graphNodeId,
      );
      const contextualNodes = [
        ...new Set(
          relationships.flatMap((relationship) => [
            relationship.sourceGraphNodeId,
            relationship.targetGraphNodeId,
          ]),
        ),
      ]
        .filter((id) => id !== graphNodeId)
        .flatMap((id) => {
          const node = nodeById.get(id);
          return node ? [node] : [];
        });
      return { subjectGraphNodeId: graphNodeId, relationships, contextualNodes };
    },

    async expandTimelineNode({ workspaceId, graphNodeId }): Promise<ExpandedTimelineNode> {
      assertWorkspace(workspaceId);
      const subject = nodeById.get(graphNodeId);
      if (!subject) {
        throw new Error(`graph node not found: ${graphNodeId}`);
      }
      const edges = bundle.relationships.filter(
        (relationship) =>
          relationship.sourceGraphNodeId === graphNodeId
          || relationship.targetGraphNodeId === graphNodeId,
      );
      const neighbours = [
        ...new Set(
          edges.flatMap((relationship) => [
            relationship.sourceGraphNodeId,
            relationship.targetGraphNodeId,
          ]),
        ),
      ]
        .filter((id) => id !== graphNodeId)
        .flatMap((id) => {
          const node = nodeById.get(id);
          return node ? [node] : [];
        });
      return { subjectGraphNodeId: graphNodeId, subject, edges, neighbours };
    },

    async loadPalaceGraph({ workspaceId }) {
      assertWorkspace(workspaceId);
      return {
        workspaceId: TECHNE_WORKSPACE_ID,
        nodes: timelineProjection().nodes,
        relationships: temporalRelationships(),
        // Provider relations are never relabelled, so a reading yields no
        // ENCAPSULATES edges; the palace lens degrades honestly to an empty
        // encapsulation set.
        encapsulationEdges: bundle.relationships.filter(
          (relationship) => relationship.relType === "ENCAPSULATES",
        ),
      };
    },

    async upsertTimelineLayout(input): Promise<TimelineLayoutMutationResult> {
      assertWorkspace(input.workspaceId);
      const current = heldTimelineLayouts.get(input.graphNodeId) ?? null;
      if (
        input.expectedRevision !== null
        && input.expectedRevision !== (current?.layoutRevision ?? null)
      ) {
        return {
          status: "conflict",
          layout: current,
          reason: `layout revision mismatch: expected ${input.expectedRevision}, current ${current?.layoutRevision ?? null}`,
        };
      }
      const layout: TimelineLayoutOverride = {
        lane: input.lane,
        offsetY: input.offsetY,
        width: input.width,
        height: input.height,
        style: input.style,
        layoutRevision: current ? current.layoutRevision + 1 : 0,
      };
      heldTimelineLayouts.set(input.graphNodeId, layout);
      return { status: current ? "updated" : "created", layout };
    },

    // ---- two-lens / archetypal lighting: no index in a reading ----
    async archetypalLighting({ operatorGraphNodeId }): Promise<ArchetypalLighting> {
      const operator = nodeById.get(operatorGraphNodeId);
      if (!operator) {
        throw new Error(`operator node not found: ${operatorGraphNodeId}`);
      }
      const instances: LitInstance[] = [];
      return { operator, instances };
    },
    async resonancesForInstance(): Promise<LitInstance[]> {
      return [];
    },

    // ---- content / image import: not served ----
    importNodeImage: readOnlyReject,
    attachNodeAttachment: readOnlyReject,
    readNodeAttachmentPresentation: readOnlyReject,

    // ---- agent activity: not part of a reading ----
    listAgentActivity: readOnlyReject,

    // ---- local node document: no local store behind this transport ----
    readLocalNodeDocument: readOnlyReject,
    listPendingNodeDocumentSyncs: readOnlyReject,
    upsertLocalNodeDocument: readOnlyReject,
    acknowledgeLocalNodeDocumentSync: readOnlyReject,

    // ---- global tabs: nothing persisted ----
    loadAppTabs: emptyTabs,
    saveAppTabs: readOnlyReject,

    // ---- mutations: structurally forbidden on the techne bridge ----
    createGraphNode: readOnlyReject,
    updateGraphNode: readOnlyReject,
    compareAndSwapGraphNodeContent: readOnlyReject,
    deleteGraphNode: readOnlyReject,
    connectGraphNodes: readOnlyReject,
    disconnectGraphNodes: readOnlyReject,

    // ---- layout upserts: accept-and-hold in memory only (see header) ----
    async upsertNodeLayout({ layout }) {
      const byNode = heldNodeLayouts.get(layout.canvasId) ?? new Map<string, NodeLayout>();
      byNode.set(layout.graphNodeId, layout);
      heldNodeLayouts.set(layout.canvasId, byNode);
    },
    async upsertNodeLayouts({ canvasId, layouts }) {
      const byNode = heldNodeLayouts.get(canvasId) ?? new Map<string, NodeLayout>();
      for (const layout of layouts) {
        byNode.set(layout.graphNodeId, layout);
      }
      heldNodeLayouts.set(canvasId, byNode);
      return layouts.length;
    },
    async upsertEdgeLayout({ layout }) {
      const byEdge = heldEdgeLayouts.get(layout.canvasId) ?? new Map<string, EdgeLayout>();
      byEdge.set(layout.id, layout);
      heldEdgeLayouts.set(layout.canvasId, byEdge);
    },
    async upsertCanvasAppState({ canvasId, viewport, appState }) {
      heldViewports.set(canvasId, viewport);
      heldAppStates.set(canvasId, appState);
    },
    flushCanvasLayout: readOnlyThrow,
  };
}

