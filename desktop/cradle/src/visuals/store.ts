/**
 * The visual-preference owner for the desktop: one validated, versioned,
 * serializable snapshot that the Settings → Visuals view, the welcome
 * frontstate, and any future anchor all read and mutate through the same
 * door. Authored recipes are kept separate from transient simulation state
 * (morphProgress live value stays with the running field).
 *
 * Persistence is a revisioned JSON record in localStorage. Patches are
 * validated by the design-system schema (finite numbers, enums, bounds,
 * nested-partial semantics) — nothing reaches the renderer unvalidated.
 * Durable writes are debounced with a guaranteed trailing write; live
 * patches coalesce. In the native app every accepted write broadcasts the
 * small config snapshot to the other windows through the existing Tauri
 * event seam — never particle arrays, never per-frame traffic.
 */
import {
  hydrateConfig,
  cloneConfig,
  applyPatch,
  applyPath,
  CONFIG_KEYS,
  CONTROL_SCHEMA,
} from "@epilogos/oi-design-system/point-cloud/config";
import type { PointCloudConfig, PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";
import logoState from "./oi-logo-state.json";

export interface SavedState {
  id: string;
  name: string;
  timestamp: number;
  config: PointCloudConfig;
}

export type ThemeChoice = "light" | "dark" | "system";

export interface VisualsSnapshot {
  revision: number;
  enabled: boolean;
  welcomeEnabled: boolean;
  theme: ThemeChoice;
  config: PointCloudConfig;
  savedStates: SavedState[];
}

const STORAGE_KEY = "oi-cradle.visuals.v1";
const BROADCAST = "oi:visuals-snapshot";

function defaults(): VisualsSnapshot {
  const logo = logoState as unknown as { name: string; config: PointCloudConfig };
  const mark: SavedState = {
    id: "oi_logo_mark",
    name: logo.name,
    timestamp: 0,
    config: hydrateConfig(logo.config),
  };
  return {
    revision: 0,
    enabled: true,
    welcomeEnabled: true,
    theme: "system",
    config: cloneConfig(mark.config),
    savedStates: [mark],
  };
}

/** Structural validation of a stored/imported snapshot: wrong shapes fall
 * back to defaults field-by-field; saved configs go through the validator. */
function sanitize(raw: unknown): VisualsSnapshot {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  const next: VisualsSnapshot = { ...base };
  if (typeof record.enabled === "boolean") next.enabled = record.enabled;
  if (typeof record.welcomeEnabled === "boolean") next.welcomeEnabled = record.welcomeEnabled;
  if (record.theme === "light" || record.theme === "dark" || record.theme === "system") next.theme = record.theme;
  if (record.config && typeof record.config === "object") {
    try { next.config = hydrateConfig(record.config as PointCloudPatch); } catch { next.config = base.config; }
  }
  if (Array.isArray(record.savedStates)) {
    next.savedStates = record.savedStates.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.id !== "string" || typeof candidate.name !== "string") return [];
      try {
        return [{
          id: candidate.id,
          name: candidate.name,
          timestamp: typeof candidate.timestamp === "number" ? candidate.timestamp : 0,
          config: hydrateConfig(candidate.config as PointCloudPatch),
        }];
      } catch { return []; }
    });
    if (!next.savedStates.some((state) => state.id === "oi_logo_mark")) next.savedStates.unshift(base.savedStates[0]);
  }
  if (typeof record.revision === "number" && Number.isFinite(record.revision)) next.revision = record.revision;
  return next;
}

function load(): VisualsSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    return sanitize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

type Listener = (snapshot: VisualsSnapshot) => void;

class VisualsStore {
  private snapshot: VisualsSnapshot = load();
  private listeners = new Set<Listener>();
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private applyingExternal = false;
  /** In native windows the accepted write is broadcast; echoes of our own
   * writes are dropped by revision. */
  private native: ((snapshot: VisualsSnapshot) => void) | null = null;

  get(): VisualsSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  /** Wire the native broadcast seam (Tauri). Called by the provider. */
  attachBroadcast(emit: ((snapshot: VisualsSnapshot) => void) | null) {
    this.native = emit;
  }

  /** Receive a snapshot from another window. Later revisions win; our own
   * echoes (revision ≤ current) are dropped. */
  receive(remote: VisualsSnapshot) {
    if (this.applyingExternal) return;
    if (!remote || typeof remote.revision !== "number") return;
    if (remote.revision <= this.snapshot.revision) return;
    this.snapshot = sanitize({ ...remote });
    this.persistNow();
    this.emit();
  }

