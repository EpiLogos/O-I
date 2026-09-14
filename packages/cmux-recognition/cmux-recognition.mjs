#!/usr/bin/env node
// cmux recognition adapter — oi.world-recognition/v1 external provider.
//
// Recognises the real cmux working-environment on this machine: version,
// canonical source revision, and whether its daemon/socket is currently live.
// Native ownership and provenance stay cmux's (manaflow-ai/cmux); this adapter
// only reports what the installed binary actually discloses.

import { spawnSync } from "node:child_process";

const RESULT_SCHEMA = "oi.world-recognition-result/v1";
const VERIFY_SCHEMA = "oi.world-recognition-verification/v1";

function run(args) {
  const result = spawnSync("cmux", args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function resolveLocator() {
  const where = spawnSync("sh", ["-c", "command -v cmux"], { encoding: "utf8" });
  if (where.status === 0 && where.stdout && where.stdout.trim()) {
    return where.stdout.trim();
  }
  return null;
}

function probe() {
  const locator = resolveLocator();
  if (!locator) {
    return { installed: false, locator: null };
  }
  const version = run(["--version"]);
  if (!version.ok) {
    return { installed: false, locator };
  }
  // Expected shape: "cmux 0.64.22 (102) [ddd4a01bc]"
  const m = version.stdout.match(
    /^cmux\s+(\d+\.\d+\.\d+)\s*(?:\((\d+)\))?\s*(?:\[([0-9a-f]+)\])?/
  );
  const ping = run(["ping"]);
  const daemonRunning = ping.ok;
  return {
    installed: true,
    locator,
    version: m ? m[1] : null,
    build: m && m[2] ? m[2] : null,
    sourceRevision: m && m[3] ? m[3] : null,
    daemonRunning,
    versionRaw: version.stdout,
  };
}

function discover() {
  const p = probe();
  const observations = [];
  if (p.installed) {
    const nativeSystem = {
      system_ref: "native:cmux:local",
      kind: "working-environment",
      name: "cmux",
    };
    if (p.version) nativeSystem.version = p.version;
    if (p.locator) nativeSystem.locator = p.locator;
    if (p.sourceRevision) nativeSystem.source_revision = p.sourceRevision;

    observations.push({
      observation_ref: "observation:cmux:local",
      native_system: nativeSystem,
      support: "supported",
      faculties: [
        "workspace",
        "window",
        "pane",
        "surface",
        "session",
        "hooks",
        "events",
        "themes",
        "agent-hibernation",
        "auth",
        "networking",
      ],
      relations: [],
      facts: {
        build: p.build ?? null,
        daemon_running: p.daemonRunning,
      },
      owner_bindings: [],
      evidence: [
        {
          kind: "version",
          source: "cmux --version",
          detail: p.versionRaw,
        },
      ],
    });
  }
  return {
    schema: RESULT_SCHEMA,
    provider_ref: "contribution:cmux/world-recognition",
    observations,
    extension_requests: [],
  };
}

function verify() {
  const p = probe();
  if (!p.installed) {
    return {
      schema: VERIFY_SCHEMA,
      ok: false,
      evidence: ["cmux executable not found on PATH"],
    };
  }
  return {
    schema: VERIFY_SCHEMA,
    ok: true,
    evidence: [
      `cmux ${p.version || "unknown"} detected at ${p.locator}`,
      p.sourceRevision ? `source revision ${p.sourceRevision}` : "source revision not disclosed",
    ].filter(Boolean),
  };
}

function main() {
  const args = process.argv.slice(2);
  const subcommand = args.find((a) => a === "discover" || a === "verify");
  const result = subcommand === "verify" ? verify() : discover();
  process.stdout.write(JSON.stringify(result) + "\n");
}

main();
