/** Settings → Visuals: preferences only. The actual Expressions application
 * is entered through the workspace mode route; there is no second workbench,
 * preview stage, scene store, or renderer under Settings. */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {IconChoiceStrip} from "../primitives/IconTabStrip";
import { useVisuals } from "../../visuals/ParticleExpression";
import type { StagePresentation } from "../../stage/ExpressionStage";
import { visuals, type SavedState, type ThemeChoice } from "../../visuals/store";
import { PRESETS } from "@epilogos/oi-design-system/point-cloud/presets";
import { CONTROL_SCHEMA, readPath, type PointCloudConfig, type PointCloudPatch } from "@epilogos/oi-design-system/point-cloud/config";
import { THEMES } from "@epilogos/oi-design-system/themes/index";
import { listCustomThemes, importTheme, removeCustomTheme } from "../../visuals/customThemes";
import "./visuals.css";

const QUICK_CHARS = ["✦", "✧", "★", "∞", "Ω", "∑", "∫", "⌘", "⌥", "§", "λ", "☯"];
const THEME_CHOICES: ReadonlyArray<{value: ThemeChoice; label: string; hint: string}> = [
  {value: "light", label: "Light", hint: "Use the light appearance"},
  {value: "dark", label: "Dark", hint: "Use the dark appearance"},
  {value: "system", label: "System", hint: "Follow this device's appearance"},
];

/** One picker card: a bundled corpus theme or an imported file. */
interface LibraryEntry {
  id: string;
  name: string;
  appearance: "light" | "dark";
  preview: { ground: string; ink: string; accent: string; strip: string[] };
  origin: string;
  license: string;
  custom: boolean;
}

