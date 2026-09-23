/**
 * Pure derivations the Settings sections render (docs/cradle/12-SETTINGS.md
 * §3): harness grouping, credential cards, model availability (routes joined
 * with the BOUND credentials, S14), skill grouping, and the plain words for
 * owner vocabulary. No kernel access here — `tests/settings-model.test.mjs`
 * pins these against owner-shaped documents.
 */
import type {CatalogueEntry, HarnessRow} from "../../configuration/harnessSource";
import type {SystemDisclosureReading} from "../../configuration/systemDisclosure";
import type {CredentialBinding, SettingEntry, SettingsSnapshot} from "./settingsData";

// ---------------------------------------------------------------------------
// names

const HARNESS_NAMES: Record<string, string> = {
  "claude-code": "Claude Code", claude: "Claude Code", codex: "Codex", zcode: "ZCode", pi: "Pi",
  "gemini-cli": "Gemini CLI", gemini: "Gemini CLI", "gemini-antigravity": "Gemini Antigravity",
  hermes: "Hermes", "hermes-acp": "Hermes ACP", "grok-bot": "Grok Bot", ollama: "Ollama",
  openclaw: "OpenClaw", kimi: "Kimi", opencode: "OpenCode", "cursor-cli": "Cursor CLI",
  "deepseek-harness": "DeepSeek Harness", aider: "Aider", goose: "Goose", "qwen-code": "Qwen Code",
};

