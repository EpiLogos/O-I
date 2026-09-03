// Read-only adapter to the O:I/AIKit native product CLIs.
//
// Ownership law: the O:I-for-Pi package never manufactures O:I state. Every
// datum this package renders is read from a native product process (`oi`,
// `aikit`, `ctrl`) through its published JSON contract, and every view keeps the
// exact native command + ref that produced it. No ambient resource discovery,
// no re-forwarded DSH skills, no private Pi state.

import { spawnSync } from "node:child_process";

export const OI_BIN = process.env.OI_BIN ?? "oi";
export const AIKIT_BIN = process.env.AIKIT_BIN ?? "aikit";
export const CTRL_BIN = process.env.CTRL_BIN ?? "ctrl";

export interface NativeResult {
  bin: string;
  args: string[];
  command: string;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

/** Spawn one native product process, read-only, bounded in time and memory. */
export function runNative(
  bin: string,
  args: string[],
  timeoutMs = 20_000,
): NativeResult {
  const res = spawnSync(bin, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  return {
    bin,
    args,
    command: [bin, ...args].join(" "),
    exitCode: res.status,
    timedOut: res.error != null && "code" in res.error && res.error.code === "ETIMEDOUT",
    stdout,
    stderr,
  };
}

/** The stable `aikit --json` envelope (`{context, data, ok, warnings}`). */
export interface AikitEnvelope<T = unknown> {
  context?: {
    context_id?: string;
    project_root?: string | null;
    session_id?: string | null;
  };
  data: T;
  ok: boolean;
  schema?: number;
  warnings?: unknown[];
}

export function parseAikit<T>(result: NativeResult): AikitEnvelope<T> | null {
  if (result.exitCode !== 0) return null;
  try {
    const value = JSON.parse(result.stdout) as AikitEnvelope<T>;
    if (
      value !== null &&
      typeof value === "object" &&
      "data" in value &&
      typeof value.ok === "boolean"
    ) {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse a plain JSON payload (used by `oi status`, `oi verify`, …). */
export function parseJson<T>(result: NativeResult): T | null {
  if (result.exitCode !== 0) return null;
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    return null;
  }
}

/** Human-readable provenance line for one native invocation. */
export function provenanceOf(result: NativeResult): string {
  if (result.exitCode === 0) return result.command;
  return `${result.command} (exit ${String(result.exitCode)})`;
}
