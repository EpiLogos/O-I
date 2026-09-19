/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers } from 'lucide-react';
import { PointCloudConfig, CompositionTelemetry } from '../engine/types';
import { Entity, Composition, DEFAULT_COMPOSITION, OrchestrationMode, FocusOrder, COMPOSITION_PRESETS } from '../engine/fieldModel';
import { RegistryRow } from './RegistryRow';

interface CompositionPanelProps {
  config: PointCloudConfig;
  onChange: (partial: Partial<PointCloudConfig>) => void;
  entities: Entity[];
  onSetEntities: (next: Entity[]) => void;
  onApplyPreset: (id: string) => void;
  telemetry: CompositionTelemetry | null;
  isLight: boolean;
}

/** Layout generators for N formations, in world px around the origin. */
const LAYOUTS: Record<string, (n: number) => Array<{ x: number; y: number }>> = {
  ring: (n) => Array.from({ length: n }, (_, i) => ({ x: Math.round(Math.cos((i / n) * Math.PI * 2 - Math.PI / 2) * 260), y: Math.round(Math.sin((i / n) * Math.PI * 2 - Math.PI / 2) * 260) })),
  line: (n) => Array.from({ length: n }, (_, i) => ({ x: Math.round((i - (n - 1) / 2) * 180), y: 0 })),
  column: (n) => Array.from({ length: n }, (_, i) => ({ x: 0, y: Math.round(((n - 1) / 2 - i) * 120) })),
  grid: (n) => {
    const cols = Math.ceil(Math.sqrt(n));
    return Array.from({ length: n }, (_, i) => ({ x: Math.round(((i % cols) - (cols - 1) / 2) * 220), y: Math.round((Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * -200) }));
  },
  spiral: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = i * 2.4;
      const r = 40 + i * 45;
      return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
    }),
};

export const CompositionPanel: React.FC<CompositionPanelProps> = ({ config, onChange, entities, onSetEntities, onApplyPreset, telemetry, isLight }) => {
  const comp: Composition = { ...DEFAULT_COMPOSITION, ...(config.composition || {}), orchestration: { ...DEFAULT_COMPOSITION.orchestration, ...(config.composition?.orchestration || {}) } };
  const set = (patch: Partial<Composition>) => onChange({ composition: { ...comp, ...patch } });
  const setOrch = (patch: Partial<Composition['orchestration']>) => set({ orchestration: { ...comp.orchestration, ...patch } });

  const formations = entities.filter((e) => e.kind === 'formation');

  const applyLayout = (key: string) => {
    const pos = LAYOUTS[key](formations.length);
    const byId = new Map<string, { x: number; y: number }>(formations.map((f, i) => [f.id, pos[i]]));
    onSetEntities(entities.map((e) => (byId.has(e.id) ? { ...e, x: byId.get(e.id)!.x, y: byId.get(e.id)!.y } : e)));
    set({ layoutName: `${key[0].toUpperCase()}${key.slice(1)}` });
  };

  const selectCls = `flex-1 text-[9.5px] font-mono px-1.5 py-1 rounded border outline-none ${
    isLight ? 'bg-white border-stone-300' : 'bg-zinc-900 border-zinc-700 text-white'
  }`;
  const chip = (active: boolean) =>
    `px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border transition-all ${
      active ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' : 'border-inherit opacity-60 hover:opacity-100'
    }`;

  const focus = telemetry?.focus;
  const focusEntity = focus ? entities.find((e) => e.id === focus.entityId) : null;
  const focusNext = focus ? entities.find((e) => e.id === focus.nextEntityId) : null;

  return (
    <div className="space-y-2">
      {/* Live state + name */}
      <div className={`p-2 rounded border ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-purple-400">
          <Layers className="w-3 h-3" />
          <span>Composition</span>
          <span className="opacity-50 font-normal normal-case truncate">· {comp.layoutName || 'Custom'} · {formations.length} formation{formations.length === 1 ? '' : 's'}</span>
        </div>
        {focus && focusEntity && (
          <div className="text-[8.5px] font-mono opacity-70 mt-0.5">
            Focus: <span className="font-semibold">{focusEntity.name}</span> → {focusNext?.name ?? '·'} · {Math.round(focus.blend * 100)}%
          </div>
        )}
      </div>

      {/* One-click presets */}
      <div className="space-y-1">
        <span className="text-[9px] font-mono uppercase opacity-60 block">Presets</span>
        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
          {COMPOSITION_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.id)}
              className={`w-full text-left p-1.5 rounded border transition-all ${
                isLight ? 'bg-white hover:bg-stone-50 border-stone-200' : 'bg-zinc-900 hover:bg-zinc-800/80 border-zinc-800'
              }`}
            >
              <div className="text-[10px] font-bold font-mono">{p.name}</div>
              <div className="text-[8.5px] opacity-60 leading-snug">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Plane */}
      <div className="flex items-center justify-between py-0.5">
        <span className="text-[10px] font-mono uppercase opacity-70">Plane</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => set({ plane: 'vertical' })} className={chip(comp.plane === 'vertical')}>Vertical</button>
          <button type="button" onClick={() => set({ plane: 'horizontal' })} className={chip(comp.plane === 'horizontal')}>Horizontal</button>
        </div>
      </div>

      {/* Orchestration */}
      <div className="pt-1 border-t border-inherit/40 space-y-1">
        <div className="flex items-center justify-between py-0.5">
          <span className="text-[10px] font-mono uppercase opacity-70">Orchestration</span>
          <div className="flex items-center gap-1">
            {(['parallel', 'focus'] as OrchestrationMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setOrch({ mode: m })} className={chip(comp.orchestration.mode === m)}>{m}</button>
            ))}
          </div>
        </div>
        {comp.orchestration.mode === 'focus' && (
          <>
            <div className="flex items-center justify-between py-1">
              <span className="text-[10px] font-mono uppercase opacity-70 w-16 shrink-0">Order</span>
              <select value={comp.orchestration.order} onChange={(e) => setOrch({ order: e.target.value as FocusOrder })} className={selectCls}>
                <option value="listed">Listed</option>
                <option value="reverse">Reverse</option>
                <option value="pingpong">Ping-pong</option>
              </select>
            </div>
            <RegistryRow path="composition.orchestration.dwell" config={config} onChange={onChange} />
            <RegistryRow path="composition.orchestration.glide" config={config} onChange={onChange} />
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[10px] font-mono uppercase opacity-70">Follow Station</span>
              <button type="button" onClick={() => setOrch({ followStation: !comp.orchestration.followStation })} className={chip(comp.orchestration.followStation)}>
                {comp.orchestration.followStation ? 'On' : 'Off'}
              </button>
            </div>
            <RegistryRow path="composition.orchestration.focusTintWeight" config={config} onChange={onChange} />
          </>
        )}
        <RegistryRow path="composition.entityTintWeight" config={config} onChange={onChange} />
      </div>

      {/* Layout tools */}
      <div className="pt-1 border-t border-inherit/40">
        <span className="text-[9px] font-mono uppercase opacity-60 block mb-1">Reposition all formations</span>
        <div className="flex items-center gap-1 flex-wrap text-[8.5px] font-mono uppercase">
          {Object.keys(LAYOUTS).map((k) => (
            <button key={k} type="button" disabled={formations.length === 0} onClick={() => applyLayout(k)} className="px-1.5 py-0.5 rounded bg-stone-500/10 hover:bg-stone-500/20 disabled:opacity-30">
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
