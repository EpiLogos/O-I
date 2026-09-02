// Open / detach to the canonical desktop and herdr/tmux Surfaces.
//
// herdr is the current multiplexer; tmux is the fallback. Detection delegates to
// the native mux census (`aikit mux detect --json`) plus a binary probe, and the
// plan is only executed when a real surface binary is reachable. Degradation is
// explicit, never silent.

import { runNative, parseAikit, provenanceOf, AIKIT_BIN } from "./native.ts";
import type { NativeResult } from "./native.ts";

export type SurfaceTarget = "desktop" | "herdr" | "tmux";

export interface DetachPlan {
  target: SurfaceTarget;
  command: string;
  args: string[];
  note: string;
  available: boolean;
}

interface MuxDetected {
  mux: string;
  installed: boolean;
  binary: string | null;
  server_running?: boolean;
}

interface MuxDetectData {
  active?: string;
  active_stack?: string[];
  declared?: string | null;
  detected?: MuxDetected[];
}

/** Probe PATH for a binary, read-only. */
export function probeBinary(name: string): string | null {
  const result = runNative("/bin/sh", ["-lc", `command -v ${name} || true`], 5_000);
  const path = result.stdout.trim();
  return path.length > 0 ? path : null;
}

export function detectMuxStack(): {
  stack: string[];
  active: string | null;
  provenance: string;
  result: NativeResult | null;
} {
  const result = runNative(AIKIT_BIN, ["mux", "detect", "--json"]);
  const envelope = parseAikit<MuxDetectData>(result);
  const detected = envelope?.data?.detected ?? [];
  const stack = detected.filter((entry) => entry.installed).map((entry) => entry.mux);
  return {
    stack,
    active: envelope?.data?.active ?? null,
    provenance: provenanceOf(result),
    result,
  };
}

/**
 * Choose the detach surface: herdr (current multiplexer) before tmux (fallback),
 * desktop last. Returns an explicit plan; `available` is false when the target
 * binary cannot be reached, so the caller reports degradation instead of lying.
 */
export function planDetach(
  target: SurfaceTarget,
  herdrBinary: string | null = null,
): DetachPlan {
  if (target === "herdr") {
    const bin = herdrBinary ?? probeBinary("herdr");
    if (bin != null) {
      return {
        target: "herdr",
        command: bin,
        args: ["session", "oi-observatory"],
        note: "detach to herdr (current multiplexer)",
        available: true,
      };
    }
    return {
      target: "herdr",
      command: "herdr",
      args: [],
      note: "herdr is the current multiplexer but its binary is not reachable",
      available: false,
    };
  }

  if (target === "tmux") {
    const tmux = probeBinary("tmux");
    if (tmux != null) {
      return {
        target: "tmux",
        command: tmux,
        args: ["new-window", "aikit ops"],
        note: "detach to tmux (fallback multiplexer) running the live ops surface",
        available: true,
      };
    }
    return {
      target: "tmux",
      command: "tmux",
      args: [],
      note: "tmux fallback multiplexer is not reachable",
      available: false,
    };
  }

  // desktop
  const open = probeBinary("open");
  if (open != null) {
    return {
      target: "desktop",
      command: open,
      args: [process.env.OI_DESKTOP_APP ?? "~/.local/share/OI"],
      note: "open the canonical desktop surface (macOS `open`)",
      available: true,
    };
  }
  return {
    target: "desktop",
    command: "open",
    args: [],
    note: "no desktop opener is reachable here",
    available: false,
  };
}

export function executeDetach(plan: DetachPlan): NativeResult {
  return runNative(plan.command, plan.args, 10_000);
}
