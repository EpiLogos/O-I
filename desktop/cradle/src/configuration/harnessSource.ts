/**
 * The harness/chat settings face's data seam: what the "Chat & harnesses"
 * panel reads and writes, over the typed kernel operations.
 *
 * Three honest sources, mirroring `source.ts`/`sourceHost.ts`:
 *  - `createLiveHarnessSource` — the LIVE binding: `harness_status` and
 *    `model_catalogue` (the installed `aikit` reads, kernel `agency.rs`),
 *    the resident's configured encounter providers (the ordinary
 *    `encounter` op's `providers` action — the resident is machine-level,
 *    so the panel reads it through the standing Central project). Which
 *    agent a new chat talks to is the census's (the World Model's agents,
 *    O-I #1003); there is no second, desktop-held default.
 *  - `createUnboundHarnessSource` — the honest absence when no kernel
 *    transport is reachable.
 *
 * (The old dev-only fixture harness world is retired: the rebuilt settings
 * sections bind THIS source directly through `systemDisclosure.ts` in every
 * build — the machine's truth or the honest absence, never simulated data.)
 *
 * The shaping functions are pure and pinned by `tests/chat-settings.test.mjs`
 * against the real wire shapes observed on this machine (2026-09-21):
 * `aikit --json client status` → `{data:{clients:[…]}}`,
 * `aikit model-catalogue show --json` → `{data:{catalogued,entries:[…]}}`,
 * `encounter providers` → `[{id,label}]`.
 *
 * The default-provider law mirrors the kernel's own (agency.rs
 * `default_provider_choice`): the owner's held choice when it names a
 * configured row, else the row literally named `pi`, else the first
 * configured row. The kernel enforces it at provision time; this module
 * computes the SAME answer for display so the face never promises a
 * different default than the next Send will use.
 */

import type {KernelOp, KernelOutcome} from "../kernel/types";

export type OpCall = (op: KernelOp) => Promise<{outcome: KernelOutcome | null; error?: string}>;

// ---------------------------------------------------------------------------
// shaped rows

export interface HarnessRow {
  harness: string;
  client: string;
  detection: string;
  detected: boolean;
  detection_reason: string | null;
  /** Whether the harness's configuration folder exists (AIKit's client row, `config_dir_present`): nothing about whether the
   * harness runs, which the census says (agency/census.ts). Null where AIKit names no folder for it. */
  config_dir_present: boolean | null;
  config_dir: string | null;
  dispatch: string;
  /** "descriptor" when an AIKit adapter exists for it; "unavailable" when
   * the harness is detected but no adapter is authored yet. */
  capability: string;
  /** The owner's own effect text ("restart Claude", "next session only …"). */
  effect: string | null;
  /** How many skills AIKit projects into it (null: not disclosed). */
  items: number | null;
  /** The owner's missing-adapter record, when it names one. */
  adapter_gap: {authoring_skill_ref: string | null; missing_contract: string | null} | null;
}

export interface ProviderRow {id: string; label: string; protocol?:string; command?:string; entry?:string; sandboxed?:boolean}

/** One declared route of a catalogued model (the owner's own words: a
 * route is a way to reach the model, and it names whether a key is needed). */
export interface CatalogueRoute {kind: string; provider: string; credential_required: boolean}

export interface CatalogueEntry {model: string; name: string; source: string; routes: CatalogueRoute[]}

/** One section that could not be read carries the owner's own refusal —
 * the other sections still render. Nothing is faked empty. */
export type Section<T> = {state: "ok"; rows: T} | {state: "failed"; error: string};

export interface HarnessReading {
  kind: "live" | "fixture" | "unbound";
  label: string;
  observed_at_unix_ms: number;
  harnesses: Section<HarnessRow[]>;
  providers: Section<ProviderRow[]>;
  catalogue: Section<{count: number; entries: CatalogueEntry[]}>;
}

// ---------------------------------------------------------------------------
// shaping (pure, pinned by tests against the real wire shapes)

/** `aikit --json client status` rows → the face's harness rows. Tolerant of
 * absent fields: the owner's census varies per client. The broker (AIKit's
 * own resident, `detection: self`) is AIKit itself, not a harness, and is
 * never listed (12-SETTINGS §3.2). */
export function shapeHarnessClients(data: unknown): HarnessRow[] {
  const clients = (data as {clients?: unknown})?.clients;
  if (!Array.isArray(clients)) return [];
  return clients.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const harness = typeof record.harness === "string" ? record.harness : "";
    const client = typeof record.client === "string" ? record.client : "";
    const detection = typeof record.detection === "string" ? record.detection : "";
    const gap = (record.gap ?? null) as Record<string, unknown> | null;
    return {
      harness: harness || client,
      client,
      detection,
      detected: detection === "detected",
      detection_reason: typeof record.detection_reason === "string" ? record.detection_reason : null,
      config_dir_present: typeof record.config_dir_present === "boolean" ? record.config_dir_present : null,
      config_dir: typeof record.config_dir === "string" ? record.config_dir : null,
      dispatch: typeof record.dispatch === "string" ? record.dispatch : "",
      capability: typeof record.capability === "string" ? record.capability : "",
      effect: typeof record.effect === "string" ? record.effect : null,
      items: typeof record.items === "number" ? record.items : null,
      adapter_gap: gap && typeof gap === "object"
        ? {authoring_skill_ref: typeof gap.authoring_skill_ref === "string" ? gap.authoring_skill_ref : null, missing_contract: typeof gap.missing_contract === "string" ? gap.missing_contract : null}
        : null,
    };
  }).filter((row) => row.detection !== "self" && row.dispatch !== "self" && row.client !== "broker");
}

