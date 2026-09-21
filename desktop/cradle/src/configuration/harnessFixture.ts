/**
 * The fixture-backed harness/chat face (dev/walk builds only — never a
 * production data path). The dev/walk-world strings live in this one
 * dynamically-imported chunk so a production build never emits them (the
 * same chunking law `fixtureSource.ts` carries for the configuration
 * plane).
 *
 * The facts are invented; the shapes are the real ones
 * (`harnessSource.ts`'s reading), so the panel renders — and is walked —
 * exactly as it does live, clearly labelled as simulation.
 */
import type {HarnessSource} from "./harnessSource";

export function createFixtureHarnessSource(): HarnessSource {
  let held: string | null = null;
  return {
    kind: "fixture",
    label: "fixture world (simulated harnesses, providers and catalogue — not this machine)",
    async read() {
      return {
        kind: "fixture",
        label: "fixture world (simulated harnesses, providers and catalogue — not this machine)",
        observed_at_unix_ms: Date.now(),
        harnesses: {state: "ok", rows: [
          {harness: "claude-code", client: "claude", detection: "detected", detected: true, detection_reason: null, installed: true, config_dir: "~/.claude", dispatch: "client"},
          {harness: "codex", client: "codex", detection: "detected", detected: true, detection_reason: null, installed: true, config_dir: "~/.codex", dispatch: "client"},
          {harness: "zcode", client: "zcode", detection: "detected", detected: true, detection_reason: null, installed: true, config_dir: "~/.zcode/cli", dispatch: "client"},
          {harness: "aider", client: "aider", detection: "not-installed", detected: false, detection_reason: "no aider binary or config on this machine", installed: false, config_dir: null, dispatch: "adapter-only"},
        ]},
        providers: {state: "ok", rows: [{id: "pi", label: "Pi"}, {id: "codex-fixture", label: "Codex (fixture)"}]},
        catalogue: {state: "ok", rows: {count: 2, entries: [{model: "model:fixture-a", name: "Fixture Model A", source: "source/fixture"}, {model: "model:fixture-b", name: "Fixture Model B", source: "source/fixture"}]}},
        heldDefault: held ? {value: held, set_at_unix_ms: Date.now()} : null,
        defaultState: {state: "ok"},
      };
    },
    async holdDefault(provider) {
      held = provider;
    },
    async discardDefault() {
      held = null;
    },
  };
}
