/**
 * The harness/chat settings face's data seam: what the "Chat & harnesses"
 * panel reads and writes, over the typed kernel operations.
 *
 * Three honest sources, mirroring `source.ts`/`sourceHost.ts`:
 *  - `createLiveHarnessSource` — the LIVE binding: `harness_status` and
 *    `model_catalogue` (the installed `aikit` reads, kernel `agency.rs`),
 *    the resident's configured encounter providers (the ordinary
 *    `encounter` op's `providers` action — the resident is machine-level,
 *    so the panel reads it through the standing Central project), and the
 *    desktop-held chat default (`chat_default_*`, kernel `chat_defaults.rs`).
 *  - `harnessFixture.ts` (`createFixtureHarnessSource`, dev/walk chunk) —
 *    a small labelled fixture world for dev builds, clearly marked on
 *    screen; never production data.
 *  - `createUnboundHarnessSource` — the honest absence when no kernel
 *    transport is reachable.
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
  installed: boolean;
  config_dir: string | null;
  dispatch: string;
}

export interface ProviderRow {id: string; label: string}

export interface CatalogueEntry {model: string; name: string; source: string}

/** The rule that picks a new chat's default provider, in precedence order. */
export type ChatDefaultRule = "owner-choice" | "pi-row" | "first-configured";

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
  /** The owner's held choice (desktop state), when one is held. */
  heldDefault: {value: string; set_at_unix_ms: number} | null;
  defaultState: {state: "ok"} | {state: "failed"; error: string};
}

// ---------------------------------------------------------------------------
// shaping (pure, pinned by tests against the real wire shapes)

/** `aikit --json client status` rows → the face's harness rows. Tolerant of
 * absent fields: the owner's census varies per client (a row without a
 * harness — the resident's own `broker` client — renders under its client
 * name). */
export function shapeHarnessClients(data: unknown): HarnessRow[] {
  const clients = (data as {clients?: unknown})?.clients;
  if (!Array.isArray(clients)) return [];
  return clients.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const harness = typeof record.harness === "string" ? record.harness : "";
    const client = typeof record.client === "string" ? record.client : "";
    const detection = typeof record.detection === "string" ? record.detection : "";
    return {
      harness: harness || client,
      client,
      detection,
      detected: detection === "detected" || detection === "self",
      detection_reason: typeof record.detection_reason === "string" ? record.detection_reason : null,
      installed: record.installed === true,
      config_dir: typeof record.config_dir === "string" ? record.config_dir : null,
      dispatch: typeof record.dispatch === "string" ? record.dispatch : "",
    };
  });
}

/** The resident's `providers` action rows → `{id,label}` pairs, in the
 * owner's own order. Rows without an id never answer. */
export function shapeProviders(data: unknown): ProviderRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => (row ?? {}) as Record<string, unknown>)
    .filter((row) => typeof row.id === "string" && row.id.length > 0)
    .map((row) => ({id: row.id as string, label: typeof row.label === "string" ? row.label : row.id as string}));
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
    }));
  const declared = (data as {catalogued?: unknown})?.catalogued;
  const count = typeof declared === "number" ? declared : shaped.length;
  return {count, entries: shaped};
}

/** The desktop-held chat default document → the held value, when readable. */
export function shapeHeldDefault(document: unknown): {value: string; set_at_unix_ms: number} | null {
  const record = document as {value?: unknown; set_at_unix_ms?: unknown} | null;
  if (!record || typeof record.value !== "string" || record.value.trim() === "") return null;
  return {value: record.value, set_at_unix_ms: typeof record.set_at_unix_ms === "number" ? record.set_at_unix_ms : 0};
}

/** The default-provider law (mirrors kernel `agency.rs`):
 * owner-chosen default → the `pi` row → the first configured row.
 * `null` when nothing is configured; a held choice that no longer names a
 * configured row falls through honestly. */
export function effectiveChatDefault(rows: ProviderRow[], held: string | null): {provider: string; rule: ChatDefaultRule} | null {
  if (rows.length === 0) return null;
  const choice = held?.trim();
  if (choice && rows.some((row) => row.id === choice)) return {provider: choice, rule: "owner-choice"};
  if (rows.some((row) => row.id === "pi")) return {provider: "pi", rule: "pi-row"};
  return {provider: rows[0].id, rule: "first-configured"};
}

// ---------------------------------------------------------------------------

/** The one seam the "Chat & harnesses" panel renders. */
export interface HarnessSource {
  readonly kind: "live" | "fixture" | "unbound";
  readonly label: string;
  /** Read everything the panel shows. Independent sections fail alone. */
  read(): Promise<HarnessReading>;
  /** Hold (or replace) the default provider for NEW chats. */
  holdDefault(provider: string): Promise<void>;
  /** Withdraw the held default — an explicit operation. */
  discardDefault(): Promise<void>;
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
      const [harnesses, catalogue, providers, held] = await Promise.all([
        section(async () => shapeHarnessClients((unwrap(await call({op: "harness_status"}), "harness_status_reading", "the harness status") as {data: unknown}).data)),
        section(async () => shapeCatalogue((unwrap(await call({op: "model_catalogue"}), "model_catalogue_reading", "the model catalogue") as {data: unknown}).data)),
        section(async () => shapeProviders((unwrap(
          await call({op: "encounter", project: "Central", request: {action: "providers"}}),
          "encounter_reading", "the encounter providers") as {data: unknown}).data)),
        section(async () => shapeHeldDefault((unwrap(await call({op: "chat_default_read"}), "chat_default_reading", "the held chat default") as {document: unknown}).document)),
      ]);
      const heldDefault = held.state === "ok" ? held.rows : null;
      return {
        kind: "live",
        label: "live — read through the installed suite (aikit client status, model catalogue, encounter providers)",
        observed_at_unix_ms: Date.now(),
        harnesses,
        providers,
        catalogue,
        heldDefault,
        defaultState: held.state === "failed" ? {state: "failed", error: held.error} : {state: "ok"},
      };
    },

    async holdDefault(provider) {
      unwrap(await call({op: "chat_default_hold", provider}), "chat_default_held", "holding the chat default");
    },

    async discardDefault() {
      unwrap(await call({op: "chat_default_discard"}), "chat_default_discarded", "withdrawing the chat default");
    },
  };
}

/** The unbound source: the honest absence, never a fake control. */
export function createUnboundHarnessSource(reason: string): HarnessSource {
  return {
    kind: "unbound",
    label: reason,
    read: async () => ({kind: "unbound", label: reason, observed_at_unix_ms: 0, harnesses: {state: "failed", error: reason}, providers: {state: "failed", error: reason}, catalogue: {state: "failed", error: reason}, heldDefault: null, defaultState: {state: "failed", error: reason}}),
    holdDefault: async () => unbound(reason),
    discardDefault: async () => unbound(reason),
  };
}

function unbound(reason: string): never {
  throw new Error(reason);
}
