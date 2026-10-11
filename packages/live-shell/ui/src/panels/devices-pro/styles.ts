/**
 * Styles for the devices-pro panel family — the faithful device-face ports
 * that edit through the M3 API. Injected once at module load. `prp-`
 * prefix, shell design tokens only (`ui/src/styles.css`): flat, dark,
 * hairline-structured pro-audio faces. Original assets — layout is the
 * port; no Live-derived artwork.
 */

const CSS = `
/* ---- device face frame ---- */
.prp-face {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--bg-1); border: 1px solid var(--line); border-radius: 7px;
  padding: 8px; min-width: 0;
}
.prp-face-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.prp-plate {
  font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--text); background: var(--bg-2); border: 1px solid var(--line-strong);
  border-radius: 4px; padding: 2px 7px; white-space: nowrap;
}
.prp-sub { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-faint); }
.prp-head-spring { flex: 1; }
.prp-element-tag { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); }
.prp-badge {
  font-family: var(--font-mono); font-size: 8.5px; color: var(--amber);
  border: 1px solid var(--line-strong); border-radius: 3px; padding: 1px 5px; white-space: nowrap;
}
.prp-track-select {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
  color: var(--text); font-family: var(--font-mono); font-size: 10px; padding: 2px 4px;
  max-width: 130px;
}
.prp-track-label { display: inline-flex; align-items: center; gap: 4px; }

/* ---- sections (grouped control blocks, like the real faces) ---- */
.prp-section {
  border: 1px solid var(--line); border-radius: 5px; background: var(--bg-1);
  padding: 6px 8px 7px; min-width: 0;
}
.prp-section-title {
  font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.09em;
  color: var(--text-faint); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
}
.prp-section-rule { flex: 1; height: 1px; background: var(--line); }
.prp-row { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
.prp-col { display: flex; flex-direction: column; gap: 6px; align-items: stretch; min-width: 0; }

/* ---- horizontal drag slider (the face's continuous control) ---- */
.prp-slider { display: flex; flex-direction: column; gap: 2px; min-width: 0; user-select: none; }
.prp-slider-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.prp-slider-name { font-size: 9.5px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
.prp-slider-track {
  position: relative; height: 18px; background: var(--bg-0);
  border: 1px solid var(--line); border-radius: 4px; touch-action: none; cursor: ew-resize; overflow: hidden;
}
.prp-slider-fill { position: absolute; top: 0; bottom: 0; left: 0; background: rgba(70, 192, 166, 0.22); border-right: 1px solid var(--accent-dim); }
.prp-slider-thumb {
  position: absolute; top: 1px; bottom: 1px; width: 5px; border-radius: 2px;
  background: var(--accent); transform: translateX(-2px);
}
.prp-slider-ticks { position: absolute; inset: 0; pointer-events: none; }
.prp-slider-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--line); opacity: 0.6; }
.prp-slider-value {
  font-family: var(--font-mono); font-size: 10px; color: var(--accent);
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 3px;
  padding: 1px 5px; white-space: nowrap; cursor: text; text-align: right; min-width: 52px;
}
.prp-slider-input {
  font-family: var(--font-mono); font-size: 10px; color: var(--text);
  background: var(--bg-0); border: 1px solid var(--accent-dim); border-radius: 3px;
  padding: 1px 5px; width: 72px; text-align: right;
}
.prp-slider-input:focus { outline: none; }
.prp-slider.bipolar .prp-slider-fill { background: rgba(164, 142, 201, 0.22); border-right-color: var(--violet); }
.prp-slider.bipolar .prp-slider-thumb { background: var(--violet); }
.prp-slider-vert { cursor: ns-resize; }
.prp-slider-vert .prp-slider-fill { top: auto; left: 0; right: 0; border-right: none; border-top: 1px solid var(--accent-dim); }
.prp-slider-vert .prp-slider-thumb { top: auto; width: auto; left: 1px; right: 1px; height: 5px; transform: translateY(2px); }

/* ---- knob (Echo feedback, Reverb sends, Operator trims) ---- */
.prp-knob { display: flex; flex-direction: column; align-items: center; gap: 1px; width: 52px; user-select: none; }
.prp-knob svg { touch-action: none; cursor: ns-resize; display: block; }
.prp-knob-track { stroke: var(--line-strong); stroke-width: 3; stroke-linecap: round; fill: none; }
.prp-knob-fill { stroke: var(--accent); stroke-width: 3; stroke-linecap: round; fill: none; }
.prp-knob-body { fill: var(--bg-2); stroke: var(--line-strong); stroke-width: 1; }
.prp-knob-pointer { stroke: var(--text); stroke-width: 1.6; stroke-linecap: round; }
.prp-knob-value {
  font-family: var(--font-mono); font-size: 9.5px; color: var(--accent); white-space: nowrap; cursor: text;
}
.prp-knob-input {
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text);
  background: var(--bg-0); border: 1px solid var(--accent-dim); border-radius: 3px;
  padding: 0 3px; width: 56px; text-align: center;
}
.prp-knob-name { font-size: 9px; color: var(--text-dim); white-space: nowrap; }

/* ---- menu (discrete) ---- */
.prp-menu-col { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.prp-menu {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
  color: var(--accent); font-family: var(--font-mono); font-size: 10px;
  padding: 2px 4px; max-width: 110px; width: 100%;
}
.prp-menu:focus { outline: none; border-color: var(--accent-dim); }
.prp-menu-name { font-size: 9.5px; color: var(--text-dim); white-space: nowrap; }

/* ---- segmented (small discrete sets) ---- */
.prp-seg { display: inline-flex; gap: 0; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; background: var(--bg-0); }
.prp-seg-btn {
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text-dim);
  background: var(--bg-2); border: none; border-right: 1px solid var(--line);
  padding: 2px 7px;
}
.prp-seg-btn:last-child { border-right: none; }
.prp-seg-btn:hover { background: var(--bg-3); }
.prp-seg-btn.is-on { color: #0d0f11; background: var(--accent); }

/* ---- toggle switch ---- */
.prp-switch-col { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.prp-switch {
  width: 28px; height: 14px; border-radius: 7px; background: var(--bg-0);
  border: 1px solid var(--line-strong); position: relative; flex: none;
}
.prp-switch-knob {
  position: absolute; top: 1px; left: 1px; width: 10px; height: 10px; border-radius: 50%;
  background: var(--text-faint); transition: left 0.12s ease, background 0.12s ease;
}
.prp-switch.is-on { border-color: var(--accent-dim); background: rgba(70, 192, 166, 0.14); }
.prp-switch.is-on .prp-switch-knob { left: 15px; background: var(--accent); }
.prp-switch-name { font-size: 9.5px; color: var(--text-dim); white-space: nowrap; }

/* ---- numeric field (seconds-style time readouts) ---- */
.prp-field-col { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.prp-field-name { font-size: 9.5px; color: var(--text-dim); white-space: nowrap; }
.prp-field {
  font-family: var(--font-mono); font-size: 10.5px; color: var(--text);
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 3px;
  padding: 2px 5px; width: 74px; text-align: right;
}
.prp-field:focus { outline: none; border-color: var(--accent-dim); background: var(--bg-0); }

/* ---- status marks (per-control persistence) ---- */
.prp-status { font-size: 9px; line-height: 1; margin-left: 4px; }
.prp-status-saving { color: var(--text-faint); }
.prp-status-saved { color: var(--accent); }
.prp-status-error { color: var(--rec); cursor: help; }
.prp-error-text {
  font-family: var(--font-mono); font-size: 9px; color: var(--rec);
  margin-top: 3px; max-width: 340px; overflow-wrap: break-word;
}
.prp-missing { font-size: 9px; color: var(--text-faint); font-style: italic; margin-top: 2px; }

/* ---- meter (Glue GR stub, Echo level display) ---- */
.prp-meter {
  background: var(--bg-0); border: 1px solid var(--line); border-radius: 4px;
  position: relative; overflow: hidden; display: flex; gap: 2px; padding: 3px; justify-content: flex-end;
}
.prp-meter-cell { flex: 1; border-radius: 1px; background: var(--bg-2); min-width: 3px; }
.prp-meter-cell.lit-low { background: var(--accent-dim); }
.prp-meter-cell.lit-mid { background: var(--accent); }
.prp-meter-cell.lit-top { background: var(--amber); }
.prp-meter-scale {
  display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end;
  font-family: var(--font-mono); font-size: 8px; color: var(--text-faint); padding-left: 3px;
}

/* ---- tabs (Wavetable) ---- */
.prp-tabs { display: inline-flex; gap: 2px; border: 1px solid var(--line); border-radius: 5px; padding: 2px; background: var(--bg-0); flex-wrap: wrap; }
.prp-tab {
  font-size: 10px; color: var(--text-dim); padding: 2px 9px; border-radius: 3px; white-space: nowrap;
}
.prp-tab:hover { background: var(--bg-2); }
.prp-tab.is-on { color: var(--text); background: var(--bg-3); box-shadow: inset 0 -2px 0 var(--accent); }

/* ---- wave/transfer display (clean-room SVG windows) ---- */
.prp-display-wrap { display: block; max-width: 100%; }
.prp-display {
  background: var(--bg-0); border: 1px solid var(--line); border-radius: 4px; display: block;
  max-width: 100%; height: auto;
}
.prp-display-grid { stroke: var(--line); stroke-width: 1; }
.prp-display-curve { stroke: var(--accent); stroke-width: 1.5; fill: none; }
.prp-display-curve-dim { stroke: var(--text-faint); stroke-width: 1.2; fill: none; }
.prp-display-fill { fill: rgba(70, 192, 166, 0.07); }
.prp-display-tag { font-family: var(--font-mono); font-size: 8px; fill: var(--text-faint); }
.prp-display-pos { stroke: var(--amber); stroke-width: 1; }

/* ---- delay grid (Echo L/R columns) ---- */
.prp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; min-width: 0; }
.prp-grid-cell {
  border: 1px solid var(--line); border-radius: 5px; background: var(--bg-0);
  padding: 6px; display: flex; flex-direction: column; gap: 6px; min-width: 0;
}
.prp-grid-head { display: flex; align-items: center; gap: 6px; }
.prp-grid-letter { font-size: 10px; font-weight: 700; color: var(--text-dim); }

/* ---- osc row (Operator A column) ---- */
.prp-oscrow { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
.prp-envelope-strip { display: flex; gap: 10px; flex-wrap: wrap; }

/* ---- rack face (bottom slot, compact) ---- */
.prp-rack { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.prp-rack .prp-slider { min-width: 104px; flex: 1; }
.prp-rack .prp-slider-head { flex-direction: column; align-items: stretch; gap: 0; }
.prp-rack .prp-slider-value { width: 100% !important; }
.prp-rack-note { font-size: 9px; color: var(--text-faint); font-style: italic; }

.prp-hint { font-size: 10px; color: var(--text-dim); }
.prp-hint-error { color: var(--rec); }
`

let installed: string | null = null

/** Inject once per page load (idempotent; survives HMR remounts). */
export function installProStyles(): void {
  if (installed === CSS) return
  const el = document.createElement('style')
  el.textContent = CSS
  document.head.appendChild(el)
  installed = CSS
}
