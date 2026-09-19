/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Play, Activity, Zap, Copy } from 'lucide-react';
import { PointCloudConfig, AutomationLane, AutomationWaveform, AutomationEasing, AutomationLoop } from '../engine/types';
import { PARAM_REGISTRY, ParamDef } from '../engine/paramRegistry';
import { createLane, readPath, AutomationLiveValue } from '../engine/automation';
import { ParamRow } from './ParamRow';

// Static class table so Tailwind's scanner sees every variant
const TONE_ACTIVE: Record<string, string> = {
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
};

interface AutomationPanelProps {
  config: PointCloudConfig;
  onChange: (partial: Partial<PointCloudConfig>) => void;
  live: AutomationLiveValue[];
  onFire: (id: string) => void;
  /** Dynamic ParamDefs for the currently selected entity (entityParamDefs(index, entity)), if any. */
  entityDefs?: ParamDef[];
  isLight: boolean;
}

export const AutomationPanel: React.FC<AutomationPanelProps> = ({ config, onChange, live, onFire, entityDefs = [], isLight }) => {
  const lanes = config.automations || [];
  const allDefs = useMemo(() => [...PARAM_REGISTRY, ...entityDefs], [entityDefs]);
  const defsByPath = useMemo(() => new Map(allDefs.map((d) => [d.path, d])), [allDefs]);
  const groups = useMemo(() => Array.from(new Set(allDefs.map((d) => d.group))), [allDefs]);
  const getParamDef = (path: string) => defsByPath.get(path);
  const paramLabel = (path: string) => defsByPath.get(path)?.label ?? path;
  const [newPath, setNewPath] = useState<string>('fluid.curlScale');
  const [newType, setNewType] = useState<'lfo' | 'oneShot'>('lfo');

  const setLanes = (next: AutomationLane[]) => onChange({ automations: next });
  const updateLane = (id: string, patch: Partial<AutomationLane>) => setLanes(lanes.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLane = (id: string) => setLanes(lanes.filter((l) => l.id !== id));

  const addLane = () => {
    const def = getParamDef(newPath);
    if (!def) return;
    const base = readPath(config, newPath);
    const lane = createLane(newPath, newType, typeof base === 'number' ? base : (def.min + def.max) / 2, [def.min, def.max]);
    setLanes([...lanes, lane]);
  };

  const duplicateLane = (l: AutomationLane) => {
    setLanes([...lanes, { ...l, id: 'auto_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }]);
  };

  const fire = (l: AutomationLane) => {
    onFire(l.id);
    updateLane(l.id, { fireToken: (l.fireToken ?? 0) + 1, enabled: true });
  };

  const liveById = new Map<string, AutomationLiveValue>(live.map((v) => [v.id, v]));
  const selectCls = `text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'}`;
  const chip = (active: boolean, tone: string) =>
    `px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase border ${active ? TONE_ACTIVE[tone] ?? TONE_ACTIVE.cyan : 'border-inherit opacity-50 hover:opacity-100'}`;

  return (
    <div className="space-y-2">
      <p className="text-[8.5px] font-mono opacity-60 leading-snug">
        Lanes modulate any parameter every frame without touching your base values. LFOs cycle forever; one-shots ramp value → value over a time delta (fire again any time). Lanes are saved with snapshots.
      </p>

      {/* Add lane */}
      <div className={`p-2 rounded border space-y-1 ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-900/60 border-zinc-800'}`}>
        <div className="flex items-center gap-1">
          <select value={newPath} onChange={(e) => setNewPath(e.target.value)} className={`${selectCls} flex-1 min-w-0`}>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {allDefs.filter((p) => p.group === g).map((p) => (
                  <option key={p.path} value={p.path}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={() => setNewType('lfo')} className={chip(newType === 'lfo', 'cyan')} title="Low-frequency oscillator"><Activity className="w-3 h-3 inline" /> LFO</button>
          <button type="button" onClick={() => setNewType('oneShot')} className={chip(newType === 'oneShot', 'amber')} title="One-shot ramp value → value"><Zap className="w-3 h-3 inline" /> Shot</button>
          <button type="button" onClick={addLane} className="flex items-center gap-0.5 px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-mono font-bold uppercase hover:bg-cyan-500/30"><Plus className="w-3 h-3" />Add</button>
        </div>
      </div>

      {lanes.length === 0 && (
        <div className="p-2 rounded border border-dashed border-inherit text-center opacity-50 text-[9.5px] font-mono">No automation lanes yet.</div>
      )}

      <div className="space-y-1.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
        {lanes.map((l) => {
          const def = getParamDef(l.path);
          const lv = liveById.get(l.id);
          const isLfo = l.type === 'lfo';
          const hardMin = def?.hardMin ?? -1e9;
          const hardMax = def?.hardMax ?? 1e9;
          const softMin = def?.min ?? 0;
          const softMax = def?.max ?? 1;
          const decimals = def?.decimals ?? 2;
          return (
            <div key={l.id} className={`rounded border ${l.enabled ? (isLfo ? 'border-cyan-500/40' : 'border-amber-500/40') : 'border-inherit opacity-70'} bg-stone-500/5 p-1.5 space-y-1`}>
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={l.enabled} onChange={(e) => updateLane(l.id, { enabled: e.target.checked })} className="w-3 h-3 accent-cyan-400" />
                <span className={`text-[8px] font-mono font-bold uppercase px-1 rounded ${isLfo ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>{isLfo ? 'LFO' : 'SHOT'}</span>
                <span className="text-[9.5px] font-mono font-semibold truncate flex-1 min-w-0" title={l.path}>{paramLabel(l.path)}</span>
                {lv && (
                  <span className="text-[9px] font-mono tabular-nums text-cyan-300" title="Live value">{lv.value.toFixed(decimals)}</span>
                )}
                {lv && (
                  <div className="w-10 h-1 rounded bg-current/10 overflow-hidden" title={`phase ${(lv.phase * 100).toFixed(0)}%`}>
                    <div className={`h-full ${isLfo ? 'bg-cyan-400' : lv.done ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${lv.phase * 100}%` }} />
                  </div>
                )}
                {!isLfo && (
                  <button type="button" onClick={() => fire(l)} title="Fire ramp" className="p-1 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"><Play className="w-2.5 h-2.5" /></button>
                )}
                <button type="button" onClick={() => duplicateLane(l)} title="Duplicate lane" className="p-0.5 opacity-50 hover:opacity-100"><Copy className="w-2.5 h-2.5" /></button>
                <button type="button" onClick={() => removeLane(l.id)} title="Remove lane" className="p-0.5 text-red-400 opacity-60 hover:opacity-100"><Trash2 className="w-2.5 h-2.5" /></button>
              </div>

              {isLfo ? (
                <>
                  <div className="flex items-center gap-1">
                    <select value={l.waveform ?? 'sine'} onChange={(e) => updateLane(l.id, { waveform: e.target.value as AutomationWaveform })} className={`${selectCls} flex-1`}>
                      <option value="sine">Sine</option>
                      <option value="triangle">Triangle</option>
                      <option value="square">Square</option>
                      <option value="saw">Saw</option>
                      <option value="randomStep">Random step (S&H)</option>
                      <option value="smoothRandom">Smooth random</option>
                    </select>
                    <select value={l.blend ?? 'replace'} onChange={(e) => updateLane(l.id, { blend: e.target.value as any })} className={selectCls} title="How the lane combines with the base value">
                      <option value="replace">replace</option>
                      <option value="add">add</option>
                      <option value="multiply">multiply</option>
                    </select>
                  </div>
                  <ParamRow label="Min" value={l.min ?? softMin} onChange={(v) => updateLane(l.id, { min: v })} min={softMin} max={softMax} hardMin={hardMin} hardMax={hardMax} step={def?.step ?? 0.01} decimals={decimals} unit={def?.unit} />
                  <ParamRow label="Max" value={l.max ?? softMax} onChange={(v) => updateLane(l.id, { max: v })} min={softMin} max={softMax} hardMin={hardMin} hardMax={hardMax} step={def?.step ?? 0.01} decimals={decimals} unit={def?.unit} />
                  <ParamRow label="Rate" value={l.rateHz ?? 0.2} onChange={(v) => updateLane(l.id, { rateHz: v })} min={0.001} max={5} hardMin={-1000} hardMax={1000} step={0.005} decimals={3} unit="Hz" />
                  <ParamRow label="Phase" value={l.phase ?? 0} onChange={(v) => updateLane(l.id, { phase: v })} min={0} max={1} hardMin={-100} hardMax={100} step={0.01} />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <select value={l.easing ?? 'smooth'} onChange={(e) => updateLane(l.id, { easing: e.target.value as AutomationEasing })} className={`${selectCls} flex-1`}>
                      <option value="linear">Linear</option>
                      <option value="smooth">Smooth</option>
                      <option value="easeIn">Ease in</option>
                      <option value="easeOut">Ease out</option>
                      <option value="elastic">Elastic</option>
                      <option value="bounce">Bounce</option>
                    </select>
                    <select value={l.loop ?? 'none'} onChange={(e) => updateLane(l.id, { loop: e.target.value as AutomationLoop })} className={selectCls}>
                      <option value="none">once</option>
                      <option value="restart">loop</option>
                      <option value="pingpong">ping-pong</option>
                    </select>
                    <select value={l.blend ?? 'replace'} onChange={(e) => updateLane(l.id, { blend: e.target.value as any })} className={selectCls}>
                      <option value="replace">replace</option>
                      <option value="add">add</option>
                      <option value="multiply">multiply</option>
                    </select>
                  </div>
                  <ParamRow label="From" value={l.from ?? softMin} onChange={(v) => updateLane(l.id, { from: v })} min={softMin} max={softMax} hardMin={hardMin} hardMax={hardMax} step={def?.step ?? 0.01} decimals={decimals} unit={def?.unit} />
                  <ParamRow label="To" value={l.to ?? softMax} onChange={(v) => updateLane(l.id, { to: v })} min={softMin} max={softMax} hardMin={hardMin} hardMax={hardMax} step={def?.step ?? 0.01} decimals={decimals} unit={def?.unit} />
                  <ParamRow label="Duration" value={l.durationS ?? 3} onChange={(v) => updateLane(l.id, { durationS: v })} min={0.05} max={60} hardMin={0.001} hardMax={36000} step={0.05} unit="s" />
                  <ParamRow label="Delay" value={l.delayS ?? 0} onChange={(v) => updateLane(l.id, { delayS: v })} min={0} max={30} hardMin={0} hardMax={36000} step={0.05} unit="s" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
