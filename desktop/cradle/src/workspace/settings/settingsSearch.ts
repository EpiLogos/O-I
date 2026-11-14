/**
 * "Search settings" (12-SETTINGS §1): one index over every section and
 * product page, each entry landing on its exact row. Built from the same
 * snapshot the sections render, and from the census the Harnesses section
 * draws its agents from (the World Model's agents, O-I #1003), so a result
 * never names a row that isn't there.
 */
import {credentialCards, skillParts, titleCase, permissionModeEntries, trustEntries} from "./sectionModel";
import type {SettingsSnapshot} from "./settingsData";
import {settingRowId, skillRowId} from "./changeModel";
import type {SettingsPlace} from "./settingsNav";
import {settingsProducts} from "./settingsProducts";
import {connectionNames, MODEL_DEFAULT_SETTING} from "./harnessCapabilities";
import {agentName, censusConnections, type CensusReading} from "../../agency/census";

export interface SearchEntry {
  label: string;
  where: string;
  place: SettingsPlace;
  row: string | null;
  terms: string;
}

/** `census`: the agents on this machine as the Harnesses section reads them (agency/census.ts `useCensus`). */
export function searchIndex(data: SettingsSnapshot, census: CensusReading): SearchEntry[] {
  const out: SearchEntry[] = [];
  const products = settingsProducts(data);
  const add = (label: string, where: string, place: SettingsPlace, row: string | null, extra = "") =>
    out.push({label, where, place, row, terms: `${label} ${where} ${extra}`.toLowerCase()});
  const section = (id: Extract<SettingsPlace, {kind: "section"}>["id"]): SettingsPlace => ({kind: "section", id});
  const hasModelDefaults = data.registry.state === "ok" && !!data.registry.value.index[MODEL_DEFAULT_SETTING];
  for (const [label, row] of [["Suite version", "card:suite"], ["Secret stores", "card:secret-stores"], ["Capability changes", "card:changes"], ["Drift", null]] as const) add(label, "Status", section("status"), row);
  if (hasModelDefaults) add("Default models for new chats", "Harnesses", section("harnesses"), settingRowId(MODEL_DEFAULT_SETTING), "model choice new chat");
  add("About model policies", "Harnesses", section("harnesses"), "model:ranking-policy", "ranking auto balanced cheapest");
  add("Catalogue", "Harnesses", section("harnesses"), "model:catalogue", "models browse refresh");
  add("Theme and opening", "Appearance", section("appearance"), null, "light dark system visuals");
  add("Default permission mode", "Permissions", section("permissions"), null, "ask accept plan bypass");
  if (data.suite.state === "ok") {
    // The agents are the census's, where the Harnesses section draws them: one entry per agent, landing on its card (`agent:<slug>`),
    // AIKit's client for it adding only the words its card's AIKit detail answers to (sign in, install), never an entry of its own;
    // and, where AIKit keeps model defaults, one per agent a person can talk to, landing on its row under New chats (`model:<slug>`),
    // named as that row names it.
    if (census.state === "read") {
      for (const agent of census.agents) {
        const client = agent.aikit?.client;
        add(agentName(agent), "Harnesses", section("harnesses"), `agent:${agent.slug}`, `${agent.slug} agent harness${agent.aikit ? ` ${typeof client === "string" ? client : ""} sign in login install` : ""}`);
      }
      if (hasModelDefaults) {
        const providers = data.suite.value.harness.providers;
        const rows = censusConnections(census, providers.state === "ok" ? providers.rows : []).map((row) => ({id: row.id, label: row.label, ...(row.protocol ? {protocol: row.protocol} : {})}));
        const names = connectionNames(rows);
        for (const row of rows) add(`Default model for ${names.get(row.id)}`, "Harnesses", section("harnesses"), `model:${row.id}`);
      }
    }
    if (data.suite.value.disclosure.state === "ok") {
      for (const skill of data.suite.value.disclosure.rows.skills) {
        const parts = skillParts(skill.id);
        add(skill.name || skill.id, `Skills · ${titleCase(parts.source)}`, section("skills"), skillRowId({scope_kind: "machine", scope_ref: null}, skill.id), skill.id);
      }
    }
  }
  if (data.credentials.state === "ok") for (const card of credentialCards(data)) add(`${card.label} key`, "Credentials", section("credentials"), `credential:${card.provider}`, "api key credential");
  if (data.registry.state === "ok") {
    const special = new Set([...permissionModeEntries(data), ...trustEntries(data)].map((entry) => entry.setting.setting_ref));
    for (const entry of data.registry.value.entries) {
      const product = products.find((candidate) => candidate.id === entry.owner.owner_ref);
      if (entry.setting.setting_ref === MODEL_DEFAULT_SETTING) continue; // the capability row above owns this setting
      if (special.has(entry.setting.setting_ref)) add(entry.setting.title, "Permissions", section("permissions"), settingRowId(entry.setting.setting_ref), entry.setting.description ?? "");
      else if (product) add(entry.setting.title, product.label, {kind: "product", id: product.id}, settingRowId(entry.setting.setting_ref), entry.setting.description ?? "");
    }
  }
  for (const product of products) add(product.label, "Products", {kind: "product", id: product.id}, null);
  return out;
}

export function searchSettings(index: SearchEntry[], query: string): SearchEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return index
    .filter((entry) => words.every((word) => entry.terms.includes(word)))
    .sort((a, b) => Number(b.label.toLowerCase().startsWith(words[0])) - Number(a.label.toLowerCase().startsWith(words[0])))
    .slice(0, 12);
}
