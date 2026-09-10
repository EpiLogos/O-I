/**
 * System Settings types (docs/cradle/06-SYSTEM-SETTINGS.md).
 *
 * Two layers:
 *  - `CompositionReading` — the native census projection, moved here from
 *    SystemPanel (which re-exports it for kernel/types).
 *  - The settings-page model — P1 is cradle-composed from the reads the
 *    kernel already serves; every value carries its provenance or its
 *    honest native path. Native per-product descriptors
 *    (`oi.product-settings-disclosure/v1`, §4 of the design) replace this
 *    composition one product at a time without page changes (law L6).
 */

export interface NativeReading {data?:Record<string,unknown>;error?:string;command:string[]}

/** The native six-owner census + owner-capability aggregate. */
export interface CompositionReading {schema:string;suite_executable?:string;current_world:NativeReading;status:NativeReading;positions:{product_id:string;availability:"missing"|"discovered"|"unavailable";native_state:string;current_world:Record<string,unknown>}[];integration_obligations:string[];observed_at_unix_ms:number}

export type Availability = "missing" | "discovered" | "unavailable";

/** One configuration row, P1 shape: a value with provenance, or a native
 * path when the setting is set through the owner's own surface (L4). */
export interface SettingRow {
  title: string;
  /** Rendered value. Absent → the row renders only its native path. */
  value?: string;
  /** Owner ref / reading that produced the value (L2). */
  provenance?: string;
  /** Where the setting is authored when not mutable here (L4). */
  native_path?: string;
}

export interface ActivityRow {
  title: string;
  value: string;
  error?: string;
  raw?: unknown;
}

/** One disclosed or named-missing engagement (L3: empty is proof). */
export interface ActionRow {
  title: string;
  availability: "native_only" | "missing_native_obligation" | "unavailable";
  note?: string;
}

/** The uniform product-section model (design §6.1). */
export interface ProductSectionModel {
  product_id: string;
  name: string;
  about: string;
  availability: Availability;
  /** Exact source fact from the census; registration is never readiness. */
  native_state: string;
  version?: string;
  configuration: SettingRow[];
  activity: ActivityRow[];
  actions: ActionRow[];
  /** The whole owner row — raw record stays behind disclosure (L5). */
  raw: Record<string, unknown>;
}

/** The four user needs the rail serves (design §1), plus Visuals — the
 * appearance and expression layer owned by the desktop itself. */
export type SettingsView = "health" | "activity" | "config" | "bootstrap" | "visuals";

/** Project-scoped live activity extras (AIKit agency + providers). */
export interface ActivityExtras {
  project?: string;
  spaces?: {count: number; project_ref: string; raw: unknown};
  spacesError?: string;
  providers?: {count: number; raw: unknown};
  providersError?: string;
}
