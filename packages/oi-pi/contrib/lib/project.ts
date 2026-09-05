// Observatory assembly: collect live native-owner state, then project it into
// one view that is consumable by a human (the Pi TUI) and by an Agent (the
// structured `agentProjection`) from the *same* refs.

import {
  AIKIT_BIN,
  CTRL_BIN,
  OI_BIN,
  parseAikit,
  parseJson,
  provenanceOf,
  runNative,
} from "./native.ts";
import type { NativeResult } from "./native.ts";
import { buildCensus } from "./census.ts";
import {
  deriveAttention,
  notificationFromFailure,
  notificationFromInboxRow,
} from "./attention.ts";
import {
  classifyActivation,
  defineSurfaceContribution,
  proveLifecycle,
} from "./component-surface.ts";
import type { ObservatorySection, ObservatoryView } from "./model.ts";

// ---------------------------------------------------------------------------
// Live collection
// ---------------------------------------------------------------------------

export interface CollectedCommand {
  name: string;
  result: NativeResult;
}

export function collectLiveState(): CollectedCommand[] {
  const commands: Array<[string, string, string[]]> = [
    ["oi-status", OI_BIN, ["status", "--json"]],
    ["oi-verify", OI_BIN, ["verify", "--json"]],
    ["ctrl-doctor", CTRL_BIN, ["doctor", "--json"]],
    ["aikit-status", AIKIT_BIN, ["status", "--json"]],
    ["aikit-tree", AIKIT_BIN, ["tree", "--all", "--json"]],
    ["aikit-capabilities", AIKIT_BIN, ["capabilities", "list", "--json"]],
    ["aikit-recent", AIKIT_BIN, ["recent", "--json"]],
    ["aikit-failures", AIKIT_BIN, ["failures", "--json"]],
    ["aikit-bypasses", AIKIT_BIN, ["bypasses", "--json"]],
    ["aikit-context", AIKIT_BIN, ["context", "current", "--json"]],
    ["aikit-sessions", AIKIT_BIN, ["session", "list", "--json"]],
    ["aikit-mux", AIKIT_BIN, ["mux", "detect", "--json"]],
    ["aikit-stats", AIKIT_BIN, ["stats", "--json"]],
  ];
  return commands.map(([name, bin, args]) => ({
    name,
    result: runNative(bin, args),
  }));
}

// ---------------------------------------------------------------------------
// Raw shapes
// ---------------------------------------------------------------------------

interface OiStatus {
  installed?: { products?: Record<string, { revision?: string; executable?: string; root?: string }> };
  surfaces?: Array<Record<string, unknown>>;
}
interface OiVerify {
  ok?: boolean;
  checks?: Array<{ product?: string; ok?: boolean }>;
  physical_acceptance?: boolean;
}
interface CtrlDoctor {
  ok?: boolean;
  data?: { root?: string; valid?: boolean };
}
interface AikitStatus {
  data?: {
    active?: Array<{ id: string; kind?: string; name?: string; exports?: string[] }>;
    active_count?: number;
    hash?: string;
    isolation?: string;
  };
}
interface AikitTree {
  data?: { rows?: Array<{ path: string; summary: string }> };
}
interface AikitCapabilities {
  data?: { commands?: unknown[] };
}
interface AikitRecent {
  data?: {
    count?: number;
    events?: Array<{
      event_id?: string;
      action?: string;
      outcome?: string;
      capability?: string | null;
      session?: string | null;
      session_name?: string | null;
      mux?: string | null;
      state?: string | null;
      at?: string;
    }>;
  };
}
interface AikitFailures {
  data?: { count?: number; failures?: unknown[] };
}
interface AikitBypasses {
  data?: { bypasses?: unknown[] };
}
interface AikitContext {
  data?: {
    context_id?: string;
    host?: string;
    isolation?: string;
    mux?: string | null;
    project_root?: string | null;
    session_id?: string | null;
    targets?: string[];
  };
}
interface AikitSessions {
  data?: { count?: number; sessions?: Array<{ name?: string; state?: string; mux?: string }> };
}
interface AikitMux {
  data?: { active?: string; active_stack?: string[] };
}
interface AikitStats {
  data?: { catalogued?: number; events?: number; active?: number };
}

export interface LiveStateInput {
  oiStatus?: OiStatus | null;
  oiVerify?: OiVerify | null;
  ctrlDoctor?: CtrlDoctor | null;
  aikitStatus?: AikitStatus | null;
  aikitTree?: AikitTree | null;
  aikitCapabilities?: AikitCapabilities | null;
  aikitRecent?: AikitRecent | null;
  aikitFailures?: AikitFailures | null;
  aikitBypasses?: AikitBypasses | null;
  aikitContext?: AikitContext | null;
  aikitSessions?: AikitSessions | null;
  aikitMux?: AikitMux | null;
  aikitStats?: AikitStats | null;
}

