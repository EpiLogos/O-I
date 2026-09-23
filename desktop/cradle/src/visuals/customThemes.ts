/**
 * Runtime-imported themes: VS Code color-theme files a person imports
 * through Settings → Visuals. They convert through the SAME converter as the
 * bundled corpus (oi.theme/v1) and persist in their own localStorage record;
 * their variable blocks ride `data-oi-theme` exactly like bundled themes,
 * carried by one mounted <style> element (the CSP allows inline styles).
 *
 * Only validated role values ever reach the cascade: the converter emits
 * normalized hex colours, rgba() built from them, and the house's fixed
 * shadow strings — arbitrary file content cannot become CSS here.
 */
import { parseJsonc, convertTheme, themeVariables, uniqueThemeId, guessAppearance } from "@epilogos/oi-design-system/themes/convert";
import { THEMES } from "@epilogos/oi-design-system/themes/index";

export interface CustomTheme {
  id: string;
  name: string;
  appearance: "light" | "dark";
  preview: { ground: string; ink: string; accent: string; strip: string[] };
  variables: Record<string, string>;
}

const STORAGE_KEY = "oi-cradle.custom-themes.v1";
const STYLE_ID = "oi-custom-themes";
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_THEMES = 50;

/** Structural validation of a stored record: wrong shapes drop field by field. */
function sanitize(raw: unknown): CustomTheme[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id || typeof record.name !== "string" || !record.name) return [];
    if (record.appearance !== "light" && record.appearance !== "dark") return [];
    const appearance: "light" | "dark" = record.appearance;
    const preview = record.preview as Record<string, unknown> | undefined;
    if (!preview || typeof preview.ground !== "string" || typeof preview.ink !== "string" || typeof preview.accent !== "string" || !Array.isArray(preview.strip)) return [];
    const rawVariables = record.variables;
    if (!rawVariables || typeof rawVariables !== "object") return [];
    const variables: Record<string, string> = {};
    for (const [role, value] of Object.entries(rawVariables)) {
      if (role.startsWith("--oi-") && typeof value === "string") variables[role] = value;
    }
    if (!Object.keys(variables).length) return [];
    return [{
      id: record.id,
      name: record.name,
      appearance,
      preview: { ground: preview.ground, ink: preview.ink, accent: preview.accent, strip: preview.strip.filter((c): c is string => typeof c === "string").slice(0, 3) },
      variables,
    }];
  }).slice(0, MAX_THEMES);
}

function load(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

let themes: CustomTheme[] = typeof localStorage === "undefined" ? [] : load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch {
    // a full or blocked store keeps the session's themes without persisting
  }
}

export function listCustomThemes(): CustomTheme[] {
  return themes;
}

/** The one mounted style element carrying every custom theme's block. */
export function ensureCustomThemeStyles(): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = themes.map((theme) => {
    const lines = Object.entries(theme.variables).map(([role, value]) => `  ${role}: ${value};`);
    return `.oi-desktop[data-oi-theme="${theme.id}"] {\n  color-scheme: ${theme.appearance};\n${lines.join("\n")}\n}`;
  }).join("\n\n");
}

/** Convert a VS Code color-theme file's text and keep it. Throws the plain
 * refusal the settings view shows — never a stack trace. */
export function importTheme(text: string, fileName: string): CustomTheme {
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`${fileName} is empty.`);
  if (trimmed.length > MAX_IMPORT_BYTES) throw new Error(`${fileName} is too large to be a color theme.`);
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
  const taken = new Set<string>([...THEMES.map((theme) => theme.id), ...themes.map((theme) => theme.id)]);
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
  themes = [theme, ...themes].slice(0, MAX_THEMES);
  persist();
  ensureCustomThemeStyles();
  return theme;
}

/** Forget an imported theme. The caller is responsible for clearing a
 * selection that pointed at it. */
export function removeCustomTheme(id: string): void {
  themes = themes.filter((theme) => theme.id !== id);
  persist();
  ensureCustomThemeStyles();
}

// A restarting window re-mounts the imported blocks at module load, so a
// restored data-oi-theme finds its variables before the first React commit.
ensureCustomThemeStyles();
