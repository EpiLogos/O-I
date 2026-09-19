/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Pause, Waves } from 'lucide-react';
import { PointCloudConfig, CymaticsEngineMode, CymaticsSweepDirection } from '../engine/types';
import { CymaticMedium, DEFAULT_CYMATIC_MEDIUM } from '../engine/fieldModel';
import { CompositionTelemetry } from '../engine/types';
import { RegistryRow } from './RegistryRow';
import { ParamRow } from './ParamRow';

interface CymaticMediumPanelProps {
  config: PointCloudConfig;
  onChange: (partial: Partial<PointCloudConfig>) => void;
  /** Live telemetry, including the seven station ticks — null until the engine reports. */
  telemetry: CompositionTelemetry['cymatic'] | null | undefined;
  isLight: boolean;
}

/**
 * The single continuous cymatic medium: one driven, damped modal plate shared by the whole
 * field. Dominance blends its transport against formation springs; followFocus lets a
 * travelling composition focus retune it to the focused entity's station.
 */
export const CymaticMediumPanel: React.FC<CymaticMediumPanelProps> = ({ config, onChange, telemetry, isLight }) => {
  const cym: CymaticMedium = { ...DEFAULT_CYMATIC_MEDIUM, ...(config.cymatics || {}) };
  const set = (patch: Partial<CymaticMedium>) => onChange({ cymatics: { ...cym, ...patch } });

  const selectCls = `flex-1 text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${
    isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'
  }`;
  const chip = (active: boolean) =>
    `px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border transition-all ${
      active ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'border-inherit opacity-60 hover:opacity-100'
    }`;

  const stations = telemetry?.stations ?? [];
  const freqMin = stations.length > 0 ? stations[0].frequencyHz * 0.5 : 20;
  const freqMax = stations.length > 0 ? stations[stations.length - 1].frequencyHz * 1.15 : 4000;

  const sweep = cym.sweep ?? { enabled: false, glideS: 3.5, dwellS: 2.0, direction: 'ascent' as CymaticsSweepDirection };

  return (
    <div className="space-y-1.5">
      {/* Master enable + live readout */}
      <div className={`p-2 rounded border flex items-center justify-between ${cym.enabled ? 'border-cyan-500/40 bg-cyan-500/5' : isLight ? 'border-stone-200 bg-stone-50' : 'border-zinc-800 bg-zinc-900/50'}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-cyan-400">
            <Waves className="w-3 h-3" />
            <span>Cymatic Medium</span>
          </div>
          <div className="text-[8.5px] font-mono opacity-60">
            {telemetry ? `${Math.round(telemetry.frequencyHz)} Hz · m=${telemetry.dominantM} n=${telemetry.dominantN} · coherence ${Math.round(telemetry.coherence * 100)}%` : 'One continuously driven, damped modal plate'}
          </div>
        </div>
        <button type="button" onClick={() => set({ enabled: !cym.enabled })} className={`px-2 py-1 rounded text-[9px] font-mono font-bold uppercase border ${cym.enabled ? 'bg-cyan-500 text-black border-cyan-500' : 'border-inherit opacity-70'}`}>
          {cym.enabled ? 'Active' : 'Enable'}
        </button>
      </div>

      {/* Engine */}
      <div className="flex items-center justify-between py-1">
        <span className="text-[10px] font-mono uppercase opacity-70 w-24 shrink-0">Engine</span>
        <select value={cym.engine ?? 'resonator'} onChange={(e) => set({ engine: e.target.value as CymaticsEngineMode })} className={selectCls}>
          <option value="resonator">Continuous resonator</option>
          <option value="template">Legacy baked templates</option>
        </select>
      </div>

      {/* Frequency + station ticks */}
      <div className="space-y-1">
        <RegistryRow path="cymatics.frequencyHz" config={config} onChange={onChange} />
        {stations.length > 0 && (
          <div className="relative h-6 -mt-1">
            {stations.map((st) => {
              const pct = Math.max(0, Math.min(100, ((st.frequencyHz - freqMin) / Math.max(1, freqMax - freqMin)) * 100));
              return (
                <button
                  key={st.index}
                  type="button"
                  title={`${st.name} · ${Math.round(st.frequencyHz)} Hz · m=${st.m} n=${st.n}`}
                  onClick={() => set({ frequencyHz: st.frequencyHz })}
                  className="absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0.5 group/tick"
                  style={{ left: `${pct}%` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full border border-white/30 group-hover/tick:scale-125 transition-transform" style={{ backgroundColor: st.color }} />
                  <span className="text-[7px] font-mono opacity-60 group-hover/tick:opacity-100 whitespace-nowrap">{Math.round(st.frequencyHz)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <RegistryRow path="cymatics.dominance" config={config} onChange={onChange} />

      <div className="flex items-center justify-between py-0.5">
        <span className="text-[10px] font-mono uppercase opacity-70">Follow Focus</span>
        <button type="button" onClick={() => set({ followFocus: !cym.followFocus })} className={chip(cym.followFocus)}>
          {cym.followFocus ? 'On' : 'Off'}
        </button>
      </div>

      {/* Auto sweep through the seven stations */}
      <div className="pt-1 border-t border-inherit/40 space-y-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => set({ autoSweep: !cym.autoSweep })}
            className={`flex-1 py-1 rounded text-[9px] font-mono font-bold uppercase border flex items-center justify-center gap-1 ${
              cym.autoSweep ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'border-inherit opacity-60 hover:opacity-100'
            }`}
          >
            {cym.autoSweep ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
            <span>{cym.autoSweep ? 'Sweeping Stations' : 'Auto-Sweep Stations'}</span>
          </button>
          <select
            value={sweep.direction}
            onChange={(e) => set({ sweep: { ...sweep, direction: e.target.value as CymaticsSweepDirection } })}
            className={selectCls}
            style={{ flex: '0 0 auto', minWidth: 84 }}
          >
            <option value="ascent">Ascent</option>
            <option value="descent">Descent</option>
            <option value="pingpong">Ping-pong</option>
          </select>
        </div>
        <ParamRow label="Sweep Glide" value={sweep.glideS} onChange={(v) => set({ sweep: { ...sweep, glideS: v } })} min={0.1} max={30} hardMin={0.01} hardMax={3600} step={0.1} unit="s" />
        <ParamRow label="Sweep Dwell" value={sweep.dwellS} onChange={(v) => set({ sweep: { ...sweep, dwellS: v } })} min={0} max={30} hardMin={0} hardMax={3600} step={0.1} unit="s" />
      </div>

      {/* Resonator physics */}
      <div className="pt-1 border-t border-inherit/40 space-y-1">
        <span className="text-[9px] font-mono uppercase opacity-60 block mb-0.5">Resonator physics</span>
        <RegistryRow path="cymatics.dampingQFactor" config={config} onChange={onChange} />
        <RegistryRow path="cymatics.driveStrength" config={config} onChange={onChange} />
        <RegistryRow path="cymatics.transportGain" config={config} onChange={onChange} />
        <RegistryRow path="cymatics.agitation" config={config} onChange={onChange} />
        <RegistryRow path="cymatics.plateSize" config={config} onChange={onChange} />
        <RegistryRow path="cymatics.modeCount" config={config} onChange={onChange} />
        <RegistryRow path="cymatics.boundaryStrength" config={config} onChange={onChange} />
      </div>
    </div>
  );
};