  private emit() {
    for (const listener of [...this.listeners]) listener(this.snapshot);
  }

  private bump(mutate: (snapshot: VisualsSnapshot) => VisualsSnapshot) {
    if (this.applyingExternal) return;
    this.snapshot = { ...mutate(this.snapshot), revision: this.snapshot.revision + 1 };
    this.persist();
    this.emit();
    this.native?.(this.snapshot);
  }

  /** Debounced durable write — every slider storm ends in exactly one
   * persisted record, and the trailing write is guaranteed. */
  private persist() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => this.persistNow(), 300);
  }

  private persistNow() {
    if (this.writeTimer) { clearTimeout(this.writeTimer); this.writeTimer = undefined; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
    } catch {
      // Persistence is best-effort; the in-memory owner stays authoritative.
    }
  }

  /** Validated nested patch onto the authored expression config. Throws on
   * invalid values — the caller renders the refusal, nothing is coerced. */
  patchConfig(patch: PointCloudPatch) {
    this.bump((snapshot) => ({ ...snapshot, config: applyPatch(snapshot.config, patch) }));
  }

  /** Validated single-control write at a dotted schema path (glyph.0,
   * fluid.curlScale, …). */
  patchPath(path: string, value: unknown) {
    this.bump((snapshot) => ({ ...snapshot, config: applyPath(snapshot.config, path, value) }));
  }

  setEnabled(enabled: boolean) {
    this.bump((snapshot) => ({ ...snapshot, enabled }));
  }

  setWelcomeEnabled(welcomeEnabled: boolean) {
    this.bump((snapshot) => ({ ...snapshot, welcomeEnabled }));
  }

  setTheme(theme: ThemeChoice) {
    this.bump((snapshot) => ({ ...snapshot, theme }));
  }

  resetConfig() {
    this.bump((snapshot) => ({ ...snapshot, config: cloneConfig(defaults().config) }));
  }

  saveState(name: string) {
    const trimmed = name.trim() || `Config ${new Date().toLocaleTimeString()}`;
    this.bump((snapshot) => ({
      ...snapshot,
      savedStates: [
        { id: `state_${Date.now()}`, name: trimmed, timestamp: Date.now(), config: cloneConfig(snapshot.config) },
        ...snapshot.savedStates,
      ],
    }));
  }

  deleteState(id: string) {
    this.bump((snapshot) => ({
      ...snapshot,
      savedStates: snapshot.savedStates.filter((state) => state.id !== id || state.id === "oi_logo_mark"),
    }));
  }

  loadState(id: string) {
    const state = this.snapshot.savedStates.find((candidate) => candidate.id === id);
    if (!state) throw new Error(`No saved state named ${id}`);
    this.bump((snapshot) => ({ ...snapshot, config: cloneConfig(state.config) }));
  }

  exportState(id: string): string {
    const state = this.snapshot.savedStates.find((candidate) => candidate.id === id);
    if (!state) throw new Error(`No saved state named ${id}`);
    return JSON.stringify(state.config, null, 2);
  }

  /** Validated versioned import: the patch semantics of the design-system
   * schema decide what is accepted; a bad document refuses loudly. */
  importJson(text: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch (cause) {
      throw new Error(`This is not valid JSON: ${cause instanceof Error ? cause.message : cause}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The imported document must be a config object");
    const doc = parsed as Record<string, unknown>;
    if (!("glyph" in doc) && !("fluid" in doc)) throw new Error("This document does not look like an expression config (no glyph, no fluid)");
    // Wrapper keys (name, version, …) are ignored, not refused.
    const configOnly: PointCloudPatch = {};
    for (const key of Object.keys(doc)) {
      if (CONFIG_KEYS.has(key)) (configOnly as Record<string, unknown>)[key] = doc[key];
    }
    this.bump((snapshot) => ({ ...snapshot, config: applyPatch(snapshot.config, configOnly) }));
  }

  /** Named controls the panel renders — the one shared schema. */
  get schema() {
    return CONTROL_SCHEMA;
  }

  flush() {
    this.persistNow();
  }
}

export const visuals = new VisualsStore();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => visuals.flush());
  // Browser windows of the same origin keep in step through the storage
  // event; native windows use the Tauri broadcast attached by the provider.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      visuals.receive(JSON.parse(event.newValue) as VisualsSnapshot);
    } catch {
      // A malformed foreign record is ignored, not applied.
    }
  });
}

export { BROADCAST, STORAGE_KEY };
