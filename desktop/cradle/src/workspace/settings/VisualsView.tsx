/**
 * Settings → Visuals: Themes and Expression.
 *
 * Themes: explicit light/dark/system selection resolved through the shell's
 * semantic tokens (the VisualsProvider applies them to the `oi-desktop`
 * body; nothing here invents colours).
 *
 * Expression hosts the FULL control set of the particle engine — the same
 * parameters the reference instrument exposes — plus the two desktop asks:
 * a master on/off switch that is unambiguous, and typed text targets
 * (glyph A/B and arbitrary words). The panel is a controller of the
 * instrument, never its owner: every value flows through the validated
 * visual-preference owner. The preview places the window's shared Expression
 * stage in this box; it never creates a component-level renderer.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useVisuals } from "../../visuals/ParticleExpression";
import { useExpressionStage, type StagePresentation } from "../../stage/ExpressionStage";
import {
  visuals,
  type SavedState,
  type ThemeChoice,
} from "../../visuals/store";
import {
  PRESETS,
} from "@epilogos/oi-design-system/point-cloud/presets";
import {
  CONTROL_SCHEMA,
  readPath,
  type PointCloudConfig,
  type PointCloudPatch,
} from "@epilogos/oi-design-system/point-cloud/config";
import "./visuals.css";
import {ExpressionView as ApplicationExpressionView} from "../../expression/ExpressionView";

type ExpressionSubview = "themes" | "expression" | "compose";

const QUICK_CHARS = ["✦", "✧", "★", "∞", "Ω", "∑", "∫", "⌘", "⌥", "§", "λ", "☯"];

export function VisualsView() {
  const { snapshot } = useVisuals();
  const [subview, setSubview] = useState<ExpressionSubview>("expression");
  return <div className="settings-view">
    <h3>Visuals</h3>
    <nav className="settings-rail visuals-subrail" aria-label="Visuals views">
      <button aria-pressed={subview === "compose"} onClick={() => setSubview("compose")}>Compose</button>
      <button aria-pressed={subview === "themes"} onClick={() => setSubview("themes")}>Themes</button>
      <button aria-pressed={subview === "expression"} onClick={() => setSubview("expression")}>Expression</button>
    </nav>
    {subview === "themes" && <ThemesView theme={snapshot.theme} />}
    {subview === "expression" && <ExpressionView />}
    {subview === "compose" && <ApplicationExpressionView />}
  </div>;
}

function ThemesView({ theme }: { theme: ThemeChoice }) {
  const options: { value: ThemeChoice; label: string; hint: string }[] = [
    { value: "light", label: "Light", hint: "The day palette" },
    { value: "dark", label: "Dark", hint: "The night palette" },
    { value: "system", label: "System", hint: "Follow the OS appearance" },
  ];
  return <div className="settings-view">
    <p className="settings-native-note">Appearance resolves through the shell's semantic tokens; the expression ink follows the theme unless overridden below.</p>
    <div className="oi-segment" role="group" aria-label="Appearance">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={theme === option.value}
          title={option.hint}
          onClick={() => visuals.setTheme(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>;
}

/** What the engine control set needs from whoever hosts the field: the
 * presentation its field actions (disperse, pause, reset, capture) and its
 * diagnostics operate on. The Settings preview below is one host; the
 * Expressions centre surface's artboard is another. The controls never
 * acquire a presentation of their own. */
export interface ExpressionControlsHost {
  /** The standing presentation, or null when none stands. Stable identity. */
  presentation: () => StagePresentation | null;
  ready: boolean;
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
}

