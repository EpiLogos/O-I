/**
 * Workspace modes — one shell, one pane/tab system, one accompanying panel,
 * curated per mode. A mode never forks the shell: it names which left body the
 * sidebar region shows, which centre surface the mode opens inside the
 * existing Workbench, and which planes the common right panel offers.
 *
 * A mode is presentation state on the workspace's layout (`LayoutState.mode`,
 * absent = "base"). Switching modes never closes surfaces, never restarts an
 * encounter session and never touches the window's one Expression stage: open
 * work, splits, widths and the accompanying binding all ride through.
 */
import type {GlyphName} from "./Glyph";

/** The work modes, in order, with Settings the terminal system entry.
 * Epi-Logos is a WorkspaceMode value only so its curated world (left body,
 * centre, companions) stays defined — it is not in the sidebar strip: as an
 * experience it is a whole-app world state (LayoutState.epiLogos, toggled and
 * displayed in the workspace footer), not a page. O:I Web is deliberately
 * NOT a mode at all: it is the connective field every mode reaches through
 * the one Library (the wiki as the expressions library, the shared wiki web,
 * the local instance nested in it as a subset) — see library/scope.ts. */
export type WorkspaceMode = "base" | "factory" | "expressions" | "techne" | "epi-logos" | "settings";
export const WORKSPACE_MODES: readonly WorkspaceMode[] = ["base", "factory", "expressions", "techne", "epi-logos", "settings"] as const;

/** How a pane presents its tabs — the pin model. Pinned horizontal shows the
 * strip along the pane's top; pinned vertical shows a resizable list beside
 * the surface body; unpinned folds the tabs to a slim reveal edge that opens
 * on approach — the one hiding law, using the workspace footer's reveal
 * grammar (cradle.css; the geometry it returns in is LayoutState's
 * `tabPinOrientation`, the orientation the pane was last pinned in). */
export type TabPresentation = "pinned-horizontal" | "pinned-vertical" | "unpinned";
export const TAB_PRESENTATIONS: readonly TabPresentation[] = ["pinned-horizontal", "pinned-vertical", "unpinned"] as const;

/** The pinned-vertical tab list's width bounds (px). Every write goes through
 * `clampTabListWidth`; the store's load path clamps on restore. */
export const TAB_LIST_WIDTH_MIN = 120;
export const TAB_LIST_WIDTH_MAX = 320;
export const clampTabListWidth = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(Math.max(TAB_LIST_WIDTH_MIN, Math.min(TAB_LIST_WIDTH_MAX, value))) : undefined;

/** A layout saved under the old three-state cycle upgrades on load:
 * "strip" → pinned horizontal (written as the absent default), "list" →
 * pinned vertical, "hidden" → unpinned. Names of the pin model pass through;
 * anything else is dropped, never guessed (the store's load path applies
 * this to the raw record before persist.ts's codec reads it). */
export const upgradeTabPresentation = (value: unknown): TabPresentation | undefined => {
  if (value === "list") return "pinned-vertical";
  if (value === "hidden") return "unpinned";
  if (value === "strip") return undefined;
  return TAB_PRESENTATIONS.includes(value as TabPresentation) ? value as TabPresentation : undefined;
};

/** The panel's BUILT-IN plane names — the planes whose bodies the panel
 * itself owns (`AgentLayer`). A curation's `planes` may interleave these with
 * composition-root ids; anything outside this set must be listed in `extra`
 * to render at all. */
export type PanelPlane = "Chat" | "Activity" | "Context" | "Inspect" | "Composition";
/** `factory`: Factory's left body — a project-rooted navigator with the same
 * two-way split the World navigator gives a project (Files | Tasks): the
 * chosen project's folder tree, and its tasks — the sessions and chats the
 * conversation in the centre passes through. Owner direction 2026-09-18:
 * Factory centralises the chat; the left stays focused on one project. */
export type LeftBody = "world" | "expression-graph" | "material" | "epi-places" | "factory" | "wiki-map";

export interface ModeCuration {
  id: WorkspaceMode;
  label: string;
  /** One line for the switch's tooltip and the panel's situating line. */
  hint: string;
  glyph: GlyphName;
  left: LeftBody;
  /** The surface kind this mode opens (or focuses) in the centre when entered
   * with no such surface open. Absent: the mode keeps whatever is open. */
  centreKind?: "factory" | "expressions" | "techne" | "epi-logos" | "system";
  /** "surface": the entrance opens its centre surface in the CURRENT mode's
   * tree instead of standing on a tree of its own. Settings is the one such
   * entrance — the terminal system entry, consulted beside the work it
   * configures (and the sidebar's System control the walks already pin). */
  entrance?: "surface";
  panel: {
    /** The panel head's name for the accompanying agent in this mode. */
    agent: string;
    /** The ONE plane strip, in the mode's own order — built-in planes
     * ("Chat"…, whose bodies the panel owns) and composition-root ids
     * interleaved exactly as the mode curates them. The first is the mode's
     * resting plane. */
    planes: readonly string[];
    /** Which of `planes` are composition-root-supplied ids: the gate that
     * keeps a named id from rendering an empty host when the composition
     * root supplied no body for it. */
    extra: readonly string[];
    /** Factory relocates the conversation to the centre: the panel then
     * offers no Conversation plane of its own, and never a second composer. */
    conversationInCentre?: boolean;
  };
}