export function collectInputs(collected: CollectedCommand[]): LiveStateInput {
  const byName = new Map(collected.map((item) => [item.name, item.result]));
  const aikit = (name: string) =>
    parseAikit<unknown>(byName.get(name) ?? { exitCode: -1 } as NativeResult);
  return {
    oiStatus: parseJson<OiStatus>(byName.get("oi-status") ?? { exitCode: -1 } as NativeResult),
    oiVerify: parseJson<OiVerify>(byName.get("oi-verify") ?? { exitCode: -1 } as NativeResult),
    ctrlDoctor: parseJson<CtrlDoctor>(byName.get("ctrl-doctor") ?? { exitCode: -1 } as NativeResult),
    aikitStatus: aikit("aikit-status") as AikitStatus | null,
    aikitTree: aikit("aikit-tree") as AikitTree | null,
    aikitCapabilities: aikit("aikit-capabilities") as AikitCapabilities | null,
    aikitRecent: aikit("aikit-recent") as AikitRecent | null,
    aikitFailures: aikit("aikit-failures") as AikitFailures | null,
    aikitBypasses: aikit("aikit-bypasses") as AikitBypasses | null,
    aikitContext: aikit("aikit-context") as AikitContext | null,
    aikitSessions: aikit("aikit-sessions") as AikitSessions | null,
    aikitMux: aikit("aikit-mux") as AikitMux | null,
    aikitStats: aikit("aikit-stats") as AikitStats | null,
  };
}

// ---------------------------------------------------------------------------
// Pure assembly
// ---------------------------------------------------------------------------

function section(key: string, title: string, semantic: string[], raw: unknown, provenance: string[]): ObservatorySection {
  return {
    key,
    title,
    semantic,
    raw: JSON.stringify(raw ?? null, null, 2),
    provenance,
  };
}

