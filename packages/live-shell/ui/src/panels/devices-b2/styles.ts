/**
 * Styles for the devices-b2 panel family — injected once at module load.
 * `b2-` prefix, shell design tokens only (`ui/src/styles.css`), so the
 * family stays an additive unit against the frame's moving edits.
 */

const CSS = `
.b2-device { display: flex; flex-direction: column; gap: 8px; padding-top: 2px; }

.b2-device-head { display: flex; align-items: center; gap: 8px; }
.b2-device-name { font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; color: var(--text); }
.b2-device-element { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); }
.b2-device-spring { flex: 1; }
.b2-badge {
  font-family: var(--font-mono); font-size: 8.5px; color: var(--text-faint);
  border: 1px solid var(--line); border-radius: 3px; padding: 1px 4px;
  white-space: nowrap;
}

.b2-flow { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.b2-col { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.b2-col-label { font-size: 9.5px; color: var(--text-dim); }
.b2-row { display: flex; gap: 8px; align-items: flex-end; }

.b2-section {
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-1);
  padding: 6px 8px 7px; min-width: 0;
}
.b2-section-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-faint); margin-bottom: 5px;
}
.b2-section-body { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
.b2-dimmed { opacity: 0.45; }

/* knob */
.b2-knob { display: flex; flex-direction: column; align-items: center; gap: 1px; width: 48px; user-select: none; }
.b2-knob svg { touch-action: none; cursor: ns-resize; }
.b2-knob-track { stroke: var(--line-strong); stroke-width: 2.5; stroke-linecap: round; }
.b2-knob-fill { stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; }
.b2-knob-body { fill: var(--bg-2); stroke: var(--line-strong); stroke-width: 1; }
.b2-knob-pointer { stroke: var(--text); stroke-width: 1.6; stroke-linecap: round; }
.b2-knob-tip { fill: var(--accent); }
.b2-knob-value { font-family: var(--font-mono); font-size: 9px; color: var(--accent); white-space: nowrap; }
.b2-knob-label { font-size: 9px; color: var(--text-dim); white-space: nowrap; }

/* menu */
.b2-menu-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.b2-menu {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
  color: var(--accent); font-family: var(--font-mono); font-size: 10px;
  padding: 2px 3px; max-width: 92px;
}
.b2-menu:focus { outline: none; border-color: var(--accent-dim); }

/* segmented */
.b2-seg-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.b2-seg { display: flex; gap: 2px; }
.b2-seg-cols-2 { display: grid; grid-template-columns: repeat(2, auto); gap: 2px; }
.b2-seg-cols-4 { display: grid; grid-template-columns: repeat(4, auto); gap: 2px; }
.b2-seg-btn {
  font-family: var(--font-mono); font-size: 9.5px; color: var(--text-dim);
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 3px;
  padding: 1px 5px; min-width: 18px;
}
.b2-seg-btn:hover { background: var(--bg-3); }
.b2-seg-btn.is-on { color: #0d0f11; background: var(--amber); border-color: var(--amber); }

/* switch */
.b2-switch-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.b2-switch {
  width: 26px; height: 13px; border-radius: 7px; background: var(--bg-2);
  border: 1px solid var(--line-strong); position: relative; flex: none;
}
.b2-switch-knob {
  position: absolute; top: 1px; left: 1px; width: 9px; height: 9px;
  border-radius: 50%; background: var(--text-faint); transition: left 0.12s ease, background 0.12s ease;
}
.b2-switch.is-on { border-color: var(--accent-dim); background: rgba(70, 192, 166, 0.12); }
.b2-switch.is-on .b2-switch-knob { left: 14px; background: var(--accent); }

/* fader */
.b2-fader { display: flex; flex-direction: column; align-items: center; gap: 1px; width: 34px; user-select: none; }
.b2-fader-track {
  width: 14px; background: var(--bg-2); border: 1px solid var(--line);
  border-radius: 4px; position: relative; touch-action: none; cursor: ns-resize; overflow: hidden;
}
.b2-fader-fill { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(70, 192, 166, 0.25); }
.b2-fader-cap {
  position: absolute; left: 1px; right: 1px; height: 8px; border-radius: 2px;
  background: var(--bg-3); border: 1px solid var(--line-strong);
}

/* readout */
.b2-readout { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.b2-readout-value {
  font-family: var(--font-mono); font-size: 10px; color: var(--text);
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 3px;
  padding: 2px 5px; white-space: nowrap;
}
.b2-readout-wide .b2-readout-value { min-width: 58px; text-align: center; }

/* graphs (original SVG drawings, port layout only) */
.b2-graph {
  background: var(--bg-0); border: 1px solid var(--line); border-radius: 4px;
  display: block;
}
.b2-graph-grid { stroke: var(--line); stroke-width: 1; }
.b2-graph-curve { stroke: var(--accent); stroke-width: 1.6; fill: none; }
.b2-graph-curve-2 { stroke: var(--amber); stroke-width: 1.4; fill: none; }
.b2-graph-node { fill: var(--bg-2); stroke: var(--amber); stroke-width: 1.4; cursor: grab; }
.b2-graph-node.is-selected { stroke: var(--accent); }
.b2-graph-fillarea { fill: rgba(70, 192, 166, 0.08); stroke: none; }
.b2-graph-tag { font-family: var(--font-mono); font-size: 8px; fill: var(--text-faint); }
.b2-node-off { opacity: 0.4; }
.b2-band-col { display: flex; flex-direction: column; gap: 3px; align-items: center; }
.b2-band-btn {
  width: 26px; height: 16px; font-family: var(--font-mono); font-size: 9.5px;
  color: var(--text-dim); background: var(--bg-2); border: 1px solid var(--line);
  border-radius: 3px;
}
.b2-band-btn:hover { background: var(--bg-3); }
.b2-band-btn.is-selected { color: #0d0f11; background: var(--accent); border-color: var(--accent); }
.b2-band-btn.is-off { color: var(--text-faint); text-decoration: line-through; }
.b2-band-row { display: flex; gap: 8px; align-items: flex-end; }

/* stored-parameter footer */
.b2-extras {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end;
  border-top: 1px dashed var(--line); padding-top: 6px;
}
.b2-extras-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-faint); align-self: center; margin-right: 2px;
}
`

let installed: string | null = null

/** Inject once per page load (idempotent; survives HMR remounts). */
export function installB2Styles(): void {
  if (installed === CSS) return
  const el = document.createElement('style')
  el.textContent = CSS
  document.head.appendChild(el)
  installed = CSS
}
