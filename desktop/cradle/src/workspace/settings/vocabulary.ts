/**
 * The human-language layer for the settings and system surfaces.
 *
 * Every frozen contract word (reconciliation statuses, availability
 * states, effect kinds, scope kinds, axis names, owner refs) is translated
 * HERE and nowhere else — no raw schema vocabulary may render as UI copy.
 * The translation never lies: each word keeps the contract meaning, and
 * the raw value stays available for `data-*` attributes and the developer
 * view (the walk asserts on the raw value, the page shows the word).
 *
 * When a ref has no entry here, `humanizeKey` derives a readable title by
 * rule (camelCase / snake_case / dotted-key splitting) rather than letting
 * an identifier reach the page.
 */

import type {EffectKind, ReconciliationStatus, ScopeKind} from "../../configuration/contracts";

// ---------------------------------------------------------------------------
// names

const PRODUCT_NAMES: Record<string, string> = {
  "oi": "O:I",
  "central": "Central",
  "ai-kit": "AIKit",
  "software-factory": "Software Factory",
  "workcell": "Workcell",
  "actuation": "Actuation",
  "quaternal-logic": "Quaternal Logic",
  "connector/factory-actuation": "Factory–Actuation connector",
};

/** The display name of an owner/product ref, or a derived readable name. */
export function productName(ref: string): string {
  return PRODUCT_NAMES[ref] ?? humanizeKey(ref.split("/").pop() ?? ref);
}

/** Derive a readable title from a key: splits on dots, camelCase and
 * snake_case, drops the redundant leading segments when a longer form is
 * left, and capitalises the first word. `model.default` → "Default";
 * `live_processes` → "Live processes". */
export function humanizeKey(key: string): string {
  const last = key.split(".").pop() ?? key;
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (words.length === 0) return key;
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// ---------------------------------------------------------------------------
// reconciliation (the frozen six, §7.1)

const RECONCILIATION_WORDS: Record<ReconciliationStatus, {word: string; meaning: string}> = {
  satisfied: {word: "In sync", meaning: "What is asked for here matches what the product reports."},
  drifted: {word: "Out of step", meaning: "A change is waiting here that the product has not received yet — or the product changed underneath it. Apply or discard."},
  pending: {word: "Staging", meaning: "The product is preparing this change on its side."},
  blocked: {word: "Blocked", meaning: "Something the setting depends on is not working, so it cannot move."},
  unsupported: {word: "Not applicable", meaning: "No installed product offers this setting in the current world."},
  unknown: {word: "Undetermined", meaning: "The state cannot be read right now — nothing is guessed."},
};

export function reconciliationWord(status: ReconciliationStatus): string {
  return RECONCILIATION_WORDS[status]?.word ?? humanizeKey(status);
}

export function reconciliationMeaning(status: ReconciliationStatus): string {
  return RECONCILIATION_WORDS[status]?.meaning ?? status;
}

// ---------------------------------------------------------------------------
// availability

/** The owner mount / contribution availability states. */
const AVAILABILITY_WORDS: Record<string, string> = {
  available: "Working",
  degraded: "Partly working",
  unavailable: "Unavailable",
  unknown: "State unknown",
  discovered: "Installed",
  missing: "Not installed",
};

export function availabilityWord(state: string): string {
  return AVAILABILITY_WORDS[state] ?? humanizeKey(state);
}

// ---------------------------------------------------------------------------
// effects

const EFFECT_WORDS: Record<EffectKind, string> = {
  "none": "Nothing else changes",
  "value-change": "Takes effect right away",
  "restart-required": "Needs an app restart",
  "session-restart-required": "Needs the session to restart",
  "provider-reconnect-required": "Reconnects the provider",
  "material-effect": "Changes things outside this window",
  "pending": "Takes effect when the product next runs",
  "unknown": "Effect not disclosed",
};

export function effectWord(kind: string): string {
  return EFFECT_WORDS[kind as EffectKind] ?? humanizeKey(kind);
}

// ---------------------------------------------------------------------------
// scopes

const SCOPE_WORDS: Record<ScopeKind, string> = {
  "world": "Whole world",
  "ground": "Ground",
  "project": "Project",
  "machine": "This machine",
  "workcell": "Workcell",
  "agency": "Agency",
  "agent": "Agent",
  "session-space": "Session space",
  "agent-session": "Agent session",
  "provider": "Provider",
  "connector-relation": "Connector relation",
  "invocation": "Single invocation",
};

export function scopeWord(kind: string): string {
  return SCOPE_WORDS[kind as ScopeKind] ?? humanizeKey(kind);
}

/** One scope address as a human phrase: "Whole world", "Project epilogos/o-i". */
export function scopePhrase(scope: {scope_kind: string; scope_ref: string | null}): string {
  const base = scopeWord(scope.scope_kind);
  return scope.scope_ref ? `${base} · ${scope.scope_ref}` : base;
}

// ---------------------------------------------------------------------------
// axes

const AXIS_WORDS: Record<string, string> = {
  declared: "Saved",
  effective: "In effect",
  active: "Running now",
  staged: "Staged by the product",
  desired: "Asked for here",
};

export function axisWord(name: string): string {
  return AXIS_WORDS[name] ?? humanizeKey(name);
}