/** The resident's `providers` action rows → `{id,label}` pairs, in the
 * owner's own order. Rows without an id never answer. */
export function shapeProviders(data: unknown): ProviderRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row ?? {}) as Record<string, unknown>)
    .filter((row) => typeof row.id === "string" && row.id.length > 0)
    .map((row) => ({id: row.id as string, label: typeof row.label === "string" ? row.label : row.id as string,
      ...(typeof row.protocol === "string" ? {protocol:row.protocol} : {}),
      ...(typeof row.command === "string" ? {command:row.command} : {}),
      ...(typeof row.entry === "string" ? {entry:row.entry} : {}),
      ...(typeof row.sandboxed === "boolean" ? {sandboxed:row.sandboxed} : {}),
    }));
}

/** The resolved model catalogue → count + readable entries, owner order. */
export function shapeCatalogue(data: unknown): {count: number; entries: CatalogueEntry[]} {
  const entries = Array.isArray((data as {entries?: unknown})?.entries)
    ? ((data as {entries: unknown[]}).entries)
    : [];
  const shaped = entries
    .map((row) => (row ?? {}) as Record<string, unknown>)
    .map((row) => ({
      model: typeof row.model === "string" ? row.model : "",
      name: typeof row.name === "string" ? row.name : "",
      source: typeof row.source === "string" ? row.source : "",
      routes: (Array.isArray(row.declared_routes) ? row.declared_routes : [])
        .map((route) => (route ?? {}) as Record<string, unknown>)
        .map((route) => ({
          kind: typeof route.kind === "string" ? route.kind : "",
          provider: typeof route.provider === "string" ? route.provider : "",
          credential_required: route.credential_required !== false,
        }))
        .filter((route) => route.provider !== ""),
    }));
  const declared = (data as {catalogued?: unknown})?.catalogued;
  const count = typeof declared === "number" ? declared : shaped.length;
  return {count, entries: shaped};
}

// ---------------------------------------------------------------------------

/** The one seam the "Chat & harnesses" panel renders. */
export interface HarnessSource {
  readonly kind: "live" | "fixture" | "unbound";
  readonly label: string;
  /** Read everything the panel shows. Independent sections fail alone. */
  read(): Promise<HarnessReading>;
}

function unwrap<T extends KernelOutcome>(sent: {outcome: KernelOutcome | null; error?: string}, expected: T["result"], what: string): T {
  if (sent.error || sent.outcome == null) {
    throw new Error(sent.error ?? `${what} could not be served by the kernel`);
  }
  const outcome = sent.outcome as KernelOutcome & {result?: string};
  if (outcome.result !== expected) {
    throw new Error(`${what} answered \`${outcome.result ?? "unknown"}\`, not \`${expected}\``);
  }
  return outcome as T;
}

/** The LIVE binding over the typed kernel ops. The providers action rides
 * the ordinary `encounter` op through the standing Central project — the
 * resident and its configured providers are machine-level facts, and
 * Central is the same standing default the fresh chat itself uses. */
export function createLiveHarnessSource(call: OpCall): HarnessSource {
  /** One section that cannot be read carries the refusal; the others still
   * render. Nothing is faked empty. */
  const section = async <T>(read: () => Promise<T>): Promise<Section<T>> => {
    try {
      return {state: "ok", rows: await read()};
    } catch (cause) {
      return {state: "failed", error: String(cause)};
    }
  };
  return {
    kind: "live",
    label: "live — read through the installed suite (aikit client status, model catalogue, encounter providers)",

    async read() {
      const [harnesses, catalogue, providers] = await Promise.all([
        section(async () => shapeHarnessClients((unwrap(await call({op: "harness_status"}), "harness_status_reading", "the harness status") as {data: unknown}).data)),
        section(async () => shapeCatalogue((unwrap(await call({op: "model_catalogue"}), "model_catalogue_reading", "the model catalogue") as {data: unknown}).data)),
        section(async () => shapeProviders((unwrap(
          await call({op: "encounter", project: "Central", request: {action: "providers"}}),
          "encounter_reading", "the encounter providers") as {data: unknown}).data)),
      ]);
      return {
        kind: "live",
        label: "live — read through the installed suite (aikit client status, model catalogue, encounter providers)",
        observed_at_unix_ms: Date.now(),
        harnesses,
        providers,
        catalogue,
      };
    },
  };
}

/** The unbound source: the honest absence, never a fake control. */
export function createUnboundHarnessSource(reason: string): HarnessSource {
  return {
    kind: "unbound",
    label: reason,
    read: async () => ({kind: "unbound", label: reason, observed_at_unix_ms: 0, harnesses: {state: "failed", error: reason}, providers: {state: "failed", error: reason}, catalogue: {state: "failed", error: reason}}),
  };
}
