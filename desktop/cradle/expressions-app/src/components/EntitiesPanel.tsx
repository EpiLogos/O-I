/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, Crosshair, Type, Sparkles, Waves, MapPin } from 'lucide-react';
import { Entity, Shape, MAX_FORMATIONS, MAX_PINS, makeFormation, makePin } from '../engine/fieldModel';
import { CompositionTelemetry } from '../engine/types';
import { CANONICAL_CHAKRAS } from '../engine/chakraSystem';

export type PlacementTarget = { kind: 'newPin' } | { kind: 'entity'; id: string } | null;

interface EntitiesPanelProps {
  entities: Entity[];
  selectedEntityId: string | null;
  onSelect: (id: string) => void;
  onAdd: (entity: Entity) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: 1 | -1) => void;
  onUpdate: (id: string, patch: Partial<Entity>) => void;
  telemetry: CompositionTelemetry | null;
  isPlacementMode: boolean;
  placementTarget: PlacementTarget;
  onStartPlaceNewPin: () => void;
  onStartPlaceSelected: () => void;
  isLight: boolean;
}

const shapeGlyph = (s: Shape): string => {
  if (s.kind === 'glyph') return s.text || '·';
  if (s.kind === 'yantra') return CANONICAL_CHAKRAS.find((c) => c.id === s.yantraId)?.symbol || '☸';
  return `${Math.round(s.frequencyHz ?? 396)}Hz`;
};

export const EntitiesPanel: React.FC<EntitiesPanelProps> = ({
  entities,
  selectedEntityId,
  onSelect,
  onAdd,
  onRemove,
  onDuplicate,
  onMove,
  onUpdate,
  telemetry,
  isPlacementMode,
  placementTarget,
  onStartPlaceNewPin,
  onStartPlaceSelected,
  isLight,
}) => {
  const formations = entities.filter((e) => e.kind === 'formation');
  const pins = entities.filter((e) => e.kind === 'pin');
  const ordered = [...formations, ...pins];

  const addFormation = (shape: Shape) => {
    if (formations.length >= MAX_FORMATIONS) return;
    const e = makeFormation({ shape });
    onAdd(e);
    onSelect(e.id);
  };

  const btnCls = 'flex items-center gap-1 px-1.5 py-1 rounded text-[8.5px] font-mono uppercase font-bold disabled:opacity-30 transition-colors';

  return (
    <div className="space-y-2">
      {/* Header actions */}
      <div className="flex items-center gap-1 flex-wrap">
        <button type="button" disabled={formations.length >= MAX_FORMATIONS} onClick={() => addFormation({ kind: 'glyph', text: 'O' })} className={`${btnCls} bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25`}>
          <Type className="w-2.5 h-2.5" /><Plus className="w-2.5 h-2.5" />Glyph
        </button>
        <button type="button" disabled={formations.length >= MAX_FORMATIONS} onClick={() => addFormation({ kind: 'yantra', yantraId: CANONICAL_CHAKRAS[0].id })} className={`${btnCls} bg-purple-500/15 text-purple-400 hover:bg-purple-500/25`}>
          <Sparkles className="w-2.5 h-2.5" /><Plus className="w-2.5 h-2.5" />Yantra
        </button>
        <button type="button" disabled={formations.length >= MAX_FORMATIONS} onClick={() => addFormation({ kind: 'cymatic', frequencyHz: 396 })} className={`${btnCls} bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25`}>
          <Waves className="w-2.5 h-2.5" /><Plus className="w-2.5 h-2.5" />Cymatic
        </button>
        <button
          type="button"
          disabled={pins.length >= MAX_PINS}
          onClick={onStartPlaceNewPin}
          title="Click in the 3D scene to drop a new pin there"
          className={`${btnCls} ${placementTarget?.kind === 'newPin' && isPlacementMode ? 'bg-amber-500 text-black' : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'}`}
        >
          <Crosshair className="w-2.5 h-2.5" /><Plus className="w-2.5 h-2.5" />Pin
        </button>
        {selectedEntityId && (
          <button
            type="button"
            onClick={onStartPlaceSelected}
            title="Click in the 3D scene to move the selected entity there"
            className={`${btnCls} ${placementTarget?.kind === 'entity' && isPlacementMode ? 'bg-cyan-500 text-black' : 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25'}`}
          >
            <MapPin className="w-2.5 h-2.5" />Place in 3D
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-1 max-h-72 overflow-y-auto custom-scrollbar pr-1">
        {ordered.map((e, i) => {
          const seqState = telemetry?.sequences.find((s) => s.entityId === e.id);
          const links = e.sequence.links.length > 0 ? e.sequence.links : [{ shape: e.shape }];
          const isSelected = selectedEntityId === e.id;
          const prevKind = i > 0 ? ordered[i - 1].kind : null;
          const nextKind = i < ordered.length - 1 ? ordered[i + 1].kind : null;
          const canUp = prevKind === e.kind;
          const canDown = nextKind === e.kind;
          return (
            <div
              key={e.id}
              onClick={() => onSelect(e.id)}
              className={`p-1.5 rounded border cursor-pointer transition-colors ${
                isSelected ? 'border-cyan-500/60 bg-cyan-500/5' : isLight ? 'border-stone-200 bg-white hover:bg-stone-50' : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={e.enabled}
                  onClick={(ev) => ev.stopPropagation()}
                  onChange={(ev) => onUpdate(e.id, { enabled: ev.target.checked })}
                  className="w-3 h-3 accent-cyan-400 shrink-0"
                />
                <span className={`text-[7.5px] font-mono uppercase px-1 py-0.5 rounded shrink-0 ${e.kind === 'pin' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{e.kind}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/30" style={{ backgroundColor: e.tint, opacity: e.enabled ? 1 : 0.35 }} />
                <span className={`text-[10px] font-mono font-bold truncate flex-1 ${e.enabled ? '' : 'opacity-40 line-through'}`}>{e.name}</span>
                <span className="text-[9px] font-mono opacity-60 shrink-0">{shapeGlyph(e.shape)}</span>
                <div className="flex items-center gap-0.5 shrink-0" onClick={(ev) => ev.stopPropagation()}>
                  <button type="button" onClick={() => onMove(e.id, -1)} disabled={!canUp} className="p-0.5 opacity-50 hover:opacity-100 disabled:opacity-15"><ArrowUp className="w-2.5 h-2.5" /></button>
                  <button type="button" onClick={() => onMove(e.id, 1)} disabled={!canDown} className="p-0.5 opacity-50 hover:opacity-100 disabled:opacity-15"><ArrowDown className="w-2.5 h-2.5" /></button>
                  <button type="button" onClick={() => onDuplicate(e.id)} className="p-0.5 opacity-50 hover:opacity-100"><Copy className="w-2.5 h-2.5" /></button>
                  <button type="button" onClick={() => onRemove(e.id)} className="p-0.5 text-red-400 opacity-50 hover:opacity-100"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              </div>
              {seqState && links.length > 1 && (
                <div className="text-[8.5px] font-mono opacity-60 pl-6 pt-0.5">
                  {shapeGlyph(links[seqState.linkIndex]?.shape ?? e.shape)} → {shapeGlyph(links[seqState.nextIndex]?.shape ?? e.shape)} · {Math.round(seqState.progress * 100)}%
                </div>
              )}
            </div>
          );
        })}
        {ordered.length === 0 && (
          <div className="p-2 rounded border border-dashed border-inherit text-center opacity-50 text-[9.5px] font-mono">
            No entities yet. Add a formation or a pin above.
          </div>
        )}
      </div>
    </div>
  );
};
