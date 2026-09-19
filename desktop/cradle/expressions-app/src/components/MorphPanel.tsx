/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';
import {
  PointCloudConfig,
  ToroidalMorphConfig,
  MorphTelemetry,
  MorphTrajectoryMode,
  MorphInterferenceMode,
  MorphDriveShape,
} from '../engine/types';
import { DEFAULT_TOROIDAL_CONFIG } from '../engine/PointCloudField';
import { RegistryRow } from './RegistryRow';

interface MorphPanelProps {
  config: PointCloudConfig;
  onChange: (partial: Partial<PointCloudConfig>) => void;
  telemetry: MorphTelemetry | null;
  onResetPhases: () => void;
  isLight: boolean;
}

const TAU = Math.PI * 2;

// Static class table so Tailwind's scanner sees every variant
const TONE_ACTIVE: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
};

/**
 * Unified morph control system: two conjugate phase oscillators (toroidal θ / poloidal φ)
 * whose interference drives A→B progress, the Hopf manifold and (optionally) the sequence clock.
 */
export const MorphPanel: React.FC<MorphPanelProps> = ({ config, onChange, telemetry, onResetPhases, isLight }) => {
  const tm: ToroidalMorphConfig = { ...DEFAULT_TOROIDAL_CONFIG, ...(config.toroidalMorph || {}) };
  const set = (patch: Partial<ToroidalMorphConfig>) => onChange({ toroidalMorph: { ...tm, ...patch } });

  const selectCls = `flex-1 text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${
    isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'
  }`;
  const chip = (active: boolean, tone = 'blue') =>
    `px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border transition-all ${
      active ? TONE_ACTIVE[tone] ?? TONE_ACTIVE.blue : 'border-inherit opacity-60 hover:opacity-100'
    }`;

  const theta = telemetry?.toroidalPhase ?? 0;
  const phi = telemetry?.poloidalPhase ?? 0;
  const thetaFrac = ((theta / TAU) % 1 + 1) % 1;
  const phiFrac = ((phi / TAU) % 1 + 1) % 1;
  const progress = telemetry?.progress ?? (tm.progress ?? 0.5);
  const signal = telemetry?.interference ?? 0;

  const dial = (frac: number, color: string, label: string) => {
    const r = 11;
    const cx = 14;
    const cy = 14;
    const a = frac * TAU - Math.PI / 2;
    return (
      <div className="flex items-center gap-1" title={`${label} phase ${(frac * 360).toFixed(0)}°`}>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
          <line x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke={color} strokeWidth="1.5" />
          <circle cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r="2" fill={color} />
        </svg>
        <div className="text-[8.5px] font-mono leading-tight">
          <div className="opacity-50">{label}</div>
          <div className="tabular-nums font-semibold">{(frac * 360).toFixed(0)}°</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {/* Live telemetry strip */}
      <div className={`p-2 rounded border ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-900/60 border-zinc-800'}`}>
        <div className="flex items-center justify-between gap-2">
          {dial(thetaFrac, '#22d3ee', 'θ toroidal')}
          {dial(phiFrac, '#a78bfa', 'φ poloidal')}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[8.5px] font-mono opacity-60 mb-0.5">
              <span>A</span>
              <span>progress {progress.toFixed(3)}</span>
              <span>B</span>
            </div>
            <div className="h-1.5 rounded-full bg-current/10 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-cyan-400/80 rounded-full transition-[width] duration-75" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex justify-between text-[8px] font-mono opacity-50 mt-0.5">
              <span>interference {signal >= 0 ? '+' : ''}{signal.toFixed(2)}</span>
              <button type="button" onClick={onResetPhases} title="Restart both phases at 0" className="flex items-center gap-0.5 hover:text-cyan-400">
                <RotateCcw className="w-2.5 h-2.5" /> phases
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enable + trajectory */}
      <div className="flex items-center justify-between py-0.5">
        <span className="text-[10px] font-mono uppercase opacity-70">Manifold Active</span>
        <button type="button" onClick={() => set({ enabled: !tm.enabled })} className={chip(tm.enabled)}>
          {tm.enabled ? 'Active' : 'Off'}
        </button>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Trajectory</span>
        <select value={tm.trajectory} onChange={(e) => set({ trajectory: e.target.value as MorphTrajectoryMode })} className={selectCls}>
          <option value="toroidalHopf">Toroidal Hopf (dual fibration)</option>
          <option value="vortexSpiral">Chiral Vortex Spiral</option>
          <option value="quantumInterference">Quantum Superposition</option>
          <option value="linear">Linear Geodesic</option>
        </select>
      </div>

      {/* Drive */}
      <div className="pt-1 border-t border-inherit/40">
        <span className="text-[9px] font-mono uppercase opacity-60 block mb-1">Drive · phase oscillators</span>
        <div className="flex items-center justify-between py-0.5">
          <span className="text-[10px] font-mono uppercase opacity-70">Mode</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => set({ autoOscillate: true })} className={chip(tm.autoOscillate !== false, 'cyan')}>Oscillate</button>
            <button type="button" onClick={() => set({ autoOscillate: false })} className={chip(tm.autoOscillate === false, 'amber')}>Manual</button>
          </div>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Interference</span>
          <select value={tm.interference ?? 'toroidalOnly'} onChange={(e) => set({ interference: e.target.value as MorphInterferenceMode })} className={selectCls}>
            <option value="toroidalOnly">θ only (single phase)</option>
            <option value="product">θ × φ product (conjugate gating)</option>
            <option value="sum">θ + φ sum (two-tone)</option>
            <option value="beat">θ beat-modulated by φ</option>
          </select>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Drive Shape</span>
          <select value={tm.driveShape ?? 'sine'} onChange={(e) => set({ driveShape: e.target.value as MorphDriveShape })} className={selectCls}>
            <option value="sine">Sine</option>
            <option value="triangle">Triangle (linear sweep)</option>
            <option value="smooth">Smooth (eased sweep)</option>
            <option value="pulse">Pulse (snap A/B)</option>
          </select>
        </div>
        <RegistryRow path="toroidalMorph.oscillationSpeed" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.poloidalRate" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.toroidalPhase" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.poloidalPhase" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.driveDepth" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.holdRatio" config={config} onChange={onChange} />
        {tm.autoOscillate === false && (
          <RegistryRow path="toroidalMorph.progress" config={config} onChange={onChange} />
        )}
      </div>

      {/* Manifold geometry */}
      <div className="pt-1 border-t border-inherit/40">
        <span className="text-[9px] font-mono uppercase opacity-60 block mb-1">Manifold · dual inverse Hopf fibrations</span>
        <RegistryRow path="toroidalMorph.toroidalWinding" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.poloidalWinding" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.fiberPhaseOffset" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.chiralCoupling" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.oscillationAmplitude" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.manifoldRadius" config={config} onChange={onChange} />
        <RegistryRow path="toroidalMorph.volumetricDepthScale" config={config} onChange={onChange} />
      </div>
    </div>
  );
};
