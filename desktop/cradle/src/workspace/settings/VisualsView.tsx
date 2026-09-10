/**
 * Settings → Visuals: Themes and Expression.
 *
 * Themes: explicit light/dark/system selection resolved through the shell's
 * semantic tokens (the VisualsProvider applies them to the `oi-desktop`
 * body; nothing here invents colours).
 *
 * Expression hosts the FULL control set of the particle engine — the same
 * parameters the reference demo exposes — plus the two desktop asks: a
 * master on/off switch that is unambiguous, and typed text targets
 * (glyph A/B and arbitrary words). The panel is a controller of the
 * instrument, never its owner: every value flows through the validated
 * visual-preference owner, and the preview below uses the shared window
 * host and its budget.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useVisuals,
  ParticleField,
} from "../../visuals/ParticleExpression";
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
import type { PointCloudHostInspect, PointCloudInstance } from "@epilogos/oi-design-system/point-cloud/host";
import "./visuals.css";

type ExpressionSubview = "themes" | "expression";

const QUICK_CHARS = ["✦", "✧", "★", "∞", "Ω", "∑", "∫", "⌘", "⌥", "§", "λ", "☯"];

export function VisualsView() {
  const { snapshot } = useVisuals();
  const [subview, setSubview] = useState<ExpressionSubview>("expression");
  return <div className="settings-view">
    <h3>Visuals</h3>
    <nav className="settings-rail visuals-subrail" aria-label="Visuals views">
      <button aria-pressed={subview === "themes"} onClick={() => setSubview("themes")}>Themes</button>
      <button aria-pressed={subview === "expression"} onClick={() => setSubview("expression")}>Expression</button>
    </nav>
    {subview === "themes" && <ThemesView theme={snapshot.theme} />}
    {subview === "expression" && <ExpressionView />}
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
    <div className="visuals-row" role="group" aria-label="Appearance">
      {options.map((option) => (
        <button
          key={option.value}
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

function ExpressionView() {
  const { snapshot, host, error } = useVisuals();
  const config = snapshot.config;
  const previewRef = useRef<PointCloudInstance | null>(null);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [previewForceMotion, setPreviewForceMotion] = useState(false);

  return (
    <div className="visuals-expression">
      <div className="visuals-master">
        <button
          className="visuals-master-toggle"
          aria-pressed={snapshot.enabled}
          onClick={() => visuals.setEnabled(!snapshot.enabled)}
        >
          {snapshot.enabled ? "Expression: On" : "Expression: Off"}
        </button>
        <p className="settings-native-note">
          {snapshot.enabled
            ? "The particle layer is live. Off removes the renderer entirely — nothing runs hidden."
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

      {!snapshot.enabled && (
        <p className="settings-native-note">Turn the expression on to see and shape the field.</p>
      )}

      {snapshot.enabled && error && <p role="alert">The expression layer could not start: {error}</p>}

      {snapshot.enabled && (
        <>
          {/* The explicit preview: the only renderer this panel starts,
              through the shared host and its budget. */}
          <div className="visuals-preview">
            {host && !error
              ? <ParticleField
                  id="oi-visuals-preview"
                  tag="preview"
                  config={config}
                  className="visuals-preview-stage"
                  forceMotion={previewForceMotion}
                  onReady={(instance) => {
                    previewRef.current = instance;
                    setPreviewPaused(false);
                  }}
                />
              : <div className="visuals-preview-stage visuals-preview-stage-empty">{error ? "Renderer unavailable" : "Starting renderer…"}</div>}
            <label className="visuals-check">
              <input
                type="checkbox"
                checked={previewForceMotion}
                onChange={(event) => setPreviewForceMotion(event.target.checked)}
              />
              Animate the preview even with reduced motion on (deliberate override)
            </label>
          </div>

          <fieldset className="visuals-group">
            <legend>Text targets</legend>
            <GlyphInputs config={config} />
            <WordInput />
            <div className="visuals-charrow" role="group" aria-label="Quick characters">
              {QUICK_CHARS.map((char) => (
                <button
                  key={char}
                  title={`Set both glyph targets to ${char}`}
                  onClick={() => visuals.patchConfig({ glyph: [char, char] })}
                >
                  {char}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="visuals-group">
            <legend>Presets</legend>
            <div className="visuals-presets">
              {PRESETS.map((preset) => (
                <button key={preset.id} title={preset.description} onClick={() => visuals.patchConfig(preset.config as PointCloudPatch)}>
                  {preset.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="visuals-group">
            <legend>Material</legend>
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
            <Slider path="particle.count" config={config} />
            <Slider path="particle.sizeMin" config={config} />
            <Slider path="particle.sizeMax" config={config} />
          </fieldset>

          <fieldset className="visuals-group">
            <legend>Fluid</legend>
            <Slider path="fluid.curlScale" config={config} />
            <Slider path="fluid.curlSpeed" config={config} />
            <Slider path="fluid.vortexStrength" config={config} />
            <Slider path="fluid.viscosity" config={config} />
            <Slider path="fluid.returnSpeed" config={config} />
            <Slider path="fluid.turbulence" config={config} />
            <Slider path="fluid.dispersion" config={config} />
          </fieldset>

          <fieldset className="visuals-group">
            <legend>Relational system</legend>
            <button
              className="visuals-relational-toggle"
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
            <Slider path="relational.attractorCount" config={config} />
            <Slider path="relational.attractorGravity" config={config} />
            <Slider path="relational.orbitSpeed" config={config} />
            <Slider path="relational.orbitRadius" config={config} />
            <Slider path="relational.relationalSpin" config={config} />
            <Slider path="relational.chaosFactor" config={config} />
            <Slider path="relational.wanderSpeed" config={config} />
          </fieldset>

          <fieldset className="visuals-group">
            <legend>Pointer</legend>
            <ToggleRow
              label="Force"
              value={config.interaction.mode}
              options={[["repel", "Repel"], ["attract", "Attract"], ["vortex", "Vortex"]]}
              onPick={(value) => visuals.patchConfig({ interaction: { mode: value as PointCloudConfig["interaction"]["mode"] } })}
            />
            <Slider path="interaction.radius" config={config} />
            <Slider path="interaction.strength" config={config} />
          </fieldset>

          <fieldset className="visuals-group">
            <legend>Morph</legend>
            <button
              aria-pressed={config.autoMorph}
              onClick={() => visuals.patchConfig({ autoMorph: !config.autoMorph })}
            >
              {config.autoMorph ? "Auto-morphing" : "Morph manual"}
            </button>
            <Slider path="morphProgress" config={config} />
            <Slider path="autoMorphDuration" config={config} />
          </fieldset>

          <div className="visuals-actions" role="group" aria-label="Field actions">
            <button onClick={() => previewRef.current?.disperse(0, 0, 3.5)}>Disperse</button>
            <button
              onClick={() => {
                const instance = previewRef.current;
                if (!instance) return;
                instance.pause(!previewPaused);
                setPreviewPaused(!previewPaused);
              }}
            >
              {previewPaused ? "Resume simulation" : "Pause simulation"}
            </button>
            <button onClick={() => previewRef.current?.reset()}>Reset field</button>
            <button onClick={() => visuals.resetConfig()}>Restore defaults</button>
          </div>

          <SavedStates states={snapshot.savedStates} />

          <ImportExport />

          {host && <Diagnostics />}
        </>
      )}
    </div>
  );
}

function SavedStates({ states }: { states: SavedState[] }) {
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <fieldset className="visuals-group">
      <legend>Saved states</legend>
      <form
        className="visuals-word"
        onSubmit={(event) => {
          event.preventDefault();
          visuals.saveState(name);
          setName("");
          setNotice(`Saved "${name.trim() || "Config"}"`);
        }}
      >
        <label>Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name this recipe" />
        </label>
        <button type="submit">Save current</button>
      </form>
      {notice && <p className="settings-native-note">{notice}</p>}
      <ul className="visuals-states">
        {states.map((state) => (
          <li key={state.id}>
            <span className="visuals-state-name">{state.name}</span>
            <span className="visuals-state-actions">
              <button onClick={() => {
                visuals.loadState(state.id);
                setNotice(`Loaded "${state.name}"`);
              }}>Load</button>
              <button onClick={() => {
                void navigator.clipboard?.writeText(visuals.exportState(state.id));
                setNotice(`Copied "${state.name}" JSON to the clipboard`);
              }}>Copy JSON</button>
              {state.id !== "oi_logo_mark" && (
                <button onClick={() => visuals.deleteState(state.id)}>Delete</button>
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
      <label>Glyph A
        <DebouncedText value={glyphA} onCommit={(value) => visuals.patchPath("glyph.0", value)} placeholder="O" />
      </label>
      <label>Glyph B
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
      <label>Type any word or phrase
        <input
          type="text"
          value={text}
          placeholder="e.g. FLUID, VOID, 42"
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" disabled={!text.trim()}>Bake word</button>
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

function Slider({ path, config }: { path: string; config: PointCloudConfig }) {
  const spec = CONTROL_SCHEMA[path];
  if (!spec) return null;
  const value = readPath(config, path);
  return (
    <label className="visuals-slider">
      <span className="visuals-slider-label">{spec.label}</span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={typeof value === "number" ? value : spec.min}
        onChange={(event) => {
          const parsed = spec.integer ? parseInt(event.target.value, 10) : parseFloat(event.target.value);
          visuals.patchConfig(pathToPatch(path, parsed));
        }}
      />
      <output className="visuals-slider-value">{typeof value === "number" ? value : "—"}</output>
    </label>
  );
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
    <div className="visuals-row" role="group" aria-label={label}>
      <span className="visuals-slider-label">{label}</span>
      {options.map(([option, optionLabel]) => (
        <button key={option} aria-pressed={value === option} onClick={() => onPick(option)}>
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

function ImportExport() {
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <fieldset className="visuals-group">
      <legend>Import config JSON</legend>
      <textarea
        className="visuals-import"
        rows={4}
        value={text}
        placeholder='{"glyph":["O","I"], …} — validated against the shared schema'
        onChange={(event) => setText(event.target.value)}
      />
      {failure && <p role="alert">{failure}</p>}
      <div className="visuals-actions">
        <button
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

function Diagnostics() {
  const { host } = useVisuals();
  const [reading, setReading] = useState<PointCloudHostInspect | null>(null);
  useEffect(() => {
    if (!host) return;
    const tick = () => setReading(host.inspect());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [host]);
  const summary = useMemo(() => {
    if (!reading) return null;
    const instances = reading.instances.map((instance) => `${instance.id}${instance.tag ? ` (${instance.tag})` : ""}: target ${JSON.stringify(instance.glyph)} — requested ${instance.requestedParticles}, allocated ${instance.allocatedParticles} (${instance.texWidth}×${instance.texHeight})`);
    return [
      `Renderer: ${reading.mode} · ${reading.floatType} targets · ${reading.dpr}× DPR`,
      `Frames drawn: ${reading.frames}`,
      `Allocated particles: ${reading.allocatedParticles} of ${reading.particleBudget} budget`,
      `Instances: ${reading.instances.length} of ${reading.instanceBudget}`,
      ...instances,
    ].join("\n");
  }, [reading]);
  if (!reading) return null;
  return (
    <details className="visuals-diagnostics">
      <summary>Diagnostics</summary>
      <pre>{summary}</pre>
    </details>
  );
}