export function assembleObservatory(inputs: LiveStateInput): ObservatoryView {
  const status = inputs.aikitStatus?.data;
  const tree = inputs.aikitTree?.data;
  const capabilities = inputs.aikitCapabilities?.data;
  const recent = inputs.aikitRecent?.data;
  const failures = inputs.aikitFailures?.data;
  const bypasses = inputs.aikitBypasses?.data;
  const context = inputs.aikitContext?.data;
  const sessions = inputs.aikitSessions?.data;
  const mux = inputs.aikitMux?.data;
  const stats = inputs.aikitStats?.data;

  const rows = tree?.rows ?? [];
  const events = recent?.events ?? [];
  const active = status?.active ?? [];

  const census = buildCensus({
    treeRows: rows,
    active,
    catalogued: stats?.catalogued ?? rows.filter((row) => row.path.startsWith("registries/")).length,
    events,
  });

  const notifications = [
    ...rows.filter((row) => row.path.startsWith("inbox/")).map(notificationFromInboxRow),
    ...(failures?.failures ?? [])
      .map(notificationFromFailure)
      .filter((n): n is NonNullable<typeof n> => n !== null),
  ];
  const attention = deriveAttention(notifications);

  const contribution = defineSurfaceContribution();
  const selectedRefs = rows
    .filter((row) => row.path.startsWith("sets/") && /projected/.test(row.summary))
    .map((row) => row.path);
  const withheldRefs = rows
    .filter((row) => row.path.startsWith("sets/") && !/projected/.test(row.summary))
    .map((row) => row.path);
  const activeRefs = active.map((capability) => capability.id);
  const classification = classifyActivation({
    activeRefs,
    selectedRefs: selectedRefs,
    withheldRefs: withheldRefs,
    removedRefs: [],
    provenance: ["aikit status --json", "aikit tree --all --json"],
  });
  const lifecycle = proveLifecycle({
    activeRefs,
    selectedRefs,
    withheldRefs,
    removedRefs: [],
    provenance: ["aikit status --json", "aikit tree --all --json"],
  });

  const workcell = inputs.oiStatus?.installed?.products?.["workcell"];
  const runRef =
    sessions?.count != null && sessions.count > 0
      ? `run:${sessions.sessions?.[0]?.name ?? "live"}`
      : `run:${stats?.events ?? 0}`;

  const world = {
    world: "world:self-dev",
    agent: "agent:Epii",
    run: runRef,
    workcell: workcell?.revision
      ? `workcell:local@${workcell.revision.slice(0, 8)}`
      : "workcell:local",
  };

  const evidenceCount =
    (recent?.count ?? 0) + (inputs.oiVerify?.checks?.length ?? 0);

  const sections: ObservatorySection[] = [
    section(
      "activity",
      "Activity",
      events.map((event) => `${event.action ?? "event"} · ${event.outcome ?? "?"} · ${event.capability ?? event.session_name ?? ""}`.trim()),
      recent,
      ["aikit recent --json"],
    ),
    section(
      "context",
      "Context",
      context
        ? [
            `context ${context.context_id ?? "?"} · host ${context.host ?? "?"}`,
            `isolation ${context.isolation ?? "?"} · mux ${context.mux ?? "plain"}`,
            `project ${context.project_root ?? "none"} · session ${context.session_id ?? "none"}`,
            `targets ${(context.targets ?? []).join(", ") || "—"}`,
          ]
        : ["context unavailable"],
      inputs.aikitContext,
      ["aikit context current --json"],
    ),
    section(
      "capabilities",
      "Capabilities",
      [
        `catalogued ${census.totalEligible} · loaded ${census.counts.loaded} · selected ${census.counts.selected}`,
        `granted ${census.counts.granted} · invoked ${census.counts.invoked} · realised ${census.counts.realised}`,
        `surface ${classification.state} — ${classification.reason}`,
      ],
      { status, tree, capabilities },
      ["aikit status --json", "aikit tree --all --json", "aikit capabilities list --json"],
    ),
    section(
      "actions",
      "Actions",
      capabilities
        ? [`brokered commands ${capabilities.commands?.length ?? 0}`]
        : ["actions unavailable"],
      capabilities,
      ["aikit capabilities list --json"],
    ),
    section(
      "runtime",
      "Runtime",
      [
        `sessions ${sessions?.count ?? 0} live`,
        ...(sessions?.sessions ?? []).map((s) => `- ${s.name ?? "?"} [${s.state ?? "?"}] via ${s.mux ?? "?"}`),
        `mux ${mux?.active ?? "plain"} (${(mux?.active_stack ?? []).join(" → ") || "plain"})`,
        `generation ${status?.hash ?? "?"} · isolation ${status?.isolation ?? "?"}`,
      ],
      { sessions, mux, status },
      ["aikit session list --json", "aikit mux detect --json", "aikit status --json"],
    ),
    section(
      "workcell",
      "Workcell",
      [
        `workcell ${workcell?.revision ?? "—"}`,
        `central ground ${inputs.ctrlDoctor?.data?.valid ? "valid" : "?"} @ ${inputs.ctrlDoctor?.data?.root ?? "?"}`,
      ],
      { workcell, ctrlDoctor: inputs.ctrlDoctor },
      ["oi status --json", "ctrl doctor --json"],
    ),
    section(
      "factory-evidence",
      "Factory / Evidence",
      [
        `evidence ${evidenceCount} (recent ${recent?.count ?? 0} · verify checks ${inputs.oiVerify?.checks?.length ?? 0})`,
        `verify ${inputs.oiVerify?.ok ? "ok" : "not-ok"} · physical_acceptance ${inputs.oiVerify?.physical_acceptance ?? false}`,
        `failures ${failures?.count ?? 0}`,
      ],
      { recent, oiVerify: inputs.oiVerify, failures },
      ["aikit recent --json", "oi verify --json", "aikit failures --json"],
    ),
    section(
      "guardians",
      "Guardians",
      [
        `hook chain ${rows.filter((row) => row.path.startsWith("hooks/")).length} rows`,
        `bypasses ${bypasses?.bypasses?.length ?? 0}`,
        ...rows
          .filter((row) => row.path.startsWith("hooks/"))
          .map((row) => `- ${row.summary}`),
      ],
      { bypasses, hooks: rows.filter((row) => row.path.startsWith("hooks/")) },
      ["aikit tree --all --json", "aikit bypasses --json"],
    ),
  ];

  const provenance = [
    "oi status --json",
    "oi verify --json",
    "ctrl doctor --json",
    "aikit status --json",
    "aikit tree --all --json",
    "aikit capabilities list --json",
    "aikit recent --json",
    "aikit failures --json",
    "aikit bypasses --json",
    "aikit context current --json",
    "aikit session list --json",
    "aikit mux detect --json",
    "aikit stats --json",
  ];

  const agentProjection: Record<string, unknown> = {
    schema: "oi.observatory-view/v1",
    world,
    activity: events,
    attention: {
      count: attention.count,
      refs: attention.refs,
      derivedFrom: attention.derivedFrom,
    },
    capabilities: {
      stages: census.counts,
      totalEligible: census.totalEligible,
      entries: census.stages,
    },
    surface: {
      contribution: contribution,
      state: classification.state,
      reason: classification.reason,
    },
    runtime: { sessions: sessions?.sessions ?? [], mux: mux?.active_stack ?? [] },
    evidence: { count: evidenceCount, verifyOk: inputs.oiVerify?.ok ?? null },
  };

  return {
    schema: "oi.observatory-view/v1",
    world,
    activity: events.map((event) => ({
      ref: event.event_id ?? `event/${event.action ?? "unknown"}`,
      action: event.action ?? "event",
      at: event.at ?? "",
      outcome: event.outcome ?? "?",
      capability: event.capability ?? undefined,
      session: event.session ?? undefined,
      sessionName: event.session_name ?? undefined,
      mux: event.mux ?? undefined,
      state: event.state ?? undefined,
    })),
    evidenceCount,
    attention,
    census,
    lifecycle,
    sections,
    provenance,
    agentProjection,
  };
}
