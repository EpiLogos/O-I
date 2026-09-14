// O:I-for-Pi — the Pi-side half of the O:I Self-Development World's human-facing
// Surface. This extension is an O:I Surface contribution, not a Pi-specific
// semantic subsystem: every view is a projection of O:I/AIKit application
// models read from native product processes (`oi`, `aikit`, `ctrl`).

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import {
  assembleObservatory,
  collectInputs,
  collectLiveState,
} from "./lib/project.ts";
import { censusLines } from "./lib/census.ts";
import { makeObservatoryOverlay, makePanel } from "./lib/ui.ts";
import type { OiTheme } from "./lib/ui.ts";
import { executeDetach, planDetach } from "./lib/surfaces.ts";
import type { ObservatoryView } from "./lib/model.ts";

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  activity: "O:I Activity — recent Agent activity from the live activity ledger",
  context: "O:I Context — the live AIKit context binding",
  capabilities: "O:I Capabilities — the live capability census ladder",
  runtime: "O:I Runtime — live sessions and the mux stack",
  evidence: "O:I Evidence — factory/verification evidence and failures",
  guardians: "O:I Guardians — the live hook chain and bypass tokens",
};

const SECTION_TITLES: Record<string, string> = {
  activity: "Activity",
  context: "Context",
  capabilities: "Capabilities",
  runtime: "Runtime",
  "factory-evidence": "Factory / Evidence",
  guardians: "Guardians",
};

export default function oiPiExtension(pi: ExtensionAPI) {
  let snapshot: ObservatoryView | null = null;
  let snapshotError: string | null = null;
  let refreshInFlight = false;
  let widgetTui: { requestRender(): void } | null = null;

  async function refresh(): Promise<void> {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const collected = collectLiveState();
      const inputs = collectInputs(collected);
      snapshot = assembleObservatory(inputs);
      snapshotError = null;
    } catch (error) {
      snapshotError = error instanceof Error ? error.message : String(error);
    } finally {
      refreshInFlight = false;
      widgetTui?.requestRender();
    }
  }

  function worldLine(): string {
    if (!snapshot) return "O:I  …";
    const world = snapshot.world;
    const run = world.run.startsWith("run:") ? world.run.slice(4) : world.run;
    const wc = world.workcell.replace(/^workcell:/, "").replace(/@[0-9a-f]+$/, "");
    return `O:I  World:${world.world.replace(/^world:/, "")} · Agent:${world.agent.replace(/^agent:/, "")} · Run:${run} · WC:${wc}`;
  }

  function activityLine(): string {
    if (!snapshot) return "Activity: — · Evidence: — · Attention: —";
    return `Activity: ${snapshot.activity.length} active · Evidence: ${snapshot.evidenceCount} · Attention: ${snapshot.attention.count}`;
  }

  function widgetLines(): string[] {
    if (snapshotError) return [`O:I unavailable — ${snapshotError}`];
    return [worldLine(), activityLine()];
  }

  async function showSection(ctx: ExtensionCommandContext, key: string): Promise<void> {
    await refresh();
    const view = snapshot;
    if (!view) {
      ctx.ui.notify(snapshotError ?? "O:I state unavailable", "error");
      return;
    }
    const section = view.sections.find((candidate) => candidate.key === key);
    if (!section) {
      ctx.ui.notify(`unknown Observatory section ${key}`, "error");
      return;
    }
    const extra =
      key === "capabilities" ? censusLines(view.census) : [];
    const lines = [
      ...extra,
      ...(section.semantic.length > 0 ? section.semantic : ["(no semantic lines)"]),
      "",
      `provenance: ${section.provenance.join(" · ")}`,
    ];
    await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
      const panel = makePanel({
        title: SECTION_TITLES[key] ?? key,
        lines,
        theme: theme as unknown as OiTheme,
        viewport: 42,
        onClose: () => done(undefined),
      });
      return {
        render: (width) => panel.render(width),
        handleInput: (data) => {
          panel.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => panel.invalidate(),
      };
    });
  }

  async function openObservatory(ctx: ExtensionCommandContext): Promise<void> {
    await refresh();
    const view = snapshot;
    if (!view) {
      ctx.ui.notify(snapshotError ?? "O:I state unavailable", "error");
      return;
    }

    const key = await ctx.ui.custom<string | null>(
      (tui, theme, _keybindings, done) => {
        const overlay = makeObservatoryOverlay({
          theme: theme as unknown as OiTheme,
          view,
          requestRender: () => tui.requestRender(),
          onOpenSection: (section) => done(section.key),
          onDetach: () => ctx.ui.notify(detachBest(), "info"),
          onClose: () => done(null),
        });
        return {
          render: (width) => overlay.render(width),
          handleInput: (data) => {
            overlay.handleInput(data);
            tui.requestRender();
          },
          invalidate: () => overlay.invalidate(),
        };
      },
      {
        overlay: true,
        overlayOptions: {
          anchor: "right-center",
          width: "52%",
          minWidth: 46,
          maxHeight: "80%",
          margin: 1,
        },
      },
    );

    if (key) await showSection(ctx, key);
  }

  function detachBest(): string {
    const herdr = planDetach("herdr");
    if (herdr.available) {
      executeDetach(herdr);
      return herdr.note;
    }
    const tmux = planDetach("tmux");
    if (tmux.available) {
      executeDetach(tmux);
      return tmux.note;
    }
    const desktop = planDetach("desktop");
    if (desktop.available) {
      executeDetach(desktop);
      return desktop.note;
    }
    return "no detach surface reachable (herdr/tmux/desktop)";
  }

  // Persistent compact widget above the prompt.
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setWidget("oi-status", (tui) => {
      widgetTui = tui;
      return {
        render: () => widgetLines(),
        invalidate: () => {},
      };
    });
    void refresh();
  });

  // Keep the widget honest without hammering native CLIs on every keystroke.
  pi.on("agent_settled", () => {
    void refresh();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    ctx.ui.setWidget("oi-status", undefined);
    widgetTui = null;
  });

  pi.registerCommand("oi", {
    description: "Open the O:I Session Observatory overlay",
    handler: async (_args, ctx) => {
      await openObservatory(ctx);
    },
  });

  pi.registerCommand("oi-detach", {
    description: "Detach the Observatory to the canonical desktop / herdr / tmux surface",
    handler: async (_args, ctx) => {
      ctx.ui.notify(detachBest(), "info");
    },
  });

  for (const [name, description] of Object.entries(COMMAND_DESCRIPTIONS)) {
    pi.registerCommand(name, {
      description,
      handler: async (_args, ctx) => {
        await showSection(ctx, name);
      },
    });
  }

  pi.registerShortcut("ctrl+shift+o", {
    description: "Open the O:I Session Observatory overlay",
    handler: async (ctx) => {
      await openObservatory(ctx);
    },
  });
}
