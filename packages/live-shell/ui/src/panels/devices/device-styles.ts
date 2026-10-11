/**
 * Styles for the device panels — injected once at module load.
 *
 * Kept in this module (not styles.css) so the device-panel family stays a
 * self-contained additive unit against the shell frame's moving edits: same
 * design tokens (`ui/src/styles.css`), `devp-` prefix, no frame classes.
 */

const CSS = `
.devp-panel { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }

.devp-header {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  padding-bottom: 6px; border-bottom: 1px solid var(--line);
}
.devp-track-select {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
  color: var(--accent); font-family: var(--font-mono); font-size: 10.5px;
  padding: 2px 4px; max-width: 130px;
}
.devp-track-select:focus { outline: none; border-color: var(--accent-dim); }
.devp-device-tag { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); }

.devp-rows { display: flex; flex-direction: column; }

.devp-row { padding: 7px 0 6px; border-bottom: 1px solid var(--line); }
.devp-row:last-child { border-bottom: none; }
.devp-row-head { display: flex; align-items: center; gap: 6px; min-height: 18px; }
.devp-name {
  flex: 1; min-width: 0; font-size: 11.5px; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.devp-status { flex: none; width: 12px; text-align: center; font-size: 10px; line-height: 1; }
.devp-status-saving { color: var(--text-faint); }
.devp-status-saved { color: var(--accent); }
.devp-status-error { color: var(--rec); }

.devp-value {
  font-family: var(--font-mono); font-size: 11px; color: var(--accent);
  background: none; border: 1px solid transparent; border-radius: 3px;
  padding: 1px 4px; text-align: right; min-width: 64px; cursor: default;
}
.devp-value:hover { border-color: var(--line-strong); background: var(--bg-2); cursor: text; }
.devp-unit { font-family: var(--font-mono); font-size: 9.5px; color: var(--text-faint); flex: none; }

.devp-value-input {
  width: 74px; text-align: right; background: var(--bg-2);
  border: 1px solid var(--accent-dim); border-radius: 3px; color: var(--accent);
  font-family: var(--font-mono); font-size: 11px; padding: 1px 4px;
}
.devp-value-input:focus { outline: none; border-color: var(--accent); }

.devp-slider { width: 100%; margin: 5px 0 1px; accent-color: var(--accent); height: 14px; }
.devp-slider:focus-visible { outline: 1px solid var(--accent-dim); outline-offset: 2px; }

.devp-switch {
  flex: none; width: 30px; height: 16px; border-radius: 8px; position: relative;
  border: 1px solid var(--line-strong); background: var(--bg-2);
}
.devp-switch-knob {
  position: absolute; top: 1px; left: 1px; width: 12px; height: 12px; border-radius: 50%;
  background: var(--text-faint); transition: left 90ms ease, background 90ms ease;
}
.devp-switch-on { border-color: var(--accent-dim); background: var(--accent-dim); }
.devp-switch-on .devp-switch-knob { left: 15px; background: var(--accent); }
.devp-switch:focus-visible { outline: 1px solid var(--accent-dim); outline-offset: 2px; }

.devp-menu {
  background: var(--bg-2); border: 1px solid var(--line); border-radius: 4px;
  color: var(--text); font-family: var(--font-mono); font-size: 10.5px;
  padding: 2px 4px; max-width: 150px;
}
.devp-menu:focus { outline: none; border-color: var(--accent-dim); }
.devp-step-btn {
  flex: none; width: 18px; height: 18px; display: grid; place-items: center;
  border: 1px solid var(--line); border-radius: 3px; color: var(--text-dim);
  font-size: 11px; line-height: 1;
}
.devp-step-btn:hover:not(:disabled) { color: var(--accent); border-color: var(--accent-dim); }
.devp-step-btn:disabled { color: var(--text-faint); opacity: 0.5; cursor: default; }
.devp-step-btn:focus-visible { outline: 1px solid var(--accent-dim); outline-offset: 1px; }

.devp-note { margin-top: 3px; font-size: 9.5px; color: var(--text-faint); }
.devp-error-text { margin-top: 3px; font-size: 10px; color: var(--rec); }
.devp-missing { margin-top: 3px; font-size: 9.5px; color: var(--text-faint); font-style: italic; }
`

export function installDeviceStyles(): void {
  if (document.getElementById('devp-styles')) return
  const el = document.createElement('style')
  el.id = 'devp-styles'
  el.textContent = CSS
  document.head.appendChild(el)
}