export function titleCase(text: string): string {
  return text.split(/[-_\s]+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export function harnessName(id: string): string {
  return HARNESS_NAMES[id] ?? titleCase(id);
}

const PROVIDER_NAMES: Record<string, string> = {
  openrouter: "OpenRouter", anthropic: "Anthropic", openai: "OpenAI", deepseek: "DeepSeek", zai: "Z.ai",
  google: "Google", gemini: "Google", ollama: "Ollama", mistral: "Mistral", xai: "xAI", groq: "Groq",
  moonshot: "Moonshot", dashscope: "DashScope", zhipu: "Zhipu", "aion-labs": "Aion Labs", "meta-llama": "Meta",
  qwen: "Qwen", cohere: "Cohere", lmstudio: "LM Studio",
};

/** `provider:openrouter`, `credential:openrouter` or `openrouter` → "openrouter". */
export function providerId(ref: string): string {
  return ref.replace(/^(provider|credential):/, "").trim().toLowerCase();
}

export function providerName(ref: string): string {
  const id = providerId(ref);
  return PROVIDER_NAMES[id] ?? titleCase(id);
}

// ---------------------------------------------------------------------------
// harnesses (§3.2)

/** Ready: an AIKit adapter exists and the harness is on this machine. */
export function readyHarnesses(reading: SystemDisclosureReading): HarnessRow[] {
  const rows = reading.harness.harnesses.state === "ok" ? reading.harness.harnesses.rows : [];
  return rows.filter((row) => row.detected && row.capability === "descriptor");
}

export function adapterNeeded(reading: SystemDisclosureReading): HarnessRow[] {
  const rows = reading.harness.harnesses.state === "ok" ? reading.harness.harnesses.rows : [];
  return rows.filter((row) => row.detected && row.capability !== "descriptor");
}

export function notFound(reading: SystemDisclosureReading): HarnessRow[] {
  const rows = reading.harness.harnesses.state === "ok" ? reading.harness.harnesses.rows : [];
  return rows.filter((row) => !row.detected);
}

/** The owner's effect text, as a sentence a person reads. */
export function harnessEffect(row: HarnessRow): string | null {
  if (!row.effect) return null;
  const first = row.effect.split(" — ")[0].trim();
  if (/^brokered$/i.test(first)) return "Skills brokered through AIKit";
  if (/^restart /i.test(first)) return `${first.charAt(0).toUpperCase()}${first.slice(1)} to apply`;
  if (/^live$/i.test(first)) return "Takes effect now";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function harnessItems(row: HarnessRow): string | null {
  if (row.items === null) return null;
  const noun = row.items === 1 ? "skill" : "skills";
  return row.installed ? `${row.items} ${noun} projected` : `${row.items} ${noun} ready to project`;
}

// ---------------------------------------------------------------------------
// credentials (§3.4)

export interface CredentialCard {
  provider: string;
  label: string;
  /** The ref Settings binds under (`credential:<provider>`). */
  credential: string;
  binding: CredentialBinding | null;
  /** How many catalogued models name this provider's key on a route. */
  modelsNeeding: number;
}

/** The providers that matter (§3.4), then any other credential the owner
 * holds a binding for. */
export const KEY_PROVIDERS = ["openrouter", "anthropic", "openai", "deepseek", "zai"] as const;

export function bindingFor(bindings: CredentialBinding[], provider: string): CredentialBinding | null {
  const matches = bindings.filter((binding) => providerId(binding.credential) === provider);
  return matches.find((binding) => !binding.revoked) ?? matches[0] ?? null;
}

export function credentialCards(data: SettingsSnapshot): CredentialCard[] {
  const bindings = data.credentials.state === "ok" ? data.credentials.value.bindings : [];
  const entries = data.suite.state === "ok" && data.suite.value.harness.catalogue.state === "ok" ? data.suite.value.harness.catalogue.rows.entries : [];
  const providers: string[] = [...KEY_PROVIDERS];
  for (const binding of bindings) {
    const id = providerId(binding.credential);
    if (id && !providers.includes(id)) providers.push(id);
  }
  return providers.map((provider) => {
    const binding = bindingFor(bindings, provider);
    return {
      provider,
      label: providerName(provider),
      credential: binding?.credential ?? `credential:${provider}`,
      binding,
      modelsNeeding: entries.filter((entry) => entry.routes.some((route) => route.credential_required && providerId(route.provider) === provider)).length,
    };
  });
}

/** Where a binding keeps its material, in words. */
export function storedIn(binding: CredentialBinding): string {
  const ref = binding.declared_secret_ref ?? "";
  if (ref.startsWith("varlock://")) return "varlock";
  if (ref.startsWith("op://")) return "1Password";
  if (ref.startsWith("pass://")) return "pass";
  if (ref.startsWith("keychain://")) return "Keychain item";
  if (binding.tier === "os-secure-store" || binding.provenance.startsWith("macos-keychain")) return "Keychain";
  if (binding.provenance.startsWith("linux-secret-service")) return "Secret Service";
  return "AIKit";
}

// ---------------------------------------------------------------------------
// models (§3.3, S14)

const LOCAL_PROVIDERS = /^(ollama|lmstudio|llama-?cpp|local.*)$/;

export type Availability =
  | {state: "usable"; via: string}
  | {state: "local"; via: string}
  | {state: "needs-key"; provider: string}
  | {state: "unrouted"};

/** The providers whose keys are bound (and not revoked). */
export function boundProviders(bindings: CredentialBinding[]): Set<string> {
  return new Set(bindings.filter((binding) => !binding.revoked).map((binding) => providerId(binding.credential)));
}

/** Join a model's declared routes with the BOUND credentials. The route's
 * own "credential required" never flips when a key is bound — the join is
 * what answers whether the model can be reached (12 §3.3). */
export function modelAvailability(entry: CatalogueEntry, bound: Set<string>): Availability {
  const local = entry.routes.find((route) => LOCAL_PROVIDERS.test(providerId(route.provider)));
  if (local && !local.credential_required) return {state: "local", via: providerId(local.provider)};
  const native = entry.routes.filter((route) => route.kind === "provider-native");
  const reachable = [...native, ...entry.routes.filter((route) => route.kind !== "provider-native")]
    .find((route) => !route.credential_required || bound.has(providerId(route.provider)));
  if (reachable) return {state: "usable", via: providerId(reachable.provider)};
  const wanted = native[0] ?? entry.routes[0];
  return wanted ? {state: "needs-key", provider: providerId(wanted.provider)} : {state: "unrouted"};
}

export function availabilityWords(availability: Availability): {chip: string; line: string} {
  switch (availability.state) {
    case "usable": return {chip: "Usable", line: `via ${providerName(availability.via)}`};
    case "local": return {chip: "Local", line: `${providerName(availability.via)} · no key needed`};
    case "needs-key": return {chip: `Needs ${/^[aeiou]/i.test(providerName(availability.provider)) ? "an" : "a"} ${providerName(availability.provider)} key`, line: "Add the key in Credentials"};
    case "unrouted": return {chip: "No route", line: "The catalogue declares no way to reach it"};
  }
}

/** The group a model sits under in the picker: its own maker's provider. */
export function modelGroup(entry: CatalogueEntry): string {
  const native = entry.routes.find((route) => route.kind === "provider-native") ?? entry.routes[0];
  return native ? providerName(native.provider) : "Other";
}

/** The eight ranking policies, in plain words (`aikit compose --help`). */
export const RANKING_POLICIES: readonly {id: string; label: string}[] = [
  {id: "BALANCED", label: "Balanced"},
  {id: "CHEAPEST_ELIGIBLE", label: "Cheapest that fits"},
  {id: "TASK_FIT", label: "Best for the task"},
  {id: "ROLE_FIT", label: "Best for the role"},
  {id: "PROFILE_FIT", label: "Best for the profile"},
  {id: "QUALITY_UNDER_BUDGET", label: "Best quality under budget"},
  {id: "INDEPENDENT_REVIEWER", label: "Independent reviewer"},
  {id: "LOCAL_INSPECTABILITY", label: "Local and inspectable"},
];

// ---------------------------------------------------------------------------
// skills (§3.5)

export interface SkillItem {
  id: string;
  name: string;
  kind: string;
  source: string;
  active: boolean;
  description: string | null;
}

export function skillCounts(reading: SystemDisclosureReading): {active: number; total: number} | null {
  if (reading.disclosure.state !== "ok") return null;
  const skills = reading.disclosure.rows.skills;
  return {active: skills.filter((skill) => skill.active).length, total: skills.length};
}

/** `skill/aikit/wiki-inhabitation` → kind "skill", source "aikit". The
 * per-skill local sources (`local-…`) read as one "local" source. */
export function skillParts(id: string): {kind: string; source: string} {
  const [kind = "", source = ""] = id.split("/");
  return {kind, source: source.startsWith("local-") ? "local" : source};
}

export function groupSkills(items: SkillItem[]): [string, SkillItem[]][] {
  const groups = new Map<string, SkillItem[]>();
  for (const item of items) {
    const list = groups.get(item.source) ?? [];
    list.push(item);
    groups.set(item.source, list);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

// ---------------------------------------------------------------------------
// the change model's plain words (§2)

/** The effect of a change in the owner's effect kind, in plain words. */
export function effectInWords(kind: string, harness?: string): string {
  switch (kind) {
    case "value-change": return "Takes effect now";
    case "restart-required": return `Restart ${harness ?? "the harness"} to apply`;
    case "session-restart-required": return "Next session only";
    case "provider-reconnect-required": return "Reconnects the provider";
    case "material-effect": return "Changes files on this machine";
    case "new-chats": return "New chats only";
    case "none": return "Nothing to apply";
    default: return "The owner hasn't said when this takes effect";
  }
}

export function onOff(value: boolean): string {
  return value ? "on" : "off";
}

/** A value, briefly, for from → to lines (never JSON). */
export function briefValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "not set";
  if (typeof value === "boolean") return onOff(value);
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "none" : value.every((item) => typeof item !== "object") ? value.join(", ") : `${value.length} items`;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return keys.length === 0 ? "none" : `${keys.length} ${keys.length === 1 ? "entry" : "entries"}`;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// permissions (§3.7)

/** Permission-mode settings in AIKit's contribution (any harness section
 * whose setting names a permission mode). */
export function permissionModeEntries(data: SettingsSnapshot): SettingEntry[] {
  if (data.registry.state !== "ok") return [];
  return data.registry.value.entries.filter((entry) => /permission/i.test(entry.setting.setting_ref) && /mode/i.test(entry.setting.setting_ref) && entry.setting.value_schema.type === "enum");
}

/** The harnesses' own trust and guardrail rows AIKit discloses. */
export function trustEntries(data: SettingsSnapshot): SettingEntry[] {
  if (data.registry.state !== "ok") return [];
  const harnessSections = new Set(["claude-code", "codex", "zcode", "pi", "gemini", "hermes"]);
  return data.registry.value.entries.filter((entry) => entry.owner.owner_ref === "ai-kit" && harnessSections.has(entry.setting.setting_ref.split(":")[1] ?? "") && !/permission.*mode/i.test(entry.setting.setting_ref));
}