export const MODE_CURATION: Record<WorkspaceMode, ModeCuration> = {
  base: {
    id: "base", label: "Central", hint: "The Central ground itself — files, editor and the accompanying agent", glyph: "file", left: "world",
    // Owner direction 2026-09-19: the Central panel takes the same core shape
    // as the other modes — Chat, Run, Agents, Context — with Run and Agents
    // the shared planes (the same run log/track; the roster with the real
    // project conversations). Context stays the panel's own doc-forward
    // subject/session reading: the canvas pane belongs to the centre in this
    // mode, never to the sidebar. Activity folds into Run's live log (the
    // same consolidation Factory made); Inspect stays an action
    // (oi:panel-inspect) and the Expression summon visits Composition —
    // neither is a tab.
    panel: {agent: "Agent", planes: ["Chat", "run", "agents", "Context"], extra: ["run", "agents"]},
  },
  factory: {
    id: "factory", label: "Factory", hint: "Desk for whole Runs, Tasks for conversations", glyph: "factory", left: "factory", centreKind: "factory",
    // The Factory centre (FACTORY-UI-INTEGRATION-HANDOFF §11, 2026-09-18):
    // Desk is whole-Run-first — the live cross-project Run board, then the
    // full SSSF view of the selected Run; Tasks is chat-first — the
    // full-size working chat over the shared conversation primitives. The
    // left navigator's two entries choose between them. The sidebar is
    // exactly three top-level tabs — Run (status, decisions, steps,
    // trajectory, checks), Agents (roster, teams, skills, capabilities,
    // routines, setup), Context (sources, produced, Needs you) — and its Run
    // subject follows the work actually selected or bound in either view.
    // Inspect stays reachable as an action through oi:panel-inspect, never a
    // fourth tab.
    panel: {agent: "Factory agent", planes: ["run", "agents", "factory-context"], extra: ["run", "agents", "factory-context"], conversationInCentre: true},
  },
  expressions: {
    id: "expressions", label: "Expressions", hint: "The living Expressions application, with Anima / Nara", glyph: "field", left: "expression-graph", centreKind: "expressions",
    // Owner direction 2026-09-18, second pass: the chat is one side, and one
    // icon turns to the other — exactly three views, Run / Agents / Context,
    // whose content is the Ta-Onta specifics of the Anima mode (S4').
    // Anima, Aletheia and the project guardians read in Agents; Run passes
    // through the same run log/track as Factory; Context holds real panes.
    panel: {agent: "Anima", planes: ["Chat", "ta-run", "ta-onta-agents", "ta-onta-context"], extra: ["ta-run", "ta-onta-agents", "ta-onta-context"]},
  },
  techne: {
    // Owner direction 2026-09-18: the left body is the wiki map — the web
    // as its project's own regions, not a file listing. The panel follows
    // the same three views as Expressions, for the Aletheia mode (S5').
    id: "techne", label: "Technè", hint: "The same living field, the deep cut — with Epii", glyph: "instrument", left: "wiki-map", centreKind: "techne",
    panel: {agent: "Aletheia", planes: ["Chat", "ta-run", "ta-onta-agents", "ta-onta-context"], extra: ["ta-run", "ta-onta-agents", "ta-onta-context"]},
  },
  "epi-logos": {
    id: "epi-logos", label: "Epi-Logos", hint: "The authored world: the essay, Bimba, the Epii material, the products", glyph: "wiki", left: "epi-places", centreKind: "epi-logos",
    // Nara/Anima is the personal encounter, Epii the deep inquiry — the same
    // companion components, curated to this world.
    panel: {agent: "Nara · Epii", planes: ["Chat", "Context", "Inspect", "anima", "epii"], extra: ["anima", "epii"]},
  },
  settings: {
    id: "settings", label: "Settings", hint: "System: sources, providers, projection, telemetry, search, history", glyph: "settings", left: "world", centreKind: "system",
    panel: {agent: "Agent", planes: ["Chat", "Context", "Inspect"], extra: []},
  },
};

/** The modes in the sidebar strip. Owner ruling 2026-09-18: Epi-Logos is NOT
 * a mode entry — it is a whole-app world state (LayoutState.epiLogos,
 * displayed and toggled in the workspace footer). Settings is the terminal
 * system entry and switches instantly like any other mode. */
export const TREE_MODES: readonly WorkspaceMode[] = WORKSPACE_MODES.filter(mode => mode !== "epi-logos");
/** The icons the sidebar strip carries: the four work modes only. Settings is
 * the separate terminal button beside them (never a second settings icon in
 * the strip), and Epi-Logos lives in the footer as the whole-app world state. */
export const STRIP_MODES: readonly WorkspaceMode[] = TREE_MODES.filter(mode => mode !== "settings");
export const isWorkspaceMode = (value: unknown): value is WorkspaceMode => WORKSPACE_MODES.includes(value as WorkspaceMode);
/** Runtime behaviour: true only for the pin-model names. The declared
 * narrowing carries the legacy default name "strip" as well, so persist.ts's
 * codec can keep its own normalization of that name (`!== "strip"`) while the
 * store's load path translates it (upgradeTabPresentation); nothing else may
 * rely on the wider claim. */
export const isTabPresentation = (value: unknown): value is TabPresentation | "strip" => TAB_PRESENTATIONS.includes(value as TabPresentation);