export function VisualsView() {
  const {snapshot} = useVisuals();
  const [customs, setCustoms] = useState(listCustomThemes);
  const [importFailure, setImportFailure] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const library: LibraryEntry[] = [
    ...THEMES.map((theme) => ({id: theme.id, name: theme.name, appearance: theme.appearance, preview: theme.preview, origin: theme.source.name, license: theme.source.license, custom: false})),
    ...customs.map((theme) => ({id: theme.id, name: theme.name, appearance: theme.appearance, preview: theme.preview, origin: "Imported", license: "not recorded", custom: true})),
  ];
  const activeImport = customs.find((theme) => theme.id === snapshot.themeId) ?? null;
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setImportFailure(null);
      const theme = importTheme(await file.text(), file.name);
      setCustoms(listCustomThemes());
      visuals.setNamedTheme(theme);
    } catch (cause) {
      setImportFailure(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const removeActiveImport = () => {
    if (!activeImport) return;
    removeCustomTheme(activeImport.id);
    setCustoms(listCustomThemes());
    if (snapshot.themeId === activeImport.id) visuals.setTheme("system");
  };
  return <div className="settings-view visuals-preferences" aria-label="Appearance preferences">
    <section aria-labelledby="appearance-heading">
      <h3 id="appearance-heading">Appearance</h3>
      <p className="settings-note">The same appearance follows your workspace, tools and document controls.</p>
      <IconChoiceStrip aria-label="Appearance" current={snapshot.themeId===null?snapshot.theme:undefined} onSelect={value=>visuals.setTheme(value as ThemeChoice)}
        items={THEME_CHOICES.map(option=>({id:option.value,label:option.label,description:option.hint,icon:"settings"}))}/>

      <p className="settings-note">Or pick a theme from the library: each recolours the shell, editors and terminal.</p>
      <div className="visuals-themes" role="group" aria-label="Theme library">
        {library.map(theme=>{
          const active = snapshot.themeId === theme.id;
          return <button key={theme.id} type="button" className={active?"visuals-theme is-active":"visuals-theme"} aria-pressed={active}
            title={`${theme.name} (${theme.appearance}) — ${theme.custom ? "imported file, license not recorded" : `${theme.origin} under ${theme.license}`}`}
            onClick={()=>visuals.setNamedTheme(theme)}>
            <span className="visuals-theme-swatch" style={{background: theme.preview.ground}}>
              <span className="visuals-theme-word" style={{color: theme.preview.ink}}>A</span>
              <span className="visuals-theme-strip">
                {theme.preview.strip.map((color, at)=><i key={at} style={{background: color}} />)}
              </span>
            </span>
            <span className="visuals-theme-name">{theme.name}</span>
            <span className="visuals-theme-origin">{theme.origin}</span>
          </button>;
        })}
      </div>
      <div className="visuals-import-row">
        <input ref={fileInput} type="file" accept=".json,.jsonc,application/json" aria-label="Import a theme file" className="visuals-file-input" onChange={importFile}/>
        <button type="button" className="oi-action" onClick={()=>fileInput.current?.click()}>Import a theme file…</button>
        <p className="settings-note">Any VS Code color theme (.json) — converted into the app's roles and kept on this device.</p>
      </div>
      {importFailure && <p className="oi-refusal" role="alert">{importFailure}</p>}
      {activeImport && <button type="button" className="settings-mini" onClick={removeActiveImport}>Remove “{activeImport.name}”</button>}
    </section>
    <section aria-labelledby="opening-heading">
      <h3 id="opening-heading">Opening</h3>
      <label className="visuals-check"><input type="checkbox" checked={snapshot.welcomeEnabled} disabled={!snapshot.enabled} onChange={event=>visuals.setWelcomeEnabled(event.target.checked)}/>Show the welcome mark when the app opens</label>
      <label className="visuals-check"><input type="checkbox" checked={snapshot.enabled} onChange={event=>visuals.setEnabled(event.target.checked)}/>Enable the shared visual layer</label>
      <p className="settings-note">Turning the visual layer off releases its renderer. Your saved work and theme are kept.</p>
    </section>
    <p className="settings-note">Scenes, composition and animation belong in Expressions.</p>
    <button type="button" className="settings-mini" onClick={()=>window.dispatchEvent(new CustomEvent("oi:host-workspace-mode", {detail:{mode:"expressions"}}))}>Open Expressions</button>
  </div>;
}

/** Optional controls for a host's own standing presentation. Settings does
 * not acquire a presentation; the real Expressions application owns its canvas. */
export interface ExpressionControlsHost {
  presentation: () => StagePresentation | null;
  ready: boolean;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
}

/**
 * The FULL engine control set over the visuals store: text targets, presets,
 * material, fluid, relational, pointer, morph, field actions, saved states,
 * config import/export and diagnostics. Every value flows through the
 * validated visual-preference owner; field actions operate on the HOST's
 * presentation. It renders a fragment of groups so a host lays them out in
 * its own container (for example, the Expressions Studio dock).
 * `editableValues` swaps each slider's read-only value for a direct numeric
 * entry (the Studio's label–slider–number row).
 */
export function ExpressionControls({ host, editableValues = false }: { host: ExpressionControlsHost; editableValues?: boolean }) {
  const { snapshot } = useVisuals();
  const config = snapshot.config;
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const { presentation, ready, paused, onPausedChange } = host;
  const readTelemetry = useCallback(() => {
    try { return presentation()?.telemetry() ?? null; } catch { return null; }
  }, [presentation]);
  const slider = (path: string) => <Slider path={path} config={config} editable={editableValues} />;
  return (
    <>
          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Text targets</legend>
            <GlyphInputs config={config} />
            <WordInput />
            <div className="visuals-charrow" role="group" aria-label="Quick characters">
              {QUICK_CHARS.map((char) => (
                <button
                  key={char}
                  type="button"
                  className="oi-chip"
                  title={`Set both glyph targets to ${char}`}
                  onClick={() => visuals.patchConfig({ glyph: [char, char] })}
                >
                  {char}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Presets</legend>
            <div className="visuals-presets">
              {PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="oi-action" title={preset.description} onClick={() => visuals.patchConfig(preset.config as PointCloudPatch)}>
                  {preset.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Material</legend>
            <ToggleRow
              label="Colour"
              value={config.colorMode}
              options={[["followTheme", "Follow theme"], ["blackOnWhite", "Ink on paper"], ["whiteOnBlack", "Paper on ink"]]}
              onPick={(value) => visuals.patchConfig({ colorMode: value as PointCloudConfig["colorMode"] })}
            />
            <ToggleRow
              label="Render"
              value={config.style}
              options={[["stipple", "Stipple"], ["halftone", "Halftone"]]}
              onPick={(value) => visuals.patchConfig({ style: value as PointCloudConfig["style"] })}
            />
            <ToggleRow
              label="Dot shape"
              value={config.dotShape}
              options={[["circle", "Circle"], ["square", "Square"]]}
              onPick={(value) => visuals.patchConfig({ dotShape: value as PointCloudConfig["dotShape"] })}
            />
            {slider("particle.count")}
            {slider("particle.sizeMin")}
            {slider("particle.sizeMax")}
          </fieldset>

          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Fluid</legend>
            {slider("fluid.curlScale")}
            {slider("fluid.curlSpeed")}
            {slider("fluid.vortexStrength")}
            {slider("fluid.viscosity")}
            {slider("fluid.returnSpeed")}
            {slider("fluid.turbulence")}
            {slider("fluid.dispersion")}
          </fieldset>

          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Relational system</legend>
            <button
              type="button"
              className={config.relational.enabled ? "oi-action oi-action-primary" : "oi-action"}
              aria-pressed={config.relational.enabled}
              onClick={() => visuals.patchConfig({ relational: { enabled: !config.relational.enabled } })}
            >
              {config.relational.enabled ? "Relational: On" : "Relational: Off"}
            </button>
            <ToggleRow
              label="Mode"
              value={config.relational.mode}
              options={[["orbital", "Orbital"], ["chaos", "Chaos"], ["nbody", "N-body"]]}
              onPick={(value) => visuals.patchConfig({ relational: { mode: value as PointCloudConfig["relational"]["mode"] } })}
            />
            {slider("relational.attractorCount")}
            {slider("relational.attractorGravity")}
            {slider("relational.orbitSpeed")}
            {slider("relational.orbitRadius")}
            {slider("relational.relationalSpin")}
            {slider("relational.chaosFactor")}
            {slider("relational.wanderSpeed")}
          </fieldset>

          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Pointer</legend>
            <ToggleRow
              label="Force"
              value={config.interaction.mode}
              options={[["repel", "Repel"], ["attract", "Attract"], ["vortex", "Vortex"]]}
              onPick={(value) => visuals.patchConfig({ interaction: { mode: value as PointCloudConfig["interaction"]["mode"] } })}
            />
            {slider("interaction.radius")}
            {slider("interaction.strength")}
          </fieldset>

          <fieldset className="visuals-group">
            <legend className="oi-eyebrow">Morph</legend>
            <button
              type="button"
              className={config.autoMorph ? "oi-action oi-action-primary" : "oi-action"}
              aria-pressed={config.autoMorph}
              onClick={() => visuals.patchConfig({ autoMorph: !config.autoMorph })}
            >
              {config.autoMorph ? "Auto-morphing" : "Morph manual"}
            </button>
            {slider("morphProgress")}
            {slider("autoMorphDuration")}
          </fieldset>

          <div className="oi-action-group visuals-actions" role="group" aria-label="Field actions">
            <button type="button" className="oi-action" disabled={!ready} onClick={() => presentation()?.command({ type: "disperse", strength: 3.5 })}>Disperse</button>
            <button
              type="button"
              className="oi-action"
              disabled={!ready}
              aria-pressed={paused}
              onClick={() => {
                onPausedChange(!paused);
              }}
            >
              {paused ? "Resume simulation" : "Pause simulation"}
            </button>
            <button type="button" className="oi-action" disabled={!ready} onClick={() => presentation()?.command({ type: "reset-field" })}>Reset field</button>
            <button type="button" className="oi-action" onClick={() => visuals.resetConfig()}>Restore defaults</button>
            <button
              type="button"
              className="oi-action"
              disabled={!ready}
              onClick={() => {
                const standing = presentation();
                if (!standing) return;
                try {
                  const canvas = standing.capture();
                  const url = canvas.toDataURL("image/png");
                  const anchor = window.document.createElement("a");
                  anchor.href = url;
                  anchor.download = "expression-capture.png";
                  anchor.click();
                  setCaptureNotice(null);
                } catch (cause) {
                  setCaptureNotice(cause instanceof Error ? cause.message : String(cause));
                }
              }}
            >
              Capture image
            </button>
          </div>
          {captureNotice && <p className="oi-refusal" role="alert">{captureNotice}</p>}

          <SavedStates states={snapshot.savedStates} />

          <ImportExport />

          <Diagnostics read={readTelemetry} />
    </>
  );
}

function SavedStates({ states }: { states: SavedState[] }) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <fieldset className="visuals-group">
      <legend className="oi-eyebrow">Saved states</legend>
      <form
        className="visuals-word"
        onSubmit={(event) => {
          event.preventDefault();
          visuals.saveState(name);
          setName("");
          setNotice(`Saved "${name.trim() || "Config"}"`);
        }}
      >
        <label className="oi-field">Name
          <input className="oi-input" type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name this recipe" />
        </label>
        <button type="submit" className="oi-action">Save current</button>
      </form>
      {notice && <p className="oi-note">{notice}</p>}
      <ul className="visuals-states">
        {states.map((state) => (
          <li key={state.id} className="oi-row">
            <span className="oi-row-title visuals-state-name">{state.name}</span>
            <span className="visuals-state-actions">
              <button type="button" className="oi-action" onClick={() => {
                visuals.loadState(state.id);
                setNotice(`Loaded "${state.name}"`);
              }}>Load</button>
              <button type="button" className="oi-action" onClick={() => {
                void navigator.clipboard?.writeText(visuals.exportState(state.id));
                setNotice(`Copied "${state.name}" JSON to the clipboard`);
              }}>Copy JSON</button>
              {state.id !== "oi_logo_mark" && (
                <button type="button" className="oi-action" onClick={() => visuals.deleteState(state.id)}>Delete</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function GlyphInputs({ config }: { config: PointCloudConfig }) {
  const glyphA = Array.isArray(config.glyph) ? config.glyph[0] : config.glyph;
  const glyphB = Array.isArray(config.glyph) ? (config.glyph[1] ?? glyphA) : glyphA;
  return (
    <div className="visuals-glyphs">
      <label className="oi-field">Glyph A
        <DebouncedText value={glyphA} onCommit={(value) => visuals.patchPath("glyph.0", value)} placeholder="O" />
      </label>
      <label className="oi-field">Glyph B
        <DebouncedText value={glyphB} onCommit={(value) => visuals.patchPath("glyph.1", value)} placeholder="I" />
      </label>
    </div>
  );
}

function WordInput() {
  const [text, setText] = useState("");
  return (
    <form
      className="visuals-word"
      onSubmit={(event) => {
        event.preventDefault();
        const word = text.trim();
        if (!word) return;
        visuals.patchConfig({ glyph: [word, word] });
      }}
    >
      <label className="oi-field">Type any word or phrase
        <input
          className="oi-input"
          type="text"
          value={text}
          placeholder="e.g. FLUID, VOID, 42"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" className="oi-action" disabled={!text.trim()}>Bake word</button>
    </form>
  );
}

/** Text commits are debounced: each keystroke would otherwise re-bake the
 * glyph targets; a pause in typing costs one bake. */
function DebouncedText({ value, onCommit, placeholder }: { value: string; onCommit: (value: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  return <input
    className="oi-input"
    type="text"
    value={draft ?? value}
    placeholder={placeholder}
    onChange={(event) => {
      const next = event.target.value;
      setDraft(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setDraft(null);
        if (next.trim()) onCommit(next);
      }, 350);
    }}
  />;
}

function Slider({ path, config, editable = false }: { path: string; config: PointCloudConfig; editable?: boolean }) {
  const spec = CONTROL_SCHEMA[path];
  if (!spec) return null;
  const value = readPath(config, path);
  const commit = (parsed: number) => visuals.patchConfig(pathToPatch(path, parsed));
  return (
    <label className="visuals-slider">
      <span className="visuals-slider-label">{spec.label}</span>
      <input
        type="range"
        className="oi-range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={typeof value === "number" ? value : spec.min}
        onChange={(event) => {
          const parsed = spec.integer ? parseInt(event.target.value, 10) : parseFloat(event.target.value);
          commit(parsed);
        }}
      />
      {editable
        ? <SliderNumber label={spec.label} value={typeof value === "number" ? value : null} min={spec.min} max={spec.max} integer={!!spec.integer} onCommit={commit} />
        : <output className="visuals-slider-value">{typeof value === "number" ? value : "—"}</output>}
    </label>
  );
}

/** Direct numeric entry beside a slider (Studio density). The draft commits
 * on Enter or blur, clamped to the control's own bounds; Escape restores the
 * owner's value. The owner validates again on write. */
function SliderNumber({ label, value, min, max, integer, onCommit }: { label: string; value: number | null; min: number; max: number; integer: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));
  const settle = () => {
    if (draft === null) return;
    const parsed = integer ? parseInt(draft, 10) : parseFloat(draft);
    setDraft(null);
    if (Number.isFinite(parsed)) onCommit(Math.min(max, Math.max(min, parsed)));
  };
  return <input
    className="visuals-slider-number"
    type="text"
    inputMode="decimal"
    aria-label={`${label} value`}
    value={shown}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={settle}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); settle(); }
      else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(null); }
    }}
  />;
}

function pathToPatch(path: string, value: number): PointCloudPatch {
  const dot = path.indexOf(".");
  if (dot < 0) return { [path]: value } as unknown as PointCloudPatch;
  const head = path.slice(0, dot);
  const sub = path.slice(dot + 1);
  return { [head]: { [sub]: value } } as unknown as PointCloudPatch;
}

function ToggleRow({ label, value, options, onPick }: {
  label: string;
  value: string;
  options: [string, string][];
  onPick: (value: string) => void;
}) {
  return (
    <div className="visuals-row">
      <span className="visuals-slider-label">{label}</span>
      <IconChoiceStrip aria-label={label} current={value} onSelect={onPick} items={options.map(([id,optionLabel])=>({id,label:optionLabel,icon:"dot"}))}/>

    </div>
  );
}

function ImportExport() {
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <fieldset className="visuals-group">
      <legend className="oi-eyebrow">Import config JSON</legend>
      <textarea
        className="visuals-import oi-input"
        rows={4}
        value={text}
        placeholder='{"glyph":["O","I"], …} — validated against the shared schema'
        onChange={(event) => setText(event.target.value)}
      />
      {failure && <p className="oi-refusal" role="alert">{failure}</p>}
      <div className="oi-action-group visuals-actions">
        <button
          type="button"
          className="oi-action oi-action-primary"
          onClick={() => {
            try {
              setFailure(null);
              visuals.importJson(text);
              setText("");
            } catch (cause) {
              setFailure(cause instanceof Error ? cause.message : String(cause));
            }
          }}
          disabled={!text.trim()}
        >
          Apply JSON
        </button>
        <button
          type="button"
          className="oi-action"
          onClick={() => {
            const current = visuals.get();
            void navigator.clipboard?.writeText(JSON.stringify(current.config, null, 2));
          }}
        >
          Copy current config
        </button>
      </div>
    </fieldset>
  );
}

function Diagnostics({ read }: { read: () => unknown }) {
  const [reading, setReading] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const tick = () => setReading(read() as Record<string, unknown> | null);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [read]);
  const summary = useMemo(() => {
    if (!reading) return null;
    const config = (reading.config ?? {}) as { entities?: Array<{ name?: string; shape?: { text?: string } }> };
    const lines = [
      `Renderer: native engine · ${reading.live ? "live" : "idle"} · one simulation clock`,
      `Background: ${String(reading.background ?? "—")} · transition ${String(reading.transition ?? "—")}`,
    ];
    const entities = Array.isArray(config.entities) ? config.entities : [];
    for (const entity of entities) {
      const text = entity.shape?.text;
      if (text) lines.push(`Entity: ${entity.name ?? "unnamed"} — glyph ${JSON.stringify(text)}`);
    }
    return lines.join("\n");
  }, [reading]);
  if (!reading) return null;
  return (
    <details className="visuals-diagnostics oi-disclosure">
      <summary>Diagnostics</summary>
      <pre className="oi-ref">{summary}</pre>
    </details>
  );
}