function ExpressionView() {
  const { snapshot } = useVisuals();
  const stage = useExpressionStage();
  const previewId = `oi-visuals-preview${useId()}`;
  const config = snapshot.config;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const presentationRef = useRef<StagePresentation | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [previewForceMotion, setPreviewForceMotion] = useState(false);
  const latest = useRef({config, previewPaused, previewForceMotion});
  latest.current = {config, previewPaused, previewForceMotion};
  const surfaceError = stage.error ?? previewError;
  const currentPresentation = useCallback(() => presentationRef.current, []);

  // Acquire the one window stage, then move its existing canvas/context into
  // the preview. Provider readiness retries acquisition; navigation releases
  // the presentation and returns the canvas to its window home.
  useEffect(() => {
    setPreviewError(null);
    setPreviewReady(false);
    if (!snapshot.enabled) return;
    const container = containerRef.current;
    if (!container) return;
    let presentation: StagePresentation | null = null;
    try {
      presentation = stage.present({id: previewId, plane: "overlay", recipe: "",
        config: latest.current.config as unknown as Record<string, unknown>,
        sceneRef: previewId,
        paused: latest.current.previewPaused, forceMotion: latest.current.previewForceMotion});
      if (!presentation) return;
      presentation.setContainer(container);
      presentationRef.current = presentation;
      setPreviewReady(true);
    } catch (cause) {
      presentation?.release();
      setPreviewError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      presentation?.release();
      if (presentationRef.current === presentation) presentationRef.current = null;
    };
  }, [snapshot.enabled, stage, previewId, retry]);

  // Accepted writes re-present the owner's document — one migration per
  // revision; the store's own emission is the coalescing point.
  useEffect(() => {
    presentationRef.current?.updateConfig(config as unknown as Record<string, unknown>, previewId, []);
  }, [config, previewId]);

  // These settings belong only to this presentation and are restored on
  // re-enable. Releasing the handle clears its deliberate motion override.
  useEffect(() => {
    presentationRef.current?.setPaused(previewPaused);
  }, [previewPaused]);
  useEffect(() => {
    presentationRef.current?.setForceMotion(previewForceMotion);
  }, [previewForceMotion]);

  return (
    <div className="visuals-expression">
      <div className="visuals-master oi-card">
        <div className="oi-panel-head">
          <span className="oi-panel-head-title">Expression layer</span>
          <div className="oi-panel-head-tools">
            <button
              type="button"
              className={snapshot.enabled ? "oi-action oi-action-primary" : "oi-action"}
              aria-pressed={snapshot.enabled}
              onClick={() => visuals.setEnabled(!snapshot.enabled)}
            >
              {snapshot.enabled ? "Expression: On" : "Expression: Off"}
            </button>
          </div>
        </div>
        <div className="visuals-master-body">
          <p className="oi-note">
            {snapshot.enabled
              ? "Expression is enabled. Off removes the renderer entirely — nothing runs hidden."
              : "Off is absolute: no renderer, no simulation, no resources held."}
          </p>
          <label className="visuals-check">
            <input
              type="checkbox"
              checked={snapshot.welcomeEnabled}
              onChange={(event) => visuals.setWelcomeEnabled(event.target.checked)}
              disabled={!snapshot.enabled}
            />
            Show the welcome mark when the app opens
          </label>
        </div>
      </div>

      {!snapshot.enabled && (
        <p className="oi-empty"><strong>Expression is off.</strong><span>Turn the expression on to see and shape the field.</span></p>
      )}

      {snapshot.enabled && surfaceError && <div className="oi-refusal" role="alert">
        <p>The expression preview is unavailable: {surfaceError}</p>
        {!stage.error && <button type="button" className="oi-action" onClick={() => setRetry((value) => value + 1)}>Retry preview</button>}
      </div>}

      {snapshot.enabled && (
        <>
          {/* The window's production canvas is placed here while acquired. */}
          <div className="visuals-preview">
            <div
              className={surfaceError ? "visuals-preview-stage visuals-preview-stage-empty oi-card" : "visuals-preview-stage oi-card"}
              ref={containerRef}
              style={{ position: "relative" }}
            />
            <label className="visuals-check">
              <input
                type="checkbox"
                checked={previewForceMotion}
                onChange={(event) => setPreviewForceMotion(event.target.checked)}
              />
              Animate the preview even with reduced motion on (deliberate override)
            </label>
          </div>

          <ExpressionControls host={{presentation: currentPresentation, ready: previewReady, paused: previewPaused, onPausedChange: setPreviewPaused}} />
        </>
      )}
    </div>
  );
}

/**
 * The FULL engine control set over the visuals store: text targets, presets,
 * material, fluid, relational, pointer, morph, field actions, saved states,
 * config import/export and diagnostics. Every value flows through the
 * validated visual-preference owner; field actions operate on the HOST's
 * presentation. It renders a fragment of groups so a host lays them out in
 * its own container (Settings: the visuals grid; Expressions: the Studio dock).
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
      <div className="oi-segment" role="group" aria-label={label}>
        {options.map(([option, optionLabel]) => (
          <button key={option} type="button" aria-pressed={value === option} onClick={() => onPick(option)}>
            {optionLabel}
          </button>
        ))}
      </div>
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
