/** Imported themes are kernel-owned. This module converts explicit file imports
 * and validates the kernel library before projecting it into CSS. Old browser
 * theme records are never silently promoted into authority.
 *
 * The library is checked against themes/import-rules.json, the rules the kernel
 * checks it by (kernel presentation.rs), so the first frame draws a kept theme
 * without the converter; the converter (oi-design-system scripts/convert.mjs)
 * loads when a theme file is first imported (O-I #858 r43: out of the first load). */
import importRules from "@epilogos/oi-design-system/themes/import-rules.json" with { type: "json" };
import { THEMES } from "@epilogos/oi-design-system/themes/index";
import type { PresentationCustomTheme } from "../kernel/types";
export type CustomTheme = PresentationCustomTheme;
const STYLE_ID = "oi-custom-themes";
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_THEMES = 50;
const roles = new Set<string>(importRules.roles);
const shadows: Readonly<Record<string, readonly string[]>> = importRules.shadow_values;
const hex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
function colour(value: string): boolean {
  if (hex(value)) return true;
  const match = /^rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/.exec(value);
  return !!match && match.slice(1,4).every(channel => Number(channel) <= 255) && Number(match[4]) <= 1;
}
/** Reject the entire block: dropping invalid roles would disguise a corrupt library. */
export function validateCustomTheme(raw: unknown): CustomTheme {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The saved theme is not a theme document.");
  const theme = raw as CustomTheme;
  if (typeof theme.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(theme.id) || THEMES.some(entry => entry.id === theme.id)) throw new Error("The imported theme has an invalid or reserved identity.");
  if (typeof theme.name !== "string" || !theme.name.trim() || theme.name.length > 256) throw new Error("The imported theme needs a name of at most 256 characters.");
  if (theme.appearance !== "light" && theme.appearance !== "dark") throw new Error("The imported theme needs a light or dark appearance.");
  if (!theme.preview || !hex(theme.preview.ground) || !hex(theme.preview.ink) || !hex(theme.preview.accent) || !Array.isArray(theme.preview.strip) || theme.preview.strip.length > 3 || !theme.preview.strip.every(hex)) throw new Error("The imported theme has invalid preview colours.");
  if (!theme.variables || typeof theme.variables !== "object" || Array.isArray(theme.variables) || !Object.keys(theme.variables).length) throw new Error("The imported theme has no colour roles.");
  for (const [role,value] of Object.entries(theme.variables)) {
    if (!roles.has(role) || typeof value !== "string" || !(role.startsWith("--oi-shadow-") ? (shadows[role] ?? []).includes(value) : colour(value))) throw new Error(`The imported theme has an unsafe value for ${role}.`);
  }
  return {id:theme.id,name:theme.name,appearance:theme.appearance,preview:{...theme.preview,strip:[...theme.preview.strip]},variables:{...theme.variables}};
}
export function validateCustomThemes(raw: unknown): CustomTheme[] {
  if (!Array.isArray(raw) || raw.length > MAX_THEMES) throw new Error("The saved theme library is invalid.");
  const themes = raw.map(validateCustomTheme);
  if (new Set(themes.map(theme => theme.id)).size !== themes.length) throw new Error("The saved theme library contains duplicate identities.");
  return themes;
}
/** This text can contain only bounded identities, exact roles and safe colour values. */
export function customThemeCss(raw: unknown): string {
  return validateCustomThemes(raw).map(theme => `.oi-desktop[data-oi-theme="${theme.id}"] {\n  color-scheme: ${theme.appearance};\n${Object.entries(theme.variables).map(([role,value]) => `  ${role}: ${value};`).join("\n")}\n}`).join("\n\n");
}
export function ensureCustomThemeStyles(themes: readonly CustomTheme[]): void {
  const css = customThemeCss(themes);
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) { style = document.createElement("style"); style.id = STYLE_ID; document.head.appendChild(style); }
  style.textContent = css;
}

/** Convert a VS Code color-theme file's text and keep it. Refuses with the plain
 * words the settings view shows — never a stack trace. The converter loads here,
 * after the refusals that need none of it. */
export async function convertImportedTheme(text: string, fileName: string, existing: readonly CustomTheme[]): Promise<CustomTheme> {
  if (existing.length >= MAX_THEMES) throw new Error("Remove an imported theme before adding another (50 maximum).");
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`${fileName} is empty.`);
  if (trimmed.length > MAX_IMPORT_BYTES) throw new Error(`${fileName} is too large to be a color theme.`);
  const { parseJsonc, convertTheme, themeVariables, uniqueThemeId, guessAppearance } = await import("@epilogos/oi-design-system/themes/convert");
  let parsed: unknown;
  try {
    parsed = parseJsonc(trimmed);
  } catch (cause) {
    throw new Error(`${fileName} is not a valid theme document: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${fileName} does not look like a VS Code color theme.`);
  const record = parsed as Record<string, unknown>;
  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : fileName.replace(/\.(json|jsonc)$/i, "");
  const appearance = guessAppearance(record);
  const taken = new Set<string>([...THEMES.map((theme) => theme.id), ...existing.map((theme) => theme.id)]);
  const id = uniqueThemeId(name, taken);
  const doc = convertTheme(record, {
    id, name, appearance,
    source: { format: "vscode-color-theme", name, repo: "imported by you", revision: "local file", license: "not recorded", url: fileName },
  });
  const preview = doc.preview;
  if (typeof preview?.ground !== "string" || typeof preview.ink !== "string" || typeof preview.accent !== "string" || !Array.isArray(preview.strip)) {
    throw new Error(`${fileName} could not be converted into a theme for this app.`);
  }
  const theme: CustomTheme = { id, name, appearance, preview, variables: themeVariables(doc) };
  return validateCustomTheme(theme);
}
